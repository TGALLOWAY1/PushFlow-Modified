# PushFlow UI Roadmap — Implementation Prompts

*Companion to [UI_ENHANCEMENT_ROADMAP.md](UI_ENHANCEMENT_ROADMAP.md), [UI_ISSUE_REGISTER.md](UI_ISSUE_REGISTER.md) and [UI_CORE_FLOWS_CRITIQUE.md](UI_CORE_FLOWS_CRITIQUE.md).*

Copy-paste prompts for the agent sessions that implement the roadmap. Each prompt is short because the detail already lives in the roadmap (deliverables, exit criteria, risks) and the register (root causes with file:line). The shared rules below apply to every implementation session; the prompts point agents at them.

## How to use these

1. **Run [Prompt 0](#prompt-0--record-decisions-and-create-the-progress-tracker) first.** It records your answers to decisions Q1–Q7 and creates `docs/product/UI_ROADMAP_PROGRESS.md`, the shared checklist every later session reads and updates.
2. **Then either** paste the [Continue prompt](#continue-prompt-reusable) into each new session (it picks the next unblocked session from the tracker), **or** paste a specific [session prompt](#session-prompts) when you want to choose.
3. **One session = one work package** (usually 1–4 small PRs). Merge a session's PRs before starting a session that lists it as a prerequisite.
4. **After each phase**, run the [Phase audit prompt](#phase-audit-prompt).
5. Sessions marked **∥** can run in parallel with the ones named. Parallel branches will touch shared files (`InteractiveGrid.tsx`, `UnifiedTimeline.tsx`, `projectState.ts`), so merge the first to finish, then merge `main` into the other before its PR.

**Solo "trust release"** (recommended first milestone): Prompt 0 → S0.1–S0.2 → S1a.1–S1a.5 → S1b.1–S1b.4 → S2.1–S2.3 → S3.1–S3.3.

---

## Rules for every implementation session

**Before coding**

1. Read CLAUDE.md, the four canon docs in `docs/canonical/`, and in `UI_ENHANCEMENT_ROADMAP.md` the **Principles** plus your phase **in full** (goal, deliverables, exit criteria, risks). For each theme your session names, read its entry in `UI_ISSUE_REGISTER.md` (`#t01` … `#t70`) — it has the root cause with file:line and the source findings.
2. Read `docs/product/UI_ROADMAP_PROGRESS.md`: recorded decisions Q1–Q7, what is already done, deviations, and follow-ups. Don't redo finished work. If a prerequisite session isn't marked done, stop and report that instead of working around it.
3. Re-confirm each problem on current `main` before fixing it (line numbers will have moved). Where a reproduction exists, run it: the `test/e2e/c*.spec.ts` specs from S0.2 onward, or `scripts/ui-critique-repros/` before that.

**While coding**

- **Scope.** Implement only your session's deliverables, as the roadmap describes them. Anything else you find goes under *Follow-ups* in the progress file, not into your diff.
- **Slices.** One PR per deliverable where practical, each shippable on its own and leaving the app better. Aim for under ~400 lines of non-test diff per PR.
- **Invariants.** CLAUDE.md's Product Invariants, Core Functionality Preservation Contract, Do-Not-Regress and UI Non-Regression rules all apply. If a deliverable seems to need breaking one, stop and ask; don't reinterpret the rule.
- **Optimizer or solver changes.** Follow CLAUDE.md's Solver Change Checklist: TEST MIDI 1 with 0 unplayable events for Greedy, Beam and Annealing; seed-0 determinism; unchanged trace shapes unless the roadmap says otherwise; `stopReason` kept; `isProcessing` reset on success and error; MoveTracePanel still renders.
- **Learn More.** Any change to a metric, verdict tier, constraint or factor name updates `LearnMoreModal.tsx` in the same PR (invariant 2).
- **Words.** Use canon terms (Active Layout, Working/Test Layout, Candidate Solution, Saved Layout Variant, Performance Event, Sound). Follow the recorded Q3 (naming) and Q7 (event vs moment) decisions.
- **Stored data.** Any change to the persisted format goes through the migration runner (from S1a.2), with an automatic backup and a test that running it twice changes nothing.
- **State.** Analysis-only state never becomes project truth; derived state never enters undo history (from S1a.1).

**Before every push**

- `npm run typecheck` and `npm run test:run`; from S0.1 on, also `npx playwright test` at 1366×768 and 1600×1000.
- If your fix addresses one of C1–C9, remove that spec's expected-fail marker in the same PR. Never weaken, skip or quarantine a test to get green.
- UI changes: before/after screenshots at 1366×768 and 1600×1000 in the PR description.
- Re-read your diff for anything that would break CI or an invariant.

**Finish**

- Update `UI_ROADMAP_PROGRESS.md`: tick each deliverable and exit criterion met, with the PR number and how it was verified; record deviations and follow-ups.
- PR description: themes addressed, exit criteria met and how verified, invariants touched, screenshots, residual risks.
- If you run out of room, stop at a clean PR boundary, update the tracker with exactly what's left, and say so.

---

## Prompt 0 — Record decisions and create the progress tracker

```text
Read docs/product/UI_IMPLEMENTATION_PROMPTS.md, the "Decisions needed from you" table in
docs/product/UI_CORE_FLOWS_CRITIQUE.md (section 4), and the Q1–Q7 open questions in
docs/product/UI_ENHANCEMENT_ROADMAP.md.

My decisions (anything I leave as "default" means: use the roadmap's recommended default):
- Q1 (does the Working/Test Layout persist across reloads): default
- Q2 (do finger preferences survive Discard): default
- Q3 (may default Sound names use MIDI pitch): default
- Q4 (one-click Suggest / Place remaining N / read-only auto-inspect vs invariant 7): default
- Q5 (single headline score and evaluator): default
- Q6 (Pattern Composer model): default
- Q7 ("event" vs "moment" in UI labels): default

Create docs/product/UI_ROADMAP_PROGRESS.md containing:
1. Decisions: each Q with my answer, the resolved behaviour in one or two sentences, and which
   sessions it affects.
2. One checklist section per session S0.1 … S8.3 (from UI_IMPLEMENTATION_PROMPTS.md): its
   prerequisites, its roadmap deliverables, and the exit criteria it owns (copied from
   UI_ENHANCEMENT_ROADMAP.md), all unchecked, each with a "PR / verified by" slot.
3. Empty "Deviations" and "Follow-ups" sections.

If a decision changes what CLAUDE.md or a canon doc says (for example Q4 on invariant 7, or Q7
on terminology), make that exact wording change in the same PR and quote the before/after in
the PR description. Docs only — no code changes. Open a PR.
```

---

## Continue prompt (reusable)

```text
Continue implementing the PushFlow UI roadmap. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md ("Rules for every implementation session").
Read docs/product/UI_ROADMAP_PROGRESS.md, pick the first session (in S0.1 … S8.3 order) that
is not complete and whose prerequisites are all done, and implement its remaining
deliverables using that session's prompt in UI_IMPLEMENTATION_PROMPTS.md. Tell me which
session you picked and why before you start coding. If nothing is unblocked, report what is
blocking and stop.
```

---

## Session prompts

Each prompt names the roadmap deliverables by their headings in `UI_ENHANCEMENT_ROADMAP.md`. "Flips" means the C1–C9 expected-fail spec(s) the session must turn green.

### Phase P0 · Safety net

#### S0.1 — Test runner, CI, hooks and fonts
*Prereqs: Prompt 0.*

```text
Implement roadmap phase P0 deliverables "Playwright runner", "Test hooks", "Component tests",
"CI", "Deterministic fonts and screenshots", "Fixtures" and (only if I work with a team;
otherwise skip) "Flags". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Key points: the window.__pf test hook must exist only when VITE_E2E is set and must be absent
from dist/ (add a check); CI runs typecheck, vitest (node + happy-dom) and Playwright at
1366x768 and 1600x1000 on every pull request; deploy.yml must also run typecheck and unit
tests before building. Self-host Inter and Space Grotesk; block fonts.googleapis.com in e2e.
Keep the archive copy of TEST MIDI 1 where CLAUDE.md points.
Done when the P0 exit criteria about CI turning red, stable screenshots with fonts blocked,
the FeasibilityBadge component test and the axe smoke spec, and "no window.__pf in dist/"
all pass.
```

#### S0.2 — C1–C9 regression specs and the TEST MIDI 1 gate
*Prereqs: S0.1.*

```text
Implement roadmap P0 deliverables "C1-C9 as specs" and "Extended TEST MIDI 1 gate". Follow
the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Turn each probe in scripts/ui-critique-repros/C1..C9 into test/e2e/c<N>-*.spec.ts that asserts
the CORRECT behaviour and is marked test.fail() with the reproduced cause (see the
reproduction table in UI_ISSUE_REGISTER.md). Use the S0.1 test hook and data-testids, never
React internals. In test/engine/optimization/testMidi1Integration.test.ts add an annealing
quick case, strict 0-unplayable assertions for all three methods (replacing
playableRatio > 0.5), a lock case at [7,0] (expected-fail until S1a.3), seed-0 snapshots per
method, and key sounds by id, not MIDI pitch. If a method fails the strict check today, mark
it expected-fail and record it as an S1a.3 blocker in the progress file — never loosen the
assertion. Nightly job runs deep annealing and records its duration.
Done when the corresponding P0 exit criteria pass and all nine C-specs fail today for the
documented reason.
```

### Phase P1a · Stop losing work

#### S1a.1 — Undo covers only your edits, plus the toast
*Prereqs: S0.2. Flips: C4.*

```text
Implement roadmap P1a deliverables "Undo on the document only (T02)" and "Toast region
primitive (T31 slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Split ProjectState into a document slice (undoable) and a session slice (never in history)
exactly as the roadmap lists; add a transaction wrapper so Suggest, an import, a Ctrl/Cmd+G
grouping, Discard, Promote and apply-candidate are one undo step each; no-op reducer results
record nothing; opening a project starts with empty history; Undo/Redo buttons name their
target. Land the slice split before the transaction wrapper (separate PRs), with one reducer
test per user intent and a persistence round-trip test. isProcessing must still reset on
success and error.
Done when the P1a reducer-test exit criteria pass and C4 is flipped.
```

#### S1a.2 — Migration runner; Generate only proposes; Recovered drafts
*Prereqs: S1a.1. Flips: C2 (partly; the rest in S3.2).*

```text
Implement roadmap P1a deliverables "Migration runner" and "Generate only proposes (T01
slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Build the runner first (schemaVersion + ordered, idempotent migrations, automatic backup
export per project before migrating). Then delete the APPLY_GENERATION_TO_LAYOUT dispatches
in useAutoAnalysis, stop card-body clicks from previewing, and auto-keep any differing draft
into a separate, deduped, capped (5) "Recovered drafts" group before Preview, Load Draft or a
candidate/variant Promote replaces it — announced by a toast with Restore. Show every saved
variant (remove the slice(-3) limit). Generate on an empty grid must place nothing
(invariant 7).
Done when the P1a exit criteria for C2, recovered drafts, empty-grid Generate and the
migration fixture pass.
```

#### S1a.3 — Locks honoured by every method; strict Sound identity  ∥ S1b.1–S1b.3
*Prereqs: S1a.1. Flips: C3 and the S0.2 lock case.*

```text
Implement roadmap P1a deliverables "Locks honoured and identity strict (T11, T18)" and the
P1a "Learn More (invariant 2)" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md — this is an optimizer change, so the full Solver
Change Checklist applies.
Beam and Annealing must pre-place locked Sounds and carry placementLocks through seeding,
compaction and mutation; post-validate every candidate and drop violators with a stated
reason; locked pads refuse drag-out and drop-onto. Remove every MIDI-pitch fallback that
matches Sounds to pads (list in the roadmap), so an unplaced Sound is unmapped even if
another Sound shares its pitch. Show a one-time "Scores changed" note. Keep all three
methods, greedy restarts and seeded noise.
Done when C3 and the lock case pass for greedy, beam and annealing quick, TEST MIDI 1 reports
0 unplayable events for every method, and seed-0 output is identical twice.
```

#### S1a.4 — Discard hygiene, freshness, mute can't delete, truthful save
*Prereqs: S1a.2.*

```text
Implement roadmap P1a deliverables "Discard hygiene (T12)", "Freshness slice (T14)", "Mute
can't delete (T15 slice)" and "Truthful save (T57 slice)", plus the ghost-lock migration
listed under "Migration runner". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Finger preferences on Discard follow recorded decision Q2. "Saved" appears only after a
successful write; failures show a persistent "Couldn't save · Retry · Export a copy";
pending saves flush on pagehide; Cmd/Ctrl+S saves. Generate never removes an already-placed
Sound, even when muted.
Done when the matching P1a exit criteria pass (Discard leaves no ghost locks, fingerConstraints
re-derive from voiceConstraints, lock toggle marks stale, self-drop records nothing, muted
placed Sound keeps its pad, mocked write failure never shows "Saved").
```

#### S1a.5 — Composer data can't be lost
*Prereqs: S1a.2.*

```text
Implement roadmap P1a deliverable "Composer data slice (T60, T66, T67)" and the
preset-fingering migration listed under "Migration runner". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Keep both drawer tabs mounted (inactive one hidden and inert; Composer key handlers only
while its tab is active); flush pending Composer saves/syncs on Stop and unmount; take the
playhead out of the save/sync effect deps; Composer sync writes notes only, never a Sound's
name, colour or mute; Composer finger edits go through voiceConstraints keyed by the lane's
project Sound id (invariant 6) and can be cleared; Clear gets an Undo toast. Export includes
the Composer pattern. The Pattern Composer tab must stay in the bottom drawer (invariant 3).
Done when the P1a Composer exit criteria pass (edit survives a fast tab switch and reload,
playback continues across the switch, renames survive Composer edits, Undo after Clear).
```

### Phase P1b · Stop false verdicts and broken overlays

#### S1b.1 — Honest verdict, shared moment grouping, factor registry  ∥ S1a.3–S1a.5
*Prereqs: S0.2. Flips: C6.*

```text
Implement roadmap P1b deliverables "Shared moment grouping (T22 base)", "FACTOR_META registry
(T20 base)", "Honest verdict (T07, T15 scope line)", "False claim fix" and "Learn More sync".
Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
groupIntoMoments + a stable momentKey live in src/engine and are exported from @/engine;
moment cost is aggregated once per moment. FeasibilityBadge falls back to "Unknown", never
"Feasible"; the whole-layout verdict stays pinned and the selected moment gets its own card
with all five factors from FACTOR_META; every verdict carries a scope line. Add the Learn
More sync test (renders Constraints and verdict tiers from the same lists the solvers and
the badge use).
Done when the P1b exit criteria for C6, chord cost, groupIntoMoments tests, the "low overall
difficulty" claim and the Learn More sync test pass.
```

#### S1b.2 — One dialog/popover primitive; pad menu at the cursor  ∥ S1a.3–S1a.5
*Prereqs: S0.2. Flips: C1.*

```text
Implement roadmap P1b deliverable "Dialog/Popover primitive (T06)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
One primitive that portals to document.body, sets role/aria-modal/aria-labelledby, traps
focus, closes on the first Escape and on outside click, clamps inside the viewport and returns
focus to the trigger. Give pads tabIndex=-1 and an aria-label so focus can return to them.
Migrate PadContextMenu (opening at the cursor), the enlarged chart, View all, Compare (every
state gets Close) and Learn More. Add a spec per migrated overlay (portals can break
outside-click and drag ghosts).
Done when C1 passes at 1366x768, 1600x1000 and 1920x1080 for all 64 pads and the first Escape
closes every migrated overlay.
```

#### S1b.3 — Compare evaluates Active properly; per-layout analysis cache  ∥ S1a.3–S1a.5
*Prereqs: S0.2. Flips: C7.*

```text
Implement roadmap P1b deliverable "Compare stop-gap and analysis cache (T08 slice)". Follow
the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Add getAnalysisForLayout(layoutHash, performanceHash, costToggles, evaluatorId): an in-memory,
capped LRU of plans and diagnostics — analysis-only, never persisted. Compare evaluates a
missing Active plan through it ("Analysing Active…"), never renders the zero stub (show
"Couldn't analyse" on failure), derives its compare set from current ids and prunes it on
SET_CANDIDATES, delete and promote; Compare is disabled below two distinct layouts; Promote
inside Compare closes it with a toast.
Done when the P1b C7 exit criteria pass, including "served from cache without re-solving" and
"storage unchanged".
```

#### S1b.4 — Moment view, input safety and preset stop-gaps
*Prereqs: S1a.5, S1b.2. Flips: C5, C8, C9.*

```text
Implement roadmap P1b deliverables "Moment-view stop-gaps (T09, T10, T61 slices)", "Finger
input safety (T19 slice)", "Delete scoping (T28 slice)" and "Preset safety (T65 slice),
refuse-first". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Remove the inline opacity/boxShadow that override the onion and previous-event classes;
suspend the selection overlay while playing and restore it on Stop; selecting a moment while
stopped moves the playhead; arrows do nothing while playing (for now). The finger field opens
empty with the solver suggestion as a reduced-opacity placeholder (CLAUDE.md finger display
rule) and blur/Escape without typing changes nothing. Delete/Backspace no longer remove the
selected event's pad. Preset drops: dragover and drag agree on "copy", the handler is read
through a ref, collisions and mirror are validated at drop time, a visible Mirror toggle sits
on each card, and a drop is accepted only when every slot resolves to an existing project
Sound — otherwise refuse with the roadmap's message. Save Preset leaves fingers blank.
Done when the P1b exit criteria for C5, C8, C9, T19 and T28 pass (C9 using a real native drag).
```

### Phase P2 · Quick wins you can see

#### S2.1 — Measured grid, reachable transport, full-width timeline
*Prereqs: S1b.2.*

```text
Implement roadmap P2 deliverables "Measured grid (T04)", "Transport reach (T05, T56)" and "The
timeline fills its width (T50)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Remove transform: scale and GRID_NATURAL_SIZE; a ResizeObserver sets an integer --pad-size
between 32 and 72 px; label sizes stay fixed; secondary labels hide below 40 px pads. The
timeline sizes to its content (capped ~40% of the body) with a remembered, collapsible
splitter. A fixed transport cluster (Play/Stop, Return, position, Speed, Loop, Metronome,
Hits) is always visible; the rest collapses into an overflow menu. Desktop-only: measurement,
no breakpoints. Watch for ResizeObserver feedback loops and changed drag hit-testing.
Done when the P2 exit criteria for pad bounding boxes at both viewports and the 4-bar
timeline-width regression spec pass (this also fixes a CLAUDE.md Timeline rule violation).
```

#### S2.2 — Tell Sounds apart; readable names and notation
*Prereqs: S1b.1 and decisions Q3, Q7 recorded.*

```text
Implement roadmap P2 deliverables "Distinct Sounds (T17 slice)", "Readable references and one
meaning for 'event' (T20, T23)", "Musical notation (T43 slice)" and "Readability floor (T64,
T38 and T31 slices)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
A 16-hue colour-blind-safe --sound-1..16 palette for new imports only (never recolour a
user's choices); default names per decision Q3; an opt-in "Name from GM drum map" action as
one undo step; pads trim the shared prefix and truncate in the middle over two lines; rename
by hover pencil or F2/Enter, with Enter/Tab moving to the next Sound. Every factor label and
colour comes from FACTOR_META (grep test); every user-visible id resolves to a Sound name;
counts use moments per decision Q7. Positions read bar.beat.sixteenth and "Row 4 · Col 4".
Text ≥ 11 px; disabled buttons show why. MIDI pitch must never drive placement (invariant 5).
Done when the P2 exit criteria for distinct colours/labels, text size, diff counts, the
FACTOR_META grep test and "no lane_ ids" pass.
```

#### S2.3 — Library you can trust; variants worth keeping; guidance and gear cleanup
*Prereqs: S1a.2, S1b.3.*

```text
Implement roadmap P2 deliverables "Library honesty and entry (T52, T51 slices, T53)",
"Variants worth keeping (T29)", "Guidance and copy (T44, T56)" and "Gear cleanup (T39
slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Library cards show real data only (bar length, event count, Sounds, BPM, created and
last-opened dates — a CLAUDE.md Project Library rule) and draw thumbnails from working ??
active with a draft badge. The primary "Import MIDI" accepts .mid/.midi (and detects
.pushflow.json by content), names the project after the file and places nothing (invariants
5 and 7); add "Open demo project" (unplaced). Hero and cards share one menu (Rename,
Duplicate, Export, Delete with ~10 s Undo). Save as variant prompts for a name; variants are
renameable and show scores from getAnalysisForLayout. Remove the dead "Organize by 4x4 Banks"
and the hidden "Duplicate Layout"; keep "Show Finger Assignment" working (CLAUDE.md rule).
Done when the P2 exit criteria for Library cards, Library MIDI import, the demo, variant
naming/scores and delete-undo pass.
```

#### S2.4 — One input table: shortcuts, Space to play, click-to-place, Composer geometry
*Prereqs: S2.1.*

```text
Implement roadmap P2 deliverables "Shortcut registry and input table (T61 slice)",
"Click-to-place (T62 slice)" and "Composer geometry (T69 slice)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
One registry that ignores selects, inputs, contenteditable, menus and open dialogs, holding
the roadmap's table of every pointer and key meaning (Space = play/stop everywhere except
text fields; Escape peels back one layer; "?" opens a sheet generated from the registry), with
one test per row. Arm a Sound, then click an empty pad to place it as one undo step
(explicit user action, so invariant 7 holds). In the Composer, one cellWidth drives cells,
bar lines and playhead; cells ≥ 16 px with horizontal scroll; toolbar controls have fixed
widths.
Done when the P2 exit criteria for input-table tests, Space with a focused button, placing all
7 Sounds by click-to-place, and Composer bar-line alignment pass.
```

### Phase P3 · One inspected layout

#### S3.1 — Accessible primitive kit; one scoring yardstick
*Prereqs: S1b.3 and decision Q5 recorded.*

```text
Implement roadmap P3 deliverables "An accessible primitive kit ships first (T63 part)" and
"One yardstick (T21 slice)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Tabs, ToggleButton (aria-pressed), Checkbox, IconButton (label required) and Card join the
existing Toast and Dialog; every new surface from here on uses them. Extend
getAnalysisForLayout so the evaluator chosen in Q5 scores every displayed layout (Active,
draft, candidates, variants) in a web worker, with the working layout on the same path, so
before/after Generate, Compare and variant cards read the same numbers. Cap and fully key the
cache; show "Scoring…" per row.
Done when a greedy candidate shows the same score before and after "Use as my draft" and the
primitives have role/state tests.
```

#### S3.2 — Look without overwriting: inspected layout, role actions, state bar
*Prereqs: S3.1, S2.1. Flips: the rest of C2.*

```text
Implement roadmap P3 deliverables "inspectedLayout selector", "After a run, candidate A is
auto-inspected read-only", "Explicit role actions", "Layout-state bar (T03)" and "Clean
names (T32)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Inspecting Active, a candidate or a variant renders read-only through layoutOverride with its
own plan and never writes workingLayout; every edit path (drag, context menu, click-to-place,
Delete) is blocked while inspecting, one test per path. Preview becomes Inspect; retire the
P1a Preview auto-keep. "Use as my draft" offers "Save my draft as a variant first" or
"Replace (undoable)". A fixed ~40 px unscaled bar above the grid shows role chip (canon
terms), name, diff vs Active, freshness and only that role's actions; one SubjectChip heads
Analysis, Events, the inspector, both Compare sides and the timeline, whose pills use the
inspected layout's fingering. Auto-inspect after Generate must follow decision Q4. Layout
roles move out of layout names via a migration.
Done when the P3 exit criteria for "inspect 20× leaves the draft hash unchanged", role labels
at both viewports and timeline fingering pass.
```

#### S3.3 — One Promote; Unfinished not failed; fill-in, Compare and Keep
*Prereqs: S3.2 and decision Q4 recorded.*

```text
Implement roadmap P3 deliverables "Single Promote (T13)", "Freshness rules (T14)",
"Unfinished, not failed (T25)", "Explicit fill-in (T37)", "Compare on the cache (T08 full)"
and "Keep candidates (T30)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
One Promote action everywhere (acts at once with an Undo toast; replaced Active auto-saved as
a variant; a pad map matching a candidate promotes as that candidate with its reviewed plan).
Staleness only on real inputs. Verdicts gain "Unfinished" ("5 of 7 Sounds placed"); only
placed material is scored; unplaced notes stay visible, outlined, in the timeline (invariant
4). "Place remaining N" follows Q4. Compare never shows a stub; candidate letters are stable.
"Keep" saves a candidate as a Saved Layout Variant; candidates themselves stay unpersisted.
Update Learn More's verdict tiers.
Done when the P3 exit criteria for identical Promote results, C7 on the cache, freshness and
the 3-of-7 "Unfinished" case pass.
```

#### S3.4 — Generation progress, Cancel and time budget; trace per candidate
*Prereqs: S3.2.*

```text
Implement roadmap P3 deliverables "Generation progress and time budget (T35)", "Trace
follows the candidate (T33 slice)" and the P3 "Learn More" Lifecycle section. Follow the rules
in docs/product/UI_IMPLEMENTATION_PROMPTS.md — optimizer change, full Solver Change Checklist.
Progress with an ETA from measured iterations/sec; Cancel via an abort flag at existing yield
points, committing atomically with stopReason "cancelled" and isProcessing reset; annealing
gets an iteration budget and a wall-clock budget that keep every restart and the temperature
schedule, stopping with stopReason "time_budget" and recording both in telemetry. Every
candidate stores its own trace and stopReason; traces survive promotion; MoveTracePanel stays
bound to state.moveHistory.
Done when the P3 exit criteria for Cancel, budget stop, seed-0 determinism under the iteration
budget, nightly deep annealing within budget and stopReason visible for all methods pass.
```

### Phase P4 · Find it, understand it, rehearse it

#### S4.1 — One identity for each performance event (moment track)
*Prereqs: S1a.3, S1b.1.*

```text
Implement roadmap P4 deliverable "Single moment identity (T24)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md — solver output change, full Solver Change Checklist.
Give eventIndex the same meaning in both solvers and add an explicit momentIndex derived from
groupIntoMoments; store the selection as momentKey and re-resolve it when the plan changes;
placeholder pills for excluded streams select by moment time so clicking any timeline note
still highlights its whole moment (CLAUDE.md Timeline rule); labels follow decision Q7.
Update MoveTracePanel, CandidatePreviewCard and PerformanceAnalysisPanel consumers.
Done when selecting any of the 32 TEST MIDI 1 events under a beam plan and a greedy plan
highlights the same pads/notes on grid, list, timeline and chart, survives re-analysis, and
TEST MIDI 1 still reports 0 unplayable events.
```

#### S4.2 — Moment view, Events list and docked inspector (moment track)  ∥ S4.3
*Prereqs: S4.1, S2.4, S3.2.*

```text
Implement roadmap P4 deliverables "Rebuilt moment view (T09)", "Hand tokens and finger
notation (T42 part)", "Pad vs moment selection (T28)", "Events list for finding problems
(T27)" and "Docked moment inspector under the grid (T27)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Struck pads keep their Sound's colour and name and gain a hand ring and finger badge; next and
previous strikes get outlines; one Now | Now+Next | Prev·Now·Next control replaces the onion
and arrow toggles. A pad click opens a pad inspector and, with a moment selected, highlights
that Sound's hits without moving the moment (update the input table and its tests). Events
rows show bar.beat, Sound chips, finger chips and a text difficulty badge, grouped by bar,
with filters and Prev/Next hard. The inspector lists every strike with a one-sentence "why
it's hard" and the five factors from FACTOR_META. Update Learn More's view-mode text.
Done when the P4 exit criteria for the three view modes, filter chips and Prev/Next hard pass.
```

#### S4.3 — A DAW-grade transport and the Rehearse button (transport track)  ∥ S4.2
*Prereqs: S4.1.*

```text
Implement roadmap P4 deliverables "DAW-grade transport (T58), lifted into a workspace-level
service (T60 part)", "Current moment and Rehearse (T10)" and "Keyboard completion (T61,
T43)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
A look-ahead Web Audio scheduler (playhead from ctx.currentTime; first window after
play/seek/wrap includes its start); Loop off plays once; bar-snapped loop edges; the
transport becomes a workspace service above the drawer tabs so a Composer tab switch never
stops it. One "current moment": the selection when stopped, the playhead when playing (a
paused grid shows the playhead's moment). "Rehearse" on Events rows, the inspector and chart
bars sets a bar-snapped loop around the moment, optionally lowers speed, counts in and plays.
Keep the old audio path behind a flag or branch for one release. The timeline must still fill
its width (re-run the S2.1 spec).
Done when the P4 exit criteria for Rehearse, loop/scheduler timing, playback across a tab
switch and pausing mid-song pass.
```

#### S4.4 — Mute is audio-only; practice aids; Rehearse view (transport track)
*Prereqs: S4.3.*

```text
Implement roadmap P4 deliverables "Audition vs analysis (T15, T16)", "Practice aids (T59
part)", "Rehearse view (F7-03)" and the P4 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Mute and Solo become session-only, audio-only, independent flags (audible = anySolo ? soloed
: !muted), never touching analysis, layout, undo or updatedAt; muted pads stay editable;
"Exclude from analysis" is a separate, badged row action and Generation keeps excluded
Sounds pinned. Migrate mute-used-as-exclusion once (with backup). Count-in Off/1/2 bars;
volume, audition and the hands filter are cuttable if I'm working solo — ask me. Muted and
excluded streams stay visible in the timeline (invariant 4).
Done when the P4 exit criteria for mute/solo/exclude, the Rehearse view and the migration pass.
```

### Phase P5 · Sounds, import and projects you can trust

#### S5.1 — One soft finger-preference control; a real Sounds panel; drag feedback
*Prereqs: S4.2.*

```text
Implement roadmap P5 deliverables "Unified soft preference control (T19 full)", "Sounds
panel (T45, T17 rest)" and "Drag feedback (T46 core)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
One "Hand & finger preference (soft)" control used in the Sounds row, pad inspector, selected
moment card and Composer, always writing voiceConstraints and syncing pad fingerConstraints
(invariant 6), showing the solver suggestion at reduced opacity with no "(XX)" format
(CLAUDE.md rule). Sounds panel: search, filter chips with counts (All / To place / On grid /
Locked), progress bar, "Place remaining N"; placement status is a chip or row pill, never a
section label; groups keep "Ungrouped" and the Cmd/Ctrl+G toggle (CLAUDE.md Sound Grouping
rules). Drag shows the incoming Sound and a one-line hint; evictions toast with Undo.
Done when the P5 exit criteria for voice-ID round trips, finger sync across panels,
"Ungrouped" and filter counts pass.
```

#### S5.2 — Import review, Replace/Remove source files, place presets by mapping
*Prereqs: S1b.4, S1a.2 and decision Q3 recorded.*

```text
Implement roadmap P5 deliverables "Import review sheet (T48)", "Source files and Replace
(T47)" and "Place preset (T65 mapping slice)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
A review sheet after choosing files (one-click Skip) shows file facts and one editable row
per Sound (name per Q3, colour, short label, include); refuses note-less files; warns above
64 Sounds; tags errors by source so "Generation failed · Retry" appears only for generation.
Re-importing a matching file asks Replace (keeps placements and voice ids) / Add as new /
Cancel, with a mapping preview. Dropping a preset from another project opens a mapping dialog
(suggest by name, never by pitch) and places only on the grid, as one undo step. Nothing is
ever placed by import (invariants 5 and 7).
Done when the P5 exit criteria for Replace without duplicates and cross-project preset
mapping pass.
```

#### S5.3 — Notes in beats, so tempo changes keep the bar grid
*Prereqs: S1a.2 and decision Q6 recorded.*

```text
Implement roadmap P5 deliverable "Musical time (T49)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Store events in beats/ticks with seconds derived from projectState.tempo, via a backed-up,
idempotent migration that keeps the seconds field for one release; if Q6 is model (b),
reserve the Composer pattern slot in beats. BPM becomes a labelled field ("Tempo affects
difficulty"); a tempo change toasts and marks analysis stale; a batch import adopts the first
file's tempo and flags mismatches. The Composer keeps using project tempo (invariant 8).
Done when the P5 exit criteria for 120→90 BPM keeping every note's bar.beat and the migration
test pass.
```

#### S5.4 — Library complete; saves that can't silently collide
*Prereqs: S2.3.*

```text
Implement roadmap P5 deliverables "Library complete (T51 rest, T52 rest, T54, T55)", "Save
robustness (T57 rest)" and the P5 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Drop-a-MIDI overlay in Library and workspace; status row (Active name, draft pill, variant
count); reopened-draft banner per Q1; projects created on first meaningful action; developer
tools move behind a "Developer tools" footer link with their routes kept; bundled lucide
icons replace the remote Material Symbols. Promote, Save variant, Discard and import save
immediately; revision counters with compare-and-swap and the BroadcastChannel banner are
cuttable if I'm solo — ask me. "Can't access storage" is its own state.
Done when the P5 exit criteria for kill-after-Promote persistence, unchanged "Continue"
ordering, offline icons and the dev routes still loading pass.
```

### Phase P6 · One cost story

#### S6.1 — One headline score; honest charts; "Reading your results"
*Prereqs: S3.1 and decision Q5 recorded.*

```text
Implement roadmap P6 deliverables "Canonical headline (T21)", "Honest charts (T40)" and
"Learn More 'Reading your results' (T41)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Every layout shows one integer from the S3.1 cache (per Q5), plus Hard and Unplayable counts;
factors show share of burden; optimizer cost, seed and move count move to an (i) tooltip and
the trace; candidate rows sort by the displayed headline. PerformabilityObjective stays the
beam ranking model, and the five DiagnosticFactors stay factorized (CLAUDE.md evaluation
core). Charts get a fixed scale with bands, a labelled y-axis and bar.beat ticks. Learn More's
new section is generated from FACTOR_META and the headline definition, with a one-time
"Scores now use one scale" notice.
Done when the same layout shows the same integer in the state bar, Analysis, its row and
Compare, and the Learn More test lists exactly the FACTOR_META entries.
```

#### S6.2 — Everything measured against the Active Layout; Compare says what changed
*Prereqs: S6.1, S3.2.*

```text
Implement roadmap P6 deliverables "Baseline-aware Layouts list (T26)", "Compare 'What
changed' (T26)" and "Diversity honesty (T36)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md — the diversity baseline is an engine input change,
so run the Solver Change Checklist.
Generation receives state.activeLayout as the diversity baseline and the draft as base. Every
row (Active pinned, draft, candidates, variants, recovered drafts) shows delta chips against
Active and a mini-grid diff. Compare becomes A | B | Change rows including per-Sound moves and
re-fingerings in words, with Keep, a secondary Promote and Close in a sticky footer; draft and
variants are comparable; Compare stays read-only (canon §7). Pure translations count as
duplicates, with the "little room" note when few distinct alternatives exist. Candidate
diversity filtering and baseline-relative diffs must remain (Do-Not-Regress).
Done when the P6 exit criteria for diversity vs Active, translation filtering and "every
displayed change equals B − A" pass.
```

#### S6.3 — Generate in musician terms; weighting on the Analyze side; complete trace
*Prereqs: S6.1, S3.4.*

```text
Implement roadmap P6 deliverables "Generate options (T34)", "Custom weighting on the Analyze
side (T39 rest)" and "Complete trace (T33 full)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md — costToggles pass-through is an optimizer change.
A "Generate ▾" popover with musician-facing options and measured time estimates; Advanced
keeps Greedy, Beam and Annealing, restart count, strategy, intensity and "Reproducible run
(seed 0)" — demote, never remove (Core Functionality contract). Cost toggles and Re-analyse
move to the Analysis header ("Custom weighting"), never into Generate (canon §9); pass them to
all three methods and echo them in costTogglesUsed, labelling any method that can't honour
them. Trace shows the greedy move list, an annealing sparkline and a beam summary, with trace
shapes and stopReason unchanged.
Done when the P6 exit criteria for method availability, costTogglesUsed, weighting placement,
telemetry-based estimates and trace rendering pass.
```

### Phase P7 · Workspace by job

#### S7.1 — Consolidate the workspace
*Prereqs: S6.1–S6.3, S4.2, S4.3.*

```text
Implement roadmap P7 deliverable "Workspace consolidation (T38)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Left: Sounds | Events. Centre: state bar, grid, moment inspector, transport, and the drawer
with the Timeline | Pattern Composer tabs unchanged (invariant 3). Right: Analysis | Trace
above a pinned, resizable Layouts list, with Trace bound to MoveTracePanel. Delete
PerformanceCostsPanel and the duplicated ActiveLayoutSummary blocks. One primary action per
region; the only primary-styled Promote is in the state bar, and rows and Compare keep a
secondary Promote. Side-panel default widths come from the measured centre width. Add a
one-time "What moved" popover (and a flag if I'm working with a team).
Done when the P7 exit criteria for 1440x900 pad size and first-candidate visibility, one
primary Promote, and the listed CLAUDE.md rules (timeline width, all streams, L2 pills,
whole-moment click, MoveTracePanel reachable, Composer tab in the drawer) pass.
```

#### S7.2 — Tokens, primitives and readability sweeps
*Prereqs: S7.1 (or run alongside it if they touch different files).*

```text
Implement roadmap P7 deliverables "Raw-hex sweep (T42 rest)", "Primitive sweep (T63)" and
"Readability sweep (T64 rest)". Follow the rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
Migrate every remaining raw colour to the --sound, --status, --factor, --role and --hand
tokens, with a test that bans raw hex in src/ui/components outside the token file. Migrate
remaining panels to the primitive kit; hover-only actions appear on :focus-within or leave
the tab order; project name and BPM become real inputs. Text ≥ 11 px (data 12–13 px),
targets ≥ 24×24, contrast ≥ 4.5:1, and every colour cue gets a second cue.
Done when axe reports 0 critical/serious violations on the Library, each workspace tab,
Compare, Learn More and the import review, and the 1366x768 scan finds no text under 11 px
and no target under 24 px.
```

### Phase P8 · The Composer joins the project

#### S8.1 — Composer patterns saved, undoable and bound to Sounds  ∥ S7.x
*Prereqs: S5.3, S1a.5 and decision Q6 recorded.*

```text
Implement roadmap P8 deliverables "Composer state in the project (T67)", "Sound-bound lanes
(T66 full)" and "Composer model per Q6 (T68)". Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
The pattern (in beats, in the slot S5.3 reserved) and preset placement records live in the
project: autosaved, exported and undoable through the document slice, one undo step per note
toggle with rapid toggles coalesced. Migrate existing localStorage patterns once (with
backup). Lanes reference project Sound ids and read name, colour and mute from the project;
finger edits use the shared soft control over voiceConstraints (invariant 6). The drawer
header states the model; a Presets shelf lives inside the drawer and never takes over the
right panel. No Composer BPM control (invariant 8); the tab stays in the drawer (invariant 3).
Done when the P8 exit criteria for surviving tab switch/reload/export, one-step undo, renames
and cleared fingers pass.
```

#### S8.2 — Insert patterns into the timeline; Composer on the shared transport
*Prereqs: S8.1, S4.3, S5.2.*

```text
Implement roadmap P8 deliverables "Insert pattern (T65 full)", "Composer on the shared
transport (T60 full)" and the P8 "Learn More" item. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
"Add to timeline at bar…" reuses the S5.2 slot-to-Sound mapping (with a "New Sound" option)
and inserts notes into the one timeline as one undoable step together with any grid
placement. Preset fingering is captured as suggestions and applied as soft preferences only
on "Apply fingering". Replace the preset metric breakdown with canonical evaluation of the
preset's notes, and document that in Learn More. Composer Play drives the workspace transport
at the project tempo, lighting pads and fingers like the timeline.
Done when the P8 C9 end-to-end scenarios and "Composer Play produces audio and pad flashes
across a tab switch" pass.
```

#### S8.3 — Sequencer basics and a fully keyboard-operable grid (cuttable)
*Prereqs: S8.1, S2.4.*

```text
Implement roadmap P8 deliverables "Sequencer basics (T70, T69 rest)" and "Full keyboard grid
(T62 full)". Both are cuttable for a solo cut — confirm with me before starting. Follow the
rules in docs/product/UI_IMPLEMENTATION_PROMPTS.md.
1/16 default grid plus 1/32, velocity by vertical drag or Alt-click, duplicate bar,
copy/paste, lane reorder and colour; a resizable, collapsible, maximisable drawer. Any
"Insert rudiment" work adds notes only and discards the generator's pad and finger
assignments (invariant 7). The grid becomes role=grid with a roving tabindex: arrows move,
Enter places or picks up/drops, Delete clears, Space stays play/stop.
Done when the P8 exit criteria for sequencer basics and keyboard-only placement of all 7 TEST
MIDI 1 Sounds (with axe clean on the grid) pass.
```

---

## Phase audit prompt

Run after the last session of each phase.

```text
Audit roadmap phase <P0 | P1a | P1b | P2 | … | P8> on current main. Follow the rules in
docs/product/UI_IMPLEMENTATION_PROMPTS.md.
For every exit criterion of this phase in docs/product/UI_ENHANCEMENT_ROADMAP.md, verify it
yourself (run the test, spec or repro; take screenshots at 1366x768 and 1600x1000) and record
pass/fail with evidence in docs/product/UI_ROADMAP_PROGRESS.md. Re-run the full gates:
typecheck, unit tests, all e2e specs, and TEST MIDI 1 with 0 unplayable events for Greedy,
Beam and Annealing. Check every CLAUDE.md UI Non-Regression rule still holds. Fix only
one-line regressions; record anything bigger as a follow-up with repro steps. Open a PR with
the updated progress file and any one-line fixes.
```

## Final re-critique prompt

Run once the phases you plan to do are complete.

```text
Re-run the UI critique on current main. Use scripts/ui-critique-repros/capture-flows.mjs (update
selectors where the UI has changed) to capture every core flow at 1600x1000 and 1366x768.
For each flow and cross-cutting area in docs/product/UI_CORE_FLOWS_CRITIQUE.md, re-rate
health, list which themes in docs/product/UI_ISSUE_REGISTER.md are now resolved (with
evidence), which remain, and any new problems. Write the result to
docs/product/UI_CORE_FLOWS_RECHECK.md with before/after screenshots, and open a PR.
```
