/**
 * Placing a Composer preset on the grid, refuse-first (T65 slice).
 *
 * Everything is validated against the layout as it is at drop time:
 * 1. every preset pad's lane resolves, by id, to an existing project Sound:
 *    the lane's project Sound (the S1a.5 lane→Sound link) or a Sound with the
 *    lane's own id; never by name or MIDI pitch (invariant 5). Otherwise the
 *    whole drop is refused ("This preset's Sounds aren't in this project…");
 * 2. every pad lands on the grid, in its hand's zone when a hand is recorded,
 *    and on an empty pad;
 * 3. none of its Sounds is already on another pad;
 * 4. no lock is disturbed.
 * The first failure is the reason shown to the user; nothing is placed.
 */

import { validatePlacement, mirrorPreset } from '../../engine/mapping/presetTransform';
import { padKey } from '../../types/padGrid';
import type { ComposerPreset, PresetPad } from '../../types/composerPreset';
import type { Layout } from '../../types/layout';
import type { Voice } from '../../types/voice';
import { presetPadFingerConstraint } from '../../types/composerPreset';
import { projectSoundIdForLane } from '../components/workspace/composerLaneIdentity';
import { placementDisturbsLock, type SoundStream } from './projectState';

export const FOREIGN_PRESET_MESSAGE =
  "This preset's Sounds aren't in this project. Mapping them to your Sounds comes in a later release.";

export type PresetDropResult =
  | {
    ok: true;
    /** The preset as placed (mirrored when asked). */
    preset: ComposerPreset;
    padToVoice: Record<string, Voice>;
    /** Verified finger preferences to apply, by pad. */
    fingerConstraints: Record<string, string>;
  }
  | { ok: false; reason: string };

/** The project Sound a preset lane is, or undefined. By id only. */
export function soundForPresetLane(laneId: string, soundStreams: ReadonlyArray<SoundStream>): SoundStream | undefined {
  const projectId = projectSoundIdForLane(laneId);
  return soundStreams.find(s => s.id === projectId) ?? soundStreams.find(s => s.id === laneId);
}

function position(pad: PresetPad, anchorRow: number, anchorCol: number) {
  return { row: anchorRow + pad.position.rowOffset, col: anchorCol + pad.position.colOffset };
}

export function resolvePresetDrop(args: {
  preset: ComposerPreset;
  anchorRow: number;
  anchorCol: number;
  isMirrored: boolean;
  layout: Layout;
  soundStreams: ReadonlyArray<SoundStream>;
}): PresetDropResult {
  const { anchorRow, anchorCol, layout, soundStreams } = args;
  const preset = args.isMirrored ? mirrorPreset(args.preset) : args.preset;

  if (preset.pads.length === 0) {
    return { ok: false, reason: "Can't drop this preset: it has no pads yet. Place its Sounds on the grid, then save it again." };
  }

  // 1. Sounds by identity.
  const sounds = new Map<string, SoundStream>();
  for (const pad of preset.pads) {
    const sound = soundForPresetLane(pad.laneId, soundStreams);
    if (!sound) return { ok: false, reason: FOREIGN_PRESET_MESSAGE };
    sounds.set(pad.laneId, sound);
  }

  // 2. Bounds, hand zones and occupied pads, against the layout right now.
  const occupied = new Set(Object.keys(layout.padToVoice));
  const validation = validatePlacement(preset.pads, anchorRow, anchorCol, occupied);
  if (!validation.valid) {
    const occupiedHit = preset.pads
      .map(p => position(p, anchorRow, anchorCol))
      .find(p => occupied.has(padKey(p.row, p.col)));
    const reason = occupiedHit
      ? `Can't drop the preset here: pad [${occupiedHit.row},${occupiedHit.col}] is occupied.`
      : `Can't drop the preset here: ${validation.reasons[0]}.`;
    return { ok: false, reason };
  }

  // 3. A Sound lives on one pad.
  for (const sound of sounds.values()) {
    const at = Object.entries(layout.padToVoice).find(([, v]) => v.id === sound.id)?.[0];
    if (at) return { ok: false, reason: `Can't drop the preset here: ${sound.name} is already on pad [${at}].` };
  }

  const padToVoice: Record<string, Voice> = {};
  const fingerConstraints: Record<string, string> = {};
  for (const pad of preset.pads) {
    const { row, col } = position(pad, anchorRow, anchorCol);
    const key = padKey(row, col);
    const sound = sounds.get(pad.laneId)!;
    padToVoice[key] = {
      id: sound.id,
      name: sound.name,
      sourceType: 'midi_track',
      sourceFile: `preset:${preset.name}`,
      originalMidiNote: sound.originalMidiNote,
      color: sound.color,
    };
    const constraint = presetPadFingerConstraint(pad);
    if (constraint) fingerConstraints[key] = constraint;
  }

  // 4. Locks.
  if (placementDisturbsLock(layout, padToVoice)) {
    return { ok: false, reason: "Can't drop the preset here: Locked · Unlock to move" };
  }

  return { ok: true, preset, padToVoice, fingerConstraints };
}
