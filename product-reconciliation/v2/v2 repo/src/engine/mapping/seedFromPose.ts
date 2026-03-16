/**
 * Pose0-based Layout Seeding.
 *
 * Deterministically seeds a full Layout from performance notes and Pose0.
 * Ensures 100% coverage before optimization.
 *
 * Ported from Version1/src/engine/seedMappingFromPose0.ts with canonical terminology.
 */

import { type Performance } from '../../types/performance';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { padKey } from '../../types/padGrid';
import { type NaturalHandPose } from '../../types/ergonomicPrior';
import { getPose0PadsWithOffset, FINGER_PRIORITY_ORDER } from '../prior/naturalHandPose';
import { getPerformanceNoteSet } from './mappingCoverage';
import { generateId } from '../../utils/idGenerator';

// ============================================================================
// Helpers
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 2;
  const note = NOTE_NAMES[midiNote % 12];
  return `${note}${octave}`;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#10b981', '#3b82f6', '#8b5cf6',
];

/**
 * Creates a minimal Voice for a note number.
 */
function createVoiceForNote(noteNumber: number, index: number): Voice {
  return {
    id: generateId('sound'),
    name: `${getNoteName(noteNumber)} (${noteNumber})`,
    sourceType: 'midi_track',
    sourceFile: 'seed',
    originalMidiNote: noteNumber,
    color: COLORS[index % COLORS.length],
  };
}

// ============================================================================
// Layout Seeding
// ============================================================================

/**
 * Seeds a full Layout from performance notes using Pose0 anchor pads.
 * Deterministic: same inputs produce same layout.
 *
 * Algorithm:
 * 1. Sorts notes by frequency (most-used first), breaking ties by note number
 * 2. Places the most important notes on Pose0 anchor pads (finger priority order)
 * 3. Remaining notes fill remaining pads in row-major order
 *
 * @param performance - Performance with note events
 * @param pose0 - Natural hand pose (anchor pads)
 * @param offsetRow - Vertical offset 0..4 (default 0)
 * @param existingVoices - Optional map of noteNumber -> Voice for names/colors
 * @returns A fully seeded Layout
 */
export function seedLayoutFromPose0(
  performance: Performance,
  pose0: NaturalHandPose,
  offsetRow: number = 0,
  existingVoices?: Map<number, Voice>
): Layout {
  const requiredNotes = getPerformanceNoteSet(performance);

  // Sort by importance: event count desc, then noteNumber asc
  const noteCounts = new Map<number, number>();
  for (const e of performance.events) {
    noteCounts.set(e.noteNumber, (noteCounts.get(e.noteNumber) ?? 0) + 1);
  }
  const sortedNotes = Array.from(requiredNotes).sort((a, b) => {
    const countA = noteCounts.get(a) ?? 0;
    const countB = noteCounts.get(b) ?? 0;
    if (countB !== countA) return countB - countA;
    return a - b;
  });

  // Get Pose0 pads with offset, ordered by finger priority
  const posePads = getPose0PadsWithOffset(pose0, offsetRow, true);
  const orderedPosePads = FINGER_PRIORITY_ORDER.flatMap((fid) => {
    const entry = posePads.find((p) => p.fingerId === fid);
    return entry ? [{ row: entry.row, col: entry.col }] : [];
  }).filter((p) => p.row >= 0 && p.row <= 7 && p.col >= 0 && p.col <= 7);

  // Build set of occupied pads
  const occupied = new Set<string>();
  for (const p of orderedPosePads) {
    occupied.add(padKey(p.row, p.col));
  }

  // Remaining pads in row-major order
  const remainingPads: { row: number; col: number }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (!occupied.has(padKey(row, col))) {
        remainingPads.push({ row, col });
      }
    }
  }

  // Assign notes to pads: anchor pads first, then remaining
  const padToVoice: Record<string, Voice> = {};
  const padOrder = [...orderedPosePads, ...remainingPads];

  for (let i = 0; i < sortedNotes.length && i < padOrder.length; i++) {
    const noteNumber = sortedNotes[i];
    const pad = padOrder[i];
    const key = padKey(pad.row, pad.col);
    const voice = existingVoices?.get(noteNumber) ?? createVoiceForNote(noteNumber, i);
    padToVoice[key] = { ...voice, originalMidiNote: noteNumber };
  }

  return {
    id: generateId('layout'),
    name: `${performance.name ?? 'Performance'} Layout`,
    padToVoice,
    fingerConstraints: {},
    placementLocks: {},
    scoreCache: null,
    layoutMode: 'optimized',
    role: 'working' as const,
  };
}
