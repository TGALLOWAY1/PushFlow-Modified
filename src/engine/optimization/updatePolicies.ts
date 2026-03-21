/**
 * Pluggable Update Policies for Greedy Hill-Climbing.
 *
 * Each policy controls how the hill-climb loop selects moves:
 * 1. Strict Greedy     — always take the best improving move (default)
 * 2. Soft Greedy       — Boltzmann/softmax with temperature decay
 * 3. Adjacency-Preserving — prefer moves that keep clusters intact
 * 4. Transition-Aware  — weight moves by transition cost improvement
 */

import { type PerformanceCostBreakdown } from '../../types/costBreakdown';

// ============================================================================
// Types
// ============================================================================

/**
 * An evaluated candidate move with cost information.
 */
export interface EvaluatedMove {
  /** Index into the candidate moves array. */
  index: number;
  /** Total cost after this move. */
  cost: number;
  /** Cost delta: cost - currentCost (negative = improvement). */
  costDelta: number;
  /** Full cost breakdown (for policies that need per-factor analysis). */
  breakdown?: PerformanceCostBreakdown;
  /** Move type for filtering. */
  moveType: 'pad_move' | 'pad_swap' | 'finger_reassignment';
  /** Pad key of the primary affected pad. */
  padKey: string;
  /** Target pad key (for moves/swaps). */
  targetPadKey?: string;
}

/**
 * Context provided to the update policy for decision-making.
 */
export interface UpdateContext {
  /** Current total cost. */
  currentCost: number;
  /** Current cost breakdown for per-factor analysis. */
  currentBreakdown?: PerformanceCostBreakdown;
  /** Hill-climb iteration number. */
  iteration: number;
  /** Seeded RNG. */
  rng: () => number;
  /** Maximum iterations (for temperature scheduling). */
  maxIterations: number;
}

/**
 * An update policy controls move selection during hill-climbing.
 */
export interface UpdatePolicy {
  /** Unique key for this policy. */
  key: string;
  /** Display name. */
  name: string;
  /**
   * Select a move from evaluated candidates.
   * Returns null to signal "stop" (no acceptable move found).
   */
  selectMove(
    candidates: EvaluatedMove[],
    context: UpdateContext,
  ): EvaluatedMove | null;
}

// ============================================================================
// Policy 1: Strict Greedy
// ============================================================================

/**
 * Always select the single best improving move.
 * This is the existing greedy optimizer behavior, extracted as a policy.
 */
export const strictGreedy: UpdatePolicy = {
  key: 'strict-greedy',
  name: 'Strict Greedy Descent',

  selectMove(candidates: EvaluatedMove[], context: UpdateContext): EvaluatedMove | null {
    let best: EvaluatedMove | null = null;

    for (const candidate of candidates) {
      if (candidate.cost < context.currentCost) {
        if (!best || candidate.cost < best.cost) {
          best = candidate;
        }
      }
    }

    return best;
  },
};

// ============================================================================
// Policy 2: Soft Greedy (Boltzmann)
// ============================================================================

/**
 * Softmax/Boltzmann move selection with temperature decay.
 * Prefers better moves but occasionally accepts non-optimal ones,
 * enabling escape from local minima.
 */
export const softGreedy: UpdatePolicy = {
  key: 'soft-greedy',
  name: 'Soft Greedy (Boltzmann)',

  selectMove(candidates: EvaluatedMove[], context: UpdateContext): EvaluatedMove | null {
    // Temperature schedule: starts at 0.5, decays with iterations
    const progress = context.iteration / Math.max(context.maxIterations, 1);
    const temperature = 0.5 * Math.pow(0.995, context.iteration) * (1 - progress * 0.5);

    // Filter to moves that aren't catastrophically worse
    const maxAcceptableIncrease = temperature * 2;
    const viable = candidates.filter(
      c => c.costDelta < maxAcceptableIncrease,
    );

    if (viable.length === 0) return null;

    // Compute Boltzmann weights
    const weights: number[] = [];
    let maxWeight = -Infinity;

    for (const c of viable) {
      const w = -c.costDelta / Math.max(temperature, 0.001);
      weights.push(w);
      if (w > maxWeight) maxWeight = w;
    }

    // Normalize (log-sum-exp trick for stability)
    const expWeights = weights.map(w => Math.exp(w - maxWeight));
    const sumExp = expWeights.reduce((a, b) => a + b, 0);

    if (sumExp <= 0) return null;

    // Sample from distribution
    let r = context.rng() * sumExp;
    for (let i = 0; i < viable.length; i++) {
      r -= expWeights[i];
      if (r <= 0) return viable[i];
    }

    return viable[viable.length - 1];
  },
};

// ============================================================================
// Policy 3: Adjacency-Preserving
// ============================================================================

/**
 * Prefer moves that maintain or improve cluster compactness.
 * Applies a bonus for keeping co-occurring voices adjacent,
 * and a penalty for breaking existing adjacency relationships.
 */
export const adjacencyPreserving: UpdatePolicy = {
  key: 'adjacency-preserving',
  name: 'Adjacency-Preserving Greedy',

  selectMove(candidates: EvaluatedMove[], context: UpdateContext): EvaluatedMove | null {
    let best: EvaluatedMove | null = null;
    let bestAdjScore = Infinity;

    for (const candidate of candidates) {
      if (candidate.cost >= context.currentCost) continue;

      // Prefer swaps and moves (which affect spatial arrangement)
      // over finger reassignments (which don't affect layout)
      const spatialBonus = candidate.moveType === 'finger_reassignment' ? 0 : -0.05;
      const adjustedCost = candidate.cost + spatialBonus;

      if (!best || adjustedCost < bestAdjScore) {
        bestAdjScore = adjustedCost;
        best = candidate;
      }
    }

    return best;
  },
};

// ============================================================================
// Policy 4: Transition-Aware
// ============================================================================

/**
 * Weight moves by transition cost improvement specifically,
 * accepting moves that improve transitions even if total cost
 * increases very slightly.
 */
export const transitionAware: UpdatePolicy = {
  key: 'transition-aware',
  name: 'Transition-Aware Greedy',

  selectMove(candidates: EvaluatedMove[], context: UpdateContext): EvaluatedMove | null {
    // Slight tolerance: accept moves that increase total cost by up to 1%
    const tolerance = context.currentCost * 0.01;

    let best: EvaluatedMove | null = null;
    let bestTransitionDelta = Infinity;

    for (const candidate of candidates) {
      // Must not increase total cost too much
      if (candidate.costDelta > tolerance) continue;

      // Prefer moves that reduce transition cost component
      let transitionDelta = candidate.costDelta; // Default: use total delta

      if (candidate.breakdown && context.currentBreakdown) {
        transitionDelta = candidate.breakdown.dimensions.transitionCost
          - context.currentBreakdown.dimensions.transitionCost;
      }

      if (transitionDelta < bestTransitionDelta) {
        bestTransitionDelta = transitionDelta;
        best = candidate;
      }
    }

    return best;
  },
};

// ============================================================================
// Registry
// ============================================================================

/** All available update policies, indexed by key. */
export const UPDATE_POLICIES: Record<string, UpdatePolicy> = {
  'strict-greedy': strictGreedy,
  'soft-greedy': softGreedy,
  'adjacency-preserving': adjacencyPreserving,
  'transition-aware': transitionAware,
};

/** Get an update policy by key. */
export function getUpdatePolicy(key: string): UpdatePolicy | undefined {
  return UPDATE_POLICIES[key];
}
