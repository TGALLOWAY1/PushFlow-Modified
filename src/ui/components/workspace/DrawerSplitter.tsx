/**
 * The bar between the grid and the Timeline | Composer drawer (T04).
 *
 * Drag it to set the drawer's height, double-click it to go back to fitting
 * the timeline's content, or press Enter to collapse and expand. Arrow keys
 * resize by 16 px. The parent clamps every height, so the grid always keeps
 * room for its smallest pads.
 */

import { useEffect, useRef } from 'react';
import { DRAWER_MIN_HEIGHT, SPLITTER_HEIGHT } from './drawerSizing';

const KEY_STEP = 16;

export interface DrawerSplitterProps {
  /** The drawer's current height in px. */
  height: number;
  /** The tallest the drawer may be. */
  maxHeight: number;
  collapsed: boolean;
  /** A new height; `commit` is true when it should be remembered (drag end, arrow key). */
  onResize: (height: number, commit: boolean) => void;
  /** Back to fitting the timeline's content. */
  onReset: () => void;
  onToggleCollapsed: () => void;
}

export function DrawerSplitter({ height, maxHeight, collapsed, onResize, onReset, onToggleCollapsed }: DrawerSplitterProps) {
  const drag = useRef<{ startY: number; startHeight: number; last: number } | null>(null);
  // Read at event time, so a drag started on one render ends with the latest callbacks.
  const latest = useRef({ onResize, maxHeight });
  latest.current = { onResize, maxHeight };

  const clamp = (h: number) => Math.round(Math.max(DRAWER_MIN_HEIGHT, Math.min(latest.current.maxHeight, h)));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      // Dragging up makes the drawer taller.
      drag.current.last = clamp(drag.current.startHeight - (e.clientY - drag.current.startY));
      latest.current.onResize(drag.current.last, false);
    };
    const onUp = () => {
      if (!drag.current) return;
      const { last } = drag.current;
      drag.current = null;
      document.body.style.cursor = '';
      latest.current.onResize(last, true);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // clamp reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the timeline drawer"
      aria-valuemin={DRAWER_MIN_HEIGHT}
      aria-valuemax={Math.max(DRAWER_MIN_HEIGHT, maxHeight)}
      aria-valuenow={collapsed ? DRAWER_MIN_HEIGHT : height}
      tabIndex={0}
      data-testid="drawer-splitter"
      title="Drag to resize the timeline · double-click to fit it · Enter to collapse"
      className="flex-shrink-0 group flex items-center justify-center cursor-row-resize outline-none focus-visible:bg-[var(--accent-muted)] hover:bg-[var(--accent-muted)] rounded-sm transition-colors"
      style={{ height: SPLITTER_HEIGHT }}
      onMouseDown={e => {
        if (e.button !== 0) return;
        e.preventDefault();
        const startHeight = collapsed ? DRAWER_MIN_HEIGHT : height;
        drag.current = { startY: e.clientY, startHeight, last: startHeight };
        document.body.style.cursor = 'row-resize';
      }}
      onDoubleClick={onReset}
      onKeyDown={e => {
        // Handled here only: the editor's own arrow and Enter keys never see these.
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          const base = collapsed ? DRAWER_MIN_HEIGHT : height;
          onResize(clamp(base + (e.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP)), true);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onToggleCollapsed();
        }
      }}
    >
      <div className="w-10 h-1 rounded-full bg-[var(--border-default)] group-hover:bg-[var(--accent-primary)] group-focus-visible:bg-[var(--accent-primary)] transition-colors" />
    </div>
  );
}
