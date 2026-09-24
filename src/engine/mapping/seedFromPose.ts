/**
 * Pose0-based Layout Seeding.
 *
 * Deterministically seeds a full Layout for a performance's Sounds from Pose0
 * (the natural hand pose), so every Sound has a pad before optimization.
 *
 * Sounds are placed by identity, never by pitch (invariant 5): the busiest
 * Sounds take the anchor pads in finger-priority order, and the rest fill the
 * remaining pads row by row. Locked Sounds are placed first, on their locked
 * pads, and the locks are carried into the seeded layout (canon section 11).
 *
 * Ported from Version1/src/engine/seedMappingFromPose0.ts with canonical terminology.
 */

import { type Performance } from '../../types/performance';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { padKey } from '../../types/padGrid';
import { type NaturalHandPose } from '../../types/ergonomicPrior';
import { getPose0PadsWithOffset, FINGER_PRIORITY_ORDER } from '../prior/naturalHandPose';
import { generateId } from '../../utils/idGenerator';
import { buildVoiceMap, soundKeyOf } from './voiceMap';
import { applicableLocks } from './placementLocks';

export interface SeedFromPoseOptions {
  /**
   * Voice objects by sound key (voiceId, or the pitch string for an event with
   * no Sound). Built from the base layout and the performance when omitted.
   */
  voices?: Map<string, Voice>;
  /** Locks to honour. Defaults to the base layout's locks. */
  placementLocks?: Record<string, string>;
  /** Supplies voices and locks when the options above are omitted. */
  baseLayout?: Layout | null;
  /**
   * Tie order for Sounds with equal usage: sound keys, first wins. In the app
   * this is the Sounds panel order. Defaults to the order of `voices`.
   */
  soundOrder?: Iterable<string>;
}

/**
 * The performance's Sounds, busiest first. Ties go to the Sound listed first
 * in `tieOrder` (the Sounds panel order in the app), then to the one that
 * appears first in the event list. The order never depends on pitch, nor on
 * ids that differ from one import to the next.
 */
export function orderSoundsByUsage(performance: Performance, tieOrder?: Iterable<string>): string[] {
  const rank = new Map<string, number>();
  for (const key of tieOrder ?? []) if (!rank.has(key)) rank.set(key, rank.size);
  const stats = new Map<string, { count: number; order: number }>();
  performance.events.forEach((event, index) => {
    const key = soundKeyOf(event);
    const entry = stats.get(key);
    if (entry) {
      entry.count++;
    } else {
      stats.set(key, { count: 1, order: index });
    }
  });
  const tie = (key: string) => rank.get(key) ?? Number.MAX_SAFE_INTEGER;
  return [...stats.entries()]
    .sort(([keyA, a], [keyB, b]) => b.count - a.count || tie(keyA) - tie(keyB) || a.order - b.order)
    .map(([key]) => key);
}

/**
 * Seeds a full Layout for a performance using Pose0 anchor pads.
 * Deterministic: same inputs produce the same layout.
 *
 * Algorithm:
 * 1. Places every locked Sound on its locked pad.
 * 2. Orders the remaining Sounds by usage (most-played first).
 * 3. Places them on the free Pose0 anchor pads in finger-priority order, then
 *    on the remaining free pads in row-major order.
 *
 * @param performance - Performance with note events
 * @param pose0 - Natural hand pose (anchor pads)
 * @param offsetRow - Vertical offset 0..4 (default 0)
 * @param options - Voices, locks and the base layout they default from
 * @returns A fully seeded Layout carrying the honoured locks
 */
export function seedLayoutFromPose0(
  performance: Performance,
  pose0: NaturalHandPose,
  offsetRow: number = 0,
  options: SeedFromPoseOptions = {},
): Layout {
  const baseLayout = options.baseLayout ?? null;
  const voices = options.voices ?? buildVoiceMap(performance, baseLayout);
  const knownVoiceIds = new Set<string>(voices.keys());
  for (const voice of Object.values(baseLayout?.padToVoice ?? {})) knownVoiceIds.add(voice.id);
  const locks = applicableLocks(options.placementLocks ?? baseLayout?.placementLocks, knownVoiceIds);

  const padToVoice: Record<string, Voice> = {};
  const occupied = new Set<string>();
  const placed = new Set<string>();
  const honouredLocks: Record<string, string> = {};

  // 1. Locked Sounds first, on their own pads.
  const baseVoicesById = new Map(
    Object.values(baseLayout?.padToVoice ?? {}).map(voice => [voice.id, voice] as const),
  );
  for (const [voiceId, lockedPad] of Object.entries(locks)) {
    const voice = voices.get(voiceId) ?? baseVoicesById.get(voiceId);
    if (!voice || occupied.has(lockedPad)) continue;
    padToVoice[lockedPad] = voice;
    occupied.add(lockedPad);
    placed.add(voiceId);
    honouredLocks[voiceId] = lockedPad;
  }

  // 2. Anchor pads in finger-priority order, then the rest row by row.
  const posePads = getPose0PadsWithOffset(pose0, offsetRow, true);
  const orderedPosePads = FINGER_PRIORITY_ORDER.flatMap((fid) => {
    const entry = posePads.find((p) => p.fingerId === fid);
    return entry ? [padKey(entry.row, entry.col)] : [];
  }).filter((key) => {
    const [row, col] = key.split(',').map(Number);
    return row >= 0 && row <= 7 && col >= 0 && col <= 7;
  });
  const anchorSet = new Set(orderedPosePads);
  const remainingPads: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const key = padKey(row, col);
      if (!anchorSet.has(key)) remainingPads.push(key);
    }
  }
  const freePads = [...orderedPosePads, ...remainingPads].filter((key) => !occupied.has(key));

  // 3. The remaining Sounds, busiest first.
  let cursor = 0;
  for (const key of orderSoundsByUsage(performance, options.soundOrder ?? voices.keys())) {
    const voice = voices.get(key);
    if (!voice || placed.has(key) || placed.has(voice.id)) continue;
    if (cursor >= freePads.length) break;
    padToVoice[freePads[cursor++]] = voice;
    placed.add(key);
    placed.add(voice.id);
  }

  return {
    id: generateId('layout'),
    name: `${performance.name ?? 'Performance'} Layout`,
    padToVoice,
    fingerConstraints: {},
    placementLocks: honouredLocks,
    scoreCache: null,
    layoutMode: 'optimized',
    role: 'working' as const,
  };
}
