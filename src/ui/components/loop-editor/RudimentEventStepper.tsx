/**
 * RudimentEventStepper.
 *
 * Compact navigation bar for stepping through rudiment events.
 * Shows complexity, event counter, active event info, and prev/next controls.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { type RudimentFingerAssignment, type RudimentComplexity } from '../../../types/rudiment';
import { type LoopLane } from '../../../types/loopEditor';

// ============================================================================
// Constants
// ============================================================================

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  Simple: 'bg-green-600/20 text-green-400 border-green-600/30',
  Moderate: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  Complex: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  Advanced: 'bg-red-600/20 text-red-400 border-red-600/30',
};

// ============================================================================
// Props
// ============================================================================

interface RudimentEventStepperProps {
  fingerAssignments: RudimentFingerAssignment[];
  complexity: RudimentComplexity;
  activeEventIndex: number | null;
  onSetActiveEvent: (index: number | null) => void;
  lanes: LoopLane[];
}

// ============================================================================
// Component
// ============================================================================

export function RudimentEventStepper({
  fingerAssignments,
  complexity,
  activeEventIndex,
  onSetActiveEvent,
  lanes,
}: RudimentEventStepperProps) {
  const totalEvents = fingerAssignments.length;

  // Lane name lookup
  const laneNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lane of lanes) {
      map.set(lane.id, lane.name);
    }
    return map;
  }, [lanes]);

  // Current event info
  const activeEvent = activeEventIndex !== null && activeEventIndex >= 0 && activeEventIndex < totalEvents
    ? fingerAssignments[activeEventIndex]
    : null;

  // Navigation callbacks
  const goNext = useCallback(() => {
    if (totalEvents === 0) return;
    if (activeEventIndex === null) {
      onSetActiveEvent(0);
    } else {
      onSetActiveEvent(Math.min(activeEventIndex + 1, totalEvents - 1));
    }
  }, [activeEventIndex, totalEvents, onSetActiveEvent]);

  const goPrev = useCallback(() => {
    if (totalEvents === 0) return;
    if (activeEventIndex === null) {
      onSetActiveEvent(0);
    } else {
      onSetActiveEvent(Math.max(activeEventIndex - 1, 0));
    }
  }, [activeEventIndex, totalEvents, onSetActiveEvent]);

  const clear = useCallback(() => {
    onSetActiveEvent(null);
  }, [onSetActiveEvent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clear();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, clear]);

  const complexityColorClass = COMPLEXITY_COLORS[complexity.label] ?? COMPLEXITY_COLORS.Simple;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-pf-lg bg-[var(--bg-card)] border border-[var(--border-default)]">
      {/* Complexity badge */}
      <span className={`px-2 py-0.5 text-pf-sm rounded-pf-sm border ${complexityColorClass}`}>
        {complexity.label} ({complexity.score})
      </span>

      <div className="w-px h-5 bg-[var(--border-subtle)]" />

      {/* Event counter */}
      <span className="text-pf-sm text-[var(--text-secondary)]">
        {activeEventIndex !== null
          ? `Event ${activeEventIndex + 1} / ${totalEvents}`
          : `${totalEvents} events`
        }
      </span>

      <div className="w-px h-5 bg-[var(--border-subtle)]" />

      {/* Prev / Next buttons */}
      <div className="flex items-center gap-1">
        <button
          className="pf-btn-subtle text-pf-sm disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={goPrev}
          disabled={totalEvents === 0 || (activeEventIndex !== null && activeEventIndex <= 0)}
          title="Previous event (Left arrow)"
        >
          ← Prev
        </button>
        <button
          className="pf-btn-subtle text-pf-sm disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={goNext}
          disabled={totalEvents === 0 || (activeEventIndex !== null && activeEventIndex >= totalEvents - 1)}
          title="Next event (Right arrow)"
        >
          Next →
        </button>
      </div>

      {/* Active event info */}
      {activeEvent && (
        <>
          <div className="w-px h-5 bg-[var(--border-subtle)]" />
          <span className="text-pf-sm text-[var(--text-primary)] font-mono">
            Step {activeEvent.stepIndex}
            {' | '}
            <span className="text-[var(--text-primary)] font-semibold">{laneNameMap.get(activeEvent.laneId) ?? 'Unknown'}</span>
            {' | '}
            <span className={activeEvent.hand === 'left' ? 'text-blue-400' : 'text-purple-400'}>
              {activeEvent.hand[0].toUpperCase()}-{FINGER_ABBREV[activeEvent.finger]}
            </span>
            {' '}
            <span className="text-[var(--text-secondary)]">[{activeEvent.pad.row},{activeEvent.pad.col}]</span>
          </span>
        </>
      )}

      <div className="flex-1" />

      {/* Clear / dismiss */}
      {activeEventIndex !== null && (
        <button
          className="px-2 py-0.5 text-pf-sm rounded-pf-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={clear}
          title="Clear selection (Escape)"
        >
          Clear
        </button>
      )}

      {/* Keyboard hint */}
      <span className="text-pf-xs text-[var(--text-tertiary)]">← → to step</span>
    </div>
  );
}
