/**
 * Sound identity for the engine: which Voice each Performance Event belongs to.
 *
 * Every event is keyed by its Sound (`voiceId`). Only an event with no Sound at
 * all (synthetic performances built straight from MIDI notes, with no voiceId)
 * is keyed by its pitch, because pitch is then the only identity it has. In
 * the app every event carries a voiceId, so pitch never decides which pad a
 * Sound plays (invariant 5): a Sound with no pad is unmapped even when another
 * Sound shares its pitch.
 *
 * Shared by every optimization method, so Greedy, Beam and Annealing agree on
 * what a Sound is (canon section 10, engine contract section 6).
 */

import { type Performance } from '../../types/performance';
import { type PerformanceEvent } from '../../types/performanceEvent';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';

/** What the engine needs to know about a Sound that has no pad yet. */
export interface VoiceHint {
  id: string;
  name: string;
  color: string;
  originalMidiNote: number | null;
}

/**
 * The key an event's Sound is filed under: its voiceId, or, for an event
 * with no Sound, its pitch as a string. The same convention the moment
 * builder and the greedy optimizer use (`event.voiceId ?? String(noteNumber)`).
 */
export function soundKeyOf(event: Pick<PerformanceEvent, 'voiceId' | 'noteNumber'>): string {
  return event.voiceId ?? String(event.noteNumber);
}

/**
 * True when `voiceId` names a Sound rather than standing in for a pitch.
 *
 * Moments carry `soundId = voiceId ?? String(noteNumber)`, so a "voiceId"
 * equal to the event's own pitch string is the no-Sound placeholder, and such
 * an event may still be resolved by pitch.
 */
export function isSoundId(voiceId: string | undefined, noteNumber: number): voiceId is string {
  return voiceId !== undefined && voiceId !== String(noteNumber);
}

/**
 * Voice objects for every Sound in a performance, keyed by sound key.
 *
 * Voices already on the base layout come first (they carry the user's names
 * and colours), then hints for Sounds that have no pad yet, then a neutral
 * placeholder for a Sound the caller told us nothing about. Hints are matched
 * by id only, never by pitch.
 *
 * Voices are also filed under their pitch string so that an event with no
 * Sound (a pitch-keyed event) finds the layout Voice that plays that pitch;
 * a Sound-keyed event never consults those entries.
 */
export function buildVoiceMap(
  performance: Performance,
  baseLayout?: Layout | null,
  voiceHints?: ReadonlyArray<VoiceHint>,
): Map<string, Voice> {
  const voices = new Map<string, Voice>();

  if (baseLayout) {
    for (const voice of Object.values(baseLayout.padToVoice)) {
      voices.set(voice.id, voice);
      if (voice.originalMidiNote != null) {
        const pitchKey = String(voice.originalMidiNote);
        if (!voices.has(pitchKey)) voices.set(pitchKey, voice);
      }
    }
  }

  const hintById = new Map<string, VoiceHint>();
  for (const hint of voiceHints ?? []) hintById.set(hint.id, hint);

  for (const event of performance.events) {
    const key = soundKeyOf(event);
    if (voices.has(key)) continue;
    const hint = hintById.get(key);
    voices.set(key, {
      id: hint?.id ?? key,
      name: hint?.name ?? `Sound ${event.noteNumber}`,
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: hint?.originalMidiNote ?? event.noteNumber,
      color: hint?.color ?? '#888888',
    });
  }

  return voices;
}
