/**
 * The layout lifecycle's named actions (S3.4, Learn More's Lifecycle section).
 *
 * One list: the layout-state bar takes its buttons' words from it, and Learn
 * More renders its Lifecycle section from it and from ROLE_META (the roles),
 * so the words on the buttons and the explanation can't drift apart. Each
 * action that changes a layout is one undo step, confirmed by a toast with
 * Undo; Inspect and Back to my draft only change what is on screen.
 */

export type LifecycleActionId = 'inspect' | 'back' | 'use-as-draft' | 'save-variant' | 'keep' | 'promote' | 'discard';

export interface LifecycleAction {
  id: LifecycleActionId;
  /** The button's words wherever it appears. */
  label: string;
  /** The layouts it is offered on, in the roles' words (ROLE_META). */
  on: string;
  /** What it does, for Learn More. */
  description: string;
}

/** In the order a layout usually meets them: look, take it up, keep it, commit or drop it. */
export const LIFECYCLE_ACTIONS: readonly LifecycleAction[] = [
  {
    id: 'inspect',
    label: 'Inspect',
    on: 'A candidate, the Active Layout, a saved variant or a recovered draft',
    description: 'Shows it on the grid, read-only, with its own analysis, timeline and optimizer trace. Looking never changes your draft.',
  },
  {
    id: 'back',
    label: 'Back to my draft',
    on: 'Any layout shown read-only',
    description: 'Shows the layout you are editing again (Back to Active when you have no draft).',
  },
  {
    id: 'use-as-draft',
    label: 'Use as my draft',
    on: 'A candidate, a saved variant (Edit as draft) or a recovered draft',
    description: 'Makes it your Working/Test Layout, to edit it. When your draft differs from Active you choose first: save it as a variant, or replace it; a replaced draft stays in Recovered drafts.',
  },
  {
    id: 'save-variant',
    label: 'Save variant',
    on: 'Your draft',
    description: 'Save as variant: keeps your draft as a Saved Layout Variant under a name you choose. The Active Layout does not change.',
  },
  {
    id: 'keep',
    label: 'Keep as variant',
    on: 'A candidate',
    description: 'Keeps a candidate as a Saved Layout Variant named after how it was made. Candidates are temporary and are not saved with the project: keep the ones you like.',
  },
  {
    id: 'promote',
    label: 'Promote',
    on: 'Your draft, a candidate or a saved variant',
    description: 'Makes it the new Active Layout at once, with Undo in the toast. The Active Layout it replaces is saved as a variant, and a draft that is not the layout you promote goes to Recovered drafts.',
  },
  {
    id: 'discard',
    label: 'Discard',
    on: 'Your draft',
    description: 'Drops your draft and shows the Active Layout again, with Undo in the toast. Finger preferences stay: they belong to the Sounds.',
  },
];

/** An action's button words. */
export function lifecycleLabel(id: LifecycleActionId): string {
  return LIFECYCLE_ACTIONS.find(a => a.id === id)!.label;
}
