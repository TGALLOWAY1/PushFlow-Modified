/**
 * EditorToolbar.
 *
 * Top bar for the project editor: project name, layout status indicator,
 * V3 workflow actions (promote/save/discard), undo/redo, save/export,
 * generation controls, analysis stale indicator.
 *
 * The "Promote" action for candidates is now in the candidate preview
 * cards within the PerformanceAnalysisPanel. The toolbar still has
 * Promote for the working layout (separate workflow action).
 */

import { useState, useRef } from 'react';
import { useProject } from '../state/ProjectContext';
import { saveProject, exportProjectToFile } from '../persistence/projectStorage';
import { getDisplayedLayout, getDisplayedLayoutRole, hasWorkingChanges } from '../state/projectState';
import { type GenerationMode } from '../hooks/useAutoAnalysis';
import { type OptimizerMethodKey } from '../../engine/optimization/optimizerInterface';
import { type GreedyLayoutStrategy, GREEDY_STRATEGY_LABELS } from '../../engine/optimization/greedyCandidatePipeline';

interface EditorToolbarProps {
  generateFull?: (mode?: GenerationMode) => Promise<void>;
  generationProgress?: string | null;
  canGenerate?: boolean;
  generateDisabledReason?: string | null;
}

export function EditorToolbar({
  generateFull,
  generationProgress,
  canGenerate = true,
  generateDisabledReason,
}: EditorToolbarProps = {}) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const displayedLayout = getDisplayedLayout(state);
  const layoutRole = getDisplayedLayoutRole(state);
  const hasChanges = hasWorkingChanges(state);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');
  const [saveConfirm, setSaveConfirm] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = () => {
    saveProject(state);
    setSaveConfirm(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveConfirm(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
      {/* Project name */}
      <h1 className="text-pf-lg font-bold truncate text-[var(--text-primary)]">{state.name}</h1>

      {/* Layout status indicator */}
      {displayedLayout && (
        <div className="flex items-center gap-1.5">
          <span className={`pf-badge ${
            layoutRole === 'working'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
          }`}>
            {layoutRole === 'working' ? 'Working Draft' : 'Active Layout'}
          </span>
          <span className="text-pf-xs text-[var(--text-tertiary)] truncate max-w-[120px]">
            {displayedLayout.name}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Workflow actions (visible when working layout exists) */}
      {hasChanges && (
        <div className="flex gap-1 border-r border-[var(--border-subtle)] pr-3 mr-1">
          <button
            className="pf-btn text-pf-sm bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"
            onClick={() => dispatch({ type: 'PROMOTE_WORKING_LAYOUT' })}
            title="Make this layout the new Active Layout (auto-saves replaced active as variant)"
          >
            Promote
          </button>
          <button
            className="pf-btn text-pf-sm bg-[var(--accent-primary)]/80 hover:bg-[var(--accent-primary)] text-white border border-[var(--accent-primary)]/30"
            onClick={() => dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} variant`, source: 'working' } })}
            title="Save current working layout as a named variant"
          >
            Save Variant
          </button>
          <button
            className="pf-btn pf-btn-subtle text-pf-sm hover:bg-red-900/30 hover:text-red-300 hover:border-red-500/30"
            onClick={() => dispatch({ type: 'DISCARD_WORKING_LAYOUT' })}
            title="Discard working changes and return to Active Layout"
          >
            Discard
          </button>
        </div>
      )}

      {/* Saved variants indicator */}
      {state.savedVariants.length > 0 && (
        <span className="text-pf-xs text-[var(--text-tertiary)]" title={`${state.savedVariants.length} saved variant(s)`}>
          {state.savedVariants.length} variant{state.savedVariants.length !== 1 ? 's' : ''}
        </span>
      )}

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          className="pf-btn pf-btn-subtle text-pf-sm"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="pf-btn pf-btn-subtle text-pf-sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      {/* Save */}
      <button
        className={`pf-btn text-pf-sm ${
          saveConfirm
            ? 'bg-emerald-600/12 text-emerald-400 border border-emerald-500/20'
            : 'pf-btn-subtle'
        }`}
        onClick={handleSave}
        title="Save project"
      >
        {saveConfirm ? 'Saved' : 'Save'}
      </button>

      {/* Export */}
      <button
        className="pf-btn pf-btn-subtle text-pf-sm"
        onClick={() => exportProjectToFile(state)}
        title="Export as JSON"
      >
        Export
      </button>

      {/* Generate */}
      {generateFull && (
        <div className="flex items-center gap-1.5 border-l border-[var(--border-subtle)] pl-3 ml-1">
          {state.isProcessing ? (
            <span className="text-pf-sm text-[var(--accent-primary)] animate-pulse px-2.5 py-1 rounded-pf-md bg-[var(--accent-muted)] border border-[var(--accent-primary)]/15">
              {generationProgress || 'Running analysis...'}
            </span>
          ) : (
            <>
              <select
                className="pf-select"
                value={state.optimizerMethod}
                onChange={(e) => dispatch({ type: 'SET_OPTIMIZER_METHOD', payload: e.target.value as OptimizerMethodKey })}
                title="Greedy: interpretable step-by-step. Beam: fast finger assignment. Annealing: deep layout optimization."
              >
                <option value="greedy">Greedy</option>
                <option value="beam">Beam Search</option>
                <option value="annealing">Annealing</option>
              </select>

              {state.optimizerMethod === 'greedy' && (
                <select
                  className="pf-select"
                  value={state.greedyStrategy}
                  onChange={(e) => dispatch({ type: 'SET_GREEDY_STRATEGY', payload: e.target.value as GreedyLayoutStrategy })}
                  title="Layout seeding strategy. All: run every strategy. Individual: focus on one approach."
                >
                  {Object.entries(GREEDY_STRATEGY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              )}

              {state.optimizerMethod === 'annealing' && (
                <select
                  className="pf-select"
                  value={generationMode}
                  onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                  title="Quick: fast optimization (~3s). Thorough: deep optimization (~10-15s). Auto: chooses based on complexity."
                >
                  <option value="fast">Quick</option>
                  <option value="deep">Thorough</option>
                  <option value="auto">Auto</option>
                </select>
              )}

              <button
                className={`pf-btn text-pf-sm font-medium ${
                  canGenerate
                    ? 'pf-btn-primary'
                    : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] cursor-not-allowed'
                }`}
                onClick={() => canGenerate && generateFull(generationMode)}
                disabled={!canGenerate}
                title={generateDisabledReason ?? 'Generate optimized layout'}
              >
                Generate
              </button>
            </>
          )}
        </div>
      )}

      {/* Analysis stale indicator */}
      {state.analysisStale && state.analysisResult && (
        <span className="pf-badge text-amber-400 bg-amber-500/8 border border-amber-500/15 ml-2">
          Analysis outdated
        </span>
      )}
    </div>
  );
}
