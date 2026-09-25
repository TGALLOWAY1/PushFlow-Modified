/**
 * PerformanceWorkspace.
 *
 * Redesigned workspace centered around three focal points:
 * 1. The Push grid (large, dominant, center)
 * 2. The timeline (directly below grid, tightly coupled)
 * 3. Layout options (right column with mini grid previews)
 *
 * Layout: full-viewport 3-column with unified top toolbar.
 * - Left: tabbed Sounds/Events panel
 * - Center: Grid + Timeline stacked
 * - Right: tabbed Costs/Layouts panel (mirrors left panel structure)
 * - Bottom drawer: Pattern Composer (collapsible)
 */

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useReducer, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useIdentityMatchingNotice } from '../../hooks/useIdentityMatchingNotice';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { exportProjectToFile } from '../../persistence/projectStorage';
import { useToast } from '../shared/Toast';
import { useViewSettings, ViewSettingsProvider } from '../../state/viewSettings';
import { getDisplayedCandidate, getSelectedCandidate, isPadLocked, type SoundStream } from '../../state/projectState';
import { liveCompareIds, canCompare } from '../../state/compareSet';
import { resolvePresetDrop, soundForPresetLane, FOREIGN_PRESET_MESSAGE } from '../../state/presetDrop';

import { WorkspaceToolbar } from './WorkspaceToolbar';
import { VoicePalette } from '../VoicePalette';
import { EventsPanel } from '../EventsPanel';
import { InteractiveGrid } from '../InteractiveGrid';
import { UnifiedTimeline } from '../UnifiedTimeline';
import { WorkspacePatternStudio } from './WorkspacePatternStudio';
import { ActiveLayoutSummary } from '../panels/ActiveLayoutSummary';
import { PerformanceCostsPanel } from '../panels/PerformanceCostsPanel';
import { LayoutOptionsPanel } from '../panels/LayoutOptionsPanel';
import { CompareModal } from '../panels/CompareModal';
import { MoveTracePanel } from '../panels/MoveTracePanel';
import { PresetLibraryPanel } from '../composer/PresetLibraryPanel';
import { PresetInspector } from '../composer/PresetInspector';
import { loadComposerPresets } from '../../persistence/composerPresetStorage';
import {
  type PlacedPresetInstance,
  type ComposerPreset,
  type PresetDragPreview,
  createInitialComposerWorkspaceState,
  presetPadFingerConstraint,
} from '../../../types/composerPreset';
import {
  composerWorkspaceReducer,
} from '../../state/composerWorkspaceReducer';
import {
  mirrorPreset,
  mirrorPads,
  validatePlacement,
} from '../../../engine/mapping/presetTransform';
import { generateId } from '../../../utils/idGenerator';
import { padKey } from '../../../types/padGrid';
import { useMeasuredPadSize } from './gridSizing';
import { DrawerSplitter } from './DrawerSplitter';
import { CENTER_MIN_WIDTH, fitSidePanels, maxPanelWidth } from './panelSizing';
import {
  DRAWER_TAB_BAR_HEIGHT,
  drawerHeightFor,
  loadDrawerPrefs,
  maxDrawerHeight,
  minDrawerHeight,
  saveDrawerPrefs,
  type DrawerPrefs,
} from './drawerSizing';
import { timelineContentHeight } from '../timelineLayout';

type LeftPanelTab = 'sounds' | 'events' | 'presets';
type RightPanelTab = 'costs' | 'layouts';
type TimelineTab = 'timeline' | 'composer';

// Panel width constraints
const LEFT_MIN = 200;
const LEFT_MAX = 500;
const LEFT_DEFAULT = 320;
const RIGHT_MIN = 280;
const RIGHT_MAX = 600;
const RIGHT_DEFAULT = 340;
/** A collapsed side panel, and the drag handle beside an open one. */
const COLLAPSED_PANEL_WIDTH = 36;
const RESIZE_HANDLE_WIDTH = 8;

/**
 * One bottom-drawer tab's content. The inactive panel stays mounted but is not
 * displayed and is inert: nothing in it can take focus, clicks or keys.
 */
function DrawerPanel({ tab, active, className = '', children }: {
  tab: TimelineTab;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.inert = !active;
  }, [active]);
  return (
    <div
      ref={ref}
      data-testid={`drawer-panel-${tab}`}
      aria-hidden={!active}
      className={`h-full ${active ? '' : 'hidden'} ${className}`}
    >
      {children}
    </div>
  );
}

export function PerformanceWorkspace() {
  return (
    <ViewSettingsProvider>
      <PerformanceWorkspaceInner />
    </ViewSettingsProvider>
  );
}

function PerformanceWorkspaceInner() {
  const { state, dispatch, transact } = useProject();
  const navigate = useNavigate();
  const { generateFull, calculateCost, generationProgress, analysisPhase, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useIdentityMatchingNotice(state);
  const { saveStatus, saveNow } = useAutoSave(state);
  useKeyboardShortcuts({ onSave: saveNow });
  const toast = useToast();
  // "Export a copy": the way out when saving keeps failing. Until P8 moves the
  // Composer's pattern into the project it lives in localStorage, and the file
  // carries it too, so the toast says so (T57).
  const handleExport = useCallback(() => {
    const { composerPatternIncluded } = exportProjectToFile(state);
    toast.show({ message: composerPatternIncluded ? 'Exported \u00b7 Composer pattern included' : 'Exported' });
  }, [state, toast]);
  const { settings: viewSettings } = useViewSettings();

  // Handle ?view=presets query param
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  if (initialView === 'presets') {
    console.log('[PushFlow] View Presets mode detected in URL');
  }

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>(initialView === 'presets' ? 'presets' : 'sounds');
  const [rightTab, setRightTab] = useState<RightPanelTab>(initialView === 'presets' ? 'costs' : 'layouts');
  const [rightCollapsed, setRightCollapsed] = useState(initialView === 'presets');
  const [onionSkin, setOnionSkin] = useState(false);
  const [timelineTab, setTimelineTab] = useState<TimelineTab>(initialView === 'presets' ? 'composer' : 'timeline');

  // Composer preset library state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [mirroredPresets, setMirroredPresets] = useState<Set<string>>(new Set());
  const handleToggleMirror = useCallback((presetId: string) => {
    setMirroredPresets(prev => {
      const next = new Set(prev);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      return next;
    });
  }, []);

  // Composer workspace assembly state
  const [composerWorkspace, composerDispatch] = useReducer(
    composerWorkspaceReducer,
    undefined,
    createInitialComposerWorkspaceState,
  );

  // Get currently occupied pads (for collision detection during placement)
  const occupiedPads = useMemo(() => {
    const occupied = new Set<string>();
    const layout = state.workingLayout ?? state.activeLayout;
    if (layout) {
      for (const key of Object.keys(layout.padToVoice)) {
        occupied.add(key);
      }
    }
    return occupied;
  }, [state.workingLayout, state.activeLayout]);

  // Compute highlighted pads for selected instance
  const highlightedInstancePads = useMemo(() => {
    if (!composerWorkspace.selectedInstanceId) return undefined;
    const instance = composerWorkspace.placedInstances.find(
      i => i.id === composerWorkspace.selectedInstanceId
    );
    if (!instance) return undefined;
    const keys = new Set<string>();
    for (const pad of instance.pads) {
      keys.add(padKey(
        instance.anchorRow + pad.position.rowOffset,
        instance.anchorCol + pad.position.colOffset,
      ));
    }
    return keys;
  }, [composerWorkspace.selectedInstanceId, composerWorkspace.placedInstances]);

  // Dragging preset state (for ghost preview + mirror-during-drag)
  const [draggingPreset, setDraggingPreset] = useState<{ preset: ComposerPreset; isMirrored: boolean } | null>(null);
  const [dragPreview, setDragPreview] = useState<PresetDragPreview | null>(null);

  const handleDragStartPreset = useCallback((presetId: string, isMirrored: boolean) => {
    const presets = loadComposerPresets();
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setDraggingPreset({ preset, isMirrored });
    }
  }, []);

  const handleDragEndPreset = useCallback(() => {
    setDraggingPreset(null);
    setDragPreview(null);
  }, []);

  // M key toggles mirror during drag
  useEffect(() => {
    if (!draggingPreset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        setDraggingPreset(prev => {
          if (!prev) return prev;
          return { ...prev, isMirrored: !prev.isMirrored };
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draggingPreset]);

  // Update ghost preview when dragging preset mirror state changes
  const handleGridDragOver = useCallback((anchorRow: number, anchorCol: number) => {
    if (!draggingPreset) {
      setDragPreview(null);
      return;
    }
    const effectivePreset = draggingPreset.isMirrored
      ? mirrorPreset(draggingPreset.preset)
      : draggingPreset.preset;
    const validation = validatePlacement(effectivePreset.pads, anchorRow, anchorCol, occupiedPads);
    setDragPreview({
      presetId: draggingPreset.preset.id,
      anchorRow,
      anchorCol,
      isMirrored: draggingPreset.isMirrored,
      isValid: validation.valid,
      pads: effectivePreset.pads,
      boundingBox: effectivePreset.boundingBox,
    });
  }, [draggingPreset, occupiedPads]);

  const handleGridDragLeave = useCallback(() => {
    setDragPreview(null);
  }, []);

  // Handle preset drop on grid. Validated against the layout at drop time and
  // refused with a visible reason (T65 slice); read through a ref by the grid.
  const presetDropStateRef = useRef({ state, draggingPreset });
  presetDropStateRef.current = { state, draggingPreset };
  const handlePresetDrop = useCallback((presetId: string, anchorRow: number, anchorCol: number, isMirroredFromDrag: boolean) => {
    const { state: current, draggingPreset: dragging } = presetDropStateRef.current;
    const preset = loadComposerPresets().find(p => p.id === presetId);
    setDraggingPreset(null);
    setDragPreview(null);
    if (!preset) return;

    // The workspace-level mirror state wins while a drag is active.
    const isMirrored = dragging ? dragging.isMirrored : isMirroredFromDrag;
    const result = resolvePresetDrop({
      preset,
      anchorRow,
      anchorCol,
      isMirrored,
      layout: current.workingLayout ?? current.activeLayout,
      soundStreams: current.soundStreams,
    });
    if (!result.ok) {
      toast.show({ message: result.reason, durationMs: 8000 });
      return;
    }

    // One undo step: the pads and any verified finger preferences.
    transact('Place preset', () => {
      dispatch({ type: 'MERGE_ASSIGN_PADS', payload: result.padToVoice });
      for (const [key, constraint] of Object.entries(result.fingerConstraints)) {
        dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey: key, constraint } });
      }
    });

    const placed = result.preset;
    const instance: PlacedPresetInstance = {
      id: generateId('pinst'),
      presetId,
      presetName: placed.name,
      anchorRow,
      anchorCol,
      isMirrored,
      pads: placed.pads,
      config: placed.config,
      lanes: placed.lanes,
      events: placed.events,
      boundingBox: placed.boundingBox,
    };
    composerDispatch({ type: 'PLACE_PRESET', instance });
  }, [dispatch, transact, toast]);

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const isResizing = useRef<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // The side panels give way so the centre keeps room for the timeline's
  // transport cluster and its "⋯" button (T05): the widths the viewer dragged
  // to are kept, and shown only as wide as the measured body allows.
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  useLayoutEffect(() => {
    if (!bodyEl) return;
    const measure = () => {
      const style = getComputedStyle(bodyEl);
      const w = bodyEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (w > 0) setBodyWidth(prev => (prev === w ? prev : w));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bodyEl);
    return () => observer.disconnect();
  }, [bodyEl]);
  const fixedWidth = (leftCollapsed ? COLLAPSED_PANEL_WIDTH : RESIZE_HANDLE_WIDTH)
    + (rightCollapsed ? COLLAPSED_PANEL_WIDTH : 0) + RESIZE_HANDLE_WIDTH;
  // What the open panels may take together; unknown until the body is measured.
  const panelRoom = bodyWidth > 0 ? bodyWidth - fixedWidth - CENTER_MIN_WIDTH : Infinity;
  const shownPanels = fitSidePanels(
    panelRoom,
    { left: leftCollapsed ? 0 : leftWidth, right: rightCollapsed ? 0 : rightWidth },
    { left: leftCollapsed ? 0 : LEFT_MIN, right: rightCollapsed ? 0 : RIGHT_MIN },
  );
  const shownLeftWidth = leftCollapsed ? COLLAPSED_PANEL_WIDTH : shownPanels.left;
  const shownRightWidth = rightCollapsed ? COLLAPSED_PANEL_WIDTH : shownPanels.right;
  // Read by the drag handlers, which are bound once.
  const panelLayout = useRef({ room: panelRoom, left: shownPanels.left, right: shownPanels.right });
  panelLayout.current = { room: panelRoom, left: shownPanels.left, right: shownPanels.right };

  // Measured grid (T04): the pads are sized to the grid region, never scaled.
  const [gridRegionRef, padSize] = useMeasuredPadSize();

  // Bottom drawer: fits the timeline's content (at most ~40% of the centre
  // column) unless the viewer dragged the splitter; remembered per viewer.
  const [centerEl, setCenterEl] = useState<HTMLDivElement | null>(null);
  const [centerHeight, setCenterHeight] = useState(0);
  useLayoutEffect(() => {
    if (!centerEl) return;
    const measure = () => {
      const h = centerEl.clientHeight;
      if (h > 0) setCenterHeight(prev => (prev === h ? prev : h));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(centerEl);
    return () => observer.disconnect();
  }, [centerEl]);
  const [drawerPrefs, setDrawerPrefs] = useState<DrawerPrefs>(loadDrawerPrefs);
  const commitDrawerPrefs = useCallback((next: DrawerPrefs) => {
    setDrawerPrefs(next);
    saveDrawerPrefs(next);
  }, []);
  const drawerHeight = centerHeight > 0
    ? drawerHeightFor(centerHeight, timelineContentHeight(state.soundStreams.length), drawerPrefs)
    : undefined;
  const drawerCollapsed = drawerPrefs.collapsed;
  const setDrawerCollapsed = useCallback((collapsed: boolean) => {
    commitDrawerPrefs({ ...drawerPrefs, collapsed });
  }, [drawerPrefs, commitDrawerPrefs]);
  const openDrawerTab = useCallback((tab: TimelineTab) => {
    setTimelineTab(tab);
    if (drawerPrefs.collapsed) commitDrawerPrefs({ ...drawerPrefs, collapsed: false });
  }, [drawerPrefs, commitDrawerPrefs]);

  // Compare state
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Resize handlers
  const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    isResizing.current = side;
    startX.current = e.clientX;
    // Start from the width on screen, which may be less than the one remembered.
    startWidth.current = side === 'left' ? panelLayout.current.left : panelLayout.current.right;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const dx = e.clientX - startX.current;
      const { room, left, right } = panelLayout.current;
      if (isResizing.current === 'left') {
        setLeftWidth(Math.max(LEFT_MIN, Math.min(maxPanelWidth(room, right, LEFT_MIN, LEFT_MAX), startWidth.current + dx)));
      } else {
        setRightWidth(Math.max(RIGHT_MIN, Math.min(maxPanelWidth(room, left, RIGHT_MIN, RIGHT_MAX), startWidth.current - dx)));
      }
    };
    const handleMouseUp = () => { isResizing.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Resolve selected preset for inspector
  const inspectorPreset = useMemo(() => {
    // Priority: placed instance > library selection
    const instance = composerWorkspace.placedInstances.find(
      i => i.id === composerWorkspace.selectedInstanceId
    );
    if (instance) {
      // Reconstruct a ComposerPreset-like object from the instance
      return {
        preset: {
          id: instance.presetId,
          name: instance.presetName,
          createdAt: 0,
          updatedAt: 0,
          pads: instance.pads,
          config: instance.config,
          lanes: instance.lanes,
          events: instance.events,
          handedness: 'both' as const,
          mirrorEligible: false,
          boundingBox: instance.boundingBox,
          tags: [],
        },
        instance,
      };
    }
    if (selectedPresetId) {
      const presets = loadComposerPresets();
      const preset = presets.find(p => p.id === selectedPresetId);
      if (preset) return { preset, instance: null };
    }
    return null;
  }, [selectedPresetId, composerWorkspace.selectedInstanceId, composerWorkspace.placedInstances]);

  const handleRemoveInstance = useCallback((instanceId: string) => {
    const instance = composerWorkspace.placedInstances.find(i => i.id === instanceId);
    if (!instance) return;

    // Remove pads and finger constraints from grid
    for (const pad of instance.pads) {
      const absRow = instance.anchorRow + pad.position.rowOffset;
      const absCol = instance.anchorCol + pad.position.colOffset;
      const key = padKey(absRow, absCol);
      dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: key } });
      dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey: key, constraint: null } });
    }

    composerDispatch({ type: 'REMOVE_INSTANCE', instanceId });
  }, [composerWorkspace.placedInstances, dispatch]);

  // Handle in-place mirror of a placed instance
  const handleMirrorInstance = useCallback((instanceId: string) => {
    const instance = composerWorkspace.placedInstances.find(i => i.id === instanceId);
    if (!instance) return;

    // Mirror the pads
    const mirroredPads = mirrorPads(instance.pads, instance.boundingBox);

    // Validate the new placement
    // First remove the current instance's pads from occupied set
    const currentPadKeys = new Set<string>();
    for (const pad of instance.pads) {
      currentPadKeys.add(padKey(
        instance.anchorRow + pad.position.rowOffset,
        instance.anchorCol + pad.position.colOffset,
      ));
    }
    // A locked Sound is not moved by a mirror (canon section 11).
    const shownLayout = state.workingLayout ?? state.activeLayout;
    if ([...currentPadKeys].some(k => isPadLocked(shownLayout, k))) {
      window.alert('Cannot mirror here:\nLocked \u00b7 Unlock to move');
      return;
    }
    const occupiedWithoutSelf = new Set([...occupiedPads].filter(k => !currentPadKeys.has(k)));
    const validation = validatePlacement(mirroredPads, instance.anchorRow, instance.anchorCol, occupiedWithoutSelf);

    if (!validation.valid) {
      window.alert(`Cannot mirror here:\n${validation.reasons.join('\n')}`);
      return;
    }

    // Each lane's pad is its project Sound, resolved by id as at drop time
    // (never the raw lane id, which the performance's events don't carry).
    const soundByLane = new Map<string, SoundStream>();
    for (const pad of mirroredPads) {
      const sound = soundForPresetLane(pad.laneId, state.soundStreams);
      if (!sound) {
        toast.show({ message: FOREIGN_PRESET_MESSAGE, durationMs: 8000 });
        return;
      }
      soundByLane.set(pad.laneId, sound);
    }

    // Remove old pad assignments and finger constraints
    for (const pad of instance.pads) {
      const absRow = instance.anchorRow + pad.position.rowOffset;
      const absCol = instance.anchorCol + pad.position.colOffset;
      const key = padKey(absRow, absCol);
      dispatch({ type: 'REMOVE_VOICE_FROM_PAD', payload: { padKey: key } });
      dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey: key, constraint: null } });
    }

    // Apply mirrored pad assignments
    const newPadToVoice: Record<string, any> = {};
    for (const pad of mirroredPads) {
      const absRow = instance.anchorRow + pad.position.rowOffset;
      const absCol = instance.anchorCol + pad.position.colOffset;
      const key = padKey(absRow, absCol);
      const sound = soundByLane.get(pad.laneId)!;
      newPadToVoice[key] = {
        id: sound.id,
        name: sound.name,
        sourceType: 'midi_track' as const,
        sourceFile: `preset:${instance.presetName}`,
        originalMidiNote: sound.originalMidiNote,
        color: sound.color,
      };
    }
    dispatch({ type: 'MERGE_ASSIGN_PADS', payload: newPadToVoice });

    // Set finger constraints for mirrored pads; unverified fingering is not applied (F9-12)
    for (const pad of mirroredPads) {
      const constraint = presetPadFingerConstraint(pad);
      if (!constraint) continue;
      const key = padKey(instance.anchorRow + pad.position.rowOffset, instance.anchorCol + pad.position.colOffset);
      dispatch({ type: 'SET_FINGER_CONSTRAINT', payload: { padKey: key, constraint } });
    }

    // Update workspace state
    composerDispatch({
      type: 'MIRROR_INSTANCE',
      instanceId,
      mirroredPads,
      boundingBox: instance.boundingBox,
    });
  }, [composerWorkspace.placedInstances, dispatch, occupiedPads, state.workingLayout, state.activeLayout, state.soundStreams, toast]);

  // Compute highlighted stream IDs for the selected instance (for timeline sync)
  const highlightedStreamIds = useMemo(() => {
    if (!composerWorkspace.selectedInstanceId) return undefined;
    const instance = composerWorkspace.placedInstances.find(
      i => i.id === composerWorkspace.selectedInstanceId
    );
    if (!instance) return undefined;
    const ids = new Set<string>();
    for (const lane of instance.lanes) {
      ids.add(lane.id);
    }
    return ids;
  }, [composerWorkspace.selectedInstanceId, composerWorkspace.placedInstances]);

  const displayedCandidate = getDisplayedCandidate(state);
  const assignments = displayedCandidate?.executionPlan.fingerAssignments;
  const selectedCandidate = getSelectedCandidate(state);

  // Active trace for Visual Debugger. Generate no longer selects a candidate,
  // so with none previewed the trace shown is the top-ranked candidate's.
  const activeTrace = state.iterationTrace
    ?? (selectedCandidate ?? state.candidates[0])?.iterationTrace;
  const debuggerIteration = (activeTrace && state.moveHistoryIndex !== null)
    ? activeTrace[state.moveHistoryIndex]
    : undefined;

  const currentLayoutOverride = debuggerIteration
    ? debuggerIteration.stateBefore.layout
    : selectedCandidate?.layout;

  // Wrap generateFull to auto-open analysis after generation
  const handleGenerate = useCallback(async (mode?: Parameters<typeof generateFull>[0]) => {
    await generateFull(mode);
  }, [generateFull]);

  const handleToggleCompare = useCallback((id: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // The compare set is derived from current ids (T08): deleted, promoted or
  // regenerated candidates drop out, and Compare needs two distinct layouts.
  const compareIds = useMemo(
    () => liveCompareIds(selectedForCompare, state),
    [selectedForCompare, state.candidates, state.activeLayout], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const compareEnabled = canCompare(compareIds, state);
  // Said next to the disabled Compare button (T31).
  const compareDisabledReason = compareEnabled ? null
    : state.candidates.length === 0 ? 'Generate candidates first'
    : compareIds.length < 2 ? 'Tick 2 layouts to compare'
    : 'The ticked layouts are the same';
  const liveCompareSet = useMemo(() => new Set(compareIds), [compareIds]);
  useEffect(() => {
    if (compareIds.length !== selectedForCompare.size) setSelectedForCompare(new Set(compareIds));
  }, [compareIds, selectedForCompare.size]);
  useEffect(() => {
    if (compareModalOpen && !compareEnabled) setCompareModalOpen(false);
  }, [compareModalOpen, compareEnabled]);

  const handleOpenCompare = useCallback(() => {
    if (compareEnabled) setCompareModalOpen(true);
  }, [compareEnabled]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
      {/* ─── Top Toolbar ──────────────────────────────────────── */}
      <WorkspaceToolbar
        onNavigateLibrary={() => { saveNow(); navigate('/'); }}
        generateFull={handleGenerate}
        generationProgress={generationProgress}
        analysisPhase={analysisPhase}
        canGenerate={canGenerate}
        generateDisabledReason={generateDisabledReason ?? null}
        compareCount={compareEnabled ? compareIds.length : 0}
        compareDisabledReason={compareDisabledReason}
        onCompare={handleOpenCompare}
        onCalculateCost={() => calculateCost(state.costToggles)}
        hasAssignment={!!assignments?.length}
        saveStatus={saveStatus}
        onSave={saveNow}
        onExport={handleExport}
      />

      {/* ─── Error Banner ─────────────────────────────────────── */}
      {state.error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-pf-md bg-red-500/8 border border-red-500/20 text-red-400 text-pf-sm flex items-center justify-between">
          <span>{state.error}</span>
          <button
            className="ml-2 text-red-500/60 hover:text-red-400 transition-colors"
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
          >
            &times;
          </button>
        </div>
      )}

      {/* ─── Main Body: 3-column ──────────────────────────────── */}
      <div ref={setBodyEl} className="flex-1 flex overflow-hidden p-2.5 gap-0 min-h-0">
        {/* Left Column: Tabbed Sounds / Events */}
        <div data-testid="left-panel" className="flex-shrink-0 flex flex-col transition-all" style={{ width: shownLeftWidth }}>
          {leftCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-4 w-full cursor-pointer hover:bg-[var(--bg-hover)] rounded-pf-lg transition-colors h-full"
              onClick={() => setLeftCollapsed(false)}
              title="Expand sidebar"
            >
              <span className="text-pf-xs text-[var(--text-tertiary)]" style={{ writingMode: 'vertical-lr' }}>
                {leftTab === 'sounds' ? 'Sounds' : leftTab === 'events' ? 'Events' : 'Presets'}
              </span>
              <span className="text-pf-xs text-[var(--text-tertiary)]">&#9656;</span>
            </button>
          ) : (
            <div className="glass-panel flex flex-col flex-1 min-h-0">
              {/* Tab header */}
              <div className="flex items-center border-b border-[var(--border-subtle)] flex-shrink-0">
                <button
                  className={`pf-tab flex-1 text-center ${leftTab === 'sounds' ? 'active' : ''}`}
                  onClick={() => setLeftTab('sounds')}
                >
                  Sounds
                </button>
                <button
                  className={`pf-tab flex-1 text-center ${leftTab === 'events' ? 'active' : ''}`}
                  onClick={() => setLeftTab('events')}
                >
                  Events
                </button>
                <button
                  className={`pf-tab flex-1 text-center ${leftTab === 'presets' ? 'active' : ''}`}
                  onClick={() => setLeftTab('presets')}
                >
                  Presets
                </button>
                <button
                  className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-pf-xs flex-shrink-0 rounded-pf-sm"
                  onClick={() => setLeftCollapsed(true)}
                  title="Collapse sidebar"
                >
                  &#9666;
                </button>
              </div>

              {/* Tab content */}
              <div className={`overflow-y-auto flex-1 min-h-0 ${leftTab === 'presets' ? '' : 'p-2.5'}`}>
                {leftTab === 'sounds' ? (
                  <VoicePalette />
                ) : leftTab === 'events' ? (
                  <EventsPanel onionSkin={onionSkin} onToggleOnionSkin={() => setOnionSkin(!onionSkin)} />
                ) : (
                  <PresetLibraryPanel
                    selectedPresetId={selectedPresetId}
                    onSelectPreset={(id) => {
                      setSelectedPresetId(id);
                      if (id) composerDispatch({ type: 'SELECT_INSTANCE', instanceId: null });
                    }}
                    mirroredPresets={mirroredPresets}
                    onToggleMirror={handleToggleMirror}
                    placedInstances={composerWorkspace.placedInstances}
                    selectedInstanceId={composerWorkspace.selectedInstanceId}
                    onSelectInstance={(id) => {
                      composerDispatch({ type: 'SELECT_INSTANCE', instanceId: id });
                      if (id) setSelectedPresetId(null);
                    }}
                    onDragStartPreset={handleDragStartPreset}
                    onDragEndPreset={handleDragEndPreset}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Left resize handle */}
        {!leftCollapsed && (
          <div
            data-testid="left-panel-handle"
            className="flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-[var(--accent-muted)] transition-colors rounded-sm"
            style={{ width: RESIZE_HANDLE_WIDTH }}
            onMouseDown={e => handleResizeStart('left', e)}
          >
            <div className="w-px h-8 bg-[var(--border-subtle)] group-hover:bg-[var(--accent-primary)] transition-colors rounded-full" />
          </div>
        )}

        {/* Center Column: Grid, splitter and the Timeline | Composer drawer */}
        <div ref={setCenterEl} className="flex-1 flex flex-col min-w-0 min-h-0 px-0.5 overflow-hidden">
          {/* Grid region: measured, and the pads sized to fit it (T04) */}
          <div ref={gridRegionRef} data-testid="grid-region" className="flex-1 min-h-0 overflow-hidden">
            <InteractiveGrid
              padSize={padSize}
              assignments={assignments}
              layoutOverride={currentLayoutOverride}
              selectedEventIndex={state.selectedEventIndex}
              onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
              onionSkin={onionSkin}
              voiceConstraints={state.voiceConstraints}
              gridLabels={viewSettings.gridLabels}
              highlightedInstancePads={highlightedInstancePads}
              onPresetDrop={handlePresetDrop}
              dragPreview={dragPreview}
              onGridDragOver={handleGridDragOver}
              onGridDragLeave={handleGridDragLeave}
              debuggerIteration={debuggerIteration}
            />
          </div>

          <DrawerSplitter
            height={drawerHeight ?? DRAWER_TAB_BAR_HEIGHT}
            maxHeight={maxDrawerHeight(centerHeight)}
            minHeight={minDrawerHeight(centerHeight)}
            collapsed={drawerCollapsed}
            onResize={(height, commit) => {
              const next = { height, collapsed: false };
              if (commit) commitDrawerPrefs(next);
              else setDrawerPrefs(next);
            }}
            onReset={() => commitDrawerPrefs({ height: null, collapsed: false })}
            onToggleCollapsed={() => setDrawerCollapsed(!drawerCollapsed)}
          />

          {/* Timeline / Composer — tabbed view */}
          <div
            data-testid="bottom-drawer"
            className="flex-shrink-0 glass-panel overflow-hidden flex flex-col"
            style={{ height: drawerHeight, minHeight: DRAWER_TAB_BAR_HEIGHT }}
          >
            {/* Tab bar */}
            <div className="flex items-center border-b border-[var(--border-subtle)] flex-shrink-0 px-1" style={{ height: DRAWER_TAB_BAR_HEIGHT }}>
              <button
                data-testid="drawer-tab-timeline"
                className={`pf-tab ${timelineTab === 'timeline' ? 'active' : ''}`}
                onClick={() => openDrawerTab('timeline')}
              >
                Timeline
              </button>
              <button
                data-testid="drawer-tab-composer"
                className={`pf-tab ${timelineTab === 'composer' ? 'active' : ''}`}
                onClick={() => openDrawerTab('composer')}
              >
                Composer
              </button>
              <span className="flex-1" />
              <button
                data-testid="drawer-collapse"
                className="w-7 h-7 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setDrawerCollapsed(!drawerCollapsed)}
                aria-expanded={!drawerCollapsed}
                aria-label={drawerCollapsed ? 'Expand the timeline drawer' : 'Collapse the timeline drawer'}
                title={drawerCollapsed ? 'Expand the drawer' : 'Collapse the drawer (the grid gets the room)'}
              >
                {drawerCollapsed ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            </div>
            {/* Tab content. Both tabs stay mounted, so a tab switch never stops
                playback or drops a pending Composer edit (T60, T67); the
                inactive one is hidden and inert, and so are both while the
                drawer is collapsed. */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <DrawerPanel tab="timeline" active={timelineTab === 'timeline' && !drawerCollapsed}>
                <UnifiedTimeline
                  highlightedStreamIds={highlightedStreamIds}
                  isVisible={timelineTab === 'timeline' && !drawerCollapsed}
                />
              </DrawerPanel>
              <DrawerPanel tab="composer" active={timelineTab === 'composer' && !drawerCollapsed} className="overflow-auto">
                <WorkspacePatternStudio isActive={timelineTab === 'composer' && !drawerCollapsed} />
              </DrawerPanel>
            </div>
          </div>
        </div>

        {/* Right resize handle */}
        <div
          data-testid="right-panel-handle"
          className="flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-[var(--accent-muted)] transition-colors rounded-sm"
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onMouseDown={e => handleResizeStart('right', e)}
        >
          <div className="w-px h-8 bg-[var(--border-subtle)] group-hover:bg-[var(--accent-primary)] transition-colors rounded-full" />
        </div>

        {/* Right Column: Tabbed Costs / Layouts */}
        <div data-testid="right-panel" className="flex-shrink-0 flex flex-col min-h-0 transition-all" style={{ width: shownRightWidth }}>
          {rightCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-4 w-full cursor-pointer hover:bg-[var(--bg-hover)] rounded-pf-lg transition-colors h-full"
              onClick={() => setRightCollapsed(false)}
              title="Expand sidebar"
            >
              <span className="text-pf-xs text-[var(--text-tertiary)]" style={{ writingMode: 'vertical-lr' }}>
                {rightTab === 'costs' ? 'Costs' : 'Layouts'}
              </span>
              <span className="text-pf-xs text-[var(--text-tertiary)]">&#9666;</span>
            </button>
          ) : (
            <div className="glass-panel flex flex-col flex-1 min-h-0">
              {/* Tab header */}
              <div className="flex items-center border-b border-[var(--border-subtle)] flex-shrink-0">
                <button
                  className={`pf-tab flex-1 text-center ${rightTab === 'costs' ? 'active' : ''}`}
                  onClick={() => setRightTab('costs')}
                >
                  Costs
                </button>
                <button
                  className={`pf-tab flex-1 text-center ${rightTab === 'layouts' ? 'active' : ''}`}
                  onClick={() => setRightTab('layouts')}
                >
                  Layouts
                </button>
                <button
                  className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-pf-xs flex-shrink-0 rounded-pf-sm"
                  onClick={() => setRightCollapsed(true)}
                  title="Collapse sidebar"
                >
                  &#9656;
                </button>
              </div>

              {/* Tab content */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {rightTab === 'costs' ? (
                  inspectorPreset ? (
                    <PresetInspector
                      preset={inspectorPreset.preset}
                      instance={inspectorPreset.instance}
                      onRemoveInstance={handleRemoveInstance}
                      onMirrorInstance={handleMirrorInstance}
                    />
                  ) : (
                    <PerformanceCostsPanel />
                  )
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <ActiveLayoutSummary />
                    <LayoutOptionsPanel
                      selectedForCompare={liveCompareSet}
                      compareEnabled={compareEnabled}
                      onToggleCompare={handleToggleCompare}
                      onCompare={handleOpenCompare}
                      onRetryGenerate={handleGenerate}
                    />
                    {((state.moveHistory && state.moveHistory.length > 0) || (activeTrace && activeTrace.length > 0)) && (
                      <div className="p-2.5">
                        <MoveTracePanel
                          moves={state.moveHistory}
                          trace={activeTrace}
                          stopReason={state.moveHistoryStopReason as any}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Compare Modal ────────────────────────────────────── */}
      {compareModalOpen && (
        <CompareModal
          candidateIds={compareIds}
          onClose={() => setCompareModalOpen(false)}
        />
      )}
    </div>
  );
}
