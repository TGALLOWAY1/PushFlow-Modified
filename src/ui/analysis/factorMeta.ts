/**
 * FACTOR_META (roadmap P1b, T20 base).
 *
 * The one registry of how the five canonical DiagnosticFactors are named,
 * coloured and explained in the UI. New surfaces read labels and colours from
 * here; P2 migrates the older consumers (ergonomics bars, chart, candidate cards,
 * settings, Compare, trace) and adds a grep test.
 */

import { type DiagnosticFactors, type V1CostBreakdown } from '../../types/diagnostics';
import { type CostToggles } from '../../types/costToggles';

export type FactorKey = Exclude<keyof DiagnosticFactors, 'total'>;

export interface FactorMeta {
  key: FactorKey;
  label: string;
  shortLabel: string;
  /** CSS colour, from the --factor-* tokens in index.css. */
  color: string;
  /** One line a musician can read. */
  description: string;
  /** Every factor is a cost: 0 is best. */
  polarity: 'lower-is-better';
}

/** Display order. */
export const FACTOR_KEYS: readonly FactorKey[] = [
  'transition',
  'gripNaturalness',
  'alternation',
  'handBalance',
  'constraintPenalty',
];

export const FACTOR_META: Record<FactorKey, FactorMeta> = {
  transition: {
    key: 'transition',
    label: 'Movement',
    shortLabel: 'Move',
    color: 'var(--factor-transition)',
    description: 'How far and how fast your hands travel from the previous event.',
    polarity: 'lower-is-better',
  },
  gripNaturalness: {
    key: 'gripNaturalness',
    label: 'Grip',
    shortLabel: 'Grip',
    color: 'var(--factor-grip)',
    description: 'How far the hand shape strays from a relaxed grip, and how comfortable the fingers used are.',
    polarity: 'lower-is-better',
  },
  alternation: {
    key: 'alternation',
    label: 'Alternation',
    shortLabel: 'Alt',
    color: 'var(--factor-alternation)',
    description: 'The same finger striking again too soon.',
    polarity: 'lower-is-better',
  },
  handBalance: {
    key: 'handBalance',
    label: 'Hand balance',
    shortLabel: 'Bal',
    color: 'var(--factor-balance)',
    description: 'How unevenly the work is shared between your hands.',
    polarity: 'lower-is-better',
  },
  constraintPenalty: {
    key: 'constraintPenalty',
    label: 'Constraints',
    shortLabel: 'Rules',
    color: 'var(--factor-constraint)',
    description: 'A hand rule had to give way, such as a hand leaving its side of the grid.',
    polarity: 'lower-is-better',
  },
};

/**
 * A candidate's tradeoff profile, shown in Compare as scores out of 100 where
 * higher is better (the factors above are costs, lower is better). The two
 * dimensions that mirror a factor use that factor's name and colour, so no
 * surface invents a second name for it (T20).
 */
export type TradeoffKey = 'playability' | 'compactness' | 'handBalance' | 'transitionEfficiency';

export const TRADEOFF_DIMENSIONS: ReadonlyArray<{ key: TradeoffKey; label: string; color: string; description: string }> = [
  { key: 'playability', label: 'Playability', color: 'var(--status-ok)', description: 'How much of the performance plays comfortably. Higher is better.' },
  { key: 'compactness', label: 'Compactness', color: 'var(--text-secondary)', description: 'How close together the Sounds sit on the grid. Higher is better.' },
  { key: 'handBalance', label: 'Hand balance', color: 'var(--factor-balance)', description: 'How evenly the work is shared between your hands. Higher is better.' },
  { key: 'transitionEfficiency', label: 'Movement', color: 'var(--factor-transition)', description: 'How little your hands travel between events. Higher is better.' },
];

/**
 * The factor each cost family feeds: the CostToggles keys, which are also the
 * canonical evaluator's CostDimensions keys (poseNaturalness is Grip).
 */
export const COST_FAMILY_FACTOR: Record<keyof CostToggles, FactorKey> = {
  transitionCost: 'transition',
  poseNaturalness: 'gripNaturalness',
  alternation: 'alternation',
  handBalance: 'handBalance',
  constraintPenalty: 'constraintPenalty',
};

/** The five canonical factors of one moment's (or note's) V1 cost breakdown. */
export function factorsFromBreakdown(b: V1CostBreakdown): Record<FactorKey, number> {
  return {
    transition: b.transitionCost,
    gripNaturalness: b.fingerPreference + b.handShapeDeviation,
    alternation: b.alternation,
    handBalance: b.handBalance,
    constraintPenalty: b.constraintPenalty,
  };
}
