import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../state/ProjectContext';
import { saveProject } from '../../persistence/projectStorage';
import { EditorToolbar } from '../EditorToolbar';
import { VoicePalette } from '../VoicePalette';
import { InteractiveGrid } from '../InteractiveGrid';
import { CompareGridView } from '../CompareGridView';
import { AnalysisSidePanel } from '../AnalysisSidePanel';
import { DiagnosticsPanel } from '../DiagnosticsPanel';
import { EventDetailPanel } from '../EventDetailPanel';
import { TransitionDetailPanel } from './TransitionDetailPanel';
import { UnifiedTimeline } from '../UnifiedTimeline';
import { WorkspacePatternStudio } from './WorkspacePatternStudio';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

type DrawerTab = 'execution' | 'composer';

export function PerformanceWorkspace() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { generateFull, generationProgress, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useKeyboardShortcuts();

  const [drawerTab, setDrawerTab] = useState<DrawerTab>('execution');
  const [gridExpanded, setGridExpanded] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [onionSkin, setOnionSkin] = useState(false);

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
        showAnalysis={showAnalysis}
        setShowAnalysis={setShowAnalysis}
        showDiagnostics={showDiagnostics}
        setShowDiagnostics={setShowDiagnostics}
      />

      {/* ─── Main Grid: Left Sidebar + Center Content ───────────────────── */}
      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: gridExpanded ? '1fr' : `${leftCollapsed ? '48px' : '260px'} minmax(0, 1fr)` }}
      >
        {/* Left Column: Collapsible Sidebar */}
        {!gridExpanded && (
        <div className="space-y-3 min-w-0">
          {leftCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-3 w-full cursor-pointer hover:bg-gray-800/30 rounded transition-colors"
              onClick={() => setLeftCollapsed(false)}
              title="Expand sidebar"
            >
              <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-lr' }}>Sounds</span>
              <span className="text-[10px] text-gray-600">▸</span>
            </button>
          ) : (
            <>
              <div className="p-3 rounded-lg glass-panel space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Workspace Flow</div>
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-colors text-[10px]"
                    onClick={() => setLeftCollapsed(true)}
                    title="Collapse sidebar"
                  >
                    ◂
                  </button>
                </div>
                <div className="text-sm text-gray-200">Edit the performance timeline below, watch the Push grid update on the right, and open the composer to generate or sketch new material.</div>
                <div className="flex gap-2 pt-1">
                  <button
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      drawerTab === 'composer' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                    onClick={() => setDrawerTab('composer')}
                  >
                    Open Composer
                  </button>
                  <button
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      drawerTab === 'execution' ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                    onClick={() => setDrawerTab('execution')}
                  >
                    Timeline View
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg glass-panel">
                <VoicePalette />
              </div>
            </>
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
                  {gridExpanded ? '⊖ Collapse' : '⊕ Expand'}
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
              />
            )}
          </div>

          <EventDetailPanel />
          <TransitionDetailPanel />
        </div>
      </div>

      {/* ─── Bottom Drawer: Unified Timeline / Pattern Composer ─────────── */}
      <div className="rounded-lg glass-panel overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800 bg-gray-900/40">
          <DrawerButton active={drawerTab === 'execution'} onClick={() => setDrawerTab('execution')}>
            Timeline
          </DrawerButton>
          <DrawerButton active={drawerTab === 'composer'} onClick={() => setDrawerTab('composer')}>
            Pattern Composer
          </DrawerButton>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-600">
            {drawerTab === 'execution'
              ? 'Performance timeline with execution analysis'
              : 'Generate or sketch new material into the same timeline'}
          </span>
        </div>

        <div className={drawerTab === 'execution' ? '' : 'p-3'}>
          {drawerTab === 'execution' ? <UnifiedTimeline /> : <WorkspacePatternStudio />}
        </div>
      </div>

      {/* ─── Analysis & Diagnostics Slide-out Panel ─────────────────────── */}
      {(showAnalysis || showDiagnostics) && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => { setShowAnalysis(false); setShowDiagnostics(false); }}
          />
          <div className="fixed top-0 right-0 h-full w-[380px] z-50 glass-panel-strong border-l border-gray-700 shadow-2xl overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Analysis & Diagnostics</h3>
                <button
                  className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
                  onClick={() => { setShowAnalysis(false); setShowDiagnostics(false); }}
                >
                  ×
                </button>
              </div>
              {showAnalysis && <AnalysisSidePanel />}
              {showDiagnostics && state.analysisResult && <DiagnosticsPanel />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function DrawerButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

