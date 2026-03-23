/**
 * WorkspaceToolbar.
 *
 * Unified top toolbar merging the old header + EditorToolbar into one
 * concise, professional bar. Contains project identity, workflow actions,
 * editing controls, generation, compare trigger, and settings.
 */

import { useState, useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import { hasWorkingChanges } from '../../state/projectState';
import { type GenerationMode } from '../../hooks/useAutoAnalysis';
import { type SaveStatus } from '../../hooks/useAutoSave';
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
  saveStatus?: SaveStatus;
  onSave?: () => void;
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
  saveStatus = 'saved',
  onSave,
}: WorkspaceToolbarProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();
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

  // Save confirmation (flash "Saved" briefly after explicit save)
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
    if (onSave) {
      onSave();
    }
    setSaveConfirm(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveConfirm(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex-shrink-0">
      {/* Library back */}
      <button
        className="pf-btn pf-btn-subtle text-pf-sm"
        onClick={onNavigateLibrary}
        title="Save and return to library"
      >
        &larr; Library
      </button>

      {/* Divider */}
      <div className="pf-divider-v" />

      {/* Project name */}
      <div className="min-w-0">
        {editingName ? (
          <input
            ref={nameInputRef}
            className="pf-input text-pf-base font-semibold w-48"
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
            className="text-pf-base font-semibold text-[var(--text-primary)] truncate editable-field hover:text-white transition-colors cursor-pointer"
            onClick={() => {
              setNameDraft(state.name || 'Untitled');
              setEditingName(true);
            }}
            title="Click to rename"
          >
            {state.name || 'Untitled'}

          </span>
        )}
      </div>

      {/* BPM */}
      {editingBpm ? (
        <input
          className="pf-input w-14 text-pf-sm tabular-nums text-center"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={bpmDraft}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            setBpmDraft(v);
          }}
          onBlur={commitBpm}
          onKeyDown={e => {
            if (e.key === 'Enter') commitBpm();
            if (e.key === 'Escape') setEditingBpm(false);
          }}
          autoFocus
          onFocus={e => e.target.select()}
        />
      ) : (
        <span
          className="text-pf-sm text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors tabular-nums editable-field"
          onClick={() => {
            setBpmDraft(String(state.tempo));
            setEditingBpm(true);
          }}
          title="Click to change BPM"
        >
          {state.tempo} BPM
        </span>
      )}

      {/* Workflow actions */}
      {hasChanges && (
        <>
          <div className="pf-divider-v" />
          <div className="flex gap-1">
            <button
              className="pf-btn text-pf-sm bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"
              onClick={() => dispatch({ type: 'PROMOTE_WORKING_LAYOUT' })}
              title="Make this layout the new Active Layout"
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
        <span className="pf-badge text-amber-400 bg-amber-500/8 border border-amber-500/15">
          Analysis outdated
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

      {/* Save + status */}
      <div className="flex items-center gap-1.5">
        <button
          className={`pf-btn text-pf-sm ${
            saveConfirm || saveStatus === 'saved'
              ? 'bg-emerald-600/12 text-emerald-400 border border-emerald-500/20'
              : saveStatus === 'saving'
                ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                : 'pf-btn-subtle'
          }`}
          onClick={handleSave}
          title="Save project"
        >
          {saveConfirm ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Save' : 'Saved'}
        </button>
        {saveStatus === 'saved' && !saveConfirm && (
          <span className="text-pf-micro text-[var(--text-tertiary)]">saved</span>
        )}
      </div>

      <div className="pf-divider-v" />

      {/* Analyze / Generate phase indicator */}
      {state.isProcessing ? (
        <span className={`text-pf-sm animate-pulse px-2.5 py-1 rounded-pf-md border ${
          analysisPhase === 'generating'
            ? 'text-[var(--accent-primary)] bg-[var(--accent-muted)] border-[var(--accent-primary)]/15'
            : 'text-cyan-400 bg-cyan-500/8 border-cyan-500/15'
        }`}>
          {analysisPhase === 'generating'
            ? (generationProgress || 'Generating...')
            : 'Analyzing\u2026'}
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            className="pf-select"
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
              className="pf-select"
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
            className={`pf-btn text-pf-sm font-medium ${
              canGenerate
                ? 'pf-btn-primary'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] cursor-not-allowed'
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
        className={`pf-btn text-pf-sm ${
          compareCount >= 2
            ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/30'
            : 'pf-btn-subtle opacity-50 cursor-not-allowed'
        }`}
        onClick={onCompare}
        disabled={compareCount < 2}
        title={compareCount >= 2 ? `Compare ${compareCount} selected layouts` : 'Select 2+ candidates to compare'}
      >
        Compare{compareCount >= 2 ? ` (${compareCount})` : ''}
      </button>

      <div className="pf-divider-v" />

      {/* Pattern Composer toggle */}
      <button
        className={`pf-btn text-pf-sm ${
          composerOpen
            ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-default)]'
            : 'pf-btn-subtle'
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
