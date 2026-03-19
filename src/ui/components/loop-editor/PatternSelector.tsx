/**
 * PatternSelector.
 *
 * Dropdown panel for generating patterns from presets or random seeds.
 * Replaces the old rudiment dropdown with a richer preset grid,
 * randomize button, and "Customize..." link to the recipe editor.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { type PatternRecipe } from '../../../types/patternRecipe';
import { PATTERN_PRESETS } from '../../../engine/pattern/presets';
import { loadPresets, type PerformancePreset } from '../../persistence/presetStorage';

// ============================================================================
// Props
// ============================================================================

interface PatternSelectorProps {
  onSelectPreset: (recipe: PatternRecipe) => void;
  onRandomize: (seed: number) => void;
  onCustomize: (recipe?: PatternRecipe) => void;
  hasPatternResult: boolean;
  onLoadPreset?: (preset: PerformancePreset) => void;
  onDeletePreset?: (presetId: string) => void;
}

// ============================================================================
// Tag colors
// ============================================================================

const TAG_COLORS: Record<string, string> = {
  rudiment: 'bg-amber-600/20 text-amber-400',
  percussion: 'bg-gray-600/20 text-gray-400',
  sticking: 'bg-blue-600/20 text-blue-400',
  grace: 'bg-violet-600/20 text-violet-400',
  groove: 'bg-green-600/20 text-green-400',
  simple: 'bg-emerald-600/20 text-emerald-400',
  complex: 'bg-red-600/20 text-red-400',
  euclidean: 'bg-cyan-600/20 text-cyan-400',
  linear: 'bg-teal-600/20 text-teal-400',
  ghost: 'bg-purple-600/20 text-purple-400',
  dynamics: 'bg-pink-600/20 text-pink-400',
  dance: 'bg-yellow-600/20 text-yellow-400',
  bass: 'bg-orange-600/20 text-orange-400',
  mixed: 'bg-indigo-600/20 text-indigo-400',
  melodic: 'bg-sky-600/20 text-sky-400',
  pitched: 'bg-sky-600/20 text-sky-400',
  textural: 'bg-rose-600/20 text-rose-400',
  full: 'bg-slate-600/20 text-slate-400',
};

// ============================================================================
// Component
// ============================================================================

export function PatternSelector({
  onSelectPreset,
  onRandomize,
  onCustomize,
  hasPatternResult,
  onLoadPreset,
  onDeletePreset,
}: PatternSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userPresets, setUserPresets] = useState<PerformancePreset[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Refresh user presets when dropdown opens
  useEffect(() => {
    if (isOpen) setUserPresets(loadPresets());
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleRandomize = useCallback(() => {
    onRandomize(Date.now());
    setIsOpen(false);
  }, [onRandomize]);

  const handlePresetClick = useCallback((recipe: PatternRecipe) => {
    onSelectPreset(recipe);
    setIsOpen(false);
  }, [onSelectPreset]);

  const handleCustomize = useCallback(() => {
    onCustomize();
    setIsOpen(false);
  }, [onCustomize]);

  // Split presets into rudiments and new patterns
  const rudimentPresets = PATTERN_PRESETS.filter(p => p.tags.includes('rudiment'));
  const otherPresets = PATTERN_PRESETS.filter(p => !p.tags.includes('rudiment'));

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        className={`px-2 py-1 text-xs rounded border transition-colors ${
          hasPatternResult
            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/40'
            : 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/30'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        Generate Pattern ▾
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[360px] max-h-[70vh] overflow-y-auto">
          {/* Quick actions */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
            <button
              className="flex-1 px-3 py-1.5 text-xs rounded bg-purple-600/20 text-purple-300 border border-purple-600/30 hover:bg-purple-600/30 transition-colors font-medium"
              onClick={handleRandomize}
            >
              Randomize
            </button>
            <button
              className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 transition-colors"
              onClick={handleCustomize}
            >
              Customize...
            </button>
          </div>

          {/* User saved presets */}
          {onLoadPreset && userPresets.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">My Performances</h4>
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {userPresets.map(preset => (
                  <div key={preset.id} className="flex items-center gap-1 group">
                    <button
                      className="flex-1 text-left px-2 py-1.5 rounded hover:bg-gray-700/60 transition-colors text-xs text-gray-200"
                      onClick={() => { onLoadPreset(preset); setIsOpen(false); }}
                    >
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-[10px] text-gray-500 ml-2">
                        {preset.lanes.length}L · {preset.events.length}ev
                      </span>
                    </button>
                    {onDeletePreset && (
                      <button
                        className="w-5 h-5 flex items-center justify-center text-[10px] text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-500/10"
                        onClick={() => { onDeletePreset(preset.id); setUserPresets(prev => prev.filter(p => p.id !== preset.id)); }}
                        title="Delete preset"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700" />
            </>
          )}

          {/* Rudiment presets */}
          <div className="px-3 pt-2 pb-1">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rudiments</h4>
          </div>
          <div className="px-2 pb-2">
            {rudimentPresets.map(preset => (
              <PresetCard key={preset.id} preset={preset} onClick={handlePresetClick} />
            ))}
          </div>

          <div className="border-t border-gray-700" />

          {/* New pattern presets */}
          <div className="px-3 pt-2 pb-1">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patterns</h4>
          </div>
          <div className="px-2 pb-2">
            {otherPresets.map(preset => (
              <PresetCard key={preset.id} preset={preset} onClick={handlePresetClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PresetCard
// ============================================================================

function PresetCard({
  preset,
  onClick,
}: {
  preset: PatternRecipe;
  onClick: (recipe: PatternRecipe) => void;
}) {
  return (
    <button
      className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-700/60 transition-colors group"
      onClick={() => onClick(preset)}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-200 font-medium group-hover:text-white">
          {preset.name}
        </span>
        <span className="text-[10px] text-gray-600">
          {preset.layers.length}L
        </span>
      </div>
      <div className="text-[10px] text-gray-500 leading-snug mt-0.5">
        {preset.description}
      </div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {preset.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className={`px-1 py-0 text-[8px] rounded ${TAG_COLORS[tag] ?? 'bg-gray-700 text-gray-500'}`}
          >
            {tag}
          </span>
        ))}
        {preset.variation.type !== 'none' && (
          <span className="px-1 py-0 text-[8px] rounded bg-gray-700/50 text-gray-500">
            {preset.variation.type.replace('_', ' ')}
          </span>
        )}
      </div>
    </button>
  );
}
