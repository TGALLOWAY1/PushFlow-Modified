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
  'archived': 'bg-gray-500/15 text-gray-400',
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
  const statusClass = STATUS_COLORS[mockData.status] ?? 'bg-gray-500/15 text-gray-400';
  const progressColor = PROGRESS_COLORS[mockData.status] ?? 'bg-gray-500';

  return (
    <div
      className="glass-panel rounded-lg p-3 hover:border-gray-600 transition-colors cursor-pointer group relative"
      onClick={onOpen}
    >
      {/* Delete button (hover) */}
      <button
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 text-xs px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
              className="rounded-lg bg-gray-800/50 border border-gray-700/50"
              style={{ width: 119, height: 119 }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-gray-200 truncate">{project.name}</h3>
            <ImprovementBadge score={mockData.improvementScore} />
          </div>

          {/* Status */}
          <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded mt-1 font-medium ${statusClass}`}>
            {mockData.statusLabel}
          </span>

          {/* Practice status label */}
          <p className="text-[10px] text-gray-500 mt-1.5">
            Practice status
          </p>

          {/* Metadata */}
          <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
            <p>Sections: <span className="text-gray-400">{mockData.sectionsCount}</span></p>
            <p>Hours practiced: <span className="text-gray-400">{mockData.minHours}</span></p>
            <p>Last opened: <span className="text-gray-400">{mockData.lastPracticedLabel}</span></p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5">
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${progressColor}`}
            style={{ width: `${mockData.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
