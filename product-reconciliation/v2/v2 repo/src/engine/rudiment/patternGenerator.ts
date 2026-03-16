/**
 * Pattern Generator — Main Orchestrator (RudimentGenerator Class)
 *
 * Orchestrates the full pipeline:
 * motif sampling → phrase expansion → two-hand coordination →
 * metric computation → filtering → diversity selection
 *
 * Produces validated PatternCandidate objects.
 */

import {
  type PatternCandidate,
  type GeneratorConfig,
  type HandSequence,
  type PatternEvent,
  DEFAULT_GENERATOR_CONFIG,
} from '../../types/patternCandidate';
import { createSeededRng } from '../../utils/seededRng';
import { generateId } from '../../utils/idGenerator';
import { getMotifSeed, getAllMotifFamilies } from './motifLibrary';
import { buildPhrase } from './phraseBuilder';
import { coordinateHands } from './coordination';
import { computeAllMetrics } from './coherenceMetrics';
import { filterAndDiversify } from './candidateFilter';

// ============================================================================
// Validation
// ============================================================================

/** Validate that all events have legal slot/sub_offset values. */
function validateEvents(events: PatternEvent[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.slot < 0 || e.slot > 7) {
      errors.push(`Event ${i}: invalid slot ${e.slot} (must be 0-7)`);
    }
    if (e.sub_offset !== 0 && e.sub_offset !== 1) {
      errors.push(
        `Event ${i}: invalid sub_offset ${e.sub_offset} (must be 0 or 1)`,
      );
    }
    if (e.bar < 0) {
      errors.push(`Event ${i}: invalid bar ${e.bar} (must be >= 0)`);
    }
  }
  return errors;
}

/** Sort events by bar, slot, sub_offset. */
function sortEvents(events: PatternEvent[]): PatternEvent[] {
  return [...events].sort((a, b) => {
    if (a.bar !== b.bar) return a.bar - b.bar;
    if (a.slot !== b.slot) return a.slot - b.slot;
    return a.sub_offset - b.sub_offset;
  });
}

/** Deduplicate events at the same position (keep first). */
function deduplicateEvents(events: PatternEvent[]): PatternEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.bar}:${e.slot}:${e.sub_offset}:${e.sound_class}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Full validation of a PatternCandidate. Throws on critical errors. */
function validateCandidate(candidate: PatternCandidate): void {
  const leftErrors = validateEvents(candidate.left_hand.events);
  const rightErrors = validateEvents(candidate.right_hand.events);
  const allErrors = [
    ...leftErrors.map((e) => `left_hand: ${e}`),
    ...rightErrors.map((e) => `right_hand: ${e}`),
  ];

  if (allErrors.length > 0) {
    throw new Error(
      `Invalid PatternCandidate ${candidate.id}:\n${allErrors.join('\n')}`,
    );
  }
}

// ============================================================================
// RudimentGenerator Class
// ============================================================================

/**
 * Generates musically coherent two-hand performance patterns.
 * Produces validated PatternCandidate objects that can be fed through
 * the downstream pipeline via patternToPipeline.
 */
export class RudimentGenerator {
  private readonly config: GeneratorConfig;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this.config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
  }

  /**
   * Generate n diverse PatternCandidates.
   * Internally over-generates and filters for quality and diversity.
   */
  generate(n: number): PatternCandidate[] {
    const rng = createSeededRng(this.config.seed);
    const overGenCount = n * this.config.over_generation_factor;

    const leftFamilies = getAllMotifFamilies('left');
    const rightFamilies = getAllMotifFamilies('right');

    const candidates: PatternCandidate[] = [];

    for (let i = 0; i < overGenCount; i++) {
      try {
        const candidate = this.generateOne(
          rng,
          leftFamilies,
          rightFamilies,
        );
        candidates.push(candidate);
      } catch {
        // Skip invalid candidates during over-generation
        continue;
      }
    }

    // Filter and select diverse subset
    return filterAndDiversify(candidates, n, this.config);
  }

  /** Generate a single candidate (may throw on validation failure). */
  private generateOne(
    rng: () => number,
    leftFamilies: string[],
    rightFamilies: string[],
  ): PatternCandidate {
    const bars = this.config.bars;

    // 1. Sample motif seeds
    const leftFamily =
      leftFamilies[Math.floor(rng() * leftFamilies.length)];
    const rightFamily =
      rightFamilies[Math.floor(rng() * rightFamilies.length)];

    const leftSeed = getMotifSeed(leftFamily, rng);
    const rightSeed = getMotifSeed(rightFamily, rng);

    // 2. Build primary phrase (left hand)
    const { events: leftEvents, phrasePlan } = buildPhrase(
      leftSeed,
      bars,
      this.config,
      rng,
    );

    const primaryHand: HandSequence = {
      hand: 'left',
      role_profile: leftSeed.role_profile,
      motif_family: leftSeed.motif_family,
      events: leftEvents,
    };

    // 3. Coordinate hands
    const { left, right } = coordinateHands(
      primaryHand,
      rightSeed,
      bars,
      this.config,
      rng,
    );

    // 4. Clean up events: deduplicate, sort, validate
    const cleanLeft: HandSequence = {
      ...left,
      events: sortEvents(deduplicateEvents(left.events)),
    };
    const cleanRight: HandSequence = {
      ...right,
      events: sortEvents(deduplicateEvents(right.events)),
    };

    // 5. Build candidate
    const candidate: PatternCandidate = {
      id: generateId('pattern'),
      bars,
      grid_type: 'eighth_backbone_with_optional_sixteenth_insertions',
      phrase_plan: phrasePlan,
      left_hand: cleanLeft,
      right_hand: cleanRight,
      metadata: {
        density: 0,
        syncopation_ratio: 0,
        independence_score: 0,
        repetition_score: 0,
        phrase_coherence_score: 0,
        collision_pressure_score: 0,
      },
    };

    // 6. Compute metrics
    candidate.metadata = computeAllMetrics(candidate);

    // 7. Validate
    validateCandidate(candidate);

    return candidate;
  }
}
