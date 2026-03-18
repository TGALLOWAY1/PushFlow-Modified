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
  const { generateFull, generationProgress, canGenerate, generateDisabledReason } = useAutoAnalysis();
  useKeyboardShortcuts();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [onionSkin, setOnionSkin] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('sounds');
  const [bottomTab, setBottomTab] = useState<BottomTab>('timeline');
  const [leftWidth, setLeftWidth] = useState(260);
  const isResizing = useRef(false);

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

  // Sidebar resize via drag handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(450, startWidth + (ev.clientX - startX)));
      setLeftWidth(newWidth);
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
  }, [leftWidth]);

  // Build grid template columns for the 3-column layout
  const leftCol = leftCollapsed ? '48px' : `${leftWidth}px`;
  const rightCol = rightCollapsed ? '48px' : '340px';
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
            <div
              className="text-sm font-medium text-gray-200 truncate cursor-pointer hover:text-white transition-colors"
              onDoubleClick={() => {
                setNameDraft(state.name || 'Untitled');
                setEditingName(true);
              }}
              title="Double-click to rename"
            >
              {state.name || 'Untitled'}
            </div>
          )}
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] flex items-center gap-1">
            Performance Workspace
            {editingBpm ? (
              <input
                className="ml-2 w-14 text-[10px] normal-case tracking-normal text-gray-200 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 outline-none focus:border-blue-500"
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
              <span
                className="ml-2 normal-case tracking-normal text-gray-600 cursor-pointer hover:text-gray-400 transition-colors"
                onDoubleClick={() => {
                  setBpmDraft(String(state.tempo));
                  setEditingBpm(true);
                }}
                title="Double-click to change BPM"
              >
                {state.tempo} BPM
              </span>
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
            <div className="rounded-lg glass-panel overflow-hidden flex flex-col" style={{ maxHeight: 560 }}>
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
              onMouseDown={handleResizeStart}
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
              <InteractiveGrid
                assignments={assignments}
                layoutOverride={selectedCandidate?.layout}
                selectedEventIndex={state.selectedEventIndex}
                onEventClick={idx => dispatch({ type: 'SELECT_EVENT', payload: idx })}
                onionSkin={onionSkin}
                voiceConstraints={state.voiceConstraints}
                gridLabels={viewSettings.gridLabels}
              />
            )}
          </div>

          <EventDetailPanel />
          <TransitionDetailPanel />
        </div>

        {/* Right Column: Collapsible Analysis Panel */}
        <div className="min-w-0">
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
            <div className="rounded-lg glass-panel overflow-hidden" style={{ maxHeight: 560 }}>
              <PerformanceAnalysisPanel
                onClose={() => setRightCollapsed(true)}
              />
            </div>
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
