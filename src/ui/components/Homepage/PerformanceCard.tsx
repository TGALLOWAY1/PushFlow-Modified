/**
 * PerformanceCard.
 *
 * Modern card for the Active Performances grid.
 * Shows pad-grid thumbnail with hover effects and real project metadata.
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

export function PerformanceCard({
  project,
  projectState,
  onOpen,
  onDelete,
}: PerformanceCardProps) {
  const tempo = (projectState?.tempo ?? (project as any).tempo) || 120;
  const soundCount = projectState?.soundStreams.length ?? project.soundCount;
  const eventCount = project.eventCount;
  const padsUsed = projectState?.activeLayout
    ? Object.keys(projectState.activeLayout.padToVoice).length
    : 0;

  return (
    <div
      className="group bg-[var(--bg-panel)] rounded-xl overflow-hidden hover:bg-[var(--bg-card)] transition-all duration-300 cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-default)]"
      onClick={onOpen}
    >
      {/* Grid preview area */}
      <div className="aspect-[4/3] relative overflow-hidden bg-[var(--bg-app)] flex items-center justify-center">
        {projectState ? (
          <div className="group-hover:scale-105 transition-transform duration-500">
            <MiniGridPreview
              layout={projectState.activeLayout}
              soundStreams={projectState.soundStreams}
              size={1.8}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-app)]" />
        )}
        <div className="absolute inset-0 bg-[var(--bg-app)]/10" />

        {/* Delete button (hover) */}
        <button
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[var(--bg-app)]/80 flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Remove from library"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>

        {/* Badges */}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <span className="bg-[var(--accent-primary)]/20 backdrop-blur-md text-[var(--accent-primary)] text-[10px] font-label uppercase tracking-widest px-2 py-0.5 rounded">
            {tempo} BPM
          </span>
          {soundCount > 0 && (
            <span className="bg-[var(--accent-secondary)]/20 backdrop-blur-md text-[var(--accent-secondary)] text-[10px] font-label uppercase tracking-widest px-2 py-0.5 rounded">
              {soundCount} Sounds
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-start">
          <h3 className="font-headline text-base font-bold tracking-tight text-[var(--text-primary)] truncate">
            {project.name}
          </h3>
          <button
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-lg">more_vert</span>
          </button>
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-0.5">
            <p className="text-[10px] font-label uppercase tracking-widest text-[var(--text-tertiary)]">
              Edited {relativeDate(project.updatedAt)}
            </p>
            <p className="text-[10px] font-label uppercase tracking-widest text-[var(--text-tertiary)]">
              {eventCount} Events{padsUsed > 0 ? ` \u00b7 ${padsUsed} Pads` : ''}
            </p>
          </div>
          <span className="material-symbols-outlined text-[var(--accent-primary)] group-hover:translate-x-1 transition-transform text-lg">
            arrow_forward
          </span>
        </div>
      </div>
    </div>
  );
}
