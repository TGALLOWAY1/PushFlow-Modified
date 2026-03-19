import { type PerformanceLane, type LaneColorMode, type SourceFile } from '../../types/performanceLane';
import { type SoundStream } from './projectState';

export const LEGACY_STREAMS_SOURCE_ID = 'imported';
export const LEGACY_STREAMS_SOURCE_NAME = 'Imported';

export function buildPerformanceLanesFromStreams(soundStreams: SoundStream[]): PerformanceLane[] {
  return soundStreams.map((stream, i) => ({
    id: stream.id,
    name: stream.name,
    sourceFileId: LEGACY_STREAMS_SOURCE_ID,
    sourceFileName: LEGACY_STREAMS_SOURCE_NAME,
    groupId: null,
    orderIndex: i,
    color: stream.color,
    colorMode: 'overridden' as LaneColorMode,
    events: stream.events.map((event, eventIndex) => ({
      eventId: event.eventKey || `${stream.id}-${eventIndex}`,
      laneId: stream.id,
      startTime: event.startTime,
      duration: event.duration,
      velocity: event.velocity,
      rawPitch: stream.originalMidiNote,
    })),
    isHidden: false,
    isMuted: stream.muted,
    isSolo: false,
  }));
}

export function buildLegacySourceFile(soundStreams: SoundStream[]): SourceFile {
  return {
    id: LEGACY_STREAMS_SOURCE_ID,
    fileName: LEGACY_STREAMS_SOURCE_NAME,
    importedAt: new Date().toISOString(),
    laneCount: soundStreams.length,
  };
}
