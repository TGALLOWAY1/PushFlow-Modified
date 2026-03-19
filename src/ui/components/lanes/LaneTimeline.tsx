/**
 * LaneTimeline.
 *
 * Synchronized horizontal timeline showing event blocks for each lane.
 * Each lane gets a horizontal track. Events are rendered as colored blocks.
 */

import { useMemo, useRef, useCallback } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type PerformanceLane, countTimeSlices } from '../../../types/performanceLane';

interface LaneTimelineProps {
  zoom: number; // pixels per second
  scrollLeft: number;
  onScrollLeft: (x: number) => void;
  selectedLaneIds: Set<string>;
  onSelectLane: (id: string | null, multiSelect?: boolean) => void;
  searchQuery: string;
  showInactive: boolean;
  selectedEventTime?: number | null;
  onSelectEventTime?: (time: number) => void;
  onVerticalScroll?: (scrollTop: number) => void;
}

const TRACK_HEIGHT = 32;
const GROUP_HEADER_HEIGHT = 28;
const MIN_BLOCK_WIDTH = 2;

export function LaneTimeline({
  zoom,
  scrollLeft,
  onScrollLeft,
  selectedLaneIds,
  onSelectLane,
  searchQuery,
  showInactive,
  selectedEventTime,
  onSelectEventTime,
  onVerticalScroll,
}: LaneTimelineProps) {
  const { state } = useProject();
  const containerRef = useRef<HTMLDivElement>(null);

  // Build ordered list of visible tracks (respecting groups)
  const tracks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filteredLanes = state.performanceLanes.filter(l => {
      if (!showInactive && l.isHidden) return false;
      if (query && !l.name.toLowerCase().includes(query)) return false;
      return true;
    });

    const sortedGroups = [...state.laneGroups].sort((a, b) => a.orderIndex - b.orderIndex);
    const items: Array<
      | { type: 'group'; group: typeof state.laneGroups[0]; totalEvents: number }
      | { type: 'lane'; lane: PerformanceLane }
    > = [];

    for (const group of sortedGroups) {
      const groupLanes = filteredLanes
        .filter(l => l.groupId === group.groupId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (groupLanes.length > 0) {
        items.push({
          type: 'group',
          group,
          totalEvents: countTimeSlices(groupLanes),
        });
        if (!group.isCollapsed) {
          for (const lane of groupLanes) {
            items.push({ type: 'lane', lane });
          }
        }
      }
    }

    // Ungrouped
    const ungrouped = filteredLanes
      .filter(l => l.groupId === null)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    for (const lane of ungrouped) {
      items.push({ type: 'lane', lane });
    }

    return items;
  }, [state.performanceLanes, state.laneGroups, searchQuery, showInactive]);

  // Compute time range
  const { minTime, maxTime, totalDuration } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const lane of state.performanceLanes) {
      for (const e of lane.events) {
        if (e.startTime < min) min = e.startTime;
        const end = e.startTime + e.duration;
        if (end > max) max = end;
      }
    }
    if (min === Infinity) { min = 0; max = 10; }
    return { minTime: min, maxTime: max, totalDuration: Math.max(max - min, 1) };
  }, [state.performanceLanes]);

  const timelineWidth = totalDuration * zoom + 100; // extra padding
  const totalHeight = tracks.reduce((h, item) =>
    h + (item.type === 'group' ? GROUP_HEADER_HEIGHT : TRACK_HEIGHT), 0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement;
    onScrollLeft(el.scrollLeft);
    onVerticalScroll?.(el.scrollTop);
  }, [onScrollLeft, onVerticalScroll]);

  // Musical time markers (bars and beats)
  const tempo = state.tempo || 120;
  const beatDuration = 60 / tempo; // seconds per quarter note

  const timeMarkers = useMemo(() => {
    const markers: Array<{ time: number; x: number; label: string; isMajor: boolean }> = [];
    const pixelsPerBeat = beatDuration * zoom;

    // Decide subdivision: show bars only, bars+beats, or bars+beats+subdivisions
    let stepBeats: number;
    if (pixelsPerBeat < 15) stepBeats = 4;        // bar lines only
    else if (pixelsPerBeat < 40) stepBeats = 2;    // half notes
    else stepBeats = 1;                            // every quarter note

    const stepSeconds = stepBeats * beatDuration;
    // Start from the bar/beat boundary at or before minTime
    const startBeat = Math.floor(minTime / beatDuration);
    const alignedStart = Math.floor(startBeat / stepBeats) * stepBeats * beatDuration;

    for (let t = alignedStart; t <= maxTime + stepSeconds; t += stepSeconds) {
      const totalBeats = Math.round(t / beatDuration);
      const bar = Math.floor(totalBeats / 4) + 1;
      const beat = (totalBeats % 4) + 1;
      const isMajor = beat === 1;
      const label = isMajor ? `${bar}` : `${bar}.${beat}`;

      markers.push({
        time: t,
        x: (t - minTime) * zoom,
        label,
        isMajor,
      });
    }
    return markers;
  }, [minTime, maxTime, zoom, beatDuration]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Time axis header */}
      <div className="relative h-6 border-b border-gray-700 bg-gray-900/50 overflow-hidden flex-shrink-0">
        <div
          className="relative h-full"
          style={{ width: timelineWidth, transform: `translateX(-${scrollLeft}px)` }}
        >
          {timeMarkers.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 h-full flex flex-col justify-end"
              style={{ left: m.x + 40 }}
            >
              <span className={`text-[9px] px-0.5 ${m.isMajor ? 'text-gray-400 font-medium' : 'text-gray-600'}`}>
                {m.label}
              </span>
              <div className={`w-px ${m.isMajor ? 'h-2 bg-gray-600' : 'h-1 bg-gray-700'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable tracks area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div className="relative" style={{ width: timelineWidth, minHeight: totalHeight }}>
          {/* Grid lines */}
          {timeMarkers.map((m, i) => (
            <div
              key={i}
              className={`absolute top-0 bottom-0 w-px ${m.isMajor ? 'bg-gray-700/60' : 'bg-gray-800/30'}`}
              style={{ left: m.x + 40, height: totalHeight }}
            />
          ))}

          {/* Tracks */}
          {(() => {
            let yOffset = 0;
            return tracks.map((item, i) => {
              const currentY = yOffset;

              if (item.type === 'group') {
                yOffset += GROUP_HEADER_HEIGHT;
                return (
                  <div
                    key={`grp-${item.group.groupId}`}
                    className="absolute left-0 right-0 flex items-center px-2 text-[10px] text-gray-500 bg-gray-800/30 border-b border-gray-800/50"
                    style={{ top: currentY, height: GROUP_HEADER_HEIGHT }}
                  />
                );
              }

              yOffset += TRACK_HEIGHT;
              const { lane } = item;
              const isSelected = selectedLaneIds.has(lane.id);

              return (
                <div
                  key={lane.id}
                  className={`absolute left-0 right-0 border-b border-gray-800/30 transition-colors cursor-pointer
                    ${isSelected ? 'bg-blue-500/5' : i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                  style={{ top: currentY, height: TRACK_HEIGHT }}
                  onClick={e => onSelectLane(lane.id, e.metaKey || e.ctrlKey)}
                >
                  {/* Event blocks */}
                  {lane.events.map((event, ei) => {
                    const x = (event.startTime - minTime) * zoom + 40;
                    const w = Math.max(event.duration * zoom, MIN_BLOCK_WIDTH);
                    const velocityOpacity = (0.4 + (event.velocity / 127) * 0.6) * (lane.isMuted ? 0.3 : 1);
                    const isSelectedEvent = selectedEventTime === event.startTime;

                    return (
                      <div
                        key={event.eventId || ei}
                        className={`absolute rounded-sm transition-all ${isSelectedEvent ? 'ring-2 ring-yellow-400/80 z-10' : 'hover:brightness-110'}`}
                        style={{
                          left: x,
                          top: 4,
                          width: w,
                          height: TRACK_HEIGHT - 8,
                          backgroundColor: lane.color,
                          opacity: velocityOpacity,
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          onSelectLane(lane.id, e.metaKey || e.ctrlKey);
                          onSelectEventTime?.(event.startTime);
                        }}
                      />
                    );
                  })}
                </div>
              );
            });
          })()}

          {/* Start marker */}
          <div
            className="absolute top-0 w-0.5 bg-gray-400 pointer-events-none"
            style={{ left: 40, height: totalHeight }}
          />

          {/* Event cursor (arrow key navigation) */}
          {selectedEventTime !== null && selectedEventTime !== undefined && (
            <div
              className="absolute top-0 w-0.5 bg-yellow-400 pointer-events-none z-20"
              style={{
                left: (selectedEventTime - minTime) * zoom + 40,
                height: totalHeight,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
