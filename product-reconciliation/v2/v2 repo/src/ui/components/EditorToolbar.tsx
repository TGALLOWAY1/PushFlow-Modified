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

import { useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { saveProject, exportProjectToFile } from '../persistence/projectStorage';
import { getDisplayedLayout, getDisplayedLayoutRole, hasWorkingChanges } from '../state/projectState';
import { type GenerationMode } from '../hooks/useAutoAnalysis';

interface EditorToolbarProps {
  generateFull?: (mode?: GenerationMode) => Promise<void>;
  generationProgress?: string | null;
  canGenerate?: boolean;
  generateDisabledReason?: string | null;
  showAnalysisPanel?: boolean;
  setShowAnalysisPanel?: (show: boolean) => void;
}

export function EditorToolbar({
  generateFull,
  generationProgress,
  canGenerate = true,
  generateDisabledReason,
  showAnalysisPanel,
  setShowAnalysisPanel,
}: EditorToolbarProps = {}) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const displayedLayout = getDisplayedLayout(state);
  const layoutRole = getDisplayedLayoutRole(state);
  const hasChanges = hasWorkingChanges(state);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');

  return (
    <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
      {/* Project name */}
      <h1 className="text-lg font-bold truncate">{state.name}</h1>

      {/* Layout status indicator */}
      {displayedLayout && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            layoutRole === 'working'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          }`}>
            {layoutRole === 'working' ? 'Working Draft' : 'Active Layout'}
          </span>
          <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
            {displayedLayout.name}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Workflow actions (visible when working layout exists) */}
      {hasChanges && (
        <div className="flex gap-1 border-r border-gray-800 pr-3 mr-1">
          <button
            className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            onClick={() => dispatch({ type: 'PROMOTE_WORKING_LAYOUT' })}
            title="Make this layout the new Active Layout (auto-saves replaced active as variant)"
          >
            Promote
          </button>
          <button
            className="px-2 py-1 text-xs rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
            onClick={() => dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} variant`, source: 'working' } })}
            title="Save current working layout as a named variant"
          >
            Save Variant
          </button>
          <button
            className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-300 transition-colors"
            onClick={() => dispatch({ type: 'DISCARD_WORKING_LAYOUT' })}
            title="Discard working changes and return to Active Layout"
          >
            Discard
          </button>
        </div>
      )}

      {/* Saved variants indicator */}
      {state.savedVariants.length > 0 && (
        <span className="text-[10px] text-gray-500" title={`${state.savedVariants.length} saved variant(s)`}>
          {state.savedVariants.length} variant{state.savedVariants.length !== 1 ? 's' : ''}
        </span>
      )}

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      {/* Save */}
      <button
        className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700"
        onClick={() => saveProject(state)}
        title="Save project"
      >
        Save
      </button>

      {/* Export */}
      <button
        className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700"
        onClick={() => exportProjectToFile(state)}
        title="Export as JSON"
      >
        Export
      </button>

      {/* Unified Analysis Panel toggle */}
      {setShowAnalysisPanel && (
        <div className="flex items-center gap-1 border-l border-gray-800 pl-3 ml-1">
          <button
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showAnalysisPanel ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:bg-gray-800'
            }`}
            onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
            title="Open Performance Analysis panel"
          >
            Analysis
          </button>
        </div>
      )}

      {/* Generate */}
      {generateFull && (
        <div className="flex items-center gap-1 border-l border-gray-800 pl-3 ml-1">
          {state.isProcessing ? (
            <span className="text-xs text-blue-400 animate-pulse px-2 py-1">
              {generationProgress || 'Running analysis...'}
            </span>
          ) : (
            <>
              <select
                className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded px-1 py-1 cursor-pointer"
                value={generationMode}
                onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                title="Quick: fast optimization (~3s). Thorough: deep optimization (~10-15s). Auto: chooses based on complexity."
              >
                <option value="fast">Quick</option>
                <option value="deep">Thorough</option>
                <option value="auto">Auto</option>
              </select>
              <button
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  canGenerate
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                onClick={() => canGenerate && generateFull(generationMode)}
                disabled={!canGenerate}
                title={generateDisabledReason ?? 'Generate 3 layout candidates (auto-assigns pads if none are set)'}
              >
                Generate
              </button>
            </>
          )}
        </div>
      )}

      {/* Analysis stale indicator */}
      {state.analysisStale && state.analysisResult && (
        <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-2">
          Analysis outdated
        </span>
      )}
    </div>
  );
}
