/**
 * S3.1 · The scoring client: layouts are solved and scored in a module worker,
 * answered by request id; without a Worker (vitest) or when the worker fails,
 * the same function runs in-process, so a layout is always scored.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScoreLayoutRequest, ScoredLayoutAnalysis } from '../../../src/ui/analysis/scoreLayout';

vi.mock('../../../src/ui/analysis/scoreLayout', () => ({
  analyseAndScoreLayout: vi.fn(async (request: ScoreLayoutRequest) => ({ analysis: { id: `inline:${request.layout.id}` }, score: { playability: 1 } })),
}));

import { scoreLayoutInBackground, scoringCounts, resetScoringClient, type ScoringRequestMessage } from '../../../src/ui/analysis/scoringClient';
import { analyseAndScoreLayout } from '../../../src/ui/analysis/scoreLayout';

const request = (layoutId: string) => ({ layout: { id: layoutId } } as unknown as ScoreLayoutRequest);
const result = (id: string) => ({ analysis: { id }, score: { playability: 70 } } as unknown as ScoredLayoutAnalysis);

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: ScoringRequestMessage[] = [];
  terminated = false;
  constructor(public url: URL, public options: { type?: string }) {
    FakeWorker.instances.push(this);
  }
  postMessage(message: ScoringRequestMessage) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.({ data }); }
}

beforeEach(() => {
  resetScoringClient();
  FakeWorker.instances = [];
  vi.mocked(analyseAndScoreLayout).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('without a Worker', () => {
  it('scores in-process', async () => {
    await expect(scoreLayoutInBackground(request('a'))).resolves.toMatchObject({ analysis: { id: 'inline:a' } });
    expect(scoringCounts()).toEqual({ worker: 0, inline: 1 });
  });
});

describe('with a Worker', () => {
  beforeEach(() => vi.stubGlobal('Worker', FakeWorker));

  it('starts one module worker and answers each request by its id, in any order', async () => {
    const a = scoreLayoutInBackground(request('a'));
    const b = scoreLayoutInBackground(request('b'));
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0]!;
    expect(String(worker.url)).toMatch(/scoring\.worker\.ts$/);
    expect(worker.options.type).toBe('module');
    const [first, second] = worker.posted;
    expect(first!.request.layout.id).toBe('a');
    expect(second!.id).not.toBe(first!.id);

    worker.reply({ id: second!.id, ok: true, result: result('B') });
    worker.reply({ id: first!.id, ok: true, result: result('A') });
    await expect(a).resolves.toMatchObject({ analysis: { id: 'A' } });
    await expect(b).resolves.toMatchObject({ analysis: { id: 'B' } });
    expect(scoringCounts()).toEqual({ worker: 2, inline: 0 });
    expect(analyseAndScoreLayout).not.toHaveBeenCalled();
  });

  it('rejects a request the worker could not score', async () => {
    const a = scoreLayoutInBackground(request('a'));
    const worker = FakeWorker.instances[0]!;
    worker.reply({ id: worker.posted[0]!.id, ok: false, message: 'no plan' });
    await expect(a).rejects.toThrow('no plan');
  });

  it('when the worker fails, scores what it owed in-process, and everything after', async () => {
    const a = scoreLayoutInBackground(request('a'));
    const worker = FakeWorker.instances[0]!;
    worker.onerror!({ preventDefault() {} });
    expect(worker.terminated).toBe(true);
    await expect(a).resolves.toMatchObject({ analysis: { id: 'inline:a' } });
    await expect(scoreLayoutInBackground(request('b'))).resolves.toMatchObject({ analysis: { id: 'inline:b' } });
    expect(FakeWorker.instances).toHaveLength(1);
    expect(scoringCounts()).toEqual({ worker: 0, inline: 2 });
  });
});
