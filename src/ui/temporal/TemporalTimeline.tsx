/**
 * Temporal Timeline (center-bottom panel).
 *
 * Ordered strip of moments with transition boundaries.
 * Selected moment highlighted. Failing transitions in red, degraded in amber.
 * Step controls for navigating through the sequence.
 */

import { type PerformanceMoment } from '../../types/performanceEvent';
import { type TransitionResult } from './types';

interface Props {
  moments: PerformanceMoment[];
  selectedMomentIndex: number;
  transitionResults: TransitionResult[];
  firstFailingTransitionIndex: number;
  onSelectMoment: (index: number) => void;
}

export function TemporalTimeline({
  moments,
  selectedMomentIndex,
  transitionResults,
  firstFailingTransitionIndex,
  onSelectMoment,
}: Props) {
  const getTransitionStatus = (index: number) => {
    const tr = transitionResults.find(t => t.transitionIndex === index);
    return tr?.status ?? null;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Step controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectMoment(0)}
          disabled={selectedMomentIndex === 0}
          className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          |&lt;
        </button>
        <button
          onClick={() => onSelectMoment(Math.max(0, selectedMomentIndex - 1))}
          disabled={selectedMomentIndex === 0}
          className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &lt; Prev
        </button>
        <span className="text-[10px] text-gray-400 mx-2">
          Moment {selectedMomentIndex + 1} / {moments.length}
          {moments[selectedMomentIndex] && (
            <span className="ml-1 text-gray-500">
              @ {moments[selectedMomentIndex].startTime.toFixed(3)}s
            </span>
          )}
        </span>
        <button
          onClick={() => onSelectMoment(Math.min(moments.length - 1, selectedMomentIndex + 1))}
          disabled={selectedMomentIndex >= moments.length - 1}
          className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next &gt;
        </button>
        <button
          onClick={() => onSelectMoment(moments.length - 1)}
          disabled={selectedMomentIndex >= moments.length - 1}
          className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &gt;|
        </button>

        {/* Jump to first failure */}
        {firstFailingTransitionIndex >= 0 && (
          <button
            onClick={() => onSelectMoment(firstFailingTransitionIndex)}
            className="ml-2 text-[10px] px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
          >
            Jump to first failure
          </button>
        )}
      </div>

      {/* Timeline strip */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {moments.map((moment, i) => {
          const isSelected = i === selectedMomentIndex;
          const isFirstFailure = i === firstFailingTransitionIndex;
          const transitionAfter = getTransitionStatus(i);

          return (
            <div key={i} className="flex items-center flex-shrink-0">
              {/* Moment pill */}
              <button
                onClick={() => onSelectMoment(i)}
                className={`
                  flex flex-col items-center px-2 py-1.5 rounded transition-all
                  ${isSelected
                    ? 'bg-blue-500/30 border border-blue-500/50 ring-1 ring-blue-400/30'
                    : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50'}
                  ${isFirstFailure ? 'ring-1 ring-red-500/50' : ''}
                `}
              >
                <span className={`text-[9px] font-mono ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>
                  M{i}
                </span>
                <span className="text-[8px] text-gray-500">
                  {moment.startTime.toFixed(2)}s
                </span>
                <span className="text-[8px] text-gray-600">
                  {moment.notes.length} note{moment.notes.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Transition connector */}
              {i < moments.length - 1 && (
                <div
                  className={`
                    w-6 h-0.5 mx-0.5
                    ${transitionAfter === 'violation'
                      ? 'bg-red-500'
                      : transitionAfter === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-green-500/40'}
                  `}
                  title={transitionAfter ? `Transition ${i}→${i + 1}: ${transitionAfter}` : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
