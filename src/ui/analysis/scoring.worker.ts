/**
 * Scoring worker (S3.1): solves and scores layouts off the main thread, one
 * request at a time, answering each by its request id. Started by
 * scoringClient.ts; see there for the protocol and the in-process fallback.
 */

import { analyseAndScoreLayout } from './scoreLayout';
import type { ScoringRequestMessage, ScoringResponseMessage } from './scoringClient';

// The DOM lib types `self` as a Window; in a dedicated worker it is the worker scope.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ScoringRequestMessage>) => void) | null;
  postMessage(message: ScoringResponseMessage): void;
};

scope.onmessage = event => {
  const { id, request } = event.data;
  analyseAndScoreLayout(request).then(
    result => scope.postMessage({ id, ok: true, result }),
    err => scope.postMessage({ id, ok: false, message: err instanceof Error ? err.message : String(err) }),
  );
};
