/**
 * LoopGridCanvas.
 *
 * Step-sequencer grid for the Loop Editor.
 * Horizontal axis = time (steps), vertical axis = lanes.
 * Click to toggle events on/off.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import {
  type LoopConfig,
  type LoopLane,
  type LoopEvent,
  type LoopCellKey,
  loopCellKey,
  stepsPerBar,
  totalSteps,
} from '../../../types/loopEditor';
import { type LoopEditorAction } from '../../state/loopEditorReducer';

interface LoopGridCanvasProps {
  config: LoopConfig;
  lanes: LoopLane[];
  events: Map<LoopCellKey, LoopEvent>;
  playheadStep: number;
  isPlaying: boolean;
  dispatch: React.Dispatch<LoopEditorAction>;
  /** Highlighted step column for rudiment event stepping. */
  activeStepIndex?: number | null;
}

const MIN_CELL_WIDTH = 12;
const CELL_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const SUB_HEADER_HEIGHT = 20;

export function LoopGridCanvas({
  config,
  lanes,
  events,
  playheadStep,
  isPlaying,
  dispatch,
  activeStepIndex,
}: LoopGridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const steps = totalSteps(config);
  const spb = stepsPerBar(config.subdivision);
  const sortedLanes = [...lanes].sort((a, b) => a.orderIndex - b.orderIndex);

  // Measure container width to compute dynamic cell sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const cellWidth = containerWidth > 0
    ? Math.max(MIN_CELL_WIDTH, containerWidth / steps)
    : MIN_CELL_WIDTH;
  const gridWidth = cellWidth * steps;
  const gridHeight = sortedLanes.length * CELL_HEIGHT;

  // Update playhead position via ref (avoids re-render per frame)
  useEffect(() => {
    if (playheadRef.current) {
      const x = playheadStep * cellWidth;
      playheadRef.current.style.transform = `translateX(${x}px)`;
    }
  }, [playheadStep, cellWidth]);

  const handleCellClick = useCallback(
    (laneId: string, stepIndex: number) => {
      dispatch({ type: 'TOGGLE_CELL', payload: { laneId, stepIndex } });
    },
    [dispatch],
  );

  if (sortedLanes.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-pf-sm">
        Add lanes to get started
      </div>
    );
  }

  const renderGrid = () => (
    <div className="relative w-full">
      {/* Bar number headers */}
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]" style={{ height: HEADER_HEIGHT }}>
        <div className="flex" style={{ height: HEADER_HEIGHT }}>
          {Array.from({ length: config.barCount }, (_, bar) => (
            <div
              key={bar}
              className="text-center text-pf-sm font-medium text-[var(--text-secondary)] border-l border-[var(--border-default)] flex items-end justify-center pb-1"
              style={{ width: spb * cellWidth }}
            >
              {bar + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Subdivision labels */}
      <div className="sticky z-10 bg-[var(--bg-panel)]" style={{ height: SUB_HEADER_HEIGHT, top: HEADER_HEIGHT }}>
        <div className="flex" style={{ height: SUB_HEADER_HEIGHT }}>
          {Array.from({ length: steps }, (_, step) => {
            const posInBar = step % spb;
            const beatSize = Math.max(1, spb / 4);
            const isBeat = posInBar % beatSize === 0;
            const beatNum = Math.floor(posInBar / beatSize) + 1;
            return (
              <div
                key={step}
                className="text-center text-pf-xs text-[var(--text-secondary)] flex items-center justify-center"
                style={{ width: cellWidth }}
              >
                {isBeat ? beatNum : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid body */}
      <div className="relative" style={{ height: gridHeight }}>
        {/* Bar and beat grid lines (background) */}
        {Array.from({ length: steps }, (_, step) => {
          const posInBar = step % spb;
          const isBarLine = posInBar === 0;
          const beatSize = Math.max(1, spb / 4);
          const isBeatLine = posInBar % beatSize === 0;
          return (
            <div
              key={`line-${step}`}
              className={`absolute top-0 bottom-0 ${
                isBarLine
                  ? 'border-l border-[var(--border-strong)]'
                  : isBeatLine
                    ? 'border-l border-[var(--border-default)]'
                    : 'border-l border-[var(--border-subtle)]'
              }`}
              style={{ left: step * cellWidth }}
            />
          );
        })}

        {/* Lane rows */}
        {sortedLanes.map((lane, laneIndex) => (
          <div
            key={lane.id}
            className="flex absolute left-0 right-0"
            style={{
              top: laneIndex * CELL_HEIGHT,
              height: CELL_HEIGHT,
              opacity: lane.isMuted ? 0.3 : 1,
            }}
          >
            {/* Row border */}
            <div className="absolute inset-0 border-b border-[var(--border-subtle)]" />

            {/* Cells */}
            {Array.from({ length: steps }, (_, step) => {
              const key = loopCellKey(lane.id, step);
              const event = events.get(key);
              const hasEvent = !!event;

              return (
                <div
                  key={step}
                  className="relative cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ width: cellWidth, height: CELL_HEIGHT }}
                  onClick={() => handleCellClick(lane.id, step)}
                >
                  {hasEvent && (
                    <div
                      className="absolute inset-[2px] rounded-sm"
                      style={{
                        backgroundColor: lane.color,
                        opacity: 0.4 + ((event?.velocity ?? 100) / 127) * 0.6,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Active step highlight (rudiment event stepping) */}
        {activeStepIndex != null && activeStepIndex >= 0 && activeStepIndex < steps && (
          <div
            className="absolute top-0 bottom-0 bg-yellow-400/10 z-10 pointer-events-none"
            style={{
              left: activeStepIndex * cellWidth,
              width: cellWidth,
            }}
          />
        )}

        {/* Playhead */}
        {isPlaying && (
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 pointer-events-none"
            style={{ transform: `translateX(${playheadStep * cellWidth}px)` }}
          />
        )}
      </div>

      {/* Right edge bar line */}
      <div
        className="absolute border-l border-[var(--border-strong)]"
        style={{
          left: gridWidth,
          top: HEADER_HEIGHT,
          bottom: 0,
        }}
      />
    </div>
  );

  return (
    <div ref={containerRef} className="flex-1 min-w-0 overflow-hidden overflow-y-auto relative">
      {containerWidth > 0 && renderGrid()}
    </div>
  );
}
