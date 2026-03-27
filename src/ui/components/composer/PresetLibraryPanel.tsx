/**
 * PresetLibraryPanel.
 *
 * Browsable library of ComposerPresets.
 * Appears in the left panel "Presets" tab.
 * Supports search, CRUD, and drag-to-workspace.
 */

import { useState, useCallback, useEffect } from 'react';
import { type ComposerPreset, type PlacedPresetInstance } from '../../../types/composerPreset';
import {
  loadComposerPresetsAsync,
  deleteComposerPresetAsync,
  duplicateComposerPresetAsync,
  renameComposerPresetAsync,
} from '../../persistence/composerPresetStorage';
import { PresetCard } from './PresetCard';

interface PresetLibraryPanelProps {
  selectedPresetId?: string | null;
  onSelectPreset?: (presetId: string | null) => void;
  /** Set of preset IDs currently toggled to mirrored state. */
  mirroredPresets?: Set<string>;
  onToggleMirror?: (presetId: string) => void;
  /** Currently placed instances in the workspace. */
  placedInstances?: PlacedPresetInstance[];
  /** Currently selected placed instance ID. */
  selectedInstanceId?: string | null;
  /** Callback to select a placed instance. */
  onSelectInstance?: (instanceId: string | null) => void;
  /** Notify parent when preset drag starts (for ghost preview). */
  onDragStartPreset?: (presetId: string, isMirrored: boolean) => void;
  /** Notify parent when preset drag ends. */
  onDragEndPreset?: () => void;
}

export function PresetLibraryPanel({
  selectedPresetId,
  onSelectPreset,
  mirroredPresets,
  onToggleMirror,
  placedInstances = [],
  selectedInstanceId,
  onSelectInstance,
  onDragStartPreset,
  onDragEndPreset,
}: PresetLibraryPanelProps) {
  const [presets, setPresets] = useState<ComposerPreset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Load presets from Supabase
  useEffect(() => {
    loadComposerPresetsAsync()
      .then(setPresets)
      .catch(err => console.error('Failed to load presets:', err));
  }, [refreshKey]);

  // Listen for storage events (other tabs) and custom refresh events
  useEffect(() => {
    const handleStorage = () => setRefreshKey(k => k + 1);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('composer-presets-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('composer-presets-changed', handleStorage);
    };
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    window.dispatchEvent(new Event('composer-presets-changed'));
  }, []);

  const handleDelete = useCallback(async (presetId: string) => {
    if (!window.confirm('Delete this preset?')) return;
    await deleteComposerPresetAsync(presetId);
    if (selectedPresetId === presetId) {
      onSelectPreset?.(null);
    }
    refresh();
  }, [selectedPresetId, onSelectPreset, refresh]);

  const handleDuplicate = useCallback(async (presetId: string) => {
    await duplicateComposerPresetAsync(presetId);
    refresh();
  }, [refresh]);

  const handleRename = useCallback(async (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const newName = window.prompt('Rename preset:', preset.name);
    if (!newName || newName === preset.name) return;
    await renameComposerPresetAsync(presetId, newName);
    refresh();
  }, [presets, refresh]);

  const handleSelect = useCallback((presetId: string) => {
    onSelectPreset?.(selectedPresetId === presetId ? null : presetId);
  }, [selectedPresetId, onSelectPreset]);

  // Filter by search query
  const filteredPresets = searchQuery.trim()
    ? presets.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : presets;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-300">Composer Presets</span>
          <span className="text-[10px] text-gray-500">{presets.length}</span>
        </div>
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder-gray-600"
        />
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {filteredPresets.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-xs text-gray-500 mb-1">
              {searchQuery ? 'No matching presets' : 'No presets yet'}
            </div>
            <div className="text-[10px] text-gray-600">
              {searchQuery
                ? 'Try a different search'
                : 'Use "Save Preset" in the Composer to create one'}
            </div>
          </div>
        ) : (
          filteredPresets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              isMirrored={mirroredPresets?.has(preset.id) ?? false}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onRename={handleRename}
              onToggleMirror={onToggleMirror}
              onDragStartPreset={onDragStartPreset}
              onDragEndPreset={onDragEndPreset}
            />
          ))
        )}
      </div>

      {/* Placed Instances Section */}
      {placedInstances.length > 0 && (
        <div className="border-t border-gray-700/50 px-3 py-2">
          <div className="text-[10px] text-gray-500 font-medium mb-1.5">
            Placed ({placedInstances.length})
          </div>
          <div className="space-y-1">
            {placedInstances.map(inst => (
              <button
                key={inst.id}
                className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${
                  selectedInstanceId === inst.id
                    ? 'bg-violet-900/30 text-violet-300 border border-violet-500/30'
                    : 'bg-gray-800/30 text-gray-400 border border-transparent hover:border-gray-700'
                }`}
                onClick={() => {
                  onSelectInstance?.(selectedInstanceId === inst.id ? null : inst.id);
                  onSelectPreset?.(null);
                }}
              >
                <span className="truncate">{inst.presetName}</span>
                <span className="text-gray-600 ml-1">
                  ({inst.anchorRow},{inst.anchorCol})
                  {inst.isMirrored && ' mirrored'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-gray-700/30">
        <div className="text-[10px] text-gray-600">
          Drag a preset onto the grid to place it
        </div>
      </div>
    </div>
  );
}
