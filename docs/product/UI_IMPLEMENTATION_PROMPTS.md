# PushFlow UI Roadmap — Implementation Prompts

*Companion to [UI_ENHANCEMENT_ROADMAP.md](UI_ENHANCEMENT_ROADMAP.md), [UI_ISSUE_REGISTER.md](UI_ISSUE_REGISTER.md) and [UI_CORE_FLOWS_CRITIQUE.md](UI_CORE_FLOWS_CRITIQUE.md).*

Copy-paste prompts for the agent sessions that implement the roadmap. Each prompt is short because the detail already lives in the roadmap (deliverables, exit criteria, risks) and the register (root causes with file:line). The shared rules below apply to every implementation session, and every prompt points the agent at them.

## How to use these

1. **Run [Prompt 0](#prompt-0--record-decisions-and-create-the-progress-tracker) first and merge its PR.** It records your answers to decisions Q1–Q7, your working mode (solo or team) and which optional items to cut, and creates `docs/product/UI_ROADMAP_PROGRESS.md` — the shared tracker every later session reads and updates.
2. **Then either** paste the [Continue prompt](#continue-prompt-reusable) into each new session (it picks the next unblocked session from the tracker), **or** paste a specific [session prompt](#session-prompts) when you want to choose. The Continue prompt assumes one session at a time; for parallel work, paste specific session prompts.
3. **One session = one work package** (usually 1–4 small PRs). Merge a session's PRs before starting any session that lists it as a prerequisite.
4. **After each phase**, run the [Phase audit prompt](#phase-audit-prompt).
5. Sessions marked **∥** can run in parallel with the ones named. Parallel branches still touch shared files (`InteractiveGrid.tsx`, `UnifiedTimeline.tsx`, `projectState.ts`), so merge the first to finish, then merge `main` into the other before its PR.

**Solo "trust release"** (recommended first milestone): Prompt 0 → S0.1–S0.2 → S1a.1–S1a.5 → S1b.1–S1b.4 → S2.1, S2.2a, S2.2b, S2.3, S2.4 → S3.1–S3.3. This is a little larger than the roadmap's minimal cut line; for the bare minimum, do S2.1, S2.2a, the Library-card part of S2.3, S2.4, S3.2 and the Single Promote part of S3.3.

---

## Rules for every implementation session

**Before coding**

1. Read CLAUDE.md, the four canon docs in `docs/canonical/`, and in `UI_ENHANCEMENT_ROADMAP.md` the **Principles** plus your phase **in full** (goal, why now, deliverables, exit criteria, risks). For each theme your session names, read its entry in `UI_ISSUE_REGISTER.md` (`#t01` … `#t70`); it has the root cause with file:line and the source findings.
2. Read `docs/product/UI_ROADMAP_PROGRESS.md`: recorded decisions Q1–Q7, working mode and cuts, each session's status, the criterion → session table, deviations and follow-ups. Don't redo finished work. If a prerequisite session isn't *Done*, stop and report that instead of working around it. Set your session's status to *In progress (branch name)* in your first PR.
3. Re-confirm each problem on current `main` before fixing it (line numbers will have moved). Where a reproduction exists, run it: the `test/e2e/c*.spec.ts` specs from S0.2 onward, or `scripts/ui-critique-repros/` before that.

**While coding**

- **Scope.** Implement only your session's deliverables, as the roadmap describes them, and own only the exit criteria the tracker assigns to your session. Anything else you find goes under *Follow-ups* in the tracker, not into your diff.
- **Slices.** One PR per deliverable where practical, each shippable on its own and leaving the app better. Aim for under ~400 lines of non-test diff per PR. When a session needs several PRs in order, stack them (base each on the previous one's branch and say so in its description); never merge them yourself.
- **Invariants.** CLAUDE.md's Product Invariants, Core Functionality Preservation Contract, Do-Not-Regress and UI Non-Regression rules all apply. If a deliverable seems to need breaking one, stop and ask; don't reinterpret the rule.
- **Optimizer, solver or solver-input changes** (anything that changes what Greedy, Beam or Annealing receive or return): follow CLAUDE.md's Solver Change Checklist. TEST MIDI 1 must report 0 unplayable events for all three methods, and the lock case must hold (from S1a.3). Keep seed-0 determinism, restart and seeded-noise behaviour, trace shapes (unless the roadmap says otherwise), and `stopReason`. Reset `isProcessing` on success and on error. MoveTracePanel, CandidatePreviewCard and the cost panels must still render. CLAUDE.md also names a PerformanceAnalysisPanel, which no longer exists; say so in the PR rather than hunting for it.
- **Learn More.** Any change to a metric, verdict tier, constraint, weighting or factor name updates `LearnMoreModal.tsx` in the same PR (invariant 2), and extends the Learn More sync test once it exists (S1b.1).
- **Words.** Use canon terms: Active Layout, Working/Test Layout, Candidate Solution, Saved Layout Variant, Performance Event, Sound. Follow the recorded Q3 (naming) and Q7 (event vs moment) decisions.
- **Stored data.** From S1a.2 on, any change to the persisted format goes through the migration runner, with a backup and a test that running it twice changes nothing. Before S1a.2, don't change the stored format at all.
- **State.** Analysis-only state never becomes project truth, and derived state never enters undo history (from S1a.1).
- **Mode and cuts.** Where a prompt depends on solo vs team mode or on an optional cut, follow what the tracker records. Ask only if it isn't recorded.

**Before every push**

- Run `npm run typecheck` and `npm run test:run`. From S0.1 on, also run `npx playwright test` at 1366×768 and 1600×1000. In a cloud session, prefix the command with `PW_CHROMIUM=/opt/pw-browsers/chromium`, because the preinstalled browser differs from Playwright's default. If Playwright still can't launch, say so in the PR and rely on the CI run. Never skip specs.
- If your fix makes any expected-fail test pass, remove its marker in the same PR. That covers C1–C9 cases, the FeasibilityBadge component test, and the TEST MIDI 1 lock or strict-0-unplayable cases. Never weaken, skip or quarantine a test to get green.
- UI changes need before/after screenshots at 1366×768 and 1600×1000. Save them as the Playwright CI artifact, or commit them under `docs/screenshots/<session-id>/` if small, and link them from the PR description. Committed screenshots are review evidence, not permanent docs: once a phase's audit has merged, the next session's first PR moves that phase's session folders and its `audit-<phase>/` folder out of the tree, as described in [docs/ARCHIVE.md](../ARCHIVE.md#keeping-the-tree-lean).
- Re-read your diff for anything that would break CI or an invariant.

**Finish**

- In `UI_ROADMAP_PROGRESS.md`, tick only the items your PR delivers, with how you verified each; add the PR number in a follow-up commit once the PR exists. Record deviations and follow-ups. Set the session to *Done* only in its last PR.
- PR description: themes addressed, exit criteria met and how verified, invariants touched, screenshot links, residual risks.
- If you run out of room, stop at a clean PR boundary, record exactly what's left in the tracker, and say so.

---

## Prompt 0 — Record decisions and create the progress tracker

```text
Read docs/product/UI_IMPLEMENTATION_PROMPTS.md, the "Decisions needed from you" table in
docs/product/UI_CORE_FLOWS_CRITIQUE.md (section 4), and the Q1–Q7 open questions in
docs/product/UI_ENHANCEMENT_ROADMAP.md.

My decisions ("default" means: use the recommendation in the critique's section 4 table):
- Q1 (does the Working/Test Layout persist across reloads): default
- Q2 (do finger preferences survive Discard): default
- Q3 (may default Sound names use MIDI pitch): default
- Q4 (one-click Suggest / Place remaining N / read-only auto-inspect vs invariant 7): default
- Q5 (single headline score and evaluator): default
- Q6 (Pattern Composer model): default
- Q7 ("event" vs "moment" in UI labels): default
- Working mode: solo   (solo = no feature flags; use short-lived branches.  team = flags)
- Cuts: S4.4 volume/audition/hands filter: keep | S5.4 compare-and-swap + tab banner: keep |
  S7.1 flag rollout: per mode | S8.3: do

Create docs/product/UI_ROADMAP_PROGRESS.md containing:
1. Decisions: each Q with my answer and the resolved behaviour in one or two sentences, plus
   the working mode and cuts, each with the sessions it affects.
2. One section per session S0.1 … S8.3 (as listed in UI_IMPLEMENTATION_PROMPTS.md), each with
   a "Status: Not started | In progress (branch, open PRs) | Done | Skipped (reason)" line,
   its prerequisites, its roadmap deliverables, and its exit criteria, all unchecked, each with
   a "PR / verified by" slot.
3. A "Criterion → session" table covering every exit criterion of every phase in
   UI_ENHANCEMENT_ROADMAP.md, each assigned to exactly one session: first by the session
   prompt's "Done when", otherwise to the session whose deliverable it tests, and to the later
   session if it needs work from two. List every assignment you had to infer, and every
   criterion that two prompts both claim, in the PR description for me to review.
4. A "Phase audits" section with one subsection per phase (date, commit, and pass/fail plus
   evidence per criterion), empty for now.
5. Empty "Deviations" and "Follow-ups" sections.

Some recorded decisions contradict the current wording of CLAUDE.md or a canon doc:
- at defaults, Q1 contradicts CLAUDE.md's Default Decision Handling ("Working/Test Layout is
  session-scoped unless saved or promoted");
- Q3 contradicts canon section 10 ("It is stripped from the sound");
- Q4 bears on invariant 7 ("The user must manually place each sound");
- Q7 contradicts nothing unless "moment" becomes a UI label.
For each one that applies, change only the affected sentences, never loosen an invariant beyond
what the decision states, and quote before/after in the PR description for my approval. For
Q4, propose: "Nothing is placed or fingered without a named user action. Import, Generate and
analysis never place Sounds. 'Suggest a starting layout' and applying a candidate are explicit
one-click actions, each one undo step; 'Place remaining N' produces a candidate."
Docs only — no code changes. Open a PR.
```

---

## Continue prompt (reusable)

```text
Continue implementing the PushFlow UI roadmap, following the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md ("Rules for every implementation session").
1. If docs/product/UI_ROADMAP_PROGRESS.md doesn't exist on main, stop and tell me to run
   Prompt 0 and merge its PR.
2. List open pull requests. Treat any session with an open PR, or marked "In progress" in the
   tracker, as in progress: skip it, and tell me to merge it before any session that depends on
   it. Skip sessions marked "Skipped".
3. If every session of a phase is Done but that phase has no recorded audit, suggest running
   the Phase audit prompt first.
4. Otherwise pick the first session (in S0.1 … S8.3 order) that isn't Done and whose
   prerequisites are all Done, mark it "In progress" in your first PR, and implement its
   remaining deliverables using that session's prompt in UI_IMPLEMENTATION_PROMPTS.md.
Tell me which session you picked and why, then go ahead without waiting. If that session's
prompt says to ask or confirm with me first, or nothing is unblocked, stop and say so.
```

---

## Session prompts

Each prompt names roadmap deliverables by their headings in `UI_ENHANCEMENT_ROADMAP.md`. "Flips" means the expected-fail test cases the session must turn green.

### Phase P0 · Safety net

#### S0.1 — Test runner, CI, hooks and fonts
*Prereqs: Prompt 0 merged.*

```text
Implement roadmap phase P0 deliverables "Playwright runner", "Test hooks", "Component tests",
"CI", "Deterministic fonts and screenshots", "Fixtures" and "Flags" (only if the tracker records
team mode; otherwise skip Flags). Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Pin @playwright/test to the installed playwright version. playwright.config.ts must honour
  PW_CHROMIUM as launchOptions.executablePath, as scripts/ui-critique-repros do; document
  `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` for cloud sessions.
- Generate screenshot baselines in CI (a workflow_dispatch update-snapshots job), not locally.
  Add one Library screenshot spec at both viewports as the first baseline.
- The window.__pf test hook exists only when VITE_E2E is set; add a check that it is absent
  from dist/.
- ci.yml runs typecheck, vitest (node + happy-dom) and Playwright (Chromium, 1366x768 and
  1600x1000) on every pull request and push to main. Create nightly.yml (schedule +
  workflow_dispatch) running the Firefox project; S0.2 adds deep annealing to it. deploy.yml
  also runs typecheck and unit tests before building.
- Self-host Inter and Space Grotesk; block fonts.googleapis.com in e2e. Keep the archive copy
  of TEST MIDI 1 where CLAUDE.md points.
- Write the FeasibilityBadge component test as expected-fail on the "feasible" default (S1b.1
  flips it).
Verify "CI turns red" with three draft PRs from scratch branches (one typecheck failure, one
unit failure, one e2e failure); link the red runs in the tracker, then close the PRs and
delete the branches.
Done when the P0 exit criteria for CI turning red, identical screenshots with fonts blocked,
the FeasibilityBadge test existing (expected-fail) and running, the axe smoke spec, and
"no window.__pf in dist/" pass.
```

#### S0.2 — C1–C9 regression specs and the TEST MIDI 1 gate
*Prereqs: S0.1.*

```text
Implement roadmap P0 deliverables "C1-C9 as specs" and "Extended TEST MIDI 1 gate". Follow
the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Turn each probe in scripts/ui-critique-repros/C1..C9 into test/e2e/c<N>-*.spec.ts. Each spec
  asserts the CORRECT behaviour as separate test() cases, one per staged fix. Each case gets
  its own test.fail() and a comment naming the session that flips it:
  - C2: S1a.2 cases (draft hash unchanged after Generate; an edit made during a run is kept;
    the draft is recoverable after Preview, card-body click, Load Draft and Promote) and an
    S3.2 case (Preview/Inspect never writes workingLayout).
  - C7: S1b.3 cases, plus an S3.3 cache case.
  - C9: S1b.4 refuse-first cases, plus S8.2 end-to-end cases.
  - Every other spec flips in one session (see the session prompts' Flips lines).
- Assertions check the specific wrong value (e.g. badge text === "Feasible"), not just that an
  element exists. Verify each case by running it once with its marker removed, and paste the
  failing assertion next to the register's root cause in the PR description.
- Use the S0.1 hook and data-testids, extending window.__pf (e.g. undo/redo depth) and adding
  testids as needed, still VITE_E2E-only. Never read React internals.
- The C3 spec runs greedy, beam and annealing Quick only; deep annealing goes in the nightly job.
- In test/engine/optimization/testMidi1Integration.test.ts:
  - add an annealing Quick case;
  - add strict 0-unplayable assertions for all three methods, replacing playableRatio > 0.5;
  - add a lock case at [7,0] per method: greedy as a normal passing test (it already honours
    locks), beam and annealing marked it.fails until S1a.3 (confirm current results first);
  - add seed-0 snapshots per method;
  - build Sounds through the app's import path, so ids come from import and no map is keyed
    by MIDI pitch.
  Don't change engine signatures here; record any engine API that needs pitch keys as an S1a.3
  follow-up. If a method fails the strict check today, mark it expected-fail and record it as
  an S1a.3 blocker — never loosen an assertion. Add deep annealing to nightly.yml and record
  its duration.
Done when the corresponding P0 exit criteria pass and every C-case fails today for its
documented reason.
```

### Phase P1a · Stop losing work

#### S1a.1 — Undo covers only your edits, plus the toast
*Prereqs: S0.2. Flips: C4.*

```text
Implement roadmap P1a deliverables "Undo on the document only (T02)" and "Toast region
primitive (T31 slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Split ProjectState into a document slice (undoable) and a session slice (never in history),
  starting from the roadmap's lists and classifying every other field too. User-edited
  project content goes in the document: laneGroups, sourceFiles, sections, instrumentConfig,
  voiceProfiles. Analysis, transport, loop/speed/count-in, selection and trace go in the
  session. Undo membership is separate from persistence: a field can be saved with the project
  and still be session state (e.g. costToggles, loop settings). Put the full field table in
  the PR and the tracker.
- moveHistory, moveHistoryIndex and moveHistoryStopReason go in the session slice but stay
  readable at state.moveHistory* (or update MoveTracePanel and PerformanceWorkspace in the same
  PR). MoveTracePanel must stay wired to the trace (CLAUDE.md Do-Not-Regress).
- Keep the stored project format unchanged; the migration runner only arrives in S1a.2. The
  split is in memory only. Add a round-trip test: a project saved by current main loads and
  re-saves with identical document fields. If a format change seems unavoidable, stop and ask.
- Land the slice split and the transaction wrapper as separate PRs, split first. The wrapper
  makes Suggest, an import, a Ctrl/Cmd+G grouping, Discard, Promote and apply-candidate one
  undo step each. No-op reducer results record nothing, opening a project starts with empty
  history, and the Undo/Redo buttons name their target.
- isProcessing still resets on success and error.
Done when the P1a reducer-test exit criteria pass and C4 is flipped, with one exception: until
S1a.2 removes Generate's auto-apply, the Generate case reads "one Undo after Generate reverts
the auto-applied candidate as a single step and keeps the candidate list and trace". S1a.2
changes that test to "undoes the previous user edit".
```

#### S1a.2 — Migration runner; Generate only proposes; Recovered drafts
*Prereqs: S1a.1, and decisions Q1 and Q2 recorded. Flips: the S1a.2 C2 cases (the Inspect case flips in S3.2).*

```text
Implement roadmap P1a deliverables "Migration runner" and "Generate only proposes (T01
slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Build the runner: schemaVersion plus ordered, idempotent migrations. The backup is the
  pre-migration PersistedProject JSON, written to a separate IndexedDB store keyed by
  projectId + fromVersion before any migration step runs, plus a "Download backup" action on
  the project. No automatic file downloads. Its only real migration here is the one the
  Recovered drafts store needs. Do not write the ghost-lock migration (S1a.4) or the preset
  migration (S1a.5).
- Delete the APPLY_GENERATION_TO_LAYOUT dispatches in useAutoAnalysis, and stop card-body
  clicks from previewing. Before Preview, Load Draft or a candidate/variant Promote replaces a
  differing draft, auto-keep it into a separate "Recovered drafts" group (deduped, capped at 5)
  and announce it with a toast offering Restore. Whether the draft and Recovered drafts
  survive a reload follows recorded decision Q1.
- Show every saved variant (remove the slice(-3) limit). Generate on an empty grid places
  nothing (invariant 7).
- Update S1a.1's Generate-undo test to "undoes the previous user edit".
Done when the P1a exit criteria for C2, recovered drafts and empty-grid Generate pass, plus a
runner test showing that the backup is written before any migration, migrations run in order,
and a second run changes nothing.
```

#### S1a.3 — Locks honoured by every method; strict Sound identity  ∥ S1b.1, S1b.2, S1b.3
*Prereqs: S1a.1. Flips: C3 and the S0.2 beam/annealing lock cases.*

```text
Implement roadmap P1a deliverables "Locks honoured and identity strict (T11, T18)" and the
P1a "Learn More (invariant 2)" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md. This is an optimizer change, so the full Solver
Change Checklist applies.
- Beam and Annealing pre-place locked Sounds and carry placementLocks through seeding,
  compaction and mutation. Post-validate every candidate and drop violators with a stated
  reason. Locked pads refuse drag-out and drop-onto.
- Remove every MIDI-pitch fallback that matches Sounds to pads (the roadmap lists them), so an
  unplaced Sound stays unmapped even when another Sound shares its pitch. Show a one-time
  "Scores changed" note.
- Keep all three methods, greedy restarts and seeded noise.
Done when all of these pass:
- C3 and the lock case, for greedy, beam and annealing Quick;
- TEST MIDI 1 reports 0 unplayable events for every method;
- seed-0 output is identical twice, with trace shapes unchanged;
- an unplaced Sound that shares a pitch has its events unmapped;
- no Composer lane matches a pad by pitch;
- Learn More's Constraints section lists lock enforcement for all three methods (assert it
  directly if S1b.1's sync test isn't merged yet).
```

#### S1a.4 — Discard hygiene, freshness, mute can't delete, truthful save
*Prereqs: S1a.2, S1a.3, and decisions Q1 and Q2 recorded.*

```text
Implement roadmap P1a deliverables "Discard hygiene (T12)", "Freshness slice (T14)", "Mute
can't delete (T15 slice)" and "Truthful save (T57 slice)", plus the ghost-lock migration
listed under "Migration runner". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Finger preferences on Discard follow decision Q2.
- Truthful save covers the Working/Test Layout per decision Q1. "Saved" appears only after a
  successful write; failures show a persistent "Couldn't save · Retry · Export a copy".
  Pending saves flush on pagehide, and Cmd/Ctrl+S saves. Export includes the Composer's
  pattern, with a "Composer pattern included" toast and an export/import round-trip test.
- Generate never removes an already-placed Sound, even when it is muted. Pinning muted placed
  Sounds changes optimizer input for all three methods: reuse S1a.3's lock pre-placement and
  run the full Solver Change Checklist.
Done when the matching P1a exit criteria pass:
- Discard leaves no ghost locks, and fingerConstraints re-derive from voiceConstraints;
- a lock toggle marks the analysis stale, and a self-drop records nothing;
- a muted placed Sound keeps its pad;
- a mocked write failure never shows "Saved";
- the ghost-lock fixture is migrated only after its backup exists, and re-running changes
  nothing.
```

#### S1a.5 — Composer data can't be lost
*Prereqs: S1a.2, S1a.3.*

```text
Implement roadmap P1a deliverable "Composer data slice (T60, T66, T67)" and the
preset-fingering migration listed under "Migration runner". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Keep both drawer tabs mounted. The inactive one is hidden and inert, and Composer key
  handlers run only while its tab is active.
- The Timeline must re-measure when its tab becomes visible (CLAUDE.md Timeline rule: it fills
  its container width). Add a spec: switch to Composer, resize the window, switch back, and
  the ruler width equals the container width.
- Flush pending Composer saves and syncs on Stop and on unmount, and take the playhead out of
  the save/sync effect deps.
- Composer sync writes notes only, never a Sound's name, colour or mute.
- Composer finger edits go through voiceConstraints, keyed by the lane's project Sound id, and
  can be cleared (invariant 6).
- Clear gets an Undo toast.
- The Pattern Composer tab stays in the bottom drawer (invariant 3).
Done when the P1a Composer exit criteria pass:
- an edit survives a fast tab switch and a reload, and playback continues across the switch;
- M does nothing in the Composer while the Timeline tab is shown;
- renames survive Composer edits;
- a Composer finger edit shows in the Sounds panel and can be cleared;
- Undo after Clear restores the notes, Sounds and pads;
- presets with invented fingering are flagged unverified, and their fingering is not applied.
```

### Phase P1b · Stop false verdicts and broken overlays

#### S1b.1 — Honest verdict, shared moment grouping, factor registry  ∥ S1a.2–S1a.5
*Prereqs: S0.2. Flips: C6 and the FeasibilityBadge component test.*

```text
Implement roadmap P1b deliverables "Shared moment grouping (T22 base)", "FACTOR_META registry
(T20 base)", "Honest verdict (T07, T15 scope line)", "False claim fix" and "Learn More sync".
Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- groupIntoMoments and a stable momentKey live in src/engine and are exported from @/engine.
  Moment cost is aggregated once per moment.
- FeasibilityBadge falls back to "Unknown", never "Feasible". The whole-layout verdict stays
  pinned, and the selected moment gets its own card showing all five factors from FACTOR_META.
  Every verdict carries a scope line.
- The Learn More sync test renders the Constraints section and the verdict tiers from the same
  lists the solvers and the badge use, including lock enforcement for Greedy, Beam and
  Annealing.
Done when the P1b exit criteria for C6, chord cost, the groupIntoMoments tests, the "low
overall difficulty" claim and the Learn More sync test pass.
```

#### S1b.2 — One dialog/popover primitive; pad menu at the cursor  ∥ S1a.2–S1a.5
*Prereqs: S0.2. Flips: C1.*

```text
Implement roadmap P1b deliverable "Dialog/Popover primitive (T06)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- One primitive that portals to document.body and sets role, aria-modal and aria-labelledby.
  It traps focus, closes on the first Escape and on outside click, clamps inside the viewport
  and returns focus to the trigger.
- Give pads tabIndex=-1 and an aria-label so focus can return to them.
- Migrate PadContextMenu (opening at the cursor), the enlarged chart, View all, Compare (every
  state gets Close) and Learn More.
- Add a spec per migrated overlay, because portals can break outside-click and drag ghosts.
Done when C1 passes at 1366x768, 1600x1000 and 1920x1080 for all 64 pads and the first Escape
closes every migrated overlay.
```

#### S1b.3 — Compare evaluates Active properly; per-layout analysis cache  ∥ S1a.3–S1a.5
*Prereqs: S1a.1, S1b.2. Flips: the S1b.3 C7 cases.*

```text
Implement roadmap P1b deliverable "Compare stop-gap and analysis cache (T08 slice)". Follow
the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Add getAnalysisForLayout(layoutHash, performanceHash, costToggles, evaluatorId): an
  in-memory, capped LRU of plans and diagnostics. It is analysis-only and never persisted.
- Compare evaluates a missing Active plan through it ("Analysing Active…") and never renders
  the zero stub; on failure it shows "Couldn't analyse".
- Compare derives its compare set from current ids and prunes it on SET_CANDIDATES, delete and
  promote. It is disabled below two distinct layouts, and Promote inside Compare closes it with
  a toast.
Done when the P1b C7 exit criteria pass, including "served from the cache without re-solving"
and "storage unchanged".
```

#### S1b.4 — Moment view, input safety and preset stop-gaps
*Prereqs: S1a.3, S1a.5, S1b.2. Flips: C5, C8, and the S1b.4 C9 cases.*

```text
Implement roadmap P1b deliverables "Moment-view stop-gaps (T09, T10, T61 slices)", "Finger
input safety (T19 slice)", "Delete scoping (T28 slice)" and "Preset safety (T65 slice),
refuse-first". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Remove the inline opacity and boxShadow that override the onion and previous-event classes,
  and update Learn More's onion-skin text to match.
- Suspend the selection overlay while playing and restore it on Stop. Selecting a moment while
  stopped moves the playhead there. Arrow keys do nothing while playing, for now.
- The finger field opens empty, with the solver suggestion as a reduced-opacity placeholder
  (CLAUDE.md finger display rule). Blur or Escape without typing changes nothing.
- Delete/Backspace no longer remove the selected event's pad.
- Preset drops: dragover and drag agree on "copy"; the handler is read through a ref;
  collisions and mirror are validated at drop time; and each card gets a visible Mirror
  toggle. A drop is accepted only when every preset pad's laneId resolves by id (directly, or
  through the S1a.5 lane→Sound link) to an existing project Sound, never by name or MIDI pitch.
  Otherwise refuse it with the roadmap's message. Save Preset leaves fingers blank.
Done when the P1b exit criteria for C5, C8, the refuse-first C9 cases (using a real native
drag), T19 and T28 pass.
```

### Phase P2 · Quick wins you can see

#### S2.1 — Measured grid, reachable transport, full-width timeline
*Prereqs: S1b.2.*

```text
Implement roadmap P2 deliverables "Measured grid (T04)", "Transport reach (T05, T56)" and "The
timeline fills its width (T50)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Remove transform: scale and GRID_NATURAL_SIZE. A ResizeObserver sets an integer --pad-size
  between 32 and 72 px. Label sizes stay fixed, and secondary labels hide on pads under 40 px.
- The timeline's height fits its content (capped at ~40% of the body), with a remembered,
  collapsible splitter. Its width always fills the container (CLAUDE.md Timeline rule).
- A fixed transport cluster (Play/Stop, Return, position, Speed, Loop, Metronome, Hits) is
  always visible; the rest collapses into an overflow menu.
- Desktop-only: size by measurement, with no breakpoints. Watch for ResizeObserver feedback
  loops and changed drag hit-testing.
Done when the P2 exit criteria for pad bounding boxes at both viewports and the 4-bar
timeline-width regression spec pass.
```

#### S2.2a — Tell Sounds apart
*Prereqs: S1b.1, and decision Q3 recorded.*

```text
Implement roadmap P2 deliverable "Distinct Sounds (T17 slice)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- A 16-hue colour-blind-safe --sound-1..16 palette, applied to new imports only; never
  recolour a user's choices.
- Default names follow decision Q3.
- An opt-in "Name from GM drum map" action as one undo step, offered in the post-import toast
  and the Sounds panel header for now (the per-row overflow menu arrives in S5.1).
- Pads trim the prefix all Sounds share and truncate in the middle over two lines.
- Rename by hover pencil or F2/Enter; Enter or Tab moves to the next Sound.
- MIDI pitch never drives placement (invariant 5).
Done when a TEST MIDI 1 import gives 7 pairwise-distinct colours and 7 distinct visible pad
labels, no note names appear unless the GM action was used, and existing projects' custom
colours are unchanged.
```

#### S2.2b — Readable names, notation and text
*Prereqs: S1b.1, and decision Q7 recorded.*

```text
Implement roadmap P2 deliverables "Readable references and one meaning for 'event' (T20,
T23)", "Musical notation (T43 slice)" and "Readability floor (T64, T38 and T31 slices)".
Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Every factor label and colour comes from FACTOR_META (add a grep test), and Learn More's
  factor list renders from it.
- Every user-visible voiceId or lane_ id resolves to a Sound name with a colour chip.
- Diffs count unique Sounds and unique pads, and counts use the event/moment wording from
  decision Q7.
- Positions read bar.beat.sixteenth and "Row 4 · Col 4", and Speed shows the effective BPM.
- Text is at least 11 px, the Tailwind alpha-token mapping is fixed, and disabled buttons show
  why they are disabled.
Done when the P2 exit criteria for text size, diff counts, the FACTOR_META grep test and
"no lane_ ids" pass.
```

#### S2.3 — Library you can trust; variants worth keeping; guidance and gear cleanup
*Prereqs: S1a.2, S1b.3.*

```text
Implement roadmap P2 deliverables "Library honesty and entry (T52, T51 slices, T53)",
"Variants worth keeping (T29)", "Guidance and copy (T44, T56)" and "Gear cleanup (T39
slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Library cards show real data only: bar length, event count, Sounds, BPM, and created and
  last-opened dates (the CLAUDE.md Project Library rule).
- Thumbnails draw from working ?? active, with a "Draft, not promoted" badge per decision Q1.
- The primary "Import MIDI" accepts .mid/.midi (and detects .pushflow.json by content), names
  the project after the file and places nothing (invariants 5 and 7). Add "Open demo project",
  which opens unplaced.
- The hero and the cards share one menu: Rename, Duplicate, Export, and Delete with ~10 s Undo.
- Save as variant prompts for a name. Variants are renameable and show scores from
  getAnalysisForLayout.
- Remove the dead "Organize by 4x4 Banks" toggle and the hidden "Duplicate Layout". Keep
  "Show Finger Assignment" working (CLAUDE.md rule).
Done when the P2 exit criteria for Library cards, Library MIDI import, the demo, variant
naming and scores, and delete-undo pass.
```

#### S2.4 — One input table: shortcuts, Space to play, click-to-place, Composer geometry
*Prereqs: S2.1, S1b.4.*

```text
Implement roadmap P2 deliverables "Shortcut registry and input table (T61 slice)",
"Click-to-place (T62 slice)" and "Composer geometry (T69 slice)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- One registry that ignores selects, inputs, contenteditable, menus and open dialogs. It holds
  the roadmap's table of every pointer and key meaning, with one test per row:
  - Space plays and stops everywhere except text fields;
  - Escape peels back one layer at a time;
  - "?" opens a sheet generated from the registry.
- Arm a Sound, then click an empty pad to place it as one undo step. This is an explicit user
  action, so invariant 7 holds.
- In the Composer, one cellWidth drives cells, bar lines and the playhead. Cells are at least
  16 px, with horizontal scroll, and toolbar controls have fixed widths.
Done when the P2 exit criteria for the input-table tests, Space with a focused button, placing
all 7 Sounds by click-to-place, and Composer bar-line alignment pass.
```

### Phase P3 · One inspected layout

#### S3.1 — Accessible primitive kit; one scoring yardstick
*Prereqs: S1b.3, S2.3, and decision Q5 recorded.*

```text
Implement roadmap P3 deliverables "An accessible primitive kit ships first (T63 part)" and
"One yardstick (T21 slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Tabs, ToggleButton (aria-pressed), Checkbox, IconButton (label required) and Card join the
  existing Toast and Dialog, and every new surface from here on uses them.
- Extend getAnalysisForLayout so the Q5 evaluator scores every displayed layout (Active, draft,
  candidates, variants) in a web worker, with the working layout on the same path. That way
  before/after Generate, Compare and the variant cards read the same numbers.
- Cap and fully key the cache, and show "Scoring…" per row.
Done when getAnalysisForLayout returns the same Playability for a layout on the working-layout
path and on the candidate path, a greedy candidate applied as the draft (through today's
Preview) scores the same before and after, variant cards and Compare read that value, and the
new primitives have role/state tests.
```

#### S3.2 — Look without overwriting: inspected layout, role actions, state bar
*Prereqs: S3.1, S2.1, S2.4, S1a.2, S1b.4, and decision Q4 recorded. Flips: the S3.2 C2 case.*

```text
Implement roadmap P3 deliverables "inspectedLayout selector", "After a run, candidate A is
auto-inspected read-only", "Explicit role actions", "Layout-state bar (T03)" and "Clean
names (T32)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Inspecting Active, a candidate or a variant renders read-only through layoutOverride with
  its own plan, and never writes workingLayout.
- Block every edit path while inspecting (drag, context menu, click-to-place, Delete), with one
  test per path.
- Preview becomes Inspect; retire the P1a Preview auto-keep.
- "Use as my draft" offers "Save my draft as a variant first" or "Replace (undoable)". Here the
  state-bar Promote and Keep buttons call the existing Promote and Save-as-variant actions;
  S3.3 unifies Promote and adds Keep.
- Auto-inspecting candidate A after Generate follows decision Q4.
- A fixed ~40 px unscaled bar above the grid shows a role chip (canon terms), the name, the diff
  against Active, freshness, and only that role's actions.
- One SubjectChip heads Analysis, Events, the inspector, the chart modal, both Compare sides
  and the timeline. Timeline pills use the inspected layout's fingering but still read
  hand+finger ("L2"); a note click still selects its whole moment; and "Show Finger
  Assignment" shows the inspected layout's plan (CLAUDE.md Timeline and Finger Assignment
  Display rules).
- Layout roles move out of layout names via a migration.
Done when all of these pass:
- the P3 criterion "inspecting 20× leaves the draft hash unchanged";
- role labels at both viewports;
- timeline fingering;
- after the migration, no stored layout name contains "(draft)" or "(suggested)", and a re-run
  changes nothing.
```

#### S3.3 — One Promote; Unfinished not failed; fill-in, Compare and Keep
*Prereqs: S3.2, and decision Q4 recorded. Flips: the S3.3 C7 cache case.*

```text
Implement roadmap P3 deliverables "Single Promote (T13)", "Freshness rules (T14)",
"Unfinished, not failed (T25)", "Explicit fill-in (T37)", "Compare on the cache (T08 full)"
and "Keep candidates (T30)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- One Promote action everywhere. It acts at once with an Undo toast, and the replaced Active is
  auto-saved as a variant. A pad map matching a candidate promotes as that candidate, with its
  reviewed plan. Keep plan staleness detection correct when rebinding, and keep the promoted
  candidate's trace and stopReason visible in MoveTracePanel.
- Staleness is triggered only by real inputs.
- Verdicts gain "Unfinished" ("5 of 7 Sounds placed"), and only placed material is scored.
  Unplaced notes stay visible, outlined, in the timeline (invariant 4).
- "Place remaining N" follows Q4: it proposes a candidate and never places Sounds directly.
- Compare never shows a stub, and candidate letters stay stable.
- "Keep" saves a candidate as a Saved Layout Variant; candidates themselves stay unpersisted.
- Update Learn More's verdict tiers.
Done when these P3 exit criteria pass: identical Promote results; C7 on the cache, including a
greedy candidate scoring the same before and after "Use as my draft"; freshness; the 3-of-7
"Unfinished" case; and the Learn More sync test covering the Unfinished tier.
```

#### S3.4 — Generation progress, Cancel and time budget; trace per candidate
*Prereqs: S3.3.*

```text
Implement roadmap P3 deliverables "Generation progress and time budget (T35)", "Trace
follows the candidate (T33 slice)" and the P3 "Learn More" Lifecycle section. Follow the rules
in docs/product/UI_IMPLEMENTATION_PROMPTS.md. This is an optimizer change, so the full Solver
Change Checklist applies.
- Show progress with an ETA from measured iterations per second.
- Cancel sets an abort flag checked at the existing yield points. It commits atomically, with
  stopReason "cancelled" and isProcessing reset.
- Annealing gets an iteration budget and a wall-clock budget. Both keep every restart and the
  temperature schedule; the wall-clock budget stops the run with stopReason "time_budget", and
  both are recorded in telemetry.
- Every candidate stores its own trace and stopReason. Traces survive promotion, and
  MoveTracePanel stays bound to state.moveHistory.
Done when the P3 exit criteria for Cancel, the budget stop, seed-0 determinism under the
iteration budget, nightly deep annealing within its budget, and stopReason being visible for
all methods pass, and the Learn More sync test covers the Lifecycle section.
```

### Phase P4 · Find it, understand it, rehearse it

#### S4.1 — One identity for each performance event
*Prereqs: S1a.3, S1b.1, and decision Q7 recorded.*

```text
Implement roadmap P4 deliverable "Single moment identity (T24)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md. Solver output changes, so the full Solver Change
Checklist applies.
- Give eventIndex the same meaning in both solvers, and add an explicit momentIndex derived
  from groupIntoMoments.
- Store the selection as a momentKey and re-resolve it when the plan changes.
- Placeholder pills for excluded streams select by moment time, so clicking any timeline note
  still highlights its whole moment (CLAUDE.md Timeline rule).
- Labels follow decision Q7.
- Update every consumer of eventIndex/momentIndex (grep src/ui). That includes at least
  MoveTracePanel, CandidatePreviewCard, EventsPanel, EventCostChart, CostBreakdownBars,
  PerformanceCostsPanel and UnifiedTimeline.
Done when selecting any of the 32 TEST MIDI 1 events, under a beam plan and a greedy plan,
highlights the same pads and notes on the grid, list, timeline and chart; the selection
survives re-analysis; and TEST MIDI 1 still reports 0 unplayable events.
```

#### S4.2 — Moment view, Events list and docked inspector  ∥ S4.3a
*Prereqs: S4.1, S2.4, S3.2.*

```text
Implement roadmap P4 deliverables "Rebuilt moment view (T09)", "Hand tokens and finger
notation (T42 part)", "Pad vs moment selection (T28)", "Events list for finding problems
(T27)" and "Docked moment inspector under the grid (T27)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Struck pads keep their Sound's colour and name and gain a hand ring and a finger badge.
  Next and previous strikes get outlines. During playback the playhead drives the same overlay.
- One Now | Now+Next | Prev·Now·Next control replaces the onion and arrow toggles.
- A pad click opens a pad inspector. With a moment selected, it highlights that Sound's hits
  without moving the moment. Update the input table and its tests.
- Events rows show bar.beat, Sound chips, finger chips and a text difficulty badge. They are
  grouped by bar, with filters and Prev/Next hard.
- The inspector lists every strike, gives a one-sentence "why it's hard", and shows the five
  factors from FACTOR_META.
- Update Learn More's view-mode text.
Done when the P4 exit criteria for the three view modes, the filter chips and Prev/Next hard
pass, the pad-click-with-a-moment input-table row passes, and with a moment selected Play shows
full-intensity flashes and the next-finger preview.
```

#### S4.3a — A DAW-grade transport  ∥ S4.2
*Prereqs: S4.1, S2.1, S2.4.*

```text
Implement roadmap P4 deliverable "DAW-grade transport (T58), lifted into a workspace-level
service (T60 part)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- A look-ahead Web Audio scheduler derives the playhead from ctx.currentTime. The first window
  after play, seek or wrap includes its start.
- Loop off plays once. Loop edges snap to bars; the loop bar is draggable, with the presets.
  Loop and speed are remembered per project as rehearsal preferences.
- The transport becomes a workspace service above the drawer tabs, so a Composer tab switch
  never stops it.
- Keep the old audio path selectable at runtime (the P0 flag in team mode, a dev-only
  localStorage switch in solo mode), and record a follow-up to delete it.
Done when the P4 exit criteria for loop-off, the opening chord on every loop repeat, scheduler
timing, bar-snapped loop dragging and playback across a Composer tab switch pass, and the S2.1
timeline-width spec still passes.
```

#### S4.3b — Current moment, Rehearse and count-in
*Prereqs: S4.3a, S4.2.*

```text
Implement roadmap P4 deliverables "Current moment and Rehearse (T10)", "Keyboard completion
(T61, T43)" and the count-in part of "Practice aids (T59 part)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- One "current moment": the selection when stopped, the playhead when playing. A paused grid
  shows the playhead's moment.
- "Rehearse" on Events rows, the inspector and chart bars sets a bar-snapped loop around the
  moment, optionally lowers speed, counts in (Off / 1 / 2 bars, with 1-2-3-4 shown over the
  grid) and plays.
- ↑/↓ are scoped to the focused Events list. L toggles the loop, [ and ] change speed, Home
  goes to the start or the loop start, and ←/→ while playing seek by moment. Labels are
  1-based everywhere.
Done when all of these pass:
- the P4 criterion that "Rehearse" on a Hard row starts, after a 1-bar count-in, a loop whose
  bounds sit on bar lines and contain the moment;
- the pausing-mid-song criterion;
- the ←/→-while-playing input-table row;
- at 1366x768, with the inspector and transport shown, all 64 pads are at least 32 px and
  inside the viewport.
```

#### S4.4 — Mute is audio-only; practice aids; Rehearse view
*Prereqs: S4.3b.*

```text
Implement roadmap P4 deliverables "Audition vs analysis (T15, T16)", the rest of "Practice
aids (T59 part)", "Rehearse view (F7-03)" and the P4 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Mute and Solo become session-only, audio-only, independent flags
  (audible = anySolo ? soloed : !muted). They never touch analysis, layout, undo or updatedAt,
  and muted pads stay editable.
- "Exclude from analysis" is a separate, badged row action, and generation keeps excluded
  Sounds pinned. This changes generation input, so run the Solver Change Checklist.
- Migrate mute-used-as-exclusion once, with a backup.
- Volume, audition and the hands filter follow the recorded cuts.
- Muted and excluded streams stay visible in the timeline (invariant 4).
Done when the P4 exit criteria for mute, solo, exclude and hands, the Rehearse view and the
migration pass, and the Alt-click audition input-table row passes (unless audition is cut).
```

### Phase P5 · Sounds, import and projects you can trust

#### S5.1 — One soft finger-preference control; a real Sounds panel; drag feedback
*Prereqs: S4.2, S3.3.*

```text
Implement roadmap P5 deliverables "Unified soft preference control (T19 full)", "Sounds
panel (T45, T17 rest)" and "Drag feedback (T46 core)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- One "Hand & finger preference (soft)" control is used in the Sounds row, the pad inspector,
  the selected moment card and the Composer. It always writes voiceConstraints and syncs pad
  fingerConstraints (invariant 6). It shows the solver suggestion at reduced opacity, never in
  the "(XX)" format (CLAUDE.md rule).
- The Sounds panel gets:
  - search;
  - filter chips with counts (All / To place / On grid / Locked);
  - a progress bar;
  - "Place remaining N" (the S3.3 action per Q4: it proposes a candidate and never places
    Sounds directly, invariant 7).
- Placement status is a chip or a row pill, never a section label. Groups keep "Ungrouped" and
  the Cmd/Ctrl+G toggle (CLAUDE.md Sound Grouping rules).
- A drag shows the incoming Sound and a one-line hint, and evictions show a toast with Undo.
Done when the P5 exit criteria for voice-ID round trips, finger sync across panels, the
reduced-opacity suggestion, "Ungrouped" and the filter counts pass.
```

#### S5.2 — Import review, Replace/Remove source files, place presets by mapping
*Prereqs: S1b.4, S2.2a, S1a.2, and decision Q3 recorded.*

```text
Implement roadmap P5 deliverables "Import review sheet (T48)", "Source files and Replace
(T47)" and "Place preset (T65 mapping slice)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- A review sheet appears after choosing files, with a one-click Skip. It shows the file facts
  and one editable row per Sound: name (per Q3), colour, short label and include.
- The sheet refuses note-less files and warns above 64 Sounds.
- Errors are tagged by source, so "Generation failed · Retry" appears only for generation.
- Re-importing a matching file asks: Replace (keeps placements and voice ids), Add as new, or
  Cancel, with a mapping preview.
- Dropping a preset from another project opens a mapping dialog that suggests matches by name,
  never by pitch. It places the preset on the grid only, as one undo step.
- Import never places anything (invariants 5 and 7).
Done when the P5 exit criteria for Replace without duplicates and for cross-project preset
mapping pass.
```

#### S5.3 — Notes in beats, so tempo changes keep the bar grid
*Prereqs: S1a.2, and decision Q6 recorded.*

```text
Implement roadmap P5 deliverable "Musical time (T49)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Store events in beats/ticks, with seconds derived from projectState.tempo. Do it through a
  backed-up, idempotent migration that keeps the seconds field for one release.
- Under Q6 model (b), reserve the Composer pattern slot in beats.
- BPM becomes a labelled field ("Tempo affects difficulty").
- A tempo change shows a toast and marks the analysis stale.
- A batch import adopts the first file's tempo and flags mismatches.
- The Composer keeps using the project tempo (invariant 8).
- Solvers read the derived seconds, so run the TEST MIDI 1 gate: 0 unplayable events for all
  three methods, and seed-0 snapshots unchanged at the project tempo.
- Re-run the S2.1 timeline-width spec after a 120 to 90 BPM change.
Done when the P5 exit criteria for 120 to 90 BPM keeping every note's bar.beat and for the
migration test pass.
```

#### S5.4 — Library complete; saves that can't silently collide
*Prereqs: S2.3, S5.2, S5.3.*

```text
Implement roadmap P5 deliverables "Library complete (T51 rest, T52 rest, T54, T55)", "Save
robustness (T57 rest)" and the P5 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- A drop-a-MIDI overlay in the Library and the workspace opens the S5.2 review.
- A status row shows the Active name, a draft pill and the variant count.
- A reopened draft shows the banner described under decision Q1.
- A project is created on its first meaningful action.
- Developer tools move behind a "Developer tools" footer link, with their routes kept.
- Bundled lucide icons replace the remote Material Symbols.
- Promote, Save variant, Discard and import save immediately.
- Revision counters with compare-and-swap, and the cross-tab banner, follow the recorded cuts.
- "Can't access storage" gets its own state.
Done when the P5 exit criteria pass:
- dropping a .mid on the Library opens the review, and after confirming 0 pads are placed and
  bottomLeftNote = 36 (invariants 5 and 7);
- Promote still persists when the tab is killed straight after it;
- "Continue" ordering is unchanged by just opening a project;
- icons render offline;
- the developer routes still load.
```

### Phase P6 · One cost story

#### S6.1 — One headline score; honest charts; "Reading your results"
*Prereqs: S3.2, S1a.3, S5.3, and decision Q5 recorded.*

```text
Implement roadmap P6 deliverables "Canonical headline (T21)", "Honest charts (T40)" and
"Learn More 'Reading your results' (T41)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Every layout shows one integer from the S3.1 cache (per Q5), plus Hard and Unplayable counts.
  Factors show their share of the burden.
- Optimizer cost, seed and move count move to an (i) tooltip and the trace, and candidate rows
  sort by the displayed headline.
- PerformabilityObjective stays the beam ranking model, and the five DiagnosticFactors stay
  factorized (CLAUDE.md evaluation core).
- Charts get a fixed scale with bands, a labelled y-axis and bar.beat ticks.
- Learn More's new section is generated from FACTOR_META and the headline definition, with a
  one-time "Scores now use one scale" notice.
Done when the same layout shows the same integer in the state bar, Analysis, its row and
Compare, and the Learn More test lists exactly the FACTOR_META entries.
```

#### S6.2 — Everything measured against the Active Layout; Compare says what changed
*Prereqs: S6.1, S3.3.*

```text
Implement roadmap P6 deliverables "Baseline-aware Layouts list (T26)", "Compare 'What
changed' (T26)" and "Diversity honesty (T36)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md. The diversity baseline is an engine input change,
so run the Solver Change Checklist.
- Generation receives state.activeLayout as the diversity baseline and the draft as its base.
- Every row (Active pinned, the draft, candidates, variants, recovered drafts) shows delta
  chips against Active and a mini-grid diff.
- Compare becomes A | B | Change rows, including per-Sound moves and re-fingerings in words,
  with Keep, a secondary Promote and Close in a sticky footer.
- The draft and variants can be compared, and Compare stays read-only (canon section 7).
- Pure translations count as duplicates. When few distinct alternatives exist, show the
  "little room" note.
- Candidate diversity filtering and baseline-relative diffs must remain (Do-Not-Regress).
Done when the P6 exit criteria for diversity against Active, translation filtering and "every
displayed change equals B − A" pass.
```

#### S6.3 — Generate in musician terms; weighting on the Analyze side; complete trace
*Prereqs: S6.1, S3.4.*

```text
Implement roadmap P6 deliverables "Generate options (T34)", "Custom weighting on the Analyze
side (T39 rest)" and "Complete trace (T33 full)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md. The costToggles pass-through is an optimizer
change, so the full Solver Change Checklist applies.
- A "Generate ▾" popover offers musician-facing options with measured time estimates.
- Map each focus option to an existing method, strategy and seed combination, and list the
  mapping in the PR (e.g. Comfort → Natural Pose, Fast alternation → Coordination, Surprise
  me → Exploratory with seed > 0). Leave out any focus with no existing equivalent, and add no
  new strategies.
- Advanced keeps Greedy, Beam and Annealing, the restart count, strategy, intensity and
  "Reproducible run (seed 0)". Demote them; never remove them (Core Functionality contract).
- Cost toggles and Re-analyse move to the Analysis header ("Custom weighting"), never into
  Generate (canon section 9). Pass them to all three methods and echo them in costTogglesUsed,
  labelling any method that can't honour them.
- Update Learn More (invariant 2): the Constraints tab lists the active weighting and any
  method that ignores it, and method and option names match Advanced. Extend the sync test.
- The trace shows the greedy move list, an annealing sparkline and a beam summary, with trace
  shapes and stopReason unchanged.
Done when the P6 exit criteria for method availability, costTogglesUsed, weighting placement,
telemetry-based estimates and trace rendering pass.
```

### Phase P7 · Workspace by job

#### S7.1 — Consolidate the workspace
*Prereqs: S6.1, S6.2, S6.3, S4.2, S4.3b, S5.1, S5.2.*

```text
Implement roadmap P7 deliverable "Workspace consolidation (T38)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Left: Sounds | Events.
- Centre: the state bar, grid, moment inspector, transport, and the drawer with the
  Timeline | Pattern Composer tabs unchanged (invariant 3).
- Right: Analysis | Trace above a pinned, resizable Layouts list, with Trace bound to
  MoveTracePanel.
- Check that every factor, cost breakdown and per-event diagnostic they show is available in
  Analysis or the inspector (CLAUDE.md Core Functionality and Do-Not-Regress). Then delete
  PerformanceCostsPanel and the duplicated ActiveLayoutSummary blocks.
- One primary action per region. The only primary-styled Promote is in the state bar; rows and
  Compare keep a secondary Promote.
- Side-panel default widths come from the measured centre width.
- Add a one-time "What moved" popover, and a flag if the tracker records team mode.
Done when these P7 exit criteria pass: at 1440x900 pads are at least 56 px and the first
candidate row is visible without scrolling; there is one primary Promote; and the listed
CLAUDE.md rules hold (timeline width, all streams, L2 pills, whole-moment click, MoveTracePanel
reachable, Composer tab in the drawer).
```

#### S7.2 — Tokens, primitives and readability sweeps
*Prereqs: S7.1, S5.2.*

```text
Implement roadmap P7 deliverables "Raw-hex sweep (T42 rest)", "Primitive sweep (T63)" and
"Readability sweep (T64 rest)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Migrate every remaining raw colour to the --sound, --status, --factor, --role and --hand
  tokens, with a test that bans raw hex in src/ui/components outside the token file.
- Migrate the remaining panels to the primitive kit.
- Hover-only actions appear on :focus-within or leave the tab order.
- The project name and BPM become real inputs.
- Text is at least 11 px (data text 12–13 px), targets are at least 24×24, contrast is at
  least 4.5:1, and every colour cue gets a second cue.
Done when axe reports 0 critical or serious violations on the Library, each workspace tab,
Compare, Learn More and the import review, and the 1366x768 scan finds no text under 11 px and
no target under 24 px.
```

### Phase P8 · The Composer joins the project

#### S8.1 — Composer patterns saved, undoable and bound to Sounds
*Prereqs: S5.1, S5.2, S5.3, S1a.5, and decision Q6 recorded. If S7.1 is in flight, merge it first.*

```text
Implement roadmap P8 deliverables "Composer state in the project (T67)", "Sound-bound lanes
(T66 full)" and "Composer model per Q6 (T68)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Under Q6 model (b), the pattern (in beats, in the slot S5.3 reserved) and the preset
  placement records live in the project. Under model (a) there is no separate pattern: the
  Composer edits the timeline's notes directly.
- Either way, Composer changes are autosaved, exported and undoable through the document
  slice. Each note toggle is one undo step; only toggles made in one pointer gesture (press,
  drag across cells, release) coalesce.
- Migrate existing localStorage patterns once, with a backup.
- Lanes reference project Sound ids and read name, colour and mute from the project. Finger
  edits use the S5.1 soft control over voiceConstraints (invariant 6).
- The drawer header states the model. A Presets shelf lives inside the drawer and never takes
  over the right panel; it offers "Open in Composer" and "Place on grid" (the S5.2 mapping).
  "Add to timeline at bar…" is S8.2's.
- No Composer BPM control (invariant 8), and the tab stays in the drawer (invariant 3).
- New Composer UI uses the primitive kit and tokens, with no raw hex.
- "Undo after Clear … including after a reload" means the state Undo restores survives a
  reload; history still starts empty when a project opens (S1a.1).
Done when the P8 exit criteria pass for:
- surviving a tab switch, a reload and export/import;
- one-step undo per note toggle;
- renames and cleared fingers;
- the localStorage migration running once after its backup, with a re-run changing nothing;
- the invariant 3 and 8 tests and the voice-ID round-trip tests.
```

#### S8.2 — Insert patterns into the timeline; Composer on the shared transport
*Prereqs: S8.1, S4.3a, S5.2. Flips: the S8.2 C9 cases.*

```text
Implement roadmap P8 deliverables "Insert pattern (T65 full)", "Composer on the shared
transport (T60 full)" and the P8 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- "Add to timeline at bar…" reuses the S5.2 slot-to-Sound mapping (with a "New Sound" option)
  and inserts notes into the one timeline. The insertion and any grid placement are one
  undoable step.
- Preset fingering is captured as suggestions, and applied as soft preferences only on "Apply
  fingering".
- Replace the preset metric breakdown with canonical evaluation of the preset's notes, and
  document that in Learn More.
- Composer Play drives the workspace transport at the project tempo, lighting pads and fingers
  the way the timeline does.
Done when the P8 C9 end-to-end scenarios pass, and Composer Play produces audio and pad
flashes across a tab switch.
```

#### S8.3 — Sequencer basics and a fully keyboard-operable grid (optional)
*Prereqs: S8.1 (sequencer basics); S2.4 and S4.2 (keyboard grid). Do this only if the tracker's cuts say "do".*

```text
Implement roadmap P8 deliverables "Sequencer basics (T70, T69 rest)" and "Full keyboard grid
(T62 full)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- Sequencer: a 1/16 default grid plus 1/32; velocity by vertical drag or Alt-click; duplicate
  bar; copy/paste; lane reorder and colour; a resizable, collapsible, maximisable drawer.
- "Insert rudiment…" and triplet grids are deliberately deferred (see the roadmap), so don't
  build them. If you touch GENERATE_RUDIMENT, never apply its padAssignments or
  fingerAssignments (invariant 7).
- Keyboard grid: role=grid with a roving tabindex. Arrows move, Enter places or picks up/drops,
  Delete clears, and Space stays play/stop.
Done when the P8 exit criteria for sequencer basics, and for keyboard-only placement of all 7
TEST MIDI 1 Sounds (with axe clean on the grid), pass.
```

---

## Phase audit prompt

Run after the last session of each phase.

```text
Audit roadmap phase <P0 | P1a | P1b | P2 | … | P8> on current main, following the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
- For every exit criterion of this phase in docs/product/UI_ENHANCEMENT_ROADMAP.md, verify it
  yourself: run the test, spec or repro, and take screenshots at 1366x768 and 1600x1000, stored
  as the rules describe.
- For CI-only and nightly criteria, cite the most recent passing runs (run URL, date,
  duration) instead of re-running them. Re-trigger with workflow_dispatch only if there has
  been no run since the phase's last merge.
- Record pass, fail, pending or cut for each criterion, with evidence, in the tracker's
  "Phase audits" section. A criterion waiting on a parallel phase (such as P1a's Learn More
  sync) is pending; an item cut under the recorded mode is cut, not failed.
- Re-run the full gates: typecheck, unit tests, all e2e specs, and TEST MIDI 1 with 0
  unplayable events for Greedy, Beam and Annealing.
- Check every CLAUDE.md Product Invariant, Core Functionality Preservation item, Do-Not-Regress
  rule and UI Non-Regression rule.
- Fix only one-line regressions; record anything bigger as a follow-up with repro steps.
Open a PR with the updated tracker and any one-line fixes.
```

## Final re-critique prompt

Run once the phases you plan to do are complete.

```text
Re-run the UI critique on current main.
1. Capture every core flow at 1600x1000 and 1366x768 with
   `OUT=docs/screenshots/ui-recheck node scripts/ui-critique-repros/capture-flows.mjs`
   (add W=1366 H=768 for the second size, and update selectors where the UI has changed).
   The "before" images are in docs/screenshots/ui-critique/.
2. For each flow and cross-cutting area in docs/product/UI_CORE_FLOWS_CRITIQUE.md:
   - re-rate its health;
   - list which themes in docs/product/UI_ISSUE_REGISTER.md are now resolved, with evidence;
   - list which remain, and any new problems.
3. Write the result to docs/product/UI_CORE_FLOWS_RECHECK.md, with before/after screenshots,
   and open a PR.
```
