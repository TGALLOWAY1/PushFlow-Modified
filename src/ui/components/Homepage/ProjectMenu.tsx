/**
 * One "⋯" menu for a project, the same on the Library's hero and its cards
 * (S2.3, T53): Rename, Duplicate, Export, Download backup (only when one
 * exists) and Delete, which acts at once with an Undo toast instead of a
 * native confirm.
 */

import { useRef, useState } from 'react';
import { Copy, Download, History, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Popover, useOverlayTitleId } from '../shared/Overlay';

export interface ProjectMenuActions {
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  /** Present only when the project has a pre-migration backup. */
  onDownloadBackup?: () => void;
  onDelete: () => void;
}

const ITEM = 'w-full flex items-center gap-2 px-3 py-2 text-left text-pf-sm hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] outline-none transition-colors';

export function ProjectMenu({ projectName, actions, className = '' }: {
  projectName: string;
  actions: ProjectMenuActions;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const titleId = useOverlayTitleId();
  const run = (action: () => void) => () => {
    setAt(null);
    action();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="project-menu-button"
        aria-label={`Actions for ${projectName}`}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        className={`w-8 h-8 rounded-pf-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${className}`}
        onClick={e => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setAt(prev => (prev ? null : { x: r.right - 180, y: r.bottom + 4 }));
        }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {at && (
        <Popover
          x={at.x}
          y={at.y}
          onClose={() => setAt(null)}
          role="menu"
          labelledBy={titleId}
          returnFocusTo={buttonRef.current}
          testId="project-menu"
          className="flex flex-col min-w-[180px] py-1 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl"
        >
          {/* The menu is portalled, but React still bubbles its clicks to the card, which would open the project. */}
          <div onClick={e => e.stopPropagation()}>
            <div id={titleId} className="px-3 py-1.5 text-pf-xs text-[var(--text-tertiary)] border-b border-[var(--border-subtle)] truncate max-w-[240px]">
              {projectName}
            </div>
            <button type="button" role="menuitem" className={`${ITEM} text-[var(--text-primary)]`} onClick={run(actions.onRename)}>
              <Pencil size={14} aria-hidden="true" /> Rename
            </button>
            <button type="button" role="menuitem" className={`${ITEM} text-[var(--text-primary)]`} onClick={run(actions.onDuplicate)}>
              <Copy size={14} aria-hidden="true" /> Duplicate
            </button>
            <button type="button" role="menuitem" className={`${ITEM} text-[var(--text-primary)]`} onClick={run(actions.onExport)}>
              <Download size={14} aria-hidden="true" /> Export project file
            </button>
            {actions.onDownloadBackup && (
              <button
                type="button"
                role="menuitem"
                className={`${ITEM} text-[var(--text-primary)]`}
                title="The project as it was before PushFlow last updated its stored format"
                onClick={run(actions.onDownloadBackup)}
              >
                <History size={14} aria-hidden="true" /> Download backup
              </button>
            )}
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button type="button" role="menuitem" className={`${ITEM} text-red-300 hover:text-red-200`} onClick={run(actions.onDelete)}>
              <Trash2 size={14} aria-hidden="true" /> Delete
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
