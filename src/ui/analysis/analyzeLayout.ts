/**
 * analyzeLayout: the one "analyse this layout" path (auto-analysis and the
 * per-layout analysis cache both use it).
 *
 * A fast beam solve (beamWidth 15) of the performance on the given layout,
 * with the layout's finger constraints as soft preferences, plus the difficulty
 * analysis and tradeoff profile the panels read. Pure apart from the solve:
 * it dispatches nothing and stores nothing.
 */

import { createBeamSolver } from '../../engine/solvers/beamSolver';
import { type SolverConstraints } from '../../engine/solvers/types';
import { analyzeDifficulty, computeTradeoffProfile } from '../../engine/evaluation/difficultyScoring';
import { generateId } from '../../utils/idGenerator';
import { type SolverConfig, type EngineConfiguration } from '../../types/engineConfig';
import { type Performance, type InstrumentConfig } from '../../types/performance';
import { type FingerType } from '../../types/fingerModel';
import { type Layout } from '../../types/layout';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type Section } from '../../types/performanceStructure';
import { createDefaultPose0, getPose0PadsWithOffset, fingerIdToHandAndFingerType } from '../../engine/prior/naturalHandPose';
import { type FingerId, type NaturalHandPose } from '../../types/ergonomicPrior';
import { parseFingerConstraint } from '../../utils/fingerConstraints';

/**
 * Compute initial pad ownership from pose0 + layout.
 * For pads in the layout that match a pose0 finger position,
 * pre-assign the natural finger so the solver maintains consistent assignments.
 */
export function computeInitialOwnership(
  pose0: NaturalHandPose,
  layout: Layout,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> | undefined {
  const posePads = getPose0PadsWithOffset(pose0, 0, true);
  const padToFinger = new Map<string, string>();
  for (const entry of posePads) {
    padToFinger.set(`${entry.row},${entry.col}`, entry.fingerId);
  }
  const ownership: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  let count = 0;
  for (const padKey of Object.keys(layout.padToVoice)) {
    const fingerId = padToFinger.get(padKey);
    if (fingerId) {
      const { hand, finger } = fingerIdToHandAndFingerType(fingerId as FingerId);
      ownership[padKey] = { hand, finger };
      count++;
    }
  }
  return count > 0 ? ownership : undefined;
}

/**
 * Build separated solver constraints from layout finger constraints.
 *
 * A finger constraint names the finger that owns a Sound. The beam solver keeps
 * it under the one-finger-per-sound rule — never trading it for a cheaper
 * fingering — and departs from it only at strikes where no plan can keep it,
 * flagging each one.
 *
 * The legacy `manualAssignments` parameter is preserved for backward
 * compatibility but new code should use the SolverConstraints structure.
 *
 * Matches events to preferences by Sound identity (voiceId) only, never by
 * pitch (invariant 5); an event with no Sound gets no preference.
 */
export function buildSolverConstraints(
  performance: Performance,
  layout: Layout,
): SolverConstraints {
  const constraints = layout.fingerConstraints;
  if (!constraints || Object.keys(constraints).length === 0) return {};

  // Build voiceId → {hand, finger} from pad constraints: a preference belongs
  // to the Sound on the pad.
  const voiceIdConstraints = new Map<string, { hand: 'left' | 'right'; finger: FingerType }>();
  for (const [padKey, constraintStr] of Object.entries(constraints)) {
    const voice = layout.padToVoice[padKey];
    if (!voice?.id) continue;
    const parsed = parseFingerConstraint(constraintStr);
    if (!parsed) continue;
    voiceIdConstraints.set(voice.id, parsed);
  }
  if (voiceIdConstraints.size === 0) return {};

  // Map each event to its soft preference by eventKey, through its Sound.
  const softPreferences: Record<string, { hand: 'left' | 'right'; finger: FingerType }> = {};
  for (const event of performance.events) {
    const constraint = event.voiceId ? voiceIdConstraints.get(event.voiceId) : undefined;
    if (constraint && event.eventKey) {
      softPreferences[event.eventKey] = constraint;
    }
  }

  return Object.keys(softPreferences).length > 0
    ? { softPreferences }
    : {};
}

/**
 * Build legacy manualAssignments from constraints for backward compatibility.
 * Converts soft preferences to hard assignments for the legacy solver path.
 * TODO: Remove once the solver natively handles SolverConstraints.
 */
export function constraintsToManualAssignments(
  constraints: SolverConstraints,
): Record<string, { hand: 'left' | 'right'; finger: FingerType }> | undefined {
  // The beam solver reads each preference as the finger that owns that Sound:
  // the one-finger-per-sound rule keeps it unless no plan can, and any strike
  // that has to depart from it is flagged as a relaxation.
  const prefs = constraints.softPreferences;
  if (!prefs || Object.keys(prefs).length === 0) return undefined;
  return prefs;
}

export interface AnalyzeLayoutInput {
  performance: Performance;
  layout: Layout;
  instrumentConfig: InstrumentConfig;
  engineConfig: EngineConfiguration;
  sections: Section[];
}

/** Beam width of the fast analysis solve. */
export const ANALYSIS_BEAM_WIDTH = 15;

/** Solves and scores one layout. The id is new each call; the plan is bound to `layout`. */
export async function analyzeLayout({ performance, layout, instrumentConfig, engineConfig, sections }: AnalyzeLayoutInput): Promise<CandidateSolution> {
  const defaultPose = createDefaultPose0();
  const solverConfig: SolverConfig = {
    instrumentConfig,
    layout,
    sourceLayoutRole: layout.role,
    initialPadOwnership: computeInitialOwnership(defaultPose, layout),
  };
  const solver = createBeamSolver(solverConfig);
  const manualAssignments = constraintsToManualAssignments(buildSolverConstraints(performance, layout));
  const executionPlan = await solver.solve(performance, { ...engineConfig, beamWidth: ANALYSIS_BEAM_WIDTH }, manualAssignments);
  const difficultyAnalysis = analyzeDifficulty(executionPlan, sections);
  const tradeoffProfile = computeTradeoffProfile(executionPlan, difficultyAnalysis);
  return {
    id: generateId('auto'),
    layout,
    executionPlan,
    difficultyAnalysis,
    tradeoffProfile,
    metadata: { strategy: 'auto-analysis', seed: 0 },
  };
}
