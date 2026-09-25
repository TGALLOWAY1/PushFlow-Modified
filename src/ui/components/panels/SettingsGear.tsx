/**
 * SettingsGear.
 *
 * Popover for the grid's view options (note, position and finger labels,
 * hand colours) and the cost toggles. The dead "Organize by 4x4 Banks" and the
 * hidden second Save Variant ("Duplicate Layout") are gone (S2.3, T39).
 */

import { useState, useRef, useEffect } from 'react';
import { type GridLabelSettings } from '../../state/viewSettings';
import { type CostToggles, TOGGLE_CATEGORIES, isExperimentalMode } from '../../../types/costToggles';
import { COST_FAMILY_FACTOR, FACTOR_META } from '../../analysis/factorMeta';
import { DisabledReason, useDisabledReason } from '../shared/DisabledReason';

/** A cost family's name is its factor's (FACTOR_META, T20). */
const familyLabel = (key: keyof CostToggles) => FACTOR_META[COST_FAMILY_FACTOR[key]].label;

/** The analysis supplies the finger assignment once a Sound is on the grid. */
const CALCULATE_DISABLED_REASON = 'Place a Sound on the grid first: the cost needs a finger assignment';

interface SettingsGearProps {
  gridLabels: GridLabelSettings;
  onToggleGridLabel: (key: keyof GridLabelSettings) => void;
  costToggles?: CostToggles;
  onCostToggleChange?: (toggles: CostToggles) => void;
  onCalculateCost?: () => void;
  hasAssignment?: boolean;
  /** Opens the keyboard and mouse sheet (also on '?'). */
  onOpenShortcuts?: () => void;
}

const VIEW_OPTIONS: Array<{ key: keyof GridLabelSettings; label: string }> = [
  { key: 'showSoundNames', label: 'Show Sound Names' },
  { key: 'showNoteLabels', label: 'Show Note Labels' },
  { key: 'showPositionLabels', label: 'Show Position Labels' },
  { key: 'showFingerAssignment', label: 'Show Finger Assignment' },
  { key: 'showHandColors', label: 'Color Pads by Hand' },
];

export function SettingsGear({
  gridLabels,
  onToggleGridLabel,
  costToggles,
  onCostToggleChange,
  onCalculateCost,
  hasAssignment,
  onOpenShortcuts,
}: SettingsGearProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        className={`w-8 h-8 flex items-center justify-center rounded-pf-lg transition-colors ${
          open ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
        }`}
        onClick={() => setOpen(!open)}
        title="View settings"
        aria-label="View settings"
      >
        {/* Gear icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        // A dialog to the input table: keys pressed in it are its own (Space
        // toggles the focused option), and Escape closes it.
        <div
          role="dialog"
          aria-label="View settings"
          data-testid="settings-popover"
          className="absolute right-0 top-full mt-1 w-64 rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-lg z-50 overflow-hidden"
          onKeyDown={e => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
            buttonRef.current?.focus();
          }}
        >
          {/* View Options section */}
          <div className="px-4 pt-3 pb-1">
            <div className="section-header">
              View Options
            </div>
          </div>
          <div className="px-2 pb-2">
            {VIEW_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-[var(--bg-hover)] rounded-pf-lg transition-colors"
                onClick={() => onToggleGridLabel(key)}
              >
                <div className={`w-5 h-5 rounded-pf-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  gridLabels[key]
                    ? 'bg-white border-white'
                    : 'border-[var(--border-default)] bg-transparent'
                }`}>
                  {gridLabels[key] && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  )}
                </div>
                <span className="text-pf-base text-[var(--text-primary)]">{label}</span>
              </button>
            ))}
          </div>

          {/* Cost Toggles section */}
          {costToggles && onCostToggleChange && (
            <>
              <div className="pf-divider-h mx-3" />
              <div className="px-4 pt-3 pb-1">
                <div className="section-header">
                  Cost Evaluation
                </div>
              </div>
              <CostTogglesSection
                costToggles={costToggles}
                onToggleChange={onCostToggleChange}
                onCalculate={onCalculateCost}
                hasAssignment={hasAssignment ?? false}
              />
            </>
          )}

          {/* The keyboard and mouse sheet (T61) */}
          {onOpenShortcuts && (
            <>
              <div className="pf-divider-h mx-3" />
              <div className="px-2 py-2">
                <button
                  type="button"
                  data-testid="open-shortcuts"
                  className="w-full flex items-center justify-between gap-3 px-2 py-2 text-left hover:bg-[var(--bg-hover)] rounded-pf-lg transition-colors"
                  onClick={() => {
                    setOpen(false);
                    onOpenShortcuts();
                  }}
                >
                  <span className="text-pf-base text-[var(--text-primary)]">Keyboard and mouse</span>
                  <kbd className="px-1.5 py-0.5 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-pf-xs text-[var(--text-secondary)]">?</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CostTogglesSection({
  costToggles,
  onToggleChange,
  onCalculate,
  hasAssignment,
}: {
  costToggles: CostToggles;
  onToggleChange: (toggles: CostToggles) => void;
  onCalculate?: () => void;
  hasAssignment: boolean;
}) {
  const toggleKeys = Object.keys(COST_FAMILY_FACTOR) as Array<keyof CostToggles>;
  const experimental = isExperimentalMode(costToggles);
  const calculateReason = useDisabledReason(hasAssignment ? null : CALCULATE_DISABLED_REASON);

  const handleToggle = (key: keyof CostToggles) => {
    onToggleChange({ ...costToggles, [key]: !costToggles[key] });
  };

  const staticToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'static');
  const temporalToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'temporal');
  const hardToggles = toggleKeys.filter(k => TOGGLE_CATEGORIES[k] === 'hard');

  return (
    <div className="px-3 pb-3 space-y-3">
      <div className="space-y-1.5">
        <div className="text-pf-xs text-[var(--text-tertiary)] uppercase tracking-wider">Static</div>
        {staticToggles.map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={costToggles[key]} onChange={() => handleToggle(key)} className="w-3 h-3 rounded-pf-sm accent-[var(--accent-primary)]" />
            <span className={`text-pf-sm group-hover:text-[var(--text-primary)] ${costToggles[key] ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] line-through'}`}>{familyLabel(key)}</span>
          </label>
        ))}

        <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider pt-1">Temporal</div>
        {temporalToggles.map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={costToggles[key]} onChange={() => handleToggle(key)} className="w-3 h-3 rounded-pf-sm accent-[var(--accent-primary)]" />
            <span className={`text-pf-sm group-hover:text-[var(--text-primary)] ${costToggles[key] ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] line-through'}`}>{familyLabel(key)}</span>
          </label>
        ))}

        <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider pt-1">Hard Rules</div>
        {hardToggles.map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={costToggles[key]} onChange={() => handleToggle(key)} className="w-3 h-3 rounded-pf-sm accent-[var(--accent-primary)]" />
            <span className={`text-pf-sm group-hover:text-[var(--text-primary)] ${costToggles[key] ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] line-through'} ${!costToggles[key] ? 'text-orange-400' : ''}`}>{familyLabel(key)}</span>
            <span className="text-pf-micro text-[var(--text-tertiary)] ml-auto">(hard)</span>
          </label>
        ))}
      </div>

      {experimental && (
        <div className="px-2 py-1.5 rounded-pf-sm border border-orange-500/30 bg-orange-500/10 text-pf-xs text-orange-400">
          Hard constraints disabled — results may include infeasible assignments
        </div>
      )}

      {onCalculate && (
        <div className="space-y-1">
          <button
            className={`w-full px-3 py-2 rounded-pf-md text-pf-sm font-medium transition-colors ${
              hasAssignment ? 'pf-btn-primary' : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] cursor-not-allowed'
            }`}
            onClick={onCalculate}
            disabled={!hasAssignment}
            aria-describedby={calculateReason.describedBy}
            title={hasAssignment ? 'Evaluate with active cost toggles' : CALCULATE_DISABLED_REASON}
          >
            Calculate cost
          </button>
          <DisabledReason id={calculateReason.id} reason={hasAssignment ? null : CALCULATE_DISABLED_REASON} className="block" />
        </div>
      )}
    </div>
  );
}
