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
import { DisabledReason, useDisabledReason } from '../shared/DisabledReason';
import { SaveVariantPopover } from './SaveVariantPopover';
import { Popover } from '../shared/Overlay';
import { MoreHorizontal } from 'lucide-react';
import { suggestVariantName } from '../../state/variantNames';
import { generateId } from '../../../utils/idGenerator';
import { uniqueName } from '../../../utils/uniqueName';

interface WorkspaceToolbarProps {
  onNavigateLibrary: () => void;
  generateFull: (mode?: GenerationMode) => Promise<void>;
  generationProgress: string | null;
  analysisPhase: 'idle' | 'analyzing' | 'generating';
  canGenerate: boolean;
  generateDisabledReason: string | null;
  compareCount: number;
  /** Why Compare is unavailable, shown next to it; null when it can open. */
  compareDisabledReason?: string | null;
  onCompare: () => void;
  onCalculateCost?: () => void;
  hasAssignment?: boolean;
  saveStatus?: SaveStatus;
  onSave?: () => void;
  /** Downloads a copy of the project (offered when saving fails). */
  onExport?: () => void;
  /** A variant was saved: show it (the Layouts tab, scrolled to its card). */
  onVariantSaved?: (variantId: string) => void;
}

export function WorkspaceToolbar({
  onNavigateLibrary,
  generateFull,
  generationProgress,
  analysisPhase,
  canGenerate,
  generateDisabledReason,
  compareCount,
  compareDisabledReason = null,
  onCompare,
  onCalculateCost,
  hasAssignment,
  saveStatus = 'saved',
  onSave,
  onExport,
  onVariantSaved,
}: WorkspaceToolbarProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useProject();
  const { settings: viewSettings, toggleGridLabel } = useViewSettings();
  const toast = useToast();
  const hasChanges = hasWorkingChanges(state);
  const generateReason = useDisabledReason(canGenerate ? null : generateDisabledReason);
  const compareReason = useDisabledReason(compareCount >= 2 ? null : compareDisabledReason);

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
  const startRename = () => {
    setNameDraft(state.name || 'Untitled');
    setEditingName(true);
  };
  const titleMenuRef = useRef<HTMLButtonElement>(null);
  const [titleMenuAt, setTitleMenuAt] = useState<{ x: number; y: number } | null>(null);

  // Editable BPM
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  // Generation mode
  const [generationMode, setGenerationMode] = useState<GenerationMode>('fast');

  // Save as variant asks for a name first (T29).
  const saveVariantRef = useRef<HTMLButtonElement>(null);
  const [saveVariantAt, setSaveVariantAt] = useState<{ x: number; y: number } | null>(null);
  const saveVariant = (requested: string) => {
    const variantId = generateId('variant');
    // The name the reducer will keep: a taken one is numbered.
    const name = uniqueName(requested, state.savedVariants.map(v => v.name));
    dispatch({ type: 'SAVE_AS_VARIANT', payload: { name, source: 'working', variantId } });
    setSaveVariantAt(null);
    toast.show({ message: `Saved variant "${name}"` });
    onVariantSaved?.(variantId);
  };

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
            data-testid="project-title"
            className="block text-pf-base font-semibold text-[var(--text-primary)] truncate editable-field hover:text-white transition-colors cursor-pointer"
            onClick={startRename}
            title="Click to rename"
          >
            {state.name || 'Untitled'}

          </span>
        )}
      </div>

      {/* The title menu: Rename and Export (T53: the editor had no Export). */}
      <button
        ref={titleMenuRef}
        type="button"
        data-testid="project-title-menu"
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={titleMenuAt !== null}
        className="w-7 h-7 flex-shrink-0 rounded-pf-sm flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setTitleMenuAt(prev => (prev ? null : { x: r.left, y: r.bottom + 4 }));
        }}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      {titleMenuAt && (
        <Popover
          x={titleMenuAt.x}
          y={titleMenuAt.y}
          onClose={() => setTitleMenuAt(null)}
          role="menu"
          ariaLabel="Project actions"
          returnFocusTo={titleMenuRef.current}
          testId="project-title-menu-popover"
          className="flex flex-col min-w-[190px] py-1 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-pf-lg shadow-pf-xl"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] outline-none focus-visible:bg-[var(--bg-hover)]"
            onClick={() => { setTitleMenuAt(null); startRename(); }}
          >
            Rename project
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-pf-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] outline-none focus-visible:bg-[var(--bg-hover)]"
            onClick={() => { setTitleMenuAt(null); onExport?.(); }}
          >
            Export project file
          </button>
        </Popover>
      )}

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
          className="text-pf-sm text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors tabular-nums editable-field whitespace-nowrap"
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
              ref={saveVariantRef}
              data-testid="save-variant"
              className="pf-btn text-pf-sm bg-accent-primary/80 hover:bg-accent-primary text-white border border-accent-primary/30"
              aria-haspopup="dialog"
              aria-expanded={saveVariantAt !== null}
              onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setSaveVariantAt(prev => (prev ? null : { x: r.left, y: r.bottom + 6 }));
              }}
              title="Keep this layout as a named variant, without changing the Active Layout"
            >
              Save variant
            </button>
            {saveVariantAt && (
              <SaveVariantPopover
                x={saveVariantAt.x}
                y={saveVariantAt.y}
                defaultName={suggestVariantName(state.workingLayout?.name ?? state.activeLayout.name, state.savedVariants.map(v => v.name))}
                returnFocusTo={saveVariantRef.current}
                onSave={saveVariant}
                onClose={() => setSaveVariantAt(null)}
              />
            )}
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
            ? 'text-accent-primary-soft bg-[var(--accent-muted)] border-accent-primary/15'
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
            aria-describedby={generateReason.describedBy}
            title={canGenerate ? 'Generate optimized layouts' : generateDisabledReason ?? undefined}
          >
            Generate
          </button>
          <DisabledReason id={generateReason.id} reason={canGenerate ? null : generateDisabledReason} className="whitespace-nowrap" />
        </div>
      )}

      {/* Compare */}
      <button
        data-testid="toolbar-compare"
        className={`pf-btn text-pf-sm ${
          compareCount >= 2
            ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/30'
            : 'pf-btn-subtle opacity-50 cursor-not-allowed'
        }`}
        onClick={onCompare}
        disabled={compareCount < 2}
        aria-describedby={compareReason.describedBy}
        title={compareCount >= 2 ? `Compare ${compareCount} selected layouts` : compareDisabledReason ?? undefined}
      >
        Compare{compareCount >= 2 ? ` (${compareCount})` : ''}
      </button>
      <DisabledReason id={compareReason.id} reason={compareCount >= 2 ? null : compareDisabledReason} className="whitespace-nowrap" />

      {/* Settings gear */}
      <SettingsGear
        gridLabels={viewSettings.gridLabels}
        onToggleGridLabel={toggleGridLabel}
        costToggles={state.costToggles}
        onCostToggleChange={(toggles) => dispatch({ type: 'SET_COST_TOGGLES', payload: toggles })}
        onCalculateCost={onCalculateCost}
        hasAssignment={hasAssignment}
      />
    </div>
  );
}
