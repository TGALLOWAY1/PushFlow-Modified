/**
 * Placement locks: the one hard, user-facing placement rule (canon section 11).
 *
 * `Layout.placementLocks` maps a Sound's id to the pad it is locked to. Every
 * optimization method pre-places locked Sounds and never moves them; these
 * helpers check the result, so a candidate that would break a lock can be
 * dropped and the reason shown.
 */

import { type Layout } from '../../types/layout';

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
