/**
 * PerformanceCard.
 *
 * Compact card for the Active Performances grid.
 * Shows pad-grid thumbnail, title, and real project metadata.
 */

import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { MiniGridPreview } from '../panels/MiniGridPreview';

interface PerformanceCardProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  onOpen: () => void;
  onDelete: () => void;
}

/** Format an ISO date string as a relative label. */
function relativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

/** Format an ISO date string as a short date. */
function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export function PerformanceCard({
  project,
  projectState,
  onOpen,
  onDelete,
}: PerformanceCardProps) {
  // Derive real data from project index entry and loaded state
  const tempo = projectState?.tempo ?? 120;
  const soundCount = projectState?.soundStreams.length ?? project.soundCount;
  const eventCount = projectState
    ? projectState.soundStreams.reduce((sum, s) => sum + s.events.length, 0)
    : project.eventCount;
  const barDuration = (60 / tempo) * 4;
  let maxTime = 0;
  if (projectState) {
    for (const s of projectState.soundStreams) {
      for (const e of s.events) {
        const end = e.startTime + e.duration;
        if (end > maxTime) maxTime = end;
      }
    }
  }
  const durationBars = barDuration > 0 ? Math.ceil(maxTime / barDuration) : 0;

  return (
    <div
      className="glass-panel rounded-pf-lg p-3 hover:border-[var(--border-default)] transition-colors cursor-pointer group relative"
      onClick={onOpen}
    >
      {/* Delete button (hover) */}
      <button
        className="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-pf-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Remove from library"
      >
        &times;
      </button>

      {/* Top section: grid + title */}
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {projectState ? (
            <MiniGridPreview
              layout={projectState.activeLayout}
              soundStreams={projectState.soundStreams}
              size={1}
            />
          ) : (
            <div
              className="rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]"
              style={{ width: 119, height: 119 }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-pf-base font-medium text-[var(--text-primary)] truncate">{project.name}</h3>

          {/* BPM badge */}
          <span className="inline-block text-pf-micro px-1.5 py-0.5 rounded-pf-sm mt-1 font-medium bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            {tempo} BPM
          </span>

          {/* Real metadata */}
          <div className="text-pf-xs text-[var(--text-tertiary)] mt-2 space-y-0.5">
            <p>Sounds: <span className="text-[var(--text-secondary)]">{soundCount}</span></p>
            {durationBars > 0 && (
              <p>Length: <span className="text-[var(--text-secondary)]">{durationBars} bar{durationBars !== 1 ? 's' : ''}</span></p>
            )}
            <p>Events: <span className="text-[var(--text-secondary)]">{eventCount}</span></p>
            <p>Created: <span className="text-[var(--text-secondary)]">{shortDate(project.createdAt)}</span></p>
            <p>Last visited: <span className="text-[var(--text-secondary)]">{relativeDate(project.updatedAt)}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
