/**
 * What an analysis reads (S3.3, T14 freshness rules).
 *
 * Analysis goes stale only when one of its inputs changes: the notes each
 * Sound plays, which Sounds are in scope (mute and solo), the tempo, a
 * layout's placements, locks and finger constraints, the Sounds' finger
 * preferences, and the settings that shape a plan. Renaming, recolouring,
 * grouping or reordering Sounds changes none of them, so none of those marks
 * the analysis stale (a rename once re-solved every layout on screen).
 *
 * Pure, and it imports projectState only for types, so the reducers can use it.
 */

import { hashLayout } from '../../engine/mapping/mappingResolver';
import { deepEqual } from '../../utils/deepEqual';
import { hashString } from '../analysis/analysisCache';
import type { ProjectState, SoundStream } from './projectState';

const soundSignatures = new WeakMap<readonly SoundStream[], string>();

/**
 * The part of the Sounds an analysis reads: each Sound's notes and whether it
 * is muted, by Sound id. Names, colours, groups and order are left out.
 * Memoised per Sounds array, so a render can call it freely.
 */
export function soundsSignature(streams: readonly SoundStream[]): string {
  let signature = soundSignatures.get(streams);
  if (signature === undefined) {
    const byId = [...streams].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    signature = hashString(JSON.stringify(byId.map(s => [
      s.id,
      s.muted,
      s.originalMidiNote,
      s.events.map(e => [e.eventKey, e.voiceId ?? null, e.startTime, e.duration, e.velocity]),
    ])));
    soundSignatures.set(streams, signature);
  }
  return signature;
}

/**
 * The performance a Generate run was made for (T14: candidates are stale once
 * it changes): the notes in scope and the tempo.
 */
export function performanceSignature(state: Pick<ProjectState, 'soundStreams' | 'tempo'>): string {
  return `${state.tempo}|${soundsSignature(state.soundStreams)}`;
}

function layoutHashOrNull(layout: ProjectState['workingLayout']): string | null {
  return layout ? hashLayout(layout) : null;
}

/** Whether anything an analysis reads differs between two states of one project. */
export function analysisInputsChanged(a: ProjectState, b: ProjectState): boolean {
  if (performanceSignature(a) !== performanceSignature(b)) return true;
  if (a.activeLayout !== b.activeLayout && hashLayout(a.activeLayout) !== hashLayout(b.activeLayout)) return true;
  if (a.workingLayout !== b.workingLayout && layoutHashOrNull(a.workingLayout) !== layoutHashOrNull(b.workingLayout)) return true;
  const same = (x: unknown, y: unknown) => x === y || deepEqual(x, y);
  return !same(a.voiceConstraints, b.voiceConstraints)
    || !same(a.instrumentConfig, b.instrumentConfig)
    || !same(a.sections, b.sections)
    || !same(a.engineConfig, b.engineConfig);
}
