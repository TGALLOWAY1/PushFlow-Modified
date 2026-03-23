import { type SoundStream } from '../state/projectState';

interface VoiceIdentityLike {
  id?: string;
  originalMidiNote?: number | null;
}

export function buildSoundStreamLookup(soundStreams: SoundStream[]) {
  const byId = new Map<string, SoundStream>();
  const byMidiNote = new Map<number, SoundStream>();

  for (const stream of soundStreams) {
    byId.set(stream.id, stream);
    if (!byMidiNote.has(stream.originalMidiNote)) {
      byMidiNote.set(stream.originalMidiNote, stream);
    }
  }

  const forVoice = (voice?: VoiceIdentityLike | null): SoundStream | null => {
    if (!voice) return null;
    if (voice.id && byId.has(voice.id)) {
      return byId.get(voice.id) ?? null;
    }
    if (voice.originalMidiNote != null) {
      return byMidiNote.get(voice.originalMidiNote) ?? null;
    }
    return null;
  };

  const forAssignment = (voiceId?: string, noteNumber?: number | null): SoundStream | null => {
    if (voiceId && byId.has(voiceId)) {
      return byId.get(voiceId) ?? null;
    }
    if (noteNumber != null) {
      return byMidiNote.get(noteNumber) ?? null;
    }
    return null;
  };

  return {
    forVoice,
    forAssignment,
  };
}
