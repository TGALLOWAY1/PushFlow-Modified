/**
 * WorkspaceToolbar.
 *
 * Unified top toolbar merging the old header + EditorToolbar into one
 * concise, professional bar. Contains project identity, workflow actions,
 * editing controls, generation, compare trigger, and settings.
 */

import { useState, useRef, useEffect } from 'react';
import { useProject } from '../../state/ProjectContext';
import { hasWorkingChanges } from '../../state/projectState';
import { useToast } from '../shared/Toast';
import { type GenerationMode } from '../../hooks/useAutoAnalysis';
import { type SaveStatus } from '../../hooks/useAutoSave';
import { type OptimizerMethodKey } from '../../../engine/optimization/optimizerInterface';
import { type GreedyLayoutStrategy, GREEDY_STRATEGY_LABELS } from '../../../engine/optimization/greedyCandidatePipeline';
import { SettingsGear } from '../panels/SettingsGear';
import { SaveStatusControl } from './SaveStatusControl';
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
  onCalculateCost?: () => void;
  hasAssignment?: boolean;
  saveStatus?: SaveStatus;
  onSave?: () => void;
  /** Downloads a copy of the project (offered when saving fails). */
  onExport?: () => void;
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
  onCalculateCost,
  hasAssignment,
  saveStatus = 'saved',
  onSave,
  onExport,
}: WorkspaceToolbarProps) {
  const { state, dispatch, transact, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useProject();
  const { settings: viewSettings, toggleGridLabel, toggleLayoutDisplay } = useViewSettings();
  const toast = useToast();
  const hasChanges = hasWorkingChanges(state);

  // Discard is confirmed by a toast with Undo. Finger preferences live in
  // voiceConstraints and survive Discard (decision Q2), and the toast says so.
  // The toast's Undo is only offered while Discard is still the step Undo would
  // revert, so it can never undo a later edit instead.
  const discardToastRef = useRef<number | null>(null);
  const handleDiscard = () => {
    const keepsPreferences = Object.values(state.voiceConstraints).some(c => c.hand || c.finger);
    dispatch({ type: 'DISCARD_WORKING_LAYOUT' });
    if (discardToastRef.current !== null) toast.dismiss(discardToastRef.current);
    discardToastRef.current = toast.show({
      message: keepsPreferences ? 'Draft discarded \u00b7 Finger preferences kept' : 'Draft discarded',
      action: { label: 'Undo', onClick: undo },
    });
  };
  useEffect(() => {
    if (discardToastRef.current !== null && undoLabel !== 'Discard') {
      toast.dismiss(discardToastRef.current);
      discardToastRef.current = null;
    }
  }, [undoLabel, toast]);

  // Editable project name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Editable BPM
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  // Generation mode
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');

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

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(67,70,86,0.1)] bg-[var(--bg-app)] flex-shrink-0">
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
              onClick={handleDiscard}
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
          data-testid="undo-button"
          onClick={undo}
          disabled={!canUndo}
          aria-label={undoLabel ? `Undo: ${undoLabel}` : 'Undo'}
          title={undoLabel ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
        >
          Undo
        </button>
        <button
          className="pf-btn pf-btn-subtle text-pf-sm"
          data-testid="redo-button"
          onClick={redo}
          disabled={!canRedo}
          aria-label={redoLabel ? `Redo: ${redoLabel}` : 'Redo'}
          title={redoLabel ? `Redo: ${redoLabel} (Ctrl+Y)` : 'Nothing to redo'}
        >
          Redo
        </button>
      </div>

      {/* Save status: the truth about the stored project, never a flash on click (T57). */}
      <SaveStatusControl
        status={saveStatus}
        onSave={() => onSave?.()}
        onExport={() => onExport?.()}
      />

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

          {state.optimizerMethod === 'greedy' && (
            <select
              className="pf-select"
              value={state.greedyStrategy}
              onChange={(e) => dispatch({ type: 'SET_GREEDY_STRATEGY', payload: e.target.value as GreedyLayoutStrategy })}
              title="Layout seeding strategy"
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
            transact('Duplicate layout', () => {
              dispatch({ type: 'CREATE_WORKING_LAYOUT' });
              dispatch({ type: 'SAVE_AS_VARIANT', payload: { name: `${state.activeLayout.name} copy`, source: 'working' } });
              dispatch({ type: 'DISCARD_WORKING_LAYOUT' });
            });
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
