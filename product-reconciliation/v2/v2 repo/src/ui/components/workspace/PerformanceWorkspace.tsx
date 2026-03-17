import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../state/ProjectContext';
import { useViewSettings } from '../../state/viewSettings';
import { saveProject } from '../../persistence/projectStorage';
import { EditorToolbar } from '../EditorToolbar';
import { VoicePalette } from '../VoicePalette';
import { EventsPanel } from '../EventsPanel';
import { InteractiveGrid } from '../InteractiveGrid';
import { CompareGridView } from '../CompareGridView';
import { PerformanceAnalysisPanel } from '../panels/PerformanceAnalysisPanel';
import { EventDetailPanel } from '../EventDetailPanel';
import { TransitionDetailPanel } from './TransitionDetailPanel';
import { UnifiedTimeline } from '../UnifiedTimeline';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

type LeftPanelTab = 'sounds' | 'events';

export function PerformanceWorkspace() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { generateFull, generationProgress, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useKeyboardShortcuts();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();

  const [gridExpanded, setGridExpanded] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [onionSkin, setOnionSkin] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('sounds');

  const assignments = state.analysisResult?.executionPlan.fingerAssignments;
  const selectedCandidate = state.candidates.find(candidate => candidate.id === state.selectedCandidateId) ?? null;
  const compareCandidate = state.candidates.find(candidate => candidate.id === state.compareCandidateId) ?? null;
  const isCompareMode = !!selectedCandidate && !!compareCandidate;

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
          onClick={() => {
            saveProject(state);
            navigate('/');
          }}
          title="Save and return to library"
        >
          &larr; Library
        </button>

        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-200 truncate">
            {state.name || 'Untitled'}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">
            Performance Workspace
          </div>
        </div>

        <div className="flex-1" />
      </div>

      {/* ─── Error Banner ───────────────────────────────────────────────── */}
      {state.error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {state.error}
          <button
            className="ml-2 text-red-500 hover:text-red-400"
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
          >
            ×
          </button>
        </div>
      )}

      {/* ─── Editor Toolbar ─────────────────────────────────────────────── */}
      <EditorToolbar
        generateFull={generateFull}
        generationProgress={generationProgress}
        canGenerate={canGenerate}
        generateDisabledReason={generateDisabledReason}
        showAnalysisPanel={showAnalysisPanel}
        setShowAnalysisPanel={setShowAnalysisPanel}
      />

      {/* ─── Main Grid: Left Sidebar + Center Content ───────────────────── */}
      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: gridExpanded ? '1fr' : `${leftCollapsed ? '48px' : '260px'} minmax(0, 1fr)` }}
      >
        {/* Left Column: Collapsible Sidebar with Sounds/Events tabs */}
        {!gridExpanded && (
        <div className="min-w-0">
          {leftCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-3 w-full cursor-pointer hover:bg-gray-800/30 rounded transition-colors"
              onClick={() => setLeftCollapsed(false)}
              title="Expand sidebar"
            >
              <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-lr' }}>
                {leftTab === 'sounds' ? 'Sounds' : 'Events'}
              </span>
              <span className="text-[10px] text-gray-600">&#9656;</span>
            </button>
          ) : (
            <div className="rounded-lg glass-panel overflow-hidden">
              {/* Tab header */}
              <div className="flex items-center border-b border-gray-800">
                <button
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    leftTab === 'sounds'
                      ? 'text-gray-200 bg-gray-800/50 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
                  onClick={() => setLeftTab('sounds')}
                >
                  Sounds
                </button>
                <button
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
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
              <div className="p-3">
                {leftTab === 'sounds' ? (
                  <VoicePalette />
                ) : (
                  <EventsPanel />
                )}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Center Column: Push Grid + Event Detail + Transition Detail */}
        <div className="space-y-3 min-w-0">
          <div className="p-3 rounded-lg glass-panel">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">
                {isCompareMode ? 'Layout Compare' : 'Push Grid'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Timeline-linked</span>
                <button
                  className={`text-[10px] transition-colors px-1.5 py-0.5 rounded ${
                    onionSkin ? 'text-sky-300 bg-sky-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                  onClick={() => setOnionSkin(!onionSkin)}
                  title={onionSkin ? 'Disable onion skin' : 'Show previous/next event layers'}
                >
                  Onion Skin
                </button>
                <button
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-700/50"
                  onClick={() => setGridExpanded(!gridExpanded)}
                  title={gridExpanded ? 'Exit full view' : 'Expand grid'}
                >
                  {gridExpanded ? '\u2296 Collapse' : '\u2295 Expand'}
                </button>
              </div>
            </div>
            {isCompareMode ? (
              <CompareGridView
                candidateA={selectedCandidate}
                candidateB={compareCandidate}
                voices={state.soundStreams}
                candidateAIndex={state.candidates.indexOf(selectedCandidate) + 1}
                candidateBIndex={state.candidates.indexOf(compareCandidate) + 1}
              />
            ) : (
              <InteractiveGrid
                assignments={assignments}
                layoutOverride={selectedCandidate?.layout}
                selectedEventIndex={state.selectedEventIndex}
                onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                onionSkin={onionSkin}
                voiceConstraints={state.voiceConstraints}
              />
            )}
          </div>

          <EventDetailPanel />
          <TransitionDetailPanel />
        </div>
      </div>

      {/* ─── Bottom Drawer: Unified Timeline ─────────────────────────────── */}
      <div className="rounded-lg glass-panel overflow-hidden">
        <UnifiedTimeline />
      </div>

      {/* ─── Unified Performance Analysis Panel (Right Slide-out) ─────── */}
      {showAnalysisPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setShowAnalysisPanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[400px] z-50 glass-panel-strong border-l border-gray-700 shadow-2xl">
            <PerformanceAnalysisPanel
              onClose={() => setShowAnalysisPanel(false)}
              viewSettings={viewSettings}
              onToggleGridLabel={toggleGridLabel}
              onToggleLayoutDisplay={toggleLayoutDisplay}
              onDuplicateLayout={() => {
                if (state.workingLayout) {
                  dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.workingLayout.name} copy`, source: 'working' } });
                } else {
                  // Create a working copy of active, save it as variant, then discard
                  dispatch({ type: 'CREATE_WORKING_LAYOUT' });
                  dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} copy`, source: 'working' } });
                  dispatch({ type: 'DISCARD_WORKING_LAYOUT' });
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
