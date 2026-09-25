/**
 * Names for Saved Layout Variants (S2.3, T29): every save used to be called
 * "Default variant". A new variant is offered the displayed layout's base name
 * and when it was saved ("Default – 23 Sep 14:02"), and no two variants share
 * a name: a second save in the same minute is "… (2)".
 */

import { uniqueName } from '../../utils/uniqueName';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A layout's name without the role words written into it ("Default (suggested)" → "Default"). */
export function variantBaseName(layoutName: string): string {
  return layoutName.replace(/(\s*\((draft|suggested|copy)\))+\s*$/i, '').trim() || 'Layout';
}

/** "23 Sep 14:02", in local time. */
export function variantStamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${hh}:${mm}`;
}

/** The name a new variant is offered: "Default – 23 Sep 14:02", numbered if taken. */
export function suggestVariantName(layoutName: string, taken: Iterable<string>, now: Date = new Date()): string {
  return uniqueName(`${variantBaseName(layoutName)} – ${variantStamp(now)}`, taken);
}
