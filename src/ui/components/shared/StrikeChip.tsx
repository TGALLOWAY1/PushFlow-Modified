/**
 * StrikeChip (S4.2, T27): one Sound struck at an event, as the Events list and
 * the inspector show it: the Sound's colour and short name, resolved by its
 * id, then the finger the plan plays it with ("L2", FingerChip). A note that
 * can't be played shows ✗; a Sound this layout doesn't place is outlined, as
 * its notes are in the timeline.
 */

import { type FingerAssignment } from '../../../types/executionPlan';
import { fingerName } from '../../../utils/fingerNotation';
import { FingerChip } from './FingerChip';

export interface StrikeSound {
  id: string;
  name: string;
  color?: string;
}

export function strikeTitle(sound: StrikeSound | undefined, note: FingerAssignment | null): string {
  const name = sound?.name ?? 'a removed Sound';
  if (!note) return `${name} · not placed on this layout`;
  if (note.assignedHand === 'Unplayable') return `${name} · can’t be played`;
  return `${name} · ${fingerName(note.assignedHand, note.finger)}`;
}

export function StrikeChip({ sound, shortName, note, testId }: {
  sound: StrikeSound | undefined;
  /** The name to show (without the words every Sound's name starts with). */
  shortName: string;
  /** The plan's note for this Sound at the event; null when the plan has none (not placed). */
  note: FingerAssignment | null;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      data-sound-id={sound?.id}
      data-placement={note ? undefined : 'unplaced'}
      title={strikeTitle(sound, note)}
      className={`inline-flex items-center gap-1 min-w-0 flex-shrink ${note ? '' : 'opacity-70'}`}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-sm flex-shrink-0"
        style={note
          ? { backgroundColor: sound?.color ?? 'transparent' }
          : { border: `1.5px solid ${sound?.color ?? 'var(--border-strong)'}` }}
      />
      <span className="truncate text-pf-xs text-[var(--text-secondary)]">{shortName}</span>
      {note && note.assignedHand === 'Unplayable'
        ? <span className="text-pf-micro font-semibold text-[var(--status-bad)] flex-shrink-0" aria-label="can’t be played">✗</span>
        : note && <FingerChip hand={note.assignedHand} finger={note.finger} className="flex-shrink-0" />}
    </span>
  );
}
