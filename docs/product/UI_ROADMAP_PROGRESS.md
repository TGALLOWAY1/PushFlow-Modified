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

- **Status:** Done (branch `claude/pushflow-ui-roadmap-lzjvda`)
- **Prerequisites:** S1a.1; Q1 and Q2 (recorded above).
- **Flips:** the S1a.2 C2 cases (the Inspect case flips in S3.2).
- **Decisions:** Q1 (the draft and Recovered drafts survive a reload), Q4 (Generate on an empty grid places nothing).

**Deliverables**
- [x] Migration runner: the runner, its pre-migration backup, "Download backup" and the Recovered-drafts migration only (the ghost-lock migration is S1a.4's, the preset migration S1a.5's) · *PR / verified by:* persistence/migrations.ts: MIGRATIONS (ordered by `from`, each one version up, idempotent) and runMigrations (sync, pure); migrateWithBackup awaits the backup before any step and migrates nothing if it fails. PERSISTED_SCHEMA_VERSION is 2; the one migration, `recovered-drafts-store` (1 → 2), adds `recoveredDrafts: []`. Unversioned localStorage records are converted to schema 1 first, then run through the same runner. The backup is the untouched stored record, written to a new IndexedDB store `backups` (DB version 2) keyed `${projectId}@v${fromVersion}` and committed before the migrated record is written back, so a record migrates once. "Download backup" appears on a Library card (and the Continue hero) only when that project has a backup; nothing downloads automatically. A file import migrates without a backup (the file is the copy). Tests: test/ui/persistence/migrations.test.ts, test/ui/persistence/projectStorageMigration.test.ts (IndexedDB faked in memory; write order `putBackup v1` → `putProject v2`, second load writes nothing, a failed backup leaves the record untouched).
- [x] Generate only proposes (T01 slice) · *PR / verified by:* Both APPLY_GENERATION_TO_LAYOUT dispatches (and the SET_ANALYSIS_RESULT beside them) are gone from useAutoAnalysis.generateFull, and SET_CANDIDATES no longer selects candidate #1, so the grid, the draft and its analysis stay as they were; the list says "Preview #1 to try it on the grid". A click on a candidate card's body does nothing; only its Preview button previews. Preview, Load Draft, a candidate Promote (card, View all, Compare) and a variant Promote keep a draft whose hash differs from Active, from the incoming layout, from every saved variant and from every candidate in `recoveredDrafts` (document slice, so undoable; saved with the project per Q1), with the toast "Your draft was kept in Recovered drafts · Restore" (hooks/useDraftReplacement.ts). The list keeps its own group under the variants (Restore, delete), dedupes by layout hash, keeps the newest 5 and says so in the toast when it prunes. The variants list shows every variant (the slice(-3) and its "View all" trigger are gone). Learn More's "What are candidates?" says Generate never changes the layout. Tests: test/ui/state/recoveredDrafts.test.ts, test/ui/hooks/generateOnlyProposes.test.tsx, test/ui/components/LayoutOptionsPanel.test.tsx. Screenshots: docs/screenshots/S1a.2/ (before/after at 1366 and 1600: a hand-made draft, then Beam Generate, then Preview #2; before, Generate replaced the draft with candidate #1; after, the draft and its analysis stay, and Preview shows the "kept · Restore" toast).

**Exit criteria**
- [x] **P1a-1c** Reducer test: after Generate, Undo keeps the candidate list and the trace (MoveTracePanel still shows state.moveHistory) and undoes the previous user edit. This replaces S1a.1's interim test. · *PR / verified by:* undoHistory.test.tsx "P1a-1c" (greedy Generate records no step; one Undo undoes the pad swap made before it; candidate ids, state.moveHistory and each candidate's iterationTrace unchanged), and C4 e2e case 3, rewritten the same way (1366 and 1600).
- [x] **P1a-2a** C2 flipped on TEST MIDI 1: after Generate, the draft hash is unchanged, and a grep test finds no APPLY_GENERATION_TO_LAYOUT dispatch in useAutoAnalysis. · *PR / verified by:* C2 "Generate leaves the draft unchanged" (marker removed; passes at 1366 and 1600); grep test and hook test in generateOnlyProposes.test.tsx.
- [x] **P1a-2b** C2: an edit made during a run is kept. · *PR / verified by:* test/ui/hooks/generateMidRunEdit.test.tsx, `it.fails` removed (passes).
- [x] **P1a-2c** C2: after Preview, a card-body click, Load Draft, card Promote and variant Promote, a hand-built draft is recoverable as the draft or in "Recovered drafts", including after a reload. · *PR / verified by:* the five C2 cases, markers removed, all pass at 1366 and 1600 (`PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test c2`); reducer versions with a serialize/reload round trip in recoveredDrafts.test.ts.
- [x] **P1a-3** After 5 auto-keeps, a user-named variant is still visible. Recovered drafts are deduped by hash and capped at 5, with a notice on pruning. · *PR / verified by:* recoveredDrafts.test.ts "P1a-3" (5 keeps leave the named variant in savedVariants; a 6th prunes the oldest; a same-hash keep replaces the older copy); the pruning notice is the toast text from useDraftReplacement; LayoutOptionsPanel.test.tsx "lists every saved variant" (6 rows).
- [x] **P1a-4** Generate on an empty grid leaves the draft (workingLayout) empty (invariant 7). · *PR / verified by:* generateOnlyProposes.test.tsx "P1a-4" (real ProjectProvider and generateFull on TEST MIDI 1 with nothing placed: candidates produced, no pads in the draft or Active, no undo step).

**Session checks**
- [x] Runner test: the backup is written before any migration, migrations run in order, and a second run changes nothing. · *PR / verified by:* migrations.test.ts ("writes the backup, with the untouched record, before any migration step runs", "runs the migrations a record needs, in version order", "a second run changes nothing", and each migration idempotent on its own output); projectStorageMigration.test.ts for the real load path.

#### S1a.3 — Locks honoured by every method; strict Sound identity ∥ S1b.1, S1b.2, S1b.3

- **Status:** Not started
- **Prerequisites:** S1a.1.
- **Flips:** C3 and the S0.2 beam/annealing lock cases.

**Deliverables**
- [ ] Locks honoured and identity strict (T11, T18) · *PR / verified by:* —
- [ ] Learn More (invariant 2), the P1a item · *PR / verified by:* —

**Exit criteria**
- [ ] **P1a-5a** C3 flipped for greedy, beam and annealing Quick (deep annealing runs nightly): a lock at [7,0] holds in every candidate, and placementLocks is non-empty. · *PR / verified by:* —
- [ ] **P1a-5b** C3: manual drags onto and out of a locked pad are refused. · *PR / verified by:* —
- [ ] **P1a-5c** C3: TEST MIDI 1 reports 0 unplayable events for every method. · *PR / verified by:* —
- [ ] **P1a-5d** C3: seed 0 gives identical output twice, and the trace shapes are unchanged. · *PR / verified by:* —
- [ ] **P1a-6** When two Sounds share a pitch and one is unplaced, the unplaced Sound's events are unmapped. A Composer lane never matches a pad by pitch. · *PR / verified by:* —
- [ ] **P1a-14** The Learn More Constraints section lists lock enforcement for all three methods (asserted directly if S1b.1's sync test isn't merged yet). · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist (CLAUDE.md), all seven items, recorded in the PR. · *PR / verified by:* —

#### S1a.4 — Discard hygiene, freshness, mute can't delete, truthful save

- **Status:** Not started
- **Prerequisites:** S1a.2, S1a.3; Q1 and Q2 (recorded above).
- **Decisions:** Q2 (Discard keeps finger preferences), Q1 (truthful save covers the draft).

**Deliverables**
- [ ] Discard hygiene (T12) · *PR / verified by:* —
- [ ] Freshness slice (T14) · *PR / verified by:* —
- [ ] Mute can't delete (T15 slice) · *PR / verified by:* —
- [ ] Truthful save (T57 slice) · *PR / verified by:* —
- [ ] Migration runner: the ghost-lock migration · *PR / verified by:* —

**Exit criteria**
- [ ] **P1a-7** After Discard, Active holds no lock whose Sound isn't on that pad. After Discard, Promote, Preview or Load, pad fingerConstraints equal the values derived from voiceConstraints. · *PR / verified by:* —
- [ ] **P1a-8** A lock toggle marks the analysis stale. A self-drop creates no draft and no history entry. · *PR / verified by:* —
- [ ] **P1a-9** Generate with a muted, placed Sound keeps its pad in every candidate. · *PR / verified by:* —
- [ ] **P1a-10** A mocked IndexedDB write failure shows the red chip and never "Saved". · *PR / verified by:* —
- [ ] **P1a-12d** An export/import round trip keeps the Composer pattern. · *PR / verified by:* —
- [ ] **P1a-13a** A fixture project with ghost locks is migrated only after its backup file exists. The ghost locks are gone, and running the migration again changes nothing. · *PR / verified by:* —

**Session checks**
- [ ] Solver Change Checklist recorded in the PR: pinning muted placed Sounds changes optimizer input for all three methods. · *PR / verified by:* —

#### S1a.5 — Composer data can't be lost

- **Status:** Not started
- **Prerequisites:** S1a.2, S1a.3.

**Deliverables**
- [ ] Composer data slice (T60, T66, T67) · *PR / verified by:* —
- [ ] Migration runner: the preset-fingering migration · *PR / verified by:* —

**Exit criteria**
- [ ] **P1a-11a** A Composer note toggled less than 100 ms before a tab switch survives a reload. · *PR / verified by:* —
- [ ] **P1a-11b** Playback continues across the tab switch. · *PR / verified by:* —
- [ ] **P1a-11c** With the Timeline tab shown, pressing M does nothing in the Composer. · *PR / verified by:* —
- [ ] **P1a-12a** A Sound renamed in the Sounds panel keeps its name after a Composer edit. · *PR / verified by:* —
- [ ] **P1a-12b** A Composer finger edit appears in the Sounds panel and can be cleared. · *PR / verified by:* —
- [ ] **P1a-12c** Undo after Clear restores the notes, Sounds and pads. · *PR / verified by:* —
- [ ] **P1a-13b** Presets with invented fingering are flagged unverified, and their fingering is not applied. · *PR / verified by:* —

**Session checks**
- [ ] Timeline re-measure spec: switch to the Composer, resize the window, switch back, and the ruler width equals the container width. · *PR / verified by:* —

### Phase P1b · Stop false verdicts and broken overlays

#### S1b.1 — Honest verdict, shared moment grouping, factor registry ∥ S1a.2–S1a.5

- **Status:** Not started
- **Prerequisites:** S0.2.
- **Flips:** C6 and the FeasibilityBadge component test.

**Deliverables**
- [ ] Shared moment grouping (T22 base) · *PR / verified by:* —
- [ ] FACTOR_META registry (T20 base) · *PR / verified by:* —
- [ ] Honest verdict (T07, T15 scope line) · *PR / verified by:* —
- [ ] False claim fix · *PR / verified by:* —
- [ ] Learn More sync, including lock enforcement for Greedy, Beam and Annealing (see P1a-14) · *PR / verified by:* —

**Exit criteria**
- [ ] **P1b-2a** C6 flipped: an Infeasible or Degraded layout with any moment selected never renders "Feasible", and a layout with no analysis renders "Unknown". · *PR / verified by:* —
- [ ] **P1b-2b** C6: a 3-note moment and a 1-note moment with the same breakdown report the same cost. · *PR / verified by:* —
- [ ] **P1b-2c** C6: groupIntoMoments unit tests cover the epsilon boundary and chords, and momentKey is stable across re-analysis. · *PR / verified by:* —
- [ ] **P1b-7** The lowest-scoring candidate of a TEST MIDI 1 run never carries "low overall difficulty". · *PR / verified by:* —
- [ ] **P1b-8** The Learn More sync test passes, and a scope line appears on every verdict surface. · *PR / verified by:* —

#### S1b.2 — One dialog/popover primitive; pad menu at the cursor ∥ S1a.2–S1a.5

- **Status:** Not started
- **Prerequisites:** S0.2.
- **Flips:** C1.

**Deliverables**
- [ ] Dialog/Popover primitive (T06), with PadContextMenu, the enlarged chart, View all, Compare and Learn More migrated · *PR / verified by:* —

**Exit criteria**
- [ ] **P1b-1** C1 flipped at 1366x768, 1600x1000 and 1920x1080: for all 64 pads, the menu's top-left is within 4 px of the cursor or the menu is clamped fully inside the viewport, and 12/12 items are clickable. The first Escape closes it, and focus returns to the pad. · *PR / verified by:* —

**Session checks**
- [ ] The first Escape closes every migrated overlay, with a spec per migrated overlay. (Compare's Escape and Close are also part of P1b-3b, owned by S1b.3.) · *PR / verified by:* —

#### S1b.3 — Compare evaluates Active properly; per-layout analysis cache ∥ S1a.3–S1a.5

- **Status:** Not started
- **Prerequisites:** S1a.1, S1b.2.
- **Flips:** the S1b.3 C7 cases.

**Deliverables**
- [ ] Compare stop-gap and analysis cache (T08 slice) · *PR / verified by:* —

**Exit criteria**
- [ ] **P1b-3a** C7 flipped: with a differing draft, the Active side shows real pads and metrics, or "Couldn't analyse". · *PR / verified by:* —
- [ ] **P1b-3b** C7: no self-compare exists after delete or promote, and every Compare state closes with Escape and with a Close button. · *PR / verified by:* —
- [ ] **P1b-3c** C7: a second request for the same hash is served from the cache without re-solving, and cache use leaves storage unchanged. · *PR / verified by:* —

#### S1b.4 — Moment view, input safety and preset stop-gaps

- **Status:** Not started
- **Prerequisites:** S1a.3, S1a.5, S1b.2.
- **Flips:** C5, C8, and the S1b.4 C9 cases.

**Deliverables**
- [ ] Moment-view stop-gaps (T09, T10, T61 slices), with Learn More's onion-skin text · *PR / verified by:* —
- [ ] Finger input safety (T19 slice) · *PR / verified by:* —
- [ ] Delete scoping (T28 slice) · *PR / verified by:* —
- [ ] Preset safety (T65 slice), refuse-first · *PR / verified by:* —

**Exit criteria**
- [ ] **P1b-4a** C5 and C8 flipped: the onion toggle changes grid pixels. · *PR / verified by:* —
- [ ] **P1b-4b** C5/C8: with a moment selected, pads struck during Play match the control's luminance and chroma, and Stop restores the selection overlay. · *PR / verified by:* —
- [ ] **P1b-4c** C5/C8: ArrowRight during playback neither seeks nor selects the t=0 moment. · *PR / verified by:* —
- [ ] **P1b-5a** C9 flipped using a real native drag (Playwright dragTo), not a synthetic keydown: drops on occupied or mirror-invalid pads are refused with a reason. · *PR / verified by:* —
- [ ] **P1b-5b** C9: a Mirror toggle set before dragging is honoured. · *PR / verified by:* —
- [ ] **P1b-5c** C9: no drop creates a pad whose voice isn't a project Sound. · *PR / verified by:* —
- [ ] **P1b-5d** C9: saved presets contain no invented fingering. · *PR / verified by:* —
- [ ] **P1b-6** Opening and blurring the finger field without typing leaves voiceConstraints unchanged (T19). Delete with a moment selected and no pad selected removes nothing (T28). · *PR / verified by:* —

### Phase P2 · Quick wins you can see

#### S2.1 — Measured grid, reachable transport, full-width timeline

- **Status:** Not started
- **Prerequisites:** S1b.2.

**Deliverables**
- [ ] Measured grid (T04) · *PR / verified by:* —
- [ ] Transport reach (T05, T56) · *PR / verified by:* —
- [ ] The timeline fills its width (T50) · *PR / verified by:* —

**Exit criteria**
- [ ] **P2-1** At 1366x768 and 1600x1000 with default panels, Playwright bounding boxes put all 64 pads, the hand-zone labels and the state-bar slot inside the viewport. Pads are at least 32 px at 1366, and every transport button is clickable. · *PR / verified by:* —
- [ ] **P2-2** After importing a 4-bar clip at 120 BPM, the ruler width equals the container width (regression spec). · *PR / verified by:* —

#### S2.2a — Tell Sounds apart

- **Status:** Not started
- **Prerequisites:** S1b.1; Q3 (recorded above).
- **Decisions:** Q3 (default names from the track or file name plus a letter; the GM action is opt-in).

**Deliverables**
- [ ] Distinct Sounds (T17 slice) · *PR / verified by:* —

**Exit criteria**
- [ ] **P2-3** A TEST MIDI 1 import gives 7 pairwise-distinct colours (CIEDE2000 > 20) and 7 distinct visible pad labels, and no note names appear unless "Name from GM drum map" was used. Existing projects' custom colours are unchanged. · *PR / verified by:* —

#### S2.2b — Readable names, notation and text

- **Status:** Not started
- **Prerequisites:** S1b.1; Q7 (recorded above).
- **Decisions:** Q7 (labels say "Event" and "notes"; "moment" only in explanations).

**Deliverables**
- [ ] Readable references and one meaning for "event" (T20, T23) · *PR / verified by:* —
- [ ] Musical notation (T43 slice) · *PR / verified by:* —
- [ ] Readability floor (T64, T38 and T31 slices) · *PR / verified by:* —

**Exit criteria**
- [ ] **P2-4** A DOM audit finds no grid or timeline text node under 11 px. · *PR / verified by:* —
- [ ] **P2-8** Compare diff counts: "Sounds moved" is at most the Sound count, and pads changed are counted by unique pad key (the C7 case of "11 voices moved" with 7 Sounds). · *PR / verified by:* —
- [ ] **P2-9** The FACTOR_META grep test passes, and Learn More's factor list renders from FACTOR_META. · *PR / verified by:* —
- [ ] **P2-12** Compare, Library and verdict text contain no "lane_" or raw voice ids. · *PR / verified by:* —

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

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P1a · Stop losing work

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

### P1b · Stop false verdicts and broken overlays

- Date: —
- Commit: —

| Criterion | Result | Evidence |
|---|---|---|

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

- **2026-09-24 · S1a.2 · One PR.** The session's branch is fixed (`claude/pushflow-ui-roadmap-lzjvda`), so the runner and "Generate only proposes" land as ordered commits in one PR. Approved by: none needed; flagged in the PR.
- **2026-09-24 · S1a.2 · Candidates also count as "still recoverable".** The roadmap keeps a draft whose hash differs from Active, the incoming layout and every saved variant. A draft equal to a listed candidate is also not kept, so previewing one candidate after another (or Restore after a Preview) doesn't fill Recovered drafts with copies of candidates that are still in the list.
- **2026-09-24 · S1a.2 · Generate selects no candidate.** SET_CANDIDATES used to select candidate #1, which made the grid show it (layoutOverride) over the untouched draft. It now selects none, so "the grid and draft are untouched" holds; the trace panel falls back to the top-ranked candidate's iteration trace until one is previewed, so the trace stays visible after a run. S3.2's auto-inspect replaces this.
- **2026-09-24 · S1a.2 · The backup lives in IndexedDB; the download is manual.** The prompt's "automatic backup export per project" (roadmap wording) is the IndexedDB `backups` store plus the Library's "Download backup" button, as the session prompt specifies ("No automatic file downloads").
- **2026-09-24 · S1a.2 · putProject resolves on commit.** The C2 reload cases lost saves about 1 run in 20. putProject resolved when its put request succeeded, before the transaction committed, and a reload in between aborted it; it now resolves on the transaction's complete event (and the new putBackup does the same). This is one line of S1a.4's truthful save, needed so "survives a reload" is true; the toolbar part stays with S1a.4 (see Follow-ups).
- **2026-09-24 · S1a.2 · saveAndReload waits for the stored record.** The e2e helper reloaded as soon as the toolbar said "Saved", which it says on click, before any write (T57). It now polls IndexedDB until the stored project has the current Sounds, layouts, variants and recovered drafts, then reloads. C2, C4 and C7: 170/170 over 5 repeats at both viewports.
- **2026-09-24 · S1a.2 · C7's setup previews a candidate.** C7 needed Generate to leave a differing draft; it now clicks Preview on candidate #1 after Generate to get one. The C7 cases stay expected-fail for S1b.3/S3.3.

## 6. Follow-ups

Record each one with the date, the session that found it, what and where (file:line or repro), and the session or phase it belongs to.

- **2026-09-23 · S0.1 · Delete the scratch branches.** `scratch/s0.1-red-typecheck`, `scratch/s0.1-red-unit` and `scratch/s0.1-red-e2e` (PRs #94–#96, closed) are still on the remote: the implementing session's git access could not delete branches other than its own. Delete them from the closed PRs. Owner: the repository owner.
- **2026-09-23 · S0.1 · e2e specs aren't type-checked.** tsconfig.json includes only src/, so test/ (vitest and Playwright specs) is never run through tsc; Playwright transpiles without checking. Add a tsconfig for test/ and run it in ci.yml. Belongs to: any P0/P1a session touching CI.
- **2026-09-23 · S0.1 · Node 20 actions deprecation.** CI warns that actions/checkout@v4, setup-node@v4 and upload-artifact@v4 target Node 20 and are forced onto Node 24 (all workflows, including the existing deploy.yml). Bump the action versions when newer majors are available. Belongs to: any session touching CI.
- **2026-09-23 · S0.2 · Toolbar Generate never sets the trace.** useAutoAnalysis.generateFull clears moveHistory (`SET_MOVE_HISTORY` with null) and neither branch sets it again, so MoveTracePanel is empty after every toolbar run (CLAUDE.md Do-Not-Regress: trace must stay wired to optimizer output). C4's Generate case compares an empty trace until this is fixed. Belongs to: S3.4 (trace per candidate).
- **2026-09-23 · S0.2 · Greedy Generate freezes the page for minutes.** With All Strategies, the greedy pipeline runs on the main thread and the page stops responding for several minutes in Chromium (about 40 s for the same work in node); even one strategy (Coordination) leaves the page unresponsive for about two minutes after its progress text clears. Belongs to: S3.4 (progress, Cancel and time budget).
- **2026-09-23 · S0.2 · Engine APIs keyed by MIDI pitch.** seedLayoutFromPose0 takes `existingVoices: Map<number, Voice>`, generateCandidates' pose0-offset strategy builds that map from `originalMidiNote` (multiCandidateGenerator.ts), and buildSolverConstraints falls back to noteNumber (useAutoAnalysis.ts). The TEST MIDI 1 gate no longer calls them with a pitch map, but the app's beam/annealing path still does. Belongs to: S1a.3 (strict Sound identity).
- **2026-09-23 · S0.2 · Deep annealing takes about 50 minutes.** Annealing Thorough on TEST MIDI 1 took 49.7 min in CI and 46.8 min locally for 3 candidates (the critique measured about 33.5 min in the browser). nightly.yml allows 180 minutes. Belongs to: S3.4 (time budget).
- **2026-09-23 · S0.2 · The top grid row is clipped at 1366×768.** Row 7 is partly hidden by the grid wrapper, so C1 right-clicks the visible part of each pad. Belongs to: S2.1 (measured grid, T04).
- **2026-09-23 · S0.2 · A pad edit during greedy Generate stalls the run.** In Chromium, greedy Generate with the Exploratory strategy finishes in about 17 s, but after a pad edit mid-run it had not finished after 10 minutes (the page stays responsive; a CPU profile shows the time inside greedyOptimizer.runSingleAttempt). Probably tied to the run racing the edited draft; re-check once S1a.2 stops Generate writing the draft. Belongs to: S1a.2, else S3.4.
- **2026-09-24 · S1a.1 · Multi-file import reads stale state.** useLaneImport computes currentMaxOrder, the group colour and "first import" from the state captured when the import starts, so every file of a multi-file import gets the same orderIndex base and colour, and each may set the tempo (useLaneImport.ts, the transact('Import') loop). Pre-existing; now one undo step. Belongs to: S5.2 (import review).
- **2026-09-24 · S1a.1 · Rename/recolour also rewrite session copies.** RENAME_SOUND and SET_SOUND_COLOR update the names embedded in candidates and analysisResult (session). Undo restores the document's names but not those copies, so a candidate card can show the undone name until the next Generate. Belongs to: S1b.3 (per-layout analysis cache) or S3.2.
- **2026-09-24 · S1a.1 · C5 unexpectedly passed twice locally.** At 1366, C5's "onion skin changes grid pixels" (expected-fail until S1b.4) passed 2 of 54 local runs on this branch and 0 of 48 on main, and could not be reproduced in 30 instrumented runs (no state or history change between the two screenshots). A C6 case also timed out once under full-suite load and passed 6 reruns. If CI shows either again, investigate before merging. Belongs to: S1b.4 (C5/C6 flip there).
- **2026-09-24 · S1a.1 · The Library screenshot fails locally.** library.spec.ts differs by about 1 % of pixels in a cloud container on main and on this branch; the baselines are CI-generated (CLAUDE.md), so it passes only in CI. No action unless CI fails it.
- **2026-09-24 · S1a.2 · Recovered drafts aren't in the Library card or the reopened-draft banner.** A project whose only copy of some work is a recovered draft looks the same in the Library as any other. Belongs to: S2.3 (Library card) and S5.4 (reopened-draft banner).
- **2026-09-24 · S1a.2 · "Saved" shows before the save.** WorkspaceToolbar's handleSave sets saveConfirm ("Saved") on click, before saveNow's write, and saveNow returns without saving when an autosave is in flight, whose completion then marks the newer state saved. Belongs to: S1a.4 (truthful save, T57).
- **2026-09-24 · S1a.2 · Only the newest backup per starting version is kept.** A second migration from the same version (only possible if the first never wrote back) overwrites the backup; backups are never pruned. Revisit when S1a.4 adds the next migration. Belongs to: S1a.4.
