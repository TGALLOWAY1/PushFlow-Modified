/**
 * Placement locks: the one hard, user-facing placement rule (canon section 11).
 *
 * `Layout.placementLocks` maps a Sound's id to the pad it is locked to. Every
 * optimization method pre-places locked Sounds and never moves them; these
 * helpers check the result, so a candidate that would break a lock can be
 * dropped and the reason shown.
 */

import { type Layout } from '../../types/layout';
import { type Performance } from '../../types/performance';
import { type ExecutionPlanResult } from '../../types/executionPlan';
import { hashLayout } from './mappingResolver';
import { soundKeyOf } from './voiceMap';

export interface LockViolation {
  voiceId: string;
  /** The pad the Sound is locked to. */
  lockedPadKey: string;
  /** Where the layout actually has the Sound, or null when it is not placed. */
  actualPadKey: string | null;
}

/**
 * Locks that a candidate can honour: those whose Sound the generator knows
 * about (it is on the base layout or among the Sounds being placed). A lock
 * left behind by a Sound that no longer exists cannot be honoured by any
 * layout and is not carried into candidates.
 */
export function applicableLocks(
  locks: Record<string, string> | undefined,
  knownVoiceIds: ReadonlySet<string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [voiceId, padKey] of Object.entries(locks ?? {})) {
    if (knownVoiceIds.has(voiceId)) result[voiceId] = padKey;
  }
  return result;
}

/** Every lock the layout breaks: the Sound is missing from its pad or sits elsewhere. */
export function findLockViolations(
  locks: Record<string, string> | undefined,
  layout: Layout,
): LockViolation[] {
  const violations: LockViolation[] = [];
  for (const [voiceId, lockedPadKey] of Object.entries(locks ?? {})) {
    if (layout.padToVoice[lockedPadKey]?.id === voiceId) continue;
    const actual = Object.entries(layout.padToVoice).find(([, voice]) => voice.id === voiceId)?.[0] ?? null;
    violations.push({ voiceId, lockedPadKey, actualPadKey: actual });
  }
  return violations;
}

/** True when every lock holds in the layout. */
export function holdsLocks(locks: Record<string, string> | undefined, layout: Layout): boolean {
  return findLockViolations(locks, layout).length === 0;
}

/** Wording for the candidate list when candidates were dropped for breaking locks. */
export function describeDroppedForLocks(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? '1 candidate was dropped because it moved a locked Sound.'
    : `${count} candidates were dropped because they moved a locked Sound.`;
}

// ============================================================================
// Pins: placed Sounds that must stay placed without a lock (T15)
// ============================================================================

/**
 * Placements every candidate must keep although the user set no lock on them
 * (T15, invariant 7): Sounds already on the grid whose events are not in the
 * performance being optimized, which in the app means the muted Sounds.
 * Generate never removes a placed Sound, so these ride through seeding,
 * compaction, mutation and hill-climbing exactly like locks (`fixedPlacements`)
 * and are taken back out of the candidate's locks by `withoutPins`.
 *
 * A layout Voice is present when an event carries its id. An event with no
 * Sound (no voiceId) is keyed by its pitch, so for such an event a Voice is
 * matched by pitch, the same convention as buildVoiceMap.
 */
export function pinnedPlacements(
  layout: Pick<Layout, 'padToVoice'> | null | undefined,
  performance: Pick<Performance, 'events'>,
): Record<string, string> {
  const pins: Record<string, string> = {};
  if (!layout) return pins;
  const soundKeys = new Set<string>();
  const pitchKeys = new Set<string>();
  for (const event of performance.events) {
    soundKeys.add(soundKeyOf(event));
    if (event.voiceId == null) pitchKeys.add(String(event.noteNumber));
  }
  for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
    const present = soundKeys.has(voice.id)
      || (voice.originalMidiNote != null && pitchKeys.has(String(voice.originalMidiNote)));
    if (!present && !(voice.id in pins)) pins[voice.id] = padKey;
  }
  return pins;
}

/**
 * The pins a generator honours: those whose Sound it knows, minus any Sound
 * the user locked, because the lock already fixes it and always wins.
 */
export function pinsToHonour(
  pins: Record<string, string> | undefined,
  locks: Record<string, string>,
  knownVoiceIds: ReadonlySet<string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [voiceId, padKey] of Object.entries(applicableLocks(pins, knownVoiceIds))) {
    if (!(voiceId in locks)) result[voiceId] = padKey;
  }
  return result;
}

/** Locks plus pins: everything a candidate must keep where it is. Locks win. */
export function fixedPlacements(
  locks: Record<string, string>,
  pins: Record<string, string>,
): Record<string, string> {
  return { ...pins, ...locks };
}

/**
 * A finished candidate without its pins. While optimizing, pins travel in
 * `placementLocks` so every method keeps them; a pin is not a lock the user
 * set, so it leaves the candidate's locks here, and the plan is re-bound to
 * the cleaned layout (whose hash no longer counts those pads as locked).
 * Returns the inputs themselves when the layout carries no pin.
 */
export function withoutPins<P extends Pick<ExecutionPlanResult, 'layoutBinding' | 'metadata'>>(
  layout: Layout,
  executionPlan: P,
  pins: Record<string, string>,
): { layout: Layout; executionPlan: P } {
  const carried = Object.keys(pins).filter(voiceId => voiceId in (layout.placementLocks ?? {}));
  if (carried.length === 0) return { layout, executionPlan };
  const placementLocks = { ...layout.placementLocks };
  for (const voiceId of carried) delete placementLocks[voiceId];
  const cleaned: Layout = { ...layout, placementLocks };
  const layoutHash = hashLayout(cleaned);
  let plan: P = executionPlan;
  if (plan.layoutBinding) {
    plan = { ...plan, layoutBinding: { ...plan.layoutBinding, layoutHash } };
  }
  if (plan.metadata?.layoutHashUsed) {
    plan = { ...plan, metadata: { ...plan.metadata, layoutHashUsed: layoutHash } };
  }
  return { layout: cleaned, executionPlan: plan };
}

/** Wording for the candidate list when placed Sounds without events kept their pads. */
export function describePinnedPlacements(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? '1 muted Sound kept its pad in every candidate.'
    : `${count} muted Sounds kept their pads in every candidate.`;
}
