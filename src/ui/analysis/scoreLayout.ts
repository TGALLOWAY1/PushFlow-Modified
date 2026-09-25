/**
 * Solve and score one layout (S3.1, "One yardstick"): the work the scoring
 * worker does for every layout on screen, and the in-process fallback.
 *
 * The plan is the layout's own analysis plan (analyzeLayout's fast beam solve,
 * finger preferences as soft constraints); the score is its Playability on the
 * canonical evaluator (scoreLayoutPlayability). Pure apart from the solve, and
 * it imports engine modules directly rather than through the barrel, so the
 * worker bundle carries only what this needs.
 */

import { analyzeLayout, type AnalyzeLayoutInput } from './analyzeLayout';
import { scoreLayoutPlayability, evaluationConfigFor, type LayoutScore } from '../../engine/evaluation/playability';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type CostToggles } from '../../types/costToggles';

export interface ScoreLayoutRequest extends AnalyzeLayoutInput {
  costToggles: CostToggles;
}

/** A layout's plan and its score, cached together under one key. */
export interface ScoredLayoutAnalysis {
  /** The layout's own analysis plan, with its difficulty analysis and tradeoff profile. */
  analysis: CandidateSolution;
  /** Its Playability, from the same plan's fingering. */
  score: LayoutScore;
}

export async function analyseAndScoreLayout(request: ScoreLayoutRequest): Promise<ScoredLayoutAnalysis> {
  const analysis = await analyzeLayout(request);
  const score = scoreLayoutPlayability({
    performance: request.performance,
    layout: request.layout,
    plan: analysis.executionPlan,
    config: evaluationConfigFor(request.layout, request.engineConfig, request.instrumentConfig),
    costToggles: request.costToggles,
  });
  return { analysis, score };
}
