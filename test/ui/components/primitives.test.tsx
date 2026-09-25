// @vitest-environment happy-dom
/**
 * S3.1 · the accessible primitive kit (T63): Tabs, ToggleButton, Checkbox,
 * IconButton and Card render their roles, names and states, work from the
 * keyboard and carry the focus ring.
 *
 * Their label props are required by the types. vitest doesn't type-check, so
 * the last test compiles this file with the project's compiler options: every
 * `@ts-expect-error` in typeChecks() must mark a real error, because an unused
 * one is itself an error.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Trash2 } from 'lucide-react';
import { Tabs, type TabItem } from '../../../src/ui/components/shared/Tabs';
import { ToggleButton } from '../../../src/ui/components/shared/ToggleButton';
import { Checkbox } from '../../../src/ui/components/shared/Checkbox';
import { IconButton } from '../../../src/ui/components/shared/IconButton';
import { Card } from '../../../src/ui/components/shared/Card';
import { inputRegistry } from '../../../src/ui/input/inputRegistry';

afterEach(cleanup);

/**
 * What a browser does with Space on a focused control: keydown, keyup, then a
 * click (checkbox and button activation) unless either key's default was
 * prevented. happy-dom has no activation behaviour of its own.
 */
function pressSpace(el: HTMLElement): void {
  const down = fireEvent.keyDown(el, { key: ' ', code: 'Space' });
  const up = fireEvent.keyUp(el, { key: ' ', code: 'Space' });
  if (down && up) fireEvent.click(el);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type DrawerTab = 'timeline' | 'composer' | 'presets';
const DRAWER_TABS: TabItem<DrawerTab>[] = [
  { id: 'timeline', label: 'Timeline', testId: 'drawer-tab-timeline', panelTestId: 'timeline-panel' },
  { id: 'composer', label: 'Composer', testId: 'drawer-tab-composer' },
  { id: 'presets', label: 'Presets' },
];

function DrawerTabs({ keepMounted = false, onSelect }: { keepMounted?: boolean; onSelect?: (id: DrawerTab) => void }) {
  const [selected, setSelected] = useState<DrawerTab>('timeline');
  return (
    <Tabs
      label="Drawer"
      tabs={DRAWER_TABS}
      selected={selected}
      onSelect={id => { onSelect?.(id); setSelected(id); }}
      keepMounted={keepMounted}
      renderPanel={id => <p>{`${id} content`}</p>}
      listEnd={<button type="button">Collapse</button>}
    />
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });
const selectedTabName = () => screen.getAllByRole('tab').find(t => t.getAttribute('aria-selected') === 'true')?.textContent;

describe('Tabs', () => {
  it('a named tablist; tabs with aria-selected and aria-controls; panels labelled by their tab', () => {
    render(<DrawerTabs />);
    const list = screen.getByRole('tablist', { name: 'Drawer' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Timeline', 'Composer', 'Presets']);
    expect(tabs.every(t => list.contains(t) && t.tagName === 'BUTTON')).toBe(true);
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    // Every tab controls an existing panel, and every panel is labelled by its tab.
    for (const t of tabs) {
      const panel = document.getElementById(t.getAttribute('aria-controls')!)!;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(t.id);
    }
    // Only the selected panel shows, and only its content is mounted.
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels.map(p => p.hidden)).toEqual([false, true, true]);
    expect(screen.getByRole('tabpanel', { name: 'Timeline' }).textContent).toBe('timeline content');
    expect(screen.queryByText('composer content')).toBeNull();
    // Per-tab test ids pass through, so existing selectors can move onto the tabs.
    expect(screen.getByTestId('drawer-tab-timeline')).toBe(tab('Timeline'));
    expect(screen.getByTestId('timeline-panel')).toBe(panels[0]);
    // listEnd sits in the tab row but outside the tablist.
    expect(list.contains(screen.getByRole('button', { name: 'Collapse' }))).toBe(false);
  });

  it('roving tabindex: only the selected tab is in the Tab order', () => {
    render(<DrawerTabs />);
    expect(screen.getAllByRole('tab').map(t => t.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.click(tab('Presets'));
    expect(screen.getAllByRole('tab').map(t => t.tabIndex)).toEqual([-1, -1, 0]);
    expect(selectedTabName()).toBe('Presets');
    expect(screen.getByRole('tabpanel', { name: 'Presets' }).textContent).toBe('presets content');
  });

  it('←/→ (wrapping), Home and End move focus and select, and keep the key from anything else', () => {
    const onSelect = vi.fn();
    render(<DrawerTabs onSelect={onSelect} />);
    tab('Timeline').focus();
    const step = (key: string) => fireEvent.keyDown(document.activeElement!, { key });

    expect(step('ArrowRight')).toBe(false); // default prevented
    expect(document.activeElement).toBe(tab('Composer'));
    expect(selectedTabName()).toBe('Composer');
    step('ArrowRight');
    step('ArrowRight');
    // Past the last tab, → wraps to the first; ← wraps back to the last.
    expect(document.activeElement).toBe(tab('Timeline'));
    expect(selectedTabName()).toBe('Timeline');
    step('ArrowLeft');
    expect(document.activeElement).toBe(tab('Presets'));
    expect(selectedTabName()).toBe('Presets');
    step('Home');
    expect(document.activeElement).toBe(tab('Timeline'));
    step('End');
    expect(document.activeElement).toBe(tab('Presets'));
    expect(selectedTabName()).toBe('Presets');
    expect(onSelect.mock.calls.map(c => c[0])).toEqual(['composer', 'presets', 'timeline', 'presets', 'timeline', 'presets']);

    // Other keys, and modified arrows, are not the tabs'.
    expect(step('ArrowDown')).toBe(true);
    expect(fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft', shiftKey: true })).toBe(true);
    expect(selectedTabName()).toBe('Presets');
  });

  it('keepMounted keeps unselected panels mounted, hidden', () => {
    render(<DrawerTabs keepMounted />);
    expect(screen.getByText('composer content', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('composer content').closest('[role="tabpanel"]')!.hasAttribute('hidden')).toBe(true);
  });

  it('labelledBy names the tablist after a visible heading', () => {
    render(
      <>
        <h2 id="sidebar-title">Sidebar</h2>
        <Tabs labelledBy="sidebar-title" tabs={DRAWER_TABS} selected="composer" onSelect={() => {}} renderPanel={() => null} />
      </>,
    );
    expect(screen.getByRole('tablist', { name: 'Sidebar' })).toBeTruthy();
    expect(selectedTabName()).toBe('Composer');
  });
});

// ---------------------------------------------------------------------------
// ToggleButton
// ---------------------------------------------------------------------------

function LoopToggle({ hideLabel = false }: { hideLabel?: boolean }) {
  const [on, setOn] = useState(false);
  return <ToggleButton label="Loop" pressed={on} onPressedChange={setOn} hideLabel={hideLabel} icon={<Trash2 size={12} />} />;
}

describe('ToggleButton', () => {
  it('is a real button with aria-pressed that flips on click', () => {
    render(<LoopToggle />);
    const button = screen.getByRole('button', { name: 'Loop', pressed: false });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Loop', pressed: true })).toBe(button);
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    // Its icon is decoration; at least 24 px tall.
    expect(button.querySelector('svg')!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect(button.className).toContain('min-h-[24px]');
  });

  it('hideLabel shows the icon alone, named by aria-label and the tooltip', () => {
    render(<LoopToggle hideLabel />);
    const button = screen.getByRole('button', { name: 'Loop', pressed: false });
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Loop');
    expect(button.title).toBe('Loop');
    expect(button.className).toContain('min-w-[24px]');
  });

  it('Space still plays with it focused and leaves it unpressed; Enter-style clicks press it (S2.4)', () => {
    const play = vi.fn();
    const off = inputRegistry.register('space', play);
    try {
      render(<LoopToggle />);
      const button = screen.getByRole('button', { name: 'Loop' });
      button.focus();
      pressSpace(button);
      expect(play).toHaveBeenCalledTimes(1);
      expect(button.getAttribute('aria-pressed')).toBe('false');
    } finally {
      off();
    }
  });
});

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

function FingerCheckbox({ onChange }: { onChange?: (checked: boolean) => void }) {
  const [on, setOn] = useState(false);
  return <Checkbox label="Show finger assignment" checked={on} onChange={v => { onChange?.(v); setOn(v); }} />;
}

describe('Checkbox', () => {
  it('a native checkbox named by its visible label; a click on the box or the label toggles it', () => {
    const onChange = vi.fn();
    render(<FingerCheckbox onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Show finger assignment' }) as HTMLInputElement;
    expect(box.tagName).toBe('INPUT');
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(box.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Show finger assignment', checked: true })).toBe(box);
    // The label wraps it, so the whole row is the (at least 24 px) target.
    const label = box.closest('label')!;
    expect(label.textContent).toBe('Show finger assignment');
    expect(label.className).toContain('min-h-[24px]');
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(box.checked).toBe(false);
  });

  it('Space ticks it and doesn\'t play: the input table leaves Space to a focused checkbox', () => {
    const play = vi.fn();
    const off = inputRegistry.register('space', play);
    try {
      render(<FingerCheckbox />);
      const box = screen.getByRole('checkbox', { name: 'Show finger assignment' }) as HTMLInputElement;
      box.focus();
      expect(document.activeElement).toBe(box);
      pressSpace(box);
      expect(box.checked).toBe(true);
      pressSpace(box);
      expect(box.checked).toBe(false);
      expect(play).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it('an aria-label names it where the row says what it is; indeterminate shows the mixed state', () => {
    const { rerender } = render(<Checkbox aria-label="Compare candidate B" checked={false} indeterminate onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Compare candidate B' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.closest('label')!.className).toContain('min-w-[24px]');
    rerender(<Checkbox aria-label="Compare candidate B" checked onChange={() => {}} />);
    expect(box.indeterminate).toBe(false);
    expect(box.checked).toBe(true);
  });

  it('disabledReason disables it and says why beside it, tied by aria-describedby', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Compare" checked={false} onChange={onChange} disabledReason="Generate candidates first" />);
    const box = screen.getByRole('checkbox', { name: 'Compare' }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    const reason = document.getElementById(box.getAttribute('aria-describedby')!)!;
    expect(reason.textContent).toBe('Generate candidates first');
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------

describe('IconButton', () => {
  it('its label is the accessible name and the tooltip; the icon is hidden; 24 px at least', () => {
    const onClick = vi.fn();
    render(<IconButton label="Delete variant" onClick={onClick}><Trash2 size={12} /></IconButton>);
    const button = screen.getByRole('button', { name: 'Delete variant' });
    expect(button.title).toBe('Delete variant');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.querySelector('svg')!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect(button.className).toContain('w-6 h-6');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('title={false} drops the tooltip; size picks a larger square', () => {
    render(<IconButton label="Collapse" title={false} size={32}><Trash2 size={12} /></IconButton>);
    const button = screen.getByRole('button', { name: 'Collapse' });
    expect(button.hasAttribute('title')).toBe(false);
    expect(button.className).toContain('w-8 h-8');
  });

  it('disabledReason disables it and says why beside it (the DisabledReason pattern)', () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Delete variant" aria-describedby="card-help" disabledReason="The Active Layout can't be deleted" onClick={onClick}>
        <Trash2 size={12} />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete variant' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const ids = button.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('card-help');
    expect(document.getElementById(ids[1]!)!.textContent).toBe('The Active Layout can\'t be deleted');
    expect(screen.getByTestId('disabled-reason').textContent).toBe('The Active Layout can\'t be deleted');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

describe('Card', () => {
  it('plain, it is a container: no button, no link', () => {
    render(<Card testId="card">Default · 7 pads</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(card.textContent).toBe('Default · 7 pads');
  });

  it('with an action, a real button named by its label covers the card; the card\'s own controls stay separate', () => {
    const inspect = vi.fn();
    const promote = vi.fn();
    render(
      <Card as="li" testId="card" action={{ label: 'Inspect candidate B', onClick: inspect, current: true, testId: 'card-action' }}>
        <span>Candidate B</span>
        <button type="button" onClick={promote}>Promote</button>
      </Card>,
    );
    const action = screen.getByRole('button', { name: 'Inspect candidate B' });
    expect(action.tagName).toBe('BUTTON');
    expect(action.className).toContain('pf-card-action');
    expect(action.getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('card').tagName).toBe('LI');
    // The card's other controls are siblings of the action, never nested in it.
    const promoteButton = screen.getByRole('button', { name: 'Promote' });
    expect(action.contains(promoteButton)).toBe(false);
    fireEvent.click(promoteButton);
    expect(promote).toHaveBeenCalledTimes(1);
    expect(inspect).not.toHaveBeenCalled();
    fireEvent.click(action);
    expect(inspect).toHaveBeenCalledTimes(1);
    // Keyboard-operable: a native button in the Tab order.
    action.focus();
    expect(document.activeElement).toBe(action);
    expect(action.tabIndex).toBe(0);
  });

  it('with an href, a real link', () => {
    render(<Card action={{ label: 'Open TEST MIDI 1', href: '/project/p1' }}>TEST MIDI 1</Card>);
    const link = screen.getByRole('link', { name: 'Open TEST MIDI 1' });
    expect(link.getAttribute('href')).toBe('/project/p1');
    expect(link.hasAttribute('aria-current')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Visible focus and required labels
// ---------------------------------------------------------------------------

describe('every primitive', () => {
  it('draws the focus ring on its focusable element, in the focus token', () => {
    render(
      <>
        <DrawerTabs />
        <LoopToggle />
        <FingerCheckbox />
        <IconButton label="Delete variant"><Trash2 size={12} /></IconButton>
        <Card action={{ label: 'Inspect', onClick: () => {} }}>x</Card>
      </>,
    );
    const focusable = [
      ...screen.getAllByRole('tab'),
      screen.getByRole('tabpanel'),
      screen.getByRole('button', { name: 'Loop' }),
      screen.getByRole('checkbox'),
      screen.getByRole('button', { name: 'Delete variant' }),
      screen.getByRole('button', { name: 'Inspect' }),
    ];
    for (const el of focusable) expect(el.classList.contains('focus-ring')).toBe(true);
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8');
    expect(css).toMatch(/\.focus-ring:focus-visible \{\s*outline: 2px solid var\(--border-focus\);/);
  });

  it('requires its label props: this file type-checks, so every @ts-expect-error marks a real error', () => {
    expect(typeof typeChecks).toBe('function');
    const configPath = path.resolve(__dirname, '../../../tsconfig.json');
    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));
    const file = path.resolve(__dirname, 'primitives.test.tsx');
    const program = ts.createProgram([file], { ...options, noEmit: true });
    const errors = ts.getPreEmitDiagnostics(program, program.getSourceFile(file))
      .map(d => `${d.start ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    expect(errors).toEqual([]);
  }, 60_000);
});

/** Never called: compiled by the test above. Each line after an @ts-expect-error must not compile. */
function typeChecks() {
  const noop = () => {};
  return [
    // @ts-expect-error a tab list needs a name: label or labelledBy
    <Tabs tabs={DRAWER_TABS} selected="timeline" onSelect={noop} renderPanel={() => null} />,
    // @ts-expect-error a ToggleButton needs its label
    <ToggleButton pressed onPressedChange={noop} />,
    // @ts-expect-error a Checkbox needs a visible label or an aria-label
    <Checkbox checked onChange={noop} />,
    // @ts-expect-error not both: the visible label is the name
    <Checkbox label="Loop" aria-label="Loop" checked onChange={noop} />,
    // @ts-expect-error an IconButton needs its label
    <IconButton><Trash2 /></IconButton>,
    // @ts-expect-error never a clickable div: an interactive Card takes an action
    <Card onClick={noop}>x</Card>,
    // @ts-expect-error an action needs its accessible name
    <Card action={{ onClick: noop }}>x</Card>,
  ];
}
