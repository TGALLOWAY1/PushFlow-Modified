/**
 * PresetCard.
 *
 * Displays a single ComposerPreset in the library panel.
 * Shows mini grid preview, timeline strip, hand indicator, and metadata.
 * Supports drag initiation for workspace placement.
 */

import { useMemo, type DragEvent } from 'react';
import { type ComposerPreset, type PresetPad } from '../../../types/composerPreset';
import { GRID_ROWS, GRID_COLS } from '../../../types/padGrid';
import { totalSteps } from '../../../types/loopEditor';

/** Drag data type identifier for ComposerPreset drag-and-drop. */
export const COMPOSER_PRESET_DRAG_TYPE = 'application/x-pushflow-composer-preset';

interface PresetCardProps {
  preset: ComposerPreset;
  isSelected?: boolean;
  isMirrored?: boolean;
  onSelect?: (presetId: string) => void;
  onDelete?: (presetId: string) => void;
  onDuplicate?: (presetId: string) => void;
  onRename?: (presetId: string) => void;
  onToggleMirror?: (presetId: string) => void;
  /** Notify parent when drag starts (for ghost preview). */
  onDragStartPreset?: (presetId: string, isMirrored: boolean) => void;
  /** Notify parent when drag ends. */
  onDragEndPreset?: () => void;
}

/** Hand indicator colors. */
const HAND_COLORS = {
  left: '#0088FF',
  right: '#FF4400',
  both: '#888888',
} as const;

const HAND_LABELS = {
  left: 'L',
  right: 'R',
  both: 'L+R',
} as const;

export function PresetCard({
  preset,
  isSelected = false,
  isMirrored = false,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
  onToggleMirror,
  onDragStartPreset,
  onDragEndPreset,
}: PresetCardProps) {
  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(COMPOSER_PRESET_DRAG_TYPE, JSON.stringify({
      presetId: preset.id,
      isMirrored,
    }));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStartPreset?.(preset.id, isMirrored);
  };

  const handleDragEnd = () => {
    onDragEndPreset?.();
  };

  return (
    <div
      className={`group relative px-3 py-2 rounded-lg border cursor-grab transition-colors ${
        isSelected
          ? 'bg-violet-900/30 border-violet-500/50'
          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect?.(preset.id)}
    >
      {/* Header: name + hand indicator */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-gray-200 truncate flex-1">
          {preset.name}
        </span>
        <span
          className="text-[10px] font-mono px-1 rounded"
          style={{
            color: HAND_COLORS[preset.handedness],
            backgroundColor: `${HAND_COLORS[preset.handedness]}15`,
          }}
        >
          {HAND_LABELS[preset.handedness]}
        </span>
        {preset.mirrorEligible && (
          <button
            className={`text-[10px] px-1 rounded transition-colors ${
              isMirrored
                ? 'bg-violet-600/30 text-violet-300'
                : 'bg-gray-700/50 text-gray-500 hover:text-gray-300'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMirror?.(preset.id);
            }}
            title="Mirror (flip hand)"
          >
            ⟷
          </button>
        )}
      </div>

      {/* Mini grid preview */}
      <MiniGridPreview pads={preset.pads} boundingBox={preset.boundingBox} />

      {/* Mini timeline strip */}
      <MiniTimelineStrip
        events={preset.events}
        config={preset.config}
        lanes={preset.lanes}
      />

      {/* Footer: metadata */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-gray-500">
          {preset.pads.length === 0 ? 'pattern only' : `${preset.pads.length} pads`} · {preset.events.length} events
        </span>
        <div className="flex-1" />
        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-1">
          {onDuplicate && (
            <button
              className="text-[10px] text-gray-500 hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); onDuplicate(preset.id); }}
              title="Duplicate"
            >
              dup
            </button>
          )}
          {onRename && (
            <button
              className="text-[10px] text-gray-500 hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); onRename(preset.id); }}
              title="Rename"
            >
              ren
            </button>
          )}
          {onDelete && (
            <button
              className="text-[10px] text-red-400/60 hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(preset.id); }}
              title="Delete"
            >
              del
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mini Grid Preview
// ============================================================================

function MiniGridPreview({
  pads,
  boundingBox,
}: {
  pads: PresetPad[];
  boundingBox: { rows: number; cols: number };
}) {
  const cellSize = 6;
  const gap = 1;
  const displayRows = Math.min(boundingBox.rows, GRID_ROWS);
  const displayCols = Math.min(boundingBox.cols, GRID_COLS);
  const width = displayCols * (cellSize + gap) - gap;
  const height = displayRows * (cellSize + gap) - gap;

  const padSet = useMemo(() => {
    const map = new Map<string, PresetPad>();
    for (const pad of pads) {
      map.set(`${pad.position.rowOffset},${pad.position.colOffset}`, pad);
    }
    return map;
  }, [pads]);

  return (
    <div className="flex justify-center mb-1">
      <svg width={width} height={height} className="opacity-80">
        {Array.from({ length: displayRows }, (_, r) =>
          Array.from({ length: displayCols }, (_, c) => {
            // Flip row so bottom-left = visual bottom-left
            const visualRow = displayRows - 1 - r;
            const pad = padSet.get(`${r},${c}`);
            const x = c * (cellSize + gap);
            const y = visualRow * (cellSize + gap);

            return (
              <rect
                key={`${r},${c}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={1}
                fill={pad ? (pad.hand === 'left' ? '#0088FF' : '#FF4400') : '#333'}
                opacity={pad ? 0.8 : 0.15}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Mini Timeline Strip
// ============================================================================

function MiniTimelineStrip({
  events,
  config,
  lanes,
}: {
  events: ComposerPreset['events'];
  config: ComposerPreset['config'];
  lanes: ComposerPreset['lanes'];
}) {
  const steps = totalSteps(config);
  const stripWidth = 120;
  const stripHeight = Math.max(8, lanes.length * 3);

  const laneIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    lanes.forEach((lane, i) => map.set(lane.id, i));
    return map;
  }, [lanes]);

  if (events.length === 0) return null;

  return (
    <div className="flex justify-center mb-1">
      <svg width={stripWidth} height={stripHeight} className="opacity-60">
        {events.map(([, event], i) => {
          const laneIdx = laneIndexMap.get(event.laneId) ?? 0;
          const x = (event.stepIndex / steps) * stripWidth;
          const y = (laneIdx / Math.max(lanes.length, 1)) * stripHeight;
          const lane = lanes.find(l => l.id === event.laneId);

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(1, stripWidth / steps)}
              height={Math.max(2, stripHeight / Math.max(lanes.length, 1) - 1)}
              fill={lane?.color ?? '#888'}
              rx={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
