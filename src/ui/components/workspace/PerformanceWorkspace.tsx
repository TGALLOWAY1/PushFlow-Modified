import { useState, useRef, useCallback } from 'react';
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
import { WorkspacePatternStudio } from './WorkspacePatternStudio';

import { SettingsGear } from '../panels/SettingsGear';
import { useAutoAnalysis } from '../../hooks/useAutoAnalysis';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

type LeftPanelTab = 'sounds' | 'events';
type BottomTab = 'timeline' | 'composer';

export function PerformanceWorkspace() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { generateFull, calculateCost, generationProgress, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useKeyboardShortcuts();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [onionSkin, setOnionSkin] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('sounds');
  const [bottomTab, setBottomTab] = useState<BottomTab>('timeline');
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(360);
  const isResizing = useRef<'left' | 'right' | false>(false);

  // Editable project name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Editable BPM
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  const assignments = state.analysisResult?.executionPlan.fingerAssignments;
  const selectedCandidate = state.candidates.find(candidate => candidate.id === state.selectedCandidateId) ?? null;
  const compareCandidate = state.candidates.find(candidate => candidate.id === state.compareCandidateId) ?? null;
  const isCompareMode = !!selectedCandidate && !!compareCandidate;

  // When stepping through optimization trace, show the layout snapshot for that step
  const traceLayoutOverride = state.moveHistoryIndex !== null && state.moveHistory
    ? state.moveHistory[state.moveHistoryIndex]?.layoutSnapshot ?? null
    : null;

  // Wrap generateFull to auto-open the analysis panel after generation
  const handleGenerate = useCallback(async (mode?: Parameters<typeof generateFull>[0]) => {
    const count = await generateFull(mode);
    if (count && count > 0) {
      setRightCollapsed(false);
    }
  }, [generateFull]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== state.name) {
      dispatch({ type: 'RENAME_PROJECT', payload: trimmed });
    }
    setEditingName(false);
  };

  const commitBpm = () => {
    const val = parseInt(bpmDraft, 10);
    if (!isNaN(val) && val !== state.tempo) {
      dispatch({ type: 'SET_TEMPO', payload: val });
    }
    setEditingBpm(false);
  };

  // Panel resize via drag handle (shared for left and right)
  const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = side;
    const startX = e.clientX;
    const startWidth = side === 'left' ? leftWidth : rightWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = ev.clientX - startX;
      if (side === 'left') {
        setLeftWidth(Math.max(200, Math.min(500, startWidth + delta)));
      } else {
        // Right panel: dragging left increases width
        setRightWidth(Math.max(280, Math.min(600, startWidth - delta)));
      }
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth]);

  // Build grid template columns for the 3-column layout
  const leftCol = leftCollapsed ? '48px' : `${leftWidth}px`;
  const rightCol = rightCollapsed ? '48px' : `${rightWidth}px`;
  const gridCols = `${leftCol} minmax(0, 1fr) ${rightCol}`;

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
          {editingName ? (
            <input
              ref={nameInputRef}
              className="text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 outline-none focus:border-blue-500 w-48"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
            />
          ) : (
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-gray-200 truncate hover:text-white transition-colors group"
              onClick={() => {
                setNameDraft(state.name || 'Untitled');
                setEditingName(true);
              }}
              title="Click to rename"
            >
              <span className="truncate">{state.name || 'Untitled'}</span>
              <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
            Performance Workspace
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {editingBpm ? (
              <input
                className="w-16 text-xs text-gray-200 bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 outline-none"
                type="number"
                min={20}
                max={999}
                value={bpmDraft}
                onChange={e => setBpmDraft(e.target.value)}
                onBlur={commitBpm}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitBpm();
                  if (e.key === 'Escape') setEditingBpm(false);
                }}
                autoFocus
              />
            ) : (
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent hover:border-gray-600 transition-colors group"
                onClick={() => {
                  setBpmDraft(String(state.tempo));
                  setEditingBpm(true);
                }}
                title="Click to change BPM"
              >
                <span className="font-mono">{state.tempo}</span>
                <span className="text-gray-500">BPM</span>
                <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
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
        generateFull={handleGenerate}
        generationProgress={generationProgress}
        canGenerate={canGenerate}
        generateDisabledReason={generateDisabledReason}
      />

      {/* ─── Main Grid: Left Sidebar + Center Content + Right Analysis ── */}
      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* Left Column: Collapsible Sidebar with Sounds/Events tabs */}
        <div className="min-w-0 relative flex">
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
            <div className="rounded-lg glass-panel flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
              {/* Tab header */}
              <div className="flex items-center border-b border-gray-800 flex-shrink-0">
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

              {/* Tab content — scrollable */}
              <div className="p-3 overflow-y-auto flex-1">
                {leftTab === 'sounds' ? (
                  <VoicePalette />
                ) : (
                  <EventsPanel onionSkin={onionSkin} onToggleOnionSkin={() => setOnionSkin(!onionSkin)} />
                )}
              </div>
            </div>
          )}
          {/* Drag handle for resizing */}
          {!leftCollapsed && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
              onMouseDown={(e) => handleResizeStart('left', e)}
            />
          )}
        </div>

        {/* Center Column: Push Grid + Event Detail + Transition Detail */}
        <div className="space-y-3 min-w-0">
          <div className="p-3 rounded-lg glass-panel">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">
                {isCompareMode ? 'Layout Compare' : 'Push Grid'}
              </h3>
              <div className="flex items-center gap-2">
                <SettingsGear
                  gridLabels={viewSettings.gridLabels}
                  layoutDisplay={viewSettings.layoutDisplay}
                  onToggleGridLabel={toggleGridLabel}
                  onToggleLayoutDisplay={toggleLayoutDisplay}
                  onDuplicateLayout={() => {
                    if (state.workingLayout) {
                      dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.workingLayout.name} copy`, source: 'working' } });
                    } else {
                      dispatch({ type: 'CREATE_WORKING_LAYOUT' });
                      dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} copy`, source: 'working' } });
                      dispatch({ type: 'DISCARD_WORKING_LAYOUT' });
                    }
                  }}
                />
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
              <>
                <InteractiveGrid
                  assignments={assignments}
                  layoutOverride={traceLayoutOverride ?? selectedCandidate?.layout}
                  selectedEventIndex={state.selectedEventIndex}
                  onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                  onionSkin={onionSkin}
                  voiceConstraints={state.voiceConstraints}
                  gridLabels={viewSettings.gridLabels}
                />
                {traceLayoutOverride && state.moveHistoryIndex !== null && (
                  <div className="flex items-center gap-2 mt-1 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Showing optimization step {state.moveHistoryIndex + 1} of {state.moveHistory?.length ?? 0}
                    <button
                      className="ml-auto text-cyan-500 hover:text-cyan-300"
                      onClick={() => dispatch({ type: 'SET_MOVE_HISTORY_INDEX', payload: null })}
                    >
                      Show final
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <EventDetailPanel />
          <TransitionDetailPanel />
        </div>

        {/* Right Column: Collapsible Analysis Panel */}
        <div className="min-w-0 relative">
          {rightCollapsed ? (
            <button
              className="flex flex-col items-center gap-3 py-3 w-full cursor-pointer hover:bg-gray-800/30 rounded transition-colors"
              onClick={() => setRightCollapsed(false)}
              title="Expand analysis panel"
            >
              <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-lr' }}>
                Analysis
              </span>
              <span className="text-[10px] text-gray-600">&#9666;</span>
            </button>
          ) : (
            <>
              <div className="rounded-lg glass-panel flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
                <PerformanceAnalysisPanel
                  onClose={() => setRightCollapsed(true)}
                  calculateCost={calculateCost}
                />
              </div>
              {/* Drag handle for resizing */}
              <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
                onMouseDown={(e) => handleResizeStart('right', e)}
              />
            </>
          )}
        </div>
      </div>

      {/* ─── Bottom Drawer: Timeline / Pattern Composer ─────────────────── */}
      <div className="rounded-lg glass-panel overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800 bg-gray-900/40">
          <button
            className={`px-2 py-1 text-xs rounded transition-colors ${
              bottomTab === 'timeline'
                ? 'text-gray-200 bg-gray-800/60'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            onClick={() => setBottomTab('timeline')}
          >
            Timeline
          </button>
          <button
            className={`px-2 py-1 text-xs rounded transition-colors ${
              bottomTab === 'composer'
                ? 'text-gray-200 bg-gray-800/60'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            onClick={() => setBottomTab('composer')}
          >
            Pattern Composer
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-600">
            {bottomTab === 'timeline'
              ? 'Performance timeline with execution analysis'
              : 'Create and edit rhythmic patterns'}
          </span>
        </div>
        <div>
          {bottomTab === 'timeline' ? <UnifiedTimeline /> : <WorkspacePatternStudio />}
        </div>
      </div>
    </div>
  );
}
