/**
 * WorkspaceToolbar.
 *
 * Unified top toolbar merging the old header + EditorToolbar into one
 * concise, professional bar. Contains project identity, workflow actions,
 * editing controls, generation, compare trigger, and settings.
 */

import { useState, useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import { saveProject, exportProjectToFile } from '../../persistence/projectStorage';
import { getDisplayedLayout, getDisplayedLayoutRole, hasWorkingChanges } from '../../state/projectState';
import { type GenerationMode } from '../../hooks/useAutoAnalysis';
import { type OptimizerMethodKey } from '../../../engine/optimization/optimizerInterface';
import { SettingsGear } from '../panels/SettingsGear';
import { useViewSettings } from '../../state/viewSettings';

interface WorkspaceToolbarProps {
  onNavigateLibrary: () => void;
  generateFull: (mode?: GenerationMode) => Promise<void>;
  generationProgress: string | null;
  analysisPhase: 'idle' | 'analyzing' | 'generating';
  canGenerate: boolean;
  generateDisabledReason: string | null;
  compareCount: number;
  onCompare: () => void;
  composerOpen: boolean;
  onToggleComposer: () => void;
  onCalculateCost?: () => void;
  hasAssignment?: boolean;
}

export function WorkspaceToolbar({
  onNavigateLibrary,
  generateFull,
  generationProgress,
  analysisPhase,
  canGenerate,
  generateDisabledReason,
  compareCount,
  onCompare,
  composerOpen,
  onToggleComposer,
  onCalculateCost,
  hasAssignment,
}: WorkspaceToolbarProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();
  const displayedLayout = getDisplayedLayout(state);
  const layoutRole = getDisplayedLayoutRole(state);
  const hasChanges = hasWorkingChanges(state);

  // Editable project name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Editable BPM
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  // Generation mode
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');

  // Save confirmation
  const [saveConfirm, setSaveConfirm] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSave = () => {
    saveProject(state);
    setSaveConfirm(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveConfirm(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/80 bg-gray-900/60 flex-shrink-0">
      {/* Library back */}
      <button
        className="px-2 py-1 text-[11px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        onClick={() => {
          saveProject(state);
          onNavigateLibrary();
        }}
        title="Save and return to library"
      >
        &larr; Library
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-800" />

      {/* Project name */}
      <div className="min-w-0">
        {editingName ? (
          <input
            ref={nameInputRef}
            className="text-sm font-semibold text-gray-200 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 outline-none focus:border-blue-500 w-48"
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
          <span
            className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-white transition-colors"
            onDoubleClick={() => {
              setNameDraft(state.name || 'Untitled');
              setEditingName(true);
            }}
            title="Double-click to rename"
          >
            {state.name || 'Untitled'}
          </span>
        )}
      </div>

      {/* BPM */}
      {editingBpm ? (
        <input
          className="w-14 text-[11px] text-gray-200 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 outline-none focus:border-blue-500"
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
          className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors tabular-nums"
          onDoubleClick={() => {
            setBpmDraft(String(state.tempo));
            setEditingBpm(true);
          }}
          title="Double-click to change BPM"
        >
          {state.tempo} BPM
        </span>
      )}

      {/* Layout status badge */}
      {displayedLayout && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          layoutRole === 'working'
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        }`}>
          {layoutRole === 'working' ? 'Working Draft' : 'Active'}
        </span>
      )}

      {/* Workflow actions */}
      {hasChanges && (
        <>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex gap-1">
            <button
              className="px-2 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              onClick={() => dispatch({ type: 'PROMOTE_WORKING_LAYOUT' })}
              title="Make this layout the new Active Layout"
            >
              Promote
            </button>
            <button
              className="px-2 py-1 text-[11px] rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
              onClick={() => dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} variant`, source: 'working' } })}
              title="Save current working layout as a named variant"
            >
              Save Variant
            </button>
            <button
              className="px-2 py-1 text-[11px] rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-300 transition-colors"
              onClick={() => dispatch({ type: 'DISCARD_WORKING_LAYOUT' })}
              title="Discard working changes"
            >
              Discard
            </button>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Analysis stale indicator */}
      {state.analysisStale && state.analysisResult && (
        <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
          Analysis outdated
        </span>
      )}

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          className="px-2 py-1 text-[11px] rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="px-2 py-1 text-[11px] rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      {/* Save */}
      <button
        className={`px-2 py-1 text-[11px] rounded transition-colors ${
          saveConfirm
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
        }`}
        onClick={handleSave}
        title="Save project"
      >
        {saveConfirm ? 'Saved' : 'Save Project'}
      </button>

      <div className="w-px h-5 bg-gray-800" />

      {/* Analyze / Generate phase indicator */}
      {state.isProcessing ? (
        <span className={`text-[11px] animate-pulse px-2 py-1 rounded border ${
          analysisPhase === 'generating'
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
        }`}>
          {analysisPhase === 'generating'
            ? (generationProgress || 'Generating...')
            : 'Analyzing\u2026'}
        </span>
      ) : (
        <div className="flex items-center gap-1">
          <select
            className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded px-1 py-1 cursor-pointer"
            value={state.optimizerMethod}
            onChange={(e) => dispatch({ type: 'SET_OPTIMIZER_METHOD', payload: e.target.value as OptimizerMethodKey })}
            title="Optimizer method"
          >
            <option value="greedy">Greedy</option>
            <option value="beam">Beam</option>
            <option value="annealing">Annealing</option>
          </select>

          {state.optimizerMethod === 'annealing' && (
            <select
              className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded px-1 py-1 cursor-pointer"
              value={generationMode}
              onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
              title="Intensity"
            >
              <option value="fast">Quick</option>
              <option value="deep">Thorough</option>
              <option value="auto">Auto</option>
            </select>
          )}

          <button
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
              canGenerate
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            onClick={() => canGenerate && generateFull(generationMode)}
            disabled={!canGenerate}
            title={generateDisabledReason ?? 'Generate optimized layouts'}
          >
            Generate
          </button>
        </div>
      )}

      {/* Compare */}
      <button
        className={`px-2 py-1 text-[11px] rounded transition-colors ${
          compareCount >= 2
            ? 'bg-purple-600 hover:bg-purple-500 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
        onClick={onCompare}
        disabled={compareCount < 2}
        title={compareCount >= 2 ? `Compare ${compareCount} selected layouts` : 'Select 2+ candidates to compare'}
      >
        Compare{compareCount >= 2 ? ` (${compareCount})` : ''}
      </button>

      <div className="w-px h-5 bg-gray-800" />

      {/* Pattern Composer toggle */}
      <button
        className={`px-2 py-1 text-[11px] rounded transition-colors ${
          composerOpen
            ? 'bg-gray-700 text-gray-200'
            : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
        }`}
        onClick={onToggleComposer}
        title="Toggle Pattern Composer"
      >
        Composer
      </button>

      {/* Settings gear */}
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
        costToggles={state.costToggles}
        onCostToggleChange={(toggles) => dispatch({ type: 'SET_COST_TOGGLES', payload: toggles })}
        onCalculateCost={onCalculateCost}
        hasAssignment={hasAssignment}
      />
    </div>
  );
}
