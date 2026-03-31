/**
 * Tests for phrase structure analysis.
 *
 * These tests verify that the phrase structure extractor correctly:
 * 1. Detects repeated rhythmic patterns across phrase iterations
 * 2. Groups voices by rhythmic role (independent of sound identity)
 * 3. Builds peer mappings for voices with the same structural role
 */

import { describe, it, expect } from 'vitest';
import {
  analyzePhraseStructure,
  getVoicePeers,
  arePhrasePeers,
  getRoleGroupsByImportance,
} from '../../../src/engine/structure/phraseStructure';
import { type PerformanceEvent } from '../../../src/types/performanceEvent';

describe('phraseStructure', () => {
  describe('analyzePhraseStructure', () => {
    it('should detect 2-bar repeated phrase with different sounds', () => {
      // Scenario: 4-bar loop where bars 1-2 repeat the rhythm of bars 0-1
      // but with different sounds (voiceIds).
      // This is the exact pattern from the user's test case.
      const tempo = 120; // 2 seconds per bar
      const barDuration = 2;

      // Phrase A (bars 0-1): voices A1, A2, A3 at specific rhythmic positions
      // Phrase B (bars 2-3): voices B1, B2, B3 at the SAME rhythmic positions
      const events: PerformanceEvent[] = [
        // Bar 0: beat 1 (slot 0), beat 3 (slot 8)
        { noteNumber: 36, voiceId: 'A1', startTime: 0.0 },
        { noteNumber: 37, voiceId: 'A2', startTime: 1.0 },
        // Bar 1: beat 2 (slot 4), beat 4 (slot 12)
        { noteNumber: 38, voiceId: 'A3', startTime: barDuration + 0.5 },
        { noteNumber: 36, voiceId: 'A1', startTime: barDuration + 1.5 },

        // Bar 2: SAME rhythmic positions as bar 0, but different voices
        { noteNumber: 40, voiceId: 'B1', startTime: barDuration * 2 + 0.0 },
        { noteNumber: 41, voiceId: 'B2', startTime: barDuration * 2 + 1.0 },
        // Bar 3: SAME rhythmic positions as bar 1, but different voices
        { noteNumber: 42, voiceId: 'B3', startTime: barDuration * 3 + 0.5 },
        { noteNumber: 40, voiceId: 'B1', startTime: barDuration * 3 + 1.5 },
      ];

      const structure = analyzePhraseStructure(events, tempo);

      // Should detect 2-bar phrase structure
      expect(structure.phraseLengthBars).toBe(2);
      expect(structure.phraseCount).toBe(2);
      expect(structure.totalBars).toBe(4);

      // Should have role groups connecting A and B voices
      expect(structure.roleGroups.length).toBeGreaterThan(0);

      // A1 and B1 should be peers (same rhythmic role in different phrases)
      expect(arePhrasePeers(structure, 'A1', 'B1')).toBe(true);

      // A2 and B2 should be peers
      expect(arePhrasePeers(structure, 'A2', 'B2')).toBe(true);

      // A3 and B3 should be peers
      expect(arePhrasePeers(structure, 'A3', 'B3')).toBe(true);

      // A1 and A2 should NOT be peers (different rhythmic roles)
      expect(arePhrasePeers(structure, 'A1', 'A2')).toBe(false);
    });

    it('should handle single-bar patterns', () => {
      const events: PerformanceEvent[] = [
        { noteNumber: 36, voiceId: 'kick', startTime: 0.0 },
        { noteNumber: 38, voiceId: 'snare', startTime: 0.5 },
      ];

      const structure = analyzePhraseStructure(events, 120);

      expect(structure.phraseLengthBars).toBe(1);
      expect(structure.totalBars).toBe(1);
      expect(structure.phraseCount).toBe(1);
    });

    it('should return empty structure for no events', () => {
      const structure = analyzePhraseStructure([], 120);

      expect(structure.phraseLengthBars).toBe(1);
      expect(structure.totalBars).toBe(0);
      expect(structure.phraseCount).toBe(0);
      expect(structure.roleMappings.length).toBe(0);
    });

    it('should detect 4-bar phrase with complex rhythm pattern', () => {
      const tempo = 120;
      const barDuration = 2;

      // Create a pattern that clearly repeats every 4 bars
      // with a distinctive rhythm that can't be confused with 2-bar
      const events: PerformanceEvent[] = [
        // Phrase 1 (bars 0-3) - unique rhythm each bar
        { noteNumber: 36, voiceId: 'A1', startTime: 0 },            // Bar 0: beat 1
        { noteNumber: 37, voiceId: 'A2', startTime: 0.5 },          // Bar 0: beat 2
        { noteNumber: 38, voiceId: 'A3', startTime: barDuration + 0.25 }, // Bar 1: off-beat
        { noteNumber: 39, voiceId: 'A4', startTime: barDuration * 2 + 0.75 }, // Bar 2: different off-beat
        { noteNumber: 40, voiceId: 'A5', startTime: barDuration * 3 + 1.5 },  // Bar 3: late beat

        // Phrase 2 (bars 4-7) - SAME rhythm pattern, different sounds
        { noteNumber: 46, voiceId: 'B1', startTime: barDuration * 4 },
        { noteNumber: 47, voiceId: 'B2', startTime: barDuration * 4 + 0.5 },
        { noteNumber: 48, voiceId: 'B3', startTime: barDuration * 5 + 0.25 },
        { noteNumber: 49, voiceId: 'B4', startTime: barDuration * 6 + 0.75 },
        { noteNumber: 50, voiceId: 'B5', startTime: barDuration * 7 + 1.5 },
      ];

      const structure = analyzePhraseStructure(events, tempo);

      // Should detect 4-bar phrase structure
      // Note: due to the distinctive rhythm, 4-bar should score higher than 2-bar
      expect(structure.phraseLengthBars).toBe(4);
      expect(structure.phraseCount).toBe(2);
      expect(structure.totalBars).toBe(8);
    });
  });

  describe('getVoicePeers', () => {
    it('should return peer voices for a given voice', () => {
      const tempo = 120;
      const barDuration = 2;

      const events: PerformanceEvent[] = [
        { noteNumber: 36, voiceId: 'kick1', startTime: 0 },
        { noteNumber: 38, voiceId: 'snare1', startTime: 0.5 },
        { noteNumber: 40, voiceId: 'kick2', startTime: barDuration * 2 },
        { noteNumber: 42, voiceId: 'snare2', startTime: barDuration * 2 + 0.5 },
      ];

      const structure = analyzePhraseStructure(events, tempo);

      // kick1 and kick2 should be peers (same rhythmic position in different phrases)
      const peersOfKick1 = getVoicePeers(structure, 'kick1');
      expect(peersOfKick1).toContain('kick2');

      // snare1 and snare2 should be peers
      const peersOfSnare1 = getVoicePeers(structure, 'snare1');
      expect(peersOfSnare1).toContain('snare2');
    });

    it('should return empty array for voice with no peers', () => {
      const events: PerformanceEvent[] = [
        { noteNumber: 36, voiceId: 'solo', startTime: 0 },
      ];

      const structure = analyzePhraseStructure(events, 120);
      const peers = getVoicePeers(structure, 'solo');

      expect(peers).toEqual([]);
    });
  });

  describe('getRoleGroupsByImportance', () => {
    it('should return role groups sorted by phrase coverage', () => {
      const tempo = 120;
      const barDuration = 2;

      // Create events where some voices appear in both phrases, others in one
      const events: PerformanceEvent[] = [
        // Phrase 1
        { noteNumber: 36, voiceId: 'A', startTime: 0 },
        { noteNumber: 37, voiceId: 'B', startTime: 0.5 },
        // Phrase 2
        { noteNumber: 40, voiceId: 'C', startTime: barDuration * 2 },
        { noteNumber: 41, voiceId: 'D', startTime: barDuration * 2 + 0.5 },
      ];

      const structure = analyzePhraseStructure(events, tempo);
      const sortedGroups = getRoleGroupsByImportance(structure);

      // Groups should be sorted by phrase coverage (most phrases first)
      if (sortedGroups.length > 1) {
        expect(sortedGroups[0].phraseIndices.length).toBeGreaterThanOrEqual(
          sortedGroups[sortedGroups.length - 1].phraseIndices.length,
        );
      }
    });
  });

  describe('confidence scoring', () => {
    it('should have high confidence for clearly repeated patterns', () => {
      const tempo = 120;
      const barDuration = 2;

      // Perfectly repeated 2-bar pattern
      const events: PerformanceEvent[] = [];
      for (let phrase = 0; phrase < 4; phrase++) {
        const offset = phrase * barDuration * 2;
        events.push({ noteNumber: 36, voiceId: `kick${phrase}`, startTime: offset + 0 });
        events.push({ noteNumber: 38, voiceId: `snare${phrase}`, startTime: offset + 0.5 });
        events.push({ noteNumber: 42, voiceId: `hihat${phrase}`, startTime: offset + 1.0 });
        events.push({ noteNumber: 36, voiceId: `kick${phrase}`, startTime: offset + barDuration });
        events.push({ noteNumber: 38, voiceId: `snare${phrase}`, startTime: offset + barDuration + 0.5 });
      }

      const structure = analyzePhraseStructure(events, tempo);

      expect(structure.confidence).toBeGreaterThan(0.5);
    });

    it('should have lower confidence for non-repeating patterns', () => {
      const tempo = 120;
      const barDuration = 2;

      // Completely different rhythm each bar
      const events: PerformanceEvent[] = [
        { noteNumber: 36, voiceId: 'a', startTime: 0 },
        { noteNumber: 37, voiceId: 'b', startTime: barDuration + 0.25 },
        { noteNumber: 38, voiceId: 'c', startTime: barDuration * 2 + 0.75 },
        { noteNumber: 39, voiceId: 'd', startTime: barDuration * 3 + 0.125 },
      ];

      const structure = analyzePhraseStructure(events, tempo);

      // Should still work but with lower confidence
      expect(structure.confidence).toBeLessThan(0.8);
    });
  });
});
