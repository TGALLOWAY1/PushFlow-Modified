/**
 * Plain-language lines for the docked moment inspector (S4.2, T27).
 *
 * - Why the event is as hard as it is: the factor that carries most of its
 *   cost and that factor's share, from the same numbers the inspector's factor
 *   bars show (FACTOR_META), so the sentence and the bars never disagree.
 * - What the move to the next event asks: the engine's own transition
 *   analysis (analyzeTransition, explainTransition), on the timeline's events
 *   (S4.1) rather than the explainer's own grouping, and how many fingers
 *   move to another pad.
 *
 * Sounds and fingers are named as everywhere else, and times are musical or in
 * ms: never a MIDI note number or raw seconds (Q3, T20, T43).
 */

import { type MomentCost } from '@/engine';
import { analyzeTransition } from '../../engine/evaluation/transitionAnalyzer';
import { explainTransition } from '../../engine/analysis/eventExplainer';
import { groupAssignmentsIntoMoments } from '../../engine/evaluation/eventMetrics';
import { type FingerAssignment } from '../../types/executionPlan';
import { formatMilliseconds } from '../../utils/musicalTime';
import { FACTOR_KEYS, FACTOR_META, factorsFromBreakdown, type FactorKey } from './factorMeta';
import { type SelectedTransitionModel } from './selectionModel';

export interface MomentWhy {
  text: string;
  /** The factor carrying most of the event's cost; null when nothing does. */
  dominant: FactorKey | null;
  /** Its share of the event's cost, from 0 to 1. */
  share: number | null;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * One sentence: why this event is as hard as it is. The difficulty itself is
 * the badge beside it, so the sentence starts with the reason.
 */
export function explainMomentCost(cost: MomentCost | null): MomentWhy {
  if (!cost) {
    return { text: 'None of its Sounds is on this layout’s pads, so nothing here is judged yet.', dominant: null, share: null };
  }
  if (cost.difficulty === 'Unplayable' || !cost.breakdown) {
    const noteWord = cost.noteCount === 1 ? 'note' : 'notes';
    return {
      text: `${cost.unplayableNoteCount} of ${cost.noteCount} ${noteWord} can’t be played: a Sound has no pad, or no grip reaches it.`,
      dominant: null,
      share: null,
    };
  }
  const factors = factorsFromBreakdown(cost.breakdown);
  const total = FACTOR_KEYS.reduce((sum, key) => sum + factors[key], 0);
  if (total < 0.01) return { text: 'Nothing here strains the hands.', dominant: null, share: null };
  const dominant = FACTOR_KEYS.reduce((best, key) => (factors[key] > factors[best] ? key : best));
  const share = factors[dominant] / total;
  const meta = FACTOR_META[dominant];
  return {
    text: `Mostly ${meta.label} (${Math.round(share * 100)}% of its cost): ${lowerFirst(meta.description)}`,
    dominant,
    share,
  };
}

/** The engine's moment for a timeline event: its notes, at the event's own start. */
function analyzedMoment(notes: readonly FingerAssignment[], startTime: number) {
  return groupAssignmentsIntoMoments(notes.map(note => ({ ...note, startTime })))[0] ?? null;
}

/**
 * One sentence: the move to the next event the plan plays. `nextLabel` names
 * it ("Event 13").
 */
export function explainMomentTransition(model: SelectedTransitionModel | null, nextLabel: string | null): string {
  if (!model) return '';
  if (!model.next || model.timeDelta === null) return 'This is the last event the plan plays.';
  const from = analyzedMoment(model.current.assignments, model.current.startTime);
  const to = analyzedMoment(model.next.assignments, model.next.startTime);
  // Fingers that strike a different pad next (the grid's arrows); a finger
  // striking its own pad again isn't a move.
  const moving = model.fingerMoves.filter(move => move.fromPad && move.toPad && !move.isHold).length;
  const fingers = moving === 0 ? '' : `; ${moving} ${moving === 1 ? 'finger moves' : 'fingers move'} to another pad`;
  const when = `${nextLabel ?? 'The next event'} in ${formatMilliseconds(model.timeDelta)}`;
  if (!from || !to) return `Next: ${when}${fingers}.`;
  const explanation = explainTransition(analyzeTransition(from, to));
  // An easy move needs no reasons.
  const why = explanation.level !== 'easy' && explanation.contributors.length > 0 ? ` (${explanation.contributors.join(', ')})` : '';
  return `Next: ${when}, ${explanation.level}${why}${fingers}.`;
}
