/**
 * What a partly placed layout still lacks (S3.3, T25 and T37): the Sounds in
 * scope that have no pad yet, each with a drag handle (drag it onto a pad, as
 * from the Sounds panel; a click arms it for click-to-place), and "Place
 * remaining N Sounds", which proposes a candidate and never places anything
 * itself (decision Q4). Shown for the layout being edited only.
 */

import { GripVertical } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { resolveInspectedLayout } from '../../state/projectState';
import { placeRemainingLabel, usePlaceRemaining } from '../../hooks/usePlaceRemaining';
import { setSoundDragData } from '../dragTypes';

export function UnplacedSounds() {
  const { state, dispatch } = useProject();
  const shown = resolveInspectedLayout(state);
  const { count, busy, placeRemaining } = usePlaceRemaining();
  if (shown.readOnly) return null;
  const placedIds = new Set(Object.values(shown.layout.padToVoice).map(v => v.id));
  const sounds = state.soundStreams.filter(s => !s.muted && s.events.length > 0 && !placedIds.has(s.id));
  // Nothing placed at all is the empty grid's own state (Suggest a starting layout).
  if (sounds.length === 0 || placedIds.size === 0) return null;

  return (
    <div data-testid="unplaced-sounds" className="rounded-pf-sm border border-dashed border-[var(--border-default)] bg-bg-card/40 p-2.5 space-y-2">
      <div className="text-pf-xs font-semibold text-[var(--text-secondary)]">
        Not placed yet <span className="font-normal text-[var(--text-tertiary)]">· drag onto a pad, or click, then a pad</span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Sounds not placed yet">
        {sounds.map(s => (
          <li key={s.id}>
            <button
              type="button"
              draggable
              data-testid="unplaced-sound"
              data-sound-id={s.id}
              aria-pressed={state.armedStreamId === s.id}
              onDragStart={e => setSoundDragData(e.dataTransfer, s)}
              onClick={() => dispatch({ type: 'ARM_SOUND', payload: s.id })}
              className={`inline-flex items-center gap-1 h-6 pl-0.5 pr-2 rounded-pf-sm border text-pf-xs text-[var(--text-primary)] cursor-grab focus-ring ${
                state.armedStreamId === s.id ? 'border-[var(--border-strong)] bg-[var(--bg-active)]' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'
              }`}
              title={`Drag ${s.name} onto a pad, or click it and then a pad`}
            >
              <GripVertical size={12} aria-hidden="true" className="text-[var(--text-tertiary)]" />
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="place-remaining"
        className="pf-btn pf-btn-subtle text-pf-xs min-h-[24px]"
        disabled={busy}
        onClick={() => void placeRemaining()}
        title="Propose a candidate that places them, shown read-only: your placed Sounds stay where they are, and nothing changes until you use it"
      >
        {busy ? 'Placing…' : placeRemainingLabel(count)}
      </button>
    </div>
  );
}
