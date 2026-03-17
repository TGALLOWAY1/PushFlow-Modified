/**
 * View Settings State.
 *
 * Centralized UI display options for grid labeling, view modes,
 * and analysis display preferences. Reusable across analysis,
 * candidate preview, compare mode, and event/onion views.
 */

import { useState, useCallback } from 'react';

/**
 * GridLabelMode: What labels to show on each pad in the grid.
 */
export interface GridLabelSettings {
  /** Show MIDI note labels (e.g. "C1") */
  showNoteLabels: boolean;
  /** Show grid position labels (e.g. "(0,0)") */
  showPositionLabels: boolean;
  /** Show finger assignment labels (e.g. "L-Ix") */
  showFingerAssignment: boolean;
  /** Show sound/voice name on pad */
  showSoundName: boolean;
}

/**
 * ViewSettings: Full display options state.
 */
export interface ViewSettings {
  gridLabels: GridLabelSettings;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  gridLabels: {
    showNoteLabels: false,
    showPositionLabels: false,
    showFingerAssignment: true,
    showSoundName: true,
  },
};

/**
 * Label rendering priority (highest first):
 * 1. Sound name (always shown when enabled, most important for identification)
 * 2. Finger assignment (critical for performance-oriented views)
 * 3. Note label (useful for musicians, secondary)
 * 4. Position label (useful for debugging/reference, lowest priority)
 *
 * When multiple labels are enabled, the grid renderer should:
 * - Show sound name as the primary label
 * - Show finger assignment below it
 * - Show note/position as smaller secondary text if space allows
 */
export const LABEL_PRIORITY: Array<keyof GridLabelSettings> = [
  'showSoundName',
  'showFingerAssignment',
  'showNoteLabels',
  'showPositionLabels',
];

/**
 * Hook for managing view settings state.
 */
export function useViewSettings() {
  const [settings, setSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);

  const updateGridLabels = useCallback((updates: Partial<GridLabelSettings>) => {
    setSettings(prev => ({
      ...prev,
      gridLabels: { ...prev.gridLabels, ...updates },
    }));
  }, []);

  const toggleGridLabel = useCallback((key: keyof GridLabelSettings) => {
    setSettings(prev => ({
      ...prev,
      gridLabels: { ...prev.gridLabels, [key]: !prev.gridLabels[key] },
    }));
  }, []);

  return { settings, setSettings, updateGridLabels, toggleGridLabel };
}
