/**
 * The pad inspector, docked beside the grid (S4.2, T28): what a pad click
 * opens. A pad click selects the pad (an outline) and its Sound, and no longer
 * selects an event: only an explicit event action dims the grid.
 *
 * - The pad and its Sound, and how many times the Sound is struck.
 * - Its "Hand & finger preference (soft)", the one control (S5.1): it writes
 *   the Sound's voiceConstraints, the one source of truth (invariant 6), and
 *   shows the plan's fingers faintly when none is set.
 * - Lock and Remove (with Undo), refused on a read-only layout (S3.2).
 * - Its hits: "Show its hits" selects the first; with an event selected,
 *   Prev hit and Next hit step through them. The timeline outlines all of them
 *   (the selected Sound's notes), and a pad click never moves the event.
 */

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import { useProject } from '../../state/ProjectContext';
import { getInspectedLayout, isPadLocked } from '../../state/projectState';
import { getEventTimeline, resolveEventKey, type TimelineEvent } from '../../analysis/eventTimeline';
import { buildSoundStreamLookup } from '../../analysis/soundStreamLookup';
import { formatPadPosition } from '../../../utils/padPosition';
import { useReadOnlyHint } from '../../hooks/useReadOnlyHint';
import { useRemovePadWithUndo } from '../../hooks/useRemovePadWithUndo';
import { useFingerPreference } from '../../hooks/useFingerPreference';
import { FingerAssignmentInput } from '../shared/FingerAssignmentInput';
import { IconButton } from '../shared/IconButton';
import { ToggleButton } from '../shared/ToggleButton';
import { DisabledReason, useDisabledReason } from '../shared/DisabledReason';

const STEP = 'focus-ring inline-flex items-center gap-0.5 h-6 px-1.5 rounded-pf-sm border border-[var(--border-default)] bg-[var(--bg-card)] text-pf-micro font-semibold text-[var(--text-secondary)] whitespace-nowrap enabled:hover:bg-[var(--bg-hover)] enabled:hover:text-[var(--text-primary)] disabled:opacity-[0.35] disabled:cursor-not-allowed';

export function PadInspector() {
  const { state, dispatch } = useProject();
  const { hint: readOnlyHint, refuse: refuseEdit } = useReadOnlyHint();
  const removePad = useRemovePadWithUndo();
  const padKey = state.selectedPadKey;
  const layout = getInspectedLayout(state);
  const lookup = useMemo(() => buildSoundStreamLookup(state.soundStreams), [state.soundStreams]);
  const voice = padKey ? layout.padToVoice[padKey] : undefined;
  const sound = voice ? lookup.forVoice(voice) ?? null : null;
  const timeline = getEventTimeline(state);
  // Where this Sound is struck: every event it plays in, in time order.
  const hits = useMemo(
    () => (sound ? timeline.events.filter(event => event.soundIds.includes(sound.id)) : []),
    [timeline, sound],
  );
  const locked = !!padKey && isPadLocked(layout, padKey);
  const removeReason = useDisabledReason(locked ? 'Locked · Unlock to remove' : null);
  const finger = useFingerPreference(sound?.id);
  if (!padKey || !voice || !sound) return null;

  const selectedIndex = resolveEventKey(timeline, state.selectedMomentKey)?.index ?? null;
  const hitAt = selectedIndex === null ? -1 : hits.findIndex(event => event.index === selectedIndex);
  const previousHit = selectedIndex === null ? null : [...hits].reverse().find(event => event.index < selectedIndex) ?? null;
  const nextHit = selectedIndex === null ? null : hits.find(event => event.index > selectedIndex) ?? null;
  const select = (event: TimelineEvent | null | undefined) => {
    if (event) dispatch({ type: 'SELECT_EVENT', payload: { key: event.key, startTime: event.startTime } });
  };

  return (
    <div data-testid="pad-inspector" className="flex flex-col gap-2 min-w-0 border-t border-[var(--border-subtle)] pt-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-header truncate">Pad · {formatPadPosition(padKey)}</h3>
        <IconButton
          label="Close the pad inspector (Esc)"
          testId="pad-inspector-close"
          onClick={() => dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } })}
        >
          <X size={12} />
        </IconButton>
      </div>

      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0" title={sound.name}>
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sound.color }} />
          <span data-testid="pad-inspector-sound" className="text-pf-sm font-medium text-[var(--text-primary)] truncate">{sound.name}</span>
        </span>
        <span data-testid="pad-inspector-hits" className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap">
          {hitAt >= 0 ? `hit ${hitAt + 1} of ${hits.length}` : `${hits.length} ${hits.length === 1 ? 'hit' : 'hits'}`}
        </span>
      </div>

      {/* Its hits: the first, or the one before or after the selected event. */}
      <div role="group" aria-label="Its hits" className="flex items-center gap-1">
        {selectedIndex === null ? (
          <button
            type="button"
            data-testid="pad-show-hits"
            className={STEP}
            disabled={hits.length === 0}
            title="Select its first hit; Prev hit and Next hit then step through them"
            onClick={() => select(hits[0])}
          >
            Show its hits
          </button>
        ) : (
          <>
            <button type="button" data-testid="pad-prev-hit" className={STEP} disabled={!previousHit} title="The hit of this Sound before the selected event" onClick={() => select(previousHit)}>
              <ChevronLeft size={12} aria-hidden="true" />Prev hit
            </button>
            <button type="button" data-testid="pad-next-hit" className={STEP} disabled={!nextHit} title="The hit of this Sound after the selected event" onClick={() => select(nextHit)}>
              Next hit<ChevronRight size={12} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-pf-micro text-[var(--text-tertiary)]" title="A soft preference: the solver tries to use it, and may not">Hand &amp; finger (soft)</span>
        <FingerAssignmentInput {...finger} soundName={sound.name} size="md" testId="pad-inspector-finger" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ToggleButton
          size="sm"
          pressed={locked}
          label={locked ? 'Locked' : 'Lock'}
          icon={<Lock size={11} />}
          title={readOnlyHint ?? (locked ? 'Unlock: generation may move it' : 'Lock it to this pad: every generation method keeps it here')}
          testId="pad-inspector-lock"
          onPressedChange={() => {
            if (refuseEdit()) return;
            dispatch({ type: 'TOGGLE_PLACEMENT_LOCK', payload: { voiceId: sound.id, padKey } });
          }}
        />
        <button
          type="button"
          data-testid="pad-inspector-remove"
          className={STEP}
          disabled={locked}
          aria-describedby={removeReason.describedBy}
          onClick={() => {
            removePad(padKey);
            if (!readOnlyHint) dispatch({ type: 'SELECT_PAD', payload: { padKey: null, streamId: null } });
          }}
        >
          Remove
        </button>
        <DisabledReason id={removeReason.id} reason={locked ? 'Locked · Unlock to remove' : null} />
      </div>
    </div>
  );
}
