/**
 * The Sounds panel's header (S5.1, T45): search, the placement filters with
 * their counts (All · To place · On grid · Locked), how many Sounds are on the
 * grid, "Place remaining N" and "Name from GM drum map".
 *
 * Placement is a filter here and a pill or locator on each row, never a
 * section label. "Place remaining N" proposes a candidate and never places a
 * Sound itself (S3.3; decision Q4; invariant 7).
 */

import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { isShownLayoutReadOnly } from '../../state/projectState';
import { placeRemainingLabel, usePlaceRemaining } from '../../hooks/usePlaceRemaining';
import { gmDrumName, gmDrumRenames } from '../../../utils/gmDrumMap';
import { DisabledReason, useDisabledReason } from '../shared/DisabledReason';
import { SOUND_FILTERS, type SoundFilter } from '../../analysis/soundPlacement';

export function SoundsHeader({ counts, filter, onFilter, query, onQuery }: {
  counts: Record<SoundFilter, number>;
  filter: SoundFilter;
  onFilter: (filter: SoundFilter) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  const { state, dispatch } = useProject();
  const placeRemaining = usePlaceRemaining();
  const layoutReadOnly = isShownLayoutReadOnly(state);

  // "Name from GM drum map" is offered only when it would rename something,
  // and otherwise says why not (T31).
  const gmRenameCount = useMemo(() => Object.keys(gmDrumRenames(state.soundStreams)).length, [state.soundStreams]);
  const gmDisabledReason = gmRenameCount > 0 ? null
    : state.soundStreams.some(s => gmDrumName(s.originalMidiNote)) ? 'Every GM drum Sound already has its name'
    : 'No Sound has a GM drum pitch (35–81)';
  const gmReason = useDisabledReason(gmDisabledReason);

  const total = counts.all;
  const placed = counts['on-grid'];

  return (
    <div data-testid="sounds-header" className="sticky top-0 z-10 -mx-2.5 -mt-2.5 px-2.5 pt-2.5 pb-2 mb-1 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex flex-col gap-1.5">
      <label className="relative flex items-center">
        <Search size={12} aria-hidden="true" className="absolute left-2 text-[var(--text-tertiary)] pointer-events-none" />
        <input
          type="search"
          data-testid="sounds-search"
          className="pf-input w-full h-7 pl-6 pr-6 text-pf-xs"
          placeholder={`Search ${total} ${total === 1 ? 'Sound' : 'Sounds'}`}
          aria-label="Search Sounds by name"
          value={query}
          onChange={e => onQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape' && query) { e.stopPropagation(); onQuery(''); } }}
        />
        {query && (
          <button
            type="button"
            className="focus-ring absolute right-1 w-5 h-5 flex items-center justify-center rounded-pf-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Clear the search"
            onClick={() => onQuery('')}
          >
            <X size={11} aria-hidden="true" />
          </button>
        )}
      </label>

      {/* The placement filters, with their counts */}
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap items-center gap-1">
        {SOUND_FILTERS.map(f => {
          const checked = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={checked}
              data-testid={`sounds-filter-${f.id}`}
              data-count={counts[f.id]}
              title={f.title}
              className={`focus-ring inline-flex items-center gap-1 h-6 px-2 rounded-full border text-pf-micro font-semibold whitespace-nowrap transition-colors ${
                checked
                  ? 'bg-accent-primary/25 border-accent-primary-soft/70 text-[var(--accent-primary-soft)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
              <span className="tabular-nums opacity-80">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {/* How many are on the grid */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div
            role="progressbar"
            data-testid="sounds-progress"
            aria-label="Sounds on the grid"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={placed}
            aria-valuetext={`${placed} of ${total} on the grid`}
            className="flex-1 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden"
          >
            <div className="h-full rounded-full bg-accent-primary transition-[width] duration-pf-normal" style={{ width: `${(placed / total) * 100}%` }} />
          </div>
          <span className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap tabular-nums">{placed} of {total} on the grid</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1.5">
        {/* Proposes a candidate; never places anything itself (T37, Q4). */}
        {placeRemaining.count > 0 && !layoutReadOnly && (
          <button
            type="button"
            data-testid="sounds-place-remaining"
            className="pf-btn pf-btn-subtle text-pf-xs px-2 py-1"
            disabled={placeRemaining.busy}
            onClick={() => void placeRemaining.placeRemaining()}
            title="Propose a candidate that places them, shown read-only: your placed Sounds stay where they are, and nothing changes until you use it. Muted Sounds are left out."
          >
            {placeRemaining.busy ? 'Placing…' : placeRemainingLabel(placeRemaining.count)}
          </button>
        )}
        <button
          type="button"
          data-testid="name-from-gm"
          className="pf-btn pf-btn-ghost text-pf-xs px-2 py-1 ml-auto"
          disabled={gmRenameCount === 0}
          aria-describedby={gmReason.describedBy}
          onClick={() => dispatch({ type: 'APPLY_GM_DRUM_NAMES' })}
          title={gmRenameCount > 0
            ? `Rename ${gmRenameCount} ${gmRenameCount === 1 ? 'Sound' : 'Sounds'} from the General MIDI drum map (36 → Kick, 38 → Snare …) · one undo step`
            : gmDisabledReason ?? undefined}
        >
          Name from GM drum map
        </button>
      </div>
      <DisabledReason id={gmReason.id} reason={gmDisabledReason} className="block text-right" />
    </div>
  );
}
