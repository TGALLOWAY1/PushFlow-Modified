/**
 * PerformanceCard.
 *
 * Compact card for the Active Performances grid.
 * Shows pad-grid thumbnail, title, improvement score, progress, and metadata.
 */

import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { type ProjectMockData } from './homepageDemoData';
import { MiniGridPreview } from '../panels/MiniGridPreview';
import { ImprovementBadge } from './ImprovementBadge';

interface PerformanceCardProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  mockData: ProjectMockData;
  onOpen: () => void;
  onDelete: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  'in-progress': 'bg-blue-500/15 text-blue-400',
  'needs-review': 'bg-amber-500/15 text-amber-400',
  'practice-ready': 'bg-green-500/15 text-green-400',
  'mostly-mastered': 'bg-purple-500/15 text-purple-400',
  'archived': 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
};

const PROGRESS_COLORS: Record<string, string> = {
  'in-progress': 'bg-blue-500',
  'needs-review': 'bg-amber-500',
  'practice-ready': 'bg-green-500',
  'mostly-mastered': 'bg-purple-500',
  'archived': 'bg-gray-500',
};

export function PerformanceCard({
  project,
  projectState,
  mockData,
  onOpen,
  onDelete,
}: PerformanceCardProps) {
  const statusClass = STATUS_COLORS[mockData.status] ?? 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  const progressColor = PROGRESS_COLORS[mockData.status] ?? 'bg-gray-500';

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
          <div className="flex items-center gap-1.5">
            <h3 className="text-pf-base font-medium text-[var(--text-primary)] truncate">{project.name}</h3>
            <ImprovementBadge score={mockData.improvementScore} />
          </div>

          {/* Status */}
          <span className={`inline-block text-pf-micro px-1.5 py-0.5 rounded-pf-sm mt-1 font-medium ${statusClass}`}>
            {mockData.statusLabel}
          </span>

          {/* Practice status label */}
          <p className="text-pf-xs text-[var(--text-tertiary)] mt-1.5">
            Practice status
          </p>

          {/* Metadata */}
          <div className="text-pf-xs text-[var(--text-tertiary)] mt-1 space-y-0.5">
            <p>Sections: <span className="text-[var(--text-secondary)]">{mockData.sectionsCount}</span></p>
            <p>Hours practiced: <span className="text-[var(--text-secondary)]">{mockData.minHours}</span></p>
            <p>Last opened: <span className="text-[var(--text-secondary)]">{mockData.lastPracticedLabel}</span></p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5">
        <div className="h-1 bg-[var(--bg-input)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${progressColor}`}
            style={{ width: `${mockData.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
