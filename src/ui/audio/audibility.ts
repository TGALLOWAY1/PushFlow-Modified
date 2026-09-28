/**
 * What sounds in rehearsal (S4.4, T15/T16).
 *
 * Mute and Solo are independent, rehearsal-only flags on each Sound, with the
 * rule a DAW uses:
 *
 *   audible = anySolo ? soloed : !muted
 *
 * A solo silences every Sound that isn't soloed while it lasts, a soloed Sound
 * sounds even when muted, and ending the solo leaves every mute as it was.
 * Neither flag is ever an analysis input: a muted Sound keeps its pad, its
 * fingering and its place in every score, and its pad stays editable.
 */

export interface Audition {
  mutedSoundIds: readonly string[];
  soloedSoundIds: readonly string[];
}

/** Why a Sound is silent in rehearsal: its own Mute, or another Sound's Solo. */
export type SilentReason = 'muted' | 'not-soloed';

/**
 * Why `soundId` is silent, or null when it sounds. `soundIds` are the
 * project's Sounds: a solo left on a Sound it no longer has solos nothing.
 */
export function silentReason(soundId: string, audition: Audition, soundIds?: readonly string[]): SilentReason | null {
  const live = soundIds ? new Set(soundIds) : null;
  const soloed = live ? audition.soloedSoundIds.filter(id => live.has(id)) : audition.soloedSoundIds;
  if (soloed.length > 0) return soloed.includes(soundId) ? null : 'not-soloed';
  return audition.mutedSoundIds.includes(soundId) ? 'muted' : null;
}

/** Whether `soundId` sounds in rehearsal (see silentReason). */
export function isAudible(soundId: string, audition: Audition, soundIds?: readonly string[]): boolean {
  return silentReason(soundId, audition, soundIds) === null;
}

/** The project's Sounds that sound in rehearsal. */
export function audibleSoundIds(soundIds: readonly string[], audition: Audition): Set<string> {
  return new Set(soundIds.filter(id => isAudible(id, audition, soundIds)));
}

/** How a silent Sound says so: a pad's, a row's or a lane's tooltip. */
export function silentLabel(reason: SilentReason): string {
  return reason === 'muted' ? 'Muted: silent in rehearsal' : 'Silent in rehearsal: another Sound is soloed';
}
