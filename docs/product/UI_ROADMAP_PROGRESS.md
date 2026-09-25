# PushFlow UI Roadmap — Progress Tracker

*Created 2026-09-23 by Prompt 0 (PR #92). Companion to [UI_ENHANCEMENT_ROADMAP.md](UI_ENHANCEMENT_ROADMAP.md) (what to build), [UI_IMPLEMENTATION_PROMPTS.md](UI_IMPLEMENTATION_PROMPTS.md) (how each session runs) and [UI_ISSUE_REGISTER.md](UI_ISSUE_REGISTER.md) (root causes).*

This is the shared record of the roadmap's implementation: the decisions every session follows, each session's status, which session owns each exit criterion, the phase audits, and deviations and follow-ups. Every implementation session reads it first and updates it in its own PRs.

## How to use this file

- **Status** is one of: `Not started` · `In progress (branch, open PRs)` · `Done` · `Skipped (reason)`. A session sets `In progress` in its first PR and `Done` only in its last.
- **Ticking.** Tick a deliverable, criterion or session check only in the PR that delivers it, and fill its *PR / verified by* slot with the PR number and how it was verified (test, spec, screenshot or CI run). Add the PR number in a follow-up commit once the PR exists.
- **Criterion IDs** follow the roadmap's order: `P1a-5b` is part b of phase P1a's fifth exit criterion. Parts are the roadmap's sub-bullets, or clauses that different sessions own. [Section 3](#3-criterion--session) gives every ID exactly one owner; a session owns only the criteria listed in its own section.
- **Session checks** are checks a session's prompt requires that are not roadmap exit criteria.
- Work found outside a session's scope goes under [Follow-ups](#6-follow-ups). Anything done differently from the roadmap or the session prompt goes under [Deviations](#5-deviations).

## 1. Decisions

Recorded 2026-09-23. "Default" means the recommendation in the "Decisions needed from you" table in section 4 of [UI_CORE_FLOWS_CRITIQUE.md](UI_CORE_FLOWS_CRITIQUE.md#decisions-needed-from-you); the roadmap's [open questions](UI_ENHANCEMENT_ROADMAP.md#open-questions-for-the-product-owner) give the longer form.

### Product decisions

**Q1 · Does the Working/Test Layout persist across reloads?** Answer: default, so yes.
- Resolved: the draft is saved with the project, as it is today, and restored on reload together with Recovered drafts, so it never silently expires. A reopened project whose draft differs from Active shows "Draft from 23 Sep restored · 3 pads differ · Keep editing / Discard".
- Affects: S1a.2 (the draft and Recovered drafts survive a reload), S1a.4 (truthful save covers the draft), S2.3 (a Library card shows the Working/Test Layout, badged "Draft, not promoted", when it differs from the Active Layout, and otherwise the Active Layout), S5.4 (the reopened-draft banner).

**Q2 · Do finger preferences survive Discard?** Answer: default, so yes.
- Resolved: finger preferences live in voiceConstraints, the Sound-level source of truth (invariant 6), so Discard reverts the layout but keeps them. Pad fingerConstraints are re-derived from voiceConstraints, and the Discard toast says the preferences were kept.
- Affects: S1a.4 (Discard hygiene and its reducer tests). S1a.2 lists Q2 as a prerequisite.

**Q3 · May default Sound names use MIDI pitch?** Answer: default, so no.
- Resolved: default names come from the track or file name plus a short sequence letter ("groove A"), never a note name, and originalMidiNote is kept as provenance shown only in the import review and a Sound's details tooltip. Naming from pitch happens only through the opt-in "Name from GM drum map" action, which renames all Sounds as one undo step.
- Affects: S2.2a (default names and the GM action), S5.2 (import review rows), and all user-facing copy (the "Words" rule).

**Q4 · Which one-click placements count as explicit under invariant 7?** Answer: default.
- Resolved: "Suggest a starting layout" stays a one-click action that places Sounds in the draft as one undo step, and "Place remaining N" produces a candidate that the user applies with one click ("Use as my draft", one undo step). Import, Generate and analysis never place Sounds; after Generate, candidate A is shown read-only (auto-inspect writes nothing), even on an empty grid.
- Affects: S1a.1 (Suggest is one undo step), S1a.2 (Generate on an empty grid places nothing), S3.2 (auto-inspect), S3.3 and S5.1 ("Place remaining N").

**Q5 · Which single headline score and evaluator?** Answer: default.
- Resolved: every layout's headline is "Playability 0–100, higher = easier" from canonicalEvaluator, served through getAnalysisForLayout, with Hard and Unplayable event counts and each factor's share of the burden. Beam keeps PerformabilityObjective for ranking, and the five DiagnosticFactors stay factorized.
- Affects: S3.1 (the evaluator behind getAnalysisForLayout) and S6.1 (the headline display); S3.3 and S6.2 read the same numbers.

**Q6 · What is the Pattern Composer's model?** Answer: default, so model (b).
- Resolved: the Composer edits named pattern sections, stored in beats, that are inserted into the project's one timeline at a chosen bar. It stays a bottom-drawer tab that uses the project tempo (invariants 3 and 8).
- Affects: S5.3 (reserves the pattern slot in beats), S8.1 (patterns and preset placement records live in the project, and the drawer header states the model), S8.2 ("Add to timeline at bar…").

**Q7 · Is "moment" a UI word, or only "event"?** Answer: default, so "event".
- Resolved: labels use the canon term, as in "Event 12 · 3.2.3", where an event is everything struck at one instant, and single hits are "notes". "Moment" appears only in explanatory text such as tooltips and Learn More, so the roadmap's "Selected moment" card is labelled "Selected event"; code names such as groupIntoMoments and momentKey are unaffected.
- Affects: S2.2b (event and note counts), S4.1 (event labels), S4.2 and S4.3b (Events list, inspector and Rehearse labels), and all user-facing copy (the "Words" rule).

### Working mode: solo

- Resolved: no feature flags. Every "behind a flag" becomes a short-lived branch, and sessions run one at a time through the Continue prompt, so the ∥ marks are optional. The first milestone is the solo "trust release": every session from S0.1 through S3.3.
- Affects: every session (short-lived branches instead of flags), and specifically S0.1 (the Flags deliverable is skipped), S4.3a (the old audio path stays selectable through a dev-only localStorage switch, with a follow-up to delete it) and S7.1 (no flag; see Cuts).

### Cuts

| Optional item | Decision | Resolved | Affects |
|---|---|---|---|
| Volume popover, audition and hands filter | Keep | All three ship in S4.4, so P4-7e and P4-11b are in scope. | S4.4 |
| Compare-and-swap saves and cross-tab banner | Keep | S5.4 adds revision counters with compare-and-swap saves (a stored-format change, through the migration runner) and the "Changed in another tab · Reload / Keep mine" banner, so all of P5-8 is in scope. | S5.4 |
| Flag rollout for the workspace consolidation | Per mode | Solo mode, so no flag: S7.1 ships from a short-lived branch with the one-time "What moved" popover. | S7.1 |
| Sequencer basics and full keyboard grid | Do | S8.3 is in scope, with P8-5 and P8-6. | S8.3 |

### Wording changed by these decisions

- Q1: CLAUDE.md, Default Decision Handling. The Working/Test Layout line now says it persists across reloads.
- Q3: PUSHFLOW_CANON.md section 10. "It is stripped from the sound" is replaced by the provenance-only rule.
- Q4: CLAUDE.md invariant 7 now reads "Nothing is placed or fingered without a named user action…".
- Q7: no change, because "moment" does not become a UI label.

## 2. Sessions

Sessions are listed in S0.1 … S8.3 order, as in [UI_IMPLEMENTATION_PROMPTS.md](UI_IMPLEMENTATION_PROMPTS.md#session-prompts). Deliverables use the roadmap's headings; the roadmap and the session prompt hold the detail.

### Phase P0 · Safety net

#### S0.1 — Test runner, CI, hooks and fonts

- **Status:** Done (PR #93)
- **Prerequisites:** Prompt 0 merged.
- **Mode:** solo, so the Flags deliverable is skipped.

**Deliverables**
- [x] Playwright runner · *PR / verified by:* PR #93. playwright.config.ts: webServer on 5199 --strictPort with VITE_E2E=1, projects chromium-1366 and chromium-1600 (deviceScaleFactor 1), firefox-1366 only with PW_FIREFOX, PW_CHROMIUM → executablePath. `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` runs the 6 spec × viewport cases; screenshot baselines come from CI (test/e2e/__screenshots__). No 1920×1080 project yet: the C1 menu spec that needs it arrives in S0.2.
- [x] Test hooks · *PR / verified by:* PR #93. window.__pf (state copy, layoutHash, history depth, dispatch/undo/redo) in src/ui/testing/e2eHook.ts, installed by ProjectProvider only when VITE_E2E is set; test/e2e/hook.spec.ts. data-testids: pad-{row}-{col}, pad-menu, verdict-badge (+ data-level), compare-dialog, candidate-row (+ data-candidate-id), transport, transport-play, drawer-tab-timeline, drawer-tab-composer.
- [x] Component tests · *PR / verified by:* PR #93. happy-dom + @testing-library/react; vitest includes test/**/*.test.tsx with a per-file `@vitest-environment` docblock; ResizeObserver and matchMedia shims in test/helpers/domShims.ts. test/ui/components/FeasibilityBadge.test.tsx; test/e2e/a11y-library.spec.ts (@axe-core/playwright).
- [x] CI · *PR / verified by:* PR #93. ci.yml (typecheck, unit, build + check:no-test-hook, e2e in 2 shards with report/traces uploaded on failure) is green on #93 ([run 35909316340](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909316340)). nightly.yml runs the Firefox project; deploy.yml runs typecheck and test:run before building. update-snapshots.yml generated the first baselines (Chromium 1366/1600 and Firefox 1366) in [run 35909156475](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909156475), triggered by the `update-snapshots` label.
- [x] Deterministic fonts and screenshots · *PR / verified by:* PR #93. Inter and Space Grotesk variable woff2 (latin + latin-ext, OFL licenses alongside) in public/fonts with @font-face in src/index.css; build rewrites them to /PushFlow-Modified/fonts/. test/e2e/fixtures.ts aborts fonts.googleapis.com and fonts.gstatic.com for every spec; toHaveScreenshot disables animations and hides the caret. Before/after: docs/screenshots/S0.1/.
- [x] Fixtures · *PR / verified by:* PR #93. TEST MIDI 1 copied to test/fixtures/midi/ and public/demo/; the archive copy stays.
- Flags: skipped, because the working mode is solo.

**Exit criteria**
- [x] **P0-1** A deliberately failing commit on a scratch branch turns the ci.yml check red for each of typecheck, a unit test and an e2e spec. Link the three red runs in the slot. · *PR / verified by:* draft PRs #94–#96 (closed). Typecheck: [run 35909391019](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909391019), `typecheck` red on TS2322 in src/scratchTypeError.ts. Unit: [run 35909397575](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909397575), `unit` red on "expected 2 to be 3" in test/scratchRed.test.ts. E2E: [run 35909402879](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909402879), both `e2e` shards red on the scratch spec only (all other specs, including the screenshots, passed).
- [x] **P0-2** The e2e suite passes twice in a row in CI with identical screenshots while fonts.googleapis.com is blocked. · *PR / verified by:* PR #93. Against the committed baselines, with Google Fonts aborted by test/e2e/fixtures.ts, both e2e shards passed in [run 35909316340](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909316340) (#93 at 04ae5d1) and again in [run 35909397575](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909397575) (the unit-failure scratch PR, whose e2e shards compare the same baselines).
- [x] **P0-4** A happy-dom component test renders FeasibilityBadge (expected-fail on the "feasible" default until S1b.1), and the axe smoke spec runs on the Library. · *PR / verified by:* PR #93. FeasibilityBadge.test.tsx renders all three tiers; its `it.fails` case fails with "expected 'feasible' not to be 'feasible'" (checked by removing the marker). a11y-library.spec.ts passes at both viewports and attaches the violations list.
- [x] **P0-7** A grep of dist/ finds no window.__pf. · *PR / verified by:* PR #93. `npm run check:no-test-hook` passes after `npm run build`, and finds the hook in a VITE_E2E=1 build (so the check can fail). Runs in ci.yml and deploy.yml.

#### S0.2 — C1–C9 regression specs and the TEST MIDI 1 gate

- **Status:** Done (PR #97)
- **Prerequisites:** S0.1.

**Deliverables**
- [x] C1-C9 as specs · *PR / verified by:* PR #97. test/e2e/c1-pad-menu … c9-presets.spec.ts: 36 e2e cases, 35 of them `test.fail(EXPECTED_FAIL, …)` naming the session that flips it (table below); C3's greedy lock case passes today and is a normal test. Shared steps in test/e2e/project.ts (import TEST MIDI 1 through the real file input, place Sounds with the drag's action, wait for analysis, Generate, save and reload). `PF_UNMARK=1` runs every case with its marker off; each was run that way at 1600×1000 (C1 also at 1366 and 1920) and fails on the assertion listed below. New testids (VITE_E2E-free, plain attributes): variant-row (+ data-variant-id), compare-card (+ data-candidate-id), compare-toggle-active. Playwright project chromium-1920 runs c1 only.
- [x] Extended TEST MIDI 1 gate, including deep annealing in nightly.yml · *PR / verified by:* PR #97. testMidi1Integration.test.ts imports through buildLanesFromMidiProject (extracted unchanged from useLaneImport) and IMPORT_LANES, then SUGGEST_STARTING_LAYOUT; greedy, beam and annealing Quick each run as useAutoAnalysis.generateFull does, with strict 0-unplayable, fixed-seed snapshots (Sounds named, not id'd, so they are stable across imports; verified identical in two separate runs) and the [7,0] lock case. nightly.yml's deep-annealing job runs `npm run test:nightly` (vitest.nightly.config.ts, test/nightly/*.nightly.ts) and writes durations to the job summary.

**Exit criteria**
- [x] **P0-3** C1–C9 exist as test.fail specs that fail today for the documented reason. A grep finds no `__reactFiber` or `_reactInternals` in test/. · *PR / verified by:* PR #97. Every case run with `PF_UNMARK=1` fails on the assertion recorded in the table below; `grep -rn "__reactFiber\|_reactInternals" test/` finds nothing. The full suite with markers passes at 1366, 1600 and (C1) 1920.
- [x] **P0-5** testMidi1Integration.test.ts has greedy, beam and annealing cases with strict 0-unplayable assertions, a lock case and seed-0 snapshots, and reads from test/fixtures. It builds no Map keyed by MIDI pitch. Any method that fails the strict check today is recorded as expected-fail and becomes a P1a (S1a.3) blocker. · *PR / verified by:* PR #97. All three methods report 0 unplayable in strict mode today, so nothing is expected-fail on that check. Lock case: greedy passes; beam and annealing Quick are `it.fails` (candidates come back with `soundAt7_0: undefined` and `placementLocks: {}`), flipped by S1a.3. Snapshots pin the fixed seeds the pipelines use (see Deviations).
- [x] **P0-6** The nightly job runs deep annealing and reports its duration (record it in the slot). · *PR / verified by:* PR #97. [Nightly run 35927549915](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35927549915) (workflow_dispatch on the PR branch, commit bedfb13), deep-annealing job green: annealing Thorough on TEST MIDI 1 took **49.7 min (2980 s)** for 3 candidates, 0 unplayable in strict mode; the deep lock case took 49.4 min (2963 s) and failed as expected (`it.fails` until S1a.3). The two files run in parallel, so the job took about 50 min of its 180-minute limit. Locally: 46.8 min.

**C1–C9 cases and why each fails today** (run with `PF_UNMARK=1`)

| Spec | Case | Flips in | Failing assertion today |
|---|---|---|---|
| C1 | menu at the cursor or clamped, all 64 pads (1366, 1600, 1920) | S1b.2 | every pad listed: e.g. `[0,0] cursor 622,450 menu 1105,434` at 1600 (≈480 px right of the cursor) |
| C1 | 12/12 items clickable on occupied pads | S1b.2 | e.g. `[0,0] 6/12`, `[3,7] 8/12`, `[4,3] 9/12` at 1366 |
| C1 | first Escape closes, focus returns to the pad | S1b.2 | menu count after Escape: expected 0, received 1 |
| C2 | Generate leaves the draft hash unchanged | S1a.2 | working hash replaced by candidate #1's pads |
| C2 | an edit made while Generate runs is kept (hook test, test/ui/hooks/generateMidRunEdit.test.tsx, `it.fails`) | S1a.2 | `[7,7]` expected the moved Sound, received undefined |
| C2 | draft recoverable after Preview / card-body click / Load Draft / candidate Promote / variant Promote, and after reload (5 cases) | S1a.2 | "hand-made draft is the draft or a Recovered draft": expected true, received false |
| C2 | inspecting candidates never writes workingLayout | S3.2 | working hash changes on the first Preview |
| C3 | greedy: lock at [7,0] holds (normal test, passes today) | — | — |
| C3 | beam / annealing Quick: lock holds in every candidate | S1a.3 | `soundAt7_0: null`, `locks: {}` for every candidate |
| C3 | drag onto / off a locked pad is refused | S1a.3 | the drop replaces the locked Sound; the drag-out moves it to [4,4] |
| C4 | 3 placements, analysis settles, 3 Undos → empty grid | S1a.1 | `pads: {"3,3": …}` remains |
| C4 | one Undo after Suggest restores the pre-Suggest grid | S1a.1 | the six suggested pads remain |
| C4 | one Undo after Generate reverts the applied candidate, keeps candidates and trace | S1a.1 (S1a.2 rewords) | `candidates: []` after Undo |
| C4 | Undo during playback keeps playing | S1a.1 | `isPlaying: false`, rewound |
| C4 | a reopened project has an empty history | S1a.1 | `undo: 1` |
| C5 | onion toggle changes grid pixels | S1b.4 | pixels identical off and on |
| C6 | Infeasible / Degraded layout with an event selected never shows Feasible (2 cases) | S1b.1 | `"feasible: ✓ Feasible All events playable"` badge appears |
| C7 | Active side shows real fingering and score, or "Couldn't analyse" | S1b.3 | `Active Layout Easy SCORE 0.0 … Playability 0` |
| C7 | Escape closes Compare | S1b.3 | dialog count 1 after Escape |
| C7 | Compare disabled after promoting / deleting a compared candidate (2 cases) | S1b.3 | Compare button still enabled |
| C7 | Active's score in Compare equals its standalone analysis | S3.3 | expected ≈79.4, received 0 |
| C8 | with an event selected, no pad greyed while playing; Stop restores the overlay | S1b.4 | 29 greyed frames while playing |
| C8 | ArrowRight while playing neither seeks nor selects | S1b.4 | `selectedEventIndex: 0` |
| C9 | a drop on empty pads places the preset's Sounds | S1b.4 | grid stays empty (drop never fires) |
| C9 | a drop over an occupied pad is refused with a reason | S1b.4 | no reason text |
| C9 | a Mirror toggle set before dragging is honoured | S1b.4 | the unmirrored drop already places nothing |
| C9 | a foreign preset is refused with "This preset's Sounds aren't in this project" | S1b.4 | message not found |
| C9 | Save Preset leaves fingers blank | S1b.4 | `finger: "index", hand: "left"` stored |
| C9 | "Add to timeline at bar…" inserts the preset's notes | S8.2 | no such button |

### Phase P1a · Stop losing work

#### S1a.1 — Undo covers only your edits, plus the toast

- **Status:** Done (PR #98)
- **Prerequisites:** S0.2.
- **Flips:** C4.
- **Decisions:** Q4 (Suggest becomes one undo step).

**Deliverables**
- [x] Undo on the document only (T02): the document/session slice split (first PR) · *PR / verified by:* PR #98, commit 97bfab8. ProjectState = ProjectDocument & ProjectSession (projectState.ts), still flat, so MoveTracePanel and every consumer read state.moveHistory* unchanged. projectDocument.ts holds the field list (a Record over keyof ProjectDocument, so an unclassified field is a compile error), pickDocument, documentChanged (reference, then structural) and restoreDocument. useUndoRedo stacks document snapshots only; Undo/Redo keep the session, mark analysis stale (it re-resolves by layout hash) and bump updatedAt for autosave. No-op results record nothing. The one exception to "Undo never restores the session": a step that removed candidates (a candidate Promote) gives them back on Undo, so no generated result is lost (Codex review on PR #98). Stored format unchanged. Tests: test/ui/state/projectDocument.test.ts, test/ui/state/undoHistory.test.tsx.
- [x] Undo on the document only (T02): the transaction wrapper (second PR) · *PR / verified by:* PR #98, commit f291b7b. transact(label, fn) makes fn's dispatches one named step (nested calls join). Suggest is recorded; an import (all files, lanes + tempo), Ctrl/Cmd+G group/ungroup, Duplicate layout and apply-candidate are one step each; Discard and Promote were already single dispatches. Undo/Redo buttons name their target in title and aria-label ("Undo: Discard (Ctrl+Z)"), testids undo-button/redo-button. Opening a project starts with empty history. Tests in undoHistory.test.tsx ("one undo step per user intent").
- [x] Toast region primitive (T31 slice) · *PR / verified by:* PR #98, commit 7e58bf8. components/shared/Toast.tsx: ToastProvider (mounted in App) with an always-present role=status aria-live=polite region, one optional action, labelled dismiss, max 3, auto-dismiss paused on hover/focus, no-op useToast outside the provider. First use: "Undone: Place Sound · Redo" and "Redone: …". test/ui/components/Toast.test.tsx. Screenshots: docs/screenshots/S1a.1/ (before/after at 1366 and 1600, one Undo after placing 3 Sounds).

**Field table** (document vs session; undo membership vs persistence)

| Field | Slice | Saved with the project | Notes |
|---|---|---|---|
| version, id, createdAt | document | yes | Never edited; restoring them is a no-op |
| name | document | yes | RENAME_PROJECT |
| soundStreams | document | yes | Rebuilt from lanes; a structurally equal rebuild records nothing |
| tempo | document | yes (bpm) | |
| instrumentConfig, sections, voiceProfiles | document | yes | |
| activeLayout, workingLayout, savedVariants | document | yes | Locks and pad fingerConstraints live inside the layouts |
| layouts?, activeLayoutId? | document | legacy reads only | V1 migration fields |
| voiceConstraints | document | yes | Finger preferences (invariant 6) |
| performanceLanes, laneGroups, sourceFiles | document | yes | Group collapse (TOGGLE_LANE_GROUP_COLLAPSE) folds into the current step |
| updatedAt | session | yes | Autosave clock; Undo/Redo bump it |
| engineConfig, optimizerMethod, greedyStrategy, costToggles | session | yes | Preferences: saved, never undone |
| analysisResult, candidates, selectedCandidateId, compareCandidateId | session | no | |
| analysisStale, isProcessing, error, manualCostResult | session | no | |
| moveHistory, iterationTrace, moveHistoryStopReason, moveHistoryIndex | session | no | Read at state.moveHistory*, as before |
| selectedEventIndex, selectedMomentIndex, selectedStreamId | session | no | |
| currentTime, isPlaying, playbackRate, loopEnabled, loopStart, loopEnd, countInBars, rehearsalAudio | session | no | |

Ephemeral actions (EPHEMERAL_ACTIONS) now list only document-touching actions that are never a step of their own: TOGGLE_LANE_GROUP_COLLAPSE, SYNC_STREAMS_FROM_LANES, POPULATE_LANES_FROM_STREAMS (plus the per-frame transport ticks, to skip the document check).

**Exit criteria**
- [x] **P1a-1a** Reducer test: place 3 Sounds, let analysis settle, then Undo 3 times: the grid is empty. · *PR / verified by:* undoHistory.test.tsx "P1a-1a" (real ProjectProvider and useAutoAnalysis; fails on main with `expected [ '3,3' ] to deeply equal []`), and C4 e2e case 1.
- [x] **P1a-1b** Reducer test: one Undo after Suggest restores the pre-Suggest grid. · *PR / verified by:* undoHistory.test.tsx "P1a-1b", and C4 e2e case 2.
- [x] **P1a-1d** Reducer test: Undo during playback keeps playing from the current time. · *PR / verified by:* undoHistory.test.tsx "P1a-1d" (fails on main: `{ isPlaying: false, currentTime: 0 }`), and C4 e2e case 4.
- [x] **P1a-1e** Reducer test: a reopened project starts with an empty history. · *PR / verified by:* undoHistory.test.tsx "P1a-1e" (a saved-and-loaded project, after lane syncs and analysis; fails on main with `canUndo: true`), and C4 e2e case 5 (save and reload).
- [x] **P1a-1f** Reducer test: isProcessing is false after both success and error. · *PR / verified by:* undoHistory.test.tsx "P1a-1f" (generateFull with the greedy pipeline mocked to resolve and to reject; the failed run adds no undo step). Both already held on main; kept as regression guards.

**Session checks**
- [x] C4 flipped: its spec passes with the test.fail marker removed. · *PR / verified by:* markers removed from test/e2e/c4-undo.spec.ts; all 5 cases pass at 1366 and 1600 (`PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test c4`).
- [x] Interim Generate-undo test: one Undo after Generate reverts the auto-applied candidate as a single step and keeps the candidate list and trace. S1a.2 replaces it (P1a-1c). · *PR / verified by:* undoHistory.test.tsx "interim (until S1a.2)" (the step is named "Use candidate"; the next Undo target is the user's previous edit), and C4 e2e case 3.
- [x] Round-trip test: a project saved by current main loads and re-saves with identical document fields. · *PR / verified by:* projectDocument.test.ts "persistence round trip", against test/fixtures/projects/saved-by-main.json, written by the serializer on main at 74385de (a draft, a lock, a finger preference, a variant and a lane group).

#### S1a.2 — Migration runner; Generate only proposes; Recovered drafts

- **Status:** Done (PR #99)
- **Prerequisites:** S1a.1; Q1 and Q2 (recorded above).
- **Flips:** the S1a.2 C2 cases (the Inspect case flips in S3.2).
- **Decisions:** Q1 (the draft and Recovered drafts survive a reload), Q4 (Generate on an empty grid places nothing).

**Deliverables**
- [x] Migration runner: the runner, its pre-migration backup, "Download backup" and the Recovered-drafts migration only (the ghost-lock migration is S1a.4's, the preset migration S1a.5's) · *PR / verified by:* PR #99. persistence/migrations.ts: MIGRATIONS (ordered by `from`, each one version up, idempotent) and runMigrations (sync, pure); migrateWithBackup awaits the backup before any step and migrates nothing if it fails. PERSISTED_SCHEMA_VERSION is 2; the one migration, `recovered-drafts-store` (1 → 2), adds `recoveredDrafts: []`. Unversioned localStorage records are converted to schema 1 first, then run through the same runner. The backup is the untouched stored record, written to a new IndexedDB store `backups` (DB version 2) keyed `${projectId}@v${fromVersion}` and committed before the migrated record is written back, so a record migrates once. "Download backup" appears on a Library card (and the Continue hero) only when that project has a backup; nothing downloads automatically. A file import migrates without a backup (the file is the copy). Tests: test/ui/persistence/migrations.test.ts, test/ui/persistence/projectStorageMigration.test.ts (IndexedDB faked in memory; write order `putBackup v1` → `putProject v2`, second load writes nothing, a failed backup leaves the record untouched).
- [x] Generate only proposes (T01 slice) · *PR / verified by:* PR #99. Both APPLY_GENERATION_TO_LAYOUT dispatches (and the SET_ANALYSIS_RESULT beside them) are gone from useAutoAnalysis.generateFull, and SET_CANDIDATES no longer selects candidate #1, so the grid, the draft and its analysis stay as they were; the list says "Preview #1 to try it on the grid". A click on a candidate card's body does nothing; only its Preview button previews. Preview, Load Draft, a candidate Promote (card, View all, Compare) and a variant Promote keep a draft whose hash differs from Active, from the incoming layout, from every saved variant and from every candidate in `recoveredDrafts` (document slice, so undoable; saved with the project per Q1), with the toast "Your draft was kept in Recovered drafts · Restore" (hooks/useDraftReplacement.ts). The list keeps its own group under the variants (Restore, delete), dedupes by layout hash, keeps the newest 5 and says so in the toast when it prunes. The variants list shows every variant (the slice(-3) and its "View all" trigger are gone). Learn More's "What are candidates?" says Generate never changes the layout. Tests: test/ui/state/recoveredDrafts.test.ts, test/ui/hooks/generateOnlyProposes.test.tsx, test/ui/components/LayoutOptionsPanel.test.tsx. Screenshots: docs/screenshots/S1a.2/ (before/after at 1366 and 1600: a hand-made draft, then Beam Generate, then Preview #2; before, Generate replaced the draft with candidate #1; after, the draft and its analysis stay, and Preview shows the "kept · Restore" toast).

**Exit criteria**
- [x] **P1a-1c** Reducer test: after Generate, Undo keeps the candidate list and the trace (MoveTracePanel still shows state.moveHistory) and undoes the previous user edit. This replaces S1a.1's interim test. · *PR / verified by:* PR #99. undoHistory.test.tsx "P1a-1c" (greedy Generate records no step; one Undo undoes the pad swap made before it; candidate ids, state.moveHistory and each candidate's iterationTrace unchanged), and C4 e2e case 3, rewritten the same way (1366 and 1600).
- [x] **P1a-2a** C2 flipped on TEST MIDI 1: after Generate, the draft hash is unchanged, and a grep test finds no APPLY_GENERATION_TO_LAYOUT dispatch in useAutoAnalysis. · *PR / verified by:* PR #99. C2 "Generate leaves the draft unchanged" (marker removed; passes at 1366 and 1600); grep test and hook test in generateOnlyProposes.test.tsx.
- [x] **P1a-2b** C2: an edit made during a run is kept. · *PR / verified by:* PR #99. test/ui/hooks/generateMidRunEdit.test.tsx, `it.fails` removed (passes).
- [x] **P1a-2c** C2: after Preview, a card-body click, Load Draft, card Promote and variant Promote, a hand-built draft is recoverable as the draft or in "Recovered drafts", including after a reload. · *PR / verified by:* PR #99. the five C2 cases, markers removed, all pass at 1366 and 1600 (`PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test c2`); reducer versions with a serialize/reload round trip in recoveredDrafts.test.ts.
- [x] **P1a-3** After 5 auto-keeps, a user-named variant is still visible. Recovered drafts are deduped by hash and capped at 5, with a notice on pruning. · *PR / verified by:* PR #99. recoveredDrafts.test.ts "P1a-3" (5 keeps leave the named variant in savedVariants; a 6th prunes the oldest; a same-hash keep replaces the older copy); the pruning notice is the toast text from useDraftReplacement; LayoutOptionsPanel.test.tsx "lists every saved variant" (6 rows).
- [x] **P1a-4** Generate on an empty grid leaves the draft (workingLayout) empty (invariant 7). · *PR / verified by:* PR #99. generateOnlyProposes.test.tsx "P1a-4" (real ProjectProvider and generateFull on TEST MIDI 1 with nothing placed: candidates produced, no pads in the draft or Active, no undo step).

**Session checks**
- [x] Runner test: the backup is written before any migration, migrations run in order, and a second run changes nothing. · *PR / verified by:* PR #99. migrations.test.ts ("writes the backup, with the untouched record, before any migration step runs", "runs the migrations a record needs, in version order", "a second run changes nothing", and each migration idempotent on its own output); projectStorageMigration.test.ts for the real load path.

#### S1a.3 — Locks honoured by every method; strict Sound identity ∥ S1b.1, S1b.2, S1b.3

- **Status:** Done (PR #100)
- **Prerequisites:** S1a.1.
- **Flips:** C3 and the S0.2 beam/annealing lock cases.

**Deliverables**
- [x] Locks honoured and identity strict (T11, T18) · *PR / verified by:* PR #100. **Engine.** Every method builds its Sounds from one voice map (`engine/mapping/voiceMap.ts`: layout voices first, then the project's Sounds passed as `voiceHints`, matched by id and never by pitch) and its locks from one helper (`engine/mapping/placementLocks.ts`). Beam and Annealing seed each pose0 candidate by Sound (`seedFromPose.ts`: locked Sounds first, on their locked pads; the rest busiest first, ties in Sounds-panel order; the honoured locks travel with the layout), the compact strategies keep locked Sounds on their pads and pack the rest in the base layout's reading order (no longer by pitch), annealing copies `placementLocks` with every layout so every mutation leaves locked pads alone, and `annealingSolver.solve` now receives `manualAssignments` and applies them to every evaluation of the run, not only the final plan. Every candidate of every method is post-validated (`findLockViolations`): one that moved a locked Sound is dropped, counted in `CandidateGenerationSummary.droppedForLockViolations`, and the Layouts panel says so ("2 candidates were dropped because they moved a locked Sound."), through the session field `generationSummary` (action `SET_GENERATION_SUMMARY`, cleared by `SET_CANDIDATES`; never persisted, never undone). **Identity.** `resolveEventToPad` never falls back to pitch for an event that has a Sound (only a Sound-less event, one with no voiceId, is keyed by its pitch, and the moment builder's pitch-string placeholder counts as Sound-less); `computeMappingCoverage` and the beam solver's coverage count Sounds; `buildSolverConstraints` keys preferences by voiceId only; `soundStreamLookup`, PadGrid, UnifiedTimeline and ActiveLayoutSummary match by id only; the Composer's lane↔pad matching goes through `composerLaneIdentity.ts` (the lane's project Sound id, then id, then name as the pre-S1a.5 fallback; never pitch); preset pads get `originalMidiNote: null` instead of an invented 36. **Manual edits.** `ASSIGN_VOICE_TO_PAD` and `SWAP_PADS` refuse a drag out of a locked pad and a drop onto one (`placementBlockedByLock`, `isPadLocked`); a refused action returns the same state, so it makes no draft and no undo step. The grid makes a locked pad non-draggable, refuses drops onto it (no dragover `preventDefault`, so the pointer shows "not allowed") and refuses a locked Sound dragged from the Sounds panel (`LOCKED_SOUND_DRAG_TYPE`); the tooltip reads "Locked · Unlock to move" on the pad, on its lock glyph (a lucide `Lock` in the pad's corner, outside the name) and on the Sounds-panel glyph. **One-time note.** "Scores changed: Sounds are now matched by identity, not pitch." (`useIdentityMatchingNotice`: a toast, once per browser, for a project created before 2026-09-24 that has Sounds). Tests: `test/engine/mapping/soundIdentity.test.ts`, `seedFromPose.test.ts`, `test/engine/optimization/locksHonoured.test.ts`, `test/ui/state/projectStateConstraintSync.test.ts`, `test/ui/analysis/soundStreamLookup.test.ts`, `test/ui/components/composerLaneIdentity.test.ts`, `test/ui/hooks/generationSummary.test.tsx`, `test/ui/hooks/useIdentityMatchingNotice.test.tsx`. Screenshots: `docs/screenshots/S1a.3/` (before/after at 1366 and 1600: seven Sounds placed, one locked at [7,0], then Beam Generate and Preview #1; before, the previewed candidate had moved the locked Sound and its lock was gone; after, it stays on [7,0] with the lock).
- [x] Learn More (invariant 2), the P1a item · *PR / verified by:* PR #100. `LearnMoreModal.tsx`: a "Placement (yours, hard)" group in the Constraints tab (`HARD_CONSTRAINTS`, now exported) with "Placement Locks" (Greedy, Beam and Annealing place locked Sounds first and never move them; a breaking candidate is dropped and the list says so; drags out of or onto a locked pad are refused) and "Sound Identity" (matched by Sound, never by MIDI pitch; an unplaced Sound is unmapped even when another Sound shares its pitch); the Enforcement paragraph opens with locks. `LOCK_ENFORCING_METHODS` is exported for S1b.1's sync test. Test: `test/ui/components/LearnMoreModal.test.tsx`.

**Exit criteria**
- [x] **P1a-5a** C3 flipped for greedy, beam and annealing Quick (deep annealing runs nightly): a lock at [7,0] holds in every candidate, and placementLocks is non-empty. · *PR / verified by:* C3, all markers removed, 10/10 at 1366 and 1600 (`PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test c3`); the TEST MIDI 1 gate's beam and annealing-quick lock cases (`it.fails` removed, pass) and the nightly deep lock case (marker removed; verified here by `locksHonoured.test.ts`'s direct annealing run with restarts and zone transfers, and by the mutation service never touching a locked pad; the next nightly run confirms). `locksHonoured.test.ts` covers the pose0, compact and annealing paths and the dropped-candidate count.
- [x] **P1a-5b** C3: manual drags onto and out of a locked pad are refused. · *PR / verified by:* C3 "dragging another pad onto the locked pad is refused" and "dragging the locked Sound off its pad is refused" (real mouse drags, 1366 and 1600); `projectStateConstraintSync.test.ts` (drag-out, drop-onto and either swap refused, each returning the same state; an unlocked move still carries its finger constraint and leaves other locks alone).
- [x] **P1a-5c** C3: TEST MIDI 1 reports 0 unplayable events for every method. · *PR / verified by:* `testMidi1Integration.test.ts`: 0 unplayable in strict mode for greedy, beam and annealing Quick, with and without the lock (20 passed, 2 `runIf` skips); C3 asserts `unplayable: 0` per candidate for all three methods.
- [x] **P1a-5d** C3: seed 0 gives identical output twice, and the trace shapes are unchanged. · *PR / verified by:* the fixed-seed snapshots in `testMidi1Integration.test.ts.snap` are byte-for-byte unchanged for all three methods (the new order, busiest first with ties in Sounds-panel order, reproduces the old pads for an imported file, whose Sounds import in pitch order), so two runs of the pipelines still agree; trace shapes untouched (`AnnealingIterationSnapshot` and `OptimizerMove` fields as before; `locksHonoured.test.ts` checks the annealing trace length across restarts).
- [x] **P1a-6** When two Sounds share a pitch and one is unplaced, the unplaced Sound's events are unmapped. A Composer lane never matches a pad by pitch. · *PR / verified by:* `soundIdentity.test.ts` "P1a-6" (the beam solver leaves the unplaced Sound's three events Unplayable with no pad and plays the other Sound on its pad; the canonical evaluator reports those moments unmapped; `resolveEventToPad` and `computeMappingCoverage` unit cases); `composerLaneIdentity.test.ts` (a Sound that only shares a lane's pitch is not the lane, in both directions).
- [x] **P1a-14** The Learn More Constraints section lists lock enforcement for all three methods (asserted directly if S1b.1's sync test isn't merged yet). · *PR / verified by:* `LearnMoreModal.test.tsx` (renders the Constraints tab: names Greedy, Beam and Annealing, the dropped-candidate rule, the manual-drag rule and "never by MIDI pitch"; the placement rules live in the exported `HARD_CONSTRAINTS` list the section renders from).

**Session checks**
- [x] Solver Change Checklist (CLAUDE.md), all seven items, recorded in the PR. · *PR / verified by:* PR #100 description, and: (1) outputs changed: candidate layouts carry the honoured `placementLocks`; pose0 and compact seeds are built by identity (same pads as before for imported files); `CandidateGenerationSummary` gains `droppedForLockViolations`; `ExecutionPlanResult.metadata.layoutCoverage` counts Sounds, not pitches; annealing's per-iteration evaluations honour `manualAssignments`. (2) trace shapes unchanged. (3) UI consumers: LayoutOptionsPanel shows the dropped-for-locks note; MoveTracePanel and CandidatePreviewCard unchanged and still rendered (`LayoutOptionsPanel.test.tsx`, C2 and C4); CLAUDE.md's PerformanceAnalysisPanel no longer exists. (4) greedy restarts and seeded noise untouched; the annealing restart loop untouched (`locksHonoured.test.ts` runs two restarts with zone transfer). (5) fixed seeds, snapshots identical. (6) `isProcessing` reset paths untouched; P1a-1f and `generationSummary.test.tsx` (false after a Beam run). (7) TEST MIDI 1: 0 unplayable and the lock held for all three methods.

#### S1a.4 — Discard hygiene, freshness, mute can't delete, truthful save

- **Status:** Done (PR #101)
- **Prerequisites:** S1a.2, S1a.3; Q1 and Q2 (recorded above).
- **Decisions:** Q2 (Discard keeps finger preferences), Q1 (truthful save covers the draft).

**Deliverables**
- [x] Discard hygiene (T12) · *PR / verified by:* PR #101, commit 5dc25e7. `DISCARD_WORKING_LAYOUT` merges the draft's locks into Active as before but keeps only those whose Sound sits on the locked pad in Active (`prunePlacementLocks`), so a lock made at a draft-only pad no longer survives invisibly; it also re-derives Active's pad fingerConstraints. Every layout switch goes through one helper, `withDerivedLayoutState` (fingerConstraints derived from voiceConstraints, dead locks pruned): Discard, Promote of a draft, of a candidate (its plan re-bound to the derived layout) and of a variant, Preview (`APPLY_GENERATION_TO_LAYOUT`), Load Draft and Restore. Finger preferences set during the draft survive Discard (Q2): the toolbar's Discard shows "Draft discarded · Finger preferences kept" with Undo (plain "Draft discarded" when there are none), and the toast's Undo is offered only while Discard is still the step Undo would revert. Tests: `test/ui/state/discardHygiene.test.tsx`. Also (S1a.3's follow-up, commit 1a72242): `REMOVE_VOICE_FROM_PAD` refuses a locked Sound like a drag out (same state, no draft, no undo step); the pad shows no × while locked and the context menu's "Remove from pad" is disabled with "Locked · Unlock to remove"; Learn More's Placement Locks rule says so (`projectStateConstraintSync.test.ts`).
- [x] Freshness slice (T14) · *PR / verified by:* PR #101, commit 5dc25e7. `TOGGLE_PLACEMENT_LOCK` sets `analysisStale`, so auto-analysis runs again instead of the plan disappearing (its hash covers locks). A drop on the source pad returns early in `InteractiveGrid.handleDrop`, and `ASSIGN_VOICE_TO_PAD` onto the pad the Sound already occupies (or `SWAP_PADS` of a pad with itself) returns the same state: no draft, no stale flag, no history entry. `hasWorkingChanges` is `hashLayout(working) !== hashLayout(active)`, so a draft equal to Active hides Promote and Discard. Tests: `discardHygiene.test.tsx` (P1a-8, hash rule).
- [x] Mute can't delete (T15 slice) · *PR / verified by:* PR #101, commit 9165049. A placed Sound whose events are not in the performance being optimized (a muted Sound) is pinned: `pinnedPlacements(layout, performance)` in `engine/mapping/placementLocks.ts`, computed in `useAutoAnalysis.generateFull` and passed to both generators. Pins reuse S1a.3's lock path: `pinsToHonour` (known Sounds, minus locked ones) and `fixedPlacements` (locks win) feed seeding, compaction, annealing's mutations and greedy's seeds and hill-climb through the layout's `placementLocks`, every candidate is post-validated against locks and pins, and `withoutPins` then takes the pins out of the candidate's `placementLocks` and re-binds its plan to the cleaned layout, so no lock the user did not set reaches a candidate. `CandidateGenerationSummary.pinnedPlacements` counts them and the Layouts panel says "1 muted Sound kept its pad in every candidate." Learn More's Constraints tab gains "Placed Sounds Stay Placed" (invariant 2; `LearnMoreModal.test.tsx`). Tests: `test/engine/optimization/placedSoundsPinned.test.ts` (beam pose0, baseline/compact, annealing through `generateCandidates`, greedy; a lock and a pin together; the helpers), and the TEST MIDI 1 gate (below).
- [x] Truthful save (T57 slice) · *PR / verified by:* PR #101, commit 9738f81. `useAutoSave` reports `saved` only once a write has committed and only for the state it wrote; an edit during a write stays `unsaved` and is written next; an explicit save waits for the write in flight instead of being dropped (the S1a.2 follow-up); a failed write reports `error` and stays there until a save succeeds; `saveNow` writes nothing when nothing is pending (so Save no longer re-stamps updatedAt). `beforeunload` warns while a save is pending or failed; `pagehide` still flushes. The toolbar's `SaveStatusControl` shows the true state (never a flash on click) and, after a failure, the persistent red chip "Couldn't save · Retry · Export a copy"; `data-save-status` carries the state for helpers. Cmd/Ctrl+S saves now, from inputs too (`useKeyboardShortcuts({ onSave })`). Export (`buildProjectExport`) adds the Composer's localStorage pattern as `composerPattern` beside the stored record, the toast says "Exported · Composer pattern included", and import writes it back under the imported project's id (`parseProjectExport`, `saveSerializedLoopState`); the stored record never carries it. The e2e helper `saveAndReload` now waits for `data-save-status="saved"` (`waitForSaved`) before reloading. Tests: `test/ui/hooks/useAutoSave.test.tsx`, `test/ui/components/SaveStatusControl.test.tsx`, `test/ui/persistence/projectExport.test.ts`, `test/ui/hooks/useKeyboardShortcuts.test.tsx`. Screenshots: `docs/screenshots/S1a.4/` (before/after at 1366 and 1600).
- [x] Migration runner: the ghost-lock migration · *PR / verified by:* PR #101, commit fc7012c. `prune-ghost-locks` (schema 2 → 3; `PERSISTED_SCHEMA_VERSION` is 3) removes, from the Active Layout, the Working/Test Layout, every saved variant and every recovered draft, each lock whose Sound is not on the locked pad, keeps every other lock and changes nothing else; idempotent, behind the S1a.2 backup. Fixture: `test/fixtures/projects/ghost-locks.json` (schema 2; ghosts in all four places). Tests: `migrations.test.ts`, `projectStorageMigration.test.ts`.

**Exit criteria**
- [x] **P1a-7** After Discard, Active holds no lock whose Sound isn't on that pad. After Discard, Promote, Preview or Load, pad fingerConstraints equal the values derived from voiceConstraints. · *PR / verified by:* PR #101. `discardHygiene.test.tsx` "P1a-7": a lock made at a draft-only pad is dropped by Discard while a lock whose Sound is on that pad in Active is kept, and every remaining lock's Sound is on its pad; after Discard (preferences changed during the draft), Promote of a draft with a stale projection, Preview and a candidate Promote (a generated layout with no constraints and a dead lock), Load Draft, a variant Promote and Restore (a variant saved with stale constraints and a dead lock), `fingerConstraints` equal the values derived from `voiceConstraints` and dead locks are gone.
- [x] **P1a-8** A lock toggle marks the analysis stale. A self-drop creates no draft and no history entry. · *PR / verified by:* PR #101. `discardHygiene.test.tsx` "P1a-8": a lock toggle sets `analysisStale` on Active and on a draft, locking and unlocking; a self-drop (and a self-swap) returns the same state from the reducer, and through a real ProjectProvider leaves `canUndo` false, no draft and the analysis fresh, while a real move still records "Place Sound".
- [x] **P1a-9** Generate with a muted, placed Sound keeps its pad in every candidate. · *PR / verified by:* PR #101. TEST MIDI 1 gate `testMidi1Integration.test.ts` "a muted, placed Sound": after Suggest, the least-played Sound is muted through the reducer (its events leave the performance, its pad stays); greedy, beam and annealing Quick each keep it on its pad in every candidate, exactly once, with `placementLocks` `{}` and 0 unplayable events in strict mode. `placedSoundsPinned.test.ts` covers the same for every strategy and for annealing (`useAnnealing`), with a lock and a pin together, and checks each candidate's plan is fresh for its cleaned layout.
- [x] **P1a-10** A mocked IndexedDB write failure shows the red chip and never "Saved". · *PR / verified by:* PR #101. `useAutoSave.test.tsx` "P1a-10": with `saveProjectAsync` rejecting, an edit goes `unsaved` → `saving` → `error` and no status the hook ever reports after the edit is `saved`, through Retry and a further edit, until the store is back; `SaveStatusControl.test.tsx`: the `error` state renders the chip "Couldn't save · Retry · Export a copy" (role alert) with working Retry and Export a copy buttons and no "Saved".
- [x] **P1a-12d** An export/import round trip keeps the Composer pattern. · *PR / verified by:* PR #101. `projectExport.test.ts` "P1a-12d": a project with a draft and a stored Composer pattern is exported (the pattern serialized without playback state), parsed back (`parseProjectExport`), the document is identical, and the pattern written back under a new project id loads with the same lanes, events and config; a project with no pattern exports none, and the stored record never carries `composerPattern`.
- [x] **P1a-13a** A fixture project with ghost locks is migrated only after its backup file exists. The ghost locks are gone, and running the migration again changes nothing. · *PR / verified by:* PR #101. `projectStorageMigration.test.ts` "P1a-13a": loading the ghost-lock fixture writes `putBackup v2` (the untouched record, ghost locks and all) before `putProject v3`; the loaded project's Active, draft, variants and recovered drafts hold no lock whose Sound is not on that pad; a second load writes nothing. `migrations.test.ts`: the fixture has ghost locks in all four places, the step removes exactly those, keeps the valid ones and changes nothing else, a second run changes nothing (and the step is idempotent on its own output), odd shapes pass through.

**Session checks**
- [x] Solver Change Checklist recorded in the PR: pinning muted placed Sounds changes optimizer input for all three methods. · *PR / verified by:* PR #101 description, and: (1) outputs changed: candidates keep every placed Sound with no events in the performance on its pad; `CandidateGenerationSummary` gains `pinnedPlacements`; candidate `placementLocks` carry no pin (only the user's locks), and a candidate's plan is re-bound to the cleaned layout (`layoutBinding.layoutHash`). (2) trace shapes unchanged (`OptimizerMove`, `OptimizationIteration`, `AnnealingIterationSnapshot` untouched). (3) UI consumers: LayoutOptionsPanel shows the pinned note beside the dropped-for-locks note; MoveTracePanel and CandidatePreviewCard unchanged and still rendered (`LayoutOptionsPanel.test.tsx`, C2/C4); CLAUDE.md's PerformanceAnalysisPanel no longer exists. (4) greedy restarts and seeded noise untouched; annealing restarts untouched. (5) seed-0 determinism: the TEST MIDI 1 fixed-seed snapshots are byte-for-byte unchanged (with no muted Sound there are no pins, and the generators take the same path as before). (6) `isProcessing` reset paths untouched (P1a-1f, `generationSummary.test.tsx`). (7) TEST MIDI 1: 0 unplayable and the lock held for all three methods, with and without a muted Sound.
- [x] Full suite before push: `npm run typecheck`, `npm run test:run` (72 files, 901 passed, 2 `runIf` skips), `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` at 1366, 1600 and (C1) 1920: 79 passed (every expected-fail case still fails as documented; this session flips no C-case, so no marker was removed), and the only failures are the two Library screenshot comparisons, which fail in a cloud container against the CI-generated baselines on `main` too (S1a.1 follow-up) and are unrelated to this diff (the Library's empty state is untouched). · *PR / verified by:* PR #101.

#### S1a.5 — Composer data can't be lost

- **Status:** Done (PR #102)
- **Prerequisites:** S1a.2, S1a.3.

**Deliverables**
- [x] Composer data slice (T60, T66, T67) · *PR / verified by:* PR #102. **Tabs:** both drawer tabs stay mounted (`DrawerPanel` in PerformanceWorkspace); the inactive one is `hidden`, `aria-hidden` and `inert`, and the Pattern Composer stays a bottom-drawer tab (invariant 3). The timeline re-measures when shown again (`UnifiedTimeline isVisible`; a hidden container's 0 width is ignored), and the Composer's grid observes whichever container is mounted. **Flush:** the Composer's pending localStorage save and timeline sync are written on Stop, when its tab stops being shown, on pagehide and on unmount; the save/sync effects depend on the pattern (config, lanes, events), not on the playhead, so playback no longer restarts their timers. Opening a project writes nothing (sync starts with the first edit, F9-19). **Notes only:** the Composer syncs through `UPSERT_LANE_SOURCE` with `notesOnly` (lanesReducer): lanes already in the project keep name, colour, mute, solo, group and order, and a sync with the same notes returns the same state (no stale analysis, no undo step; a real change is the undo step "Composer edit"). The Composer shows the project Sound's name, colour, mute and solo; its rename, M and S on a lane that is a Sound dispatch RENAME_SOUND, TOGGLE_MUTE and SOLO_STREAM. **Fingers:** Composer finger edits dispatch SET_VOICE_CONSTRAINT under the lane's project Sound id only, and clearing the field clears it (null); the Composer reads the same entry. The name fallback in `composerLaneIdentity` is gone (S1a.3's follow-up). **Clear:** one undo step "Clear Composer" with the toast "Composer cleared · N notes and M Sounds removed · Undo"; Undo (from the toast, the toolbar or Ctrl+Z) restores the Sounds, pads and preferences through the project history, and the Composer's pattern from memory. The toast's Undo is withdrawn once another step is recorded. Tests: `test/ui/components/WorkspacePatternStudio.test.tsx`, `test/ui/state/composerNotesOnlySync.test.ts`, `test/ui/components/composerLaneIdentity.test.ts`, `test/e2e/composer-data.spec.ts`. Also (S1a.3's follow-up): `MERGE_ASSIGN_PADS` refuses a placement over a locked pad or one that would move a locked Sound, and Mirror refuses a placed preset holding a locked Sound (`test/ui/state/presetPlacementLocks.test.ts`); Learn More's Placement Locks rule says so. Screenshots: `docs/screenshots/S1a.5/` (before/after at 1366 and 1600: rename kept after a Composer edit, the Clear toast, the unverified-fingering flag).
- [x] Migration runner: the preset-fingering migration · *PR / verified by:* PR #102. Composer presets are one global localStorage list, not part of a project, so the store has its own version key and runs `PRESET_MIGRATIONS` (`presetMigrations.ts`) through the same runner: `flag-preset-fingering-unverified` (store version 0 → 1) marks every pad of a stored preset `fingerSource: 'unverified'` (keeping any already recorded as `'preference'`) and changes nothing else; idempotent. The untouched list is written to `pushflow_composer_presets_backup_v0` first; if that write fails, the store is left alone and the flagged list is returned without being saved. Save Preset now records `fingerSource`: `'preference'` for a finger preference, `'unverified'` for the column/index fallback. Placing or mirroring a preset applies only `'preference'` fingering (`presetPadFingerConstraint`); preset cards show "Fingering unverified" and the inspector marks each such pad. Learn More's One Finger Per Sound rule says so. Tests: `test/ui/persistence/presetMigration.test.ts`, `WorkspacePatternStudio.test.tsx` (Save Preset).

**Exit criteria**
- [x] **P1a-11a** A Composer note toggled less than 100 ms before a tab switch survives a reload. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-11a" (toggle, switch tabs at once, save and reload: the project has the note and the Composer shows it); `WorkspacePatternStudio.test.tsx` (the switch, Stop and unmount each write the pending save and sync at once).
- [x] **P1a-11b** Playback continues across the tab switch. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-11b": the transport's time keeps advancing and `isPlaying` stays true with the Composer shown; the Composer's own playback is still running after a trip to the Timeline tab.
- [x] **P1a-11c** With the Timeline tab shown, pressing M does nothing in the Composer. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-11c": with the Composer's Mute button focused before the switch, the hidden Composer can take no focus, and M, Enter and Space leave the Sound unmuted, the lanes unchanged and the history depth unchanged.
- [x] **P1a-12a** A Sound renamed in the Sounds panel keeps its name after a Composer edit. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-12a"; `WorkspacePatternStudio.test.tsx` (name, colour and mute all kept; the Composer shows the project's name); `composerNotesOnlySync.test.ts`.
- [x] **P1a-12b** A Composer finger edit appears in the Sounds panel and can be cleared. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-12b" (L2 typed in the Composer is `voiceConstraints[soundId]` and shows in the Sounds panel; clearing it in the Composer removes both); `WorkspacePatternStudio.test.tsx` (both directions).
- [x] **P1a-12c** Undo after Clear restores the notes, Sounds and pads. · *PR / verified by:* PR #102. `composer-data.spec.ts` "P1a-12c" (the toast's Undo brings back both notes, both Sounds and their pads); `WorkspacePatternStudio.test.tsx` (also preferences, the project Undo path, and the toast's Undo withdrawn after another step).
- [x] **P1a-13b** Presets with invented fingering are flagged unverified, and their fingering is not applied. · *PR / verified by:* PR #102. `presetMigration.test.ts` (the migration flags every old pad, backs up first, is idempotent; `presetPadFingerConstraint` returns nothing for unverified pads); `WorkspacePatternStudio.test.tsx` (Save Preset marks the fallback unverified and a preference as such).

**Session checks**
- [x] Timeline re-measure spec: switch to the Composer, resize the window, switch back, and the ruler width equals the container width. · *PR / verified by:* PR #102. `composer-data.spec.ts` "the timeline re-measures when shown again" (the window is widened while the Composer shows, so the auto-fit width is not held at the timeline's minimum zoom).
- [x] Full suite before push: `npm run typecheck`, `npm run test:run`, `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`. · *PR / verified by:* PR #102; results in the PR description.

### Phase P1b · Stop false verdicts and broken overlays

#### S1b.1 — Honest verdict, shared moment grouping, factor registry ∥ S1a.2–S1a.5

- **Status:** Done (PR #104)
- **Prerequisites:** S0.2.
- **Flips:** C6 and the FeasibilityBadge component test.

**Deliverables**
- [x] Shared moment grouping (T22 base) · *PR / verified by:* PR #104. `groupIntoMoments(items, epsilon = MOMENT_EPSILON)`, `momentKey(startTime, soundIds)` and `summarizeMomentCost(assignments)` live in `src/engine/structure/momentGrouping.ts` and are exported from `@/engine`. The window is anchored at the moment's first note, as in the solvers (a note exactly 25 ms after it stays; anything later starts the next moment); the key is the start time in whole milliseconds plus the sorted, de-duplicated Sound ids. A moment's cost is read once, from one playable note (each carries the whole moment's breakdown), never summed; a moment with an unplayable note is Unplayable, and one with no playable note has no breakdown (cost Infinity) rather than zeros. The Events list (`derivePerformanceMoments`, its Cost column, which now shows ✗ for an unplayable event and adds Alternation to the expanded breakdown), the Event Difficulty Chart (one bar per moment, not per exact timestamp, so a humanized chord is one bar) and the inspector (`findSelectedMoment`, `src/ui/analysis/selectedMoment.ts`) all use it. Tests: `test/engine/structure/momentGrouping.test.ts`; `testMidi1Integration.test.ts` (Greedy, Beam and Annealing Quick plans on TEST MIDI 1).
- [x] FACTOR_META registry (T20 base) · *PR / verified by:* PR #104. `src/ui/analysis/factorMeta.ts`: label, short label, colour (`--factor-*` tokens in index.css), a one-line musician description and polarity for the five DiagnosticFactors, plus `factorsFromBreakdown`. The Selected event card and Learn More's per-event text consume it; the other consumers move in P2 as planned. `--status-ok/warn/bad` (with `-bg` and `-border`) tokens are added and used by the verdict badge (`VERDICT_TIERS`, `src/ui/analysis/verdictTiers.ts`) and the event's own verdict.
- [x] Honest verdict (T07, T15 scope line) · *PR / verified by:* PR #104. FeasibilityBadge takes its level from the verdict, or from counts only when they prove Infeasible (unplayable > 0) or Degraded (hard > 0); otherwise it reads "Unknown · No analysis yet", or "Unknown · Analysing…" while a run is in flight, never "Feasible". Both analysis panels (Costs: PerformanceCostsPanel; Layouts: ActiveLayoutSummary) keep the whole-layout verdict, ergonomics and difficulty pinned when an event is selected, and show the selected event in a separate "Selected event" card (`SelectedEventCard.tsx`): "Event N · bar.beat", its own Easy/Medium/Hard/Unplayable level, the note count, its cost "counted once for the event", and all five factors from FACTOR_META including Alternation; an event with a note that can't be played shows "✗ Unplayable · N of M notes can't be played" instead of bars. Every verdict (both badges, the no-analysis badge in both panels, and the event card) carries a scope line from `analysisScopeLine`: "Analysing 5 of 7 Sounds · 2 muted · 1 not on the grid". Tests: `test/ui/components/FeasibilityBadge.test.tsx`, `test/ui/components/selectedEventVerdict.test.tsx`, `test/ui/analysis/analysisScope.test.ts`, `test/e2e/c6-false-feasible.spec.ts`. Screenshots: `docs/screenshots/S1b.1/`.
- [x] False claim fix · *PR / verified by:* PR #104. `claimsLowOverallDifficulty` (greedyCandidatePipeline.ts) replaces `plan.score < 5`: the claim needs a score of at least `COMFORTABLE_PLAN_SCORE` (80, the UI's "Comfortable" band, now shared by `ui/analysis/planScore.ts`), nothing Hard or Unplayable, and the best score among the finalists (strictly above at least one). Tests: `test/engine/optimization/candidateExplanation.test.ts` (the old rule's case, a score of 3, no longer claims it); `testMidi1Integration.test.ts` "P1b-7".
- [x] Learn More sync, including lock enforcement for Greedy, Beam and Annealing (see P1a-14) · *PR / verified by:* PR #104. The engine now exports the lists its solvers use: `CONSTRAINT_RULE_NAMES` (the rule names the feasibility checks report; `ConstraintRuleName` is derived from it) and `OPTIMIZER_METHOD_KEYS` with `OPTIMIZER_METHOD_LABELS` (`OptimizerMethodKey` is derived from it). Learn More's `LOCK_ENFORCING_METHODS` and its Enforcement paragraph are rendered from the method list; the Cost Factors tab gains a Verdicts section rendered from `VERDICT_TIERS` (the badge's list), with copy explaining "Unknown", the scope line, and per-event cost ("counted once for the event, never once per note") naming the FACTOR_META labels. Test: `test/ui/components/LearnMoreModal.test.tsx` "Learn More sync (P1b-8)".

**Exit criteria**
- [x] **P1b-2a** C6 flipped: an Infeasible or Degraded layout with any moment selected never renders "Feasible", and a layout with no analysis renders "Unknown". · *PR / verified by:* PR #104. `c6-false-feasible.spec.ts` (markers removed; both cases pass at 1366 and 1600, and the Selected event card shows); `selectedEventVerdict.test.tsx` selects every note of every event of a 4-of-7 TEST MIDI 1 beam analysis and both panels' badges stay Infeasible with their scope line; `FeasibilityBadge.test.tsx` (the `it.fails` case is now a plain test: no verdict and no counts renders "Unknown", as do zero counts alone).
- [x] **P1b-2b** C6: a 3-note moment and a 1-note moment with the same breakdown report the same cost. · *PR / verified by:* PR #104. `momentGrouping.test.ts` "P1b-2b"; `testMidi1Integration.test.ts` "P1b-2b" (every playable note of each moment carries the same cost in every Greedy, Beam and Annealing Quick candidate, and `summarizeMomentCost` reads exactly that cost).
- [x] **P1b-2c** C6: groupIntoMoments unit tests cover the epsilon boundary and chords, and momentKey is stable across re-analysis. · *PR / verified by:* PR #104. `momentGrouping.test.ts` (exactly-epsilon stays, just past splits, anchoring, chords and humanized chords, order independence, quantised keys); `testMidi1Integration.test.ts` "P1b-2c" (every candidate of all three methods groups into the performance's own momentKeys).
- [x] **P1b-7** The lowest-scoring candidate of a TEST MIDI 1 run never carries "low overall difficulty". · *PR / verified by:* PR #104. `testMidi1Integration.test.ts` "P1b-7" (greedy, the app's path); `candidateExplanation.test.ts` for the rule itself, since on TEST MIDI 1 the old rule never fired (all scores 85–95).
- [x] **P1b-8** The Learn More sync test passes, and a scope line appears on every verdict surface. · *PR / verified by:* PR #104. `LearnMoreModal.test.tsx` "Learn More sync (P1b-8)" (every registered method, every solver rule name, every verdict tier, per-event cost with FACTOR_META labels); `FeasibilityBadge` requires a `scope` prop, and `selectedEventVerdict.test.tsx` checks the scope line on both badges and the event card.

#### S1b.2 — One dialog/popover primitive; pad menu at the cursor ∥ S1a.2–S1a.5

- **Status:** Done (PR #105)
- **Prerequisites:** S0.2.
- **Flips:** C1.

**Deliverables**
- [x] Dialog/Popover primitive (T06), with PadContextMenu, the enlarged chart, View all, Compare and Learn More migrated · *PR / verified by:* PR #105, commit 8ef23ba. `components/shared/Overlay.tsx`: `Dialog` (backdrop, `role="dialog"`, `aria-modal`, `aria-labelledby`) and `Popover` (`role="menu"`, opened at a point and clamped inside the viewport by `clampToViewport`, 8 px margin). Both portal to `<body>`, move focus in, trap Tab, close on the first Escape (a window capture-phase listener that stops the key there, so the editor's own Escape never also runs) and on a press outside, and return focus to `returnFocusTo` or else to whatever was focused when they opened, if still in the document. Open overlays form a stack in the order they opened, and only the newest reacts. `onClose` is read through a ref ("stable onClose"). `SELECT_EVENT` with the current selection returns the same state. Pads get `tabIndex={-1}`, a visible focus outline and `aria-label` "Row 4, column 3, Kick" (the grid's own 0-based row/column numbers); the pad menu returns focus to the right-clicked pad. Migrated: PadContextMenu (menu items `role="menuitem"`), the enlarged Event Difficulty Chart (`chart-dialog`), View all (`view-all-dialog`), Compare (`compare-dialog`; every state, including "Not enough layouts to compare", has a heading, a Close button `compare-close` and Escape) and Learn More (`learn-more-dialog`). Tests: `test/ui/components/Overlay.test.tsx` (portal, roles, first Escape, outside press, focus trap, focus return, topmost-only, clamping); `test/e2e/overlays.spec.ts` (one case per migrated overlay at 1366 and 1600: portalled with dialog semantics and a label, the first Escape closes it and focus returns to its trigger; Tab stays inside Learn More; View all also closes on an outside press; Compare's Close button). Screenshots: `docs/screenshots/S1b.2/`.

**Exit criteria**
- [x] **P1b-1** C1 flipped at 1366x768, 1600x1000 and 1920x1080: for all 64 pads, the menu's top-left is within 4 px of the cursor or the menu is clamped fully inside the viewport, and 12/12 items are clickable. The first Escape closes it, and focus returns to the pad. · *PR / verified by:* PR #105. `c1-pad-menu.spec.ts`, all markers removed: 9/9 (three cases × chromium-1366, -1600 and -1920; `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test c1`).

**Session checks**
- [x] The first Escape closes every migrated overlay, with a spec per migrated overlay. (Compare's Escape and Close are also part of P1b-3b, owned by S1b.3.) · *PR / verified by:* PR #105. `overlays.spec.ts` (Learn More, enlarged chart, View all, Compare), 8/8 at 1366 and 1600; the pad menu in C1.

#### S1b.3 — Compare evaluates Active properly; per-layout analysis cache ∥ S1a.3–S1a.5

- **Status:** Done (PR #105)
- **Prerequisites:** S1a.1, S1b.2.
- **Flips:** the S1b.3 C7 cases.

**Deliverables**
- [x] Compare stop-gap and analysis cache (T08 slice) · *PR / verified by:* PR #105, commit fa1cf0f. **Cache.** `ui/analysis/analysisCache.ts`: `getAnalysisForLayout(key, compute)` with key `(layoutHash, performanceHash, costToggles, evaluatorId)`, an in-memory LRU capped at 16 (`ANALYSIS_CACHE_CAPACITY`) that serves a hit, joins a solve already in flight for the same key, and never caches a failure. `performanceHash` covers the events (key, Sound, pitch, time, duration, velocity) and the settings that change a plan (engine config, instrument, sections), so a mute or a tempo change is a new key. It lives in the module: never in project state, undo history or storage. **One analysis path.** `ui/analysis/analyzeLayout.ts` holds the auto-analysis solve (fast beam, width 15, finger preferences as soft constraints, then difficulty and tradeoff), moved unchanged out of `useAutoAnalysis`, which now calls it and stores each result in the cache (`rememberAnalysis`). `ui/analysis/layoutAnalysis.ts`: `analysisKeyFor(state, layout)`, `analyseLayoutCached`, and `useLayoutAnalysis(layout)` (the project's own fresh plan, else the cache, else a solve through it; `analysing` / `ready` / `error` / `empty`). **Compare.** The Active side uses `useLayoutAnalysis(activeLayout)`; while it runs, the Active card reads "Analysing Active…", and a failed solve reads "Couldn't analyse the Active Layout" with the error; the zero stub is gone. **Compare set.** `ui/state/compareSet.ts`: `liveCompareIds` drops ids of candidates that no longer exist (deleted, promoted, replaced by Generate) and Active while it has no pads; `canCompare` needs two layouts with different hashes. The workspace derives the set from the ticks, prunes the stored ticks to it, disables the toolbar and panel Compare buttons below two distinct layouts, and closes an open Compare that falls below. Promote inside Compare closes it with the toast "Promoted #N … to Active Layout". Tests: `test/ui/analysis/analysisCache.test.ts`, `test/ui/state/compareSet.test.ts`, `test/e2e/c7-compare.spec.ts`, `overlays.spec.ts` "Promote inside Compare closes it with a toast". Screenshots: `docs/screenshots/S1b.3/`.

**Exit criteria**
- [x] **P1b-3a** C7 flipped: with a differing draft, the Active side shows real pads and metrics, or "Couldn't analyse". · *PR / verified by:* PR #105. C7 "with a differing draft, the Active side shows its real fingering and score", marker removed, passes at 1366 and 1600.
- [x] **P1b-3b** C7: no self-compare exists after delete or promote, and every Compare state closes with Escape and with a Close button. · *PR / verified by:* PR #105. C7 "Escape closes Compare", "after promoting…" and "after deleting…" (markers removed, 1366 and 1600); `compareSet.test.ts` (delete, promote, two ids naming one layout); `overlays.spec.ts` (Close button; Escape returns focus).
- [x] **P1b-3c** C7: a second request for the same hash is served from the cache without re-solving, and cache use leaves storage unchanged. · *PR / verified by:* PR #105. `analysisCache.test.ts`: a second request calls `compute` once; a solve in flight is joined; each key part makes a new entry; LRU cap; failures not cached; on TEST MIDI 1 `analyseLayoutCached` twice runs `analyzeLayout` once, and the project document, `localStorage` and `Storage.setItem` are untouched.

#### S1b.4 — Moment view, input safety and preset stop-gaps

- **Status:** Done (PR #105)
- **Prerequisites:** S1a.3, S1a.5, S1b.2.
- **Flips:** C5, C8, and the S1b.4 C9 cases.

**Deliverables**
- [x] Moment-view stop-gaps (T09, T10, T61 slices), with Learn More's onion-skin text · *PR / verified by:* PR #105, commits 9a3a79e and 5ed1883. InteractiveGrid: the inline `opacity` (0.2 / 0.92) is gone and opacity comes only from classes; the inline `boxShadow` now carries the ring states (impossible, instance, drag, shared) as layers, so no glow hides a ring; pads no longer animate opacity (a 100 ms fade made the first frames after Play look greyed). With an event selected, pads not in the selected, next or (onion) previous event dim to 45% with no desaturation; the onion ghost (dotted outline, `data-testid="onion-previous"`) draws on occupied previous-event pads too. While playing, the selection overlay (selected, next, previous, shared, impossible, dimming and arrows) is suspended, and it returns on Stop. `SELECT_EVENT` while stopped moves the playhead to the event; while playing it leaves the playhead alone. ←/→ (`useKeyboardShortcuts`) and ↑/↓/j/k (EventsPanel) do nothing while playing, and ↑/↓ also ignore a focused select and an open dialog or menu. Learn More's "Onion view" text says what ships. Tests: `c5-onion-skin.spec.ts`, `c8-selection-playback.spec.ts`, `test/ui/state/selectEventPlayhead.test.ts`. Screenshots: `docs/screenshots/S1b.4/`.
- [x] Finger input safety (T19 slice) · *PR / verified by:* PR #105. `FingerAssignmentInput`: on a solver suggestion the field opens empty with the suggestion as a faint placeholder; the user's own preference opens selected, ready to retype or clear. Blur or Escape without typing changes nothing; Enter on invalid input keeps the field open, red, `aria-invalid`, with "L1–L5 or R1–R5" (`role="alert"`); blur then discards it. Tests: `test/ui/components/inputSafety.test.tsx`; the Composer finger tests (P1a-12b) still pass.
- [x] Delete scoping (T28 slice) · *PR / verified by:* PR #105. The Delete/Backspace branch of `useKeyboardShortcuts` is removed. The pad menu's Remove and the pad's × go through `hooks/useRemovePadWithUndo.ts`: "Removed Kick from [3,3] · Undo", withdrawn once Undo would revert something else. Tests: `inputSafety.test.tsx` "Delete scoping" and "Remove from pad says so, with Undo".
- [x] Preset safety (T65 slice), refuse-first · *PR / verified by:* PR #105. The grid's dragover answers `copy` for a preset drag (the card allows only `copy`), so drop fires. The drop handler is read through a ref, and `ui/state/presetDrop.ts` (`resolvePresetDrop`) validates against the layout at drop time, in order: every pad's lane resolves by id to a project Sound (the lane's project Sound, else a Sound with the lane's id; never name or pitch), else "This preset's Sounds aren't in this project. Mapping them to your Sounds comes in a later release."; bounds, recorded hand zones and empty pads ("Can't drop the preset here: pad [4,5] is occupied."); none of its Sounds already on another pad; no lock disturbed. A refusal is a toast with the reason and places nothing; a placement is one undo step ("Place preset") with the Sound's own name and colour. `MERGE_ASSIGN_PADS` refuses, whole, a pad another Sound occupies. Every card has a visible "⟷ Mirror" toggle (`aria-pressed`; disabled with a reason for two-hand presets), and a mirrored drop is validated as mirrored. Save Preset records hand and finger only from a finger preference and leaves them blank (`null`) otherwise, so `PresetPad.hand`/`finger` are nullable; blank pads are not "unverified", a preset with no recorded hand can be mirrored (columns flip) and shows no L/R badge. Learn More's One Finger Per Sound rule says so. Tests: `test/ui/state/presetDrop.test.ts`, `test/ui/state/presetPlacementLocks.test.ts`, `WorkspacePatternStudio.test.tsx` (Save Preset), `c9-presets.spec.ts`.

**Exit criteria**
- [x] **P1b-4a** C5 and C8 flipped: the onion toggle changes grid pixels. · *PR / verified by:* PR #105. `c5-onion-skin.spec.ts`, marker removed; 12/12 over 6 repeats at 1366 and 1600.
- [x] **P1b-4b** C5/C8: with a moment selected, pads struck during Play match the control's luminance and chroma, and Stop restores the selection overlay. · *PR / verified by:* PR #105. C8 first case, marker removed: 0 greyed frames while playing and the overlay back after Stop; 12/12 over 6 repeats at 1366 and 1600.
- [x] **P1b-4c** C5/C8: ArrowRight during playback neither seeks nor selects the t=0 moment. · *PR / verified by:* PR #105. C8 second case, marker removed, 1366 and 1600.
- [x] **P1b-5a** C9 flipped using a real native drag (Playwright dragTo), not a synthetic keydown: drops on occupied or mirror-invalid pads are refused with a reason. · *PR / verified by:* PR #105. C9 "dropping a preset on empty pads places its Sounds" and "a drop overlapping an occupied pad is refused with a reason" (dragTo; markers removed, 1366 and 1600); `presetDrop.test.ts` (occupied, off-grid, Sound already placed).
- [x] **P1b-5b** C9: a Mirror toggle set before dragging is honoured. · *PR / verified by:* PR #105. C9 "a Mirror toggle set before dragging is honoured" (marker removed); `presetDrop.test.ts` "honours mirror".
- [x] **P1b-5c** C9: no drop creates a pad whose voice isn't a project Sound. · *PR / verified by:* PR #105. C9 "a preset whose Sounds are not in this project is refused and places nothing" (marker removed; the message is visible); `presetDrop.test.ts`.
- [x] **P1b-5d** C9: saved presets contain no invented fingering. · *PR / verified by:* PR #105. C9 "Save Preset leaves fingers blank" (marker removed); `WorkspacePatternStudio.test.tsx` (a preference is recorded as such, a pad without one is blank).
- [x] **P1b-6** Opening and blurring the finger field without typing leaves voiceConstraints unchanged (T19). Delete with a moment selected and no pad selected removes nothing (T28). · *PR / verified by:* PR #105. `inputSafety.test.tsx` (blur and Escape call nothing; Delete and Backspace through a real ProjectProvider leave the pads and the selection as they were).

### Phase P2 · Quick wins you can see

#### S2.1 — Measured grid, reachable transport, full-width timeline

- **Status:** In progress (claude/pushflow-ui-phase-2-9f7372)
- **Prerequisites:** S1b.2.

**Deliverables**
- [x] Measured grid (T04) · *PR / verified by:* commit 399c910. `transform: scale` and `GRID_NATURAL_SIZE` are gone. `workspace/gridSizing.ts`: `padSizeFor(width, height)` picks the largest integer pad from 32 to 72 px whose grid fits the measured region: the pads and their 4 px gaps, the row-number axis, the column numbers, the hand-zone labels, a 13 px hardware frame and a fixed 36 px state-bar slot above it. `useMeasuredPadSize` observes the region through a callback ref (measured in a layout effect, so the first paint is already sized) and sets state only when the integer changes, so the grid can't feed back into its own measurement. InteractiveGrid takes `padSize`: pads, column and zone labels and the transition-arc and debugger overlays follow it. The overlay and column numbers now line up with the pads; the old row label's margin put the pads 4 px to their right. Label sizes stay fixed; note and position labels and empty-pad coordinates hide below 40 px. The role-badge row is a fixed `state-bar-slot` (never scaled; P3's state bar fills it) that also holds the transition preview, so selecting an event no longer resizes the grid. The ambient glow layers and the backdrop-blurred double frame are gone: one frame (`grid-frame`) hugs the matrix, and `.push-grid-shadow` is removed from index.css. **Drawer:** the Timeline \| Composer drawer (`bottom-drawer`) fits the timeline's content (`timelineContentHeight`: toolbar, ruler and every lane), capped at 40% of the centre column, and never takes the room the grid needs for 32 px pads (`drawerSizing.ts`). `DrawerSplitter` (role separator): drag to resize, double-click to fit the content again, ↑/↓ by 16 px, Enter to collapse; a chevron in the tab bar collapses and expands too. The height and the collapsed state are remembered per viewer in localStorage (`pushflow:drawer`, try/catch). Collapsed, the drawer keeps its tab bar, so the Pattern Composer tab is still one click away (invariant 3; a tab click reopens the drawer), and both panels are inert. Tests: `test/ui/components/gridSizing.test.ts` (fit, clamp, 1366 default, drawer cap and minimum, remembered prefs with blocked or odd storage), `test/e2e/measured-grid.spec.ts`. Screenshots: `docs/screenshots/S2.1/` (before/after at 1366 and 1600 with TEST MIDI 1 suggested; the collapsed drawer and the "More" menu at 1366).
- [x] Transport reach (T05, T56) · *PR / verified by:* commit 399c910. `TimelineToolbar.tsx`: one 44 px row. The transport cluster (Play/Stop, Return, position, Speed, Loop, Metronome, Hits) has fixed widths (`TRANSPORT_WIDTHS`) and is always shown; + MIDI, the Sound count, zoom and "Clear loop" follow in that priority order while they fit the measured width (`fitSecondaryControls`) and go into a "⋯" popover (the S1b.2 Popover: first Escape, outside press, focus return) otherwise. At 1366×768 all four are in the menu; at 1600×1000 + MIDI and the count stay inline. CLICK and SOUND are Metronome and Hits, RESET is Return, "▶ PLAY" is Play/Stop, all in sentence case with icons. Loop, Metronome and Hits are toggles with aria-pressed and a filled or outlined look, a second cue besides colour. Tests: `measured-grid.spec.ts` (every control hit-tested at its centre and clicked; the menu opens with the zoom slider and closes on Escape), `gridSizing.test.ts` (fitting).
- [x] The timeline fills its width (T50) · *PR / verified by:* commit 399c910. UnifiedTimeline keeps its scroll container as state through a callback ref, so the ResizeObserver attaches whenever the container mounts, including when the first import replaces the empty state. The old effect depended only on `[totalDuration]`, so an import that left the default 4-bar duration unchanged never measured. Regression fixture: `test/fixtures/midi/four-bars-120.mid` (4 bars at 120 BPM, one "Groove" track with kick, snare and hats, generated with @tonejs/midi).

**Exit criteria**
- [x] **P2-1** At 1366x768 and 1600x1000 with default panels, Playwright bounding boxes put all 64 pads, the hand-zone labels and the state-bar slot inside the viewport. Pads are at least 32 px at 1366, and every transport button is clickable. · *PR / verified by:* `measured-grid.spec.ts` "all 64 pads, the hand-zone labels and the state-bar slot are fully visible; pads are at least 32 px" (every box inside the viewport and inside every overflow-clipping ancestor; pads 34 px at 1366 and 51 px at 1600, integer and identical) and "every transport control is inside the viewport and clickable" (each control hit-tested at its centre, then clicked and its effect read from state), both at 1366 and 1600. Against main's src the first fails with 21 clipped elements at 1366 (rows 7 and 0, the zone labels, the badge) and 5 at 1600, and the grid is CSS-transformed.
- [x] **P2-2** After importing a 4-bar clip at 120 BPM, the ruler width equals the container width (regression spec). · *PR / verified by:* `measured-grid.spec.ts` "after importing a 4-bar clip at 120 BPM, the ruler is as wide as its container" (within 1 px) at 1366 and 1600. Against main's src the ruler is 244 px narrower than its container at 1366.

**Session checks**
- [x] Full suite before push. · *PR / verified by:* `npm run typecheck`; `npm run test:run` (87 files, 1029 passed, 4 `runIf` skips); `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` at 1366, 1600 and (C1) 1920: 119 passed, 2 failed. The two failures are the Library screenshot comparisons, which differ from the CI baselines in a cloud container on main too (S1a.1 follow-up); this session doesn't touch the Library. C1 (all 64 pads at three sizes), C3's real drags, C5's pixels, C9's preset drops and composer-data's timeline re-measure all pass on the new geometry.

#### S2.2a — Tell Sounds apart

- **Status:** In progress (claude/pushflow-ui-phase-2-9f7372)
- **Prerequisites:** S1b.1; Q3 (recorded above).
- **Decisions:** Q3 (default names from the track or file name plus a letter; the GM action is opt-in).

**Deliverables**
- [x] Distinct Sounds (T17 slice) · *PR / verified by:* commit 855bea0. **Colour.** `utils/soundPalette.ts`: `SOUND_PALETTE`, 16 hues. The first seven are Okabe–Ito without black (colour-blind-safe, pairwise CIEDE2000 ≥ 21.7). The other nine were each picked as the candidate farthest from every colour before it, among colours with at least 3:1 contrast on the dark panels (all 16 pairwise ≥ 17.9). The same values are the `--sound-1` … `--sound-16` tokens in index.css. `nextSoundColors` gives new Sounds the palette colours not yet used in the project, in order, so a second import continues where the first stopped. New lanes are `colorMode: 'overridden'` (the Sound's own colour, so joining a group doesn't repaint it). Only the import path changed: no migration, and stored colours are never touched. **Names (Q3).** `import/soundNaming.ts`: `defaultSoundNames` names a file's Sounds from the file ("TEST MIDI 1 A" … "G") or, in a multi-track file, from each track (a one-pitch track is "Kick", a busier one "Perc A", "Perc B"); a one-pitch file takes the file's name; letters continue past names the project already has ("TEST MIDI 1 H" on a second import). `parseMidiProject` now records each track's name and per-pitch note counts (`MidiProjectData.tracks`), and its `voices` use the same names and palette instead of note names ("C-2 (0)"). **Name from GM drum map.** `utils/gmDrumMap.ts` (GM percussion 35–81 in short names: Kick, Snare, Closed Hat …) and the reducer action `APPLY_GM_DRUM_NAMES`: every Sound with a GM pitch takes its drum's name ("Kick (2)" when a name would repeat; a Sound already so named keeps it), through `RENAME_SOUND` so every copy follows; one dispatch, so one undo step, "Name from GM drum map"; nothing to rename returns the same state (no step). Offered in the new post-import toast ("Imported 7 Sounds from TEST MIDI 1", with the action only when a Sound has a GM pitch) and in the new Sounds panel header (disabled with a reason otherwise). **Pads.** `analysis/padLabels.ts`: pads drop the whole words every Sound's name starts with ("TEST MIDI 1 A" → "A") and cut what's left in the middle ("Clos…Hat") to fit two lines from 40 px pads, one below; the full name stays in the tooltip and accessible name. **Rename.** A hover pencil (also shown on keyboard focus), double-click, or F2/Enter on the now-focusable name starts a rename; Enter or Tab keeps it and moves on to the next Sound in the order shown, Shift+Tab to the previous; Escape changes nothing. **Invariant 5:** pitch drives neither names nor placement; bottomLeftNote is untouched. Tests: `test/import/soundNaming.test.ts`, `test/ui/state/distinctSounds.test.ts`, `test/ui/analysis/padLabels.test.ts`, `test/ui/components/soundRename.test.tsx`, `test/e2e/distinct-sounds.spec.ts`. Screenshots: `docs/screenshots/S2.2a/` (before: seven amber "TES…" pads; after: seven colours, pads "A" … "G").

**Exit criteria**
- [x] **P2-3** A TEST MIDI 1 import gives 7 pairwise-distinct colours (CIEDE2000 > 20) and 7 distinct visible pad labels, and no note names appear unless "Name from GM drum map" was used. Existing projects' custom colours are unchanged. · *PR / verified by:* `distinct-sounds.spec.ts` "TEST MIDI 1: 7 distinct colours, 7 distinct visible pad labels, no note names" at 1366 and 1600 (pairwise CIEDE2000 > 20 with chroma-js; the 7 pad labels visible, distinct, untruncated; no note name or "(pitch)" in any Sound name, Sounds-panel name or pad label); "Name from GM drum map, from the import toast …" (four-bars-120: Kick, Snare, Closed Hat, then one Undo restores all three). Against the pre-S2.2a code the first fails with "TEST MIDI 1 1 #f59e0b vs TEST MIDI 1 2 #f59e0b: expected > 20, received 0". `distinctSounds.test.ts` "opening a project saved before S2.2a keeps every custom colour and name" (the S1a.1 `saved-by-main.json` fixture round-trips unchanged).

**Session checks**
- [x] Full suite before push. · *PR / verified by:* `npm run typecheck`; `npm run test:run` (91 files, 1057 passed, 4 `runIf` skips); Playwright at 1366, 1600 and (C1) 1920: 124 passed, 3 failed. The failures were the two Library screenshot comparisons (cloud-container baseline mismatch, S1a.1 follow-up) and C1's "all 12 items … are clickable" at 1366 on pad [0,0], where the new import toast covered the bottom of the pad menu. Popovers now sit above toasts (see Deviations); C1 and `overlays.spec.ts` then passed 19/19 at 1366, 1600 and 1920.
- [x] The TEST MIDI 1 gate still passes, with snapshots re-keyed by the new names only. · *PR / verified by:* `testMidi1Integration.test.ts` 34 passed (4 `runIf` skips); its 3 fixed-seed snapshots were regenerated and are byte-identical to the previous ones once "TEST MIDI 1 N" is read as the N-th letter (checked by script), so every pad, score and hand count of Greedy, Beam and Annealing Quick is unchanged and 0 events are unplayable.

#### S2.2b — Readable names, notation and text

- **Status:** In progress (claude/pushflow-ui-phase-2-9f7372)
- **Prerequisites:** S1b.1; Q7 (recorded above).
- **Decisions:** Q7 (labels say "Event" and "notes"; "moment" only in explanations).

**Deliverables**
- [x] Readable references and one meaning for "event" (T20, T23) · *PR / verified by:* commit 5293a9c. **Factors.** Every factor label and colour comes from FACTOR_META: CostBreakdownBars (the ergonomics rows and "Main burden", which read "transition, gripNaturalness"), EventCostChart (its layers were hand-written hex, with the Alternation and Hand balance colours swapped relative to the bars), EventsPanel's per-event breakdown ("Finger Pref", "Hand Balance"), CandidatePreviewCard's top cost driver ("Stretch", "Balance"), SettingsGear's cost toggles (their names now come from `COST_FAMILY_FACTOR`, and `TOGGLE_LABELS` is gone from types/costToggles.ts), Compare's tradeoff bars (`TRADEOFF_DIMENSIONS`: Playability, Compactness, Hand balance, Movement, "out of 100 · higher is better"), and Learn More, whose Cost Factors list and overview tiles render from FACTOR_META (the older list had "Grip Quality", "Repetition", "Hard Constraints" and swapped colours). The trace shows no factor names. `test/ui/analysis/factorMetaGrep.test.ts` greps src/ui and src/types for the old names, hand-written label lists and, on the eight surfaces that draw factors, the factor hex values. **Names, not ids.** `shared/SoundLabel.tsx` (chip + name; an id that names no Sound reads "a removed Sound"): Compare's layout differences ("Affected sounds: lane_1790…" before), the limits and relaxed-rules lists under the layout summary, and the preset inspector ("a removed lane"). Candidate strategies read as words (`analysis/strategyLabels.ts`: "pose0-offset-1" → "Natural hand pose, shifted 1 row"). **Diffs.** `analysis/layoutDiff.ts` counts Sounds moved by unique Sound id and pads changed by unique pad key: Compare reads "6 Sounds moved (9 pads changed)" (it read "9 voices moved" for the same pair) and lists each moved Sound "R4 C4 → R4 C3"; finger-only changes read "N pads re-fingered". **Events and notes (Q7).** `analysis/momentCounts.ts` counts Easy/Medium/Hard/Unplayable per event (moment) through the P1b `groupIntoMoments`, the same for Beam (whose plans count notes) and Greedy (moments): the layout summary's Events, Hard and Unplay tiles, the Costs tab, Compare's cards, the verdict line ("All 32 events play with natural grips", "22 of 48 notes can't be played", "Playable, with 2 hard events"; `verdictSummary`) and the engine's "What is limiting this layout" text (difficultyScoring.ts: "16 events can't be played (22 notes)", where it read "22 event(s) classified as Unplayable" for 16 events). The Events list's note count reads "3" with the tooltip "3 notes struck together" instead of "3n".
- [x] Musical notation (T43 slice) · *PR / verified by:* commit 5293a9c. `utils/musicalTime.ts`: positions read bar.beat.sixteenth, 1-based, at the project tempo (the transport's position, pill and chart tooltips, the Events list, whose two branches both dropped the sixteenth, and the selected event's Time); a loop reads "Bars 3–4" (a label on the ruler, the Loop and Clear loop tooltips); the transport never reads earlier than the timeline's start; seconds and milliseconds stay in tooltips and the transition Gap. Speed options read "0.75x · 90 BPM". `utils/padPosition.ts`: one 1-based format, "Row 4 · Col 4" (tooltips, the pad menu header, the selected event, toasts, preset-drop reasons, the greedy trace's move descriptions), "R4 C4" in tight rows (Sounds panel, Composer lanes, Compare, transition moves), and "Row 4, column 4" read aloud; the grid's and Compare grid's axes count from 1. Empty pads are blank unless the note or position labels are on.
- [x] Readability floor (T64, T38 and T31 slices) · *PR / verified by:* commit 5293a9c. **Text.** Grid labels (fingers, note and position labels, the remove ×, the Visual Debugger's move deltas, 9 px in SVG), timeline pills (7 px on 15 px pills; now 11 px, at least 18 px wide when labelled, in dark or white text, whichever contrasts more with the pill as seen: at least 4.4:1 on every palette colour), Compare's grid (6–7 px), `.pf-badge` (10 px) and the panels' chevrons are at least 11 px. **Tokens (T38).** tailwind.config.js maps every `--token` colour through `color-mix(in srgb, var(--token) calc(<alpha-value> * 100%), transparent)`, so opacity modifiers work (without one the colour is exactly the token), and the 28 `bg-[var(--token)]/N` classes, which compiled to nothing, use the token names (`bg-accent-primary/80`): Save Variant has its fill again, and the timeline's lane separators, the "Suggest a starting layout" button and the Library's New Project button show their designed colours instead of Tailwind's default grey border. Text in the accent uses `--accent-primary-soft` (15 places); `#2e5bff` stays for fills. **Disabled buttons (T31).** `.pf-btn:disabled` keeps pointer events (its hover styles skip disabled buttons), so a click can't fall through and the tooltip shows; `shared/DisabledReason.tsx` puts the reason next to the button, tied by aria-describedby: Generate ("Import MIDI or build a pattern first"), Compare ("Generate candidates first", "Tick 2 layouts to compare", "The ticked layouts are the same"), Calculate Cost and "Name from GM drum map". Tests: `test/ui/analysis/readableReferences.test.ts`, `test/ui/tokenAlpha.test.ts` (compiles WorkspaceToolbar's classes with Tailwind), `test/e2e/readability.spec.ts`, `test/e2e/readable-names.spec.ts`, Learn More's new sync case. Screenshots: `docs/screenshots/S2.2b/` (the workspace at 1366 and 1600, Compare's details and the empty project at 1366, before and after).

**Exit criteria**
- [x] **P2-4** A DOM audit finds no grid or timeline text node under 11 px. · *PR / verified by:* `readability.spec.ts` "no grid or timeline text is under 11 px" at 1366 and 1600: every visible text node in `grid-region` and `bottom-drawer`, with the default labels, with every grid label on, and with a moment selected (fingers on the pads and the transition preview). Against the pre-S2.2b src it lists the badge at 10 px, the pads' fingers at 10 px, the remove × at 9 px and every pill label at 7 px.
- [x] **P2-8** Compare diff counts: "Sounds moved" is at most the Sound count, and pads changed are counted by unique pad key (the C7 case of "11 voices moved" with 7 Sounds). · *PR / verified by:* `readableReferences.test.ts` "counts each moved Sound once and each changed pad once: the C7 case" (7 Sounds all moved over 9 pads: "7 Sounds moved (9 pads changed)"), plus swaps, placements and identical layouts; `readable-names.spec.ts` reads Compare's summary after a TEST MIDI 1 Generate (Sounds moved ≤ 7) at 1366 and 1600.
- [x] **P2-9** The FACTOR_META grep test passes, and Learn More's factor list renders from FACTOR_META. · *PR / verified by:* `factorMetaGrep.test.ts` (4 cases); `LearnMoreModal.test.tsx` "renders its factor list from FACTOR_META, in order, with the registry's colours".
- [x] **P2-12** Compare, Library and verdict text contain no "lane_" or raw voice ids. · *PR / verified by:* `readable-names.spec.ts` at 1366 and 1600: the verdict, the whole workspace, the Compare dialog (after Generate) and the Library page contain no "lane_" and no current Sound or voice id. Against the pre-S2.2b src Compare lists six "lane_…" ids.

**Session checks**
- [x] Full suite before push. · *PR / verified by:* `npm run typecheck`; `npm run test:run` (94 files, 1084 passed, 4 `runIf` skips); Playwright at 1366, 1600 and (C1) 1920: 135 passed, 2 failed, the two Library screenshot comparisons: the cloud-container mismatch (S1a.1 follow-up) plus this session's intended Library change (the New Project button's border and the accent text), so the baselines are regenerated in CI (`update-snapshots`). C7's and the overlays spec's Compare locator now uses the toolbar button's test id, since the disabled button's title is its reason.
- [x] The TEST MIDI 1 gate still passes. · *PR / verified by:* only strings changed in the engine (the greedy trace's positions, the binding-constraint text); `testMidi1Integration.test.ts` and `greedyOptimizerTrace.test.ts` 47 passed (4 `runIf` skips), snapshots unchanged, 0 unplayable events for every method.

#### S2.3 — Library you can trust; variants worth keeping; guidance and gear cleanup

- **Status:** Not started
- **Prerequisites:** S1a.2, S1b.3.
- **Decisions:** Q1 (a card's thumbnail shows the Working/Test Layout, badged "Draft, not promoted", when it differs from the Active Layout; otherwise it shows the Active Layout, badged "Active layout").

**Deliverables**
- [ ] Library honesty and entry (T52, T51 slices, T53) · *PR / verified by:* —
- [ ] Variants worth keeping (T29) · *PR / verified by:* —
- [ ] Guidance and copy (T44, T56) · *PR / verified by:* —
- [ ] Gear cleanup (T39 slice) · *PR / verified by:* —

**Exit criteria**
- [ ] **P2-5a** Library: cards show BPM, Sound count, bar length, event count, created date and last-opened date from real data. · *PR / verified by:* —
- [ ] **P2-5b** Library: a draft-only project shows its pads. · *PR / verified by:* —
- [ ] **P2-5c** Library: importing a .mid from the Library creates "TEST MIDI 1" with 0 pads placed and bottomLeftNote 36. The demo project opens unplaced. · *PR / verified by:* —
- [ ] **P2-6** Two variants saved in the same minute get distinct names. A renamed variant keeps its name after a reload. Each variant card shows "Scoring..." and then a score. · *PR / verified by:* —
- [ ] **P2-7** Deleting a project and pressing Undo within 10 s restores it with the same id, layouts and variants (T53). · *PR / verified by:* —

#### S2.4 — One input table: shortcuts, Space to play, click-to-place, Composer geometry

- **Status:** Not started
- **Prerequisites:** S2.1, S1b.4.

**Deliverables**
- [ ] Shortcut registry and input table (T61 slice) · *PR / verified by:* —
- [ ] Click-to-place (T62 slice) · *PR / verified by:* —
- [ ] Composer geometry (T69 slice) · *PR / verified by:* —

**Exit criteria**
- [ ] **P2-10** Every input-table row has a passing registry test. Space toggles playback while a button has focus. ArrowDown on a focused select changes the select, not the moment. · *PR / verified by:* —
- [ ] **P2-11** All 7 Sounds can be placed with click-to-place alone (Playwright). · *PR / verified by:* —
- [ ] **P2-13** The Composer's bar-8 line aligns with its cells within 1 px at 1366 and 1600, and enabling Save Preset doesn't move the grid. · *PR / verified by:* —

### Phase P3 · One inspected layout

#### S3.1 — Accessible primitive kit; one scoring yardstick

- **Status:** Not started
- **Prerequisites:** S1b.3, S2.3; Q5 (recorded above).
- **Decisions:** Q5 (getAnalysisForLayout scores every displayed layout with canonicalEvaluator's Playability).

**Deliverables**
- [ ] An accessible primitive kit ships first (T63 part) · *PR / verified by:* —
- [ ] One yardstick (T21 slice) · *PR / verified by:* —

**Exit criteria**
- No roadmap criterion is owned here. P3-4, owned by S3.3, re-checks the second session check below through "Use as my draft".

**Session checks**
- [ ] getAnalysisForLayout returns the same Playability for a layout on the working-layout path and on the candidate path. · *PR / verified by:* —
- [ ] A greedy candidate applied as the draft through today's Preview scores the same before and after, and the variant cards and Compare read that value. · *PR / verified by:* —
- [ ] The new primitives have role/state tests. · *PR / verified by:* —

#### S3.2 — Look without overwriting: inspected layout, role actions, state bar

- **Status:** Not started
- **Prerequisites:** S3.1, S2.1, S2.4, S1a.2, S1b.4; Q4 (recorded above).
- **Flips:** the S3.2 C2 case.
- **Decisions:** Q4 (candidate A is auto-inspected read-only after Generate, even on an empty grid).

**Deliverables**
- [ ] inspectedLayout selector · *PR / verified by:* —
- [ ] After a run, candidate A is auto-inspected read-only · *PR / verified by:* —
- [ ] Explicit role actions · *PR / verified by:* —
- [ ] Layout-state bar (T03) · *PR / verified by:* —
- [ ] Clean names (T32), with its layout-name migration · *PR / verified by:* —

**Exit criteria**
- [ ] **P3-1** Inspecting Active, every candidate and every variant 20 times in a row leaves the workingLayout hash unchanged. After Generate, the workingLayout hash is unchanged; the grid shows candidate A read-only under the violet bar, and "Back to my draft" shows the untouched draft. Drag, menu, click-to-place and Delete are each blocked while inspecting (one test per path). · *PR / verified by:* —
- [ ] **P3-2** The state bar shows the correct role and name for Active, Working/Test, Candidate and Variant at 1366 and 1600. The Analysis, Events and timeline headers name the same subject. While candidate B is inspected, timeline pill fingering equals B's plan (test). · *PR / verified by:* —
- [ ] **P3-10a** After migration, no stored layout name contains "(draft)" or "(suggested)", and a re-run changes nothing. · *PR / verified by:* —

#### S3.3 — One Promote; Unfinished not failed; fill-in, Compare and Keep

- **Status:** Not started
- **Prerequisites:** S3.2; Q4 (recorded above).
- **Flips:** the S3.3 C7 cache case.
- **Decisions:** Q4 ("Place remaining N" proposes a candidate and never places Sounds); Q5 (Compare reads the same Playability as every other surface).

**Deliverables**
- [ ] Single Promote (T13) · *PR / verified by:* —
- [ ] Freshness rules (T14) · *PR / verified by:* —
- [ ] Unfinished, not failed (T25) · *PR / verified by:* —
- [ ] Explicit fill-in (T37) · *PR / verified by:* —
- [ ] Compare on the cache (T08 full) · *PR / verified by:* —
- [ ] Keep candidates (T30) · *PR / verified by:* —
- [ ] Learn More, part of the P3 item: the Unfinished verdict tier and placed-only scoring · *PR / verified by:* —

**Exit criteria**
- [ ] **P3-3** Bar, card, variant and modal Promote of the same candidate produce an identical activeLayout and plan hash, as one undo step with one toast. · *PR / verified by:* —
- [ ] **P3-4** C7 on the cache: with a differing draft, Active's Playability in Compare equals Active's standalone analysis. A greedy candidate shows the same score before and after "Use as my draft". · *PR / verified by:* —
- [ ] **P3-5** A rename leaves analysisStale false. After a lock toggle, the test awaits a plan whose layoutHash matches the current layout with analysisStale false; there is no wall-clock threshold. Opening the Composer tab changes neither analysisStale nor updatedAt. · *PR / verified by:* —
- [ ] **P3-6** A 3-of-7 layout reads "Unfinished · 3 of 7 placed", and never "Infeasible" unless a placed Sound is unplayable. Its unplaced notes stay visible in the timeline. · *PR / verified by:* —
- [ ] **P3-10c** The Learn More sync test covers the Unfinished tier. · *PR / verified by:* —

#### S3.4 — Generation progress, Cancel and time budget; trace per candidate

- **Status:** Not started
- **Prerequisites:** S3.3.

**Deliverables**
- [ ] Generation progress and time budget (T35) · *PR / verified by:* —
- [ ] Trace follows the candidate (T33 slice) · *PR / verified by:* —
- [ ] Learn More, part of the P3 item: the Lifecycle section and the annealing time limit · *PR / verified by:* —

**Exit criteria**
- [ ] **P3-7a** With an injected clock: Cancel during annealing commits no partial candidates or trace, leaves isProcessing false and sets stopReason "cancelled". · *PR / verified by:* —
- [ ] **P3-7b** With an injected clock: a budget stop returns the best result so far with stopReason "time_budget", every restart having started, and the trace records it. · *PR / verified by:* —
- [ ] **P3-7c** With an injected clock: the iteration budget, not the wall clock, bounds seed-0 test runs, so determinism holds. · *PR / verified by:* —
- [ ] **P3-8** Nightly: deep annealing on TEST MIDI 1 finishes within its budget with 0 unplayable events. · *PR / verified by:* —
- [ ] **P3-9** stopReason is visible for greedy, beam and annealing candidates, and MoveTracePanel renders after promotion. testMidi1Integration.test.ts reports 0 unplayable events, and the seed-0 snapshots are unchanged. · *PR / verified by:* —
- [ ] **P3-10b** The Learn More sync test covers the Lifecycle section. · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR. · *PR / verified by:* —

### Phase P4 · Find it, understand it, rehearse it

#### S4.1 — One identity for each performance event

- **Status:** Not started
- **Prerequisites:** S1a.3, S1b.1; Q7 (recorded above).
- **Decisions:** Q7 (labels read "Event 12 · 3.2.3").

**Deliverables**
- [ ] Single moment identity (T24) · *PR / verified by:* —

**Exit criteria**
- [ ] **P4-1** For all 32 moments of TEST MIDI 1, under both a beam plan and a greedy plan, selecting on any surface highlights the same pads and notes on the grid, list, timeline and chart. The selection survives re-analysis, and clicking any timeline note highlights its whole moment. · *PR / verified by:* —
- [ ] **P4-13** testMidi1Integration.test.ts reports 0 unplayable events after the eventIndex change, with seed-0 snapshots updated only for the index field. MoveTracePanel, CandidatePreviewCard and PerformanceAnalysisPanel are updated and render (PerformanceAnalysisPanel no longer exists; say so in the PR). · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR. · *PR / verified by:* —

#### S4.2 — Moment view, Events list and docked inspector ∥ S4.3a

- **Status:** Not started
- **Prerequisites:** S4.1, S2.4, S3.2.
- **Decisions:** Q7 (Events list, inspector and pad-inspector labels say "Event" and "notes").

**Deliverables**
- [ ] Rebuilt moment view (T09), with Learn More's view-mode text · *PR / verified by:* —
- [ ] Hand tokens and finger notation (T42 part) · *PR / verified by:* —
- [ ] Pad vs moment selection (T28) · *PR / verified by:* —
- [ ] Events list for finding problems (T27) · *PR / verified by:* —
- [ ] Docked moment inspector under the grid (T27) · *PR / verified by:* —

**Exit criteria**
- [ ] **P4-2** The three view modes produce distinct pixel output, and next and previous strikes keep their Sound's colour and name. · *PR / verified by:* —
- [ ] **P4-3a** With a moment selected, Play shows full-intensity pad flashes and the next-finger preview. · *PR / verified by:* —
- [ ] **P4-8** Each Events filter chip shows exactly the matching moments. Prev/Next hard visits every Hard moment in time order and stops at the ends. · *PR / verified by:* —
- [ ] **P4-11a** The updated input-table row "pad click with a moment selected" passes its registry test. · *PR / verified by:* —

#### S4.3a — A DAW-grade transport ∥ S4.2

- **Status:** Not started
- **Prerequisites:** S4.1, S2.1, S2.4.
- **Mode:** solo, so the old audio path stays selectable through a dev-only localStorage switch; record a follow-up to delete it.

**Deliverables**
- [ ] DAW-grade transport (T58), lifted into a workspace-level service (T60 part) · *PR / verified by:* —

**Exit criteria**
- [ ] **P4-5a** Loop off stops at the end. · *PR / verified by:* —
- [ ] **P4-5b** The opening chord sounds on every loop repeat (OfflineAudioContext test). · *PR / verified by:* —
- [ ] **P4-5c** Scheduler timing error is under 2 ms against a fake clock. · *PR / verified by:* —
- [ ] **P4-5d** Dragging the loop from the bar-2 line to the bar-4 line gives exactly 2.1.1–4.1.1. · *PR / verified by:* —
- [ ] **P4-6** Switching to the Composer tab mid-playback leaves time advancing and pads flashing. · *PR / verified by:* —
- [ ] **P4-9a** The P2 timeline-width spec still passes after the transport lift. · *PR / verified by:* —

#### S4.3b — Current moment, Rehearse and count-in

- **Status:** Not started
- **Prerequisites:** S4.3a, S4.2.
- **Decisions:** Q7 (Rehearse and current-event labels say "Event").

**Deliverables**
- [ ] Current moment and Rehearse (T10) · *PR / verified by:* —
- [ ] Keyboard completion (T61, T43) · *PR / verified by:* —
- [ ] Practice aids (T59 part): the count-in · *PR / verified by:* —

**Exit criteria**
- [ ] **P4-3b** Stop restores the selected moment. · *PR / verified by:* —
- [ ] **P4-3c** After pausing mid-song, the grid shows the playhead's moment, not a blank grid. · *PR / verified by:* —
- [ ] **P4-4** "Rehearse" on a Hard row starts, after a 1-bar count-in, a loop whose bounds sit on bar lines and contain the moment. · *PR / verified by:* —
- [ ] **P4-9b** At 1366x768, with the inspector and transport bars shown, all 64 pads are at least 32 px and inside the viewport. · *PR / verified by:* —
- [ ] **P4-11c** The updated input-table row "←/→ while playing" passes its registry test. · *PR / verified by:* —

#### S4.4 — Mute is audio-only; practice aids; Rehearse view

- **Status:** Not started
- **Prerequisites:** S4.3b.
- **Cuts:** the volume popover, audition and the hands filter are kept.

**Deliverables**
- [ ] Audition vs analysis (T15, T16), with the mute-as-exclusion migration · *PR / verified by:* —
- [ ] Practice aids (T59 part): the volume popover, audition and the Hands filter (kept) · *PR / verified by:* —
- [ ] Rehearse view (F7-03) · *PR / verified by:* —
- [ ] Learn More, the P4 item (S4.2 already updates the view-mode text) · *PR / verified by:* —

**Exit criteria**
- [ ] **P4-7a** A muted pad can be dragged and dropped. · *PR / verified by:* —
- [ ] **P4-7b** Soloing lights Solo, and Unmute works while another Sound is soloed. A unit table covers audible = anySolo ? soloed : !muted. · *PR / verified by:* —
- [ ] **P4-7c** Muting changes no verdict, score or fingering. Excluding does, and the scope line says so. · *PR / verified by:* —
- [ ] **P4-7d** Muted and excluded streams stay in the timeline (invariant 4). · *PR / verified by:* —
- [ ] **P4-7e** "Hands: L" leaves Playability unchanged (in scope: the hands filter is kept). · *PR / verified by:* —
- [ ] **P4-10** The Rehearse view hides and restores both side panels without changing any analysis value. · *PR / verified by:* —
- [ ] **P4-11b** The updated input-table row "Alt-click audition" passes its registry test (in scope: audition is kept). · *PR / verified by:* —
- [ ] **P4-12** The mute-as-exclusion migration runs once after its backup, and re-running it changes nothing. · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR: generation keeps excluded Sounds pinned. · *PR / verified by:* —

### Phase P5 · Sounds, import and projects you can trust

#### S5.1 — One soft finger-preference control; a real Sounds panel; drag feedback

- **Status:** Not started
- **Prerequisites:** S4.2, S3.3.
- **Decisions:** Q4 (the Sounds panel's "Place remaining N" is S3.3's candidate-producing action).

**Deliverables**
- [ ] Unified soft preference control (T19 full) · *PR / verified by:* —
- [ ] Sounds panel (T45, T17 rest) · *PR / verified by:* —
- [ ] Drag feedback (T46 core) · *PR / verified by:* —

**Exit criteria**
- [ ] **P5-1** Voice-ID round-trip tests pass for clone, promote, variant save, discard and export/import. A finger preference set in any panel appears in the others within one render. · *PR / verified by:* —
- [ ] **P5-2** With no user preference set, FingerAssignmentInput shows the solver suggestion at reduced opacity and never uses the "(XX)" format. · *PR / verified by:* —
- [ ] **P5-3** While groups exist, ungrouped Sounds sit under "Ungrouped", and a test asserts "On grid" never appears as a section label. The "To place" and "On grid" filter counts match the grid. · *PR / verified by:* —

#### S5.2 — Import review, Replace/Remove source files, place presets by mapping

- **Status:** Not started
- **Prerequisites:** S1b.4, S2.2a, S1a.2; Q3 (recorded above).
- **Decisions:** Q3 (review rows default names per Q3; pitch appears only as provenance text).

**Deliverables**
- [ ] Import review sheet (T48) · *PR / verified by:* —
- [ ] Source files and Replace (T47) · *PR / verified by:* —
- [ ] Place preset (T65 mapping slice) · *PR / verified by:* —

**Exit criteria**
- [ ] **P5-4** A preset from another project, dropped and mapped to 3 existing Sounds, places exactly those Sounds on the grid as one undo step, and creates no new voice. · *PR / verified by:* —
- [ ] **P5-5** Re-importing the same file offers Replace. Replace keeps pad placements and voice ids for matching Sounds and creates no duplicates, and the timeline still shows every stream. · *PR / verified by:* —

#### S5.3 — Notes in beats, so tempo changes keep the bar grid

- **Status:** Not started
- **Prerequisites:** S1a.2; Q6 (recorded above).
- **Decisions:** Q6, model (b) (reserve the Composer pattern slot in beats).

**Deliverables**
- [ ] Musical time (T49) · *PR / verified by:* —

**Exit criteria**
- [ ] **P5-6** After a BPM change from 120 to 90, every note keeps its bar.beat label and the analysis re-runs. A migration test converts a pre-P5 project with no change in note positions, and running it again changes nothing. · *PR / verified by:* —

**Session checks**
- [ ] TEST MIDI 1 gate: 0 unplayable events for all three methods, and the seed-0 snapshots are unchanged at the project tempo. · *PR / verified by:* —
- [ ] The S2.1 timeline-width spec passes after a 120 to 90 BPM change. · *PR / verified by:* —

#### S5.4 — Library complete; saves that can't silently collide

- **Status:** Not started
- **Prerequisites:** S2.3, S5.2, S5.3.
- **Decisions and cuts:** Q1 (the reopened-draft banner); compare-and-swap and the cross-tab banner are kept.

**Deliverables**
- [ ] Library complete (T51 rest, T52 rest, T54, T55) · *PR / verified by:* —
- [ ] Save robustness (T57 rest), including revision counters with compare-and-swap and the cross-tab banner (kept) · *PR / verified by:* —
- [ ] Learn More, the P5 item · *PR / verified by:* —

**Exit criteria**
- [ ] **P5-7** Dropping a .mid on the Library opens the review. After confirming, 0 pads are placed and bottomLeftNote = 36. · *PR / verified by:* —
- [ ] **P5-8** A kill 200 ms after Promote still persists the Promote. If compare-and-swap ships (it does: the cut is recorded as "keep"), an edit in a second tab raises the banner in the first, and neither tab silently overwrites the other. · *PR / verified by:* —
- [ ] **P5-9** Opening and leaving an unchanged project doesn't move it in "Continue". · *PR / verified by:* —
- [ ] **P5-10** With the network blocked, no icon ligature text appears in the Library. The hero fits the first screen at 1366x768, and the /validator, /temporal-evaluator and /optimizer-debug routes still load. · *PR / verified by:* —

### Phase P6 · One cost story

#### S6.1 — One headline score; honest charts; "Reading your results"

- **Status:** Not started
- **Prerequisites:** S3.2, S1a.3, S5.3; Q5 (recorded above).
- **Decisions:** Q5 (the headline is "Playability 0–100, higher = easier" from canonicalEvaluator).

**Deliverables**
- [ ] Canonical headline (T21) · *PR / verified by:* —
- [ ] Honest charts (T40) · *PR / verified by:* —
- [ ] Learn More "Reading your results" (T41) · *PR / verified by:* —

**Exit criteria**
- [ ] **P6-1** One layout shows the same Playability integer in the state bar, Analysis, its Layouts row and Compare. Greedy and beam plans of the same layout show the same number. · *PR / verified by:* —
- [ ] **P6-9** A test checks that Learn More's "Reading your results" lists exactly the FACTOR_META entries and the headline definition. · *PR / verified by:* —

#### S6.2 — Everything measured against the Active Layout; Compare says what changed

- **Status:** Not started
- **Prerequisites:** S6.1, S3.3.
- **Decisions:** Q5 (delta chips against Active use the same Playability).

**Deliverables**
- [ ] Baseline-aware Layouts list (T26) · *PR / verified by:* —
- [ ] Compare "What changed" (T26) · *PR / verified by:* —
- [ ] Diversity honesty (T36) · *PR / verified by:* —

**Exit criteria**
- [ ] **P6-2a** Unit test: candidate diversity is computed against state.activeLayout. · *PR / verified by:* —
- [ ] **P6-2b** Unit test: a pure-translation candidate is filtered out. · *PR / verified by:* —
- [ ] **P6-2c** Unit test: a short set shows the "little room" note. · *PR / verified by:* —
- [ ] **P6-3** Draft vs Active and Variant vs Candidate can be compared, and every displayed change equals B − A of the displayed numbers. · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR: the diversity baseline is an engine input. · *PR / verified by:* —

#### S6.3 — Generate in musician terms; weighting on the Analyze side; complete trace

- **Status:** Not started
- **Prerequisites:** S6.1, S3.4.

**Deliverables**
- [ ] Generate options (T34) · *PR / verified by:* —
- [ ] Custom weighting on the Analyze side (T39 rest), with its Learn More update · *PR / verified by:* —
- [ ] Complete trace (T33 full) · *PR / verified by:* —

**Exit criteria**
- [ ] **P6-4** All three methods can be picked from Advanced (registry test). Two seed-0 runs give identical candidates, and testMidi1Integration reports 0 unplayable events for every method. · *PR / verified by:* —
- [ ] **P6-5** For Greedy, Beam and Annealing, costTogglesUsed equals the toggles passed (test). Any method that ignores a toggle is labelled so in Advanced. · *PR / verified by:* —
- [ ] **P6-6** A DOM test finds the weighting toggles and Re-analyse in the Analysis header and none of them in the Generate popover. A toggle change marks the analysis stale, re-runs it and shows "Custom weighting". · *PR / verified by:* —
- [ ] **P6-7** Generate's time estimates come from recorded telemetry (a test fails on a hard-coded duration string). · *PR / verified by:* —
- [ ] **P6-8** MoveTracePanel renders the greedy trace, the annealing sparkline renders for annealing runs, and stopReason shows for all methods. · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR: costToggles are passed to all three methods. · *PR / verified by:* —
- [ ] Learn More's Constraints tab lists the active weighting and any method that ignores it, method and option names match Advanced, and the sync test covers both. · *PR / verified by:* —

### Phase P7 · Workspace by job

#### S7.1 — Consolidate the workspace

- **Status:** Not started
- **Prerequisites:** S6.1, S6.2, S6.3, S4.2, S4.3b, S5.1, S5.2.
- **Mode and cuts:** solo, so no flag: ship from a short-lived branch with the one-time "What moved" popover.

**Deliverables**
- [ ] Workspace consolidation (T38) · *PR / verified by:* —

**Exit criteria**
- [ ] **P7-1** At 1440x900, pads are at least 56 px, each side panel defaults to at most 320 px, and the first candidate row is visible without scrolling. At 1366x768 the first candidate row is still visible. · *PR / verified by:* —
- [ ] **P7-4** Exactly one primary-styled Promote exists in the DOM (in the state bar), and candidate rows and Compare still offer a secondary Promote. · *PR / verified by:* —
- [ ] **P7-5a** The CLAUDE.md rules still hold: the timeline fills its width, shows all streams, uses "L2" pills and selects the whole moment on click. · *PR / verified by:* —
- [ ] **P7-5b** The CLAUDE.md rules still hold: MoveTracePanel is reachable. · *PR / verified by:* —
- [ ] **P7-5c** The CLAUDE.md rules still hold: the Pattern Composer tab is in the bottom drawer of PerformanceWorkspace. · *PR / verified by:* —

#### S7.2 — Tokens, primitives and readability sweeps

- **Status:** Not started
- **Prerequisites:** S7.1, S5.2.

**Deliverables**
- [ ] Raw-hex sweep (T42 rest) · *PR / verified by:* —
- [ ] Primitive sweep (T63) · *PR / verified by:* —
- [ ] Readability sweep (T64 rest) · *PR / verified by:* —

**Exit criteria**
- [ ] **P7-2** axe-core finds 0 critical or serious violations in the Library, each workspace tab, Compare, Learn More and the import review. Tabs have role=tab and aria-selected, and Tab never lands on an invisible control. · *PR / verified by:* —
- [ ] **P7-3** An automated scan at 1366x768 finds 0 visible text nodes under 11 px and 0 interactive targets under 24 px (documented exceptions only). The raw-hex ban test passes. · *PR / verified by:* —

### Phase P8 · The Composer joins the project

#### S8.1 — Composer patterns saved, undoable and bound to Sounds

- **Status:** Not started
- **Prerequisites:** S5.1, S5.2, S5.3, S1a.5; Q6 (recorded above). If S7.1 is in flight, merge it first.
- **Decisions:** Q6, model (b) (named patterns in beats and preset placement records live in the project; the drawer header states the model).

**Deliverables**
- [ ] Composer state in the project (T67), with the localStorage-pattern migration · *PR / verified by:* —
- [ ] Sound-bound lanes (T66 full) · *PR / verified by:* —
- [ ] Composer model per Q6 (T68) · *PR / verified by:* —

**Exit criteria**
- [ ] **P8-1** Composer edits survive a tab switch, a reload and an export/import round trip. One Ctrl+Z reverts one note toggle, together with the timeline. Undo after Clear restores the notes, Sounds and pads, including after a reload. · *PR / verified by:* —
- [ ] **P8-2** A Composer-backed Sound renamed in the Sounds panel keeps its name through later Composer edits. A Composer finger edit is cleared from the Sounds panel and stays cleared. · *PR / verified by:* —
- [ ] **P8-7** The Pattern Composer tab is still in the bottom drawer of PerformanceWorkspace (invariant 3 test), no BPM control exists in the Composer (invariant 8), and the voice-ID round-trip tests pass. · *PR / verified by:* —
- [ ] **P8-8** The localStorage-pattern migration runs once after its backup, and re-running it changes nothing. · *PR / verified by:* —

#### S8.2 — Insert patterns into the timeline; Composer on the shared transport

- **Status:** Not started
- **Prerequisites:** S8.1, S4.3a, S5.2.
- **Flips:** the S8.2 C9 cases.
- **Decisions:** Q6, model (b) ("Add to timeline at bar…" inserts a pattern into the one timeline).

**Deliverables**
- [ ] Insert pattern (T65 full) · *PR / verified by:* —
- [ ] Composer on the shared transport (T60 full) · *PR / verified by:* —
- [ ] Learn More, the P8 item · *PR / verified by:* —

**Exit criteria**
- [ ] **P8-3a** The C9 scenarios pass end to end: a preset inserted into another project through the mapping step binds to project Sound ids. · *PR / verified by:* —
- [ ] **P8-3b** C9 end to end: a drop on occupied pads is refused with a reason. · *PR / verified by:* —
- [ ] **P8-3c** C9 end to end: a mirrored drop respects the mirror. · *PR / verified by:* —
- [ ] **P8-3d** C9 end to end: the placed pads survive later Composer edits. · *PR / verified by:* —
- [ ] **P8-3e** C9 end to end: the notes appear on the timeline at the chosen bar. · *PR / verified by:* —
- [ ] **P8-4** Composer Play produces audio and pad flashes at the project tempo, and a drawer-tab switch doesn't interrupt it. · *PR / verified by:* —

#### S8.3 — Sequencer basics and a fully keyboard-operable grid (optional)

- **Status:** Not started
- **Prerequisites:** S8.1 (sequencer basics); S2.4 and S4.2 (keyboard grid).
- **Cuts:** do, so this session is in scope.

**Deliverables**
- [ ] Sequencer basics (T70, T69 rest) · *PR / verified by:* —
- [ ] Full keyboard grid (T62 full) · *PR / verified by:* —

**Exit criteria**
- [ ] **P8-5** If the sequencer basics ship (they do): 1/16 is the default, a velocity edit persists and undoes in one step, and at bar 16 the bar lines align with cells within 1 px at 1366 and 1600. · *PR / verified by:* —
- [ ] **P8-6** If the keyboard grid ships (it does): all 7 TEST MIDI 1 Sounds can be placed, moved and swapped by keyboard alone, Space still toggles playback with a pad focused, and axe finds 0 critical violations on the grid. Every updated input-table row passes its registry test. · *PR / verified by:* —

## 3. Criterion → session

Every exit criterion of every phase in [UI_ENHANCEMENT_ROADMAP.md](UI_ENHANCEMENT_ROADMAP.md#phases), each owned by exactly one session. The rules, in order: the session prompt's "Done when" names it; otherwise it goes to the session whose deliverable it tests; if it needs work from two sessions, it goes to the later one. Tick criteria in section 2, not here.

Basis: **Done when** means the owner's "Done when" names it. **Inferred** means no "Done when" names it. **Split** means different sessions own parts of one roadmap criterion. **Also claimed** means a second prompt claims it too.

### P0

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P0-1 | CI turns red for a failing typecheck, unit test and e2e spec | S0.1 | Done when |
| P0-2 | e2e passes twice with identical screenshots, remote fonts blocked | S0.1 | Done when |
| P0-3 | C1–C9 exist as test.fail specs failing for the documented reason; no React internals in test/ | S0.2 | Done when |
| P0-4 | FeasibilityBadge component test and Library axe smoke spec run | S0.1 | Done when |
| P0-5 | TEST MIDI 1 gate: three methods, strict 0 unplayable, lock case, seed-0 snapshots, fixtures, no pitch-keyed Map | S0.2 | Inferred: S0.2's "Done when" says only "the corresponding P0 exit criteria"; its deliverable |
| P0-6 | Nightly deep annealing reports its duration | S0.2 | Inferred: its deliverable; later of S0.1 (creates nightly.yml) and S0.2 |
| P0-7 | No window.__pf in dist/ | S0.1 | Done when |

### P1a

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P1a-1a | Place 3 Sounds, Undo 3 times: empty grid | S1a.1 | Done when |
| P1a-1b | One Undo after Suggest restores the pre-Suggest grid | S1a.1 | Done when |
| P1a-1c | After Generate, Undo keeps candidates and trace and undoes the previous user edit | S1a.2 | Also claimed: S1a.1's "Done when" owns an interim version, which S1a.2's prompt rewrites; later session |
| P1a-1d | Undo during playback keeps playing | S1a.1 | Done when |
| P1a-1e | A reopened project starts with an empty history | S1a.1 | Done when |
| P1a-1f | isProcessing is false after success and error | S1a.1 | Done when |
| P1a-2a | C2: draft hash unchanged after Generate; no APPLY_GENERATION_TO_LAYOUT dispatch | S1a.2 | Done when |
| P1a-2b | C2: an edit made during a run is kept | S1a.2 | Done when |
| P1a-2c | C2: the draft is recoverable after Preview, card click, Load Draft and both Promotes, even after a reload | S1a.2 | Done when |
| P1a-3 | A user variant stays visible after 5 auto-keeps; Recovered drafts deduped, capped at 5, with a notice | S1a.2 | Done when |
| P1a-4 | Generate on an empty grid leaves the draft empty | S1a.2 | Done when |
| P1a-5a | C3: a lock at [7,0] holds for all three methods; placementLocks non-empty | S1a.3 | Done when |
| P1a-5b | C3: drags onto and out of a locked pad are refused | S1a.3 | Done when |
| P1a-5c | C3: TEST MIDI 1 has 0 unplayable events for every method | S1a.3 | Done when |
| P1a-5d | C3: seed 0 identical twice; trace shapes unchanged | S1a.3 | Done when |
| P1a-6 | An unplaced Sound sharing a pitch stays unmapped; no Composer lane matches by pitch | S1a.3 | Done when |
| P1a-7 | No ghost locks after Discard; fingerConstraints re-derived after Discard, Promote, Preview and Load | S1a.4 | Done when |
| P1a-8 | A lock toggle marks analysis stale; a self-drop creates no draft or history entry | S1a.4 | Done when |
| P1a-9 | A muted placed Sound keeps its pad in every candidate | S1a.4 | Done when |
| P1a-10 | A mocked write failure shows the red chip, never "Saved" | S1a.4 | Done when |
| P1a-11a | A Composer note toggled under 100 ms before a tab switch survives a reload | S1a.5 | Done when |
| P1a-11b | Playback continues across the tab switch | S1a.5 | Done when |
| P1a-11c | M does nothing in the Composer while the Timeline tab shows | S1a.5 | Done when |
| P1a-12a | A rename survives a Composer edit | S1a.5 | Done when |
| P1a-12b | A Composer finger edit shows in the Sounds panel and can be cleared | S1a.5 | Done when |
| P1a-12c | Undo after Clear restores notes, Sounds and pads | S1a.5 | Done when |
| P1a-12d | An export/import round trip keeps the Composer pattern | S1a.4 | Inferred: its Truthful save deliverable exports the pattern with a round-trip test |
| P1a-13a | The ghost-lock migration runs only after its backup and is idempotent | S1a.4 | Done when |
| P1a-13b | Presets with invented fingering are flagged unverified and not applied | S1a.5 | Done when |
| P1a-14 | Learn More's Constraints section lists lock enforcement for all three methods | S1a.3 | Done when. Also claimed: S1b.1's prompt puts it in the sync test |

### P1b

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P1b-1 | C1: pad menu at the cursor, 12/12 items clickable at three sizes; first Escape closes; focus returns | S1b.2 | Done when |
| P1b-2a | C6: never "Feasible" for an Infeasible or Degraded layout with a moment selected; "Unknown" without analysis | S1b.1 | Done when |
| P1b-2b | C6: 3-note and 1-note moments with the same breakdown cost the same | S1b.1 | Done when |
| P1b-2c | C6: groupIntoMoments tests (epsilon, chords); stable momentKey | S1b.1 | Done when |
| P1b-3a | C7: the Active side is real, or "Couldn't analyse" | S1b.3 | Done when |
| P1b-3b | C7: no self-compare after delete or promote; every Compare state closes with Escape and Close | S1b.3 | Done when. Also claimed: S1b.2's "Done when" covers Compare's first Escape; later session |
| P1b-3c | C7: a repeat request is served from the cache without re-solving; storage unchanged | S1b.3 | Done when |
| P1b-4a | C5: the onion toggle changes grid pixels | S1b.4 | Done when |
| P1b-4b | C8: flashes during Play with a moment selected; Stop restores the overlay | S1b.4 | Done when |
| P1b-4c | ArrowRight during playback neither seeks nor selects t=0 | S1b.4 | Done when |
| P1b-5a | C9: occupied or mirror-invalid drops are refused with a reason | S1b.4 | Done when |
| P1b-5b | C9: a Mirror toggle set before dragging is honoured | S1b.4 | Done when |
| P1b-5c | C9: no drop creates a voice that isn't a project Sound | S1b.4 | Done when |
| P1b-5d | C9: saved presets contain no invented fingering | S1b.4 | Done when |
| P1b-6 | Blurring the finger field changes nothing (T19); Delete with only a moment selected removes nothing (T28) | S1b.4 | Done when |
| P1b-7 | The lowest-scoring candidate never says "low overall difficulty" | S1b.1 | Done when |
| P1b-8 | Learn More sync test passes; a scope line on every verdict surface | S1b.1 | Done when |

### P2

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P2-1 | 64 pads, hand-zone labels and the state-bar slot inside the viewport at both sizes; pads at least 32 px; transport clickable | S2.1 | Done when |
| P2-2 | 4-bar clip: ruler width equals container width | S2.1 | Done when |
| P2-3 | TEST MIDI 1: 7 distinct colours and labels; no note names unless the GM action; custom colours kept | S2.2a | Done when |
| P2-4 | No grid or timeline text under 11 px | S2.2b | Done when |
| P2-5a | Library cards show real BPM, Sounds, bars, events, created and last-opened dates | S2.3 | Done when |
| P2-5b | A draft-only project's card shows its pads | S2.3 | Done when |
| P2-5c | Library .mid import places 0 pads, bottomLeftNote 36; the demo opens unplaced | S2.3 | Done when |
| P2-6 | Variant names distinct and renameable; cards show "Scoring..." then a score | S2.3 | Done when |
| P2-7 | Project delete plus Undo within 10 s restores it | S2.3 | Done when |
| P2-8 | Diff counts: Sounds moved at most the Sound count; pads counted by unique key | S2.2b | Done when |
| P2-9 | FACTOR_META grep test; Learn More's factor list renders from FACTOR_META | S2.2b | Done when |
| P2-10 | Input-table registry tests; Space with a focused button; ArrowDown on a focused select | S2.4 | Done when |
| P2-11 | All 7 Sounds placeable by click-to-place alone | S2.4 | Done when |
| P2-12 | No "lane_" or raw voice ids in Compare, Library or verdict text | S2.2b | Done when |
| P2-13 | Composer bar-8 line aligned within 1 px; Save Preset doesn't move the grid | S2.4 | Done when |

### P3

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P3-1 | Inspecting 20 times leaves the draft hash unchanged; candidate A read-only after Generate; edit paths blocked | S3.2 | Done when |
| P3-2 | State-bar role and name right at both sizes; headers name one subject; timeline fingering follows the inspected plan | S3.2 | Done when |
| P3-3 | Every Promote entry point gives an identical result, one undo step, one toast | S3.3 | Done when |
| P3-4 | C7 on the cache; a greedy candidate scores the same before and after "Use as my draft" | S3.3 | Done when. Also claimed: S3.1's "Done when" checks the same through today's Preview; later session |
| P3-5 | Freshness: rename, lock toggle, Composer tab | S3.3 | Done when |
| P3-6 | A 3-of-7 layout reads "Unfinished"; unplaced notes stay visible | S3.3 | Done when |
| P3-7a | Cancel commits nothing partial; isProcessing false; stopReason "cancelled" | S3.4 | Done when |
| P3-7b | A budget stop returns the best so far with stopReason "time_budget" | S3.4 | Done when |
| P3-7c | The iteration budget bounds seed-0 runs; determinism holds | S3.4 | Done when |
| P3-8 | Nightly deep annealing within budget, 0 unplayable | S3.4 | Done when |
| P3-9 | stopReason visible for all methods; MoveTracePanel after promotion; TEST MIDI 1 gate | S3.4 | Done when (stopReason). The MoveTracePanel clause also needs S3.3's Promote rebinding; later session |
| P3-10a | No "(draft)" or "(suggested)" in stored layout names after migration | S3.2 | Done when; split |
| P3-10b | The Learn More sync test covers the Lifecycle section | S3.4 | Done when; split |
| P3-10c | The Learn More sync test covers the Unfinished tier | S3.3 | Done when; split |

### P4

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P4-1 | One selection on grid, list, timeline and chart for all 32 moments under beam and greedy; survives re-analysis; whole-moment click | S4.1 | Done when |
| P4-2 | The three view modes differ in pixels; next and previous strikes keep colour and name | S4.2 | Done when |
| P4-3a | With a moment selected, Play flashes at full intensity with the next-finger preview | S4.2 | Done when; split |
| P4-3b | Stop restores the selected moment | S4.3b | Inferred: its Current moment and Rehearse (T10) deliverable; split |
| P4-3c | Pausing mid-song shows the playhead's moment | S4.3b | Done when; split |
| P4-4 | Rehearse on a Hard row: count-in, then a bar-aligned loop containing the moment | S4.3b | Done when |
| P4-5a | Loop off stops at the end | S4.3a | Done when |
| P4-5b | The opening chord sounds on every loop repeat | S4.3a | Done when |
| P4-5c | Scheduler error under 2 ms on a fake clock | S4.3a | Done when |
| P4-5d | Loop drag from bar 2 to bar 4 gives 2.1.1–4.1.1 | S4.3a | Done when |
| P4-6 | A Composer tab switch mid-playback keeps time advancing and pads flashing | S4.3a | Done when |
| P4-7a | A muted pad can be dragged and dropped | S4.4 | Done when |
| P4-7b | Solo and Unmute behaviour; the audible truth table | S4.4 | Done when |
| P4-7c | Mute changes no score; Exclude does, with a scope line | S4.4 | Done when |
| P4-7d | Muted and excluded streams stay in the timeline | S4.4 | Done when |
| P4-7e | "Hands: L" leaves Playability unchanged | S4.4 | Done when (in scope: hands filter kept) |
| P4-8 | Events filter chips exact; Prev/Next hard in time order, stopping at the ends | S4.2 | Done when |
| P4-9a | The P2 timeline-width spec passes after the transport lift | S4.3a | Done when; split |
| P4-9b | At 1366x768 with inspector and transport: 64 pads at least 32 px, inside the viewport | S4.3b | Done when; split |
| P4-10 | The Rehearse view hides and restores side panels with no analysis change | S4.4 | Done when |
| P4-11a | Input-table row: pad click with a moment selected | S4.2 | Done when; split |
| P4-11b | Input-table row: Alt-click audition | S4.4 | Done when; split (in scope: audition kept) |
| P4-11c | Input-table row: ←/→ while playing | S4.3b | Done when; split |
| P4-12 | The mute-as-exclusion migration runs after its backup and is idempotent | S4.4 | Done when |
| P4-13 | TEST MIDI 1 has 0 unplayable events after the eventIndex change; trace and card consumers render | S4.1 | Done when |

### P5

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P5-1 | Voice-ID round trips; a finger preference syncs across panels | S5.1 | Done when |
| P5-2 | Solver suggestion at reduced opacity; never "(XX)" | S5.1 | Done when |
| P5-3 | "Ungrouped" label; "On grid" never a section label; filter counts match the grid | S5.1 | Done when |
| P5-4 | A cross-project preset mapped to 3 Sounds places exactly those, as one undo step | S5.2 | Done when |
| P5-5 | Re-import offers Replace, keeps placements and ids, creates no duplicates | S5.2 | Done when |
| P5-6 | 120 to 90 BPM keeps every bar.beat; the migration test is idempotent | S5.3 | Done when |
| P5-7 | A .mid dropped on the Library opens the review; 0 pads placed; bottomLeftNote 36 | S5.4 | Done when |
| P5-8 | Promote survives a kill 200 ms later; cross-tab banner and no silent overwrite | S5.4 | Done when (in scope: compare-and-swap kept) |
| P5-9 | Opening an unchanged project doesn't reorder "Continue" | S5.4 | Done when |
| P5-10 | Icons render offline; the hero fits at 1366x768; developer routes still load | S5.4 | Done when |

### P6

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P6-1 | The same Playability integer in the state bar, Analysis, its row and Compare; greedy and beam agree | S6.1 | Done when |
| P6-2a | Diversity is computed against state.activeLayout | S6.2 | Done when |
| P6-2b | Pure translations are filtered out | S6.2 | Done when |
| P6-2c | A short set shows the "little room" note | S6.2 | Inferred: its Diversity honesty deliverable |
| P6-3 | Draft vs Active and Variant vs Candidate comparable; every change equals B − A | S6.2 | Done when |
| P6-4 | All three methods in Advanced; seed-0 runs identical; TEST MIDI 1 has 0 unplayable events | S6.3 | Done when |
| P6-5 | costTogglesUsed equals the toggles passed; methods that ignore one are labelled | S6.3 | Done when |
| P6-6 | Weighting and Re-analyse only in the Analysis header; a toggle marks stale and re-runs | S6.3 | Done when |
| P6-7 | Time estimates come from telemetry | S6.3 | Done when |
| P6-8 | Trace renders for all methods; stopReason shown | S6.3 | Done when |
| P6-9 | "Reading your results" lists exactly FACTOR_META and the headline definition | S6.1 | Done when |

### P7

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P7-1 | At 1440x900: pads at least 56 px, side panels at most 320 px, first candidate row visible; row also visible at 1366x768 | S7.1 | Done when |
| P7-2 | axe: 0 critical or serious violations on the listed surfaces; tab roles; no invisible tab stops | S7.2 | Done when |
| P7-3 | 1366x768 scan: no text under 11 px, no target under 24 px; raw-hex ban test | S7.2 | Done when |
| P7-4 | Exactly one primary Promote; rows and Compare keep a secondary Promote | S7.1 | Done when |
| P7-5a | Timeline: full width, all streams, "L2" pills, whole-moment click | S7.1 | Done when |
| P7-5b | MoveTracePanel is reachable | S7.1 | Done when |
| P7-5c | The Pattern Composer tab is in the bottom drawer | S7.1 | Done when |

### P8

| ID | Criterion | Session | Basis |
|---|---|---|---|
| P8-1 | Composer edits survive tab switch, reload and export/import; one Ctrl+Z per toggle; Clear's undo survives a reload | S8.1 | Done when |
| P8-2 | Renames and cleared fingers stick through Composer edits | S8.1 | Done when |
| P8-3a | C9: a mapped preset binds to project Sound ids | S8.2 | Done when |
| P8-3b | C9: a drop on occupied pads is refused with a reason | S8.2 | Done when |
| P8-3c | C9: a mirrored drop respects the mirror | S8.2 | Done when |
| P8-3d | C9: placed pads survive later Composer edits | S8.2 | Done when |
| P8-3e | C9: notes appear on the timeline at the chosen bar | S8.2 | Done when |
| P8-4 | Composer Play gives audio and flashes at the project tempo across a tab switch | S8.2 | Done when |
| P8-5 | Sequencer basics: 1/16 default, one-step velocity undo, bar-16 alignment | S8.3 | Done when (in scope: S8.3 "do") |
| P8-6 | Keyboard grid: place, move and swap 7 Sounds by keyboard; Space; axe on the grid; input rows | S8.3 | Done when (in scope: S8.3 "do") |
| P8-7 | Invariant 3 and 8 tests; voice-ID round trips | S8.1 | Done when |
| P8-8 | The localStorage-pattern migration runs after its backup and is idempotent | S8.1 | Done when |

## 4. Phase audits

Filled in by the [Phase audit prompt](UI_IMPLEMENTATION_PROMPTS.md#phase-audit-prompt) after each phase's last session. One row per criterion ID from section 3. Result is pass, fail, pending (waiting on a parallel phase) or cut (cut under the recorded mode or cuts). Evidence is the test, spec, screenshot or CI run (URL, date, duration).

### P0 · Safety net

- Date: 2026-09-24 (audited together with P1a, after S1a.5)
- Commit: 09da4cc (main after PR #102)
- Gates on this commit: `npm run typecheck` clean; `npm run test:run` 76 files, 936 passed, 2 `runIf` skips (112 s); `npm run build` + `npm run check:no-test-hook` OK; `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` (chromium-1366, chromium-1600, and C1 at chromium-1920): 93 passed, 2 failed (4.7 min); the two failures are the Library screenshot comparisons, which differ from the CI-generated baselines in a cloud container on every branch (S1a.1 follow-up) and pass in CI. No expected-fail case passed unexpectedly (C5 included). CI on the same commit: [run 36062756349](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36062756349) (2026-09-24, 3 min 12 s), every job green.

| Criterion | Result | Evidence |
|---|---|---|
| P0-1 | pass | CI-only; cited, not re-run. The three red runs from S0.1 still stand: typecheck [35909391019](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909391019), unit [35909397575](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909397575), e2e [35909402879](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/35909402879) (2026-09-23). ci.yml's jobs are unchanged since (typecheck, unit, build + hook check, e2e ×2 shards all ran in 36062756349). |
| P0-2 | pass | CI-only; cited. Two consecutive main runs green with the committed baselines and Google Fonts aborted by test/e2e/fixtures.ts: [36049874189](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36049874189) (#101 merge, 2026-09-24, 3 min 2 s) and [36062756349](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36062756349) (#102 merge, 2026-09-24, 3 min 12 s). Locally the two Library screenshot comparisons still differ from the CI baselines (known S1a.1 follow-up; not a regression). |
| P0-3 | pass | `grep -rn "__reactFiber\|_reactInternals" test/` finds nothing. C1–C9 specs all exist; the cases P1a owned (C2 except Inspect, C3, C4) have had their markers removed and pass; the remaining `test.fail` cases (C1, C2 Inspect, C5–C9) still fail as documented in the full local run (Playwright's expected-fail counts them as passed). |
| P0-4 | pass | test/ui/components/FeasibilityBadge.test.tsx runs in `test:run` with its `it.fails` "feasible" default case (S1b.1 flips it); test/e2e/a11y-library.spec.ts passes at 1366 and 1600 locally and in CI. |
| P0-5 | pass | `testMidi1Integration.test.ts`: 29 tests (2 `runIf` skips), all green in `test:run` on 09da4cc: greedy, beam and annealing Quick strict 0 unplayable, the [7,0] lock case for all three (no longer `it.fails`, since S1a.3), the muted-Sound case (S1a.4), fixed-seed snapshots unchanged; reads test/fixtures/midi; no pitch-keyed Map (`grep -rn "Map<number, Voice>" src test/engine/optimization` finds nothing). |
| P0-6 | pass | Nightly-only. Re-triggered on 09da4cc by this audit: [36072965133](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36072965133) (workflow_dispatch, 2026-09-24) passed in 49 min 17 s; the deep-annealing job (`npm run test:nightly`) took 48 min 57 s and the Firefox job 3 min. Updated by the P1b audit (2026-09-25), which also re-triggered it on 0a4eee6 ([36093551155](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36093551155); see P1b). |
| P0-7 | pass | `npm run build && npm run check:no-test-hook`: "OK: no window.__pf in dist/" on 09da4cc, and the build job's "No window.__pf in dist/" step in [36062756349](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36062756349). |

### P1a · Stop losing work

- Date: 2026-09-24
- Commit: 09da4cc (main after PR #102)
- Gates: as for P0 above. PWC below means the Playwright spec passed at 1366 and 1600 in the full local run.

| Criterion | Result | Evidence |
|---|---|---|
| P1a-1a | pass | undoHistory.test.tsx "P1a-1a" in `test:run`; C4 case 1 PWC. |
| P1a-1b | pass | undoHistory.test.tsx "P1a-1b"; C4 case 2 PWC. |
| P1a-1c | pass | undoHistory.test.tsx "P1a-1c" (Undo after Generate undoes the prior edit; candidates, moveHistory and iterationTrace unchanged); C4 case 3 PWC. |
| P1a-1d | pass | undoHistory.test.tsx "P1a-1d"; C4 case 4 PWC. |
| P1a-1e | pass | undoHistory.test.tsx "P1a-1e"; C4 case 5 (save and reload) PWC. |
| P1a-1f | pass | undoHistory.test.tsx "P1a-1f" (success and rejection paths); generationSummary.test.tsx. |
| P1a-2a | pass | C2 "Generate leaves the draft unchanged" PWC; the grep and hook tests in generateOnlyProposes.test.tsx. Screenshot `docs/screenshots/audit-P1a/{1366,1600}-02-generate-proposes-lock-held.png` (after Suggest, a lock and Beam Generate the draft is unchanged and the list offers Preview). |
| P1a-2b | pass | test/ui/hooks/generateMidRunEdit.test.tsx (no marker) in `test:run`. |
| P1a-2c | pass | The five C2 recoverability cases (Preview, card body, Load Draft, card Promote, variant Promote, each after a reload) PWC; recoveredDrafts.test.ts. |
| P1a-3 | pass | recoveredDrafts.test.ts "P1a-3"; LayoutOptionsPanel.test.tsx "lists every saved variant". |
| P1a-4 | pass | generateOnlyProposes.test.tsx "P1a-4" (real ProjectProvider on TEST MIDI 1, nothing placed). |
| P1a-5a | pass | C3 greedy, beam and annealing Quick cases PWC (lock at [7,0] held, `placementLocks` non-empty in every candidate); the TEST MIDI 1 gate's lock cases for all three methods in `test:run`; locksHonoured.test.ts; and the nightly deep-annealing lock case (no `it.fails` since S1a.3) passed in [36072965133](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36072965133) (2026-09-24, deep job 48 min 57 s). Updated by the P1b audit (2026-09-25). |
| P1a-5b | pass | C3 drag-onto and drag-off cases PWC; projectStateConstraintSync.test.ts. |
| P1a-5c | pass | testMidi1Integration.test.ts: 0 unplayable in strict mode for greedy, beam and annealing Quick, with and without the lock and with a muted Sound; C3 asserts `unplayable: 0` per candidate PWC. |
| P1a-5d | pass | Fixed-seed snapshots in testMidi1Integration.test.ts.snap unchanged since S0.2 (`git log --oneline -- test/engine/optimization/__snapshots__` shows only #97) and matching on 09da4cc; `AnnealingIterationSnapshot` and `OptimizerMove` fields unchanged (locksHonoured.test.ts). |
| P1a-6 | pass | soundIdentity.test.ts "P1a-6"; composerLaneIdentity.test.ts (no pitch or name match since S1a.5). |
| P1a-7 | pass | discardHygiene.test.tsx "P1a-7". |
| P1a-8 | pass | discardHygiene.test.tsx "P1a-8". |
| P1a-9 | pass | testMidi1Integration.test.ts "a muted, placed Sound" (all three methods); placedSoundsPinned.test.ts. |
| P1a-10 | pass | useAutoSave.test.tsx "P1a-10"; SaveStatusControl.test.tsx (red chip, role alert, Retry, Export a copy). |
| P1a-11a | pass | composer-data.spec.ts "P1a-11a" PWC; WorkspacePatternStudio.test.tsx (flush on switch, Stop, unmount). |
| P1a-11b | pass | composer-data.spec.ts "P1a-11b" PWC. Screenshot `docs/screenshots/audit-P1a/{1366,1600}-03-composer-tab.png`. |
| P1a-11c | pass | composer-data.spec.ts "P1a-11c" PWC. |
| P1a-12a | pass | composer-data.spec.ts "P1a-12a" PWC; composerNotesOnlySync.test.ts. |
| P1a-12b | pass | composer-data.spec.ts "P1a-12b" PWC; WorkspacePatternStudio.test.tsx. |
| P1a-12c | pass | composer-data.spec.ts "P1a-12c" PWC; WorkspacePatternStudio.test.tsx. |
| P1a-12d | pass | projectExport.test.ts "P1a-12d". |
| P1a-13a | pass | projectStorageMigration.test.ts "P1a-13a" (backup written before the v3 record; second load writes nothing); migrations.test.ts. |
| P1a-13b | pass | presetMigration.test.ts; WorkspacePatternStudio.test.tsx (Save Preset). |
| P1a-14 | pass | LearnMoreModal.test.tsx (Constraints tab names Greedy, Beam and Annealing lock enforcement, the dropped-candidate rule, drags, Remove and preset placement refused, Placed Sounds Stay Placed). S1b.1's sync test will take it over. |

**CLAUDE.md rules, checked on 09da4cc (P0 and P1a together)**

- Product Invariants. (1) Desktop-only: no touch handlers; the only responsive classes are the Library grid's `sm:`/`lg:`/`xl:` columns and one `lg:block` in ContinuePracticingHero, both from before the roadmap (bb0360f), so not a P0/P1a regression. (2) Learn More sync: every P1a rule change landed with LearnMoreModal.tsx and LearnMoreModal.test.tsx (locks, identity, pins, Remove/preset refusals, unverified preset fingering). (3) The Composer is a bottom-drawer tab (`drawer-tab-composer`, PerformanceWorkspace.tsx) and is now kept mounted. (4) Timeline completeness: UnifiedTimeline still renders unassigned and Unplayable pills with their own style. (5) bottomLeftNote stays 36 on import (midiImport.ts, useLaneImport.ts). (6) Finger sync: voiceConstraints is the only store the Composer and Sounds panel write (P1a-12b); pad fingerConstraints are re-derived on every layout switch (P1a-7). (7) No automatic layout: Generate places nothing (P1a-2a, P1a-4); Suggest is one undo step (P1a-1b). (8) The Composer uses `projectState.tempo` and has no BPM control.
- Core Functionality Preservation and Do-Not-Regress. Greedy, Beam and Annealing all run in the TEST MIDI 1 gate with 0 unplayable events; seeded snapshots unchanged; greedy restarts and seeded noise, annealing restarts and both trace shapes untouched; `stopReason` still reaches state (`SET_MOVE_HISTORY`); `isProcessing` resets on success and error (P1a-1f); MoveTracePanel still mounted in PerformanceWorkspace. The known gap that toolbar Generate never fills the trace predates P1a and stays with S3.4 (S0.2 follow-up).
- UI Non-Regression. Ungrouped Sounds are labelled "Ungrouped" (VoicePalette, LaneSidebar); the timeline re-measures after a tab switch (S1a.5 spec) and still auto-fits; the other rules are untouched by P0/P1a diffs and covered by the existing e2e specs.
- One-line fixes made by this audit: none needed.

### P1b · Stop false verdicts and broken overlays

- Date: 2026-09-25
- Commit: 0a4eee6 (main after PR #105)
- Gates on this commit: `npm run typecheck` clean; `npm run test:run` 86 files, 1016 passed, 4 `runIf` skips (the two greedy-only TEST MIDI 1 cases, P1b-7 and the explanation-card case, skipped for Beam and Annealing; 99 s); `npm run build` + `npm run check:no-test-hook` OK; `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` (chromium-1366, chromium-1600, and C1 at chromium-1920): 105 passed, 2 failed (5.1 min). The two failures are the Library screenshot comparisons, which differ from the CI baselines in a cloud container (S1a.1 follow-up) and pass in CI. No expected-fail case passed unexpectedly. The only `test.fail` markers left are C2's Inspect case (S3.2) and C9's timeline-insert case (S8.2); there are no `it.fails` left in `test/`. TEST MIDI 1: 0 unplayable events for Greedy, Beam and Annealing Quick, with and without the [7,0] lock and with a muted Sound (`testMidi1Integration.test.ts`, 38 tests). After the one-line fix below: typecheck, `test/ui/components` (10 files, 69 tests) and `c1`, `overlays`, `c7`, `c9` (43 cases at 1366, 1600 and 1920) re-run green.
- CI on the same commit: [run 36088638733](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36088638733) (#105 merge, 2026-09-25, 3 min 25 s), every job green. The previous main run, [36078492198](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36078492198) (#104 merge), was red on e2e shard 1 only: C5's "onion skin changes grid pixels" was still marked expected-fail and passed ("Expected to fail, but passed", the S1a.1/S1a.3 follow-up). S1b.4 fixed C5 and removed the marker in #105, so it isn't a regression.
- Nightly: none of the P1b criteria is nightly-only. But S1b.1 changed engine code (the "low overall difficulty" rule, `COMFORTABLE_PLAN_SCORE`, and the method and rule-name lists), and no nightly had run since #104 and #105, so this audit re-triggered it on 0a4eee6: [36093551155](https://github.com/TGALLOWAY1/PushFlow-Modified/actions/runs/36093551155) (workflow_dispatch, 2026-09-25). Record its result and duration under P0-6 when it finishes.
- Engine check (Solver Change Checklist): P1b's engine diff is `CONSTRAINT_RULE_NAMES` and `OPTIMIZER_METHOD_KEYS`/`_LABELS` (types now derived from the lists), `COMFORTABLE_PLAN_SCORE`, `claimsLowOverallDifficulty` (explanation text only) and `momentGrouping.ts` (new, analysis-only). Greedy, Beam and Annealing solvers, `greedyOptimizer.ts`, `annealingSolver.ts`, `src/engine/solvers/` and MoveTracePanel are untouched since 09da4cc. The seeded snapshots are unchanged (last touched by #97), and trace shapes and `stopReason` are unchanged.
- Screenshots (this audit, `docs/screenshots/audit-P1b/`, 1366 and 1600): `01-pad-menu-at-cursor` (after the fix below), `02-verdict-pinned-selected-event`, `03-onion-skin`, `04-compare-active-analysed`. PWC below means the Playwright case passed at 1366 and 1600 in the full local run.

| Criterion | Result | Evidence |
|---|---|---|
| P1b-1 | pass | `c1-pad-menu.spec.ts`: 3 cases × chromium-1366, -1600 and -1920, all green before and after the fix below. This audit found that the menu opened at the cursor but stretched to the viewport's right edge (630–884 px wide; C1 checks position, clamping and clickability, not width). It is fixed here in one line; see below. Screenshot `{1366,1600}-01-pad-menu-at-cursor.png` (172–175 px wide, top-left at the cursor on [7,7], [0,0] and [4,3]). |
| P1b-2a | pass | C6 both cases PWC (no markers); `selectedEventVerdict.test.tsx`; `FeasibilityBadge.test.tsx` (the "Unknown" case is a plain test). Screenshot `{1366,1600}-02-verdict-pinned-selected-event.png`: with 4 of 7 Sounds placed and event 3 selected, the pinned badge reads Infeasible and the Selected event card shows the event's own Medium level and all five factors. |
| P1b-2b | pass | `momentGrouping.test.ts` "P1b-2b"; `testMidi1Integration.test.ts` "P1b-2b" for Greedy, Beam and Annealing Quick. |
| P1b-2c | pass | `momentGrouping.test.ts` (epsilon boundary, anchoring, chords, humanized chords, stable keys); `testMidi1Integration.test.ts` "P1b-2c" for all three methods. |
| P1b-3a | pass | C7 "with a differing draft, the Active side shows its real fingering and score" PWC. Screenshot `{1366,1600}-04-compare-active-analysed.png` (Active's pads and fingering and real metrics beside candidate #1). |
| P1b-3b | pass | C7 "Escape closes Compare", "after promoting…" and "after deleting…" PWC; `compareSet.test.ts`; `overlays.spec.ts` Compare (Close button, Escape, focus return) and "Promote inside Compare closes it with a toast" PWC. |
| P1b-3c | pass | `analysisCache.test.ts` (7 tests: one `compute` for a repeat, an in-flight solve joined, a new entry for each key part, LRU cap, failures not cached, TEST MIDI 1 solved once with the project document and `localStorage` untouched). |
| P1b-4a | pass | `c5-onion-skin.spec.ts` PWC (no marker). Screenshot `{1366,1600}-03-onion-skin.png` (event 4 selected, onion on: the previous event's pads carry the dotted ghost, uninvolved pads dimmed). |
| P1b-4b | pass | C8 first case PWC (no marker): no greyed frames while playing, overlay back after Stop; `selectEventPlayhead.test.ts`. |
| P1b-4c | pass | C8 second case PWC (no marker). |
| P1b-5a | pass | C9 "dropping a preset on empty pads…" and "a drop overlapping an occupied pad is refused with a reason" PWC (real `dragTo`); `presetDrop.test.ts`. The refusal toast is in `docs/screenshots/S1b.4/after-preset-drop-refused-{1366,1600}.png`. |
| P1b-5b | pass | C9 "a Mirror toggle set before dragging is honoured" and "mirroring a placed preset keeps its pads on the project Sounds" PWC; `presetDrop.test.ts` "honours mirror". |
| P1b-5c | pass | C9 "a preset whose Sounds are not in this project is refused and places nothing" PWC; `presetDrop.test.ts`; `presetPlacementLocks.test.ts`. |
| P1b-5d | pass | C9 "Save Preset leaves fingers blank" PWC; `WorkspacePatternStudio.test.tsx` (Save Preset). |
| P1b-6 | pass | `inputSafety.test.tsx` (blur and Escape change nothing; invalid input flagged; Delete and Backspace with only an event selected leave pads and selection unchanged through a real ProjectProvider; Remove toast with Undo). |
| P1b-7 | pass | `testMidi1Integration.test.ts` "P1b-7" (greedy, the app's path); `candidateExplanation.test.ts` (a score of 3 no longer claims it). |
| P1b-8 | pass | `LearnMoreModal.test.tsx` "Learn More sync (P1b-8)" (every registered method, every solver rule name, every verdict tier, per-event cost with FACTOR_META labels); scope line on both badges and the event card (`selectedEventVerdict.test.tsx`; visible in screenshot 02). |

**CLAUDE.md rules, checked on 0a4eee6**

- Product Invariants. (1) Desktop-only: P1b adds no touch handlers and no responsive classes (`git diff 09da4cc 0a4eee6 -- src` has no `sm:`/`md:`/`lg:`/`xl:` additions). (2) Learn More sync: every P1b metric, verdict and rule change landed with LearnMoreModal.tsx, and the sync test now enforces methods, rule names and verdict tiers. (3) The Composer is still the `drawer-tab-composer` tab in PerformanceWorkspace. (4) Timeline completeness: UnifiedTimeline is untouched by P1b; unplayable pills still render in their own red style (screenshot 02). (5) `bottomLeftNote` stays 36 on import (midiImport.ts, useLaneImport.ts). (6) Finger sync: FingerAssignmentInput still writes only `SET_VOICE_CONSTRAINT` (voiceConstraints); the pad menu still writes pad `fingerConstraints`, which S1a.4 re-derives; T19's single control is S5.1's. (7) No automatic layout: P1b adds no placing path except the explicit preset drop, which is one undo step and refuse-first. (8) The Composer's BPM is read-only `projectState.tempo`.
- Core Functionality Preservation and Do-Not-Regress. See the engine check above. Greedy restarts and seeded noise, annealing restarts, both trace shapes, `stopReason` and `isProcessing` reset are untouched, and MoveTracePanel is still mounted. Greedy, Beam and Annealing give 0 unplayable events on TEST MIDI 1. Multi-candidate generation, diversity filtering and Compare are intact; Compare is stronger (P1b-3a/b).
- UI Non-Regression. Timeline pills show hand+finger ("L2", screenshots 02 and 03). FingerAssignmentInput shows a solver suggestion at 50% opacity when no preference is set, and opens empty with the suggestion as placeholder (no `(XX)` text). The grid's "Show Finger Assignment" path is unchanged. VoicePalette and LaneSidebar still say "Ungrouped", and Cmd/Ctrl+G is unchanged. The Library page is untouched by P1b.
- One-line fix made by this audit: `PadContextMenu.tsx` gets `flex flex-col`. Menu buttons are inline-block, so the portalled menu's shrink-to-fit width was the sum of the ten finger items on one line (about 884 px), clamped only by the viewport. Before S1b.2 the transformed grid wrapper hid this. Now the menu is 172–175 px. See the follow-up for a width assertion.

### P2 · Quick wins you can see

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P3 · One inspected layout

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P4 · Find it, understand it, rehearse it

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P5 · Sounds, import and projects you can trust

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P6 · One cost story

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P7 · Workspace by job

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P8 · The Composer joins the project

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

## 5. Deviations

Record each one with the date, the session, what differs from the roadmap or the session prompt, why, and who approved it.

- **2026-09-23 · S0.1 · Baseline job trigger.** The prompt asks for a workflow_dispatch update-snapshots job. update-snapshots.yml has that trigger and a second one, the `update-snapshots` PR label, because GitHub can only dispatch workflows that are already on main, so the first baselines could not otherwise be made in CI from the PR that adds them. Approved by: none needed (an addition, not a change); flagged in PR #93.
- **2026-09-23 · S0.1 · No 1920×1080 project yet.** The roadmap's 1920×1080 viewport is only for the C1 menu spec, so S0.2 adds it together with that spec rather than S0.1 adding an empty project. Approved by: none needed; flagged in PR #93.

- **2026-09-23 · S0.2 · One PR for both deliverables.** The session's branch is fixed (`claude/pushflow-ui-roadmap-a53q8j`), so the TEST MIDI 1 gate and the C1–C9 specs land as separate commits in one PR rather than two. Approved by: none needed; flagged in PR #98.
- **2026-09-23 · S0.2 · "Seed-0" snapshots pin the pipelines' fixed seeds.** The app's greedy pipeline seeds from 42 + i·7919 and the beam strategies from 42/49/56; there is no seed-0 entry point in the Generate path. The snapshots pin those fixed seeds (the deterministic path the app runs), which is what the criterion protects. Approved by: none needed; flagged in PR #98.
- **2026-09-23 · S0.2 · Annealing "Quick" is the beam path.** In the app, Annealing + Quick calls generateCandidates with optimizationMode 'fast', which runs beam search only (annealing runs only in 'deep'), so the beam and annealing Quick cases exercise the same code. Both are kept so each method the UI offers has its own gate; the annealing solver itself is covered by the nightly deep run.
- **2026-09-23 · S0.2 · C3 greedy uses one strategy; C2's mid-run edit is a hook test.** Greedy with All Strategies (and Coordination alone) blocks the page for minutes in the browser, so the C3 greedy case runs Natural Pose. With an edit made mid-run, even a single-strategy greedy run did not finish within 10 minutes in the browser (see Follow-ups), so "an edit made during a run is kept" runs generateFull inside a real ProjectProvider under happy-dom (test/ui/hooks/generateMidRunEdit.test.tsx) and makes the edit at the run's first yield. The unit gate covers all greedy strategies.
- **2026-09-23 · S0.2 · Two C6 criteria stay in unit/component tests.** "A layout with no analysis renders Unknown" is the FeasibilityBadge component test (S0.1); C7's "served from the cache without re-solving, storage unchanged" is a unit test S1b.3 adds with getAnalysisForLayout. The e2e specs cover the rest.

- **2026-09-24 · S1a.1 · One PR, three commits.** The prompt asks for the slice split and the transaction wrapper as separate PRs. The session's branch is fixed (`claude/pushflow-ui-roadmap-4qzwte`), so they land as separate, ordered commits in one PR (split 97bfab8, wrapper f291b7b, toast 7e58bf8), each passing typecheck and unit tests on its own. Approved by: none needed; flagged in PR #98.
- **2026-09-24 · S1a.1 · The split is by type, not by nesting.** ProjectState is ProjectDocument & ProjectSession with flat fields, not `{ document, session }`, so no consumer changes and state.moveHistory* stays readable as the prompt requires. The field list in projectDocument.ts is the one classification; a compile-time check forces every new document field into it.
- **2026-09-24 · S1a.1 · Toast's first use is Undo/Redo feedback.** The roadmap scopes only the primitive here. To ship it wired, Undo and Redo report through it ("Undone: Discard · Redo"), which is safe (Redo from the toast re-applies exactly that step). Later sessions add their own toasts.

- **2026-09-24 · S1a.2 · One PR.** The session's branch is fixed (`claude/pushflow-ui-roadmap-lzjvda`), so the runner and "Generate only proposes" land as ordered commits in one PR. Approved by: none needed; flagged in PR #99.
- **2026-09-24 · S1a.2 · Candidates also count as "still recoverable".** The roadmap keeps a draft whose hash differs from Active, the incoming layout and every saved variant. A draft equal to a listed candidate is also not kept, so previewing one candidate after another (or Restore after a Preview) doesn't fill Recovered drafts with copies of candidates that are still in the list.
- **2026-09-24 · S1a.2 · Generate selects no candidate.** SET_CANDIDATES used to select candidate #1, which made the grid show it (layoutOverride) over the untouched draft. It now selects none, so "the grid and draft are untouched" holds; the trace panel falls back to the top-ranked candidate's iteration trace until one is previewed, so the trace stays visible after a run. S3.2's auto-inspect replaces this.
- **2026-09-24 · S1a.2 · The backup lives in IndexedDB; the download is manual.** The prompt's "automatic backup export per project" (roadmap wording) is the IndexedDB `backups` store plus the Library's "Download backup" button, as the session prompt specifies ("No automatic file downloads").
- **2026-09-24 · S1a.2 · putProject resolves on commit.** The C2 reload cases lost saves about 1 run in 20. putProject resolved when its put request succeeded, before the transaction committed, and a reload in between aborted it; it now resolves on the transaction's complete event (and the new putBackup does the same). This is one line of S1a.4's truthful save, needed so "survives a reload" is true; the toolbar part stays with S1a.4 (see Follow-ups).
- **2026-09-24 · S1a.2 · saveAndReload waits for the stored record.** The e2e helper reloaded as soon as the toolbar said "Saved", which it says on click, before any write (T57). It now polls IndexedDB until the stored project has the current Sounds, layouts, variants and recovered drafts, then reloads. C2, C4 and C7: 170/170 over 5 repeats at both viewports.
- **2026-09-24 · S1a.2 · C7's setup previews a candidate.** C7 needed Generate to leave a differing draft; it now clicks Preview on candidate #1 after Generate to get one. The C7 cases stay expected-fail for S1b.3/S3.3.

- **2026-09-24 · S1a.3 · One PR, three commits.** The session's branch is fixed (`claude/pushflow-ui-roadmap-0m67ev`), so the engine change, the UI/state change and the tracker land as ordered commits in one PR, each passing typecheck and the unit suite on its own. Approved by: none needed; flagged in the PR.
- **2026-09-24 · S1a.3 · Locks never move with a Sound.** Two S0-era reducer tests asserted that a lock follows its Sound when it is assigned to a new pad or swapped. Under canon section 11 a locked Sound is not moved at all, so those cases now assert the refusal (same state back, no draft, no undo step), and the constraint-sync coverage they carried moved to unlocked Sounds.
- **2026-09-24 · S1a.3 · Pitch stays the identity of a Sound-less event.** The roadmap removes every pitch fallback that matches a Sound to a pad. An event with no Sound at all (no voiceId: engine-only synthetic performances in tests and the debug pages) has nothing but its pitch, so it is still keyed by pitch; in the app every event carries a voiceId, and an event with a voiceId is never resolved by pitch.
- **2026-09-24 · S1a.3 · Ties in seeding order follow the Sounds panel.** Busiest Sound first; among equals, the Sound listed first in the Sounds panel (`voiceHints` order), then first appearance. This is not pitch, and for an imported file (whose Sounds import in pitch order) it reproduces the previous pads exactly, so candidate quality and the TEST MIDI 1 snapshots are unchanged.
- **2026-09-24 · S1a.3 · Greedy is post-validated too.** The roadmap names Beam and Annealing; greedy candidates get the same lock check and the same dropped count, so the list header is truthful for every method.
- **2026-09-24 · S1a.3 · The Composer's name fallback stays until S1a.5.** Only the pitch match was removed from the lane↔pad matching; the lane's project Sound id is now matched first, and the name match remains for pads placed before lanes carried project ids (T66 is S1a.5's).
- **2026-09-24 · S1a.3 · Nightly lock marker removed without a local deep run.** The deep annealing lock case takes about 50 minutes; its marker is removed on the strength of the direct annealing test (restarts, zone transfers, lock held, `placementLocks` carried) and the mutation service never touching a locked pad. The next nightly run confirms it.

- **2026-09-24 · S1a.4 · One PR, five commits.** The session's branch is fixed (`claude/pushflow-ui-roadmap-c44rhy`), so Discard hygiene + freshness, the T15 slice, truthful save, the ghost-lock migration and the Remove refusal land as ordered commits in one PR, each passing typecheck and the unit suite on its own. Approved by: none needed; flagged in the PR.
- **2026-09-24 · S1a.4 · Pins ride in `placementLocks` and are stripped afterwards.** The prompt says to reuse S1a.3's lock pre-placement for muted placed Sounds. Reusing it means the pins travel through seeding, compaction, mutation and hill-climb as entries of the layout's `placementLocks` (every method already keeps those pads), so a finished candidate would carry locks the user never set; `withoutPins` removes them and re-binds the plan to the cleaned layout. A pin is not a lock: Preview shows no lock glyph for a muted Sound, and applying a candidate adds none.
- **2026-09-24 · S1a.4 · Every placed Sound with no events is pinned, not only muted ones.** In the app the only way a placed Sound has no events in the performance is mute; a Composer lane with no notes behaves the same way, which is what "Generate never removes an already-placed Sound" means. The Layouts panel's note still says "muted Sound", the case a user can produce.
- **2026-09-24 · S1a.4 · The list header says how many muted Sounds kept their pads.** T15's "the cards say so" belongs to its later slices; this session adds one line beside S1a.3's dropped-candidates note, so the user can see why a pad is never used by candidates.
- **2026-09-24 · S1a.4 · The Discard toast names preferences only when there are any.** "Draft discarded · Finger preferences kept" when a finger preference exists (Q2), otherwise "Draft discarded"; a toast about preferences the user never set would mislead. Locks dropped by Discard are not announced (they are gone by design, roadmap T12).
- **2026-09-24 · S1a.4 · The Save button stays; the flash and the duplicate label go.** T57's full fix (one passive status next to the project name, revision counters) is S5.4's. Here the control keeps its "Save project" title (the e2e helper and users click it) but its label is the hook's real state, the "Saved" flash on click and the small "saved" label are gone, and the failure chip replaces the button.
- **2026-09-24 · S1a.4 · Export from the editor as well as the Library.** The red chip's "Export a copy" needs an editor-side export; both call the same `exportProjectToFile`, so the Library's export got the "Composer pattern included" toast too.
- **2026-09-24 · S1a.4 · Save writes only when something is pending.** `saveNow` with nothing unsaved and no failed write does nothing, so an idle Save click no longer re-stamps `updatedAt` and reorders the Library (T57's "clicking it re-stamps updatedAt").
- **2026-09-24 · S1a.4 · No deep-annealing (nightly) muted case.** The pinning path is the lock path the nightly lock case already exercises, and `placedSoundsPinned.test.ts` runs annealing through `generateCandidates` (`useAnnealing`, the FAST config) with a pin; a 50-minute nightly case would add nothing.
- **2026-09-24 · S1a.4 · Remove refuses a locked Sound (S1a.3's follow-up).** The S1a.3 follow-up assigned "Remove" here with "ask to unlock first, or refuse"; refusing matches the drag rule (canon section 11) and needs no dialog. The one S0-era test that removed a locked Sound now unlocks it first. `MERGE_ASSIGN_PADS` (preset placement) stays with S1a.5.

- **2026-09-24 · S1a.5 · One PR.** The session's branch is fixed (`claude/pushflow-ui-roadmap-8g2c02`), so the code (tabs and flush, notes-only sync, fingers, Clear, the preset migration and the preset lock refusal, which share WorkspacePatternStudio.tsx) lands as one commit, followed by the tracker and screenshots. Approved by: none needed; flagged in the PR.
- **2026-09-24 · S1a.5 · The preset migration runs on the preset store, not on projects.** The roadmap lists it with the project migrations, but Composer presets are a global localStorage list shared by every project. The store gets its own version key (`pushflow_composer_presets_version`) and backup key and runs its own list through the same runner (`runMigrations`); `PERSISTED_SCHEMA_VERSION` is unchanged. The list stays a bare array, so readers (including C9's spec) are unaffected.
- **2026-09-24 · S1a.5 · Every pre-S1a.5 preset pad is flagged, not only invented ones.** A stored preset does not record where its fingering came from, so pads that were real preferences are flagged too; the user sees "Fingering unverified" and can re-save the preset. From now on Save Preset records the source per pad. Leaving fingers blank at save time (C9's case) stays with S1b.4.
- **2026-09-24 · S1a.5 · The Composer's M, S and rename act on the project Sound.** "Composer sync writes notes only" would leave the Composer's M and S doing nothing for a lane that is already a Sound, so they (and rename) dispatch the project's own actions, and the Composer shows the project's values. A lane with no notes synced yet keeps its own until the first sync.
- **2026-09-24 · S1a.5 · Opening a project never syncs the Composer.** The Composer is now mounted with the project, and it used to sync its stored pattern as soon as it mounted. Sync now starts with the first edit, so loading a project changes nothing (no unsaved flag, no undo step, F9-19).
- **2026-09-24 · S1a.5 · Preset placement refuses locks (S1a.3's follow-up).** The `MERGE_ASSIGN_PADS` half of S1a.3's follow-up is closed by refusing the whole placement, as a drop onto a locked pad is refused; the drop UI already refuses occupied pads. Mirror refuses when the instance holds a locked Sound.

- **2026-09-25 · S1b.1 · One PR.** The session's branch is fixed (`claude/pushflow-ui-roadmap-jqti1q`), so the five deliverables (which share CostBreakdownBars, both analysis panels and the engine barrel) land as one code commit, followed by the tracker and screenshots. Approved by: none needed; flagged in PR #104.
- **2026-09-25 · S1b.1 · Counts alone never prove "Feasible".** The badge used to turn `unplayableCount === 0` into Feasible. Feasible also needs no fallback grips and no broken hand rules, which only the verdict knows, so without a verdict the badge reads Infeasible or Degraded when the counts prove it and Unknown otherwise.
- **2026-09-25 · S1b.1 · The scope line also names Sounds not on the grid.** The roadmap's example is "Analysing 5 of 7 Sounds · 2 muted". Unplaced Sounds are in the analysis but can't be played, which is why a partial layout is Infeasible, so the line adds "· N not on the grid".
- **2026-09-25 · S1b.1 · Layouts tab: "Selected Event" becomes "Selected note".** ActiveLayoutSummary already had a section of that name showing the first note's Sound, time, pad, hand and finger (with the finger controls) and a per-note Cost chip. The new card is the selected event; the old section describes one note, so it is renamed and its Cost chip removed (the event's cost is in the card).
- **2026-09-25 · S1b.1 · A verdict's scope is its plan's (Codex review on PR #104).** A mute marks the analysis stale but the old plan stays on screen until the re-analysis lands, so a scope read from the live mute state could label an old verdict with Sounds it never analysed. The badges and the event card read the scope from the Sounds in the displayed plan (`planSoundIds`); only the no-analysis badge uses the live scope. Sounds left out of a plan but no longer muted read "N not in this analysis". The manual Calculate Cost result keeps no record of its Sounds, so it shows the live scope, or "Out of date … Calculate again" once the analysis is stale. Tests: `analysisScope.test.ts`, `selectedEventVerdict.test.tsx` (mute after analysis).
- **2026-09-25 · S1b.1 · FACTOR_META's constraint label is "Constraints".** The five labels follow the ergonomics bars already on screen (Movement, Grip, Alternation, Hand balance, Constraints). Learn More's older Cost Factors list (Grip Quality, Repetition, Hard Constraints, with Alternation and Balance colours swapped) is left for P2's migration.

- **2026-09-25 · S1b.2–S1b.4 · One PR for three sessions.** The user asked for every remaining step before Phase 2 in one session, and its branch is fixed (`claude/pushflow-ui-roadmap-phase-2-dm03gx`), so S1b.2, S1b.3 and S1b.4 land as ordered commits in one PR (8ef23ba, fa1cf0f, 9a3a79e, 5ed1883), each passing typecheck and the unit suite on its own. Approved by: none needed; flagged in PR #105.
- **2026-09-25 · S1b.2 · Pad labels use the grid's own numbers.** The roadmap's example is "Row 4, column 4, Kick". Pads read `Row {row}, column {col}, {Sound}` with the 0-based numbers the grid's axes show today; S2.2b's notation ("Row 4 · Col 4") decides the final form.
- **2026-09-25 · S1b.2 · The overlay stack is by opening order.** Only the most recently opened overlay reacts to Escape or an outside press. Two overlays mounted in the same render (none today) would register child first; nested overlays open later in practice, and the test covers that case.
- **2026-09-25 · S1b.3 · The S3.3 C7 case flipped early.** "Active's score in Compare equals its standalone analysis" (owned by S3.3, P3) passes now: Compare reads Active from the auto-analysis result stored in the cache, which is its standalone analysis. Its marker is removed (the rule for any expected-fail test that passes); S3.3 still owns the criterion and re-verifies it when Compare moves onto the shared evaluator.
- **2026-09-25 · S1b.3 · performanceHash also covers the settings that change a plan.** The key's `performanceHash` hashes the events and the engine config, instrument and sections, so the four-part key stays complete without adding a fifth part.
- **2026-09-25 · S1b.3 · Compare's Active side keeps its own card while analysing.** While Active is analysing (or failed), Compare shows the Active status card beside the other layout's card instead of the grids and tradeoff bars, which need both analyses.
- **2026-09-25 · S1b.4 · The user's own finger preference opens pre-filled.** The prompt says the field opens empty with the suggestion as placeholder. That is what happens on a solver suggestion; on the user's own preference the field opens with it selected, so it can be retyped or cleared (the Composer's clear, P1a-12b). Blur or Escape without typing changes nothing in both cases.
- **2026-09-25 · S1b.4 · A refused preset drop explains itself in a toast, not on the ghost.** The roadmap puts the reason on the drag ghost; the ghost is drawn in pads with no room for text, so the reason appears as a toast when the drop is refused (the ghost still turns red where it is invalid). A full in-ghost reason belongs with T65's later slices.
- **2026-09-25 · S1b.4 · A preset whose Sound is already on the grid is refused.** Besides occupied pads and foreign Sounds, a drop that would put a Sound on a second pad is refused ("Snare is already on pad [0,1]"), since a Sound lives on one pad (ASSIGN_VOICE_TO_PAD moves rather than copies).
- **2026-09-25 · S1b.4 · Preset pads' hand and finger are nullable.** Leaving fingers blank at save time needs `PresetPad.hand` and `.finger` to accept `null`. Stored presets are unchanged and still read (their pads keep S1a.5's `fingerSource`); new presets store `null` for a pad without a preference, so no migration runs. A preset with no recorded hand can be mirrored (columns flip) and shows no L/R badge; the Mirror toggle is always visible, disabled with a reason for a two-hand preset.
- **2026-09-25 · S1b.4 · The whole selection overlay pauses during playback.** The roadmap names the selection overlay; the next-event outline, the onion layers, the shared/impossible rings and the transition arrows are part of it and pause too, so struck pads look exactly as with nothing selected.
- **2026-09-25 · S1b.4 · ↑/↓ also do nothing while playing.** The prompt names ←/→; the Events list's ↑/↓/j/k selected events during playback the same way, so they stop too, and they no longer act on a focused select or under an open dialog.

- **2026-09-25 · S2.1–S2.4 · One PR for the phase.** The user asked whether more of P2 could be done in one pass than one session at a time; every P2 session was unblocked (S2.4 needs only S2.1), and four of them edit InteractiveGrid.tsx, so running them in order on one branch avoids repeated conflicts. The session's branch is fixed (`claude/pushflow-ui-phase-2-9f7372`), so S2.1, S2.2a, S2.2b, S2.3 and S2.4 land as ordered commit groups in one PR, each passing typecheck and the unit suite on its own. Approved by: the user asked for the assessment; flagged in the PR.
- **2026-09-25 · S2.1 · Return keeps the play state.** RESET stopped playback and rewound to 0. Return (T05's name, T61's meaning: "go to the start or the loop start") seeks to the start, or to the loop start while looping a region, and playback carries on if it was running, so a passage can be restarted without Stop, Return, Play. Stop is the Play button's other state.
- **2026-09-25 · S2.1 · The transition preview lives in the state-bar slot.** It used to sit under the grid, only while an event was selected, so selecting an event shrank the pads. It is now in the fixed slot above the grid, right-aligned and truncated. S3.2's state bar takes the slot, and S4.2's docked inspector is the preview's lasting home (see Follow-ups).
- **2026-09-25 · S2.1 · The drawer size is per viewer, not per project.** The splitter's height and the collapsed state are a view preference (localStorage `pushflow:drawer`), like the other view settings T39 wants remembered, not project data.
- **2026-09-25 · S2.1 · The "More" popover is a dialog, not a menu.** It holds a slider and a Fit toggle besides buttons, so it uses the Popover with `role="dialog"` and an accessible name rather than `role="menu"`.
- **2026-09-25 · S2.2a · A one-track file is named after the file, not the track.** T17's recommendation names Sounds after "the MIDI track name when a track has one pitch, otherwise the track or file name". With one track the file name wins ("TEST MIDI 1 A", not the track's "TEST MIDI A"), since it is the name the user chose and the one the project and Library use (S2.3 names projects after the file); track names are used when a file has several tracks, where they tell parts apart.
- **2026-09-25 · S2.2a · Multi-file imports accumulate names, colours and order.** To give every new Sound its own colour and name, `useLaneImport` carries the names, colours and highest orderIndex from one file of a batch to the next, which also fixes the batch's shared orderIndex base (half of the S1a.1 follow-up "Multi-file import reads stale state"); each file may still set the tempo, which stays with S5.2.
- **2026-09-25 · S2.2a · The Sounds panel gets a small header now.** "N Sounds" and "Name from GM drum map" sit above the list; S5.1's full header (search, filter chips, progress, Place remaining) replaces it.
- **2026-09-25 · S2.2a · Popovers sit above toasts.** The Popover (menus, the timeline's "More") moves from z-80 to z-95, above the toast region (z-90): the new import toast covered the bottom of the pad menu at 1366 (C1). Dialogs stay below toasts, so an Undo toast raised from inside one can still be clicked.
- **2026-09-25 · S2.2b · Tooltips keep seconds.** Positions read bar.beat.sixteenth everywhere they are shown; the transport's, pills' and selected event's tooltips add the time in seconds ("3.2.1 (5.250 s)"), and the gap between events stays in milliseconds, since a gap is not a position.
- **2026-09-25 · S2.2b · Compare lists the moved Sounds.** Beyond the counts, Compare's layout differences name each moved Sound with its chip and its move ("R4 C4 → R4 C3"), where it listed raw ids; finger-only changes are counted separately as "pads re-fingered".
- **2026-09-25 · S2.2b · Engine strings changed, not engine output.** Two texts the UI shows come from the engine and now follow the same rules: difficultyScoring's binding constraints count events and notes through groupIntoMoments, and the greedy trace's move descriptions and presetTransform's drop reasons use "Row 4 · Col 4". Trace shape, scores and layouts are unchanged (TEST MIDI 1 snapshots identical).
- **2026-09-25 · S2.2b · The token fix changes a few colours on purpose.** Classes such as `border-[var(--border-subtle)]/30` compiled to nothing, so those borders fell back to Tailwind's default light grey (the timeline's bright lane separators, the Library's New Project button). They now render in their tokens, as designed. The Library screenshot baselines are regenerated in CI.
- **2026-09-25 · S2.2b · The readability floor covers the grid, the timeline and the surfaces this session touched.** Text under 11 px elsewhere (the Library cards' labels, the preset cards and inspector, Learn More's App Flow diagrams, the unmounted `components/lanes/` files and the developer routes) is left for S2.3 (Library) and T64's P7 sweep; see Follow-ups.

## 6. Follow-ups

Record each one with the date, the session that found it, what and where (file:line or repro), and the session or phase it belongs to.

- **2026-09-23 · S0.1 · Delete the scratch branches.** `scratch/s0.1-red-typecheck`, `scratch/s0.1-red-unit` and `scratch/s0.1-red-e2e` (PRs #94–#96, closed) are still on the remote: the implementing session's git access could not delete branches other than its own. Delete them from the closed PRs. Owner: the repository owner.
- **2026-09-23 · S0.1 · e2e specs aren't type-checked.** tsconfig.json includes only src/, so test/ (vitest and Playwright specs) is never run through tsc; Playwright transpiles without checking. Add a tsconfig for test/ and run it in ci.yml. Belongs to: any P0/P1a session touching CI.
- **2026-09-23 · S0.1 · Node 20 actions deprecation.** CI warns that actions/checkout@v4, setup-node@v4 and upload-artifact@v4 target Node 20 and are forced onto Node 24 (all workflows, including the existing deploy.yml). Bump the action versions when newer majors are available. Belongs to: any session touching CI.
- **2026-09-23 · S0.2 · Toolbar Generate never sets the trace.** useAutoAnalysis.generateFull clears moveHistory (`SET_MOVE_HISTORY` with null) and neither branch sets it again, so MoveTracePanel is empty after every toolbar run (CLAUDE.md Do-Not-Regress: trace must stay wired to optimizer output). C4's Generate case compares an empty trace until this is fixed. Belongs to: S3.4 (trace per candidate).
- **2026-09-23 · S0.2 · Greedy Generate freezes the page for minutes.** With All Strategies, the greedy pipeline runs on the main thread and the page stops responding for several minutes in Chromium (about 40 s for the same work in node); even one strategy (Coordination) leaves the page unresponsive for about two minutes after its progress text clears. Belongs to: S3.4 (progress, Cancel and time budget).
- **2026-09-23 · S0.2 · Engine APIs keyed by MIDI pitch.** seedLayoutFromPose0 takes `existingVoices: Map<number, Voice>`, generateCandidates' pose0-offset strategy builds that map from `originalMidiNote` (multiCandidateGenerator.ts), and buildSolverConstraints falls back to noteNumber (useAutoAnalysis.ts). The TEST MIDI 1 gate no longer calls them with a pitch map, but the app's beam/annealing path still does. Belongs to: S1a.3 (strict Sound identity).
- **2026-09-23 · S0.2 · Deep annealing takes about 50 minutes.** Annealing Thorough on TEST MIDI 1 took 49.7 min in CI and 46.8 min locally for 3 candidates (the critique measured about 33.5 min in the browser). nightly.yml allows 180 minutes. Belongs to: S3.4 (time budget).
- **2026-09-23 · S0.2 · The top grid row is clipped at 1366×768.** Row 7 is partly hidden by the grid wrapper, so C1 right-clicks the visible part of each pad. Belongs to: S2.1 (measured grid, T04). **Done in S2.1** (`measured-grid.spec.ts`: every pad fully visible at 1366 and 1600).
- **2026-09-23 · S0.2 · A pad edit during greedy Generate stalls the run.** In Chromium, greedy Generate with the Exploratory strategy finishes in about 17 s, but after a pad edit mid-run it had not finished after 10 minutes (the page stays responsive; a CPU profile shows the time inside greedyOptimizer.runSingleAttempt). Probably tied to the run racing the edited draft; re-check once S1a.2 stops Generate writing the draft. Belongs to: S1a.2, else S3.4.
- **2026-09-24 · S1a.1 · Multi-file import reads stale state.** useLaneImport computes currentMaxOrder, the group colour and "first import" from the state captured when the import starts, so every file of a multi-file import gets the same orderIndex base and colour, and each may set the tempo (useLaneImport.ts, the transact('Import') loop). Pre-existing; now one undo step. Belongs to: S5.2 (import review). **Partly done in S2.2a:** names, colours and the orderIndex base now carry from file to file; each file may still set the tempo.
- **2026-09-24 · S1a.1 · Rename/recolour also rewrite session copies.** RENAME_SOUND and SET_SOUND_COLOR update the names embedded in candidates and analysisResult (session). Undo restores the document's names but not those copies, so a candidate card can show the undone name until the next Generate. Belongs to: S1b.3 (per-layout analysis cache) or S3.2.
- **2026-09-24 · S1a.1 · C5 unexpectedly passed twice locally.** At 1366, C5's "onion skin changes grid pixels" (expected-fail until S1b.4) passed 2 of 54 local runs on this branch and 0 of 48 on main, and could not be reproduced in 30 instrumented runs (no state or history change between the two screenshots). A C6 case also timed out once under full-suite load and passed 6 reruns. If CI shows either again, investigate before merging. Belongs to: S1b.4 (C5/C6 flip there).
- **2026-09-24 · S1a.1 · The Library screenshot fails locally.** library.spec.ts differs by about 1 % of pixels in a cloud container on main and on this branch; the baselines are CI-generated (CLAUDE.md), so it passes only in CI. No action unless CI fails it.
- **2026-09-24 · S1a.2 · Recovered drafts aren't in the Library card or the reopened-draft banner.** A project whose only copy of some work is a recovered draft looks the same in the Library as any other. Belongs to: S2.3 (Library card) and S5.4 (reopened-draft banner).
- **2026-09-24 · S1a.2 · "Saved" shows before the save.** WorkspaceToolbar's handleSave sets saveConfirm ("Saved") on click, before saveNow's write, and saveNow returns without saving when an autosave is in flight, whose completion then marks the newer state saved. Belongs to: S1a.4 (truthful save, T57).
- **2026-09-24 · S1a.2 · Only the newest backup per starting version is kept.** A second migration from the same version (only possible if the first never wrote back) overwrites the backup; backups are never pruned. Revisit when S1a.4 adds the next migration. Belongs to: S1a.4.

- **2026-09-24 · S1a.3 · Remove and preset placement can still displace a locked Sound.** `REMOVE_VOICE_FROM_PAD` (the pad's × button and the context menu's "Remove from pad") and `MERGE_ASSIGN_PADS` (placing a Composer preset over the grid) still take a locked Sound off its pad, and the lock is then pruned. Drags are refused (this session); these two explicit actions should ask to unlock first, or refuse. Belongs to: S1a.4 (Discard hygiene / freshness) for Remove, S1a.5 (presets) for MERGE_ASSIGN_PADS.
- **2026-09-24 · S1a.3 · Composer lanes still match pads by name.** `composerLaneIdentity.ts` keeps a name match as the last fallback; S1a.5 keys Composer edits by the lane's project Sound id and can drop it (T66).
- **2026-09-24 · S1a.3 · Engine placeholder names use pitch.** `buildVoiceMap` names a Sound it was told nothing about `Sound <pitch>`; this is reachable only for Sound-less synthetic events (the app always passes its Sounds as hints). Belongs to: S2.2a (Q3 naming), if the placeholder ever reaches the UI. **Checked in S2.2a:** both generate pipelines pass the project's Sounds as `voiceHints`, and the grid re-reads names from the Sounds, so the placeholder never reaches the UI; no change.
- **2026-09-24 · S1a.3 · No component tests for MoveTracePanel and CandidatePreviewCard.** Their render coverage is `LayoutOptionsPanel.test.tsx` and the C2/C4 specs. Belongs to: S3.4 (trace per candidate).
- **2026-09-24 · S1a.3 · A lock whose Sound no longer exists is not carried into candidates.** `applicableLocks` skips it, so a ghost lock cannot make every candidate fail post-validation; S1a.4's ghost-lock migration removes them from stored projects.
- **2026-09-24 · S1a.3 · C5 unexpectedly passed again.** In the full local Playwright run on this branch, C5's "onion skin changes grid pixels" (expected-fail until S1b.4) passed once at 1366, and 1 of 8 repeats passed afterwards (S1a.1 saw 2 of 54). Nothing in S1a.3 touches the onion layers, the selected-event overlay or the transport; the two grid screenshots the case compares must sometimes differ for another reason. Still to investigate before S1b.4 flips it; if CI shows it, investigate before merging. Belongs to: S1b.4.

- **2026-09-24 · S1a.4 · "Saved" shows before the save: done.** The S1a.2 follow-up above (WorkspaceToolbar's `saveConfirm`, and `saveNow` returning while an autosave is in flight) is closed by the truthful-save slice.
- **2026-09-24 · S1a.4 · Remove and preset placement can still displace a locked Sound: Remove done.** The S1a.3 follow-up's Remove half is closed (refused while locked); `MERGE_ASSIGN_PADS` still belongs to S1a.5.
- **2026-09-24 · S1a.4 · Backups per starting version, revisited.** With the second migration, a schema-1 record gets one backup (`@v1`, migrated 1 → 3 in one load) and a schema-2 record one (`@v2`); a project migrated in S1a.2 and again now keeps both. The overwrite case (the same `fromVersion` migrated twice) still only arises if the migrated record was never written back. Backups are still never pruned; add pruning (or a size cap) when the Library's storage view arrives. Belongs to: S5.4.
- **2026-09-24 · S1a.4 · Export reads the Composer's stored pattern, not its live state.** `WorkspacePatternStudio` writes the pattern to localStorage 500 ms after an edit, so an export (or "Export a copy") within that window misses the last edit. S1a.5 flushes pending Composer saves on Stop and unmount; once P8 moves the pattern into the project, export reads project state directly. Belongs to: S1a.5 (flush), P8.
- **2026-09-24 · S1a.4 · A draft equal to Active still shows the "Working/Test" role.** `hasWorkingChanges` hides Promote and Discard for such a draft, but `getDisplayedLayoutRole` still reports `working` (a `CREATE_WORKING_LAYOUT` with no edit, or an edit undone by hand). P3's state bar should either drop an empty draft or show it as Active. Belongs to: S3.1.
- **2026-09-24 · S1a.4 · Pinned pads are not marked on the grid during Preview.** A muted Sound's pad looks like any other pad in a previewed candidate; only the Layouts panel's note says it was kept. T15's later slices (scope line, audition vs analysis) should give it a visible "kept" cue. Belongs to: S1b.1 (scope line) or S4.4.
- **2026-09-24 · S1a.4 · The Delete key on a locked pad does nothing silently.** The reducer refuses `REMOVE_VOICE_FROM_PAD` for a locked pad; the × button and the menu item say why, the keyboard path does not. A toast ("Locked · Unlock to remove") belongs with P3's lifecycle confirmations. Belongs to: S3.3 (T31).
- **2026-09-24 · S1a.4 · beforeunload in e2e.** Playwright auto-accepts a `beforeunload` dialog when no handler is registered, so a spec that navigates or reloads while a save is pending proceeds without a warning; the C-case helpers wait for `data-save-status="saved"` first. Any new spec that reloads must do the same (`waitForSaved`), or it tests an unsaved state.

- **2026-09-24 · S1a.5 · Undo of a "Composer edit" doesn't revert the Composer.** A Composer edit is one project undo step (a no-op sync records none), but Undo reverts only the project's lanes; the Composer keeps showing the undone notes until its next edit re-syncs them (F9-V03). Clear is the exception (its pattern comes back from memory). Belongs to: P8 (S8.1, pattern in the project).
- **2026-09-24 · S1a.5 · Rendering cost with both tabs mounted.** The hidden Composer re-renders on every project update (the timeline's playback dispatches SET_CURRENT_TIME each frame), and the hidden timeline re-renders while the Composer plays. No slowdown was visible at 1366×768 in the e2e runs, but it was not profiled. Belongs to: S4.3a (shared transport), which moves the playhead out of project state.
- **2026-09-24 · S1a.5 · The Composer's Play is still silent.** Keeping it mounted keeps its playhead running across a tab switch, but it still plays no audio and lights no pads (T60's full fix). Belongs to: S8.2 (Composer on the shared transport).
- **2026-09-24 · S1a.5 · A pattern in localStorage whose Sounds are gone from the project stays unsynced.** If the project lacks the Composer's Sounds (deleted in the Sounds panel, or an older project), the Composer shows notes the timeline doesn't have until its next edit, which re-adds them. Belongs to: P8 (S8.1).
- **2026-09-24 · S1a.5 · Composer lanes deleted in the Sounds panel come back on the next Composer edit.** Deleting a Composer Sound in the Sounds panel doesn't remove its Composer lane, so the next sync adds it again (pre-existing). Belongs to: S8.1 (lanes bound to Sounds).

- **2026-09-24 · P0/P1a audit · Two P0 follow-ups are still open.** The scratch branches `scratch/s0.1-red-*` are still on the remote (`git ls-remote --heads origin 'scratch/*'`), and tsconfig.json still includes only `src/`, so test/ is never type-checked. Neither blocks P1b. Owners as recorded above (the repository owner; any session touching CI).
- **2026-09-24 · P0/P1a audit · Material Symbols still load from Google Fonts.** index.html links `fonts.googleapis.com/css2?family=Material+Symbols+Outlined`, used by the Library (search field, PerformanceCard, Homepage). S0.1 self-hosted Inter and Space Grotesk only, so with remote fonts blocked (e2e, offline) the icons render as their ligature names ("search" overlaps the search placeholder; see `docs/screenshots/audit-P1a/1366-01-library.png`). Self-host the icon font or replace these icons with lucide-react. Belongs to: S2.3 (Library) or S7.2 (tokens and primitives).
- **2026-09-25 · S1b.1 · selectedEventIndex means a note in beam plans and a moment in greedy plans.** FingerAssignment.eventIndex is the note index for beam plans and the moment index for greedy ones, so SELECT_EVENT's payload changes meaning with the method. S1b.1 resolves it to its moment (`findSelectedMoment`) wherever a verdict is shown; the grid, timeline and EventsPanel keyboard navigation still use the raw index. Belongs to: S4.1 (one identity for each performance event).
- **2026-09-25 · S1b.1 · The chart draws nothing for an unplayable event.** An Unplayable moment has no breakdown, so its bar is empty; the Events list shows ✗ but the chart has no marker. Belongs to: S4.2 (moment view, Events list and inspector).
- **2026-09-25 · S1b.1 · Counts still mix notes and events.** With four of seven Sounds placed, the Costs panel shows "EVENTS 32" beside "14 unplayable events" and "14 unplayable of 48 events" (note counts), and "Score 91%" beside 14 unplayable. Out of scope here. Belongs to: S2.2b (T23 counts) and S6.1 (one headline score, T21).

- **2026-09-25 · S1b.2–S1b.4 · C9's setup read state before the next render.** `buildPreset` read the pads straight after dispatching, so under load it saw the old ones (1 of 64 runs); on `main` the expected-fail marker hid it. The spec now polls. Other specs that read right after a `pf.call('dispatch')` should poll too.
- **2026-09-25 · S1b.2 · The M key during a preset drag is still wired.** PerformanceWorkspace listens for M while a preset drag is active, though browsers don't deliver it during a native drag; the visible Mirror toggle replaces it. Remove it with the input table. Belongs to: S2.4.
- **2026-09-25 · S1b.3 · Compare labels still use list positions.** "#1 pose0-offset-0" renumbers after a delete, and the Layout differences line lists raw `lane_` ids. Belongs to: S2.2b (readable references) and S3.3 (stable candidate labels).
- **2026-09-25 · S1b.3 · Variants don't use the cache yet.** `getAnalysisForLayout` serves Compare and auto-analysis; S2.3's variant scores and P3's inspection are its next users.
- **2026-09-25 · S1b.4 · No drag-off-the-grid removal.** The roadmap lists "dragging off" as a removal gesture with an Undo toast; dragging a pad off the grid does nothing today. Belongs to: S2.4 (input table) or S3.2.
- **2026-09-25 · S1b.4 · The moment view's selected pad still shows the finger code instead of the Sound.** T09's full fix (Sound colour and name plus a finger badge, a Now/Next/Prev segmented control, arrows from each finger's last pad) is P4's. Belongs to: S4.2.
- **2026-09-25 · S1b.4 · The pad menu's finger list still uses the old notation.** "Finger Constraint (L2)" and ten L1–R5 items; T19's one soft "Hand & finger preference" control replaces it. Belongs to: S5.1.
- **2026-09-25 · S1b.2–S1b.4 · The Library screenshot still fails locally.** `library.spec.ts` differs by about 1% of pixels in a cloud container (S1a.1 follow-up); it passes only in CI.
- **2026-09-25 · P1b audit · C1 doesn't bound the pad menu's width.** The portalled menu stretched to the viewport edge (630–884 px) while all C1 cases passed, because they check position, clamping and clickability. Fixed in the audit (`flex flex-col`); C1 should also assert a sensible width (for example under 320 px) so it can't come back. Belongs to: S2.4 (input table, which reworks the pad menu) or S3.1 (primitive kit).
- **2026-09-25 · P1b audit · At 1366×768 the grid's top row is cut off.** Row 7 sits under the toolbar in `docs/screenshots/audit-P1b/1366-02…` and `1366-01…`. This is T04's measured grid. Belongs to: S2.1. **Done in S2.1.**

- **2026-09-25 · S2.1 · The state-bar slot holds the transition preview for now.** S3.2 fills the slot with the layout-state bar (role chip, name, diff, freshness, actions); the transition preview then needs another place, and S4.2's docked moment inspector is where the roadmap puts it. Belongs to: S3.2 (move it), S4.2 (its home).
- **2026-09-25 · S2.1 · At 1366×768 the Composer needs scrolling in the drawer.** The drawer is capped at 40% of the centre column (280 px at 1366), and the Composer's header and toolbar take most of it, so the step grid is below the fold until the splitter is dragged up. S2.4's Composer geometry (T69) keeps the toolbar to one row; a "maximise Composer" control is T69's later slice (S8.3). Belongs to: S2.4, S8.3.
- **2026-09-25 · S2.1 · The transport position still reads seconds.** It is a fixed 56 px box showing "4.56s"; S2.2b's musical notation makes it bar.beat.sixteenth and shows the effective BPM beside Speed. Belongs to: S2.2b. **Done in S2.2b** (the position reads "1.1.1"; Speed options read "0.75x · 90 BPM"; `readable-names.spec.ts`).
- **2026-09-25 · S2.2a · Timeline pill text can be unreadable on light Sound colours.** Pill text is coloured by hand (a light tint), so on the yellow, aqua, peach, mint and lavender palette colours it has little contrast (T64's "hand-tinted pill text on amber 2.3:1", now on more colours). Belongs to: S2.2b (readability floor). **Done in S2.2b** (dark or white, whichever contrasts more with the pill at its opacity: at least 4.4:1 on all 16 colours).
- **2026-09-25 · S2.2a · The Composer's new Sounds don't use the palette.** Lanes created in the Composer (`loopToLanes`) keep their own colours and `colorMode: 'inherited'`. Belongs to: S8.1 (Sound-bound lanes).

- **2026-09-25 · S2.2b · `window.__pf.state()` stalls once greedy candidates exist.** It deep-copies the whole state, every candidate's move history included, and handing that to Playwright took over 100 s after a TEST MIDI 1 Generate (the page itself was idle). `readable-names.spec.ts` reads ids before Generate and `status()` after. Consider a trimmed copy (candidates without traces) or a `candidates()` summary. Belongs to: S3.4 (trace per candidate), or any session touching the hook.
- **2026-09-25 · S2.2b · Text under 11 px outside the grid and timeline.** Library cards (`Homepage/PerformanceCard.tsx`, `ContinuePracticingHero.tsx`, `LibraryStatsCard.tsx`: 10 px labels), the preset UI (`composer/PresetCard.tsx`, `PresetInspector.tsx`, `PresetLibraryPanel.tsx`: 6–10 px), Learn More's App Flow diagrams (`LearnMoreModal.tsx` 150–280: 8–10 px). Belongs to: S2.3 (Library cards), S8.x with T65 (presets), P7 T64 sweep (the rest).
- **2026-09-25 · S2.2b · Unmounted lane components.** `components/lanes/LaneSidebar.tsx`, `LaneRow.tsx` and `LaneGroupHeader.tsx` are imported by nothing but each other (UnifiedTimeline replaced them) and still carry 9–10 px text. Belongs to: S7.1 (consolidate the workspace): delete them.
- **2026-09-25 · S2.2b · Other engine explainers still say "event(s)" for notes.** constraintExplainer.ts (unplayable and hard counts, per section) and eventExplainer.ts ("hard/unplayable event(s)") count notes; neither reaches the UI today. Belongs to: S6.1/S6.2, when they surface.
