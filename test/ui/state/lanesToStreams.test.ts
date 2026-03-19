/**
 * Lane-to-Stream Conversion Tests.
 */

import { describe, it, expect } from 'vitest';
import { buildSoundStreamsFromLanes } from '../../../src/ui/state/lanesToStreams';
import { type PerformanceLane } from '../../../src/types/performanceLane';

function makeLane(overrides: Partial<PerformanceLane> = {}): PerformanceLane {
  return {
    id: 'lane-1',
    name: 'Kick',
    sourceFileId: 'src-1',
    sourceFileName: 'drums.mid',
    groupId: null,
    orderIndex: 0,
    color: '#ef4444',
    colorMode: 'inherited',
    events: [
      { eventId: 'e1', laneId: 'lane-1', startTime: 0, duration: 0.1, velocity: 100, rawPitch: 36 },
      { eventId: 'e2', laneId: 'lane-1', startTime: 0.5, duration: 0.1, velocity: 80, rawPitch: 36 },
    ],
    isHidden: false,
    isMuted: false,
    isSolo: false,
    ...overrides,
  };
}

describe('buildSoundStreamsFromLanes', () => {

  it('converts lanes to sound streams', () => {
    const lanes = [makeLane()];
    const streams = buildSoundStreamsFromLanes(lanes);

    expect(streams).toHaveLength(1);
    expect(streams[0].id).toBe('lane-1');
    expect(streams[0].name).toBe('Kick');
    expect(streams[0].color).toBe('#ef4444');
    expect(streams[0].originalMidiNote).toBe(36);
    expect(streams[0].events).toHaveLength(2);
    expect(streams[0].events[0].eventKey).toBe('e1');
    expect(streams[0].muted).toBe(false);
  });

  it('excludes muted lanes', () => {
    const lanes = [
      makeLane({ id: 'a', isMuted: false }),
      makeLane({ id: 'b', isMuted: true }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(1);
    expect(streams[0].id).toBe('a');
  });

  it('excludes hidden lanes', () => {
    const lanes = [
      makeLane({ id: 'a', isHidden: false }),
      makeLane({ id: 'b', isHidden: true }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(1);
    expect(streams[0].id).toBe('a');
  });

  it('respects solo mode - only solo lanes when any is solo', () => {
    const lanes = [
      makeLane({ id: 'a', isSolo: true }),
      makeLane({ id: 'b', isSolo: false }),
      makeLane({ id: 'c', isSolo: true }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(2);
    expect(streams.map(s => s.id)).toEqual(['a', 'c']);
  });

  it('solo + muted = excluded', () => {
    const lanes = [
      makeLane({ id: 'a', isSolo: true, isMuted: true }),
      makeLane({ id: 'b', isSolo: true, isMuted: false }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(1);
    expect(streams[0].id).toBe('b');
  });

  it('handles empty lanes', () => {
    const streams = buildSoundStreamsFromLanes([]);
    expect(streams).toHaveLength(0);
  });

  it('handles lane with no events', () => {
    const lanes = [makeLane({ events: [] })];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(1);
    expect(streams[0].originalMidiNote).toBe(0); // fallback
    expect(streams[0].events).toHaveLength(0);
  });
});
