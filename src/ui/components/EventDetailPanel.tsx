/**
 * EventDetailPanel.
 *
 * Shows detailed info for a selected event including pad-level finger
 * constraint controls. Setting a constraint updates the layout and
 * triggers re-analysis with the constraint applied.
 */

import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { getDisplayedLayout, getActiveStreams } from '../state/projectState';
import { type FingerType, ALL_FINGERS } from '../../types/fingerModel';

/** Parse a constraint string like "L2" or "L-Ix" (legacy) into hand + finger. */
function parseConstraint(constraint: string): { hand: 'left' | 'right'; finger: FingerType } | null {
  // "L2" format (canonical)
  const matchNum = constraint.match(/^([LlRr])([1-5])$/);
  if (matchNum) {
    const hand = matchNum[1].toUpperCase() === 'L' ? 'left' as const : 'right' as const;
    const fingerMap: Record<string, FingerType> = {
      '1': 'thumb', '2': 'index', '3': 'middle', '4': 'ring', '5': 'pinky',
    };
    return { hand, finger: fingerMap[matchNum[2]] };
  }
  // "L-Ix" format (legacy)
  const FINGER_MAP: Record<string, FingerType> = {
    Th: 'thumb', Ix: 'index', Md: 'middle', Rg: 'ring', Pk: 'pinky',
  };
  const matchDash = constraint.match(/^([LR])-(\w+)$/);
  if (matchDash) {
    const hand = matchDash[1] === 'L' ? 'left' as const : 'right' as const;
    const finger = FINGER_MAP[matchDash[2]];
    if (finger) return { hand, finger };
  }
  return null;
}

/** Build a constraint string from hand + finger in canonical "L2" format. */
function buildConstraint(hand: 'left' | 'right', finger: FingerType): string {
  const FINGER_ABBREV: Record<FingerType, string> = {
    thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
  };
  return `${hand === 'left' ? 'L' : 'R'}${FINGER_ABBREV[finger]}`;
}

export function EventDetailPanel() {
  const { state, dispatch } = useProject();

  const activeStreams = getActiveStreams(state);
  const layout = getDisplayedLayout(state);
  const assignments = state.analysisResult?.executionPlan?.fingerAssignments;

  // Find selected assignment
  const assignment = useMemo(() => {
    if (state.selectedEventIndex === null || !assignments) return null;
    return assignments.find(a => a.eventIndex === state.selectedEventIndex) ?? null;
  }, [state.selectedEventIndex, assignments]);

  if (!assignment) return null;

  const stream = activeStreams.find(s => s.originalMidiNote === assignment.noteNumber);
  const padKey = assignment.row !== undefined && assignment.col !== undefined
    ? `${assignment.row},${assignment.col}`
    : null;

  // Current constraint on this pad
  const currentConstraint = padKey && layout ? layout.fingerConstraints[padKey] : undefined;
  const parsed = currentConstraint ? parseConstraint(currentConstraint) : null;

  // Effective hand/finger (constraint overrides solver assignment)
  const effectiveHand = parsed?.hand ?? (assignment.assignedHand === 'Unplayable' ? null : assignment.assignedHand);
  const effectiveFinger = parsed?.finger ?? assignment.finger;

  const handleSetConstraint = (hand: 'left' | 'right', finger: FingerType) => {
    if (!padKey) return;
    const constraint = buildConstraint(hand, finger);
    dispatch({
      type: 'SET_FINGER_CONSTRAINT',
      payload: { padKey, constraint },
    });
  };

  const handleClearConstraint = () => {
    if (!padKey) return;
    dispatch({
      type: 'SET_FINGER_CONSTRAINT',
      payload: { padKey, constraint: null },
    });
  };

  return (
    <div className="p-3 rounded-lg glass-panel space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-gray-500 font-medium">
          Selected Event
          {currentConstraint && (
            <span className="ml-2 text-purple-400">(constraint: {currentConstraint})</span>
          )}
        </h4>
        <button
          className="text-[10px] text-gray-500 hover:text-gray-300"
          onClick={() => dispatch({ type: 'SELECT_EVENT', payload: null })}
        >
          Deselect
        </button>
      </div>

      {/* Event info */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400">
        <InfoField label="Sound" value={stream?.name ?? `Note ${assignment.noteNumber}`} />
        <InfoField label="Time" value={`${assignment.startTime.toFixed(3)}s`} />
        <InfoField label="Pad" value={padKey ?? '—'} />
        <InfoField label="Hand" value={effectiveHand ?? 'Unplayable'} />
        <InfoField label="Finger" value={effectiveFinger ?? 'none'} />
        <InfoField label="Cost" value={assignment.cost.toFixed(2)} />
        <InfoField label="Difficulty" value={assignment.difficulty} />
        {assignment.costBreakdown && (
          <>
            <InfoField label="Transition" value={assignment.costBreakdown.transitionCost.toFixed(2)} />
            <InfoField label="Finger Pref" value={assignment.costBreakdown.fingerPreference.toFixed(2)} />
            <InfoField label="Shape Dev" value={assignment.costBreakdown.handShapeDeviation.toFixed(2)} />
          </>
        )}
      </div>

      {/* Finger constraint controls (pad-level) */}
      {padKey && (
        <div className="pt-2 border-t border-gray-700/50 space-y-2">
          <span className="text-[10px] text-gray-500">
            Pad [{padKey}] finger constraint
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-10">Hand:</span>
            <div className="flex gap-1">
              {(['left', 'right'] as const).map(hand => {
                const isActive = effectiveHand === hand;
                return (
                  <button
                    key={hand}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      isActive
                        ? hand === 'left' ? 'bg-blue-600/30 text-blue-300 border border-blue-500' : 'bg-purple-600/30 text-purple-300 border border-purple-500'
                        : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                    }`}
                    onClick={() => handleSetConstraint(hand, effectiveFinger ?? 'index')}
                  >
                    {hand === 'left' ? 'Left' : 'Right'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-10">Finger:</span>
            <div className="flex gap-1">
              {ALL_FINGERS.map(finger => {
                const isActive = effectiveFinger === finger;
                return (
                  <button
                    key={finger}
                    className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                      isActive
                        ? 'bg-gray-600 text-gray-200 border border-gray-500'
                        : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                    }`}
                    onClick={() => handleSetConstraint(effectiveHand ?? 'right', finger)}
                  >
                    {finger.slice(0, 2).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {currentConstraint && (
            <button
              className="text-[10px] text-amber-400 hover:text-amber-300"
              onClick={handleClearConstraint}
            >
              Clear constraint
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label}: <span className="text-gray-200">{value}</span>
    </div>
  );
}
