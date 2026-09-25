/**
 * The one keyboard listener (T61).
 *
 * Components bind handlers to rows of the input table (useInputHandler); a
 * single document listener matches each key against the table and calls the
 * row's handler. Keys are left alone:
 * - in text fields, selects, contenteditable, menus and listboxes, and while
 *   any Dialog or Popover is open (except rows marked `anywhere`, e.g. Save);
 * - when a widget already handled them (its own onKeyDown called
 *   preventDefault or stopPropagation), which is how a focused widget's keys
 *   win over the table.
 * A handler returns false when the key means nothing right now (Delete with no
 * pad selected); the key is then left to the browser. Otherwise the key's
 * default is prevented, so Space on a focused button plays instead of clicking.
 */

import { useEffect, useRef } from 'react';
import { INPUT_TABLE, type InputRow, type InputRowId } from './inputTable';
import { isOverlayOpen } from '../components/shared/Overlay';

export type InputHandler = (e: KeyboardEvent) => boolean | void;

interface Binding {
  handler: InputHandler;
  priority: number;
  order: number;
}

const KEY_ROWS: readonly InputRow[] = INPUT_TABLE.filter(r => r.keys && !r.from);

const OWNS_ITS_KEYS = '[role="menu"],[role="menubar"],[role="listbox"],[role="combobox"],[role="dialog"],[role="alertdialog"]';

/** Whether keys pressed in this element are the element's own: text entry, selects, menus. */
export function keysBelongToTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['button', 'submit', 'reset'].includes((target as HTMLInputElement).type);
  return target.closest(OWNS_ITS_KEYS) !== null;
}

export class InputRegistry {
  private bindings = new Map<InputRowId, Binding[]>();
  private nextOrder = 0;
  private attachedTo: Document | null = null;
  /** A Space keydown was handled: its keyup must not click the focused button either. */
  private swallowSpaceUp = false;

  register(id: InputRowId, handler: InputHandler, priority = 0): () => void {
    const binding: Binding = { handler, priority, order: this.nextOrder++ };
    const list = this.bindings.get(id) ?? [];
    list.push(binding);
    this.bindings.set(id, list);
    this.attach();
    return () => {
      const current = this.bindings.get(id);
      if (!current) return;
      const i = current.indexOf(binding);
      if (i >= 0) current.splice(i, 1);
      if (current.length === 0) this.bindings.delete(id);
      if (this.bindings.size === 0) this.detach();
    };
  }

  /** Rows with a handler bound right now. */
  boundIds(): InputRowId[] {
    return [...this.bindings.keys()];
  }

  handleKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.isComposing) return;
    for (const row of KEY_ROWS) {
      if (!row.keys!(e)) continue;
      if (!row.anywhere && (isOverlayOpen() || keysBelongToTarget(e.target))) continue;
      if (row.within && !(e.target instanceof Element && e.target.closest(row.within))) continue;
      // Highest priority first; among equals, the latest bound.
      const bindings = [...(this.bindings.get(row.id) ?? [])]
        .sort((a, b) => b.priority - a.priority || b.order - a.order);
      for (const binding of bindings) {
        if (binding.handler(e) === false) continue;
        e.preventDefault();
        if (e.key === ' ') this.swallowSpaceUp = true;
        return;
      }
    }
  };

  handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ' && this.swallowSpaceUp) {
      this.swallowSpaceUp = false;
      e.preventDefault();
    }
  };

  private attach() {
    if (this.attachedTo || typeof document === 'undefined') return;
    this.attachedTo = document;
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  private detach() {
    if (!this.attachedTo) return;
    this.attachedTo.removeEventListener('keydown', this.handleKeyDown);
    this.attachedTo.removeEventListener('keyup', this.handleKeyUp);
    this.attachedTo = null;
    this.swallowSpaceUp = false;
  }
}

/** The editor's registry. */
export const inputRegistry = new InputRegistry();

export interface UseInputHandlerOptions {
  /** Bound only while true. */
  enabled?: boolean;
  /** Higher wins; the Composer's Space outranks the workspace transport while its tab is open. */
  priority?: number;
}

/**
 * Binds `handler` to an input-table row while the component is mounted. The
 * latest handler is always the one called, so it can close over fresh state.
 */
export function useInputHandler(id: InputRowId, handler: InputHandler, { enabled = true, priority = 0 }: UseInputHandlerOptions = {}): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return inputRegistry.register(id, e => ref.current(e), priority);
  }, [id, enabled, priority]);
}
