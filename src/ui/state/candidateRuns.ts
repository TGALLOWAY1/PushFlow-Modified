/**
 * Generate runs and candidate letters (S3.3, T30 and T08).
 *
 * Each Generate (and each "Place remaining") adds a run instead of replacing
 * the list: state.candidates stays the flat list of every run's candidates,
 * newest run first, so existing consumers keep working, and the run metadata
 * lives here, in session state. A run's label is derived from its candidates'
 * metadata, so the code that generates them needs to know nothing of runs.
 *
 * Every candidate gets a letter when it is installed ("Candidate B"), and the
 * letter is never reused within the session, so B stays B after a delete, a
 * Promote or another run. Candidates, runs and letters are never saved
 * (canon: a Candidate Solution is a proposal, not project truth).
 */

import type { CandidateSolution } from '../../types/candidateSolution';
import { performanceSignature } from './analysisInputs';
import type { ProjectState } from './projectState';

export interface CandidateRun {
  id: string;
  /** "Run 2": counts every run this session, so numbers are never reused. */
  number: number;
  createdAt: string;
  /** Its candidates' ids in rank order, including any deleted or promoted since. */
  candidateIds: string[];
  /** The performance it was made for (performanceSignature): its candidates are stale once that changes. */
  performanceSignature: string;
}

export interface CandidateRunsState {
  /** Newest first. */
  runs: CandidateRun[];
  /** Each candidate's letter, by candidate id. */
  letters: Record<string, string>;
  runCount: number;
  letterCount: number;
}

export const EMPTY_CANDIDATE_RUNS: CandidateRunsState = { runs: [], letters: {}, runCount: 0, letterCount: 0 };

/** Runs kept under "Earlier runs"; an older one is dropped, with its candidates, when a new run arrives. */
export const EARLIER_RUNS_CAP = 3;

/** The strategy of the one candidate "Place remaining N Sounds" proposes (T37). */
export const REMAINING_PLACED_STRATEGY = 'remaining-placed';

/** A letter by its number: A for 0, then B … Z, AA … (the session's nth candidate). */
export function candidateLetter(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/**
 * The runs after a run's candidates arrive: letters for the new candidates,
 * the run first, and runs beyond the cap dropped. Returns the ids of the
 * candidates the dropped runs took with them.
 */
export function withRun(
  state: Pick<ProjectState, 'candidateRuns' | 'soundStreams' | 'tempo'>,
  incoming: readonly CandidateSolution[],
  now: string,
): { candidateRuns: CandidateRunsState; droppedIds: Set<string> } {
  const current = state.candidateRuns ?? EMPTY_CANDIDATE_RUNS;
  const letters = { ...current.letters };
  let letterCount = current.letterCount;
  for (const candidate of incoming) {
    if (!letters[candidate.id]) letters[candidate.id] = candidateLetter(letterCount++);
  }
  const run: CandidateRun = {
    id: `run-${current.runCount + 1}`,
    number: current.runCount + 1,
    createdAt: now,
    candidateIds: incoming.map(c => c.id),
    performanceSignature: performanceSignature(state),
  };
  const runs = [run, ...current.runs];
  const kept = runs.slice(0, EARLIER_RUNS_CAP + 1);
  const droppedIds = new Set(runs.slice(EARLIER_RUNS_CAP + 1).flatMap(r => r.candidateIds));
  return { candidateRuns: { runs: kept, letters, runCount: run.number, letterCount }, droppedIds };
}

/** Every run but the newest, and the ids of their candidates ("Clear older runs"). */
export function olderRuns(state: Pick<ProjectState, 'candidateRuns'>): { runs: CandidateRun[]; candidateIds: Set<string> } {
  const runs = (state.candidateRuns ?? EMPTY_CANDIDATE_RUNS).runs.slice(1);
  return { runs, candidateIds: new Set(runs.flatMap(r => r.candidateIds)) };
}

/** A candidate's letter for the session ("?" when it isn't a candidate of this project). */
export function candidateLetterFor(state: Pick<ProjectState, 'candidates' | 'candidateRuns'>, candidateId: string): string {
  const letter = state.candidateRuns?.letters[candidateId];
  if (letter) return letter;
  // A candidate put in the list without a run (tests, old sessions): its place in the list.
  const index = state.candidates.findIndex(c => c.id === candidateId);
  return index < 0 ? '?' : candidateLetter(index);
}

export interface RunView {
  /** Null for candidates that came without a run. */
  run: CandidateRun | null;
  candidates: CandidateSolution[];
}

/** The runs with candidates still in the list, newest first; candidates that came without a run join the newest. */
export function runViews(state: Pick<ProjectState, 'candidates' | 'candidateRuns'>): RunView[] {
  const byId = new Map(state.candidates.map(c => [c.id, c]));
  const placed = new Set<string>();
  const views: RunView[] = [];
  for (const run of (state.candidateRuns ?? EMPTY_CANDIDATE_RUNS).runs) {
    const candidates = run.candidateIds.map(id => byId.get(id)).filter((c): c is CandidateSolution => !!c);
    candidates.forEach(c => placed.add(c.id));
    if (candidates.length > 0) views.push({ run, candidates });
  }
  const loose = state.candidates.filter(c => !placed.has(c.id));
  if (loose.length > 0) {
    if (views.length > 0) views[0] = { ...views[0], candidates: [...views[0].candidates, ...loose] };
    else views.push({ run: null, candidates: loose });
  }
  return views;
}

/** How a run was made, from its candidates' metadata: "Greedy · Natural Pose", "Quick", "Thorough", "Place remaining". */
export function runLabel(candidates: readonly CandidateSolution[]): string {
  if (candidates.some(c => c.metadata?.strategy === REMAINING_PLACED_STRATEGY)) return 'Place remaining';
  const families = [...new Set(candidates.map(c => c.metadata?.candidateFamily).filter((f): f is string => !!f))];
  if (families.length === 1) return `Greedy · ${families[0]}`;
  if (families.length > 1) return 'Greedy';
  const modes = new Set(candidates.map(c => c.metadata?.optimizationMode));
  if (modes.has('deep')) return 'Thorough';
  if (modes.has('fast')) return 'Quick';
  return 'Generate';
}

/** "just now", "1 min ago", "12 min ago", "2 h ago". */
export function runAge(createdAt: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(createdAt)) / 60_000);
  if (!(minutes >= 1)) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** The run a candidate came from, if any. */
export function runOf(state: Pick<ProjectState, 'candidateRuns'>, candidateId: string): CandidateRun | null {
  return (state.candidateRuns ?? EMPTY_CANDIDATE_RUNS).runs.find(r => r.candidateIds.includes(candidateId)) ?? null;
}

/**
 * Whether a candidate was made for an earlier version of the performance (T14):
 * the notes or the tempo changed since its run. Its Score re-scores through the
 * cache key, but its optimizer plan and trace describe the old notes.
 */
export function isCandidateStale(state: Pick<ProjectState, 'candidateRuns' | 'soundStreams' | 'tempo'>, candidateId: string): boolean {
  const run = runOf(state, candidateId);
  return !!run && run.performanceSignature !== performanceSignature(state);
}

