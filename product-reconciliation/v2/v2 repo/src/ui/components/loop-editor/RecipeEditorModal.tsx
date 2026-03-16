/**
 * RecipeEditorModal.
 *
 * Full recipe editor for creating/modifying PatternRecipes.
 * Manages a list of PatternLayers, variation config, and recipe metadata.
 * Dispatches GENERATE_PATTERN on "Generate".
 */

import { useState, useCallback } from 'react';
import {
  type PatternRecipe,
  type PatternLayer,
  type VariationType,
  type SurfaceRole,
} from '../../../types/patternRecipe';
import { PatternLayerEditor } from './PatternLayerEditor';
import { generateId } from '../../../utils/idGenerator';

// ============================================================================
// Props
// ============================================================================

interface RecipeEditorModalProps {
  /** Initial recipe to edit (undefined = start blank). */
  initialRecipe?: PatternRecipe;
  onGenerate: (recipe: PatternRecipe) => void;
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const VARIATION_TYPES: VariationType[] = [
  'none', 'hand_swap', 'density_ramp', 'density_thin', 'inversion', 'accent_shift',
];

const VARIATION_LABELS: Record<VariationType, string> = {
  none: 'None',
  hand_swap: 'Hand Swap',
  density_ramp: 'Density Ramp',
  density_thin: 'Density Thin',
  inversion: 'Inversion',
  accent_shift: 'Accent Shift',
};

const DEFAULT_SURFACES: SurfaceRole[] = ['kick', 'snare', 'closed_hat', 'tom_1', 'bass_1', 'melodic_hit'];

// ============================================================================
// Component
// ============================================================================

export function RecipeEditorModal({
  initialRecipe,
  onGenerate,
  onClose,
}: RecipeEditorModalProps) {
  const [name, setName] = useState(initialRecipe?.name ?? 'Custom Pattern');
  const [description, setDescription] = useState(initialRecipe?.description ?? '');
  const [layers, setLayers] = useState<PatternLayer[]>(
    initialRecipe?.layers ?? [createDefaultLayer(0)],
  );
  const [variationType, setVariationType] = useState<VariationType>(
    initialRecipe?.variation.type ?? 'none',
  );

  // ---- Layer management ----
  const addLayer = useCallback(() => {
    setLayers(prev => [...prev, createDefaultLayer(prev.length)]);
  }, []);

  const removeLayer = useCallback((index: number) => {
    setLayers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateLayer = useCallback((index: number, updated: PatternLayer) => {
    setLayers(prev => prev.map((l, i) => i === index ? updated : l));
  }, []);

  // ---- Generate ----
  const handleGenerate = useCallback(() => {
    if (layers.length === 0) return;

    const recipe: PatternRecipe = {
      id: initialRecipe?.id ?? generateId('recipe'),
      name: name.trim() || 'Custom Pattern',
      description: description.trim(),
      layers,
      variation: { type: variationType },
      isPreset: false,
      tags: ['custom'],
    };
    onGenerate(recipe);
  }, [name, description, layers, variationType, initialRecipe, onGenerate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Recipe Editor</h2>
          <button
            className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-800 transition-colors"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Name + Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12">Name</span>
              <input
                className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Pattern name"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12">Desc</span>
              <input
                className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Variation */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-12">Variation</span>
            <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700 flex-wrap gap-0.5">
              {VARIATION_TYPES.map(type => (
                <button
                  key={type}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    variationType === type
                      ? 'bg-gray-600 text-gray-200 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  onClick={() => setVariationType(type)}
                >
                  {VARIATION_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Layers */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Layers ({layers.length})
              </span>
              <button
                className="px-2 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                onClick={addLayer}
              >
                + Add Layer
              </button>
            </div>

            {layers.length === 0 && (
              <p className="text-[10px] text-gray-600 px-2 py-4 text-center">
                No layers. Add at least one layer to generate a pattern.
              </p>
            )}

            {layers.map((layer, i) => (
              <PatternLayerEditor
                key={layer.id}
                layer={layer}
                index={i}
                onChange={updated => updateLayer(i, updated)}
                onRemove={() => removeLayer(i)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={layers.length === 0}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function createDefaultLayer(index: number): PatternLayer {
  const surface = DEFAULT_SURFACES[index % DEFAULT_SURFACES.length];
  return {
    id: generateId('layer'),
    surface,
    rhythm: { type: 'euclidean', hits: 3, steps: 8, rotation: 0 },
    accent: { type: 'flat' },
    velocity: { min: 60, max: 110 },
    density: 100,
  };
}
