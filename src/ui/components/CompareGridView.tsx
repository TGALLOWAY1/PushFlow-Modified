/**
 * CompareGridView.
 *
 * Side-by-side grid comparison for two candidate solutions.
 * Renders two compact PadGrid instances with diff highlighting on
 * pads where the layout or finger assignments differ.
 */

import { useMemo } from 'react';
import { PadGrid } from './PadGrid';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type Voice } from '../../types/voice';
import { type FingerAssignment } from '../../types/executionPlan';
import { type SoundStream } from '../state/projectState';

/** Convert SoundStream[] to Voice[] for PadGrid consumption. */
function streamsToVoices(streams: SoundStream[]): Voice[] {
  return streams.map(s => ({
    id: s.id,
    name: s.name,
    sourceType: 'midi_track' as const,
    sourceFile: '',
    originalMidiNote: s.originalMidiNote,
    color: s.color,
  }));
}

interface CompareGridViewProps {
  /** The currently selected candidate. */
  candidateA: CandidateSolution;
  /** The comparison candidate. */
  candidateB: CandidateSolution;
  /** Sound streams (converted to Voice[] for PadGrid). */
  voices: SoundStream[];
  /** Display label for candidate A. */
  candidateALabel: string;
  /** Display label for candidate B. */
  candidateBLabel: string;
}

/**
 * Build a map of padKey → Set<fingerLabel> from finger assignments.
 * fingerLabel format: "L2", "R1", etc.
 */
function buildFingerMap(assignments: FingerAssignment[]): Map<string, Set<string>> {
  const ABBREV: Record<string, string> = {
    thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
  };
  const map = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.row === undefined || a.col === undefined) continue;
    const key = `${a.row},${a.col}`;
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    if (a.finger) {
      set.add(`${a.assignedHand[0].toUpperCase()}${ABBREV[a.finger] ?? a.finger}`);
    }
  }
  return map;
}

/** Check if two sets have identical elements. */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

export function CompareGridView({
  candidateA,
  candidateB,
  voices: soundStreams,
  candidateALabel,
  candidateBLabel,
}: CompareGridViewProps) {
  // Convert SoundStreams to Voices for PadGrid
  const voices = useMemo(() => streamsToVoices(soundStreams), [soundStreams]);

  // Compute diff pads: pads where layout or finger assignments differ
  const { diffPads, layoutDiffCount, fingerDiffCount } = useMemo(() => {
    const diff = new Set<string>();
    let layoutDiffs = 0;
    let fingerDiffs = 0;

    // 1. Layout differences (which voice is on which pad)
    const allPadKeys = new Set([
      ...Object.keys(candidateA.layout.padToVoice),
      ...Object.keys(candidateB.layout.padToVoice),
    ]);

    for (const pk of allPadKeys) {
      const voiceA = candidateA.layout.padToVoice[pk];
      const voiceB = candidateB.layout.padToVoice[pk];
      const aId = voiceA?.id;
      const bId = voiceB?.id;

      if (aId !== bId) {
        diff.add(pk);
        layoutDiffs++;
      }
    }

    // 2. Finger assignment differences (same voice, different fingers)
    const fingersA = buildFingerMap(candidateA.executionPlan.fingerAssignments);
    const fingersB = buildFingerMap(candidateB.executionPlan.fingerAssignments);

    const allFingerPads = new Set([...fingersA.keys(), ...fingersB.keys()]);
    for (const pk of allFingerPads) {
      if (diff.has(pk)) continue; // Already marked as layout diff
      const setA = fingersA.get(pk) ?? new Set();
      const setB = fingersB.get(pk) ?? new Set();
      if (!setsEqual(setA, setB)) {
        diff.add(pk);
        fingerDiffs++;
      }
    }

    return { diffPads: diff, layoutDiffCount: layoutDiffs, fingerDiffCount: fingerDiffs };
  }, [candidateA, candidateB]);

  const totalDiffs = layoutDiffCount + fingerDiffCount;

  return (
    <div className="space-y-2">
      {/* Side-by-side grids */}
      <div className="flex gap-4 items-start">
        <PadGrid
          layout={candidateA.layout}
          voices={voices}
          assignments={candidateA.executionPlan.fingerAssignments}
          compact
          diffPads={diffPads}
          label={candidateALabel}
          labelColor="text-blue-400"
        />
        <PadGrid
          layout={candidateB.layout}
          voices={voices}
          assignments={candidateB.executionPlan.fingerAssignments}
          compact
          diffPads={diffPads}
          label={candidateBLabel}
          labelColor="text-purple-400"
        />
      </div>

      {/* Summary line */}
      <div className="text-[10px] text-gray-500">
        {totalDiffs === 0 ? (
          'No differences'
        ) : (
          <>
            <span className="text-amber-400">{totalDiffs}</span>
            {' '}pad{totalDiffs !== 1 ? 's' : ''} differ
            {layoutDiffCount > 0 && (
              <> · <span className="text-gray-400">{layoutDiffCount} voice{layoutDiffCount !== 1 ? 's' : ''} moved</span></>
            )}
            {fingerDiffCount > 0 && (
              <> · <span className="text-gray-400">{fingerDiffCount} finger{fingerDiffCount !== 1 ? 's' : ''} changed</span></>
            )}
          </>
        )}
      </div>
    </div>
  );
}
