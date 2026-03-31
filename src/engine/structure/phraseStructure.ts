/**
 * Phrase Structure Analysis.
 *
 * Detects repeated rhythmic patterns across phrase iterations and maps
 * voice events to structural roles independent of sound identity.
 *
 * This enables the Clustered Motif Layout to place voices that share
 * rhythmic roles in analogous spatial positions, even when the sounds
 * differ between phrase iterations.
 *
 * Key concepts:
 * - RhythmSlot: A quantized position within a bar (e.g., beat + subdivision)
 * - PhraseWindow: A contiguous group of bars that may repeat
 * - RhythmRole: A structural role like "phrase1.beat2.hit1" independent of sound
 * - RoleGroup: Voices that occupy the same rhythmic role across phrase iterations
 */

import { type PerformanceEvent } from '../../types/performanceEvent';

// ============================================================================
// Types
// ============================================================================

/**
 * A quantized rhythmic position within a bar.
 * Resolution is 16th notes (4 per beat, 16 per bar in 4/4).
 */
export interface RhythmSlot {
  /** Bar index (0-based). */
  bar: number;
  /** Slot within bar (0-15 for 16th note resolution in 4/4). */
  slot: number;
  /** Sub-slot offset for notes between 16th notes (0 or 1). */
  subSlot: number;
}

/**
 * A rhythmic role identifies a position in the phrase structure,
 * independent of which sound occupies it.
 */
export interface RhythmRole {
  /** Phrase iteration index (0 = first occurrence, 1 = repeat, etc.). */
  phraseIndex: number;
  /** Position within the phrase (bar-relative slot). */
  phraseSlot: number;
  /** Hit index when multiple notes occur at the same slot (0, 1, 2...). */
  hitIndex: number;
}

/**
 * Maps a voice event to its structural role.
 */
export interface VoiceRoleMapping {
  /** Voice ID (from event.voiceId or noteNumber string). */
  voiceId: string;
  /** The rhythmic role this voice occupies. */
  role: RhythmRole;
  /** Key for grouping: "phraseSlot:hitIndex" (phrase-independent). */
  roleKey: string;
  /** Original event for reference. */
  event: PerformanceEvent;
}

/**
 * A group of voices that share the same rhythmic role across phrase iterations.
 * These voices should ideally be placed in analogous spatial positions.
 */
export interface RoleGroup {
  /** Shared role key: "phraseSlot:hitIndex". */
  roleKey: string;
  /** Voice IDs that occupy this role in different phrase iterations. */
  voiceIds: string[];
  /** Phrase indices where this role appears. */
  phraseIndices: number[];
}

/**
 * Complete phrase structure analysis for a performance.
 */
export interface PhraseStructure {
  /** Detected phrase length in bars (e.g., 2 for a 2-bar phrase). */
  phraseLengthBars: number;
  /** Total bars in the performance. */
  totalBars: number;
  /** Number of phrase iterations detected. */
  phraseCount: number;
  /** Per-event role mappings. */
  roleMappings: VoiceRoleMapping[];
  /** Groups of voices sharing rhythmic roles. */
  roleGroups: RoleGroup[];
  /** Map from voiceId to its peer voices (same rhythmic role, different phrase). */
  voicePeers: Map<string, string[]>;
  /** Confidence score for phrase detection (0-1). */
  confidence: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Slots per bar at 16th note resolution (4/4 time). */
const SLOTS_PER_BAR = 16;

/** Minimum similarity for phrase detection. */
const PHRASE_SIMILARITY_THRESHOLD = 0.5;

/** Common phrase lengths to try (in bars). */
const CANDIDATE_PHRASE_LENGTHS = [2, 4, 1, 8];

// ============================================================================
// Main Analysis
// ============================================================================

/**
 * Analyze phrase structure in a performance.
 *
 * Detects repeated rhythmic patterns and maps voices to structural roles.
 * This analysis is used by the Clustered Motif Layout to preserve
 * repeated phrase geometry.
 *
 * @param events - Sorted performance events
 * @param tempo - BPM for bar/beat calculation (default: 120)
 * @returns Phrase structure analysis
 */
export function analyzePhraseStructure(
  events: PerformanceEvent[],
  tempo: number = 120,
): PhraseStructure {
  if (events.length === 0) {
    return emptyPhraseStructure();
  }

  // Step 1: Quantize events to rhythm slots
  const barDuration = (60 / tempo) * 4; // 4 beats per bar
  const slots = quantizeToSlots(events, barDuration);
  const totalBars = Math.max(...slots.map(s => s.slot.bar)) + 1;

  if (totalBars < 2) {
    return singleBarStructure(events, slots);
  }

  // Step 2: Detect phrase length by finding repeated rhythmic patterns
  const { phraseLengthBars, confidence } = detectPhraseLength(slots, totalBars);
  const phraseCount = Math.ceil(totalBars / phraseLengthBars);

  // Step 3: Build role mappings
  const roleMappings = buildRoleMappings(slots, phraseLengthBars);

  // Step 4: Group voices by rhythmic role
  const roleGroups = buildRoleGroups(roleMappings);

  // Step 5: Build peer map for quick lookup
  const voicePeers = buildVoicePeerMap(roleGroups);

  return {
    phraseLengthBars,
    totalBars,
    phraseCount,
    roleMappings,
    roleGroups,
    voicePeers,
    confidence,
  };
}

// ============================================================================
// Quantization
// ============================================================================

interface SlottedEvent {
  event: PerformanceEvent;
  voiceId: string;
  slot: RhythmSlot;
}

/**
 * Quantize events to 16th note slots.
 */
function quantizeToSlots(
  events: PerformanceEvent[],
  barDuration: number,
): SlottedEvent[] {
  const slotDuration = barDuration / SLOTS_PER_BAR;

  return events.map(event => {
    const bar = Math.floor(event.startTime / barDuration);
    const timeInBar = event.startTime - bar * barDuration;
    const rawSlot = timeInBar / slotDuration;
    const slot = Math.round(rawSlot);
    const subSlot = Math.abs(rawSlot - slot) > 0.25 ? 1 : 0;

    return {
      event,
      voiceId: event.voiceId ?? String(event.noteNumber),
      slot: {
        bar,
        slot: Math.min(slot, SLOTS_PER_BAR - 1),
        subSlot,
      },
    };
  });
}

// ============================================================================
// Phrase Detection
// ============================================================================

/**
 * Detect phrase length by comparing rhythmic patterns across bar groups.
 */
function detectPhraseLength(
  slots: SlottedEvent[],
  totalBars: number,
): { phraseLengthBars: number; confidence: number } {
  let bestLength = 2;
  let bestScore = 0;

  for (const candidateLength of CANDIDATE_PHRASE_LENGTHS) {
    if (candidateLength > totalBars / 2) continue;

    const score = measurePhraseSimilarity(slots, candidateLength, totalBars);
    if (score > bestScore) {
      bestScore = score;
      bestLength = candidateLength;
    }
  }

  // If no good phrase detected, default to half the total bars
  if (bestScore < PHRASE_SIMILARITY_THRESHOLD) {
    bestLength = Math.max(1, Math.ceil(totalBars / 2));
    bestScore = 0.3;
  }

  return { phraseLengthBars: bestLength, confidence: bestScore };
}

/**
 * Measure how similar rhythmic patterns are when assuming a given phrase length.
 *
 * Uses rhythm-only comparison (ignores which voice plays at each slot).
 */
function measurePhraseSimilarity(
  slots: SlottedEvent[],
  phraseLengthBars: number,
  totalBars: number,
): number {
  const phraseCount = Math.floor(totalBars / phraseLengthBars);
  if (phraseCount < 2) return 0;

  // Build rhythm signature for each phrase (set of slot positions)
  const phraseSignatures: Set<string>[] = [];

  for (let p = 0; p < phraseCount; p++) {
    const startBar = p * phraseLengthBars;
    const endBar = startBar + phraseLengthBars;

    const signature = new Set<string>();
    for (const se of slots) {
      if (se.slot.bar >= startBar && se.slot.bar < endBar) {
        // Phrase-relative position
        const relBar = se.slot.bar - startBar;
        signature.add(`${relBar}:${se.slot.slot}:${se.slot.subSlot}`);
      }
    }
    phraseSignatures.push(signature);
  }

  // Compare all phrases to the first phrase using Jaccard similarity
  let totalSimilarity = 0;
  for (let p = 1; p < phraseSignatures.length; p++) {
    totalSimilarity += jaccardSimilarity(phraseSignatures[0], phraseSignatures[p]);
  }

  return totalSimilarity / (phraseSignatures.length - 1);
}

/**
 * Jaccard similarity between two sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

// ============================================================================
// Role Mapping
// ============================================================================

/**
 * Build role mappings that assign each event to a structural role.
 */
function buildRoleMappings(
  slots: SlottedEvent[],
  phraseLengthBars: number,
): VoiceRoleMapping[] {
  // Group events by phrase-relative position
  const positionGroups = new Map<string, SlottedEvent[]>();

  for (const se of slots) {
    const relBar = se.slot.bar % phraseLengthBars;
    const phraseSlot = relBar * SLOTS_PER_BAR + se.slot.slot;
    const posKey = `${phraseSlot}:${se.slot.subSlot}`;

    const group = positionGroups.get(posKey) ?? [];
    group.push(se);
    positionGroups.set(posKey, group);
  }

  // Assign hit indices within each position
  const mappings: VoiceRoleMapping[] = [];

  for (const se of slots) {
    const phraseIndex = Math.floor(se.slot.bar / phraseLengthBars);
    const relBar = se.slot.bar % phraseLengthBars;
    const phraseSlot = relBar * SLOTS_PER_BAR + se.slot.slot;

    // Count how many events at this exact position come before this one
    const posKey = `${phraseSlot}:${se.slot.subSlot}`;
    const group = positionGroups.get(posKey) ?? [];
    const samePhraseSamePos = group.filter(
      g => Math.floor(g.slot.bar / phraseLengthBars) === phraseIndex &&
           g.event.startTime <= se.event.startTime,
    );
    const hitIndex = samePhraseSamePos.length - 1;

    const role: RhythmRole = {
      phraseIndex,
      phraseSlot,
      hitIndex,
    };

    const roleKey = `${phraseSlot}:${hitIndex}`;

    mappings.push({
      voiceId: se.voiceId,
      role,
      roleKey,
      event: se.event,
    });
  }

  return mappings;
}

// ============================================================================
// Role Groups
// ============================================================================

/**
 * Group voices that share the same rhythmic role across phrase iterations.
 */
function buildRoleGroups(mappings: VoiceRoleMapping[]): RoleGroup[] {
  const groupMap = new Map<string, {
    voiceIds: Set<string>;
    phraseIndices: Set<number>;
  }>();

  for (const mapping of mappings) {
    const existing = groupMap.get(mapping.roleKey);
    if (existing) {
      existing.voiceIds.add(mapping.voiceId);
      existing.phraseIndices.add(mapping.role.phraseIndex);
    } else {
      groupMap.set(mapping.roleKey, {
        voiceIds: new Set([mapping.voiceId]),
        phraseIndices: new Set([mapping.role.phraseIndex]),
      });
    }
  }

  const groups: RoleGroup[] = [];
  for (const [roleKey, data] of groupMap) {
    // Only include groups that span multiple phrase iterations
    if (data.phraseIndices.size > 1 || data.voiceIds.size > 1) {
      groups.push({
        roleKey,
        voiceIds: [...data.voiceIds],
        phraseIndices: [...data.phraseIndices].sort((a, b) => a - b),
      });
    }
  }

  return groups;
}

/**
 * Build a map from each voice to its peer voices (same role, different phrase).
 */
function buildVoicePeerMap(groups: RoleGroup[]): Map<string, string[]> {
  const peerMap = new Map<string, string[]>();

  for (const group of groups) {
    for (const voiceId of group.voiceIds) {
      const peers = group.voiceIds.filter(v => v !== voiceId);
      const existing = peerMap.get(voiceId) ?? [];
      peerMap.set(voiceId, [...new Set([...existing, ...peers])]);
    }
  }

  return peerMap;
}

// ============================================================================
// Helpers
// ============================================================================

function emptyPhraseStructure(): PhraseStructure {
  return {
    phraseLengthBars: 1,
    totalBars: 0,
    phraseCount: 0,
    roleMappings: [],
    roleGroups: [],
    voicePeers: new Map(),
    confidence: 0,
  };
}

function singleBarStructure(
  _events: PerformanceEvent[],
  slots: SlottedEvent[],
): PhraseStructure {
  const mappings = buildRoleMappings(slots, 1);
  const roleGroups = buildRoleGroups(mappings);
  const voicePeers = buildVoicePeerMap(roleGroups);

  return {
    phraseLengthBars: 1,
    totalBars: 1,
    phraseCount: 1,
    roleMappings: mappings,
    roleGroups,
    voicePeers,
    confidence: 1,
  };
}

// ============================================================================
// Utility Functions for Optimization
// ============================================================================

/**
 * Get the peer voices for a given voice (voices with same rhythmic role).
 */
export function getVoicePeers(
  structure: PhraseStructure,
  voiceId: string,
): string[] {
  return structure.voicePeers.get(voiceId) ?? [];
}

/**
 * Get all voice IDs that share a rhythmic role group.
 */
export function getVoicesInRoleGroup(
  structure: PhraseStructure,
  voiceId: string,
): string[] {
  for (const group of structure.roleGroups) {
    if (group.voiceIds.includes(voiceId)) {
      return group.voiceIds;
    }
  }
  return [voiceId];
}

/**
 * Check if two voices share a rhythmic role (are phrase peers).
 */
export function arePhrasePeers(
  structure: PhraseStructure,
  voiceA: string,
  voiceB: string,
): boolean {
  const peersA = structure.voicePeers.get(voiceA);
  return peersA?.includes(voiceB) ?? false;
}

/**
 * Get the phrase index for a voice's first occurrence.
 */
export function getVoicePhraseIndex(
  structure: PhraseStructure,
  voiceId: string,
): number {
  const mapping = structure.roleMappings.find(m => m.voiceId === voiceId);
  return mapping?.role.phraseIndex ?? 0;
}

/**
 * Get role groups sorted by importance (number of phrase iterations covered).
 */
export function getRoleGroupsByImportance(
  structure: PhraseStructure,
): RoleGroup[] {
  return [...structure.roleGroups].sort((a, b) => {
    // Prefer groups that span more phrases
    const phraseDiff = b.phraseIndices.length - a.phraseIndices.length;
    if (phraseDiff !== 0) return phraseDiff;
    // Then prefer groups with more voices
    return b.voiceIds.length - a.voiceIds.length;
  });
}
