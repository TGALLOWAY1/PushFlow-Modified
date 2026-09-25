/**
 * A stored project as the Library lists it (S2.3, T52): real data only.
 *
 * Bars run to the last note's end at the project tempo in 4/4; events count
 * everything struck at one instant once and notes count single hits (decision
 * Q7), through the same groupIntoMoments as the editor. Records are read
 * defensively: one damaged record degrades to a placeholder entry instead of
 * hiding the whole library.
 */

import { groupIntoMoments } from '../../engine/structure/momentGrouping';
import { type PersistedProject, type ProjectIndexEntry } from './persistedProject';

export function projectIndexEntry(p: PersistedProject): ProjectIndexEntry {
  const soundStreams = Array.isArray(p.soundStreams) ? p.soundStreams : [];
  const notes: Array<{ startTime: number; voiceId: string }> = [];
  let maxTime = 0;
  for (const s of soundStreams) {
    const events = Array.isArray(s.events) ? s.events : [];
    for (const e of events) {
      notes.push({ startTime: e.startTime, voiceId: s.id });
      const end = e.startTime + (e.duration || 0);
      if (end > maxTime) maxTime = end;
    }
  }
  const tempo = p.bpm || 120;
  const barDuration = (60 / tempo) * 4;
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    lastOpenedAt: typeof p.lastOpenedAt === 'string' ? p.lastOpenedAt : p.updatedAt,
    soundCount: soundStreams.length,
    eventCount: groupIntoMoments(notes).length,
    noteCount: notes.length,
    tempo,
    durationBars: barDuration > 0 ? Math.ceil(maxTime / barDuration - 1e-9) : 0,
  };
}

/** The entry for a record that can't be read, so it still shows (and can be deleted). */
export function unreadableIndexEntry(p: Partial<PersistedProject> & { id: string }): ProjectIndexEntry {
  const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : '';
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name : 'Unreadable project',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
    updatedAt,
    lastOpenedAt: typeof p.lastOpenedAt === 'string' ? p.lastOpenedAt : updatedAt,
    soundCount: 0,
    eventCount: 0,
    noteCount: 0,
    tempo: 120,
    durationBars: 0,
  };
}

/** When a project was last opened or, if it never was (a copy, an imported file), created. */
function recency(e: ProjectIndexEntry): string {
  return e.lastOpenedAt > e.createdAt ? e.lastOpenedAt : e.createdAt;
}

/** The Library's order: most recently opened or created first. */
export function byRecency(a: ProjectIndexEntry, b: ProjectIndexEntry): number {
  return recency(b).localeCompare(recency(a));
}

/** The project the Library offers to continue: the last one opened, else the most recent. */
export function lastOpenedProject<T extends ProjectIndexEntry>(entries: readonly T[]): T | null {
  let best: T | null = null;
  for (const e of entries) {
    if (e.lastOpenedAt && (!best || e.lastOpenedAt > best.lastOpenedAt)) best = e;
  }
  return best ?? entries[0] ?? null;
}
