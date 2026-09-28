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
}

/**
 * What the moment view shows around the current event (S4.2, T09): its
 * strikes only, also the next event's (with the moves to them), or also the
 * previous event's. It replaces the onion-skin and Arrows toggles.
 */
export type MomentView = 'now' | 'now-next' | 'prev-now-next';

export const MOMENT_VIEWS: ReadonlyArray<{ id: MomentView; label: string; description: string }> = [
  { id: 'now', label: 'Now', description: 'The event’s own strikes' },
  { id: 'now-next', label: 'Now + Next', description: 'Also the next event’s strikes, and each finger’s move to them' },
  { id: 'prev-now-next', label: 'Prev · Now · Next', description: 'Also the previous event’s strikes' },
];

/** The view after `view`, for the O key: Now → Now + Next → Prev · Now · Next → Now. */
export function nextMomentView(view: MomentView): MomentView {
  const i = MOMENT_VIEWS.findIndex(v => v.id === view);
  return MOMENT_VIEWS[(i + 1) % MOMENT_VIEWS.length]!.id;
}

/**
 * ViewSettings: Full display options state. ("Organize by 4x4 Banks", which
 * nothing read, is gone: S2.3, T39.)
 */
export interface ViewSettings {
  gridLabels: GridLabelSettings;
  momentView: MomentView;
  /**
   * The Rehearse view (S4.4, F7-03): both side panels collapsed, so the grid,
   * the inspector beside it and the timeline get the room. View state only:
   * remembered per viewer, never in the project, never an analysis input.
   */
  rehearseView: boolean;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  gridLabels: {
    showNoteLabels: false,
    showPositionLabels: false,
    showFingerAssignment: true,
    showSoundNames: true,
    showHandColors: false,
  },
  momentView: 'now-next',
  rehearseView: false,
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
    const parsed = JSON.parse(raw) as { gridLabels?: Record<string, unknown>; momentView?: unknown; rehearseView?: unknown };
    const gridLabels = { ...DEFAULT_VIEW_SETTINGS.gridLabels };
    for (const key of Object.keys(gridLabels) as Array<keyof GridLabelSettings>) {
      const value = parsed?.gridLabels?.[key];
      if (typeof value === 'boolean') gridLabels[key] = value;
    }
    const momentView = MOMENT_VIEWS.find(v => v.id === parsed?.momentView)?.id ?? DEFAULT_VIEW_SETTINGS.momentView;
    const rehearseView = parsed?.rehearseView === true;
    return { gridLabels, momentView, rehearseView };
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
  setMomentView: (view: MomentView) => void;
  setRehearseView: (on: boolean) => void;
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

  const setMomentView = useCallback((momentView: MomentView) => {
    setSettings(prev => (prev.momentView === momentView ? prev : { ...prev, momentView }));
  }, []);

  const setRehearseView = useCallback((rehearseView: boolean) => {
    setSettings(prev => (prev.rehearseView === rehearseView ? prev : { ...prev, rehearseView }));
  }, []);

  return (
    <ViewSettingsContext.Provider value={{ settings, setSettings, updateGridLabels, toggleGridLabel, setMomentView, setRehearseView }}>
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
