# PushFlow UI Enhancement Roadmap

*Date: 2026-09-23 · Companion to [UI_CORE_FLOWS_CRITIQUE.md](UI_CORE_FLOWS_CRITIQUE.md). Theme IDs (T01–T70) link to [UI_ISSUE_REGISTER.md](UI_ISSUE_REGISTER.md).*

This is the implementation-level plan. It was produced by three independent planners (trust-first, journey-first, impact-per-effort), scored by a judge, checked by a completeness critic, and revised. The critique document has the condensed, user-facing version.

## Principles

- Never destroy work silently. Looking is read-only. Any change to a draft, lock, Active Layout, Sound or Composer pattern comes from a named action (Preview until P3, then Use as my draft; Promote, Save as variant, Keep, Discard, Replace). Each is exactly one undo step and is confirmed by a toast with Undo.
- Undo covers the document, never the session. Undo and Redo swap only the document slice: layouts, locks, Sounds, voiceConstraints, lanes, tempo, names and variants. Analysis, candidates, trace, transport, selection, the compare set, isProcessing and errors are session state. They never enter history, and Undo never restores them.
- Every number names its subject and scope (canon section 8). A SubjectChip (Active / Working/Test / Candidate B / Saved variant), a scope line ('5 of 7 Sounds placed, 1 excluded') and a freshness state sit beside every verdict, score, event list, Compare side and the timeline header.
- Missing data reads 'Unknown', 'Unfinished' or 'Analysing...', never 'Feasible', 0 or 'Easy'.
- One source per truth, introduced once and reused:
  - Sound identity by voiceId, with MIDI pitch as provenance only (invariant 5);
  - finger preferences in voiceConstraints (invariant 6);
  - one groupIntoMoments/momentKey and one getAnalysisForLayout cache (P1b);
  - FACTOR_META (P1b), with semantic tokens introduced with the surface that first needs them;
  - one input table for pointer and key meanings (P2);
  - one migration runner (P1a);
  - notes stored in musical time (P5).
- Locks are hard and visibly enforced by every optimizer method and every manual gesture. Preferences are soft and labelled soft.
- Proposals stay proposals. From P1a on, Generate never applies anything. Suggest, 'Place remaining' and presets are explicit and undoable. Nothing lands on the grid without a click (invariant 7), and import never places Sounds.
- The grid is the hero and the truth surface. It is sized by measurement (ResizeObserver, desktop-only, no breakpoints), never CSS-scaled or clipped, and every overlay portals out of it.
- Musician language first, engine detail one click away, and Analyze visibly distinct from Generate (canon section 9).
  - Weighting and Re-analyse live in the Analysis header.
  - Method, restarts, strategy, intensity and seed live under Generate > Advanced.
  - The trace and debug routes stay.
  - Greedy, Beam and Annealing all stay available.
- Thin slices before redesigns. Each critical theme first ships a small stop-gap that removes the harm, then gets its full fix once its prerequisites exist. Every PR ships on its own and leaves the app better.
- Gates are infrastructure, not intentions.
  - From P0, every PR runs typecheck, vitest (node and happy-dom) and Playwright at 1366x768 and 1600x1000 in CI. A nightly job runs deep annealing.
  - The C1-C9 repros live in test/e2e as expected-fail specs that the fixing PR flips.
  - Optimizer PRs must pass TEST MIDI 1: 0 unplayable events, locks held and seed-0 determinism, for Greedy, Beam and Annealing.
- Learn More moves with the metrics (invariant 2). Any PR that changes a metric, verdict tier or constraint ships its Learn More change. A test renders the Constraints and verdict sections from the same lists the solvers and the badge use.
- Accessible by construction. The Dialog, Popover and Toast primitives (P1a/P1b) and Tabs, Toggle, Checkbox and IconButton (P3) require labels and render roles and states. Colour is always paired with a second cue. Text is at least 11px and targets at least 24px.

## North star

A three-column desktop workspace, laid out by job and tuned from 1366x768 to 1920x1080 by measurement rather than breakpoints. The grid always shows exactly what the user is looking at, and every number says which layout it describes.

TOP BAR

- '< Projects' and the project name (editable).
- One passive save status: 'Saved 14:02', or a red 'Couldn't save · Retry · Export a copy'.
- A labelled Tempo field ('Tempo affects difficulty').
- Undo and Redo, each naming its target ('Undo: Move Kick'). They undo user edits only, never analysis, candidates or playback.
- The '?' shortcut sheet (generated from the one input table) and Learn more.


LEFT PANEL (Sounds | Events)

- Sounds header:
  - search;
  - filter chips with counts (All / To place / On grid / Locked);
  - a '5 of 7 placed' bar;
  - 'Place remaining N'.
- Rows sit in group sections, with 'Ungrouped' for the rest (the Cmd/Ctrl+G toggle is kept). Placement status is a filter chip and a row pill ('To place'), never a section label.
- Each row:
  - a distinct colour (--sound-N), a clean name and the hit count;
  - a pad locator (R5C3) or a 'To place' pill;
  - a soft preference chip and a lock toggle;
  - the app's only S/M, which is session-only audition;
  - an overflow menu: Rename, Colour, Group, Short label, Name from GM drum map, Exclude from analysis, Unplace, Delete.
- A 'Source files' section with Replace and Remove.
- Events:
  - moments grouped under bar headers;
  - each row shows bar.beat.sub, Sound chips, finger chips (L2 R1) and a text difficulty badge;
  - filter chips All / Medium+ / Hard / Unplayable, plus Prev/Next hard.


CENTRE

- A layout-state bar, fixed and unscaled. It shows:
  - a role chip in --role-* colours with an icon;
  - the clean name, and 'N pads vs Active' (plus 'vs your draft' when relevant);
  - 'Up to date' or 'Updating...';
  - only the actions that fit the role. A draft gets Promote (the only primary-styled Promote in the app), Save as variant and Discard. A candidate or variant gets Use as my draft, Keep, Promote and Back to my draft.
- One view control: Now | Now+Next | Prev·Now·Next, plus Fingers and Labels.
- The measured 8x8 grid (pads 32-72px) with hand-zone labels.
  - A struck pad keeps its Sound's colour and short name, and gains a hand-coloured ring and a finger badge.
  - Next strikes get a dashed outline and '+1'.
  - Locked pads show a corner glyph, and pads moved against Active are outlined.
- A docked moment inspector: every strike, a one-sentence 'why it is hard', Prev/Next hard, Rehearse, and an audition button.
- A persistent, workspace-owned transport:
  - Play/Stop, Return, bar.beat.tick position, a bar-snapped loop bar;
  - Metronome, Hits, Count-in, Speed with effective BPM, Hands, Volume;
  - a 'Rehearse view' toggle that collapses both side panels.
- The bottom drawer holds Timeline | Pattern Composer tabs (invariant 3), with a remembered splitter. The inactive tab is inert.
- The timeline header names the layout it shows, and its pills use that layout's fingering.
- The timeline fills its width and shows every stream. Unplaced notes are outlined, excluded Sounds dimmed and unplayable notes hatched. Pills read 'L2', and clicking a note selects its whole moment.


RIGHT PANEL

- Analysis | Trace tabs above a pinned, resizable Layouts list.
- The Analysis header is the Analyze surface: SubjectChip, 'Weights: default / Custom weighting' (the cost toggles) and Re-analyse.
- Below the header:
  - the scope line;
  - the verdict: Feasible / Degraded / Infeasible / Unfinished / Unknown;
  - one headline, 'Playability 0-100 (higher = easier)', from the chosen evaluator, with Hard and Unplayable moment counts and deltas against Active;
  - the 5 canonical factors as share-of-burden bars from FACTOR_META;
  - 'What limits this layout';
  - 'Difficulty over time' with bands and bar ticks;
  - (i) links into Learn More.
- The Layouts list is the Generate surface:
  - 'Generate v' opens musician presets with measured time estimates. Advanced keeps Greedy / Beam / Annealing, restarts, strategy, intensity and 'Reproducible run (seed 0)'.
  - Rows, in order: Active pinned, your Draft, the latest run, earlier runs folded.
  - Each candidate shows a stable letter, delta chips, a mini-grid diff and a compare checkbox, with Keep / Use as my draft / a secondary Promote.
  - Then Saved variants (renameable, scored), then a capped 'Recovered drafts' group that holds anything the app auto-kept.
- Trace: 'How candidate B was found · Stopped: <reason>'. MoveTracePanel shows greedy moves, an annealing sparkline and a beam summary.


INPUT MODEL (one table, registry-tested)

- Pad click:
  - with a Sound armed, places it;
  - with a moment selected, keeps the moment and shows the pad Sound's hits;
  - otherwise, selects the pad;
  - while inspecting, only selects.
- Alt-click or the inspector's play button auditions.
- Space plays or stops everywhere except text fields.
- Enter picks up or drops a focused pad.
- ←/→ step moments when stopped and seek by moment while playing.
- Escape peels back one layer at a time.


CORE FLOWS

- Import: drop or pick a .mid from the Library or the workspace. A review sheet lets the user name, colour and include Sounds. Default names come from the track or file, never from pitch. Nothing is placed.
- Arrange: drag, or click a Sound and then a pad, with a hint that says what will happen. Locked pads refuse moves. 'Place remaining N' proposes a completion that the user applies with one click.
- Analyse: refreshes about 1 s after an edit. Previous numbers stay dimmed.
- Generate: proposals fill the list, candidate A is inspected read-only and the draft is untouched. Progress, an ETA and Cancel are shown, and deep annealing respects a time budget.
- Compare: tick any two rows to open a portaled 'What changed' A | B | Change table with a sticky footer.
- Promote and Discard: happen immediately with an Undo toast. Anything replaced is auto-kept.
- Rehearse: 'Next hard' jumps to the moment and explains it. Rehearse loops two bars at 75% after a count-in, while the grid follows the playhead.
- Compose: Composer lanes are project Sounds on the one timeline, played through the shared transport.
- Return tomorrow: Library cards show the layout you will land on, real metadata and status. Import MIDI is the primary action.

## Wireframe (target workspace, ~1440×900)

```text
+----------------------------------------------------------------------------------------------------------+
| < Projects | Groove Study (edit) | Saved 14:02 | Tempo [120] BPM | Undo: Move Kick  Redo | ?  Learn more |
+---------------------+------------------------------------------------------------+-----------------------+
| [Sounds]  Events    | [WORKING/TEST] Draft of Default . 3 pads vs Active         | [Analysis]  Trace     |
| Search sounds...    | Up to date       [Promote] [Save as variant] [Discard]     | WORKING/TEST . fresh  |
| All 7 |To place 2|  | View: (Now) Now+Next Prev.Now.Next   Fingers   Labels      | Weights: default  [v] |
| On grid 5|Locked 1  |       1      2      3      4      5      6      7      8   | [Re-analyse]          |
| [#####--] 5/7 placed| R8 [     ][     ][     ][     ][     ][     ][     ][     ]| Scope: 5 of 7 placed  |
| [Place remaining 2] | R7 [     ][     ][Ht+1 ][     ][     ][Ride ][     ][     ]| UNFINISHED, not failed|
| DRUMS               | R6 [     ][Sn L3][     ][Tom ~][     ][     ][     ][     ]| Playability 82/100 (i)|
| o Kick  R5C3 [#] S M| R5 [     ][     ][Kk#L2][     ][     ][     ][     ][     ]| Hard 2   Unplayable 0 |
| o Snare R6C2 [ ] S M| R4 [     ][     ][     ][     ][     ][     ][     ][     ]| vs Active: +4  Hard -1|
| o Hat   R7C3 [ ] S M| R3 [     ][     ][     ][     ][     ][     ][     ][     ]| Movement  #####-  41% |
| UNGROUPED           | R2 [     ][     ][     ][     ][     ][     ][     ][     ]| Grip      ###---  24% |
| o Ride  R7C6 (x) S M| R1 [     ][     ][     ][     ][     ][     ][     ][     ]| Alternation ##--  18% |
| o Shaker [to place] |       Left hand zone          |      Right hand zone       | Hand bal.  #---   12% |
| o Clap   [to place] | ---------------------------------------------------------- | Constraints #---    5%|
| SOURCE FILES        | MOMENT 12 . bar 3.2.3 . HARD . Kick L2 + Snare L3          | Limits: Hat->Ride     |
| groove.mid . 7 snd  | Why: R hand reaches 3 pads from Hat (Movement)             | ._.-^-._.-^^-._ Hard--|
| [Replace] [Remove]  | [< Prev hard] [Next hard >]    [Rehearse bars 3-4]         | 1   2   3   4   5 bars|
| -- Events tab --    | ---------------------------------------------------------- | LAYOUTS  [Generate v] |
| All|Med+|Hard|Unpl. | [> Play] |< 3.2.3  Loop 3-4  Metro  Hits  0.75x=90 BPM     | [x] ACTIVE Default  78|
| 3.2.3 Kk+Sn   HARD  | Count-in 1 | Hands: Both | Vol  ||  [Timeline]  Composer   | [x] DRAFT (yours) 82+4|
| 3.3.1 Hat     Easy  | Timeline shows: WORKING/TEST . Draft of Default            | Run 2 . Quick . 1m ago|
|                     | Sound |1          |2          |3 [==loop==|4 ====]         | [ ] B Comfort 86 +8   |
|                     | Kick  |L2    L2   |L2    L2   |L2    L2   |L2    L2        |  Keep  Use  Promote   |
|                     | Snare |   L3      |   L3      |   L3      |   L3           | [ ] C Altern. 80 +2   |
|                     | Hat   |R1 R1 R1 R1|R1 R1 R1 R1|R1 R1 R1 R1|R1 R1 R1        | VARIANTS              |
|                     | Shaker|::: not on grid yet - outlined, still shown :::     | [ ] Default 23Sep 78  |
|                     | Ride  |ooo excluded from analysis - dimmed, shown ooo      | RECOVERED DRAFTS (1)  |
|                     | === drag splitter: timeline / grid (remembered) ===        | [Compare 2]           |
+---------------------+------------------------------------------------------------+-----------------------+
Kk#L2 = current strike, locked, finger | Ht+1 = next | ~ = moved vs Active | (x) = excluded | S M = audition
Pad click: Sound armed = place . moment selected = show its hits . Alt-click = audition | Enter picks up/drops
Primary Promote only in the state bar; rows and Compare keep a secondary Promote | Compare = portaled dialog
```

## Phases

| Phase | Size | Themes |
|-------|------|--------|
| P0 · Test and CI foundation (makes every later gate real) | ~1 week, ~6 PRs, 1-2 engineers (1.5-2 weeks solo). | Test and CI infrastructure (enables every exit criterion), TEST MIDI 1 gate hardening (prepares [T11](UI_ISSUE_REGISTER.md#t11)/[T18](UI_ISSUE_REGISTER.md#t18)), [T55](UI_ISSUE_REGISTER.md#t55) (self-hosted text fonts) |
| P1a · Stop losing work: undo, drafts, locks, identity, saving, Composer data (spine steps 4, 8, 9) | 3-4 weeks for 2 engineers, ~13 PRs. T02 (the slice split) and T11+T18 are M; the rest are S. P1b's independent PRs (portal, verdict) can start in parallel in the second half. | [T02](UI_ISSUE_REGISTER.md#t02), [T01](UI_ISSUE_REGISTER.md#t01) (proposal-only + recovered-drafts slice), [T11](UI_ISSUE_REGISTER.md#t11), [T18](UI_ISSUE_REGISTER.md#t18), [T12](UI_ISSUE_REGISTER.md#t12), [T14](UI_ISSUE_REGISTER.md#t14) (lock/self-drop/hash slice), [T15](UI_ISSUE_REGISTER.md#t15) (no-delete slice), [T31](UI_ISSUE_REGISTER.md#t31) (toast primitive), [T57](UI_ISSUE_REGISTER.md#t57) (truthful-save slice), [T60](UI_ISSUE_REGISTER.md#t60)/[T67](UI_ISSUE_REGISTER.md#t67) (mounted-tabs + Composer data slice), [T66](UI_ISSUE_REGISTER.md#t66) (notes-only sync + finger-routing slice), Migration runner |
| P1b · Stop false verdicts and broken overlays (spine steps 5, 7, 10) | ~3 weeks for 2 engineers, ~12 PRs, all S. Overlaps the second half of P1a. | [T07](UI_ISSUE_REGISTER.md#t07), [T22](UI_ISSUE_REGISTER.md#t22) (+ shared moment grouping), [T20](UI_ISSUE_REGISTER.md#t20) (FACTOR_META base), [T06](UI_ISSUE_REGISTER.md#t06), [T08](UI_ISSUE_REGISTER.md#t08) (stub/prune + analysis-cache slice), [T09](UI_ISSUE_REGISTER.md#t09) (override slice), [T10](UI_ISSUE_REGISTER.md#t10) (playback-overlay slice), [T15](UI_ISSUE_REGISTER.md#t15) (scope-line slice), [T19](UI_ISSUE_REGISTER.md#t19) (commit-safety slice), [T28](UI_ISSUE_REGISTER.md#t28) (Delete-key slice), [T61](UI_ISSUE_REGISTER.md#t61) (arrow-keys-while-playing slice), [T65](UI_ISSUE_REGISTER.md#t65) (refuse-first + Mirror-toggle slice), [T21](UI_ISSUE_REGISTER.md#t21) (false 'low difficulty' claim) |
| P2 · Quick-win sprint: see the grid, tell Sounds apart, reach every control, trust the Library (spine steps 1-4) | 3-4 weeks for 2 engineers, ~16 PRs. Four M items: T04 (measured grid), the T17 slice (F1-02), the T51 slice (F1-05) and T29 (F10-07). | [T04](UI_ISSUE_REGISTER.md#t04), [T05](UI_ISSUE_REGISTER.md#t05), [T50](UI_ISSUE_REGISTER.md#t50), [T17](UI_ISSUE_REGISTER.md#t17) (defaults slice), [T20](UI_ISSUE_REGISTER.md#t20) (FACTOR_META migration + Compare-names slice), [T23](UI_ISSUE_REGISTER.md#t23), [T29](UI_ISSUE_REGISTER.md#t29), [T43](UI_ISSUE_REGISTER.md#t43) (notation slice), [T44](UI_ISSUE_REGISTER.md#t44), [T56](UI_ISSUE_REGISTER.md#t56), [T39](UI_ISSUE_REGISTER.md#t39) (dead-control slice), [T52](UI_ISSUE_REGISTER.md#t52) (card-truth slice), [T51](UI_ISSUE_REGISTER.md#t51) (Library MIDI entry slice), [T53](UI_ISSUE_REGISTER.md#t53), [T61](UI_ISSUE_REGISTER.md#t61) (registry + input table), [T62](UI_ISSUE_REGISTER.md#t62) (click-to-place slice), [T64](UI_ISSUE_REGISTER.md#t64) (type/contrast slice), [T69](UI_ISSUE_REGISTER.md#t69) (geometry slice), [T31](UI_ISSUE_REGISTER.md#t31) (disabled-reason slice), [T38](UI_ISSUE_REGISTER.md#t38) (token-alpha slice) |
| P3 · One inspected layout, one yardstick: safe inspection, state bar, honest freshness (spine steps 3-9) | 3-4 weeks for 2 engineers, ~13 PRs (M). | [T01](UI_ISSUE_REGISTER.md#t01), [T03](UI_ISSUE_REGISTER.md#t03), [T08](UI_ISSUE_REGISTER.md#t08), [T13](UI_ISSUE_REGISTER.md#t13), [T14](UI_ISSUE_REGISTER.md#t14), [T21](UI_ISSUE_REGISTER.md#t21) (one-yardstick slice), [T25](UI_ISSUE_REGISTER.md#t25), [T30](UI_ISSUE_REGISTER.md#t30), [T32](UI_ISSUE_REGISTER.md#t32), [T35](UI_ISSUE_REGISTER.md#t35) (+ annealing time budget), [T37](UI_ISSUE_REGISTER.md#t37), [T33](UI_ISSUE_REGISTER.md#t33) (trace-per-candidate slice), [T31](UI_ISSUE_REGISTER.md#t31) (lifecycle confirmations), [T63](UI_ISSUE_REGISTER.md#t63) (primitive kit) |
| P4 · The moment loop: find a hard moment, understand it, rehearse it (spine step 10 plus rehearsal) | 4-6 weeks, ~15 PRs in two parallel tracks, Moment and Transport (M). Cuttable for a solo cut: the hands filter, the volume popover and audition. | [T24](UI_ISSUE_REGISTER.md#t24) (solver eventIndex + selection re-resolution), [T09](UI_ISSUE_REGISTER.md#t09), [T10](UI_ISSUE_REGISTER.md#t10), [T27](UI_ISSUE_REGISTER.md#t27), [T28](UI_ISSUE_REGISTER.md#t28), [T42](UI_ISSUE_REGISTER.md#t42) (hand tokens + finger notation), [T58](UI_ISSUE_REGISTER.md#t58), [T60](UI_ISSUE_REGISTER.md#t60) (workspace transport service), [T15](UI_ISSUE_REGISTER.md#t15), [T16](UI_ISSUE_REGISTER.md#t16), [T59](UI_ISSUE_REGISTER.md#t59) (count-in, volume, audition, hands), [T61](UI_ISSUE_REGISTER.md#t61), [T43](UI_ISSUE_REGISTER.md#t43), [T64](UI_ISSUE_REGISTER.md#t64) (playback readability part), [T04](UI_ISSUE_REGISTER.md#t04) (Rehearse view, F7-03) |
| P5 · Sounds, import and projects you can trust (spine steps 1-2, plus coming back tomorrow) | 4-5 weeks, ~14 PRs in two tracks: Identity & Sounds (including Place preset), and Import/Library/Persistence (M). Cuttable for a solo cut: cross-tab compare-and-swap and the BroadcastChannel banner. | [T17](UI_ISSUE_REGISTER.md#t17), [T19](UI_ISSUE_REGISTER.md#t19), [T45](UI_ISSUE_REGISTER.md#t45), [T46](UI_ISSUE_REGISTER.md#t46) (core), [T47](UI_ISSUE_REGISTER.md#t47), [T48](UI_ISSUE_REGISTER.md#t48), [T49](UI_ISSUE_REGISTER.md#t49), [T51](UI_ISSUE_REGISTER.md#t51), [T52](UI_ISSUE_REGISTER.md#t52), [T54](UI_ISSUE_REGISTER.md#t54), [T55](UI_ISSUE_REGISTER.md#t55), [T57](UI_ISSUE_REGISTER.md#t57), [T65](UI_ISSUE_REGISTER.md#t65) (map-to-Sounds slice) |
| P6 · One cost story and baseline-aware compare (spine steps 5-9) | 4-5 weeks, ~10 PRs (L). | [T21](UI_ISSUE_REGISTER.md#t21) (headline presentation), [T26](UI_ISSUE_REGISTER.md#t26), [T34](UI_ISSUE_REGISTER.md#t34), [T36](UI_ISSUE_REGISTER.md#t36), [T33](UI_ISSUE_REGISTER.md#t33), [T40](UI_ISSUE_REGISTER.md#t40), [T41](UI_ISSUE_REGISTER.md#t41), [T39](UI_ISSUE_REGISTER.md#t39) (custom weighting) |
| P7 · Workspace by job and the accessibility sweep (all spine steps) | 3-4 weeks, ~8 PRs (M). Cuttable for a solo cut: the flag rollout (use a branch instead). | [T38](UI_ISSUE_REGISTER.md#t38), [T42](UI_ISSUE_REGISTER.md#t42) (raw-hex sweep), [T63](UI_ISSUE_REGISTER.md#t63) (sweep), [T64](UI_ISSUE_REGISTER.md#t64) (rest) |
| P8 · The Composer joins the project, plus full keyboard placement (spine step 2 side entrance) | 5-7 weeks, ~12 PRs (L). Can overlap with P7. Cuttable for a solo cut: T70 sequencer basics and the full T62 keyboard grid. | [T67](UI_ISSUE_REGISTER.md#t67), [T66](UI_ISSUE_REGISTER.md#t66), [T68](UI_ISSUE_REGISTER.md#t68), [T65](UI_ISSUE_REGISTER.md#t65) (timeline insertion), [T70](UI_ISSUE_REGISTER.md#t70), [T69](UI_ISSUE_REGISTER.md#t69), [T60](UI_ISSUE_REGISTER.md#t60) (Composer on the shared transport), [T62](UI_ISSUE_REGISTER.md#t62) |

### P0 · Test and CI foundation (makes every later gate real)

**Size:** ~1 week, ~6 PRs, 1-2 engineers (1.5-2 weeks solo).

**Goal.** Make every gate in this roadmap executable in CI, so each later fix lands with a regression test that runs on every PR.

**Why now.**

Today no gate in this plan can actually run:

- .github/workflows/deploy.yml runs only `npm ci` and `npm run build`, so no test runs on a push or a PR.
- vitest.config.ts uses environment 'node', and no DOM library is installed, so component checks such as FeasibilityBadge (C6) cannot run.
- `playwright` is installed only as a library, with no runner or config.
- The C1-C9 repro scripts in scripts/ui-critique-repros/ are exploratory probes, not tests, and C4 reads React fiber internals.
- index.html loads Inter, Space Grotesk and Material Symbols from fonts.googleapis.com, so pixel diffs would flake.
- testMidi1Integration.test.ts has no annealing case. It asserts only playableRatio > 0.5, has no lock case, and keys existingVoices by MIDI pitch.

Without P0, the TEST MIDI 1 rule and every 'C# flipped' exit criterion are promises, not checks.

**Deliverables**

- Playwright runner.
  - Add @playwright/test and playwright.config.ts.
  - A webServer runs vite on a dedicated port (for example 5199 with --strictPort).
  - Projects at 1366x768 and 1600x1000; 1920x1080 only for the C1 menu spec.
  - Chromium in CI, Firefox nightly. Specs live in test/e2e/.
- C1-C9 as specs. Each probe in scripts/ui-critique-repros/ becomes test/e2e/c1-pad-menu.spec.ts ... c9-presets.spec.ts.
  - Each spec asserts the correct behaviour and is marked test.fail() with the reproduced cause. The fixing PR removes the marker.
  - No spec reads React internals.
- Test hooks.
  - A dev/e2e-only window.__pf (read-only state snapshot, layout hash, a few dispatch helpers) behind import.meta.env.VITE_E2E, stripped from production builds.
  - data-testids on pads, the pad menu, the verdict badge, the Compare dialog, candidate rows, the transport and the drawer tabs.
- Component tests.
  - Add happy-dom and @testing-library/react. vitest includes test/**/*.test.tsx with a per-file environment, plus ResizeObserver and matchMedia shims in test/helpers.
  - First test: FeasibilityBadge renders each tier. It is expected-fail on the 'feasible' default until P1b.
  - Add @axe-core/playwright with one Library smoke spec, for P7.
- CI.
  - .github/workflows/ci.yml runs on pull_request and push to main: npm run typecheck, npm run test:run, then Playwright (sharded, with traces uploaded on failure).
  - A nightly schedule runs deep annealing on TEST MIDI 1 and the Firefox project.
  - deploy.yml runs typecheck and test:run before build.
- Deterministic fonts and screenshots.
  - Self-host Inter and Space Grotesk (woff2 in public/fonts, @font-face in index.css).
  - The e2e config blocks fonts.googleapis.com, so the remaining Material Symbols link (removed in P5) can't make screenshots flaky.
  - Screenshot specs use a fixed deviceScaleFactor with animations disabled.
- Fixtures. Copy TEST MIDI 1 into test/fixtures/midi/ for tests and public/demo/ for the P2 demo project. The archive copy stays, so the CLAUDE.md path remains valid.
- Extended TEST MIDI 1 gate in testMidi1Integration.test.ts:
  - an annealing quick case;
  - a strict 0-unplayable assertion for greedy, beam and annealing, replacing playableRatio > 0.5;
  - a lock case: a Sound locked at [7,0] holds in every candidate and placementLocks is non-empty (expected-fail until P1a);
  - a seed-0 determinism snapshot per method;
  - Sounds keyed by id, not pitch.

  A deep-annealing variant runs only nightly and records its duration.
- Flags, for team mode only: a tiny src/utils/flags.ts that reads VITE_FLAG_* at build time, with a dev-only localStorage override. It is used only where a phase says 'behind a flag'. A solo developer skips flags and uses short-lived branches instead.

**Exit criteria**

- [ ] A deliberately failing commit on a scratch branch turns the ci.yml check red for each of typecheck, a unit test and an e2e spec.
- [ ] The e2e suite passes twice in a row in CI with identical screenshots while fonts.googleapis.com is blocked.
- [ ] C1-C9 exist as test.fail specs that fail today for the documented reason. A grep finds no '__reactFiber' or '_reactInternals' in test/.
- [ ] A happy-dom component test renders FeasibilityBadge, and the axe smoke spec runs on the Library.
- [ ] testMidi1Integration.test.ts has greedy, beam and annealing cases with strict 0-unplayable assertions, a lock case and seed-0 snapshots, and reads from test/fixtures. It builds no Map keyed by MIDI pitch. Any method that fails the strict check today is recorded as expected-fail and becomes a P1a blocker.
- [ ] The nightly job runs deep annealing and reports its duration.
- [ ] A grep of dist/ finds no window.__pf.

**Risks**

- Playwright at two viewports can slow CI. Shard the run, limit screenshot specs to the two viewports, and keep deep annealing nightly.
- happy-dom has no Web Audio and no layout. Keep audio and geometry checks in Playwright.
- The strict 0-unplayable assertion may expose an existing failure. That is intended: fix it in P1a before T11 merges, never by weakening the test.
- A test hook in the app could leak into production. Guard it with the env flag and assert its absence in dist/.

### P1a · Stop losing work: undo, drafts, locks, identity, saving, Composer data (spine steps 4, 8, 9)

**Size:** 3-4 weeks for 2 engineers, ~13 PRs. T02 (the slice split) and T11+T18 are M; the rest are S. P1b's independent PRs (portal, verdict) can start in parallel in the second half.

**Goal.** Remove every reproduced path to silent data loss (C2, C3, the Composer drop and Clear, the ghost locks), so users can trust Undo, their drafts, their locks, saving and Composer edits. This comes before any display fix because it is the recovery path for everything else.

**Why now.**

Several data-loss paths are live today:

- useUndoRedo snapshots and restores the whole ProjectState, including candidates, moveHistory, currentTime and isPlaying. Undoing Generate loses the candidates (C2), and undo during playback restores a stale transport.
- Generate auto-applies candidate A through two dispatches in useAutoAnalysis.ts (about lines 310 and 343). This overwrites drafts mid-run and places every Sound on an empty grid (invariant 7).
- Beam and Annealing drop locks (C3).
- A pitch fallback plays an unplaced Sound on another Sound's pad (F8-V01), which would corrupt every 'placed' count built later.
- Composer sync reverts renames, Composer fingers never reach voiceConstraints (invariant 6), and Clear has no undo.

This is CLAUDE.md priority 1. Open questions Q1 (draft persistence) and Q2 (finger preferences on Discard) must be settled first.

**Deliverables**

- [M] Undo on the document only (T02).
  - Split ProjectState into two slices.
    - Document: layouts, locks, soundStreams, voiceConstraints, lanes, tempo, names, savedVariants.
    - Session: analysis, candidates, moveHistory, moveHistoryStopReason, selectedCandidateId, compare set, currentTime, isPlaying, selection, isProcessing, error.
  - useUndoRedo snapshots and swaps only the document. Analysis re-resolves by layout hash after an undo.
  - A transaction wrapper makes Suggest, an import, a Ctrl+G grouping, Discard, Promote and apply-candidate one step each. SUGGEST_STARTING_LAYOUT is now recorded.
  - A reducer result that leaves the document unchanged (a no-op SYNC_STREAMS_FROM_LANES, a self-drop) records nothing.
  - Opening a project starts with an empty history.
  - The Undo and Redo buttons name their target ('Undo: Discard').
- Toast region primitive (T31 slice): aria-live=polite, with an Undo action. Every item below reports through it.
- Generate only proposes (T01 slice).
  - Delete the APPLY_GENERATION_TO_LAYOUT dispatches in useAutoAnalysis. After a run the candidates fill the list with the hint 'Preview A to try it'. The grid and draft are untouched, so Generate on an empty grid places nothing.
  - A click on a candidate card's body no longer previews; only the Preview button does.
  - Preview, Load Draft and candidate or variant Promote are the explicit actions that replace a draft.
  - Before one of them replaces a draft whose hash differs from Active, from the incoming layout and from every saved variant, the draft is auto-kept, with the toast 'Your draft was kept · Restore'.
  - Auto-kept drafts go into a separate 'Recovered drafts' group, stored with provenance 'recovered' through the migration runner, and never mixed into the variants list. The group is deduped by layout hash and capped at 5, pruning the oldest first with a notice.
  - The variants list shows every variant (the slice(-3) limit in LayoutOptionsPanel.tsx goes).
- [M] Locks honoured and identity strict (T11, T18), with one Solver Change Checklist run for both.
  - Beam and Annealing seeds pre-place locked Sounds. placementLocks carry through seeding, compaction and mutation, and annealingSolver receives manualAssignments.
  - Post-validation drops any candidate that violates a lock and says why in the list header.
  - Locked pads refuse drag-out and drop-onto, with the tooltip 'Locked · Unlock to move'. The lock glyph is drawn outside the name area.
  - Remove the MIDI-pitch fallbacks from mappingResolver, the useAutoAnalysis constraint mapping, soundStreamLookup, ActiveLayoutSummary (about line 85) and the Composer lookups (F9-18). A Sound with no pad is unmapped even when another Sound shares its pitch.
  - A one-time note: 'Scores changed: Sounds are now matched by identity, not pitch'.
  - The P0 lock case and the strict 0-unplayable cases flip to passing.
- Discard hygiene (T12).
  - Discard prunes locks whose Sound isn't on the locked pad in Active.
  - Pad fingerConstraints are re-derived from voiceConstraints on every layout switch (Discard, Promote, Preview, Load).
  - Finger preferences follow the Q2 decision. The default keeps them, and the toast says so.
- Freshness slice (T14).
  - TOGGLE_PLACEMENT_LOCK marks the analysis stale.
  - Dropping a pad on its own position is a no-op that creates no draft and no history entry.
  - hasWorkingChanges = hashLayout(working) !== hashLayout(active).
- Mute can't delete (T15 slice). Generate never removes an already-placed Sound, and muted Sounds stay pinned.
- [Outsized S] Truthful save (T57 slice).
  - 'Saved' appears only after a successful write. A failure shows a persistent red 'Couldn't save · Retry · Export a copy'.
  - Pending saves are flushed on pagehide, and beforeunload warns while a save is pending.
  - Cmd/Ctrl+S saves now.
  - Export includes the Composer's localStorage pattern. Until P8 moves the pattern into the project, the export toast states 'Composer pattern included'.
- [Outsized S] Composer data slice (T60, T66, T67).
  - Timeline and Composer stay mounted. The inactive tab is hidden and marked inert, and the Composer's window-level key handlers (such as M) run only while its tab is active.
  - Pending Composer saves and syncs are flushed on Stop and on unmount. The playhead leaves the save/sync effect deps, so a tab switch no longer freezes playback or drops edits.
  - Composer sync writes notes only, never a Sound's name, colour or mute (F9-03).
  - Composer finger edits go through SET_VOICE_CONSTRAINT keyed by the lane's project Sound id, and null clears a finger (F9-V04, invariant 6).
  - Clear shows an Undo toast that restores the previous loopState and lane source from memory (F9-08).
- Migration runner.
  - A schemaVersion plus an ordered migrations[] list runs on load. Each migration is idempotent and is preceded by an automatic backup export per project.
  - First migrations: prune ghost locks whose Sound isn't on the locked pad (left by past Discards, F10-V02), and flag preset fingerings as unverified so they are no longer applied as constraints (F9-12).
  - P3, P4, P5 and P8 add their migrations to this runner.
- Learn More (invariant 2). The Constraints section states that Greedy, Beam, Annealing and manual edits all enforce locks, and that Sounds are matched by identity, never by pitch.

**Exit criteria**

- [ ] Reducer tests:
  - Place 3 Sounds, let analysis settle, then Undo 3 times: the grid is empty.
  - One Undo after Suggest restores the pre-Suggest grid.
  - After Generate, Undo keeps the candidate list and the trace (MoveTracePanel still shows state.moveHistory) and undoes the previous user edit.
  - Undo during playback keeps playing from the current time.
  - A reopened project starts with an empty history.
  - isProcessing is false after both success and error.
- [ ] C2 flipped on TEST MIDI 1:
  - After Generate, the draft hash is unchanged, and a grep test finds no APPLY_GENERATION_TO_LAYOUT dispatch in useAutoAnalysis.
  - An edit made during a run is kept.
  - After Preview, a card-body click, Load Draft, card Promote and variant Promote, a hand-built draft is recoverable as the draft or in 'Recovered drafts', including after a reload.
- [ ] After 5 auto-keeps, a user-named variant is still visible. Recovered drafts are deduped by hash and capped at 5, with a notice on pruning.
- [ ] Generate on an empty grid leaves the draft (workingLayout) empty (invariant 7).
- [ ] C3 flipped for greedy, beam and annealing quick (deep annealing runs nightly):
  - A lock at [7,0] holds in every candidate, and placementLocks is non-empty.
  - Manual drags onto and out of a locked pad are refused.
  - TEST MIDI 1 reports 0 unplayable events for every method.
  - Seed 0 gives identical output twice, and the trace shapes are unchanged.
- [ ] When two Sounds share a pitch and one is unplaced, the unplaced Sound's events are unmapped. A Composer lane never matches a pad by pitch.
- [ ] After Discard, Active holds no lock whose Sound isn't on that pad. After Discard, Promote, Preview or Load, pad fingerConstraints equal the values derived from voiceConstraints.
- [ ] A lock toggle marks the analysis stale. A self-drop creates no draft and no history entry.
- [ ] Generate with a muted, placed Sound keeps its pad in every candidate.
- [ ] A mocked IndexedDB write failure shows the red chip and never 'Saved'.
- [ ] Composer and Timeline tabs:
  - A Composer note toggled less than 100 ms before a tab switch survives a reload.
  - Playback continues across the switch.
  - With the Timeline tab shown, pressing M does nothing in the Composer.
- [ ] Composer edits and project Sounds stay in sync:
  - A Sound renamed in the Sounds panel keeps its name after a Composer edit.
  - A Composer finger edit appears in the Sounds panel and can be cleared.
  - Undo after Clear restores the notes, Sounds and pads.
  - An export/import round trip keeps the Composer pattern.
- [ ] Migration:
  - A fixture project with ghost locks is migrated only after its backup file exists. The ghost locks are gone, and running the migration again changes nothing.
  - Presets with invented fingering are flagged unverified, and their fingering is not applied.
- [ ] The Learn More Constraints section lists lock enforcement for all three methods (sync test from P1b).

**Risks**

- The document/session split touches every reducer case and the persistence mapping. Land the split before the transaction wrapper, and add one reducer test per user intent plus a persistence round-trip test.
- Users used to Generate changing the grid may think nothing happened. The 'Preview A to try it' hint and scrolling the list into view address this until P3 auto-inspects.
- The seeding change and the pitch-fallback removal shift candidate quality and scores. Guard them with the P0 TEST MIDI 1 gate, the diversity tests, seed-0 snapshots and render checks on MoveTracePanel and CandidatePreviewCard, and explain the shift once with the 'Scores changed' note.
- Keeping both drawer tabs mounted raises render cost during playback. Profile at 1366x768.
- A migration can damage stored projects. Back up first, keep every migration idempotent, and test on fixture projects.

### P1b · Stop false verdicts and broken overlays (spine steps 5, 7, 10)

**Size:** ~3 weeks for 2 engineers, ~12 PRs, all S. Overlaps the second half of P1a.

**Goal.** Make every verdict honest, every overlay usable and the moment view truthful, using thin slices that ship before the lifecycle and moment redesigns. It also introduces, once, the shared pieces later phases reuse.

**Why now.**

C1 (an unportaled menu inside transform and backdrop-filter), C5/C8 (inline opacity overrides, and the selection frozen during play), C6 (FeasibilityBadge defaults to 'feasible'), C7 (a zero stub in Compare) and C9 (preset drops) each have a one-file cause.
Four shared pieces are built here once, so nothing is built twice:

- groupIntoMoments + momentKey (T22), reused by T23 in P2 and T24 in P4;
- FACTOR_META, reused by P2-P6;
- getAnalysisForLayout, reused by P2 variant scores and P3 inspection;
- the --status-* tokens.

**Deliverables**

- Shared moment grouping (T22 base).
  - groupIntoMoments(events, MOMENT_EPSILON) and a stable momentKey (quantised time plus sorted Sound ids) live in src/engine and are exported from @/engine.
  - The Events list, the chart and the inspector use it. Moment cost is aggregated once per moment, with a separate notes column.
  - P2 (T23) and P4 (T24) reuse it; neither adds its own grouping.
- FACTOR_META registry (T20 base).
  - Label, short label, colour token (--factor-*), a one-line musician description and polarity for transition, gripNaturalness, alternation, handBalance and constraintPenalty.
  - The new Selected-moment card consumes it. P2 migrates every other consumer and adds the grep test.
  - --status-ok/warn/bad tokens are introduced for the verdict badge.
- [Outsized S] Honest verdict (T07, T15 scope line).
  - The whole-layout verdict stays pinned. FeasibilityBadge falls back to 'Unknown', never 'Feasible'.
  - A separate 'Selected moment' card shows the moment's own Easy/Medium/Hard/Unplayable verdict and all 5 factors from FACTOR_META, including Alternation.
  - An unplayable moment shows an 'Unplayable' badge instead of all-zero bars.
  - Every verdict carries a scope line: 'Analysing 5 of 7 Sounds · 2 muted'.
- [Outsized S] Dialog/Popover primitive (T06).
  - Portals to document.body and sets role, aria-modal and aria-labelledby.
  - Traps focus. On close, focus returns to the trigger, or to the previously focused element if the trigger is gone.
  - Closes on the first Escape (stable onClose, and SELECT_EVENT becomes a no-op when the selection is already null) and on outside click. Clamps inside the viewport.
  - Pads get tabIndex=-1 and an aria-label ('Row 4, column 4, Kick') so focus can return to them.
  - Migrate PadContextMenu (opens at the cursor), the enlarged chart, View all, Compare (every state has Close) and Learn More.
- Compare stop-gap and analysis cache (T08 slice).
  - getAnalysisForLayout(layoutHash, performanceHash, costToggles, evaluatorId) is an in-memory LRU of Execution Plans and diagnostics. It is analysis-only and never persisted.
  - Compare evaluates a missing Active plan through it ('Analysing Active...'). It never renders the zero stub, and a failure reads 'Couldn't analyse'.
  - The compare set is derived from current ids and pruned on SET_CANDIDATES, delete and promote. Compare is disabled below 2 distinct layouts, and a Promote inside it closes it with a toast.
- [Outsized S] Moment-view stop-gaps (T09, T10, T61 slices).
  - Remove the inline opacity and boxShadow that override the onion, ring and previous-event classes. Uninvolved pads dim to about 45% without desaturation, and the ghost renders on occupied previous-event pads.
  - The selection overlay is suspended while playing and restored on Stop.
  - Selecting a moment while stopped moves the playhead there.
  - While playing, ←/→ do nothing. P4 turns them into seek-by-moment.
  - Learn More's onion text matches the shipped behaviour.
- Finger input safety (T19 slice). The field opens empty, with the solver suggestion as a reduced-opacity placeholder (the CLAUDE.md finger display rule). Blur or Escape without typing changes nothing, and invalid input is flagged inline.
- Delete scoping (T28 slice). Delete/Backspace no longer remove the selected event's pad. Removal goes through the pad menu, the ×, or dragging off, each with an Undo toast.
- Preset safety (T65 slice), refuse-first.
  - The preset drag and the grid dragover agree on 'copy'.
  - The drop handler is read through a ref, and collision and mirror state are validated at drop time, with the reason shown on the ghost. MERGE_ASSIGN_PADS refuses occupied pads.
  - Each preset card gets a visible Mirror toggle, set before dragging, because the M key is probably not delivered during a native HTML5 drag.
  - A drop is accepted only when every slot resolves to an existing project Sound id. Otherwise it is refused with 'This preset's Sounds aren't in this project. Mapping them to your Sounds comes in a later release.'
  - Save Preset leaves fingers blank instead of inventing column/index fingering.
- False claim fix. greedyCandidatePipeline.ts:523 labels plan.score < 5 as 'low overall difficulty', which on the higher-is-better scale picks the worst candidates. Remove the claim or re-threshold it on the displayed scale, with a test.
- Learn More sync (invariant 2). A component test renders the Constraints section from the same constraint list passed to the solvers, and the verdict tiers from the same enum FeasibilityBadge uses. The copy explains 'Unknown' and per-moment cost.

**Exit criteria**

- [ ] C1 flipped at 1366x768, 1600x1000 and 1920x1080: for all 64 pads, the menu's top-left is within 4px of the cursor or the menu is clamped fully inside the viewport, and 12/12 items are clickable. The first Escape closes it, and focus returns to the pad.
- [ ] C6 flipped:
  - An Infeasible or Degraded layout with any moment selected never renders 'Feasible', and a layout with no analysis renders 'Unknown'.
  - A 3-note moment and a 1-note moment with the same breakdown report the same cost.
  - groupIntoMoments unit tests cover the epsilon boundary and chords, and momentKey is stable across re-analysis.
- [ ] C7 flipped:
  - With a differing draft, the Active side shows real pads and metrics, or 'Couldn't analyse'.
  - No self-compare exists after delete or promote, and every Compare state closes with Escape and with a Close button.
  - A second request for the same hash is served from the cache without re-solving, and cache use leaves storage unchanged.
- [ ] C5 and C8 flipped:
  - The onion toggle changes grid pixels.
  - With a moment selected, pads struck during Play match the control's luminance and chroma, and Stop restores the selection overlay.
  - ArrowRight during playback neither seeks nor selects the t=0 moment.
- [ ] C9 flipped using a real native drag (Playwright dragTo), not a synthetic keydown:
  - Drops on occupied or mirror-invalid pads are refused with a reason.
  - A Mirror toggle set before dragging is honoured.
  - No drop creates a pad whose voice isn't a project Sound.
  - Saved presets contain no invented fingering.
- [ ] Opening and blurring the finger field without typing leaves voiceConstraints unchanged (T19). Delete with a moment selected and no pad selected removes nothing (T28).
- [ ] The lowest-scoring candidate of a TEST MIDI 1 run never carries 'low overall difficulty'.
- [ ] The Learn More sync test passes, and a scope line appears on every verdict surface.

**Risks**

- Portalling can break outside-click inside nested menus and drag ghosts. Add a spec per migrated overlay.
- Removing the 'feasible' default makes 'Unknown' appear where users used to see green. The copy must say why ('Analysing...' vs 'No analysis yet').
- The analysis cache can grow. Cap the LRU (for example 16 entries) and key it fully.
- Preset placement stays limited to presets whose Sounds already exist in the project until P5's mapping step. The refusal copy says so plainly.

### P2 · Quick-win sprint: see the grid, tell Sounds apart, reach every control, trust the Library (spine steps 1-4)

**Size:** 3-4 weeks for 2 engineers, ~16 PRs. Four M items: T04 (measured grid), the T17 slice (F1-02), the T51 slice (F1-05) and T29 (F10-07).

**Goal.** Make the primary surfaces legible and reachable at 1366x768 and 1600x1000, fix the two CLAUDE.md UI Non-Regression violations, and define one input table for every pointer and key meaning. Most of this is small, local UI work that pays off in every flow.

**Why now.**

Once trust is restored, these are the biggest wins for their size:

- the clipped, CSS-scaled grid, whose transform is also the structural cause of C1;
- seven identical amber 'TEST M...' Sounds;
- an off-screen transport;
- a timeline that doesn't fill its width (T50) and Library cards that misreport projects (T52), both violations of explicit CLAUDE.md UI rules;
- a Library that can't start from a MIDI file or open a demo.

The measured grid also frees the unscaled space the P3 state bar needs. Pad click is about to gain several meanings (click-to-place here, then inspect, show-hits and audition in P4), so the input table must exist first. The canon §10 naming question (Q3) must be settled before the default-names change.

**Deliverables**

- [M] Measured grid (T04).
  - Remove transform: scale and GRID_NATURAL_SIZE. A ResizeObserver sets --pad-size = clamp(32px, fit, 72px) in integer pixels.
  - Label sizes stay fixed, and secondary labels hide below 40px pads.
  - The timeline height fits its content (capped at about 40% of the body), with a remembered, collapsible splitter.
  - Remove the invisible blur and glow layers, and fit the hardware frame to the matrix.
- Transport reach (T05, T56).
  - A fixed-width transport cluster is always visible: Play/Stop, Return, position, Speed, Loop, Metronome, Hits.
  - Sound count, + MIDI, zoom and clear region collapse into a '...' overflow when the measured width is short.
  - CLICK and SOUND become 'Metronome' and 'Hits'.
- [Outsized S] The timeline fills its width (T50): a callback ref or ResizeObserver attached when the scroll container mounts.
- [M] Distinct Sounds (T17 slice).
  - Colour: a 16-hue colour-blind-safe palette defined as --sound-1..16 tokens. It applies to new imports only (colorMode 'custom', continuing from colours already used).
  - Names follow the Q3 decision. The default is the track or file name plus a short sequence letter ('groove A'), with no embedded note name.
  - An opt-in 'Name from GM drum map' action, in the post-import toast and the Sounds overflow menu, renames all Sounds as one undo step.
  - Pads trim the prefix all Sounds share and truncate in the middle over two lines.
  - Rename: a hover pencil and F2/Enter start it, and Enter or Tab moves to the next Sound.
- Readable references and one meaning for 'event' (T20, T23).
  - Every factor label and colour comes from FACTOR_META: CostBreakdownBars, EventCostChart, EventsPanel, CandidatePreviewCard, SettingsGear, Compare, the trace and LearnMoreModal. A grep test enforces it.
  - Every user-visible voiceId or lane_ id resolves to a Sound name with a colour chip.
  - Diffs read '6 Sounds moved (9 pads changed)', counted by unique Sound id and unique pad key.
  - An event is a moment everywhere, and single hits are 'notes'. Counts are normalised to moments for both solvers through the P1b groupIntoMoments helper.
- [M] Variants worth keeping (T29).
  - Save as variant opens an inline name field pre-filled with 'Default – 23 Sep 14:02', with a ' (2)' suffix if the name is taken.
  - RENAME_LAYOUT gains a variant target.
  - Cards show the score plus Hard and Unplayable counts from getAnalysisForLayout, reading 'Scoring...' while pending.
  - A toast confirms the save and scrolls to the new card.
  - Recovered drafts stay in their own group.
- Musical notation (T43 slice).
  - Positions read bar.beat.sixteenth, and the loop reads 'Bars 3-4'. Time never shows below the region start.
  - Speed reads '0.75x · 90 BPM'.
  - Empty pads are blank by default, and positions use one 1-based format, 'Row 4 · Col 4'.
- Guidance and copy (T44, T56).
  - A staged empty state in the grid centre also accepts dropped .mid files. It offers 'Import MIDI' or 'Build a pattern in Composer' (switches the drawer tab), then 'Drag Sounds onto pads, click a Sound then a pad, or Suggest a starting layout'.
  - Import is demoted to '+ MIDI' once Sounds exist.
  - Copy: 'Analysis updates automatically as you place Sounds · Generate proposes alternatives'.
  - 'Project' is the container word everywhere, and buttons use sentence case.
- Gear cleanup (T39 slice).
  - Remove the dead 'Organize by 4x4 Banks' and the hidden 'Duplicate Layout'.
  - View preferences are remembered per viewer (localStorage wrapped in try/catch).
  - 'Show Finger Assignment' keeps showing solver fingering.
- Library honesty and entry (T52, T51 slices, T53).
  - Thumbnails come from working ?? active, with a 'Draft, not promoted' or 'Active layout' badge.
  - Cards show real data only: '8 bars · 32 events · 7 Sounds · 120 BPM · Created Sep 20 · Opened 2h ago'.
  - [M] The primary 'Import MIDI' accepts .mid/.midi (and .pushflow.json, detected by content), creates a project named after the file, and opens it with nothing placed.
  - 'Open demo project' loads the public/demo copy of TEST MIDI 1, unplaced.
  - The hero and the cards share one '...' menu: Rename, Duplicate, Export, and Delete with a ~10 s Undo. Export also appears in the editor's title menu.
  - saveNow is a no-op when nothing changed.
- Shortcut registry and input table (T61 slice).
  - One registry skips SELECT, inputs, contenteditable, menus and open dialogs. It holds one table of every pointer and key meaning by mode:
    - pad click with a Sound armed: place on an empty pad; an occupied pad shows 'Pad taken · drag to swap';
    - pad click with a moment selected: keep the moment and select the pad (P4 adds 'show its hits');
    - pad click when idle: select the pad's Sound; while inspecting (P3): select only;
    - Alt-click on a pad: audition (from P4). A plain click never auditions;
    - Space: play/stop everywhere except text fields (preventDefault);
    - Enter on a focused pad: pick up/drop (from P8);
    - ←/→: step moments when stopped and stop at the ends (while playing, see P1b/P4);
    - Escape: close the top overlay, then clear the armed Sound, then the pad selection, then the moment;
    - Delete: removes the selected pad's Sound only;
    - '?': opens the shortcut sheet, generated from the registry.
  - One registry test per row.
- [Outsized S] Click-to-place (T62 slice). Follows the input table: an armed Sound plus a click on an empty pad places it as one undo step, with an optional 'Next unplaced' auto-advance.
- Readability floor (T64, T38 and T31 slices).
  - --accent-primary-soft for text; #2e5bff for fills only.
  - Grid and pill labels are at least 11px.
  - Fix the Tailwind <alpha-value> token mapping so the Save variant styles render.
  - Disabled buttons keep pointer events and show their reason inline.
- Composer geometry (T69 slice).
  - One cellWidth drives cells, bar lines and the playhead, and cells get flex-shrink-0.
  - Cells are at least 16px, with horizontal scroll and a sticky lane column.
  - Toolbar controls have fixed widths, so enabling Save Preset never reflows the toolbar.

**Exit criteria**

- [ ] At 1366x768 and 1600x1000 with default panels, Playwright bounding boxes put all 64 pads, the hand-zone labels and the state-bar slot inside the viewport. Pads are at least 32px at 1366, and every transport button is clickable.
- [ ] After importing a 4-bar clip at 120 BPM, the ruler width equals the container width (regression spec).
- [ ] A TEST MIDI 1 import gives 7 pairwise-distinct colours (CIEDE2000 > 20) and 7 distinct visible pad labels, and no note names appear unless 'Name from GM drum map' was used. Existing projects' custom colours are unchanged.
- [ ] A DOM audit finds no grid or timeline text node under 11px.
- [ ] Library:
  - Cards show BPM, Sound count, bar length, event count, created date and last-opened date from real data.
  - A draft-only project shows its pads.
  - Importing a .mid from the Library creates 'TEST MIDI 1' with 0 pads placed and bottomLeftNote 36. The demo project opens unplaced.
- [ ] Two variants saved in the same minute get distinct names. A renamed variant keeps its name after a reload. Each variant card shows 'Scoring...' and then a score.
- [ ] Deleting a project and pressing Undo within 10 s restores it with the same id, layouts and variants (T53).
- [ ] Compare diff counts: 'Sounds moved' is at most the Sound count, and pads changed are counted by unique pad key (the C7 case of '11 voices moved' with 7 Sounds).
- [ ] The FACTOR_META grep test passes, and Learn More's factor list renders from FACTOR_META.
- [ ] Every input-table row has a passing registry test. Space toggles playback while a button has focus. ArrowDown on a focused select changes the select, not the moment.
- [ ] All 7 Sounds can be placed with click-to-place alone (Playwright).
- [ ] Compare, Library and verdict text contain no 'lane_' or raw voice ids.
- [ ] The Composer's bar-8 line aligns with its cells within 1px at 1366 and 1600, and enabling Save Preset doesn't move the grid.

**Risks**

- Removing transform: scale changes hit-testing, drag ghosts, transition arcs and the preset ghost. The P1b portals reduce the exposure; add screenshot diffs at both viewports.
- The grid and the timeline splitter can form a ResizeObserver feedback loop. Debounce, and use integer pad sizes.
- The new palette must apply to new imports only and never recolour a user's choices.
- The Library import path must never trigger Suggest or any placement (invariant 7), and must leave bottomLeftNote at 36 (invariant 5).

### P3 · One inspected layout, one yardstick: safe inspection, state bar, honest freshness (spine steps 3-9)

**Size:** 3-4 weeks for 2 engineers, ~13 PRs (M).

**Goal.** Replace 'Preview = overwrite' with a read-only inspected-layout model that scores every layout on one evaluator. Make the screen always say which layout it shows, and make partly placed layouts read as unfinished rather than failed.

**Why now.**

P1a made Generate propose-only, but Preview still writes into the draft and fills Recovered drafts.
The inspected-layout selector plus the P1b cache, extended here with the Q5 evaluator, unblock T03, T13, T26, T30, T37 and the full T08. They also fix the 'two yardsticks' problem (F3-V02, F5-V02) once, instead of P6 rebuilding the cache.
The state bar needs the unscaled grid space P2 freed. C3 measured deep annealing at about 33.5 minutes in the browser, so progress alone isn't enough; it needs a budget.
Q4 ('Place remaining') and Q5 (headline and evaluator) must be settled before this phase.

**Deliverables**

- An accessible primitive kit ships first (T63 part): Tabs, ToggleButton (aria-pressed), Checkbox, IconButton (label required) and Card, joining the P1a Toast and P1b Dialog/Popover. Every new surface from here on must use them.
- One yardstick (T21 slice).
  - getAnalysisForLayout also runs the evaluator chosen in Q5 (default canonicalEvaluator) in a web worker. It does this for every layout shown (Active, draft, candidates, variants), and the working layout goes through the same path.
  - Before/after Generate, Compare and variant cards read the same numbers. P6 changes only how they are presented.
- inspectedLayout selector {kind: active | working | candidate | variant, id}.
  - Non-working layouts render read-only through layoutOverride, with their own plan from the cache.
  - Drag, the context menu, click-to-place and Delete are all blocked while inspecting, with the hint 'Use as my draft to edit'.
  - Preview becomes 'Inspect' and never writes, so the P1a Preview auto-keep is retired.
- After a run, candidate A is auto-inspected read-only (violet bar), and a one-time coach mark explains 'Use as my draft'.
- Explicit role actions.
  - 'Use as my draft': when a differing draft exists, a popover offers 'Save my draft as a variant first' or 'Replace (undoable)'.
  - 'Promote', 'Keep as variant' and 'Back to my draft'.
  - Clicking the Active row shows 'Viewing Active · your draft is kept'.
  - 'Load Draft' becomes 'Edit as draft', with the same guard.
- Layout-state bar (T03), about 40px, fixed and unscaled, above the grid.
  - The --role-active/working/candidate/variant tokens are introduced here. The bar shows a role chip with colour and icon, the base name, and the diff against Active (plus against your draft when relevant).
  - Freshness: 'Up to date', or 'Updating...' after 1.5 s.
  - Only that role's actions. Promote, Save variant and Discard leave the toolbar.
  - One SubjectChip heads Analysis, Events, the inspector, the chart modal, both Compare sides and the timeline header. Timeline pills take their fingering from the inspected layout's plan (canon Surface Features §4).
- Single Promote (T13).
  - One action serves the bar, card, variant row and modal. A pad map that matches a candidate's hash promotes as that candidate: its reviewed plan is rebound and the card is marked Promoted.
  - Promote happens immediately with an Undo toast that summarises the verdict and any unplaced Sounds. The native confirm and the timed 'Confirm?' go.
  - An unrelated draft is auto-kept in Recovered drafts, and the replaced Active is auto-saved as a variant (CLAUDE.md default).
- Freshness rules (T14).
  - Analysis goes stale only when events, scope, tempo, placements, locks or constraints change.
  - Rename, recolour and grouping don't invalidate. Opening the Composer tab changes neither analysisStale nor updatedAt (F9-19).
  - During a re-solve, the previous numbers stay dimmed and the empty state never flashes.
  - Candidates are marked stale when performance inputs change.
  - Empty or identical drafts are dropped.
- Unfinished, not failed (T25).
  - The verdict set is Feasible / Degraded / Infeasible / Unfinished / Unknown.
  - A partly placed layout reads '5 of 7 Sounds placed · scoring covers the 38 notes you can play so far', listing the unplaced Sounds with drag handles.
  - Only placed material is scored, and 'Infeasible' is reserved for placed material.
  - Unplaced notes are drawn outlined in the timeline and stay visible (invariant 4).
- Explicit fill-in (T37).
  - 'Place remaining N Sounds' appears in the summary and next to the 'To place' filter whenever unplaced Sounds exist.
  - Under the Q4 default, it produces one candidate, 'Remaining placed', which is auto-inspected; 'Use as my draft' applies it as one undo step.
  - On an empty grid the Generate button reads 'Generate layouts from scratch' and only proposes.
- Compare on the cache (T08 full). Both sides always use cached or on-demand plans, never a stub. PadGrid draws pads from the layout, then overlays the assignments. Candidate letters stay stable for the session ('Candidate B').
- Keep candidates (T30).
  - 'Keep' on every row and on each Compare side calls SAVE_AS_VARIANT(source: candidate), naming the variant after its strategy.
  - Runs are grouped ('Run 2 · Quick · 1 min ago'). Older runs fold into 'Earlier runs' (capped at 3), with 'Clear older runs'.
  - The caption reads 'Candidates are temporary · Save the ones you like as variants', and leaving warns when unkept candidates exist.
  - Candidates stay unpersisted (canon).
- Clean names (T32).
  - Layouts store a base name plus provenance (manual | suggested | candidate:<strategy> | variant:<id> | recovered). Labels are built from role and base name ('Draft of Default').
  - A migration in the P1a runner moves stored '(draft)' and '(suggested)' suffixes into provenance.
- Generation progress and time budget (T35). Solver Change Checklist applies.
  - Progress reads 'Candidate 2 of 4 · ~8 s left'; for annealing it shows an iteration count. The ETA comes from measured iterations per second.
  - Cancel sets an abort flag checked at the existing yield points. Results are committed atomically, stopReason is 'cancelled' and isProcessing is reset.
  - Annealing gains an iteration budget and a wall-clock budget. Every restart and the temperature schedule are kept, with the per-restart iteration count sized to the budget.
  - A hard wall-clock stop returns the best result so far with stopReason 'time_budget'. The budget and measured runtime go into telemetry.
  - Controls stay in place, disabled, during a run. Start and finish are announced through aria-live.
- Trace follows the candidate (T33 slice).
  - Every candidate stores its trace and stopReason, titled 'How candidate B was found · Stopped: <reason>'. 'time_budget' reads 'Stopped: time limit reached'. Traces survive promotion.
  - Before/After agree with the delta, stated in words, and zero-step phases are hidden.
  - Replay shows 'Replaying step 3/92 · Esc to exit' over the grid.
  - MoveTracePanel stays bound to state.moveHistory.
- Learn More (invariant 2): a Lifecycle section (Active, Working/Test, Candidate, Saved variant, Recovered draft; Promote, Save as variant, Discard, Keep, Use as my draft), the 'Unfinished' verdict, placed-only scoring and the annealing time limit.

**Exit criteria**

- [ ] Inspecting Active, every candidate and every variant 20 times in a row leaves the workingLayout hash unchanged. After Generate, the workingLayout hash is unchanged; the grid shows candidate A read-only under the violet bar, and "Back to my draft" shows the untouched draft. Drag, menu, click-to-place and Delete are each blocked while inspecting (one test per path).
- [ ] The state bar shows the correct role and name for Active, Working/Test, Candidate and Variant at 1366 and 1600. The Analysis, Events and timeline headers name the same subject. While candidate B is inspected, timeline pill fingering equals B's plan (test).
- [ ] Bar, card, variant and modal Promote of the same candidate produce an identical activeLayout and plan hash, as one undo step with one toast.
- [ ] C7 on the cache: with a differing draft, Active's Playability in Compare equals Active's standalone analysis. A greedy candidate shows the same score before and after 'Use as my draft'.
- [ ] A rename leaves analysisStale false. After a lock toggle, the test awaits a plan whose layoutHash matches the current layout with analysisStale false; there is no wall-clock threshold. Opening the Composer tab changes neither analysisStale nor updatedAt.
- [ ] A 3-of-7 layout reads 'Unfinished · 3 of 7 placed', and never 'Infeasible' unless a placed Sound is unplayable. Its unplaced notes stay visible in the timeline.
- [ ] With an injected clock:
  - Cancel during annealing commits no partial candidates or trace, leaves isProcessing false and sets stopReason 'cancelled'.
  - A budget stop returns the best result so far with stopReason 'time_budget', every restart having started, and the trace records it.
  - The iteration budget, not the wall clock, bounds seed-0 test runs, so determinism holds.
- [ ] Nightly: deep annealing on TEST MIDI 1 finishes within its budget with 0 unplayable events.
- [ ] stopReason is visible for greedy, beam and annealing candidates, and MoveTracePanel renders after promotion. testMidi1Integration.test.ts reports 0 unplayable events, and the seed-0 snapshots are unchanged.
- [ ] After migration, no stored layout name contains '(draft)' or '(suggested)'. The Learn More sync test covers the Lifecycle section and the Unfinished tier.

**Risks**

- The per-hash cache plus a worker has memory and latency costs. Cap the LRU, key it by layout hash, performance hash, cost toggles and evaluator id, and show 'Scoring...' per row.
- Users may think Generate did nothing. Auto-inspecting candidate A under the violet bar, plus the coach mark, addresses this.
- Read-only inspection must block every edit path. Add a test per path.
- Rebinding plans on Promote must keep staleness detection correct (a CLAUDE.md test invariant).
- Scoring only placed material shifts numbers for partly placed layouts. The scope line explains it.
- The annealing budget changes results under a deadline. Keep the restart and schedule structure, and record the budget in telemetry so runs stay explainable.

### P4 · The moment loop: find a hard moment, understand it, rehearse it (spine step 10 plus rehearsal)

**Size:** 4-6 weeks, ~15 PRs in two parallel tracks, Moment and Transport (M). Cuttable for a solo cut: the hands filter, the volume popover and audition.

**Goal.** Give every moment one identity across both solvers. Then build the full path from 'which moment is hard' to 'why' to 'loop it at 75% after a count-in', on a DAW-grade, workspace-owned transport. Mute and Solo become audition-only.

**Why now.**

The critical T09 and T10 got only stop-gaps in P1b. T24 blocks their full fixes, and also blocks T27 and T43.
The groupIntoMoments/momentKey helper (P1b) and strict identity (P1a) already exist, so the only analysis-shifting engine change left is the solver eventIndex semantics, which goes through one Solver Change Checklist run.
The scheduler rewrite (T58) is also the right moment to lift the transport into a workspace service (T60), so it isn't rewritten twice. The P2 input table defines what the new pad-click and audition behaviours mean.
The work runs in two parallel tracks:

- Moment: T24, T09, T27, T28, T42.
- Transport: T10, T58, T60, T15, T16, T59, T61, T43.

**Deliverables**

- Single moment identity (T24). Solver Change Checklist applies.
  - Both solvers give eventIndex the same meaning (beamSolver numbers notes and greedyOptimizer numbers moments today), and both add an explicit momentIndex derived from the P1b groupIntoMoments.
  - The selection is stored as the P1b momentKey and re-resolved when the plan changes.
  - Placeholder pills for excluded (not muted) streams read 'Not analysed' and select by momentKey/time, so a click still highlights every note at that moment; muted streams keep normal analysed pills.
  - 'Event 12 · 3.2.3' is the label everywhere (canon term Performance Event; see Q7).
- Rebuilt moment view (T09).
  - Current strikes keep the Sound's colour and short name, and add a hand ring and an 'L2' badge.
  - Next strikes get a dashed hand-coloured outline and '+1'; previous strikes a faint outline and '-1'. Other pads sit at about 45%.
  - Next-move arrows start from each finger's last known pad.
  - One segmented control in the grid header, 'Now | Now + Next | Prev · Now · Next' (key O, aria-pressed), replaces the onion and Arrows toggles.
  - During playback the playhead drives the same overlay, with current and next finger labels at 16-20px.
  - Learn More's onion and transition text is updated.
- Hand tokens and finger notation (T42 part).
  - --hand-left and --hand-right are introduced and used by the grid, pills, Compare, chips and inspector.
  - One finger-notation module (L1-R5, with the finger name in a tooltip).
  - Sound selection gets a neutral outline, cleared with Escape or a click on empty space.
- Pad vs moment selection (T28), per the P2 input table.
  - A pad click outlines the pad and opens a pad inspector: Sound, hits, soft preference, lock, remove, 'Show its hits' and an audition button.
  - While a moment is selected, a pad click highlights that Sound's hits in the timeline without moving the moment, with Prev/Next hit of this Sound.
  - Alt-click auditions. Delete is bound to pad selection, with the toast 'Removed Snare from Row 4 · Col 4 · Undo'.
  - The input table's rows and tests are updated.
- Events list for finding problems (T27).
  - Rows read bar.beat.sub · Sound chips · finger chips · difficulty badge, in the timeline's colours. The raw number moves to a tooltip, and an 'Unplayable' badge replaces 'Infinity'.
  - Rows are grouped under bar headers.
  - Filter chips All / Medium+ / Hard / Unplayable, plus Prev/Next hard (Shift+←/→). 'N need attention' is a button that applies the filter.
  - A click anywhere on a row selects it. One row expands at a time, with aria-expanded.
- Docked moment inspector under the grid (T27).
  - It lists every strike in the moment, resolved by Sound id, with one explainEvent line and an explainTransition sentence to the next moment.
  - It shows the 5 factors from FACTOR_META, plus 'Play from here' and 'Rehearse bars n to n+1'.
  - It replaces the Selected Event card that today exists only on the Layouts tab.
- Current moment and Rehearse (T10).
  - When stopped, the current moment is the selected one, a ruler click snaps to the nearest moment, and a paused grid shows the moment at the playhead (F7-V02).
  - When playing, the current moment follows the playhead. The selection overlay is suspended and returns on Stop.
  - ←/→ while playing seek to the previous/next moment relative to the playhead.
  - 'Rehearse' on Events rows, the inspector and chart bars sets a bar-snapped loop (the moment's bar plus one), optionally drops the speed to 75% or 50%, runs the count-in and plays.
- DAW-grade transport (T58), lifted into a workspace-level service (T60 part).
  - A persistent transport bar sits above the drawer tabs, and the Timeline consumes it.
  - Loop off plays once and stops. Loop on with no region loops the whole song.
  - A look-ahead Web Audio scheduler (25 ms tick, 100 ms horizon) derives the playhead from ctx.currentTime. The first window after play, seek or wrap includes its start, so downbeat chords always sound.
  - Region edges snap to bars (beats with Shift, free with Alt), with pointer capture. The loop bar is draggable, with bar.beat labels and the presets 'This bar' and 'Bars 2-3'. The playhead handle is separate.
  - Return goes to the loop start.
  - Loop and speed are remembered per project as rehearsal preferences, never as analysis inputs.
- Audition vs analysis (T15, T16).
  - Mute and Solo become session-only, audio-only controls. They stay out of undo and never change analysis, layout or updatedAt.
  - They are independent flags, with audible = anySolo ? soloed : !muted. Solo lights yellow and Mute red, both with aria-pressed, and Alt-click on S is exclusive solo.
  - Muted pads stay fully editable, with a speaker-off glyph.
  - 'Exclude from analysis' is an explicit row action with a persistent badge and the scope line, and generation keeps excluded Sounds pinned.
  - A migration in the P1a runner converts mute-used-as-exclusion once, with a notice.
- Practice aids (T59 part).
  - Count-in Off / 1 / 2 bars, with 1-2-3-4 shown over the grid.
  - A volume popover with separate click and hits levels (cuttable).
  - Audition from the pad inspector or by Alt-click while stopped (cuttable).
  - A rehearsal-only 'Hands: Both / L / R' filter that silences and dims the other hand and never touches analysis (cuttable).
- Rehearse view (F7-03): a transport toggle that collapses both side panels and gives the grid and inspector the space. It is view state only, remembered per viewer, and changes no analysis.
- Keyboard completion (T61, T43).
  - ↑/↓ are scoped to the focused Events listbox.
  - L toggles the loop, [ and ] change speed, and Home goes to the start or the loop start.
  - Moment and pad labels are 1-based everywhere.
- Learn More (invariant 2): 'Exclude from analysis' vs Mute/Solo, the view modes, and a Keyboard section generated from the registry.

**Exit criteria**

- [ ] For all 32 moments of TEST MIDI 1, under both a beam plan and a greedy plan, selecting on any surface highlights the same pads and notes on the grid, list, timeline and chart. The selection survives re-analysis, and clicking any timeline note highlights its whole moment.
- [ ] The three view modes produce distinct pixel output, and next and previous strikes keep their Sound's colour and name.
- [ ] With a moment selected, Play shows full-intensity pad flashes and the next-finger preview. Stop restores the selected moment. After pausing mid-song, the grid shows the playhead's moment, not a blank grid.
- [ ] 'Rehearse' on a Hard row starts, after a 1-bar count-in, a loop whose bounds sit on bar lines and contain the moment.
- [ ] Loop and scheduler:
  - Loop off stops at the end.
  - The opening chord sounds on every loop repeat (OfflineAudioContext test).
  - Scheduler timing error is under 2 ms against a fake clock.
  - Dragging the loop from the bar-2 line to the bar-4 line gives exactly 2.1.1-4.1.1.
- [ ] Switching to the Composer tab mid-playback leaves time advancing and pads flashing.
- [ ] Mute, Solo, Exclude and Hands:
  - A muted pad can be dragged and dropped.
  - Soloing lights Solo, and Unmute works while another Sound is soloed. A unit table covers audible = anySolo ? soloed : !muted.
  - Muting changes no verdict, score or fingering. Excluding does, and the scope line says so.
  - Muted and excluded streams stay in the timeline (invariant 4).
  - 'Hands: L' leaves Playability unchanged.
- [ ] Each Events filter chip shows exactly the matching moments. Prev/Next hard visits every Hard moment in time order and stops at the ends.
- [ ] The P2 timeline-width spec still passes after the transport lift. At 1366x768, with the inspector and transport bars shown, all 64 pads are at least 32px and inside the viewport.
- [ ] The Rehearse view hides and restores both side panels without changing any analysis value.
- [ ] The updated input-table rows (pad click with a moment selected, Alt-click audition, ←/→ while playing) pass their registry tests.
- [ ] The mute-as-exclusion migration runs once after its backup, and re-running it changes nothing.
- [ ] testMidi1Integration.test.ts reports 0 unplayable events after the eventIndex change, with seed-0 snapshots updated only for the index field. MoveTracePanel, CandidatePreviewCard and PerformanceAnalysisPanel are updated and render.

**Risks**

- The eventIndex semantics change touches solver output and every consumer, so Solver Change Checklist items 1-7 apply.
- The scheduler rewrite interacts with the autoplay policy and slow machines. Resume the AudioContext on the first gesture and test in Chromium and the nightly Firefox project. Keep the old path behind a P0 flag for one release (team), or on a short-lived branch (solo).
- Lifting the transport touches UnifiedTimeline heavily. Land it behind the existing props API first.
- Changing what a pad click does retrains users. The input table, the '?' sheet and a one-time hint cover it.
- The hands filter depends on the plan's hand per strike. Treat unassigned strikes as audible in both filters.

### P5 · Sounds, import and projects you can trust (spine steps 1-2, plus coming back tomorrow)

**Size:** 4-5 weeks, ~14 PRs in two tracks: Identity & Sounds (including Place preset), and Import/Library/Persistence (M). Cuttable for a solo cut: cross-tab compare-and-swap and the BroadcastChannel banner.

**Goal.** Give the Sounds panel real placement status, filters and actions, and give finger preferences one soft control. Let presets be placed by mapping them to project Sounds. Make import reviewable and replaceable, store notes in musical time, and make the Library and persistence honest end to end.

**Why now.**

P2 fixed the most visible identity symptoms. What remains are correctness and data issues:

- re-importing duplicates every Sound;
- a tempo change or multi-file import shifts notes off the bar grid;
- saves can overwrite each other across tabs;
- cross-project presets can't be placed at all.

These must land before the P6 cost story, because scores only mean something on correct identity and timing. The preset mapping step needs only strict ids (P1a) and working undo (P1a), not the Composer-model decision.
Q6 (Composer model) must be settled before this phase, because the musical-time schema reserves a pattern slot only under model (b).

**Deliverables**

- Unified soft preference control (T19 full): 'Hand & finger preference (soft)'.
  - Options: Left / Any / Right, Thumb...Pinky / Any, 'Auto (solver)' and 'Accept suggestion'.
  - Shows 'L2/L3 mixed' when the plan uses more than one finger, and the solver suggestion at reduced opacity when no preference is set.
  - Used in the Sounds row popover, the pad inspector, the Selected moment card and the Composer.
  - Everything goes through voiceConstraints and syncs to pad fingerConstraints (invariant 6).
- Sounds panel (T45, T17 rest).
  - Header: search, filter chips with counts (All 7 / To place 2 / On grid 5 / Locked 1), a progress bar and 'Place remaining N'.
  - Placement status is a filter chip plus a row pill ('To place') or a locator (R5C3), never a section label.
  - Rows sit in group sections, with 'Ungrouped' for the rest and the Cmd/Ctrl+G toggle kept. Without groups, the list is flat.
  - Each row has a hit count, a lock toggle and an overflow menu: Rename, Colour, Group, Short label, Name from GM drum map, Exclude from analysis, Unplace, and Delete with Undo.
  - Salvage the search, filter and drag-to-group logic from src/ui/components/lanes/, then delete that folder after grepping for imports.
  - SET_SOUND_COLOR sets colorMode 'custom', and group colours apply only to members without a custom colour.
  - A selection action bar (Group · Colour · Unplace), one ordering shared with the timeline, and lane headers that select their Sound.
- Drag feedback (T46 core).
  - While dragging, a ghost of the incoming Sound and a one-line hint: 'Swap with Snare' / 'Replace: Snare goes back to To place' / 'Move from Row 4 · Col 4'.
  - Evictions show a toast with Undo.
  - A pad dropped on the Sounds panel is unplaced, over a highlighted drop zone.
  - Reordering works only through a handle with its own dataTransfer type, and reorderTarget is cleared on dragend.
- Place preset (T65 mapping slice).
  - Dropping a preset whose slots aren't project Sounds opens a short mapping dialog. Each slot maps to an existing Sound, suggested by name, never by pitch.
  - Confirming places it on the grid only, as one undo step. Occupied-pad and mirror refusals from P1b still apply.
  - Preset fingering stays unverified and is never applied. P8 adds timeline insertion and 'Apply fingering'.
- Import review sheet (T48).
  - Header: 'TEST MIDI 1.mid · 1 track · 7 Sounds · 48 notes · 32 events · 8 bars · 120 BPM 4/4'.
  - One editable row per Sound: name (defaulting per the Q3 decision), colour, short label, notes and include. Pitch appears only as provenance text, per Q3. A warning appears above 64 Sounds.
  - 'Skip review' is one click. Files with no notes are refused and not recorded.
  - Errors are tagged by source, and 'Generation failed · Retry' appears only for generation errors.
  - The review never places Sounds.
- Source files and Replace (T47).
  - A 'Source files' section with Replace and Remove.
  - A matching re-import asks 'Replace (keeps placements for matching Sounds) / Add as new / Cancel'. It goes through UPSERT_LANE_SOURCE, with a mapping preview matched by track and name so voice ids survive.
  - 'Delete Sound' comes with an Undo toast.
- Musical time (T49).
  - Events are stored in beats or ticks, with seconds derived from projectState.tempo, through a migration in the P1a runner (backup first, idempotent). Under Q6 model (b), the schema reserves a Composer pattern slot in beats.
  - BPM is a labelled number field that shows its range and 'Tempo affects difficulty'.
  - A tempo change toasts 'Tempo set to 90 BPM · notes follow the bar grid' and marks the analysis stale.
  - A batch import is computed once, adopts the first file's tempo, and flags files whose tempo differs.
- Library complete (T51 rest, T52 rest, T54, T55).
  - Entry and continuity:
    - a window-level 'Drop MIDI to import' overlay in the Library and the workspace;
    - a status row shows the Active name, a draft pill and 'n variants';
    - a reopened draft shows 'Draft from 23 Sep restored · 3 pads differ · Keep editing / Discard', per the Q1 decision;
    - a new project is saved only after its first meaningful action, and lastOpenedAt drives 'Continue'.
  - Sidebar:
    - quick actions become Import MIDI as new project, Open demo, Import project file and Export all;
    - the Validator, Temporal Evaluator and Optimizer debug move behind a 'Developer tools' footer link, with their routes kept;
    - hero copy describes only real features.
  - Visuals and browsing:
    - MiniGridPreview is sized to its container, and the hero compacts to a Continue strip on short viewports;
    - sorting and a list view are added, and the hero hides during search;
    - bundled lucide-react icons with aria-labels replace the remote Material Symbols, so the P0 e2e font block can be lifted.
- Save robustness (T57 rest).
  - Promote, Save variant, Discard and import save immediately.
  - Each record gets a revision counter, and saves compare-and-swap on it (cuttable for a solo cut).
  - A BroadcastChannel banner reads 'Changed in another tab · Reload / Keep mine' (cuttable for a solo cut).
  - 'Can't access storage' is its own error state, distinct from 'No projects'.
- Learn More (invariant 2): 'Tempo affects difficulty', and how imports, Replace and excluded Sounds change the analysis scope.

**Exit criteria**

- [ ] Voice-ID round-trip tests pass for clone, promote, variant save, discard and export/import. A finger preference set in any panel appears in the others within one render.
- [ ] With no user preference set, FingerAssignmentInput shows the solver suggestion at reduced opacity and never uses the '(XX)' format.
- [ ] While groups exist, ungrouped Sounds sit under 'Ungrouped', and a test asserts 'On grid' never appears as a section label. The 'To place' and 'On grid' filter counts match the grid.
- [ ] A preset from another project, dropped and mapped to 3 existing Sounds, places exactly those Sounds on the grid as one undo step, and creates no new voice.
- [ ] Re-importing the same file offers Replace. Replace keeps pad placements and voice ids for matching Sounds and creates no duplicates, and the timeline still shows every stream.
- [ ] After a BPM change from 120 to 90, every note keeps its bar.beat label and the analysis re-runs. A migration test converts a pre-P5 project with no change in note positions, and running it again changes nothing.
- [ ] Dropping a .mid on the Library opens the review. After confirming, 0 pads are placed and bottomLeftNote = 36.
- [ ] A kill 200 ms after Promote still persists the Promote. If compare-and-swap ships, an edit in a second tab raises the banner in the first, and neither tab silently overwrites the other.
- [ ] Opening and leaving an unchanged project doesn't move it in 'Continue'.
- [ ] With the network blocked, no icon ligature text appears in the Library. The hero fits the first screen at 1366x768, and the /validator, /temporal-evaluator and /optimizer-debug routes still load.

**Risks**

- The seconds-to-beats migration can corrupt data. Run it through the P1a runner with its backup, make it idempotent, and keep the seconds field for one release.
- Replace, matching by track and name, can bind the wrong Sounds. Always show the mapping preview.
- Moving S/M out of the timeline lanes breaks a DAW habit. Lane headers select their Sound, and the Sounds row sits one glance away.
- Revision counters need stored-record migrations that must not break the existing 'never silently overwrite on import' safeguard.

### P6 · One cost story and baseline-aware compare (spine steps 5-9)

**Size:** 4-5 weeks, ~10 PRs (L).

**Goal.** Present the P3 yardstick as one headline everywhere. Measure and explain candidates against the Active Layout. Make Compare answer 'what changed, is it worth keeping' in words. Keep Analyze and Generate visibly distinct: weighting lives with analysis, method options with Generate, and every optimizer method and all trace data stay available.

**Why now.**

The prerequisites are now in place: FACTOR_META (P1b), one evaluator behind the per-hash cache (P3), the inspected-layout model (P3), and correct identity and timing (P1a, P5). The canon's 'one coherent cost story' and 'diff versus Active Layout' can't be delivered without T21 presentation and T26. This is CLAUDE.md priorities 3-5 (unify scoring, baseline-aware generation, tighter Compare).

**Deliverables**

- Canonical headline (T21).
  - Every layout shows one integer from the P3 cache: 'Playability 0-100 · higher = easier', plus Hard and Unplayable moment counts. There is no second scoring path.
  - Factors are shown as each one's share of the burden.
  - Optimizer cost, seed and move count move to an (i) tooltip and the trace.
  - Candidate rows are ordered by the displayed headline, with the solver rank in a tooltip.
  - PerformabilityObjective remains the beam ranking model.
- Baseline-aware Layouts list (T26).
  - Generation passes state.activeLayout as activeLayout and the draft as baseLayout, so diversity is measured from Active.
  - Every row (Active pinned, Draft, Candidates, Variants, Recovered drafts) shows the score, delta chips against Active (Playability, Hard/Unplayable, biggest factor change, Sounds moved), a compare checkbox and a mini-grid diff (moved pads outlined, lock glyph, Sound initials).
- Compare 'What changed' (T26).
  - Rows in A | B | Change columns: Playability, Hard, Unplayable, the 5 factors from FACTOR_META, per-Sound moves ('Kick Row 4 · Col 4 -> Row 5 · Col 3'), re-fingerings and per-passage deltas. Each change is stated in words.
  - Grids are larger and centred, and 'moved' and 're-fingered' are styled differently. A and B use neutral letter chips.
  - A sticky footer holds Keep A/B, a secondary Promote A/B (through the single P3 action) and Close. After a Promote inside the dialog, it re-points to 'New Active vs B'.
  - The draft and variants can be compared. Compare stays read-only (canon section 7).
- Generate options (T34).
  - A 'Generate v' popover offers musician-facing options and a focus choice (Comfort / Fast alternation / Memorable shapes / Surprise me).
  - Time estimates come from measured telemetry (P3), for example 'Quick alternatives ~20 s' or 'Deep search ~4 min on this project', never from hard-coded strings.
  - An Advanced section keeps only Greedy, Beam and Annealing, the restart count, strategy, intensity (only where it applies) and a 'Reproducible run (seed 0)' switch.
  - Labels report what actually ran. Card copy ranks each candidate against the set and against Active. Learn More uses the same names.
- Custom weighting on the Analyze side (T39 rest).
  - The cost-family toggles and a Re-analyse button (replacing 'Calculate Cost') move into the Analysis panel header, next to the SubjectChip, and never into Generate.
  - A toggle marks the analysis stale and re-runs it, and the SubjectChip reads 'Custom weighting: Movement off'. Results use the same scale and labels as everything else.
  - costToggles are passed to Greedy, Beam and Annealing. A method that can't honour a toggle is labelled 'ignores custom weighting' in Advanced, and costTogglesUsed echoes what actually ran.
- Diversity honesty (T36). Pure translations count as duplicates. When fewer distinct alternatives exist, fewer rows appear, with a note such as 'Only 1 distinct alternative · your 2 locks leave little room' (canon). The generation summary sits in the run header.
- Complete trace (T33 full).
  - The greedy move list, an annealing cost/temperature sparkline with accepted moves (downsampled for display, full data kept for replay), and a beam summary, all using one worded cost convention.
  - The OptimizerMove and AnnealingIterationSnapshot shapes and stopReason are unchanged; 'time_budget' was added in P3.
- Honest charts (T40).
  - Bars use a fixed scale: share of burden, with the absolute value secondary, and easy/ok/hard bands. The header reads 'lower = easier'.
  - Once analysis exists, the chart opens by default, titled 'Difficulty over time', with a labelled y-axis, Medium/Hard bands and bar.beat ticks aligned with the timeline.
- Learn More 'Reading your results' (T41).
  - Generated from FACTOR_META and the headline definition, with musician-first text and the maths as secondary detail.
  - (i) popovers on every tile, factor and Compare row deep-link to the matching section. The popovers are reachable from the Analysis panel, including the Costs view.
  - The Overview uses the project's own numbers, and the Constraints tab lists the currently active constraints and weighting (invariant 2).

**Exit criteria**

- [ ] One layout shows the same Playability integer in the state bar, Analysis, its Layouts row and Compare. Greedy and beam plans of the same layout show the same number.
- [ ] Unit tests:
  - candidate diversity is computed against state.activeLayout;
  - a pure-translation candidate is filtered out;
  - a short set shows the 'little room' note.
- [ ] Draft vs Active and Variant vs Candidate can be compared, and every displayed change equals B - A of the displayed numbers.
- [ ] All three methods can be picked from Advanced (registry test). Two seed-0 runs give identical candidates, and testMidi1Integration reports 0 unplayable events for every method.
- [ ] For Greedy, Beam and Annealing, costTogglesUsed equals the toggles passed (test). Any method that ignores a toggle is labelled so in Advanced.
- [ ] A DOM test finds the weighting toggles and Re-analyse in the Analysis header and none of them in the Generate popover. A toggle change marks the analysis stale, re-runs it and shows 'Custom weighting'.
- [ ] Generate's time estimates come from recorded telemetry (a test fails on a hard-coded duration string).
- [ ] MoveTracePanel renders the greedy trace, the annealing sparkline renders for annealing runs, and stopReason shows for all methods.
- [ ] A test checks that Learn More's 'Reading your results' lists exactly the FACTOR_META entries and the headline definition.

**Risks**

- Scoring many layouts in the worker can lag. Rely on the P3 cache and show 'Scoring...' per row.
- The new headline resets users' reference points. Ship it with a one-time 'Scores now use one scale' notice and Learn More copy.
- Band thresholds need calibration. Start from TEST MIDI 1 plus 3 golden scenarios.
- Moving the method selects out of the toolbar must not remove a method or the restart/seed controls (Core Functionality contract).
- Wiring costToggles into Beam and Annealing is an optimizer change, so the full Solver Change Checklist applies.

### P7 · Workspace by job and the accessibility sweep (all spine steps)

**Size:** 3-4 weeks, ~8 PRs (M). Cuttable for a solo cut: the flag rollout (use a branch instead).

**Goal.** Give each region one job and one primary action, remove the duplicated analysis panels, finish the colour-token migration, and bring every surface up to the keyboard, role and readability floor.

**Why now.**

Duplicated panels can only be removed once their content is trustworthy (P6). The primitives exist since P3, and the semantic tokens were introduced with their surfaces (--status P1b, --factor P1b, --sound P2, --role P3, --hand P4). So this sweep only migrates older surfaces and stays bounded. Consolidating earlier would have meant redesigning around wrong numbers.

**Deliverables**

- Workspace consolidation (T38).
  - Left: Sounds | Events.
  - Centre: state bar, grid, moment inspector, transport, and the drawer with the Composer tab unchanged (invariant 3).
  - Right: Analysis | Trace above a pinned, resizable Layouts list. Trace is bound to MoveTracePanel.
  - PerformanceCostsPanel and the duplicated ActiveLayoutSummary blocks are deleted.
  - One primary action per region. Generate is primary while no candidates exist. The only primary-styled Promote is in the state bar; candidate rows and Compare keep a secondary Promote through the single P3 action (canon Surface Features §6).
  - Side-panel default widths come from the measured centre width, with visible resize grips.
  - Team mode: behind a P0 flag for one release, with a one-time 'What moved' popover. Solo: a short-lived branch plus the popover.
- Raw-hex sweep (T42 rest). Migrate every remaining raw colour to the existing --sound-*, --status-*, --factor-*, --role-* and --hand-* tokens. A test bans raw hex in src/ui/components outside the token file.
- Primitive sweep (T63).
  - Migrate Tabs, ToggleButton, Checkbox, IconButton, Card and GridCell into every remaining panel, including step-grid cells and PresetCard.
  - Hover-only actions appear on :focus-within or leave the tab order.
  - Apply .focus-ring everywhere.
  - The project name and BPM are real inputs.
- Readability sweep (T64 rest).
  - No UI text under 11px; data text at 12-13px.
  - Every target is at least 24x24 (S/M, swatches, compare boxes, remove controls).
  - Text contrast is at least 4.5:1.
  - Every colour cue gets a second cue: an icon, filled vs outlined with aria-pressed, a text difficulty badge, a hatch for unplayable, and shape cues for current and next.

**Exit criteria**

- [ ] At 1440x900, pads are at least 56px, each side panel defaults to at most 320px, and the first candidate row is visible without scrolling. At 1366x768 the first candidate row is still visible.
- [ ] axe-core finds 0 critical or serious violations in the Library, each workspace tab, Compare, Learn More and the import review. Tabs have role=tab and aria-selected, and Tab never lands on an invisible control.
- [ ] An automated scan at 1366x768 finds 0 visible text nodes under 11px and 0 interactive targets under 24px (documented exceptions only). The raw-hex ban test passes.
- [ ] Exactly one primary-styled Promote exists in the DOM (in the state bar), and candidate rows and Compare still offer a secondary Promote.
- [ ] The CLAUDE.md rules still hold:
  - the timeline fills its width, shows all streams, uses 'L2' pills and selects the whole moment on click;
  - MoveTracePanel is reachable;
  - the Pattern Composer tab is in the bottom drawer of PerformanceWorkspace.

**Risks**

- This is the largest UI churn. Keep the whole Playwright suite green on every PR.
- Returning users will find actions in new places. Mitigate with the 'What moved' popover and the '?' sheet (plus the flag in team mode).
- Shortcut scoping could collide with Composer keys such as M (mirror). The P2 registry scopes shortcuts by focused region.

### P8 · The Composer joins the project, plus full keyboard placement (spine step 2 side entrance)

**Size:** 5-7 weeks, ~12 PRs (L). Can overlap with P7. Cuttable for a solo cut: T70 sequencer basics and the full T62 keyboard grid.

**Goal.** Make Composer patterns ordinary project material: stored in the project, saved, exported and undoable, bound to real Sound ids and played through the shared transport. Extend the P5 'Place preset' step with timeline insertion. Give the sequencer the basics finger drummers need, and make the grid operable by keyboard alone.

**Why now.**

The P1a Composer slice already removed the live invariant-6 break, the rename reverts, and the unrecoverable Clear. P1b and P5 made presets safe and placeable. What remains needs strict identity (P1a), undo on the document (P1a), musical time (P5) and the workspace transport (P4), plus the owner's Q6 decision (settled before P5). It can run in parallel with P7.

**Deliverables**

- Composer state in the project (T67).
  - The pattern (in beats, in the schema slot P5 reserved) and the preset placement records live in the IndexedDB project, so they are autosaved, exported, imported and undoable through the document slice.
  - One note toggle is one undo step, and the Composer and timeline revert together. Rapid toggles coalesce, so they don't push layout edits out of history.
  - The playhead lives in the session slice.
  - Clear becomes a document action with an Undo toast that lists what was removed, replacing P1a's in-memory restore.
  - A migration in the P1a runner moves existing localStorage patterns once, with a backup export.
- Sound-bound lanes (T66 full).
  - Lanes structurally reference project Sound ids and read name, colour and mute/solo from the project; the P1a notes-only sync becomes structural.
  - Composer finger edits use the shared soft preference control over voiceConstraints (from P1a), show dimmed solver suggestions and can be cleared (invariant 6).
- Composer model per Q6 (T68).
  - The drawer header states the model (default (b): 'Editing pattern Groove A · inserts at bar 9').
  - A Presets shelf lives inside the drawer, with details shown in place; it never takes over the right panel.
  - Each preset offers 'Open in Composer', 'Add to timeline at bar...' and 'Place on grid' (the P5 mapping step). The Library's 'View presets' becomes read-only.
  - 'Sounds' wording and S/M order throughout. The P1b Mirror toggle stays, with an on-screen hint.
- Insert pattern (T65 full).
  - 'Add to timeline at bar...' reuses the P5 slot-to-Sound mapping (with a 'New Sound' option) and inserts the notes into the one timeline at the chosen bar, as one undoable step together with any grid placement.
  - Preset fingering is captured from the current plan as suggestions, and applied as soft preferences only on 'Apply fingering'.
  - An inline save popover shows what will be captured and warns when no pads are placed.
  - The preset list refreshes through a change event, and TagEditor is keyed by preset id.
  - pf tokens and full-word actions; handedness is hidden when there are no pads.
  - The preset metric breakdown is replaced by canonical evaluation of the preset's notes.
- Composer on the shared transport (T60 full). Composer Play drives the P4 workspace transport, looping the pattern region with Metronome and Hits and lighting pads and fingers the way the timeline does. There is no Composer BPM control (invariant 8).
- Sequencer basics (T70, T69 rest; cuttable for a solo cut).
  - 1/16 is the default grid, and 1/32 is added.
  - Velocity editing by vertical drag or Alt-click.
  - Duplicate bar, copy/paste of a selection, lane reorder and lane colour.
  - The drawer can be resized, collapsed and maximised, and the toolbar is one row with an overflow menu.
- Full keyboard grid (T62 full; cuttable for a solo cut).
  - role=grid with a roving tabindex: arrows move focus, Enter places the armed Sound or picks up/drops a pad to swap, and Delete clears. Space stays play/stop, per the P2 input table.
  - Pads, which already have aria-labels from P1b, gain state ('Row 4, column 4, Kick, locked, left index').
  - Sound rows are focusable options.
- Learn More (invariant 2): how presets and Composer patterns are scored with the canonical evaluator.

**Exit criteria**

- [ ] Composer edits survive a tab switch, a reload and an export/import round trip. One Ctrl+Z reverts one note toggle, together with the timeline. Undo after Clear restores the notes, Sounds and pads, including after a reload.
- [ ] A Composer-backed Sound renamed in the Sounds panel keeps its name through later Composer edits. A Composer finger edit is cleared from the Sounds panel and stays cleared.
- [ ] The C9 scenarios pass end to end:
  - a preset inserted into another project through the mapping step binds to project Sound ids;
  - a drop on occupied pads is refused with a reason;
  - a mirrored drop respects the mirror;
  - the placed pads survive later Composer edits;
  - the notes appear on the timeline at the chosen bar.
- [ ] Composer Play produces audio and pad flashes at the project tempo, and a drawer-tab switch doesn't interrupt it.
- [ ] If the sequencer basics ship: 1/16 is the default, a velocity edit persists and undoes in one step, and at bar 16 the bar lines align with cells within 1px at 1366 and 1600.
- [ ] If the keyboard grid ships: all 7 TEST MIDI 1 Sounds can be placed, moved and swapped by keyboard alone, Space still toggles playback with a pad focused, and axe finds 0 critical violations on the grid. Every updated input-table row passes its registry test.
- [ ] The Pattern Composer tab is still in the bottom drawer of PerformanceWorkspace (invariant 3 test), no BPM control exists in the Composer (invariant 8), and the voice-ID round-trip tests pass.
- [ ] The localStorage-pattern migration runs once after its backup, and re-running it changes nothing.

**Risks**

- If Q6 slips, start with persistence and identity, which both models share.
- The data migration from localStorage patterns needs idempotency tests and a backup.
- Roving-tabindex focus handling may fight the drag-and-drop handlers.
- This phase has the most L items. Ship each sub-flow (persistence, identity, insert pattern, sequencer, keyboard grid) separately, behind its own flag (team) or on a short-lived branch (solo).

## Sequencing rationale

The base is impact per effort, reordered where dependencies demand it.

P0 comes first. Every exit criterion in this plan was a promise until CI can run it: deploy.yml only builds, vitest has no DOM, Playwright has no runner, the C1-C9 repros are only exploratory scripts, remote fonts make screenshots flake, and the TEST MIDI 1 test has no annealing case, no lock case and a >50% threshold instead of 0 unplayable. One week of infrastructure turns each later fix into a regression test that runs on every PR. Each C# spec lands as expected-fail and is flipped by the PR that fixes it.

P1 is split by harm:

- P1a stops data loss, since it is the recovery path for everything else:
  - undo on the document slice only, so candidates, trace and playback survive an Undo;
  - Generate only proposes (deleting two dispatches), which removes today's invariant-7 exposure and the mid-run overwrite;
  - Recovered drafts in their own capped group, so auto-keeps never hide the user's variants;
  - locks honoured by every method;
  - strict Sound-id resolution, moved here so every later 'placed' count is correct and one Solver Change Checklist covers both engine changes;
  - truthful saving;
  - the Composer notes-only sync, finger routing and undoable Clear;
  - the migration runner, which cleans ghost locks and invented preset fingerings already stored.
- P1b stops false verdicts and broken overlays: the portal, the honest verdict, the moment stop-gaps and the refuse-first presets with a Mirror toggle. It also introduces, once, the shared pieces later phases reuse: groupIntoMoments/momentKey, FACTOR_META, the getAnalysisForLayout cache and the --status tokens.
- Every critical harm is neutralised by the end of P1b, about 7-8 weeks in with 2 engineers.


P2 is quick wins that pay off in every flow: the measured grid, distinct Sounds (--sound tokens, names per the §10 decision), transport reach, click-to-place, the Library MIDI entry, and the two CLAUDE.md UI Non-Regression violations (T50, T52). It also defines the one input table that later pad-click, audition and keyboard work must follow. Variant scores use the P1b cache.

The medium redesigns follow in dependency order:

- P3 builds the inspected-layout selector on the P1b cache, now scored by the Q5 evaluator, so the 'two yardsticks' problem is fixed once. It adds the state bar (--role tokens), one Promote, Keep, proposal-only fill-in, the full Compare and an annealing time budget.
- P4 changes only the solver eventIndex semantics on top of the shared moment key, then builds the moment loop and a DAW-grade transport lifted into a workspace service, so the Composer never needs a second transport rewrite.
- P5 fixes import, the Sounds panel (filter chips plus group sections, never an 'On grid' section), musical time and persistence, and makes presets placeable by mapping them to project Sounds.


The large items come last:

- P6 presents the one headline and adds baseline-aware Compare. It keeps weighting on the Analyze side and method options under Generate.
- P7 consolidates the workspace and runs the accessibility and raw-hex sweeps.
- P8 moves the Composer into the project and adds timeline insertion. It can overlap with P7.


Decisions are timed to their first dependent phase:

- Q1 and Q2 before P1a;
- Q3 (§10 naming) before P2;
- Q4 and Q5 before P3;
- Q6 before P5.


Gates on every phase:

- CI (typecheck, vitest node plus happy-dom, Playwright at 1366x768 and 1600x1000);
- expected-fail C1-C9 specs flipped by their fix;
- reducer tests per user intent;
- the Learn More sync test plus a Learn More deliverable in every phase that changes a metric, verdict tier or constraint (P1a, P1b, P2, P3, P4, P5, P6, P8);
- on optimizer-touching PRs, TEST MIDI 1 with 0 unplayable events, the lock case and seed-0 determinism for greedy, beam and annealing, plus the Solver Change Checklist;
- deep annealing nightly within its budget.


Effort, team:

- P0 1 week, P1a 3-4, P1b ~3 (overlapping P1a by about 1.5), P2 3-4, P3 3-4, P4 4-6, P5 4-5, P6 4-5, P7 3-4, P8 5-7 (overlapping P7 by about 3).
- Roughly 30-42 weeks for 2-3 engineers, about 120 PRs and 70-110 engineer-weeks.


Solo 'trust release' cut line: P0 + P1a + P1b + the P2 core (T04, T05, T50, the T17 slice, the T52 slice) + the P3 core (T01, T03, T13 on the P1b cache). That is about 20-25 weeks for one developer, and leaves no critical harm live and fixes the CLAUDE.md UI-rule violations found (timeline width, Library cards); whole-moment selection for played-in chords (T24) follows in P4.

Cuttable without breaking any invariant:

- P4: the hands filter, the volume popover and audition;
- P5: cross-tab compare-and-swap and the BroadcastChannel banner;
- P7: the flag rollout;
- P8: T70 sequencer basics and the full T62 keyboard grid.

Solo work replaces every 'behind a flag' with a short-lived branch. Team work uses the P0 flags module.

Where each theme lands:

- Criticals: T01 P1a/P3; T02 P1a; T06 P1b; T07 P1b; T08 P1b/P3; T09 P1b/P4; T10 P1b/P4; T11 P1a; T65 P1b/P5/P8.
- Highs: T03 P3; T04 P2/P4; T05 P2; T12 P1a; T13 P3; T14 P1a/P3; T15 P1a/P1b/P4; T17 P2/P5; T18 P1a; T19 P1b/P5; T20 P1b/P2; T21 P1b/P3/P6; T22 P1b; T23 P2; T24 P1b/P4; T25 P3; T26 P6; T27 P4; T28 P1b/P4; T29 P2; T31 P1a-P3; T33 P3/P6; T34 P6; T35 P3; T38 P2/P7; T47 P5; T49 P5; T50 P2; T51 P2/P5; T52 P2/P5; T58 P4; T61 P1b/P2/P4; T64 P2/P4/P7; T66 P1a/P8; T67 P1a/P8; T68 P8; T69 P2/P8; T70 P8 (rest deferred).
- Mediums: T16 P4; T30 P3; T32 P3; T36 P6; T37 P3; T39 P2/P6; T40 P6; T41 P6; T42 P4/P7; T43 P2/P4; T44 P2; T45 P5; T46 P5; T48 P5; T53 P2; T54 P5; T55 P0/P5; T56 P2; T57 P1a/P5; T59 P4; T60 P1a/P4/P8; T62 P2/P8; T63 P3/P7.

## Deliberately deferred

- T46, the rest (multi-pad and marquee selection, group drag, arrow-key nudge, 'Mirror L<->R'). These add capability rather than trust, and need P4's pad-selection model plus stable undo transactions. Revisit after P8, each as one undo step.
- T59, the rest (per-Sound rehearsal voices such as Kick/Snare/Hat/Perc/Tone). Nice to have. Count-in ships in P4, and volume, audition and the hands filter ship there too unless cut. The current stable hash voice stays, and a voice choice must never be derived from MIDI pitch (invariant 5).
- T70, the rest (triplet grids and 'Insert rudiment...'). Triplets wait until the musical-time model (P5) has proven itself on real projects. 'Insert rudiment...' needs its own UI on the rudiment engine. Note that GENERATE_RUDIMENT (loopEditorReducer.ts:192) already computes padAssignments and fingerAssignments; any future rudiment insertion must create notes only and discard those assignments, never auto-applying them to the grid (invariant 7). 1/16 default, 1/32, velocity, duplicate, copy/paste and lane reorder ship in P8 unless cut.
- T40, the rest (an optional Difficulty lane inside the timeline). The P6 chart with bands and bar.beat ticks covers the need. Revisit after user validation.
- T39 '4x4 Banks' as quadrant guide lines. The dead toggle is removed in P2 and comes back only if users ask.
- T53 'Recently deleted' area. Replaced by the ~10 s Undo toast on delete (P2), which is cheaper and covers the reproduced risk.
- T57 real-time merging between tabs. P5 only detects the conflict (revision counter plus BroadcastChannel, itself cuttable) and offers Reload / Keep mine. Merging costs more than it is worth for a local-first app.
- T30 persistent candidate history. The canon says a Candidate Solution is a proposal, not project truth. 'Keep' (save as a Saved Layout Variant) is the durable path, and the list stays unpersisted with a capped 'Earlier runs' group.
- Cloud or multi-device sync. The app stays local-first in IndexedDB.
- Solver-family redesign or new optimization methods. Excluded by the CLAUDE.md priority order. Engine changes are limited to:
  - lock seeding and carry-through, and strict identity resolution;
  - the diversity baseline and translation dedupe;
  - abort flags and the annealing time budget (restarts and schedule kept);
  - trace attachment, eventIndex semantics and costToggles pass-through.

  Greedy, Beam and Annealing all stay.
- Touch, mobile and responsive breakpoints. Out of scope under the desktop-only invariant; all sizing uses measurement.

## Open questions for the product owner

- Q1 (needed before P1a). Does the Working/Test Layout persist across sessions? The CLAUDE.md default is 'session-scoped unless saved or promoted', but the app persists it today, and dropping it on reload would create a new way to lose work. The plan assumes it stays persisted. Four pieces depend on that: P1a's truthful save and Recovered drafts, P2's 'Draft, not promoted' Library badge, and P5's 'Draft restored · Keep editing / Discard' banner.
- Q2 (needed before P1a). Do finger preferences survive Discard (T12)? Option one: they are Sound-level truth in voiceConstraints (invariant 6), so Discard keeps them and its toast says so. Option two: they belong to the draft, so Discard reverts them. The P1a reducer tests encode option one unless the owner decides otherwise.
- Q3 (needed before P2). Canon section 10 says imported MIDI pitch 'is stripped from the sound', while CLAUDE.md invariant 5 keeps originalMidiNote as metadata. May default Sound names or labels ever use pitch? The default proposal:
  - Default names use the track or file name plus a short sequence letter, never a note name.
  - originalMidiNote stays stored as provenance and appears only in the import review and a Sound's details tooltip.
  - An opt-in 'Name from GM drum map' action renames Sounds on request, as one undo step.

  This blocks the P2 T17 defaults slice and the P5 review sheet.
- Q4 (needed before P3). Invariant 7 says 'Auto-layout on empty grids is forbidden. The user must manually place each sound.' From P1a on, Generate never applies anything. Two cases remain open. (1) May 'Suggest a starting layout' keep placing every Sound on an empty grid in one click, as one undo step, or must it produce a proposal the user inspects and applies with 'Use as my draft'? (2) May 'Place remaining N' place the remaining Sounds directly, or must it produce a candidate? Also confirm that auto-inspecting candidate A read-only after an empty-grid Generate is acceptable, since nothing is written to the draft. The plan defaults to the proposal route for 'Place remaining N' and keeps one-click Suggest as an explicit action until the owner decides. This blocks P3's T37.
- Q5 (needed before P3). Confirm the single headline and evaluator (T21). The proposal is 'Playability 0-100, higher = easier', computed by canonicalEvaluator, with Hard and Unplayable moment counts and each factor's share of the burden. It replaces Score %, difficulty words as the headline, and the per-card optimizer cost, while Beam keeps PerformabilityObjective for ranking. P3's per-hash cache scores every layout with this evaluator, and P6 only presents it, so deciding late would force a cache rebuild and leave the 'two yardsticks' problem live through P3-P5.
- Q6 (needed before P5). What is the Pattern Composer's model (T68)?
  - Option (a): a quantised editor of the whole project timeline, where every Sound is a lane with its imported notes. No separate pattern storage is needed.
  - Option (b): named pattern sections inserted into the one timeline at a chosen bar. P5's musical-time schema reserves a pattern slot in beats.

  The plan defaults to (b). This decides P5's schema and P8's placement records and header UX. Either way, the Composer tab stays in the bottom drawer and uses the project tempo.
- Q7 (needed before P2). The canon term is 'Performance Event', and the UI already has an Events tab. May the UI also use 'moment' for the same object (everything struck at one instant), or should labels stay 'Event 12 · 3.2.3' with 'moment' used only in explanatory text? The plan defaults to 'Event' in labels and 'notes' for single hits; adopting 'moment' would need a PUSHFLOW_TERMINOLOGY.md update.

## How the plan was chosen

| Angle | Score | Strengths | Weaknesses |
|-------|-------|-----------|------------|
| trust-first | 7.7 | Best dependency reasoning of the three. Moment identity (T24) comes before the moment view (T09) and transport (T10), T18 before T66, and T66 before the preset drop (T65), with a clear argument that switching on the drop early turns an inert feature into pad overwrite plus orphan pruning. Its principles are the strongest set (undo records user intent; missing data reads 'Unknown'; one source per truth). Deliverables are precise at reducer level, and exit criteria are inverted C1-C9 repros. Phase 1 includes the Composer stop-gap and a truthful 'Saved', and it keeps cost toggles honest inside Generate > Advanced instead of hiding them. Sub-scores: early value 6, dependencies 9, invariants/canon 8, risk 8, clarity 9. | Four of the nine reproduced criticals survive Phase 1. The T08 zero stub, which reverses Compare verdicts, is fixed only in P2; T09 and T10 in P3; T65 in P4 (weeks 3-19). Distinct Sound colours and names (T17) wait until P5 (about week 15+) even though they depend on nothing, on the grounds that legibility should wait for correct numbers. Library cards that break the CLAUDE.md UI Non-Regression Rule (T52) wait until P4, and the canon Portfolio features 'import MIDI' and 'open demo project' (T51) wait until P7. The Composer rebuild (P4) comes before legibility and the workspace redesign. P2 is a heavy 4-5 week lifecycle bundle. |
| journey-first | 6.3 | Mapping each phase to steps of the canonical workflow spine makes every phase's user outcome obvious. It has the clearest north star and wireframe (Layouts rows with delta chips, an inset Compare 'What changed' table). It lifts the transport to a workspace service in the same phase as the scheduler rewrite, so the work isn't done twice. It uniquely flags that empty-grid Generate may conflict with invariant 7. Other good ideas to adopt: 'Unfinished' as a named verdict, auto-inspecting candidate A after Generate, sorting rows by the displayed headline with solver rank in a tooltip, and building the a11y primitives early so the final sweep stays bounded. Sub-scores: early value 5, dependencies 7, invariants/canon 6, risk 5, clarity 8. | P1 is overloaded: the full inspected-layout model, undo transactions, state bar, grid resize, Dialog and Toast primitives, clean names and Promote unification, all in 3-4 weeks and 13 PRs. Generation keeps dropping placement locks (the canon's only hard rule, C3) until P4, with only a warning chip in the meantime. Truthful saving (T57) and the Library data-rule violation (T52) wait until P7. Onion skin (T09) waits until P5. Mute deleting Sounds on Generate (T15) and chord-inflated cost (T22) wait until P3. Spine order pushes cheap, high-harm fixes late. |
| impact-per-effort | 8.2 | Neutralises all nine reproduced criticals (C1-C9) in a 2-3 week sprint of small fixes and thin slices, with Undo first because it is the recovery path. A second quick-win sprint fixes the clipped grid, identical amber Sounds, transport reach, Library MIDI entry, and two CLAUDE.md UI Non-Regression violations (timeline width T50, Library cards T52) by about week 6. After that, the medium and large work follows a sound dependency order: inspected layout, then state bar, Compare and Promote; moment identity plus FACTOR_META, then the moment loop; then the cost story. '[Outsized S]' markers, per-slice exit criteria and C-replay gates make it the most actionable plan. Sub-scores: early value 9, dependencies 7, invariants/canon 8, risk 7, clarity 9. | The P1 preset slice switches on the drop before Composer lanes carry Sound ids (T66), relying on a vague 'matching project Sound' rule. The coherent cost story (T21) and 'partly placed shown as failure' (T25) wait until P6. The transport is rewritten in P4 and lifted again in P7. The a11y primitives arrive in P6, so surfaces built in P3-P5 need rework. The Composer edit-loss stop-gap only lands in P2. P6 is a 6-8 week L bundle. It defaults the cost toggles to the debug page. Removing the pitch fallback (T18) and the eventIndex change land in different phases, so scores shift twice. |

Base: **impact-per-effort**. Grafted from the others:

- From trust-first: the stronger principles (undo records user intent, never computed state; missing data reads 'Unknown'; one source per truth), stated as rules that apply in every phase.
- From trust-first: every phase is gated by the C1-C9 repro scripts inverted into Playwright regressions at 1366x768 and 1600x1000, plus TEST MIDI 1 (0 unplayable, all methods), the Solver Change Checklist and a Learn More sync check.
- From trust-first: the Composer stop-gap (both drawer tabs mounted, pending saves flushed, playhead removed from save deps) and truthful 'Saved' move into P1, because both are silent data loss.
- From trust-first dependency argument: the P1 preset slice refuses the drop first. A drop is accepted only when every slot already resolves to a project Sound id, and nothing overwrites occupied pads. Cross-project placement waits for the P5 mapping step, so no drop can create a voice that orphan pruning would later delete.
- From trust-first: the cost-family toggles become honest (they mark the analysis stale and re-run it, and the SubjectChip reads 'Custom weighting'), placed on the Analyze side in the Analysis header rather than on the debug page.
- From trust-first: the MIDI-pitch fallback removal (T18) moves to P1a, so it lands with lock seeding under one Solver Change Checklist run and one 'scores changed' note. P5's musical-time schema also reserves a Composer pattern slot in beats, so P8 only moves data and doesn't need a second time-model migration.
- From journey-first: each phase names the canonical workflow-spine steps it serves.
- From journey-first: the wireframe elements (Layouts rows with delta chips, Compare as a portaled A | B | Change dialog, a Source files section, outlined and dimmed timeline rows for unplaced and excluded Sounds).
- From journey-first: the transport and audio engine are lifted into a workspace-level service in P4, together with the look-ahead scheduler, so P8 only wires Composer Play to it.
- From journey-first: 'Unfinished' becomes a named verdict and T25 moves from P6 to P3. After Generate, candidate A is auto-inspected read-only with a one-time coach mark. Candidate rows are ordered by the displayed headline, with solver rank in a tooltip. Older runs fold into an 'Earlier runs' group.
- From journey-first: the accessible primitive kit (Tabs, ToggleButton, Checkbox, IconButton, Card) ships at the start of P3, so every later surface is built on it and the P7 sweep stays bounded.
- From journey-first: the open question on empty-grid Generate versus invariant 7.
- Judge additions: canon Surface Features items (candidate diff against the Working/Test Layout when relevant; Portfolio 'current active layout status' and 'open demo project'); the L-sized P6 split into two phases (cost story + Compare, then workspace + a11y); the T20 slice and T23 move from P1 to P2 so P1 stays focused on loss and false verdicts; the 'Show Finger Assignment' toggle is protected during the gear cleanup.

A completeness critic then raised 23 gaps (no CI/test infrastructure for the gates; foundations such as moment grouping, factor naming, strict Sound identity and the analysis cache arriving after their consumers; undo restoring session state; canon conflicts; optimistic sizing and no solo cut). The plan above is the revision that addresses them.
