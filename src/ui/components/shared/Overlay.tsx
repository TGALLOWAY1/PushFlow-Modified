/**
 * Dialog and Popover: the one overlay primitive (T06).
 *
 * Every overlay renders into document.body, so no transformed or
 * backdrop-filtered ancestor can become its containing block (the pad menu used
 * to land ~490px from the cursor, scaled and clipped). Both:
 * - set role, aria-modal (Dialog) and aria-labelledby;
 * - trap Tab inside the overlay and move focus into it on open;
 * - close on the first Escape (only the topmost overlay reacts, and the key
 *   goes no further) and on a pointer press outside;
 * - return focus on close to `returnFocusTo`, else to whatever was focused when
 *   the overlay opened, if it is still in the document.
 * `onClose` is read through a ref, so an inline arrow never re-registers the
 * listeners (T06: "stable onClose").
 *
 * Popover also opens at a point and clamps itself inside the viewport.
 */

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

/** Open overlays in the order they opened. Only the last one handles Escape and outside presses. */
const overlayStack: symbol[] = [];

/** True while at least one Dialog or Popover is open (the input table skips its keys then). */
export function isOverlayOpen(): boolean {
  return overlayStack.length > 0;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => !el.closest('[inert]'));
}

interface OverlayBehaviourOptions {
  panelRef: RefObject<HTMLElement>;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  /** Presses on these elements don't count as "outside" (e.g. a Dialog's own backdrop handles itself). */
  closeOnOutsidePress?: boolean;
}

/** Stack membership, Escape, outside press, focus trap and focus return. */
function useOverlayBehaviour({ panelRef, onClose, returnFocusTo, closeOnOutsidePress = true }: OverlayBehaviourOptions) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const token = Symbol('overlay');
    overlayStack.push(token);
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnRef.current = returnFocusTo ?? previouslyFocused;
    const isTop = () => overlayStack[overlayStack.length - 1] === token;

    // Move focus in: the first focusable element, else the panel itself.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (focusableIn(panel)[0] ?? panel).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = focusableIn(panelRef.current);
        if (items.length === 0) {
          e.preventDefault();
          panelRef.current.focus({ preventScroll: true });
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!closeOnOutsidePress || !isTop()) return;
      const target = e.target as Node | null;
      if (panelRef.current && target && !panelRef.current.contains(target)) onCloseRef.current();
    };
    // Capture phase on window: runs before any other key handler (the editor's
    // shortcuts would otherwise also act on the same Escape).
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      const i = overlayStack.indexOf(token);
      if (i >= 0) overlayStack.splice(i, 1);
      const back = returnRef.current?.isConnected ? returnRef.current
        : previouslyFocused?.isConnected ? previouslyFocused : null;
      back?.focus({ preventScroll: true });
    };
    // Mount/unmount only: onClose is read through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export interface DialogProps {
  onClose: () => void;
  /** Visible heading; rendered by the caller with this id, or pass `title` and Dialog renders it. */
  labelledBy?: string;
  /** Accessible name when there is no visible heading. */
  ariaLabel?: string;
  returnFocusTo?: HTMLElement | null;
  /** Classes for the panel (position, size, surface). */
  className?: string;
  style?: CSSProperties;
  /** Backdrop classes; the backdrop closes the dialog when pressed. */
  backdropClassName?: string;
  testId?: string;
  children: ReactNode;
}

/** A modal dialog: backdrop, role=dialog, aria-modal. */
export function Dialog({
  onClose, labelledBy, ariaLabel, returnFocusTo, className, style,
  backdropClassName = 'fixed inset-0 z-[60] bg-black/50', testId, children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehaviour({ panelRef, onClose, returnFocusTo });
  return createPortal(
    <>
      <div className={backdropClassName} aria-hidden="true" data-overlay-backdrop="" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        data-testid={testId}
        className={`outline-none ${className ?? ''}`}
        style={style}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export interface PopoverProps {
  onClose: () => void;
  /** Viewport point to open at (the cursor for a context menu). */
  x: number;
  y: number;
  role?: 'menu' | 'dialog';
  labelledBy?: string;
  ariaLabel?: string;
  returnFocusTo?: HTMLElement | null;
  className?: string;
  testId?: string;
  children: ReactNode;
}

/** Margin kept between a clamped popover and the viewport edge. */
export const POPOVER_EDGE_MARGIN = 8;

/**
 * Where a box of `size` opened at `point` goes: at the point, or pushed back
 * inside the viewport by POPOVER_EDGE_MARGIN when it would overflow.
 */
export function clampToViewport(point: number, size: number, viewport: number): number {
  let pos = point;
  if (pos + size > viewport - POPOVER_EDGE_MARGIN) pos = viewport - size - POPOVER_EDGE_MARGIN;
  return Math.max(POPOVER_EDGE_MARGIN, pos);
}

/** A non-modal popover (a menu) opened at a point and clamped inside the viewport. */
export function Popover({
  onClose, x, y, role = 'menu', labelledBy, ariaLabel, returnFocusTo, className, testId, children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: clampToViewport(x, r.width, window.innerWidth), top: clampToViewport(y, r.height, window.innerHeight) });
  }, [x, y]);
  useOverlayBehaviour({ panelRef, onClose, returnFocusTo });
  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : ariaLabel}
      tabIndex={-1}
      data-testid={testId}
      // Above toasts (z-90): a menu the user just opened is never covered by a
      // passing notification. Dialogs stay below toasts, so an Undo toast
      // raised from inside one can still be clicked.
      className={`fixed z-[95] outline-none ${className ?? ''}`}
      style={{ left: pos?.left ?? x, top: pos?.top ?? y }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** A stable id for a Dialog's heading. */
export function useOverlayTitleId(): string {
  return `overlay-title-${useId().replace(/:/g, '')}`;
}
