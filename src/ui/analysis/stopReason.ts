/**
 * Why a run stopped, in words (T33, T35).
 *
 * One wording for the trace panel, the toolbar's run status, the candidate
 * cards and Learn More, from the engine's STOP_REASON_LABELS: "Stopped: time
 * limit reached".
 */

import { STOP_REASON_LABELS, type StopReason } from '@/engine';
import { type CandidateSolution } from '@/types';

/** "Stopped: time limit reached"; a reason the engine doesn't list is shown as it is. */
export function stopReasonText(stopReason: StopReason | string): string {
  return `Stopped: ${STOP_REASON_LABELS[stopReason as StopReason] ?? stopReason}`;
}

/**
 * A candidate card's run line (P3-9): why its run stopped, then what ran
 * ("Stopped: time limit reached · Deep optimization (2,412 of 3,200
 * iterations over 4 runs)"). The stop reason leads, so a card too narrow for
 * the whole line still shows it; the line's tooltip has the rest.
 */
export function candidateRunLine(candidate: Pick<CandidateSolution, 'stopReason' | 'metadata'>): string | null {
  const ran = candidate.metadata.optimizationSummary ?? candidate.metadata.optimizationMode ?? null;
  const stopped = candidate.stopReason ? stopReasonText(candidate.stopReason) : null;
  return [stopped, ran].filter(Boolean).join(' · ') || null;
}
