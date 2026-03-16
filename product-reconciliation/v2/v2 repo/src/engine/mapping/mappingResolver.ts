/**
 * Mapping Resolver - Single source of truth for note-to-pad resolution.
 *
 * Provides O(1) lookup via precomputed index. No iteration over pads per event.
 * Supports strict mode (no fallback) for optimization and allow-fallback for previews.
 *
 * Ported from Version1/src/engine/mappingResolver.ts with terminology updates:
 * - GridMapping -> Layout
 * - cells -> padToVoice
 * - cellKey -> padKey
 * - parseCellKey -> parsePadKey
 */

import { type Voice } from '../../types/voice';
import { type Layout } from '../../types/layout';
import { type InstrumentConfig } from '../../types/performance';
import { type PadCoord, parsePadKey } from '../../types/padGrid';

// ============================================================================
// Types
// ============================================================================

export type MappingResolution =
  | { source: 'mapping'; pad: PadCoord }
  | { source: 'unmapped' }
  | { source: 'fallback'; pad: PadCoord };

// ============================================================================
// Index Building (O(pads) once, O(1) per lookup)
// ============================================================================

/**
 * Builds a reverse index from noteNumber to pad coordinates.
 * Call once per layout/solver run. Lookups are O(1).
 *
 * @param padToVoice - Record of pad key -> Voice
 * @returns Map of noteNumber -> PadCoord (only voices with valid originalMidiNote)
 */
export function buildNoteToPadIndex(padToVoice: Record<string, Voice>): Map<number, PadCoord> {
  const index = new Map<number, PadCoord>();

  for (const [key, voice] of Object.entries(padToVoice)) {
    const note = voice.originalMidiNote;
    if (note === null || note === undefined) continue;

    const coord = parsePadKey(key);
    if (coord) {
      index.set(note, coord);
    }
  }

  return index;
}

/**
 * Builds a reverse index from Voice.id to pad coordinates.
 * This is the voiceId-based complement to buildNoteToPadIndex.
 * When a PerformanceEvent carries a voiceId, we can resolve its pad
 * position without relying on pitch — enabling transposition, re-mapping,
 * and multi-instrument scenarios where pitches may collide.
 */
export function buildVoiceIdToPadIndex(padToVoice: Record<string, Voice>): Map<string, PadCoord> {
  const index = new Map<string, PadCoord>();

  for (const [key, voice] of Object.entries(padToVoice)) {
    if (!voice.id) continue;

    const coord = parsePadKey(key);
    if (coord) {
      index.set(voice.id, coord);
    }
  }

  return index;
}

/**
 * Resolves a performance event to a pad using voiceId-first, noteNumber-fallback strategy.
 *
 * Priority:
 * 1. If voiceId is present and exists in voiceIdIndex → use it (stable identity)
 * 2. Else fall back to noteNumber-based resolution via resolveNoteToPad
 */
export function resolveEventToPad(
  event: { noteNumber: number; voiceId?: string },
  voiceIdIndex: Map<string, PadCoord>,
  noteIndex: Map<number, PadCoord>,
  instrumentConfig: InstrumentConfig,
  mode: 'strict' | 'allow-fallback',
): MappingResolution {
  // Prefer voiceId when available
  if (event.voiceId) {
    const fromVoiceId = voiceIdIndex.get(event.voiceId);
    if (fromVoiceId) {
      return { source: 'mapping', pad: fromVoiceId };
    }
  }
  // Fall back to pitch-based lookup
  return resolveNoteToPad(event.noteNumber, noteIndex, instrumentConfig, mode);
}

// ============================================================================
// Fallback: noteToGrid (chromatic layout)
// ============================================================================

/**
 * Maps a MIDI note number to a grid position using the standard chromatic layout.
 * This is the fallback when a note isn't in the layout's padToVoice mapping.
 */
function noteToGrid(noteNumber: number, config: InstrumentConfig): PadCoord | null {
  const offset = noteNumber - config.bottomLeftNote;
  if (offset < 0) return null;

  const row = Math.floor(offset / config.cols);
  const col = offset % config.cols;

  if (row >= config.rows) return null;

  return { row, col };
}

/**
 * Maps a grid position to a MIDI note number using the standard chromatic layout.
 */
export function gridToNote(row: number, col: number, config: InstrumentConfig): number {
  return config.bottomLeftNote + (row * config.cols) + col;
}

// ============================================================================
// Resolution
// ============================================================================

/**
 * Resolves a note number to a pad using the precomputed index.
 *
 * @param noteNumber - MIDI note number to resolve
 * @param index - Precomputed note->pad index from buildNoteToPadIndex
 * @param instrumentConfig - Instrument config for fallback (noteToGrid)
 * @param mode - 'strict': unmapped returns unmapped; 'allow-fallback': use noteToGrid
 */
export function resolveNoteToPad(
  noteNumber: number,
  index: Map<number, PadCoord>,
  instrumentConfig: InstrumentConfig,
  mode: 'strict' | 'allow-fallback'
): MappingResolution {
  const fromMapping = index.get(noteNumber);
  if (fromMapping) {
    return { source: 'mapping', pad: fromMapping };
  }

  if (mode === 'allow-fallback') {
    const pad = noteToGrid(noteNumber, instrumentConfig);
    if (pad) {
      return { source: 'fallback', pad };
    }
  }

  return { source: 'unmapped' };
}

// ============================================================================
// Hash Utility (for debug identity)
// ============================================================================

/**
 * Produces a stable hash of a Layout for debug identity.
 * Sorts pad keys for deterministic output.
 */
export function hashLayout(layout: Layout): string {
  const keys = Object.keys(layout.padToVoice).sort();
  const entries = keys.map((k) => [k, layout.padToVoice[k]?.originalMidiNote ?? null]);
  return JSON.stringify(entries);
}
