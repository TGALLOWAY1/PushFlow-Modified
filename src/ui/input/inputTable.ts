/**
 * The one input table (T61).
 *
 * Every pointer and key meaning in the editor, by mode, in one list:
 * - one keyboard listener routes keys through it (inputRegistry.ts), so no
 *   component adds a window key listener of its own;
 * - the grid asks it what a pad click means (padClickMeaning);
 * - the '?' sheet and Learn More's keyboard tab are generated from it.
 * Every row has a registry test (test/ui/input/inputTable.test.tsx). Rows with
 * `from` belong to a later phase: they are listed so the meaning is reserved,
 * but nothing is bound to them yet and the sheet leaves them out.
 */

export type InputRowId =
  | 'arm-sound'
  | 'drag-sound'
  | 'pad-click-armed'
  | 'pad-click-moment'
  | 'pad-click-idle'
  | 'pad-alt-click'
  | 'drag-pad'
  | 'pad-menu'
  | 'pad-enter'
  | 'space'
  | 'step-events'
  | 'events-list-keys'
  | 'escape'
  | 'delete'
  | 'rename-sound'
  | 'group-sounds'
  | 'undo'
  | 'redo'
  | 'save'
  | 'shortcut-sheet';

export type InputGroup = 'Placing Sounds' | 'Pads' | 'Playback and events' | 'Editing' | 'Help';

/** The parts of a key event the table matches on. */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface InputRow {
  id: InputRowId;
  group: InputGroup;
  /**
   * What is pressed or clicked, one entry per alternative. Keys are written as
   * chords ("Mod+Shift+Z"; Mod is ⌘ on a Mac and Ctrl elsewhere).
   */
  input: string[];
  /** The mode it applies in. */
  when: string;
  /** What it does. */
  does: string;
  /** Keyboard rows: which key events are this row. */
  keys?: (e: KeyLike) => boolean;
  /** Also acts from text fields, menus and dialogs (Save). */
  anywhere?: boolean;
  /** Acts only while focus is inside an element matching this selector. */
  within?: string;
  /** A row reserved for a later phase: listed, not bound, not in the sheet. */
  from?: 'P3' | 'P4' | 'P8';
}

const noModifiers = (e: KeyLike) => !e.metaKey && !e.ctrlKey && !e.altKey;
const plain = (e: KeyLike) => noModifiers(e) && !e.shiftKey;
const mod = (e: KeyLike) => (e.metaKey || e.ctrlKey) && !e.altKey;
const letter = (e: KeyLike, l: string) => e.key.toLowerCase() === l;

export const EVENTS_LIST_SCOPE = '[data-input-scope="events"]';

export const INPUT_TABLE: readonly InputRow[] = [
  // Placing Sounds
  {
    id: 'arm-sound', group: 'Placing Sounds',
    input: ['Click a Sound'], when: 'Sounds panel',
    does: 'Arms it for placing. After each placement the next unplaced Sound is armed.',
  },
  {
    id: 'pad-click-armed', group: 'Placing Sounds',
    input: ['Click a pad'], when: 'A Sound is armed',
    does: 'Places it on an empty pad, as one undo step. An occupied pad says "Pad taken · drag to swap".',
  },
  {
    id: 'drag-sound', group: 'Placing Sounds',
    input: ['Drag a Sound onto a pad'], when: 'Any time',
    does: 'Places it there. A Sound already on that pad comes off the grid.',
  },
  // Pads
  {
    id: 'pad-click-moment', group: 'Pads',
    input: ['Click a pad'], when: 'An event is selected',
    does: 'Selects the pad and keeps the event.',
  },
  {
    id: 'pad-click-idle', group: 'Pads',
    input: ['Click a pad'], when: 'Nothing armed or selected',
    does: 'Selects the pad and its Sound. An empty pad clears the selection.',
  },
  {
    id: 'pad-alt-click', group: 'Pads',
    input: ['Alt-click a pad'], when: 'Any time',
    does: 'Plays the pad\'s Sound. A plain click never does.', from: 'P4',
  },
  {
    id: 'drag-pad', group: 'Pads',
    input: ['Drag a pad onto another'], when: 'Any time',
    does: 'Swaps the two pads, or moves the Sound to an empty pad.',
  },
  {
    id: 'pad-menu', group: 'Pads',
    input: ['Right-click a pad'], when: 'Any time',
    does: 'Opens its menu: lock, finger preference, remove.',
  },
  {
    id: 'pad-enter', group: 'Pads',
    input: ['Enter'], when: 'A pad has focus',
    does: 'Picks the pad up, or drops it.', from: 'P8',
  },
  {
    id: 'delete', group: 'Pads',
    input: ['Delete', 'Backspace'], when: 'A pad is selected',
    does: 'Takes its Sound off the pad, with Undo in the toast. With no pad selected, nothing.',
    keys: e => plain(e) && (e.key === 'Delete' || e.key === 'Backspace'),
  },
  // Playback and events
  {
    id: 'space', group: 'Playback and events',
    input: ['Space'], when: 'Anywhere except a text field',
    does: 'Plays or stops, even with a button focused (Enter presses buttons); a focused checkbox is ticked instead. With the Composer tab open, plays or stops the pattern.',
    keys: e => plain(e) && e.key === ' ',
  },
  {
    id: 'step-events', group: 'Playback and events',
    input: ['←', '→'], when: 'Stopped',
    does: 'Selects the previous or next event, stopping at the first and last. In a row of tabs they move between the tabs instead.',
    keys: e => plain(e) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'),
  },
  {
    id: 'events-list-keys', group: 'Playback and events',
    input: ['↑', '↓', 'K', 'J'], when: 'In the Events list, stopped',
    does: 'Selects the previous or next event.',
    keys: e => plain(e) && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'j' || e.key === 'k'),
    within: EVENTS_LIST_SCOPE,
  },
  {
    id: 'escape', group: 'Playback and events',
    input: ['Esc'], when: 'Any time',
    does: 'Steps back one layer: closes the open menu or dialog, else stops placing, else clears the pad selection, else the event.',
    keys: e => plain(e) && e.key === 'Escape',
  },
  // Editing
  {
    id: 'rename-sound', group: 'Editing',
    input: ['Double-click', 'F2', 'Enter'], when: 'On a Sound\'s name',
    does: 'Renames it. Enter or Tab moves on to the next Sound; Esc keeps the old name.',
  },
  {
    id: 'group-sounds', group: 'Editing',
    input: ['Mod+G'], when: 'Sounds selected (Mod- or Shift-click)',
    does: 'Groups them, or ungroups them if they are all in one group.',
    keys: e => mod(e) && !e.shiftKey && letter(e, 'g'),
  },
  {
    id: 'undo', group: 'Editing',
    input: ['Mod+Z'], when: 'Outside text fields',
    does: 'Undoes the last edit.',
    keys: e => mod(e) && !e.shiftKey && letter(e, 'z'),
  },
  {
    id: 'redo', group: 'Editing',
    input: ['Mod+Shift+Z', 'Mod+Y'], when: 'Outside text fields',
    does: 'Redoes it.',
    keys: e => mod(e) && ((e.shiftKey && letter(e, 'z')) || (!e.shiftKey && letter(e, 'y'))),
  },
  {
    id: 'save', group: 'Editing',
    input: ['Mod+S'], when: 'Anywhere',
    does: 'Saves now.',
    keys: e => mod(e) && !e.shiftKey && letter(e, 's'),
    anywhere: true,
  },
  // Help
  {
    id: 'shortcut-sheet', group: 'Help',
    input: ['?'], when: 'Outside text fields',
    does: 'Shows this list.',
    keys: e => noModifiers(e) && e.key === '?',
  },
];

export const INPUT_GROUPS: readonly InputGroup[] = ['Placing Sounds', 'Pads', 'Playback and events', 'Editing', 'Help'];

export function inputRow(id: InputRowId): InputRow {
  const row = INPUT_TABLE.find(r => r.id === id);
  if (!row) throw new Error(`No input row ${id}`);
  return row;
}

/** Rows that work today, for the sheet. */
export function boundRows(): InputRow[] {
  return INPUT_TABLE.filter(r => !r.from);
}

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}

/** One alternative of a row's input, as the sheet shows it on this platform. */
export function displayInput(input: string, mac = isMacPlatform()): string {
  if (!/^(Mod|Shift|Alt)\+/.test(input)) return mac ? input.replace(/^Alt-/, 'Option-') : input;
  const parts = input.split('+').map(part => {
    if (part === 'Mod') return mac ? '⌘' : 'Ctrl';
    if (part === 'Shift') return mac ? '⇧' : 'Shift';
    if (part === 'Alt') return mac ? '⌥' : 'Alt';
    return part;
  });
  return parts.join(mac ? '' : '+');
}

const KEY_NAME = /^([A-Z0-9?←→↑↓]|F\d{1,2}|Space|Esc|Enter|Delete|Backspace|Tab)$/;

/** Whether an input alternative is a key or chord (shown as keycaps) rather than a gesture. */
export function isKeyInput(input: string): boolean {
  return /^(Mod|Shift|Alt)\+/.test(input) || KEY_NAME.test(input);
}

/** The "when" text with Mod spelled for this platform. */
export function displayWhen(when: string, mac = isMacPlatform()): string {
  return when.replace(/\bMod\b/g, mac ? '⌘' : 'Ctrl');
}

// ---------------------------------------------------------------------------
// Pad clicks
// ---------------------------------------------------------------------------

export interface PadClickContext {
  /** A Sound is armed for placing. */
  armed: boolean;
  /** The pad holds a Sound. */
  occupied: boolean;
  /** The pad holds the armed Sound itself. */
  holdsArmed: boolean;
  /** An event is selected. */
  eventSelected: boolean;
  altKey: boolean;
}

export type PadClickMeaning =
  | { row: 'pad-alt-click'; action: 'none' }
  | { row: 'pad-click-armed'; action: 'place' | 'taken' | 'disarm' }
  | { row: 'pad-click-moment' | 'pad-click-idle'; action: 'select-pad' | 'clear-pad' };

/** What a click on a pad means, by mode (the table's pad-click rows, in order). */
export function padClickMeaning(ctx: PadClickContext): PadClickMeaning {
  // Reserved for audition (P4): until then an Alt-click does nothing, so no
  // habit forms around it.
  if (ctx.altKey) return { row: 'pad-alt-click', action: 'none' };
  if (ctx.armed) {
    // Its own pad: nothing to place, so placing ends.
    if (ctx.holdsArmed) return { row: 'pad-click-armed', action: 'disarm' };
    return { row: 'pad-click-armed', action: ctx.occupied ? 'taken' : 'place' };
  }
  const row = ctx.eventSelected ? 'pad-click-moment' : 'pad-click-idle';
  return { row, action: ctx.occupied ? 'select-pad' : 'clear-pad' };
}

/** The message an occupied pad gives while a Sound is armed. */
export const PAD_TAKEN_MESSAGE = 'Pad taken · drag to swap';
