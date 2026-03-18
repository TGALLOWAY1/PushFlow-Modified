/**
 * RudimentPadGrid.
 *
 * 8x8 Push 3 grid visualization for rudiment pad and finger assignments.
 * Shows which pads are assigned, hand zones, and highlights the active event.
 */

import { useMemo } from 'react';
import { type LoopLane } from '../../../types/loopEditor';
import { type LanePadAssignment, type RudimentFingerAssignment } from '../../../types/rudiment';

// ============================================================================
// Constants
// ============================================================================

const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const HAND_COLORS = {
  left:  { bg: 'rgba(59,130,246,0.25)', border: '#3b82f6', text: '#93c5fd' },
  right: { bg: 'rgba(168,85,247,0.25)', border: '#a855f7', text: '#d8b4fe' },
  shared: { bg: 'rgba(234,179,8,0.2)', border: '#eab308', text: '#fde68a' },
};

// ============================================================================
// Props
// ============================================================================

interface RudimentPadGridProps {
  padAssignments: LanePadAssignment[];
  fingerAssignments: RudimentFingerAssignment[];
  activeEventIndex: number | null;
  lanes: LoopLane[];
}

// ============================================================================
// Component
// ============================================================================

export function RudimentPadGrid({
  padAssignments,
  fingerAssignments,
  activeEventIndex,
  lanes,
}: RudimentPadGridProps) {
  // Build pad lookup: "row,col" -> LanePadAssignment
  const padMap = useMemo(() => {
    const map = new Map<string, LanePadAssignment>();
    for (const pa of padAssignments) {
      map.set(`${pa.pad.row},${pa.pad.col}`, pa);
    }
    return map;
  }, [padAssignments]);

  // Build lane color lookup
  const laneColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const lane of lanes) {
      map.set(lane.id, lane.color);
    }
    return map;
  }, [lanes]);

  // Get the active event's finger assignment (if stepping)
  const activeAssignment = activeEventIndex !== null && activeEventIndex >= 0 && activeEventIndex < fingerAssignments.length
    ? fingerAssignments[activeEventIndex]
    : null;

  // Get all active pads at the current step (for simultaneous events)
  const activePads = useMemo(() => {
    if (!activeAssignment) return new Set<string>();
    const stepIndex = activeAssignment.stepIndex;
    const pads = new Set<string>();
    for (const fa of fingerAssignments) {
      if (fa.stepIndex === stepIndex) {
        pads.add(`${fa.pad.row},${fa.pad.col}`);
      }
    }
    return pads;
  }, [activeAssignment, fingerAssignments]);

  // Get finger info for active step
  const activeStepFingers = useMemo(() => {
    if (!activeAssignment) return new Map<string, RudimentFingerAssignment>();
    const stepIndex = activeAssignment.stepIndex;
    const map = new Map<string, RudimentFingerAssignment>();
    for (const fa of fingerAssignments) {
      if (fa.stepIndex === stepIndex) {
        map.set(`${fa.pad.row},${fa.pad.col}`, fa);
      }
    }
    return map;
  }, [activeAssignment, fingerAssignments]);

  // Build per-pad most common finger from all assignments
  const padFingerSummary = useMemo(() => {
    const map = new Map<string, { hand: string; finger: string }>();
    for (const fa of fingerAssignments) {
      const key = `${fa.pad.row},${fa.pad.col}`;
      if (!map.has(key)) {
        map.set(key, { hand: fa.hand, finger: fa.finger });
      }
    }
    return map;
  }, [fingerAssignments]);

  // Render rows top-to-bottom (row 7 at top, row 0 at bottom)
  const rows = [];
  for (let row = 7; row >= 0; row--) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const padKey = `${row},${col}`;
      const assignment = padMap.get(padKey);
      const isActive = activePads.has(padKey);
      const activeFinger = activeStepFingers.get(padKey);
      const isLeftZone = col < 4;
      const fingerInfo = padFingerSummary.get(padKey);

      // Determine colors
      let bgColor: string;
      let borderColor: string;
      let textColor: string;

      if (assignment) {
        const laneColor = laneColors.get(assignment.laneId);
        const hand = assignment.preferredHand === 'shared' ? 'shared' : assignment.preferredHand;
        const scheme = HAND_COLORS[hand];
        bgColor = laneColor ? `${laneColor}40` : scheme.bg;
        borderColor = isActive ? '#facc15' : scheme.border;
        textColor = scheme.text;
      } else {
        bgColor = isLeftZone ? '#0f172a' : '#120f1f';
        borderColor = '#1e293b';
        textColor = '#475569';
      }

      cells.push(
        <div
          key={padKey}
          className={`
            relative flex flex-col items-center justify-center
            w-10 h-10 rounded-md text-[8px] font-mono leading-tight
            border-2 transition-all duration-100
            ${isActive ? 'ring-2 ring-yellow-400/60 z-10 scale-105' : ''}
            ${assignment ? '' : 'opacity-40'}
          `}
          style={{
            backgroundColor: bgColor,
            borderColor,
            color: textColor,
          }}
          title={
            assignment
              ? `[${row},${col}] ${assignment.laneName} | ${fingerInfo ? `${fingerInfo.hand[0].toUpperCase()}${FINGER_ABBREV[fingerInfo.finger]}` : ''}`
              : `[${row},${col}] empty`
          }
        >
          {assignment ? (
            <>
              {/* Lane color swatch + name */}
              <span className="block truncate w-full text-center text-[7px] font-semibold text-white/90 leading-none">
                {assignment.laneName}
              </span>
              {/* Finger assignment */}
              <span className="block text-[6px] leading-none mt-0.5" style={{ color: textColor }}>
                {activeFinger
                  ? `${activeFinger.hand[0].toUpperCase()}${FINGER_ABBREV[activeFinger.finger]}`
                  : fingerInfo
                    ? `${fingerInfo.hand[0].toUpperCase()}${FINGER_ABBREV[fingerInfo.finger]}`
                    : ''
                }
              </span>
              {/* Lane color indicator */}
              <div
                className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: laneColors.get(assignment.laneId) ?? '#666' }}
              />
            </>
          ) : (
            <span className="text-[6px] text-gray-600">{row},{col}</span>
          )}
        </div>
      );
    }
    rows.push(
      <div key={row} className="flex gap-1 items-center">
        <span className="w-3 text-[8px] text-gray-500 text-right mr-0.5 font-mono">{row}</span>
        {cells}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-gray-400">Pad Assignments</h3>
      <div className="inline-block">
        <div className="flex flex-col gap-1">
          {rows}
          {/* Column labels */}
          <div className="flex gap-1 ml-4">
            {Array.from({ length: 8 }, (_, col) => (
              <div key={col} className="w-10 text-center text-[8px] text-gray-500 font-mono">{col}</div>
            ))}
          </div>
        </div>
        {/* Zone labels */}
        <div className="flex ml-4 mt-1 gap-1">
          <div className="w-[calc(4*2.5rem+3*0.25rem)] text-center text-[8px] text-blue-400/70 border-t border-blue-500/20 pt-0.5">
            Left Hand
          </div>
          <div className="w-[calc(4*2.5rem+3*0.25rem)] text-center text-[8px] text-purple-400/70 border-t border-purple-500/20 pt-0.5">
            Right Hand
          </div>
        </div>
      </div>
    </div>
  );
}
