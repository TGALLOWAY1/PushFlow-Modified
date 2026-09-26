/**
 * Layout names and labels (T32).
 *
 * A layout stores a clean base name ("Default") and its provenance
 * (types/layout.ts). Roles never go into names: the name a surface shows is
 * built here, from the role and the base name, so a promoted draft never reads
 * "Active · Default (draft)" and an edit never makes "Default (draft) (draft)".
 */

import { type Layout, type LayoutRole } from '../../types/layout';

/** What a layout is called when it has no name of its own. */
export const FALLBACK_LAYOUT_NAME = 'Layout';

/**
 * The role words versions before schema 5 wrote into names: " (draft)",
 * " (suggested)" and " (replaced 24/09/2026)" (the date in the browser's
 * locale), in any order, repeated, anywhere in the name. Nothing writes them
 * now; the clean-layout-names migration takes them out of stored names.
 */
const ROLE_WORDS = /\s*\((draft|suggested|replaced(?:\s[^()]*)?)\)/g;

export type LegacyRoleWord = 'draft' | 'suggested' | 'replaced';

/** The role words in a name, in order: "Default (suggested) (draft)" → ['suggested', 'draft']. */
export function legacyRoleWords(name: string): LegacyRoleWord[] {
  return [...name.matchAll(ROLE_WORDS)].map(m => (m[1]!.startsWith('replaced') ? 'replaced' : m[1]) as LegacyRoleWord);
}

/** A name without role words: "Default (draft) variant" → "Default variant"; never empty. */
export function withoutLegacyRoleWords(name: string): string {
  return name.replace(ROLE_WORDS, '').trim() || FALLBACK_LAYOUT_NAME;
}

/** The roles a label can name: the canon's layout states, plus a recovered draft. */
export type LayoutLabelRole = LayoutRole | 'candidate' | 'recovered';

export interface LayoutLabelOptions {
  /** The role it is shown in; by default the layout's own (a recovered draft by its provenance). */
  role?: LayoutLabelRole;
  /**
   * Lead with the role, for places with no role chip or badge beside the name
   * ("Active: Default"). A draft's label already says what it is.
   */
  withRole?: boolean;
}

/**
 * The name a surface shows for a layout, built from its role and base name:
 *
 * | role                 | label                         | withRole                      |
 * |----------------------|-------------------------------|-------------------------------|
 * | Working/Test Layout  | Draft of Default              | Draft of Default              |
 * | recovered draft      | Draft of Default              | Recovered draft of Default    |
 * | Active Layout        | Default                       | Active: Default               |
 * | Saved Layout Variant | Wide hands                    | Saved variant: Wide hands     |
 * | Candidate Solution   | Coordination-Optimized        | Candidate: Coordination-Optimized |
 *
 * A draft's base name is the name of the layout it was branched from, so "Draft
 * of" says what it is a draft of. Renames edit the base name, never the label.
 */
export function layoutLabel(
  layout: Pick<Layout, 'name' | 'role' | 'provenance'>,
  { role, withRole = false }: LayoutLabelOptions = {},
): string {
  const name = layout.name.trim() || FALLBACK_LAYOUT_NAME;
  switch (role ?? (layout.provenance === 'recovered' ? 'recovered' : layout.role)) {
    case 'working': return `Draft of ${name}`;
    case 'recovered': return withRole ? `Recovered draft of ${name}` : `Draft of ${name}`;
    case 'active': return withRole ? `Active: ${name}` : name;
    case 'variant': return withRole ? `Saved variant: ${name}` : name;
    case 'candidate': return withRole ? `Candidate: ${name}` : name;
  }
}
