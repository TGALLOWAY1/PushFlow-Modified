/**
 * ContinuePracticingHero.
 *
 * Large featured card showing the most recent performance with
 * a pad-grid thumbnail, practice context, and primary CTAs.
 */

import { Play, Pencil } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { type ProjectMockData } from './homepageDemoData';
import { MiniGridPreview } from '../panels/MiniGridPreview';

interface ContinuePracticingHeroProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  mockData: ProjectMockData;
  onResume: () => void;
  onOpenEditor: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-green-500/15 text-green-400',
  Moderate: 'bg-yellow-500/15 text-yellow-400',
  Hard: 'bg-orange-500/15 text-orange-400',
  Extreme: 'bg-red-500/15 text-red-400',
};

export function ContinuePracticingHero({
  project,
  projectState,
  mockData,
  onResume,
  onOpenEditor,
}: ContinuePracticingHeroProps) {
  const difficultyClass = project.difficulty
    ? DIFFICULTY_COLORS[project.difficulty] ?? 'bg-gray-500/15 text-gray-400'
    : null;

  return (
    <div className="glass-panel-strong rounded-xl p-5 flex gap-5 glow-emerald">
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
            className="rounded-lg bg-gray-800/50 border border-gray-700/50"
            style={{ width: 284, height: 284 }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-medium">
            Continue Practicing
          </span>
          <h2 className="text-xl font-bold mt-1 truncate">{project.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">by Neon Pulse</p>

          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-400">
              Last practiced section:{' '}
              <span className="text-gray-200">{mockData.sectionLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-400">
              Current layout:{' '}
              <span className="text-gray-200">Ergo Focus 3</span>
            </span>
          </div>

          {difficultyClass && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-400">Current difficulty:</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${difficultyClass}`}>
                {project.difficulty}
              </span>
            </div>
          )}

          {/* Practice insight */}
          <div className="mt-4 p-2.5 rounded-lg bg-gray-800/40 border border-gray-700/50">
            <p className="text-xs text-gray-400 italic">
              Motivational supported
            </p>
            <p className="text-xs text-gray-300 mt-0.5">
              {mockData.practiceInsight}
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Play size={14} />
            Resume Practice
          </button>
          <button
            onClick={onOpenEditor}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-600 hover:border-gray-500 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <Pencil size={14} />
            Open Layout Editor
          </button>
        </div>
      </div>
    </div>
  );
}
