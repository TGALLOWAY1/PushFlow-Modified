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

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../state/ProjectContext';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useViewSettings, ViewSettingsProvider } from '../../state/viewSettings';

import { WorkspaceToolbar } from './WorkspaceToolbar';
import { VoicePalette } from '../VoicePalette';
import { EventsPanel } from '../EventsPanel';
import { InteractiveGrid } from '../InteractiveGrid';
import { UnifiedTimeline } from '../UnifiedTimeline';
import { WorkspacePatternStudio } from './WorkspacePatternStudio';
import { ActiveLayoutSummary } from '../panels/ActiveLayoutSummary';
import { LayoutOptionsPanel } from '../panels/LayoutOptionsPanel';
import { CompareModal } from '../panels/CompareModal';
import { MoveTracePanel } from '../panels/MoveTracePanel';

type LeftPanelTab = 'sounds' | 'events';
type RightPanelTab = 'costs' | 'layouts';
type TimelineTab = 'timeline' | 'composer';

// Panel width constraints
const LEFT_MIN = 200;
const LEFT_MAX = 500;
const LEFT_DEFAULT = 280;
const RIGHT_MIN = 280;
const RIGHT_MAX = 600;
const RIGHT_DEFAULT = 340;

export function PerformanceWorkspace() {
  return (
    <ViewSettingsProvider>
      <PerformanceWorkspaceInner />
    </ViewSettingsProvider>
  );
}

function PerformanceWorkspaceInner() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { generateFull, calculateCost, generationProgress, analysisPhase, canGenerate, generateDisabledReason } = useAutoAnalysis();
  const { saveStatus, saveNow } = useAutoSave(state);
  useKeyboardShortcuts();
  const { settings: viewSettings } = useViewSettings();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('sounds');
  const [rightTab, setRightTab] = useState<RightPanelTab>('costs');
  const [onionSkin, setOnionSkin] = useState(false);
  const [timelineTab, setTimelineTab] = useState<TimelineTab>('timeline');

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const isResizing = useRef<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Grid scaling — ResizeObserver measures container, scale grid to fit
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridScale, setGridScale] = useState(1);
  const GRID_NATURAL_SIZE = 8 * (56 + 4) + 40; // 8 cells * (cell + gap) + padding/labels

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const available = Math.min(width, height);
        const scale = Math.min(1.2, available / GRID_NATURAL_SIZE);
        setGridScale(Math.max(0.5, scale));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compare state
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Resize handlers
  const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    isResizing.current = side;
    startX.current = e.clientX;
    startWidth.current = side === 'left' ? leftWidth : rightWidth;
    e.preventDefault();
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const dx = e.clientX - startX.current;
      if (isResizing.current === 'left') {
        setLeftWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, startWidth.current + dx)));
      } else {
        setRightWidth(Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startWidth.current - dx)));
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

  const assignments = state.analysisResult?.executionPlan.fingerAssignments;
  const selectedCandidate = state.candidates.find(c => c.id === state.selectedCandidateId) ?? null;

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

  const handleOpenCompare = useCallback(() => {
    if (selectedForCompare.size >= 2) {
      setCompareModalOpen(true);
    }
  }, [selectedForCompare]);

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
        compareCount={selectedForCompare.size}
        onCompare={handleOpenCompare}
        composerOpen={timelineTab === 'composer'}
        onToggleComposer={() => setTimelineTab(timelineTab === 'composer' ? 'timeline' : 'composer')}
        onCalculateCost={() => calculateCost(state.costToggles)}
        hasAssignment={!!(state.analysisResult?.executionPlan?.fingerAssignments?.length)}
        saveStatus={saveStatus}
        onSave={saveNow}
      />

      {/* ─── Error Banner ─────────────────────────────────────── */}
      {state.error && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] flex items-center justify-between">
          <span>{state.error}</span>
          <button
            className="ml-2 text-red-500 hover:text-red-400"
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
          >
            &times;
          </button>
        </div>
      )}

      {/* ─── Main Body: 3-column ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden p-3 min-h-0">
        {/* Left Column: Tabbed Sounds / Events */}
        <div className="flex-shrink-0 flex flex-col transition-all" style={{ width: leftCollapsed ? 40 : leftWidth }}>
          {leftCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-4 w-full cursor-pointer hover:bg-gray-800/30 rounded-lg transition-colors h-full"
              onClick={() => setLeftCollapsed(false)}
              title="Expand sidebar"
            >
              <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-lr' }}>
                {leftTab === 'sounds' ? 'Sounds' : 'Events'}
              </span>
              <span className="text-[10px] text-gray-600">&#9656;</span>
            </button>
          ) : (
            <div className="rounded-lg glass-panel flex flex-col flex-1 min-h-0">
              {/* Tab header */}
              <div className="flex items-center border-b border-gray-800 flex-shrink-0">
                <button
                  className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                    leftTab === 'sounds'
                      ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
                  onClick={() => setLeftTab('sounds')}
                >
                  Sounds
                </button>
                <button
                  className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                    leftTab === 'events'
                      ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
                  onClick={() => setLeftTab('events')}
                >
                  Events
                </button>
                <button
                  className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-colors text-[10px] flex-shrink-0"
                  onClick={() => setLeftCollapsed(true)}
                  title="Collapse sidebar"
                >
                  &#9666;
                </button>
              </div>

              {/* Tab content */}
              <div className="p-3 overflow-y-auto flex-1 min-h-0">
                {leftTab === 'sounds' ? (
                  <VoicePalette />
                ) : (
                  <EventsPanel onionSkin={onionSkin} onToggleOnionSkin={() => setOnionSkin(!onionSkin)} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Left resize handle */}
        {!leftCollapsed && (
          <div
            className="w-1.5 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-blue-500/20 transition-colors"
            onMouseDown={e => handleResizeStart('left', e)}
          >
            <div className="w-px h-8 bg-gray-700 group-hover:bg-blue-400 transition-colors" />
          </div>
        )}

        {/* Center Column: Grid + Timeline stacked */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0 px-1.5 overflow-hidden">
          {/* Push Grid — takes available space, scales to fill */}
          <div className="flex-1 min-h-0 rounded-lg glass-panel p-1 flex flex-col">
            <div ref={gridContainerRef} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              <div style={{ transform: `scale(${gridScale})`, transformOrigin: 'center' }}>
                <InteractiveGrid
                  assignments={assignments}
                  layoutOverride={selectedCandidate?.layout}
                  selectedEventIndex={state.selectedEventIndex}
                  onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                  onionSkin={onionSkin}
                  voiceConstraints={state.voiceConstraints}
                  gridLabels={viewSettings.gridLabels}
                />
              </div>
            </div>
          </div>

          {/* Timeline / Composer — tabbed view */}
          <div className="flex-[0_1_280px] min-h-[120px] rounded-lg glass-panel overflow-hidden flex flex-col">
            {/* Tab bar */}
            <div className="flex items-center border-b border-gray-800 flex-shrink-0 px-2">
              <button
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  timelineTab === 'timeline'
                    ? 'text-gray-200 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setTimelineTab('timeline')}
              >
                Timeline
              </button>
              <button
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  timelineTab === 'composer'
                    ? 'text-gray-200 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setTimelineTab('composer')}
              >
                Composer
              </button>
            </div>
            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {timelineTab === 'timeline' ? (
                <UnifiedTimeline />
              ) : (
                <div className="h-full overflow-auto">
                  <WorkspacePatternStudio />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right resize handle */}
        <div
          className="w-1.5 flex-shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-blue-500/20 transition-colors"
          onMouseDown={e => handleResizeStart('right', e)}
        >
          <div className="w-px h-8 bg-gray-700 group-hover:bg-blue-400 transition-colors" />
        </div>

        {/* Right Column: Tabbed Costs / Layouts */}
        <div className="flex-shrink-0 flex flex-col min-h-0" style={{ width: rightWidth }}>
          <div className="rounded-lg glass-panel flex flex-col flex-1 min-h-0">
            {/* Tab header */}
            <div className="flex items-center border-b border-gray-800 flex-shrink-0">
              <button
                className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                  rightTab === 'costs'
                    ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
                onClick={() => setRightTab('costs')}
              >
                Costs
              </button>
              <button
                className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                  rightTab === 'layouts'
                    ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                }`}
                onClick={() => setRightTab('layouts')}
              >
                Layouts
              </button>
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {rightTab === 'costs' ? (
                <ActiveLayoutSummary />
              ) : (
                <div className="flex flex-col gap-3">
                  <LayoutOptionsPanel
                    selectedForCompare={selectedForCompare}
                    onToggleCompare={handleToggleCompare}
                    onCompare={handleOpenCompare}
                  />
                  {state.moveHistory && state.moveHistory.length > 0 && (
                    <div className="p-3">
                      <MoveTracePanel
                        moves={state.moveHistory}
                        stopReason={state.moveHistoryStopReason as any}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Compare Modal ────────────────────────────────────── */}
      {compareModalOpen && (
        <CompareModal
          candidateIds={Array.from(selectedForCompare)}
          onClose={() => setCompareModalOpen(false)}
        />
      )}
    </div>
  );
}

