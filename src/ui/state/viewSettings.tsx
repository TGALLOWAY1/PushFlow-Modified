/**
 * View Settings State.
 *
 * Centralized UI display options for grid labeling, view modes,
 * and layout display preferences. Shared via React Context so all
 * consumers (PerformanceWorkspace, WorkspaceToolbar, etc.) see the
 * same state.
 */

import { useState, useCallback, useContext, createContext, type ReactNode } from 'react';

/**
 * GridLabelSettings: What labels to show on each pad in the grid.
 *
 * Three toggles matching the Push-style settings panel:
 * - Note labels (e.g. "C1")
 * - Position labels (e.g. "(2,3)")
 * - Finger assignment (e.g. "L-Ix")
 */
export interface GridLabelSettings {
  /** Show MIDI note labels (e.g. "C1") */
  showNoteLabels: boolean;
  /** Show grid position labels (e.g. "(2,3)") */
  showPositionLabels: boolean;
  /** Show finger assignment labels (e.g. "L1") */
  showFingerAssignment: boolean;
  /** Show sound names on pads */
  showSoundNames: boolean;
}

/**
 * LayoutDisplaySettings: Layout-level display and organization options.
 */
export interface LayoutDisplaySettings {
  /** Organize the 8x8 grid into 4x4 quadrant banks */
  organize4x4Banks: boolean;
}

/**
 * ViewSettings: Full display options state.
 */
export interface ViewSettings {
  gridLabels: GridLabelSettings;
  layoutDisplay: LayoutDisplaySettings;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  gridLabels: {
    showNoteLabels: false,
    showPositionLabels: false,
    showFingerAssignment: true,
    showSoundNames: true,
  },
  layoutDisplay: {
    organize4x4Banks: false,
  },
};

/**
 * Label rendering priority (highest first):
 * 1. Finger assignment (critical for performance-oriented views)
 * 2. Note label (useful for musicians)
 * 3. Position label (useful for debugging/reference)
 *
 * Sound name is always shown as the primary label on occupied pads.
 * These toggles control additional overlay labels.
 */
export const LABEL_PRIORITY: Array<keyof GridLabelSettings> = [
  'showFingerAssignment',
  'showNoteLabels',
  'showPositionLabels',
];

// ============================================================================
// Context
// ============================================================================

interface ViewSettingsContextValue {
  settings: ViewSettings;
  setSettings: (s: ViewSettings) => void;
  updateGridLabels: (updates: Partial<GridLabelSettings>) => void;
  toggleGridLabel: (key: keyof GridLabelSettings) => void;
  toggleLayoutDisplay: (key: keyof LayoutDisplaySettings) => void;
}

const ViewSettingsContext = createContext<ViewSettingsContextValue | null>(null);

/**
 * Provider — wrap at workspace or app level so all consumers share one instance.
 */
export function ViewSettingsProvider({ children }: { children: ReactNode }) {
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

  const toggleLayoutDisplay = useCallback((key: keyof LayoutDisplaySettings) => {
    setSettings(prev => ({
      ...prev,
      layoutDisplay: { ...prev.layoutDisplay, [key]: !prev.layoutDisplay[key] },
    }));
  }, []);

  return (
    <ViewSettingsContext.Provider value={{ settings, setSettings, updateGridLabels, toggleGridLabel, toggleLayoutDisplay }}>
      {children}
    </ViewSettingsContext.Provider>
  );
}

/**
 * Hook for consuming view settings. Must be used within ViewSettingsProvider.
 */
export function useViewSettings() {
  const ctx = useContext(ViewSettingsContext);
  if (!ctx) {
    throw new Error('useViewSettings must be used within a ViewSettingsProvider');
  }
  return ctx;
}
