/**
 * ContinuePracticingHero.
 *
 * Large featured card showing the most recent performance with
 * a pad-grid thumbnail, real project context, and primary CTAs.
 */

import { Play, Pencil } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { MiniGridPreview } from '../panels/MiniGridPreview';

interface ContinuePracticingHeroProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  onResume: () => void;
  onOpenEditor: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-green-500/15 text-green-400',
  Moderate: 'bg-yellow-500/15 text-yellow-400',
  Hard: 'bg-orange-500/15 text-orange-400',
  Extreme: 'bg-red-500/15 text-red-400',
};

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

export function ContinuePracticingHero({
  project,
  projectState,
  onResume,
  onOpenEditor,
}: ContinuePracticingHeroProps) {
  const difficultyClass = project.difficulty
    ? DIFFICULTY_COLORS[project.difficulty] ?? 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
    : null;

  const tempo = projectState?.tempo ?? 120;
  const soundCount = projectState?.soundStreams.length ?? project.soundCount;
  const eventCount = projectState
    ? projectState.soundStreams.reduce((sum, s) => sum + s.events.length, 0)
    : project.eventCount;
  const padsUsed = projectState?.activeLayout
    ? Object.keys(projectState.activeLayout.padToVoice).length
    : 0;

  return (
    <div className="glass-panel-strong rounded-pf-lg p-5 flex gap-5 glow-emerald">
      {/* Grid preview */}
      <div className="flex-shrink-0">
        {projectState ? (
          <MiniGridPreview
            layout={projectState.activeLayout}
            soundStreams={projectState.soundStreams}
            size={2.5}
            highlighted
          />
        ) : (
          <div
            className="rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]"
            style={{ width: 284, height: 284 }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
        <div>
          <span className="text-pf-xs uppercase tracking-widest text-emerald-400 font-medium">
            Continue Practicing
          </span>
          <h2 className="text-xl font-bold mt-1 truncate">{project.name}</h2>

          <div className="flex items-center gap-3 mt-3 text-pf-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">{tempo} BPM</span>
            <span>{soundCount} sounds</span>
            <span>{eventCount} events</span>
            {padsUsed > 0 && <span>{padsUsed} pads</span>}
          </div>

          {difficultyClass && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-pf-sm text-[var(--text-secondary)]">Difficulty:</span>
              <span className={`text-pf-xs px-1.5 py-0.5 rounded-pf-sm font-mono ${difficultyClass}`}>
                {project.difficulty}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-pf-sm text-[var(--text-tertiary)]">
              Last opened: <span className="text-[var(--text-secondary)]">{relativeDate(project.updatedAt)}</span>
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onResume}
            className="pf-btn pf-btn-primary flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-pf-lg text-pf-base font-medium text-white transition-colors"
          >
            <Play size={14} />
            Resume Practice
          </button>
          <button
            onClick={onOpenEditor}
            className="pf-btn pf-btn-ghost flex items-center gap-1.5 px-4 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-pf-lg text-pf-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Pencil size={14} />
            Open Layout Editor
          </button>
        </div>
      </div>
    </div>
  );
}
