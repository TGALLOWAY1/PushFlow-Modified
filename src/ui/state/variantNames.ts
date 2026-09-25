/**
 * Names for Saved Layout Variants (S2.3, T29): every save used to be called
 * "Default variant". A new variant is offered the displayed layout's base name
 * and when it was saved ("Default – 23 Sep 14:02"), and no two variants share
 * a name: a second save in the same minute is "… (2)". The Active Layout a
 * Promote replaces is auto-saved under the same kind of name (T32).
 */

import { uniqueName } from '../../utils/uniqueName';
import { FALLBACK_LAYOUT_NAME, withoutLegacyRoleWords } from './layoutLabels';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The base name a new variant starts from. Layout names are clean from schema
 * 5 on (T32); older role words ("Default (suggested)") and a trailing "(copy)"
 * are dropped all the same.
 */
export function variantBaseName(layoutName: string): string {
  return withoutLegacyRoleWords(layoutName).replace(/(\s*\(copy\))+\s*$/i, '').trim() || FALLBACK_LAYOUT_NAME;
}

/** "23 Sep 14:02", in local time. */
export function variantStamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${hh}:${mm}`;
}

/** The name a new variant gets: "Default – 23 Sep 14:02", numbered if taken. */
export function suggestVariantName(layoutName: string, taken: Iterable<string>, now: Date = new Date()): string {
  return uniqueName(`${variantBaseName(layoutName)} – ${variantStamp(now)}`, taken);
}
