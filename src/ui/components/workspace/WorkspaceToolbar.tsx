/**
 * WorkspaceToolbar.
 *
 * Unified top toolbar merging the old header + EditorToolbar into one
 * concise, professional bar. Contains project identity, editing controls,
 * generation, compare trigger, and settings. The layout's own actions
 * (Promote, Save variant, Discard) and its freshness live in the
 * layout-state bar above the grid (S3.2).
 */

import { useState, useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type GenerationMode } from '../../hooks/useAutoAnalysis';
import { type SaveStatus } from '../../hooks/useAutoSave';
import { type OptimizerMethodKey } from '../../../engine/optimization/optimizerInterface';
import { type GreedyLayoutStrategy, GREEDY_STRATEGY_LABELS } from '../../../engine/optimization/greedyCandidatePipeline';
import { SettingsGear } from '../panels/SettingsGear';
import { SaveStatusControl } from './SaveStatusControl';
import { useViewSettings } from '../../state/viewSettings';
import { DisabledReason, useDisabledReason } from '../shared/DisabledReason';
import { Popover } from '../shared/Overlay';
import { MoreHorizontal } from 'lucide-react';
import { LeaveProjectButton } from './LeaveProjectButton';

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
  /** Opens the '?' shortcut sheet. */
  onOpenShortcuts?: () => void;
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
  compareDisabledReason = null,
  onCompare,
  onCalculateCost,
  onOpenShortcuts,
  hasAssignment,
  saveStatus = 'saved',
  onSave,
  onExport,
}: WorkspaceToolbarProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useProject();
  const { settings: viewSettings, toggleGridLabel } = useViewSettings();
  const generateReason = useDisabledReason(canGenerate ? null : generateDisabledReason);
  const compareReason = useDisabledReason(compareCount >= 2 ? null : compareDisabledReason);

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
  // On an empty grid Generate proposes whole layouts; it still only proposes (T37, Q4).
  const nothingPlaced = Object.keys((state.workingLayout ?? state.activeLayout).padToVoice).length === 0;
  const generateLabel = canGenerate && nothingPlaced ? 'Generate layouts from scratch' : 'Generate';

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
      {/* Library back; asks first while unkept candidates exist (S3.3) */}
      <LeaveProjectButton onLeave={onNavigateLibrary} />

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

      {/* Spacer */}
      <div className="flex-1" />

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
            title={canGenerate
              ? nothingPlaced
                ? 'Propose whole layouts for your Sounds, shown read-only: nothing is placed until you use one'
                : 'Generate optimized layouts'
              : generateDisabledReason ?? undefined}
          >
            {generateLabel}
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
        onOpenShortcuts={onOpenShortcuts}
      />
    </div>
  );
}
