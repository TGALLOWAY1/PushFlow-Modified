/**
 * PresetInspector.
 *
 * Right-panel inspector for a selected ComposerPreset or placed preset instance.
 * Shows:
 * - Grid preview with finger assignments
 * - Event pattern details
 * - Diagnostic cost breakdown (framed as model debugging, not prescriptive)
 */

import { useMemo, useState, useCallback } from 'react';
import { type ComposerPreset, type PresetPad, type PlacedPresetInstance, computeHandedness, isMirrorEligible } from '../../../types/composerPreset';
import { type FingerType } from '../../../types/fingerModel';
import { GRID_ROWS, GRID_COLS } from '../../../types/padGrid';
import { totalSteps } from '../../../types/loopEditor';
import { updateComposerPreset } from '../../persistence/composerPresetStorage';

interface PresetInspectorProps {
  /** The preset being inspected (from library selection or placed instance). */
  preset: ComposerPreset | null;
  /** The placed instance (if inspecting a placed instance). */
  instance?: PlacedPresetInstance | null;
  /** Callback to remove a placed instance. */
  onRemoveInstance?: (instanceId: string) => void;
  /** Callback to mirror a placed instance. */
  onMirrorInstance?: (instanceId: string) => void;
}

const FINGER_LABELS: Record<FingerType, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

const FINGER_ABBREV: Record<FingerType, string> = {
  thumb: '1',
  index: '2',
  middle: '3',
  ring: '4',
  pinky: '5',
};

const HAND_COLORS = {
  left: '#0088FF',
  right: '#FF4400',
} as const;

export function PresetInspector({ preset, instance, onRemoveInstance, onMirrorInstance }: PresetInspectorProps) {
  if (!preset) return null;

  const pads = instance?.pads ?? preset.pads;
  const config = instance?.config ?? preset.config;
  const lanes = instance?.lanes ?? preset.lanes;
  const events = instance?.events ?? preset.events;
  const steps = totalSteps(config);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-200 truncate flex-1">
          {instance ? instance.presetName : preset.name}
        </span>
        {instance && (
          <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
            Placed
          </span>
        )}
      </div>

      {/* Grid Preview (larger) */}
      <div className="bg-gray-800/30 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1.5">Pad Layout + Finger Assignment</div>
        <InspectorGridPreview
          pads={pads}
          boundingBox={instance?.boundingBox ?? preset.boundingBox}
          anchorRow={instance?.anchorRow}
          anchorCol={instance?.anchorCol}
        />
      </div>

      {/* Finger Assignment Table */}
      <div className="bg-gray-800/30 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1.5">Finger Assignments</div>
        <div className="space-y-0.5">
          {pads.map((pad, i) => {
            const lane = lanes.find(l => l.id === pad.laneId);
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lane?.color ?? '#888' }}
                />
                <span className="text-gray-400 truncate flex-1">
                  {lane?.name ?? pad.laneId}
                </span>
                <span style={{ color: HAND_COLORS[pad.hand] }}>
                  {pad.hand === 'left' ? 'L' : 'R'}{FINGER_ABBREV[pad.finger]}
                </span>
                <span className="text-gray-600">
                  {FINGER_LABELS[pad.finger]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Summary */}
      <div className="bg-gray-800/30 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1.5">Event Pattern</div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span>{events.length} events</span>
          <span>{config.barCount} bars</span>
          <span>{config.subdivision} grid</span>
          <span>{config.bpm} BPM</span>
        </div>
        {/* Mini timeline */}
        <InspectorTimeline events={events} steps={steps} lanes={lanes} />
      </div>

      {/* Diagnostic Metrics */}
      <div className="bg-gray-800/30 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">Metric Breakdown</div>
        <div className="text-[10px] text-gray-600 mb-2 italic">
          These metrics help validate the playability model. If a natural pattern scores
          poorly, the model may need recalibration.
        </div>
        <DiagnosticMetrics pads={pads} />
      </div>

      {/* Tags (library presets only) */}
      {!instance && (
        <div className="bg-gray-800/30 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1.5">Tags</div>
          <TagEditor presetId={preset.id} tags={preset.tags} />
        </div>
      )}

      {/* Instance actions */}
      {instance && (
        <div className="space-y-1.5">
          {onMirrorInstance && isMirrorEligible(computeHandedness(instance.pads)) && (
            <button
              className="w-full px-3 py-1.5 text-xs rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
              onClick={() => onMirrorInstance(instance.id)}
            >
              Mirror (flip hand){instance.isMirrored ? ' — currently mirrored' : ''}
            </button>
          )}
          {onRemoveInstance && (
            <button
              className="w-full px-3 py-1.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              onClick={() => onRemoveInstance(instance.id)}
            >
              Remove from workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inspector Grid Preview (larger than card preview)
// ============================================================================

function InspectorGridPreview({
  pads,
  boundingBox,
  anchorRow,
  anchorCol,
}: {
  pads: PresetPad[];
  boundingBox: { rows: number; cols: number };
  anchorRow?: number;
  anchorCol?: number;
}) {
  const cellSize = 12;
  const gap = 2;
  const showFullGrid = anchorRow !== undefined && anchorCol !== undefined;
  const displayRows = showFullGrid ? GRID_ROWS : Math.min(boundingBox.rows, GRID_ROWS);
  const displayCols = showFullGrid ? GRID_COLS : Math.min(boundingBox.cols, GRID_COLS);
  const width = displayCols * (cellSize + gap) - gap;
  const height = displayRows * (cellSize + gap) - gap;

  const padMap = useMemo(() => {
    const map = new Map<string, PresetPad>();
    for (const pad of pads) {
      const r = showFullGrid
        ? (anchorRow ?? 0) + pad.position.rowOffset
        : pad.position.rowOffset;
      const c = showFullGrid
        ? (anchorCol ?? 0) + pad.position.colOffset
        : pad.position.colOffset;
      map.set(`${r},${c}`, pad);
    }
    return map;
  }, [pads, showFullGrid, anchorRow, anchorCol]);

  return (
    <div className="flex justify-center">
      <svg width={width} height={height}>
        {Array.from({ length: displayRows }, (_, r) =>
          Array.from({ length: displayCols }, (_, c) => {
            const visualRow = displayRows - 1 - r;
            const pad = padMap.get(`${r},${c}`);
            const x = c * (cellSize + gap);
            const y = visualRow * (cellSize + gap);

            return (
              <g key={`${r},${c}`}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={pad ? (pad.hand === 'left' ? '#0088FF' : '#FF4400') : '#222'}
                  opacity={pad ? 0.7 : 0.1}
                />
                {pad && (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fill="white"
                    opacity={0.9}
                  >
                    {FINGER_ABBREV[pad.finger]}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Inspector Timeline
// ============================================================================

function InspectorTimeline({
  events,
  steps,
  lanes,
}: {
  events: ComposerPreset['events'];
  steps: number;
  lanes: ComposerPreset['lanes'];
}) {
  const width = 200;
  const laneHeight = 4;
  const height = Math.max(12, lanes.length * (laneHeight + 1));

  const laneIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    lanes.forEach((lane, i) => map.set(lane.id, i));
    return map;
  }, [lanes]);

  if (events.length === 0) return null;

  return (
    <div className="flex justify-center mt-1.5">
      <svg width={width} height={height} className="opacity-70">
        {events.map(([, event], i) => {
          const laneIdx = laneIndexMap.get(event.laneId) ?? 0;
          const x = (event.stepIndex / steps) * width;
          const y = laneIdx * (laneHeight + 1);
          const lane = lanes.find(l => l.id === event.laneId);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(1, width / steps - 0.5)}
              height={laneHeight}
              fill={lane?.color ?? '#888'}
              rx={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// Diagnostic Metrics (model debugging framing)
// ============================================================================

function DiagnosticMetrics({ pads }: { pads: PresetPad[] }) {
  // Compute simple spatial metrics from pad positions
  const metrics = useMemo(() => {
    if (pads.length === 0) return null;

    // Hand balance
    const leftCount = pads.filter(p => p.hand === 'left').length;
    const rightCount = pads.filter(p => p.hand === 'right').length;
    const total = pads.length;
    const balance = total > 0 ? leftCount / total : 0.5;

    // Compactness (average pairwise distance)
    let totalDist = 0;
    let pairCount = 0;
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const dr = pads[i].position.rowOffset - pads[j].position.rowOffset;
        const dc = pads[i].position.colOffset - pads[j].position.colOffset;
        totalDist += Math.sqrt(dr * dr + dc * dc);
        pairCount++;
      }
    }
    const avgDist = pairCount > 0 ? totalDist / pairCount : 0;

    // Finger variety
    const fingers = new Set(pads.map(p => p.finger));

    return {
      handBalance: balance,
      leftCount,
      rightCount,
      avgPairwiseDistance: avgDist,
      fingerVariety: fingers.size,
      totalPads: total,
    };
  }, [pads]);

  if (!metrics) return <div className="text-[10px] text-gray-600">No pad data</div>;

  const items = [
    {
      label: 'Hand Balance',
      value: `${metrics.leftCount}L / ${metrics.rightCount}R`,
      bar: metrics.handBalance,
      description: 'Distribution of pads between hands',
    },
    {
      label: 'Compactness',
      value: `${metrics.avgPairwiseDistance.toFixed(1)} avg dist`,
      bar: Math.min(1, 1 - metrics.avgPairwiseDistance / 8),
      description: 'How close pads are to each other (lower distance = more compact)',
    },
    {
      label: 'Finger Variety',
      value: `${metrics.fingerVariety} / 5 fingers`,
      bar: metrics.fingerVariety / 5,
      description: 'Number of distinct fingers used',
    },
  ];

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-gray-400">{item.label}</span>
            <span className="text-[10px] text-gray-500">{item.value}</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden" title={item.description}>
            <div
              className="h-full rounded-full bg-gray-500 transition-all"
              style={{ width: `${Math.max(5, item.bar * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Tag Editor
// ============================================================================

function TagEditor({ presetId, tags }: { presetId: string; tags: string[] }) {
  const [inputValue, setInputValue] = useState('');
  const [currentTags, setCurrentTags] = useState(tags);

  const persistTags = useCallback((newTags: string[]) => {
    setCurrentTags(newTags);
    updateComposerPreset(presetId, { tags: newTags });
    window.dispatchEvent(new Event('composer-presets-changed'));
  }, [presetId]);

  const handleAddTag = useCallback(() => {
    const tag = inputValue.trim().toLowerCase();
    if (!tag || currentTags.includes(tag)) {
      setInputValue('');
      return;
    }
    persistTags([...currentTags, tag]);
    setInputValue('');
  }, [inputValue, currentTags, persistTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    persistTags(currentTags.filter(t => t !== tag));
  }, [currentTags, persistTags]);

  return (
    <div>
      {/* Tag pills */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {currentTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-gray-700/50 text-gray-300"
            >
              {tag}
              <button
                className="text-gray-500 hover:text-red-400 ml-0.5"
                onClick={() => handleRemoveTag(tag)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Add tag input */}
      <input
        type="text"
        placeholder="Add tag..."
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleAddTag();
        }}
        className="w-full px-2 py-1 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder-gray-600"
      />
    </div>
  );
}
