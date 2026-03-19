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
 * - Right: ActiveLayoutSummary + LayoutOptionsPanel
 * - Bottom drawer: Pattern Composer (collapsible)
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../state/ProjectContext';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useViewSettings } from '../../state/viewSettings';

import { WorkspaceToolbar } from './WorkspaceToolbar';
import { VoicePalette } from '../VoicePalette';
import { EventsPanel } from '../EventsPanel';
import { InteractiveGrid } from '../InteractiveGrid';
import { UnifiedTimeline } from '../UnifiedTimeline';
import { WorkspacePatternStudio } from './WorkspacePatternStudio';
import { ActiveLayoutSummary } from '../panels/ActiveLayoutSummary';
import { LayoutOptionsPanel } from '../panels/LayoutOptionsPanel';
import { CompareModal } from '../panels/CompareModal';

type LeftPanelTab = 'sounds' | 'events';

export function PerformanceWorkspace() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { generateFull, calculateCost, generationProgress, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useKeyboardShortcuts();
  const { settings: viewSettings } = useViewSettings();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('sounds');
  const [onionSkin, setOnionSkin] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  // Compare state
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareModalOpen, setCompareModalOpen] = useState(false);

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
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      {/* ─── Top Toolbar ──────────────────────────────────────── */}
      <WorkspaceToolbar
        onNavigateLibrary={() => navigate('/')}
        generateFull={handleGenerate}
        generationProgress={generationProgress}
        canGenerate={canGenerate}
        generateDisabledReason={generateDisabledReason ?? null}
        compareCount={selectedForCompare.size}
        onCompare={handleOpenCompare}
        composerOpen={composerOpen}
        onToggleComposer={() => setComposerOpen(!composerOpen)}
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
      <div className="flex-1 flex gap-3 overflow-hidden p-3 min-h-0">
        {/* Left Column: Tabbed Sounds / Events */}
        <div className={`flex-shrink-0 flex flex-col ${leftCollapsed ? 'w-10' : 'w-[280px]'} transition-all`}>
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

        {/* Center Column: Grid + Timeline stacked */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          {/* Push Grid — takes available space */}
          <div className="flex-1 min-h-0 rounded-lg glass-panel p-3 flex flex-col">
            <div className="flex-1 min-h-0 flex items-center justify-center">
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

          {/* Timeline — fixed height */}
          <div className="h-[220px] flex-shrink-0 rounded-lg glass-panel overflow-hidden">
            <UnifiedTimeline />
          </div>
        </div>

        {/* Right Column: Summary + Options stacked */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-3 min-h-0">
          <ActiveLayoutSummary />
          <LayoutOptionsPanel
            selectedForCompare={selectedForCompare}
            onToggleCompare={handleToggleCompare}
            onCompare={handleOpenCompare}
          />
        </div>
      </div>

      {/* ─── Pattern Composer Bottom Drawer ────────────────────── */}
      {composerOpen && (
        <div className="flex-shrink-0 border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60">
            <span className="text-[11px] text-gray-300 font-medium">Pattern Composer</span>
            <div className="flex-1" />
            <span className="text-[10px] text-gray-600">Create and edit rhythmic patterns</span>
            <button
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              onClick={() => setComposerOpen(false)}
            >
              &times; Close
            </button>
          </div>
          <WorkspacePatternStudio />
        </div>
      )}

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
