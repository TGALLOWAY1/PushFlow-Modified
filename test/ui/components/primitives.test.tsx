// @vitest-environment happy-dom
/**
 * The shared ToggleButton and IconButton render their roles, names and states, work from the
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
import { ToggleButton } from '../../../src/ui/components/shared/ToggleButton';
import { IconButton } from '../../../src/ui/components/shared/IconButton';
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
// Visible focus and required labels
// ---------------------------------------------------------------------------

describe('every primitive', () => {
  it('draws the focus ring on its focusable element, in the focus token', () => {
    render(
      <>
        <LoopToggle />
        <IconButton label="Delete variant"><Trash2 size={12} /></IconButton>
      </>,
    );
    const focusable = [
      screen.getByRole('button', { name: 'Loop' }),
      screen.getByRole('button', { name: 'Delete variant' }),
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
    // @ts-expect-error a ToggleButton needs its label
    <ToggleButton pressed onPressedChange={noop} />,
    // @ts-expect-error an IconButton needs its label
    <IconButton><Trash2 /></IconButton>,
  ];
}
