// @vitest-environment happy-dom
/**
 * The Dialog/Popover primitive (S1b.2, T06): portal, roles, first-Escape close
 * of the topmost overlay only, outside press, focus trap, focus return, and
 * viewport clamping.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Dialog, Popover, clampToViewport, isOverlayOpen, POPOVER_EDGE_MARGIN } from '../../../src/ui/components/shared/Overlay';

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="app">
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <Dialog onClose={() => { onClose?.(); setOpen(false); }} labelledBy="t" testId="dlg">
          <h2 id="t">Title</h2>
          <button>first</button>
          <button>last</button>
        </Dialog>
      )}
    </div>
  );
}

describe('Dialog', () => {
  it('portals to body with dialog semantics and focuses inside', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    const dlg = screen.getByTestId('dlg');
    expect(dlg.parentElement).toBe(document.body);
    expect(dlg.getAttribute('role')).toBe('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.getAttribute('aria-labelledby')).toBe('t');
    expect(document.activeElement?.textContent).toBe('first');
    expect(isOverlayOpen()).toBe(true);
  });

  it('closes on the first Escape and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByText('open');
    trigger.focus();
    fireEvent.click(trigger);
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    window.removeEventListener('keydown', outer);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dlg')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(outer).not.toHaveBeenCalled();
    expect(isOverlayOpen()).toBe(false);
  });

  it('closes on a press outside, not inside', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    fireEvent.mouseDown(screen.getByText('last'));
    expect(screen.getByTestId('dlg')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('dlg')).toBeNull();
  });

  it('traps Tab inside', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    screen.getByText('last').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('first');
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.textContent).toBe('last');
  });

  it('only the topmost (most recently opened) overlay reacts to Escape', () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    function Nested() {
      const [inner, setInner] = useState(false);
      return (
        <Dialog onClose={outerClose} ariaLabel="outer">
          <button onClick={() => setInner(true)}>more</button>
          {inner && <Popover x={10} y={10} onClose={innerClose} ariaLabel="inner"><button>b</button></Popover>}
        </Dialog>
      );
    }
    render(<Nested />);
    fireEvent.click(screen.getByText('more'));
    act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    expect(innerClose).toHaveBeenCalledTimes(1);
    expect(outerClose).not.toHaveBeenCalled();
  });
});

describe('Popover', () => {
  it('renders a menu in body at the point, returning focus to returnFocusTo', () => {
    const pad = document.createElement('div');
    pad.tabIndex = -1;
    document.body.appendChild(pad);
    const { unmount } = render(
      <Popover x={40} y={50} onClose={() => {}} returnFocusTo={pad} testId="menu" ariaLabel="Pad menu">
        <button role="menuitem">one</button>
      </Popover>,
    );
    const menu = screen.getByTestId('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.style.left).toBe('40px');
    unmount();
    expect(document.activeElement).toBe(pad);
    pad.remove();
  });

  it('clamps inside the viewport', () => {
    expect(clampToViewport(100, 200, 1000)).toBe(100);
    expect(clampToViewport(900, 200, 1000)).toBe(1000 - 200 - POPOVER_EDGE_MARGIN);
    expect(clampToViewport(-5, 200, 1000)).toBe(POPOVER_EDGE_MARGIN);
  });
});
