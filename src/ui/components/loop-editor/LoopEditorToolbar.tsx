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
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700 flex-wrap">
      {/* Label */}
      <h2 className="text-sm font-semibold text-gray-200">Loop Editor</h2>

      <div className="w-px h-5 bg-gray-700" />

      {/* Loop length */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Loop length</span>
        <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700">
          {([4, 8, 16] as const).map(bars => (
            <button
              key={bars}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                config.barCount === bars
                  ? 'bg-gray-600 text-gray-200 font-medium'
                  : 'text-gray-500 hover:text-gray-300'
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
        <span className="text-xs text-gray-500">Grid</span>
        <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700">
          {SUBDIVISIONS.map(sub => (
            <button
              key={sub}
              className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                config.subdivision === sub
                  ? 'bg-gray-600 text-gray-200 font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => dispatch({ type: 'SET_SUBDIVISION', payload: sub })}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Transport */}
      <button
        className={`px-2 py-1 text-xs rounded transition-colors ${
          isPlaying
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
        onClick={() => dispatch({ type: 'SET_PLAYING', payload: !isPlaying })}
      >
        {isPlaying ? '■ Stop' : '▶ Play'}
      </button>

      {/* BPM */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="w-14 px-1.5 py-0.5 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 text-center"
          value={config.bpm}
          min={20}
          max={300}
          onChange={e => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) dispatch({ type: 'SET_BPM', payload: val });
          }}
        />
        <span className="text-[10px] text-gray-500">BPM</span>
      </div>

      <div className="flex-1" />

      {/* Stats */}
      <span className="text-[10px] text-gray-600">
        {laneCount} lanes · {eventCount} events
      </span>

      {/* Add Lane */}
      <button
        className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        onClick={onAddLane}
      >
        + Add Lane
      </button>

      {/* Commit to Project */}
      <button
        className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onCommitToProject}
        disabled={eventCount === 0}
        title={eventCount === 0 ? 'Add events first' : 'Commit loop to project lanes'}
      >
        Commit to Project
      </button>
    </div>
  );
}
