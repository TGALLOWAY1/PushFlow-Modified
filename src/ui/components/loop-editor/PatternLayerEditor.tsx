/**
 * PatternLayerEditor.
 *
 * Inline editor for a single PatternLayer within the RecipeEditorModal.
 * Handles rhythm type switching, conditional parameter rendering,
 * surface selection, density, accent, and velocity controls.
 */

import { useCallback } from 'react';
import {
  type PatternLayer,
  type SurfaceRole,
  type RhythmSpec,
  type AccentProfile,
  type VariationType,
  ALL_SURFACE_ROLES,
  SURFACE_DEFAULTS,
} from '../../../types/patternRecipe';

// ============================================================================
// Props
// ============================================================================

interface PatternLayerEditorProps {
  layer: PatternLayer;
  onChange: (updated: PatternLayer) => void;
  onRemove: () => void;
  index: number;
}

// ============================================================================
// Constants
// ============================================================================

const RHYTHM_TYPES = ['euclidean', 'interval', 'grid', 'sticking'] as const;
const ACCENT_TYPES = ['flat', 'downbeat', 'offbeat', 'crescendo', 'decrescendo', 'pattern'] as const;

const RHYTHM_LABELS: Record<string, string> = {
  euclidean: 'Euclidean',
  interval: 'Interval',
  grid: 'Grid',
  sticking: 'Sticking',
};

const ACCENT_LABELS: Record<string, string> = {
  flat: 'Flat',
  downbeat: 'Downbeat',
  offbeat: 'Offbeat',
  crescendo: 'Crescendo',
  decrescendo: 'Decrescendo',
  pattern: 'Pattern',
};

// ============================================================================
// Component
// ============================================================================

export function PatternLayerEditor({
  layer,
  onChange,
  onRemove,
  index,
}: PatternLayerEditorProps) {
  // ---- Surface ----
  const handleSurfaceChange = useCallback((surface: SurfaceRole) => {
    onChange({ ...layer, surface });
  }, [layer, onChange]);

  // ---- Rhythm type change ----
  const handleRhythmTypeChange = useCallback((type: RhythmSpec['type']) => {
    let rhythm: RhythmSpec;
    switch (type) {
      case 'euclidean':
        rhythm = { type: 'euclidean', hits: 3, steps: 8, rotation: 0 };
        break;
      case 'interval':
        rhythm = { type: 'interval', interval: 4, offset: 0 };
        break;
      case 'grid':
        rhythm = { type: 'grid', pattern: [true, false, false, false, true, false, false, false] };
        break;
      case 'sticking':
        rhythm = { type: 'sticking', pattern: ['R', 'L'], side: 'R' };
        break;
    }
    onChange({ ...layer, rhythm });
  }, [layer, onChange]);

  // ---- Rhythm param updates ----
  const updateRhythm = useCallback((partial: Partial<RhythmSpec>) => {
    onChange({ ...layer, rhythm: { ...layer.rhythm, ...partial } as RhythmSpec });
  }, [layer, onChange]);

  // ---- Accent type change ----
  const handleAccentTypeChange = useCallback((type: AccentProfile['type']) => {
    let accent: AccentProfile;
    switch (type) {
      case 'flat':
        accent = { type: 'flat' };
        break;
      case 'downbeat':
        accent = { type: 'downbeat', accentVelocity: 110, ghostVelocity: 60 };
        break;
      case 'offbeat':
        accent = { type: 'offbeat', accentVelocity: 100, ghostVelocity: 60 };
        break;
      case 'crescendo':
        accent = { type: 'crescendo', startVelocity: 40, endVelocity: 120 };
        break;
      case 'decrescendo':
        accent = { type: 'decrescendo', startVelocity: 120, endVelocity: 40 };
        break;
      case 'pattern':
        accent = { type: 'pattern', velocities: [110, 70] };
        break;
    }
    onChange({ ...layer, accent });
  }, [layer, onChange]);

  // ---- Density ----
  const handleDensityChange = useCallback((density: number) => {
    onChange({ ...layer, density });
  }, [layer, onChange]);

  // ---- Velocity range ----
  const handleVelocityChange = useCallback((field: 'min' | 'max', value: number) => {
    onChange({ ...layer, velocity: { ...layer.velocity, [field]: Math.max(0, Math.min(127, value)) } });
  }, [layer, onChange]);

  const surfaceInfo = SURFACE_DEFAULTS[layer.surface];

  return (
    <div className="p-2 rounded-lg bg-gray-800/40 border border-gray-700 space-y-2">
      {/* Header: index + surface + remove */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 font-mono w-4">{index + 1}</span>

        <select
          className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200"
          value={layer.surface}
          onChange={e => handleSurfaceChange(e.target.value as SurfaceRole)}
        >
          <optgroup label="Percussion">
            {ALL_SURFACE_ROLES.filter(r => SURFACE_DEFAULTS[r].category === 'percussion').map(r => (
              <option key={r} value={r}>{SURFACE_DEFAULTS[r].name}</option>
            ))}
          </optgroup>
          <optgroup label="Bass">
            {ALL_SURFACE_ROLES.filter(r => SURFACE_DEFAULTS[r].category === 'bass').map(r => (
              <option key={r} value={r}>{SURFACE_DEFAULTS[r].name}</option>
            ))}
          </optgroup>
          <optgroup label="Melodic">
            {ALL_SURFACE_ROLES.filter(r => SURFACE_DEFAULTS[r].category === 'melodic').map(r => (
              <option key={r} value={r}>{SURFACE_DEFAULTS[r].name}</option>
            ))}
          </optgroup>
          <optgroup label="Textural">
            {ALL_SURFACE_ROLES.filter(r => SURFACE_DEFAULTS[r].category === 'textural').map(r => (
              <option key={r} value={r}>{SURFACE_DEFAULTS[r].name}</option>
            ))}
          </optgroup>
          <optgroup label="Other">
            <option value="custom">Custom</option>
          </optgroup>
        </select>

        <span className="text-[9px] text-gray-600">{surfaceInfo.category}</span>

        <button
          className="px-1.5 py-0.5 text-[10px] rounded text-red-400/60 hover:text-red-400 hover:bg-red-600/10 transition-colors"
          onClick={onRemove}
          title="Remove layer"
        >
          ✕
        </button>
      </div>

      {/* Rhythm section */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-12">Rhythm</span>
          <div className="flex bg-gray-900 rounded p-0.5 border border-gray-700">
            {RHYTHM_TYPES.map(type => (
              <button
                key={type}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  layer.rhythm.type === type
                    ? 'bg-gray-600 text-gray-200 font-medium'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => handleRhythmTypeChange(type)}
              >
                {RHYTHM_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Rhythm-specific params */}
        <div className="pl-14 flex items-center gap-2 flex-wrap">
          {layer.rhythm.type === 'euclidean' && (
            <>
              <NumInput label="Hits" value={layer.rhythm.hits} min={0} max={32}
                onChange={v => updateRhythm({ hits: v })} />
              <NumInput label="Steps" value={layer.rhythm.steps} min={1} max={32}
                onChange={v => updateRhythm({ steps: v })} />
              <NumInput label="Rot" value={layer.rhythm.rotation} min={0} max={31}
                onChange={v => updateRhythm({ rotation: v })} />
            </>
          )}
          {layer.rhythm.type === 'interval' && (
            <>
              <NumInput label="Every" value={layer.rhythm.interval} min={1} max={32}
                onChange={v => updateRhythm({ interval: v })} />
              <NumInput label="Offset" value={layer.rhythm.offset} min={0} max={31}
                onChange={v => updateRhythm({ offset: v })} />
            </>
          )}
          {layer.rhythm.type === 'grid' && (
            <GridEditor
              pattern={layer.rhythm.pattern}
              onChange={pattern => onChange({ ...layer, rhythm: { type: 'grid', pattern } })}
            />
          )}
          {layer.rhythm.type === 'sticking' && (
            <>
              <StickingInput
                pattern={layer.rhythm.pattern}
                onChange={pattern => onChange({ ...layer, rhythm: { ...layer.rhythm, pattern } as RhythmSpec })}
              />
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500">Side</span>
                <select
                  className="px-1 py-0.5 text-[10px] bg-gray-900 border border-gray-700 rounded text-gray-200"
                  value={layer.rhythm.side}
                  onChange={e => updateRhythm({ side: e.target.value as 'R' | 'L' })}
                >
                  <option value="R">R</option>
                  <option value="L">L</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Accent + Density + Velocity row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Accent */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Accent</span>
          <select
            className="px-1.5 py-0.5 text-[10px] bg-gray-900 border border-gray-700 rounded text-gray-200"
            value={layer.accent.type}
            onChange={e => handleAccentTypeChange(e.target.value as AccentProfile['type'])}
          >
            {ACCENT_TYPES.map(type => (
              <option key={type} value={type}>{ACCENT_LABELS[type]}</option>
            ))}
          </select>
        </div>

        {/* Density */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Density</span>
          <input
            type="range"
            className="w-16 h-3 accent-emerald-500"
            min={0}
            max={100}
            value={layer.density}
            onChange={e => handleDensityChange(parseInt(e.target.value, 10))}
          />
          <span className="text-[10px] text-gray-400 w-6 text-right">{layer.density}</span>
        </div>

        {/* Velocity range */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Vel</span>
          <NumInput label="" value={layer.velocity.min} min={0} max={127}
            onChange={v => handleVelocityChange('min', v)} width="w-10" />
          <span className="text-[10px] text-gray-600">-</span>
          <NumInput label="" value={layer.velocity.max} min={0} max={127}
            onChange={v => handleVelocityChange('max', v)} width="w-10" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function NumInput({
  label,
  value,
  min,
  max,
  onChange,
  width = 'w-12',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-[10px] text-gray-500">{label}</span>}
      <input
        type="number"
        className={`${width} px-1 py-0.5 text-[10px] bg-gray-900 border border-gray-700 rounded text-gray-200 text-center`}
        value={value}
        min={min}
        max={max}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </div>
  );
}

function GridEditor({
  pattern,
  onChange,
}: {
  pattern: boolean[];
  onChange: (pattern: boolean[]) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {pattern.map((on, i) => (
        <button
          key={i}
          className={`w-4 h-4 rounded-sm text-[8px] font-mono transition-colors ${
            on
              ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
              : 'bg-gray-800 text-gray-600 border border-gray-700 hover:border-gray-600'
          }`}
          onClick={() => {
            const next = [...pattern];
            next[i] = !next[i];
            onChange(next);
          }}
        >
          {on ? '1' : '0'}
        </button>
      ))}
      <button
        className="ml-1 px-1 py-0.5 text-[8px] text-gray-500 hover:text-gray-300 rounded bg-gray-800 border border-gray-700"
        onClick={() => onChange([...pattern, false])}
        title="Add step"
      >
        +
      </button>
      {pattern.length > 1 && (
        <button
          className="px-1 py-0.5 text-[8px] text-gray-500 hover:text-gray-300 rounded bg-gray-800 border border-gray-700"
          onClick={() => onChange(pattern.slice(0, -1))}
          title="Remove step"
        >
          -
        </button>
      )}
    </div>
  );
}

function StickingInput({
  pattern,
  onChange,
}: {
  pattern: ('R' | 'L')[];
  onChange: (pattern: ('R' | 'L')[]) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {pattern.map((hand, i) => (
        <button
          key={i}
          className={`w-4 h-4 rounded-sm text-[8px] font-mono transition-colors ${
            hand === 'R'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
              : 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
          }`}
          onClick={() => {
            const next = [...pattern];
            next[i] = next[i] === 'R' ? 'L' : 'R';
            onChange(next);
          }}
        >
          {hand}
        </button>
      ))}
      <button
        className="ml-1 px-1 py-0.5 text-[8px] text-gray-500 hover:text-gray-300 rounded bg-gray-800 border border-gray-700"
        onClick={() => onChange([...pattern, 'R'])}
        title="Add stroke"
      >
        +
      </button>
      {pattern.length > 1 && (
        <button
          className="px-1 py-0.5 text-[8px] text-gray-500 hover:text-gray-300 rounded bg-gray-800 border border-gray-700"
          onClick={() => onChange(pattern.slice(0, -1))}
          title="Remove stroke"
        >
          -
        </button>
      )}
    </div>
  );
}

// Re-export VariationType for modal usage
export type { VariationType };
