/**
 * EventCostChart.
 *
 * Stacked bar chart showing per-event cost breakdown.
 * X-axis: Performance Event index.
 * Stack segments: cost factors (stretch, movement, speed, repetition).
 *
 * Supports:
 * - Filtering cost categories on/off
 * - Hover inspection per event
 * - Enlarge to modal view
 */

import { useState, useMemo } from 'react';
import { type FingerAssignment } from '../../../types/executionPlan';
import { type V1CostBreakdown } from '../../../types/diagnostics';

interface EventCostChartProps {
  fingerAssignments: FingerAssignment[];
  /** Which candidate is being shown (for display context) */
  candidateLabel?: string;
  /** Currently selected event index (highlights the corresponding bar) */
  selectedEventIndex?: number | null;
  /** Callback when a bar is clicked */
  onEventClick?: (eventIndex: number | null) => void;
}

interface CostLayer {
  key: string;
  label: string;
  color: string;
  accessor: (b: V1CostBreakdown) => number;
}

const COST_LAYERS: CostLayer[] = [
  { key: 'stretch', label: 'Stretch', color: '#a855f7', accessor: b => b.fingerPreference + b.handShapeDeviation },
  { key: 'movement', label: 'Movement', color: '#f97316', accessor: b => b.transitionCost },
  { key: 'speed', label: 'Speed', color: '#22c55e', accessor: b => b.constraintPenalty },
  { key: 'repetition', label: 'Repetition', color: '#3b82f6', accessor: b => b.handBalance },
];

interface EventBar {
  eventIndex: number;
  startTime: number;
  segments: Array<{ key: string; value: number; color: string; label: string }>;
  total: number;
}

export function EventCostChart({ fingerAssignments, candidateLabel, selectedEventIndex, onEventClick }: EventCostChartProps) {
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(
    new Set(COST_LAYERS.map(l => l.key))
  );
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  const toggleLayer = (key: string) => {
    setEnabledLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group assignments by startTime to get per-event cost
  const eventBars: EventBar[] = useMemo(() => {
    // Group by startTime (each unique startTime = one Performance Event)
    const timeMap = new Map<number, FingerAssignment[]>();
    for (const a of fingerAssignments) {
      const group = timeMap.get(a.startTime);
      if (group) group.push(a);
      else timeMap.set(a.startTime, [a]);
    }

    const sortedTimes = [...timeMap.keys()].sort((a, b) => a - b);
    return sortedTimes.map((time, idx) => {
      const assignments = timeMap.get(time)!;
      // Aggregate cost breakdown across all notes in this event
      const aggregated: V1CostBreakdown = {
        fingerPreference: 0,
        handShapeDeviation: 0,
        transitionCost: 0,
        handBalance: 0,
        constraintPenalty: 0,
        total: 0,
      };
      for (const a of assignments) {
        if (a.costBreakdown) {
          aggregated.fingerPreference += a.costBreakdown.fingerPreference;
          aggregated.handShapeDeviation += a.costBreakdown.handShapeDeviation;
          aggregated.transitionCost += a.costBreakdown.transitionCost;
          aggregated.handBalance += a.costBreakdown.handBalance;
          aggregated.constraintPenalty += a.costBreakdown.constraintPenalty;
          aggregated.total += a.costBreakdown.total;
        } else {
          // Fallback: use raw cost split equally
          aggregated.transitionCost += a.cost;
          aggregated.total += a.cost;
        }
      }

      const segments = COST_LAYERS
        .filter(l => enabledLayers.has(l.key))
        .map(l => ({
          key: l.key,
          value: l.accessor(aggregated),
          color: l.color,
          label: l.label,
        }))
        .filter(s => s.value > 0);

      return {
        eventIndex: idx,
        startTime: time,
        segments,
        total: segments.reduce((sum, s) => sum + s.value, 0),
      };
    });
  }, [fingerAssignments, enabledLayers]);

  const maxTotal = useMemo(() => Math.max(...eventBars.map(b => b.total), 0.1), [eventBars]);

  const chartContent = (height: number) => {
    if (eventBars.length === 0) {
      return (
        <div className="flex items-center justify-center text-xs text-gray-600" style={{ height }}>
          No event data available
        </div>
      );
    }

    const barWidth = Math.max(2, Math.min(12, (height * 2.5) / eventBars.length));

    return (
      <div className="relative" style={{ height }}>
        {/* Y-axis guide lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <div key={pct} className="border-t border-gray-800/50 w-full" />
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-px overflow-hidden">
          {eventBars.map((bar, idx) => {
            const barHeight = bar.total > 0 ? (bar.total / maxTotal) * height : 0;
            const isHovered = hoveredEvent === idx;
            const isSelected = selectedEventIndex !== undefined && selectedEventIndex !== null && idx === selectedEventIndex;

            return (
              <div
                key={idx}
                className={`relative flex flex-col-reverse transition-opacity cursor-pointer ${
                  isSelected ? 'opacity-100' : isHovered ? 'opacity-100' : hoveredEvent !== null || (selectedEventIndex !== undefined && selectedEventIndex !== null) ? 'opacity-40' : 'opacity-90'
                }`}
                style={{
                  width: barWidth,
                  height: barHeight,
                  minWidth: barWidth,
                  outline: isSelected ? '2px solid #60a5fa' : undefined,
                  outlineOffset: '1px',
                  borderRadius: '2px',
                }}
                onMouseEnter={() => setHoveredEvent(idx)}
                onMouseLeave={() => setHoveredEvent(null)}
                onClick={() => onEventClick?.(isSelected ? null : idx)}
              >
                {bar.segments.map(seg => {
                  const segHeight = bar.total > 0 ? (seg.value / bar.total) * barHeight : 0;
                  return (
                    <div
                      key={seg.key}
                      className="w-full rounded-sm"
                      style={{
                        height: segHeight,
                        backgroundColor: seg.color,
                        opacity: isHovered ? 1 : 0.8,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {hoveredEvent !== null && eventBars[hoveredEvent] && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] z-10 pointer-events-none shadow-lg whitespace-nowrap">
            <div className="text-gray-300 font-medium mb-0.5">
              Event {hoveredEvent + 1} (t={eventBars[hoveredEvent].startTime.toFixed(3)}s)
            </div>
            {eventBars[hoveredEvent].segments.map(seg => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-gray-500">{seg.label}:</span>
                <span className="text-gray-300">{seg.value.toFixed(2)}</span>
              </div>
            ))}
            <div className="text-gray-500 border-t border-gray-800 mt-0.5 pt-0.5">
              Total: {eventBars[hoveredEvent].total.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
            Stacked Difficulty Charts
          </h4>
          <button
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={() => setEnlarged(true)}
          >
            Enlarge
          </button>
        </div>

        {candidateLabel && (
          <div className="text-[10px] text-gray-600">
            Showing: {candidateLabel}
          </div>
        )}

        {/* Filter toggles */}
        <div className="flex flex-wrap gap-1.5">
          {COST_LAYERS.map(layer => {
            const enabled = enabledLayers.has(layer.key);
            return (
              <button
                key={layer.key}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors border ${
                  enabled
                    ? 'border-gray-600 text-gray-300'
                    : 'border-gray-800 text-gray-600'
                }`}
                onClick={() => toggleLayer(layer.key)}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: enabled ? layer.color : '#374151' }}
                />
                {layer.label}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        {chartContent(120)}

        {/* X-axis labels */}
        {eventBars.length > 0 && (
          <div className="flex justify-between text-[9px] text-gray-600 px-px">
            <span>0</span>
            <span>{Math.floor(eventBars.length / 2)}</span>
            <span>{eventBars.length - 1}</span>
          </div>
        )}
      </div>

      {/* Enlarged modal */}
      {enlarged && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => setEnlarged(false)} />
          <div className="fixed inset-8 z-[61] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-200">
                Per-Event Difficulty Breakdown
                {candidateLabel && <span className="text-gray-500 ml-2">({candidateLabel})</span>}
              </h3>
              <button
                className="text-gray-500 hover:text-gray-300 text-lg"
                onClick={() => setEnlarged(false)}
              >
                &times;
              </button>
            </div>
            <div className="flex-1 p-5">
              {/* Filter toggles */}
              <div className="flex flex-wrap gap-2 mb-4">
                {COST_LAYERS.map(layer => {
                  const enabled = enabledLayers.has(layer.key);
                  return (
                    <button
                      key={layer.key}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors border ${
                        enabled
                          ? 'border-gray-600 text-gray-300'
                          : 'border-gray-800 text-gray-600'
                      }`}
                      onClick={() => toggleLayer(layer.key)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: enabled ? layer.color : '#374151' }}
                      />
                      {layer.label}
                    </button>
                  );
                })}
              </div>
              {chartContent(400)}
              {eventBars.length > 0 && (
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-px">
                  <span>Event 0</span>
                  <span>Event {Math.floor(eventBars.length / 2)}</span>
                  <span>Event {eventBars.length - 1}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
