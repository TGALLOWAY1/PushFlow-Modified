/**
 * EditorToolbar.
 *
 * Top bar for the project editor: project name, undo/redo, layout selector,
 * save/export, analysis stale indicator.
 */

import { useState } from 'react';
import { useProject } from '../state/ProjectContext';
import { saveProject, exportProjectToFile } from '../persistence/projectStorage';
import { getActiveLayout } from '../state/projectState';
import { createEmptyLayout } from '../../types/layout';
import { generateId } from '../../utils/idGenerator';
import { type GenerationMode } from '../hooks/useAutoAnalysis';

interface EditorToolbarProps {
  generateFull?: (mode?: GenerationMode) => Promise<void>;
  generationProgress?: string | null;
  canGenerate?: boolean;
  generateDisabledReason?: string | null;
  showAnalysis?: boolean;
  setShowAnalysis?: (show: boolean) => void;
  showDiagnostics?: boolean;
  setShowDiagnostics?: (show: boolean) => void;
}

export function EditorToolbar({
  generateFull,
  generationProgress,
  canGenerate = true,
  generateDisabledReason,
  showAnalysis,
  setShowAnalysis,
  showDiagnostics,
  setShowDiagnostics
}: EditorToolbarProps = {}) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const activeLayout = getActiveLayout(state);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');


  const handleAddLayout = () => {
    const newLayout = createEmptyLayout(
      generateId('layout'),
      `Layout ${state.layouts.length + 1}`
    );
    dispatch({ type: 'ADD_LAYOUT', payload: newLayout });
    dispatch({ type: 'SET_ACTIVE_LAYOUT', payload: newLayout.id });
  };

  const handleCloneLayout = () => {
    if (!activeLayout) return;
    const clone = {
      ...activeLayout,
      id: generateId('layout'),
      name: `${activeLayout.name} (copy)`,
      padToVoice: { ...activeLayout.padToVoice },
      fingerConstraints: { ...activeLayout.fingerConstraints },
      scoreCache: null,
    };
    dispatch({ type: 'ADD_LAYOUT', payload: clone });
    dispatch({ type: 'SET_ACTIVE_LAYOUT', payload: clone.id });
  };

  return (
    <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
      {/* Project name */}
      <h1 className="text-lg font-bold truncate">{state.name}</h1>

      {/* Layout selector */}
      {state.layouts.length > 1 && (
        <div className="flex items-center gap-1 text-xs">
          {state.layouts.map(l => (
            <button
              key={l.id}
              className={`px-2 py-1 rounded transition-colors ${
                l.id === state.activeLayoutId
                  ? 'bg-gray-700 text-gray-200'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_LAYOUT', payload: l.id })}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Layout actions */}
      <div className="flex gap-1">
        <button
          className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
          onClick={handleAddLayout}
          title="Add empty layout"
        >
          + Layout
        </button>
        {activeLayout && (
          <button
            className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
            onClick={handleCloneLayout}
            title="Clone current layout"
          >
            Clone
          </button>
        )}
      </div>

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

      {/* Toggles */}
      {(setShowAnalysis || setShowDiagnostics) && (
        <div className="flex items-center gap-1 border-l border-gray-800 pl-3 ml-1">
          {setShowAnalysis && (
            <button
              className={`px-2 py-1 text-xs rounded transition-colors ${showAnalysis ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:bg-gray-800'}`}
              onClick={() => setShowAnalysis(!showAnalysis)}
            >
              Analysis
            </button>
          )}
          {setShowDiagnostics && (
            <button
              className={`px-2 py-1 text-xs rounded transition-colors ${showDiagnostics ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:bg-gray-800'}`}
              onClick={() => setShowDiagnostics(!showDiagnostics)}
            >
              Diagnostics
            </button>
          )}
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
