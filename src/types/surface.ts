/**
 * Surface Types.
 *
 * Sound surface categories and defaults used by pad assignment
 * and rudiment systems for ergonomic placement.
 */

/** Surface category for ergonomic pad placement. */
export type SurfaceCategory = 'percussion' | 'bass' | 'melodic' | 'textural' | 'custom';

export interface SurfaceInfo {
  name: string;
  midiNote: number;
  category: SurfaceCategory;
}

export const SURFACE_DEFAULTS: Record<string, SurfaceInfo> = {
  // Percussion
  kick:       { name: 'Kick',       midiNote: 36, category: 'percussion' },
  snare:      { name: 'Snare',      midiNote: 38, category: 'percussion' },
  closed_hat: { name: 'Closed Hat', midiNote: 42, category: 'percussion' },
  open_hat:   { name: 'Open Hat',   midiNote: 46, category: 'percussion' },
  tom_1:      { name: 'Tom 1',      midiNote: 48, category: 'percussion' },
  tom_2:      { name: 'Tom 2',      midiNote: 45, category: 'percussion' },
  rim:        { name: 'Rim',        midiNote: 37, category: 'percussion' },
  crash:      { name: 'Crash',      midiNote: 49, category: 'percussion' },
  clap:       { name: 'Clap',       midiNote: 39, category: 'percussion' },
  shaker:     { name: 'Shaker',     midiNote: 70, category: 'percussion' },
  ride:       { name: 'Ride',       midiNote: 51, category: 'percussion' },
  floor_tom:  { name: 'Floor Tom',  midiNote: 43, category: 'percussion' },
  // Bass
  bass_1:     { name: 'Bass 1',     midiNote: 36, category: 'bass' },
  bass_2:     { name: 'Bass 2',     midiNote: 38, category: 'bass' },
  bass_3:     { name: 'Bass 3',     midiNote: 40, category: 'bass' },
  bass_4:     { name: 'Bass 4',     midiNote: 41, category: 'bass' },
  // Melodic
  melodic_hit: { name: 'Melodic Hit', midiNote: 60, category: 'melodic' },
  chord_stab:  { name: 'Chord Stab',  midiNote: 62, category: 'melodic' },
  arp_note:    { name: 'Arp Note',    midiNote: 64, category: 'melodic' },
  // Textural
  vocal_chop:  { name: 'Vocal Chop',  midiNote: 72, category: 'textural' },
  fx_riser:    { name: 'FX Riser',    midiNote: 74, category: 'textural' },
  noise_sweep: { name: 'Noise Sweep', midiNote: 76, category: 'textural' },
  // Generic
  custom:     { name: 'Custom',     midiNote: 60, category: 'custom' },
};
