/**
 * View Settings State.
 *
 * Centralized UI display options for grid labeling, view modes,
 * and layout display preferences. Shared via React Context so all
 * consumers (PerformanceWorkspace, WorkspaceToolbar, etc.) see the
 * same state.
 */

import { useState, useCallback, useContext, useEffect, createContext, type ReactNode } from 'react';

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
  /** Color pads by assigned hand (left/right) instead of voice color */
  showHandColors: boolean;
  /**
   * Arrows from the selected event's pads to the next event's. Its toggle
   * lived beside the transition preview above the grid until S3.2 gave that
   * slot to the layout-state bar.
   */
  showTransitionArrows: boolean;
}

/**
 * ViewSettings: Full display options state. ("Organize by 4x4 Banks", which
 * nothing read, is gone: S2.3, T39.)
 */
export interface ViewSettings {
  gridLabels: GridLabelSettings;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  gridLabels: {
    showNoteLabels: false,
    showPositionLabels: false,
    showFingerAssignment: true,
    showSoundNames: true,
    showHandColors: false,
    showTransitionArrows: true,
  },
};

const STORAGE_KEY = 'pushflow:view-settings';

/**
 * The viewer's remembered settings (T39: they reset every session). Stored
 * per viewer in localStorage, never in the project; blocked storage or an odd
 * value falls back to the defaults, and unknown keys are ignored.
 */
export function loadViewSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW_SETTINGS;
    const parsed = JSON.parse(raw) as { gridLabels?: Record<string, unknown> };
    const gridLabels = { ...DEFAULT_VIEW_SETTINGS.gridLabels };
    for (const key of Object.keys(gridLabels) as Array<keyof GridLabelSettings>) {
      const value = parsed?.gridLabels?.[key];
      if (typeof value === 'boolean') gridLabels[key] = value;
    }
    return { gridLabels };
  } catch {
    return DEFAULT_VIEW_SETTINGS;
  }
}

export function saveViewSettings(settings: ViewSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the settings still work, they just aren't remembered.
  }
}

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
}

const ViewSettingsContext = createContext<ViewSettingsContextValue | null>(null);

/**
 * Provider — wrap at workspace or app level so all consumers share one instance.
 */
export function ViewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ViewSettings>(loadViewSettings);
  useEffect(() => { saveViewSettings(settings); }, [settings]);

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

  return (
    <ViewSettingsContext.Provider value={{ settings, setSettings, updateGridLabels, toggleGridLabel }}>
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
