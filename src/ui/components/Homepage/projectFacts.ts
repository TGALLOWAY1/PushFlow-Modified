/**
 * What a Library card says about a project (S2.3, T52): real data only, in
 * the same words everywhere ("8 bars · 32 events · 7 Sounds · 120 BPM",
 * "Created Sep 20 · Opened 2h ago"), and which layout its thumbnail shows
 * (decision Q1: the Working/Test Layout when it differs from the Active
 * Layout, badged "Draft, not promoted"; otherwise the Active Layout).
 */

import { type Layout } from '../../../types/layout';
import { type ProjectIndexEntry } from '../../persistence/persistedProject';
import { hasWorkingChanges, type ProjectState } from '../../state/projectState';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "8 bars · 32 events · 7 Sounds · 120 BPM"; "No Sounds yet · 120 BPM" for an empty project. */
export function projectFacts(entry: Pick<ProjectIndexEntry, 'durationBars' | 'eventCount' | 'soundCount' | 'tempo'>): string {
  const bpm = `${entry.tempo} BPM`;
  if (entry.soundCount === 0) return `No Sounds yet · ${bpm}`;
  return [
    plural(entry.durationBars, 'bar', 'bars'),
    plural(entry.eventCount, 'event', 'events'),
    plural(entry.soundCount, 'Sound', 'Sounds'),
    bpm,
  ].join(' · ');
}

/** "Sep 20", or "Sep 20, 2025" outside the current year; "" for a missing date. */
export function shortDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Just now", "5m ago", "2h ago", "3d ago", then the date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(iso, now);
}

/** "Created Sep 20 · Opened 2h ago", or "… · Not opened yet". */
export function projectDates(entry: Pick<ProjectIndexEntry, 'createdAt' | 'lastOpenedAt'>, now: number = Date.now()): string {
  const created = shortDate(entry.createdAt, now);
  const when = relativeTime(entry.lastOpenedAt, now);
  const opened = entry.lastOpenedAt ? `Opened ${when === 'Just now' ? 'just now' : when}` : 'Not opened yet';
  return created ? `Created ${created} · ${opened}` : opened;
}

export type ThumbnailBadge = 'Draft, not promoted' | 'Active layout';

/** The layout a card draws, the one the project opens on, and its badge (Q1). */
export function thumbnailLayout(state: ProjectState): { layout: Layout; badge: ThumbnailBadge } {
  return hasWorkingChanges(state) && state.workingLayout
    ? { layout: state.workingLayout, badge: 'Draft, not promoted' }
    : { layout: state.activeLayout, badge: 'Active layout' };
}

/** "2 variants", or "" with none. */
export function variantCount(state: ProjectState | null): string {
  const n = state?.savedVariants.length ?? 0;
  return n > 0 ? plural(n, 'variant', 'variants') : '';
}
