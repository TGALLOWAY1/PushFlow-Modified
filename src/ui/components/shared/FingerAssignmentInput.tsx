/**
 * FingerAssignmentInput: the "Hand & finger preference (soft)" control (S5.1,
 * T19). It is the one way to set a Sound's finger: the Sounds row, the pad
 * inspector, the selected event, the pad menu, the layout summary's selected
 * note and the Composer all use it.
 *
 * - The chip shows the Sound's preference ("L2"), or with none set the
 *   fingers the plan uses, at reduced opacity ("L2", "L2/L3", "mixed"); never
 *   the "(L2)" format (CLAUDE.md finger display rule).
 * - A click opens the preference: Left or Right, and Thumb to Pinky. With no
 *   preference yet, one is set once both are chosen; half a choice changes
 *   nothing. "Accept" makes the plan's (most-used) finger the preference, and
 *   "Auto (solver)" clears it. "L2" can also be typed; invalid typing is
 *   flagged inline.
 * - Opening it and leaving without choosing changes nothing (T19).
 * - It writes only through onChange, which callers send to the Sound's
 *   voiceConstraints, the one source of truth (invariant 6).
 * - Soft: the solver tries to use it, and may not.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ALL_FINGERS, type FingerType, type HandSide } from '../../../types/fingerModel';
import { FINGER_NUMBER, fingerLabel, fingerName, fingerOnlyName } from '../../../utils/fingerNotation';
import { type PlanFingers } from '../../analysis/planFingers';
import { fingerChipStyle } from './FingerChip';
import { Popover, useOverlayTitleId } from './Overlay';

export interface FingerAssignmentValue {
  hand: HandSide;
  finger: FingerType;
}

/**
 * Parse shorthand like "L1", "R5", "l3" into a structured assignment.
 * Returns null if the input is invalid.
 */
export function parseFingerShorthand(input: string): FingerAssignmentValue | null {
  const match = input.trim().match(/^([LlRr])([1-5])$/);
  if (!match) return null;
  const hand: HandSide = match[1].toUpperCase() === 'L' ? 'left' : 'right';
  const fingerMap: Record<string, FingerType> = {
    '1': 'thumb',
    '2': 'index',
    '3': 'middle',
    '4': 'ring',
    '5': 'pinky',
  };
  return { hand, finger: fingerMap[match[2]] };
}

/** Format a FingerAssignmentValue as compact label, e.g. "L2" (the one notation, S4.2). */
export function fingerAssignmentLabel(fa: FingerAssignmentValue): string {
  return fingerLabel(fa.hand, fa.finger);
}

/** The control's title, as the popover and the chip's accessible name say it. */
export const FINGER_PREFERENCE_TITLE = 'Hand & finger preference (soft)';

function sameValue(a: FingerAssignmentValue | null | undefined, b: FingerAssignmentValue | null | undefined): boolean {
  return !!a && !!b && a.hand === b.hand && a.finger === b.finger;
}

/** "the plan uses L2 (12 hits) and L3 (4 hits)"; "" with no plan. */
function planSentence(plan: PlanFingers | null | undefined): string {
  if (!plan || plan.fingers.length === 0) return '';
  const parts = plan.fingers.map(f => `${f.label} (${f.count} ${f.count === 1 ? 'hit' : 'hits'})`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `the plan uses ${list}`;
}

interface FingerPreferencePanelProps {
  value: FingerAssignmentValue | null | undefined;
  plan?: PlanFingers | null;
  onChange: (value: FingerAssignmentValue | null) => void;
  /** Called after an action that ends the edit (Accept, Auto, a typed Enter). */
  onDone: () => void;
  soundName?: string;
  titleId: string;
}

/** The popover's contents; the pad menu shows the same panel. */
export function FingerPreferencePanel({ value, plan, onChange, onDone, soundName, titleId }: FingerPreferencePanelProps) {
  const current = value ?? null;
  // A half-made choice (a hand with no finger yet, or the reverse): nothing is
  // set until both are chosen.
  const [draftHand, setDraftHand] = useState<HandSide | null>(current?.hand ?? null);
  const [draftFinger, setDraftFinger] = useState<FingerType | null>(current?.finger ?? null);
  useEffect(() => {
    setDraftHand(current?.hand ?? null);
    setDraftFinger(current?.finger ?? null);
  }, [current?.hand, current?.finger]);

  const suggestion = plan?.fingers[0] ?? null;
  const currentLabel = current ? fingerAssignmentLabel(current) : '';
  const [text, setText] = useState(currentLabel);
  // Whether the user typed (or cleared) anything since the field showed its
  // value. Blur without that changes nothing (T19).
  const [touched, setTouched] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  const commit = (next: FingerAssignmentValue | null) => {
    if (next ? !sameValue(next, current) : current !== null) onChange(next);
  };

  const chooseHand = (hand: HandSide) => {
    setDraftHand(hand);
    const finger = current?.finger ?? draftFinger;
    if (finger) commit({ hand, finger });
  };
  const chooseFinger = (finger: FingerType) => {
    setDraftFinger(finger);
    const hand = current?.hand ?? draftHand;
    if (hand) commit({ hand, finger });
  };

  const submitText = () => {
    if (!touched) { onDone(); return; }
    const trimmed = text.trim();
    if (trimmed === '') {
      // Emptied on purpose: clears a preference.
      commit(null);
      onDone();
      return;
    }
    const parsed = parseFingerShorthand(trimmed);
    if (!parsed) { setInvalid(true); return; }
    commit(parsed);
    onDone();
  };

  const pending = !current && (draftHand !== null) !== (draftFinger !== null)
    ? draftHand ? `Pick a finger for the ${draftHand} hand` : `Pick a hand for the ${fingerOnlyName(draftFinger!).toLowerCase()}`
    : null;
  const planText = planSentence(plan);
  const status = current
    ? `Yours: ${currentLabel} · ${fingerName(current.hand, current.finger)}${planText ? `; ${planText}` : ''}.`
    : `No preference: the solver chooses${planText ? `, and ${planText}` : ''}.`;

  return (
    <div className="flex flex-col gap-2 p-2.5 w-[252px]">
      <div className="flex flex-col gap-0.5">
        <h4 id={titleId} className="text-pf-xs font-semibold text-[var(--text-primary)]">{FINGER_PREFERENCE_TITLE}</h4>
        {soundName && <span className="text-pf-micro text-[var(--text-tertiary)] truncate" title={soundName}>{soundName}</span>}
      </div>
      <p data-testid="finger-preference-status" className="text-pf-micro text-[var(--text-secondary)] leading-snug">{status}</p>

      <label className="flex items-center gap-1.5 text-pf-micro text-[var(--text-tertiary)]">
        <span className="w-12">Type</span>
        <input
          ref={inputRef}
          data-testid="finger-input"
          className={`w-12 h-6 px-1 text-center text-pf-xs font-mono rounded-pf-sm border bg-[var(--bg-input)] text-[var(--text-primary)] outline-none placeholder:opacity-50 ${
            invalid ? 'border-red-500' : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]'
          }`}
          value={text}
          maxLength={2}
          // A suggestion shows only as a faint placeholder (CLAUDE.md finger
          // display rule); nothing is set until the user types.
          placeholder={current ? '' : suggestion?.label ?? '--'}
          aria-label={suggestion && !current ? `Type a finger, L1 to R5 (the plan uses ${suggestion.label})` : 'Type a finger, L1 to R5'}
          aria-invalid={invalid || undefined}
          onChange={e => { setText(e.target.value.slice(0, 2)); setTouched(true); setInvalid(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); submitText(); }
          }}
          onBlur={() => {
            // Leaving an invalid entry changes nothing.
            if (invalid) { setText(currentLabel); setTouched(false); setInvalid(false); }
          }}
        />
        {invalid && <span role="alert" className="text-pf-micro text-red-400 whitespace-nowrap">L1–L5 or R1–R5</span>}
      </label>

      <div role="radiogroup" aria-label="Hand" className="flex items-center gap-1">
        <span className="w-12 text-pf-micro text-[var(--text-tertiary)]" aria-hidden="true">Hand</span>
        {(['left', 'right'] as const).map(hand => {
          const checked = (current?.hand ?? draftHand) === hand;
          return (
            <button
              key={hand}
              type="button"
              role="radio"
              aria-checked={checked}
              data-testid={`finger-hand-${hand}`}
              className={choiceClass(checked)}
              style={checked ? fingerChipStyle(hand) : undefined}
              onClick={() => chooseHand(hand)}
            >
              {hand === 'left' ? 'Left' : 'Right'}
            </button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label="Finger" className="flex items-center gap-1">
        <span className="w-12 text-pf-micro text-[var(--text-tertiary)]" aria-hidden="true">Finger</span>
        {ALL_FINGERS.map(finger => {
          const checked = (current?.finger ?? draftFinger) === finger;
          return (
            <button
              key={finger}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={fingerOnlyName(finger)}
              title={`${fingerOnlyName(finger)} (${FINGER_NUMBER[finger]})`}
              data-testid={`finger-finger-${FINGER_NUMBER[finger]}`}
              className={`${choiceClass(checked)} w-7 font-mono`}
              onClick={() => chooseFinger(finger)}
            >
              {FINGER_NUMBER[finger]}
            </button>
          );
        })}
      </div>
      {pending && <p data-testid="finger-pending" className="text-pf-micro text-[var(--text-tertiary)]">{pending}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {suggestion && !sameValue(current, suggestion) && (
          <button
            type="button"
            data-testid="finger-accept"
            className={ACTION}
            title={`Make the plan's finger for it your preference: ${fingerName(suggestion.hand, suggestion.finger)}${plan && plan.fingers.length > 1 ? ', the one it uses most' : ''}`}
            onClick={() => { commit({ hand: suggestion.hand, finger: suggestion.finger }); onDone(); }}
          >
            Accept {suggestion.label}
          </button>
        )}
        <button
          type="button"
          data-testid="finger-auto"
          aria-pressed={!current}
          className={`${ACTION} ${!current ? 'bg-accent-primary/20 text-[var(--accent-primary-soft)]' : ''}`}
          title={current ? 'Clear it: the solver chooses the finger' : 'No preference: the solver chooses the finger'}
          onClick={() => { commit(null); onDone(); }}
        >
          Auto (solver)
        </button>
      </div>
      <p className="text-pf-micro text-[var(--text-tertiary)] leading-snug">Soft: the solver tries to use it, and may not. It belongs to the Sound, on every layout.</p>
    </div>
  );
}

const ACTION = 'focus-ring inline-flex items-center h-6 px-2 rounded-pf-sm border border-[var(--border-default)] text-pf-micro font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors';

function choiceClass(checked: boolean): string {
  return `focus-ring inline-flex items-center justify-center h-6 px-2 rounded-pf-sm border text-pf-micro font-semibold transition-colors ${
    checked
      ? 'border-[var(--border-strong)] text-[var(--text-primary)] bg-[var(--bg-active)]'
      : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
  }`;
}

interface FingerAssignmentInputProps {
  /** The Sound's own preference, or null when it has none. */
  value: FingerAssignmentValue | null | undefined;
  /** The fingers the plan uses for the Sound, shown faintly when it has no preference. */
  plan?: PlanFingers | null;
  onChange: (assignment: FingerAssignmentValue | null) => void;
  /** The Sound's name, for the accessible name and the popover. */
  soundName?: string;
  size?: 'sm' | 'md';
  testId?: string;
}

export function FingerAssignmentInput({
  value, plan, onChange, soundName, size = 'sm', testId = 'finger-preference',
}: FingerAssignmentInputProps) {
  const chipRef = useRef<HTMLButtonElement>(null);
  const [openAt, setOpenAt] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => setOpenAt(null), []);
  const titleId = useOverlayTitleId();

  const preference = value ?? null;
  const suggestionLabel = !preference && plan && plan.fingers.length > 0 ? plan.label : '';
  const label = preference ? fingerAssignmentLabel(preference) : suggestionLabel || '··';
  // One hand for the whole Sound: its colour; two hands (a "mixed" plan): neutral.
  const hands = preference ? [preference.hand] : [...new Set(plan?.fingers.map(f => f.hand) ?? [])];
  const style: CSSProperties = {
    ...(hands.length === 1 ? fingerChipStyle(hands[0]) : { backgroundColor: 'rgba(100,100,100,0.1)' }),
    color: preference || suggestionLabel ? 'var(--text-primary)' : 'var(--text-tertiary)',
    // The solver's suggestion is faint; the user's own preference is not.
    opacity: preference ? 1 : suggestionLabel ? 0.5 : 1,
  };
  const who = soundName ? ` for ${soundName}` : '';
  const state = preference
    ? `${label} · ${fingerName(preference.hand, preference.finger)}`
    : suggestionLabel ? `none; ${planSentence(plan)}` : 'none';

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        data-testid={testId}
        data-preference={preference ? label : ''}
        data-suggestion={suggestionLabel || undefined}
        aria-label={`${FINGER_PREFERENCE_TITLE}${who}: ${state}`}
        aria-haspopup="dialog"
        aria-expanded={openAt !== null}
        title={preference
          ? `Your preference: ${fingerName(preference.hand, preference.finger)} · soft · click to change`
          : suggestionLabel
            ? `No preference: ${planSentence(plan)} · click to set one`
            : 'No preference · click to set one'}
        className={`focus-ring inline-flex items-center justify-center flex-shrink-0 h-6 ${size === 'sm' ? 'min-w-[28px]' : 'min-w-[32px]'} px-1 rounded-pf-sm text-pf-xs font-mono font-semibold transition-colors`}
        style={style}
        onClick={() => {
          // The chip toggles it: a press on it isn't outside the popover (anchor).
          if (openAt) { close(); return; }
          const r = chipRef.current?.getBoundingClientRect();
          if (r) setOpenAt({ x: r.left, y: r.bottom + 4 });
        }}
      >
        {label}
      </button>
      {openAt && (
        <Popover
          x={openAt.x}
          y={openAt.y}
          role="dialog"
          labelledBy={titleId}
          onClose={close}
          returnFocusTo={chipRef.current}
          anchor={chipRef.current}
          testId="finger-preference-popover"
          className="rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl"
        >
          <FingerPreferencePanel
            value={preference}
            plan={plan}
            onChange={onChange}
            onDone={close}
            soundName={soundName}
            titleId={titleId}
          />
        </Popover>
      )}
    </>
  );
}

