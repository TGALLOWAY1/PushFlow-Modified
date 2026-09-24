import { type SoundStream } from '../state/projectState';

interface VoiceIdentityLike {
  id?: string;
}

/**
 * Sound lookups by identity (invariant 5). A layout voice or a plan's
 * assignment is matched to a Sound by id only; one that names no known Sound
 * has no Sound, even when a Sound shares its pitch.
 */
export function buildSoundStreamLookup(soundStreams: SoundStream[]) {
  const byId = new Map<string, SoundStream>();
  for (const stream of soundStreams) byId.set(stream.id, stream);

  const forId = (id?: string | null): SoundStream | null => (id ? byId.get(id) ?? null : null);
  const forVoice = (voice?: VoiceIdentityLike | null): SoundStream | null => forId(voice?.id);
  const forAssignment = (voiceId?: string | null): SoundStream | null => forId(voiceId);

  return {
    forVoice,
    forAssignment,
  };
}
