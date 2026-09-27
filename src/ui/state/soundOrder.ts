/**
 * The one order of the Sounds (S5.1, T45): the Sounds panel's rows, the
 * timeline's lanes and click-to-place's "next unplaced Sound" all follow it.
 *
 * With groups, each group in its order with its Sounds in the project's
 * order, then every Sound in no group ("Ungrouped"). With no groups, the
 * project's order. A Sound whose group no longer exists counts as ungrouped.
 */

interface OrderedLane {
  id: string;
  groupId: string | null;
}

interface OrderedGroup {
  groupId: string;
  orderIndex: number;
}

/** The groups in their order. */
export function sortedGroups<G extends OrderedGroup>(groups: readonly G[]): G[] {
  return [...groups].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Each Sound's group id, or null when it is in none (or its group is gone). */
export function soundGroupIds(lanes: readonly OrderedLane[], groups: readonly OrderedGroup[]): Map<string, string | null> {
  const known = new Set(groups.map(g => g.groupId));
  return new Map(lanes.map(l => [l.id, l.groupId && known.has(l.groupId) ? l.groupId : null]));
}

/** `sounds` in the one order. */
export function orderSounds<S extends { id: string }>(
  sounds: readonly S[],
  lanes: readonly OrderedLane[],
  groups: readonly OrderedGroup[],
): S[] {
  if (groups.length === 0) return [...sounds];
  const groupOf = soundGroupIds(lanes, groups);
  const ordered: S[] = [];
  for (const group of sortedGroups(groups)) {
    for (const sound of sounds) if (groupOf.get(sound.id) === group.groupId) ordered.push(sound);
  }
  for (const sound of sounds) if (!groupOf.get(sound.id)) ordered.push(sound);
  return ordered;
}
