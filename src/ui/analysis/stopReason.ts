/**
 * Why a run stopped, in words (T33, T35).
 *
 * One wording for the trace panel, the toolbar's run status and Learn More,
 * from the engine's STOP_REASON_LABELS: "Stopped: time limit reached".
 */

import { STOP_REASON_LABELS, type StopReason } from '@/engine';

/** "Stopped: time limit reached"; a reason the engine doesn't list is shown as it is. */
export function stopReasonText(stopReason: StopReason | string): string {
  return `Stopped: ${STOP_REASON_LABELS[stopReason as StopReason] ?? stopReason}`;
}
