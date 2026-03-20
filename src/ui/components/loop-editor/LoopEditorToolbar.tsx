/**
 * LoopEditorToolbar.
 *
 * Top toolbar for the Loop Editor with config controls,
 * transport, lane management, and project commit.
 */

import { type LoopConfig, type LoopSubdivision } from '../../../types/loopEditor';
import { type LoopEditorAction } from '../../state/loopEditorReducer';

interface LoopEditorToolbarProps {
  config: LoopConfig;
  laneCount: number;
  eventCount: number;
  isPlaying: boolean;
  dispatch: React.Dispatch<LoopEditorAction>;
  onAddLane: () => void;
  onCommitToProject: () => void;
}

const SUBDIVISIONS: LoopSubdivision[] = ['1/8', '1/4', '1/2', '1/1'];

export function LoopEditorToolbar({
  config,
  laneCount,
  eventCount,
  isPlaying,
  dispatch,
  onAddLane,
  onCommitToProject,
}: LoopEditorToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-default)] flex-wrap">
      {/* Label */}
      <h2 className="text-pf-sm font-semibold text-[var(--text-primary)]">Loop Editor</h2>

      <div className="w-px h-5 bg-[var(--border-subtle)]" />

      {/* Loop length */}
      <div className="flex items-center gap-1">
        <span className="text-pf-sm text-[var(--text-secondary)]">Loop length</span>
        <div className="flex bg-[var(--bg-card)] rounded-pf-sm p-0.5 border border-[var(--border-subtle)]">
          {([4, 8, 16] as const).map(bars => (
            <button
              key={bars}
              className={`px-2 py-0.5 text-pf-sm rounded-pf-sm transition-colors ${
                config.barCount === bars
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => dispatch({ type: 'SET_BAR_COUNT', payload: bars })}
            >
              {bars} Bars
            </button>
          ))}
        </div>
      </div>

      {/* Subdivision */}
      <div className="flex items-center gap-1">
        <span className="text-pf-sm text-[var(--text-secondary)]">Grid</span>
        <div className="flex bg-[var(--bg-card)] rounded-pf-sm p-0.5 border border-[var(--border-subtle)]">
          {SUBDIVISIONS.map(sub => (
            <button
              key={sub}
              className={`px-1.5 py-0.5 text-pf-sm rounded-pf-sm transition-colors ${
                config.subdivision === sub
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => dispatch({ type: 'SET_SUBDIVISION', payload: sub })}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-5 bg-[var(--border-subtle)]" />

      {/* Transport */}
      <button
        className={`px-2 py-1 text-pf-sm rounded-pf-sm transition-colors ${
          isPlaying
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
        }`}
        onClick={() => dispatch({ type: 'SET_PLAYING', payload: !isPlaying })}
      >
        {isPlaying ? '■ Stop' : '▶ Play'}
      </button>

      {/* BPM */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="w-14 px-1.5 py-0.5 text-pf-sm bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-pf-sm text-[var(--text-primary)] text-center"
          value={config.bpm}
          min={20}
          max={300}
          onChange={e => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) dispatch({ type: 'SET_BPM', payload: val });
          }}
        />
        <span className="text-pf-xs text-[var(--text-secondary)]">BPM</span>
      </div>

      <div className="flex-1" />

      {/* Stats */}
      <span className="text-pf-xs text-[var(--text-tertiary)]">
        {laneCount} lanes · {eventCount} events
      </span>

      {/* Add Lane */}
      <button
        className="pf-btn-subtle text-pf-sm"
        onClick={onAddLane}
      >
        + Add Lane
      </button>

      {/* Commit to Project */}
      <button
        className="px-3 py-1 text-pf-sm rounded-pf-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onCommitToProject}
        disabled={eventCount === 0}
        title={eventCount === 0 ? 'Add events first' : 'Commit loop to project lanes'}
      >
        Commit to Project
      </button>
    </div>
  );
}
