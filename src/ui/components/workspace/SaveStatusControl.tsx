/**
 * SaveStatusControl (T57 slice).
 *
 * The toolbar's one save control. Its label is the truth about the stored
 * project: "Saved" only after a write has committed, "Saving…" while one is in
 * flight, "Save" while edits are pending. After a failed write it becomes a
 * persistent red chip, "Couldn't save · Retry · Export a copy", so a save that
 * did not happen is never mistaken for one that did. The data-save-status
 * attribute lets tests and helpers wait for the real state.
 */

import { type SaveStatus } from '../../hooks/useAutoSave';

interface SaveStatusControlProps {
  status: SaveStatus;
  /** Saves now (also Retry after a failure). */
  onSave: () => void;
  /** Downloads a copy of the project as a file (the way out when saving keeps failing). */
  onExport: () => void;
}

const LABELS: Record<Exclude<SaveStatus, 'error'>, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Save',
};

const STYLES: Record<Exclude<SaveStatus, 'error'>, string> = {
  saved: 'bg-emerald-600/12 text-emerald-400 border border-emerald-500/20',
  saving: 'bg-[var(--accent-muted)] text-accent-primary-soft border border-accent-primary/20',
  unsaved: 'pf-btn-subtle',
};

export function SaveStatusControl({ status, onSave, onExport }: SaveStatusControlProps) {
  if (status === 'error') {
    return (
      <div
        role="alert"
        data-testid="save-status"
        data-save-status="error"
        className="flex items-center gap-1 whitespace-nowrap rounded-pf-md border border-red-500/40 bg-red-500/10 pl-2.5 pr-1 py-0.5 text-pf-sm text-red-300"
      >
        <span>Couldn’t save</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="pf-btn pf-btn-subtle text-pf-sm min-h-[24px] font-semibold text-red-200 hover:text-white"
          onClick={onSave}
          title="Try saving again"
        >
          Retry
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="pf-btn pf-btn-subtle text-pf-sm min-h-[24px] font-semibold text-red-200 hover:text-white"
          onClick={onExport}
          title="Download this project as a file"
        >
          Export a copy
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="save-status"
      data-save-status={status}
      className={`pf-btn text-pf-sm ${STYLES[status]}`}
      onClick={onSave}
      title="Save project"
      aria-label={status === 'saved' ? 'Saved (Ctrl+S saves again)' : status === 'saving' ? 'Saving' : 'Save project (Ctrl+S)'}
    >
      {LABELS[status]}
    </button>
  );
}
