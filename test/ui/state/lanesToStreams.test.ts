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
    // Included in the analysis: the key is absent, as a stored Sound has it.
    expect('excluded' in streams[0]).toBe(false);
  });

  // An excluded or hidden lane must still produce a stream. Dropping it deleted
  // the sound from the Sounds panel and the timeline, leaving no row to bring it
  // back from, and CLAUDE.md requires the timeline show all sound streams.

  it('keeps excluded lanes as streams, flagged excluded (S4.4)', () => {
    const lanes = [
      makeLane({ id: 'a' }),
      makeLane({ id: 'b', excluded: true }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(2);
    expect(streams.map(s => [s.id, !!s.excluded])).toEqual([['a', false], ['b', true]]);
  });

  it('keeps hidden lanes as streams, flagged excluded', () => {
    const lanes = [
      makeLane({ id: 'a', isHidden: false }),
      makeLane({ id: 'b', isHidden: true }),
    ];
    const streams = buildSoundStreamsFromLanes(lanes);
    expect(streams).toHaveLength(2);
    expect(streams.map(s => [s.id, !!s.excluded])).toEqual([['a', false], ['b', true]]);
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
