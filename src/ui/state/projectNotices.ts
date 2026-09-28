/**
 * One-time notices a project carries until they are shown (S4.4).
 *
 * The mute-as-exclusion migration (migrations.ts) turns the Sounds a project
 * had muted, which the analysis used to leave out, into Sounds excluded from
 * analysis, since Mute now only silences a Sound in rehearsal. It leaves a
 * notice naming them in the stored project; the editor shows it once when the
 * project opens (useProjectNotices), and the project is saved without it. The
 * notice lives in the record, not in the browser, because the Library opens
 * (and so migrates) every project for its cards before the editor sees it.
 */

export interface MuteAsExclusionNotice {
  id: 'mute-as-exclusion';
  /** The Sounds the migration excluded, by id. */
  soundIds: string[];
}

export type ProjectNotice = MuteAsExclusionNotice;

/** Stored notices, with anything unknown or malformed left out. */
export function projectNoticesOf(raw: unknown): ProjectNotice[] {
  if (!Array.isArray(raw)) return [];
  const notices: ProjectNotice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, soundIds } = item as { id?: unknown; soundIds?: unknown };
    if (id !== 'mute-as-exclusion' || !Array.isArray(soundIds)) continue;
    notices.push({ id, soundIds: soundIds.filter((s): s is string => typeof s === 'string') });
  }
  return notices;
}

/** "Kick", "Kick and Hat", "Kick, Hat and Snare"; a count past three. */
function listNames(names: string[]): string {
  if (names.length > 3) return `${names.length} Sounds`;
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * What the notice says, naming its Sounds as they are called now; null when
 * none of them is left in the project (nothing to tell).
 */
export function projectNoticeMessage(
  notice: ProjectNotice,
  sounds: readonly { id: string; name: string }[],
): string | null {
  const names = notice.soundIds
    .map(id => sounds.find(s => s.id === id)?.name)
    .filter((name): name is string => !!name);
  if (names.length === 0) return null;
  const one = names.length === 1;
  return `Mute now only silences a Sound in rehearsal. ${listNames(names)}, which you had muted, ${one ? 'is' : 'are'} excluded from analysis instead, so your scores are unchanged. Include ${one ? 'it' : 'them'} again from ${one ? 'its' : 'their'} ⋯ menu in the Sounds panel.`;
}
