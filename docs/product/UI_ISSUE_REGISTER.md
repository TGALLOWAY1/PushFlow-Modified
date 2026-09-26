# PushFlow UI Issue Register

*Date: 2026-09-23 · Companion to [UI_CORE_FLOWS_CRITIQUE.md](UI_CORE_FLOWS_CRITIQUE.md) and [UI_ENHANCEMENT_ROADMAP.md](UI_ENHANCEMENT_ROADMAP.md).*

70 distinct problems ("themes"), consolidated from 307 verified findings across 12 review scopes (F1 Import · F2 Manual arrangement · F3 Automatic arrangement · F4 Viewing the performance · F5 Costs & compare · F6 Saving & loading · F7 Rehearsing · F8 Sound identity · F9 Composer & presets · F10 Layout lifecycle · X1 Visual/IA · X2 Accessibility/feedback/terminology). Every finding maps to exactly one theme.

## Critical problems: independent reproduction

Each critical problem was reproduced from scratch by a separate agent with its own browser script (kept in `scripts/ui-critique-repros/` until its e2e spec passes; C1–C8 were retired on 2026-09-26 and are listed in [docs/ARCHIVE.md](../ARCHIVE.md)). The reproducers rated two of the nine critical and seven high; the severity used elsewhere is the consolidated theme severity.

| # | Problem | Reproduced | Reproducer's severity | Root cause |
|---|---------|------------|------------------------|------------|
| C1 | Pad context menu renders off-cursor / off-screen ([T06](#t06)) | yes | critical | PadContextMenu renders inline inside the CSS-scaled, backdrop-filtered grid wrapper with no portal (InteractiveGrid.tsx:918-925, PerformanceWorkspace.tsx:641-644), so its fixed position is offset, scaled and clipped. Full detail: [T06](#t06). |
| C2 | Generate / Preview overwrite the Working/Test Layout ([T01](#t01)) | yes | critical | APPLY_GENERATION_TO_LAYOUT replaces workingLayout with a clone of the candidate without checking for an existing draft (projectState.ts:1239-1276), and Generate dispatches it after every run (useAutoAnalysis.ts). Full detail: [T01](#t01). |
| C3 | Beam & Annealing ignore and delete placement locks ([T11](#t11)) | yes | high | Beam and Annealing runs never receive the placement locks (useAutoAnalysis.ts:327), and Beam seeds from a fixed template rather than the current grid. Full detail: [T11](#t11). |
| C4 | Undo unreliable (analysis fills the history) ([T02](#t02)) | yes | high | EPHEMERAL_ACTIONS (projectState.ts:393-416) omits SET_ANALYSIS_RESULT, SET_CANDIDATES and APPLY_GENERATION_TO_LAYOUT, so analysis results become undo steps, while SUGGEST_STARTING_LAYOUT is marked ephemeral and never recorded. Full detail: [T02](#t02). |
| C5 | Onion skin has no visible effect ([T09](#t09)) | yes | high | Inline opacity and saturate(0) on every non-selected pad (InteractiveGrid.tsx:537, 642, 666) override the onion-skin classes, and the previous-event ghost renders only on empty pads (:698). Full detail: [T09](#t09). |
| C6 | Selecting an event shows a false "Feasible" ([T07](#t07)) | yes | high | FeasibilityBadge falls back to 'feasible' when it is given no verdict (CostBreakdownBars.tsx:37-45), and the selected-event view passes none. Full detail: [T07](#t07). |
| C7 | Compare shows Active as empty / zero-scored ([T08](#t08)) | yes | high | buildActiveCandidate falls back to a zero stub whenever the Active Layout has no fresh plan (CompareModal.tsx:25-39). Full detail: [T08](#t08). |
| C8 | Selected event freezes the grid during playback ([T10](#t10)) | yes | high | The selected-event greying (InteractiveGrid.tsx:537) stays applied during playback, so it overrides the playback pad flash. Full detail: [T10](#t10). |
| C9 | Preset drop does nothing ([T65](#t65)) | yes | high | handleDragOver sets dropEffect 'move' while preset cards allow only 'copy', so drop never fires (InteractiveGrid.tsx:463, PresetCard.tsx:62); the drop handler is also stale (InteractiveGrid.tsx:412-459). Full detail: [T65](#t65). |

## Themes

| ID | Severity | Kind | Effort | Flows | Title |
|----|----------|------|--------|-------|-------|
| [T01](#t01) | critical | state-safety | M | F2, F3, F4, F5, F6, F10, X2 | No read-only 'inspected layout': Preview, card clicks, Generate and Load Draft overwrite the Working/Test Layout, and the Active Layout can't be viewed |
| [T02](#t02) | critical | state-safety | S | F1, F2, F3, F6, F8, F9, F10, X2 | Undo is unreliable: analysis, candidate and sync actions fill the history, while Suggest is never recorded |
| [T03](#t03) | high | confusing | M | F2, F4, F5, F10, X1, X2 | No persistent layout-state bar: the screen never reliably says whether it shows Active, Working/Test or a Candidate |
| [T04](#t04) | high | visual-layout | M | F1, F2, F4, F7, X1 | The pad grid is clipped and starved of space at every viewport |
| [T05](#t05) | high | visual-layout | S | F7, X1 | The timeline transport toolbar pushes LOOP, CLICK, SOUND and '✕ REGION' off-screen |
| [T06](#t06) | critical | bug | S | F2, F5, X2 | The pad context menu and other overlays render inside transformed containers, and modals lack dialog behaviour |
| [T07](#t07) | critical | bug | S | F2, F4, F5, X2 | Selecting an event turns the feasibility verdict into a false 'Feasible · All events playable' |
| [T08](#t08) | critical | bug | M | F3, F5, F10 | Compare shows wrong or dead-end content: a zeroed-out Active Layout, self-compare, and a fallback screen that can't be closed |
| [T09](#t09) | critical | bug | M | F4, F7 | The moment view on the grid is broken: onion skin has no effect, next strikes are invisible, struck pads lose their identity, and nothing looks ahead during playback |
| [T10](#t10) | critical | bug | M | F4, F7 | Event selection and the transport are disconnected: a selection freezes the grid during playback, the playhead ignores the selection, and a paused grid is blank |
| [T11](#t11) | critical | bug | M | F2, F3 | Beam and Annealing generation ignore placement locks and finger preferences, and manual drags ignore locks |
| [T12](#t12) | high | state-safety | S | F2, F8, F10 | Discard leaves stale derived state: invisible ghost locks in the Active Layout and out-of-date finger constraints |
| [T13](#t13) | high | state-safety | S | F3, F10 | The two Promote paths behave differently, and both can lose work |
| [T14](#t14) | high | bug | M | F2, F5, F8, F9, F10 | Analysis freshness is signalled wrongly: 'outdated' fires on non-changes, and real changes go unmarked |
| [T15](#t15) | high | state-safety | M | F3, F7, F8, X2 | Mute and Solo silently narrow the analysis, and Generate deletes muted sounds from the layout |
| [T16](#t16) | medium | bug | S | F2, F8 | Muted pads can't be edited, and Solo doesn't behave like a DAW's |
| [T17](#t17) | high | bug | M | F1, F2, F8, X1, X2 | Imported Sounds all look alike (one amber colour, numbered names, truncated pad labels) and are hard to rename |
| [T18](#t18) | high | bug | M | F8, F9 | MIDI pitch is used as a fallback identity, merging sounds and matching Composer lanes to pads |
| [T19](#t19) | high | state-safety | S | F2, F8 | Finger preference controls: a stray click commits the solver's suggestion, and three different controls use three notations |
| [T20](#t20) | high | copy-terminology | M | F5, F8, X1, X2 | Engine vocabulary leaks into the UI: raw ids and keys, and each cost factor has 3-7 names and two colour schemes |
| [T21](#t21) | high | confusing | L | F3, F5, F9 | No coherent cost story: competing score scales, and before/after Generate is measured by different evaluators |
| [T22](#t22) | high | bug | S | F4, F5 | Chord moments are counted once per note, so a moment's cost grows with chord size |
| [T23](#t23) | high | copy-terminology | S | F1, F5, X1, X2 | 'Events' means raw notes in some places and moments in others |
| [T24](#t24) | high | bug | M | F4, F5 | There is no single moment identity: eventIndex numbers notes in beam plans and moments in greedy plans |
| [T25](#t25) | high | confusing | M | F2, F5 | Partly placed layouts are presented as failures |
| [T26](#t26) | high | missing-capability | L | F3, F5, F10 | Nothing is compared against the baseline: no diff vs Active, diversity measured from the draft, and Compare can't include the draft or variants |
| [T27](#t27) | high | missing-capability | M | F4, F5, F8 | The Events list and moment inspector don't help find or understand hard moments |
| [T28](#t28) | high | confusing | M | F2, F4 | Selecting a pad and selecting an event are the same action |
| [T29](#t29) | high | ux-friction | S | F6, F10 | Saved Variants all get the same name, can't be renamed and show no scores |
| [T30](#t30) | medium | missing-capability | S | F3, F6, F10 | Candidates are temporary, and there is no way to keep one |
| [T31](#t31) | high | ux-friction | M | F2, F9, F10, X1, X2 | Committing and destructive actions confirm inconsistently, and none report what happened |
| [T32](#t32) | medium | copy-terminology | S | F2, F10, X2 | Layout roles are written into layout names, and lifecycle wording drifts from the canon |
| [T33](#t33) | high | bug | M | F3 | The optimization trace is incomplete and contradicts itself |
| [T34](#t34) | high | remove-or-demote | M | F3, F5, X1, X2 | Optimizer internals are the main Generate UI: raw method, strategy and intensity selects, choices that do nothing, and jargon card names |
| [T35](#t35) | high | ux-friction | M | F3 | Generation shows no progress or ETA, can't be cancelled, and leaves conflicting actions live |
| [T36](#t36) | medium | bug | M | F3 | Beam and Annealing return near-copies, and the lack of diversity is never explained |
| [T37](#t37) | medium | confusing | S | F3 | Explicit placement actions are inconsistent: Generate on an empty grid places everything, and Suggest disappears once anything is placed |
| [T38](#t38) | high | confusing | L | F3, F5, F10, X1 | Workspace layout: analysis duplicated across tabs, candidates buried, related information scattered, and competing primary buttons |
| [T39](#t39) | medium | remove-or-demote | S | F2, F5, F10, X1 | The 'View settings' gear mixes view toggles, a dead toggle, a hidden duplicate of Save Variant, and cost toggles that don't affect the analysis |
| [T40](#t40) | medium | visual-layout | M | F5 | Cost bars and the difficulty chart have no absolute scale, no thresholds and no musical time axis |
| [T41](#t41) | medium | missing-capability | M | F5 | Learn More doesn't explain the numbers on screen and can't be reached from the Costs tab |
| [T42](#t42) | medium | visual-layout | M | F4, F5, F8, X1 | Hand colours, finger notation and colour meanings change from one surface to the next |
| [T43](#t43) | medium | copy-terminology | S | F2, F4, F7, F8 | Positions and times are shown in developer notation |
| [T44](#t44) | medium | copy-terminology | S | F1, F2, X1, X2 | Empty-state and next-step guidance is scattered and mixes up Analyze and Generate |
| [T45](#t45) | medium | missing-capability | M | F2, F8 | The Sounds panel has no placement status, filters or row actions, and grouping is half-finished |
| [T46](#t46) | medium | ux-friction | M | F2, F8 | Grid editing gestures are limited and give no feedback (silent eviction, pad-to-list drag reorders the list, no multi-select) |
| [T47](#t47) | high | missing-capability | M | F1, F8 | Import only appends: re-importing duplicates every Sound, and files or Sounds can't be removed |
| [T48](#t48) | medium | ux-friction | M | F1, F3 | Import errors are mislabelled, edge cases pass silently, and there is no import review step |
| [T49](#t49) | high | bug | M | F1, F6, F9 | Notes are stored in absolute seconds, so tempo changes and multi-file imports shift notes off the bar grid |
| [T50](#t50) | high | bug | S | F1 | The timeline doesn't fill its width after importing a 4-bar clip at the project tempo |
| [T51](#t51) | high | missing-capability | M | F1, F6 | The Library can't start a project from a MIDI file, and projects are never named after the file |
| [T52](#t52) | high | bug | M | F1, F6, F10 | The Library misrepresents projects: empty thumbnails for draft work, missing metadata, and a 'Current Session' that isn't the current session |
| [T53](#t53) | medium | ux-friction | S | F6 | Project management actions are incomplete and risky |
| [T54](#t54) | medium | remove-or-demote | S | F1, F6 | The Library sidebar is mostly developer tools, vanity stats and copy for features that don't exist |
| [T55](#t55) | medium | visual-layout | M | F1, F6, X1 | Library visuals: clipped previews, an oversized hero at 1366, a separate design system and a remote icon font |
| [T56](#t56) | medium | copy-terminology | S | F1, F6, F7, X2 | Naming and copy style are inconsistent (Project / Performance / Session, casing, the 'SOUND' toggle) |
| [T57](#t57) | medium | state-safety | M | F6 | Saving can't be trusted: silent failures, a 'Saved' that isn't true, lost last edits and tabs overwriting each other |
| [T58](#t58) | high | bug | M | F7 | Transport and loop don't behave like a DAW: LOOP off still loops, loops don't snap, hits on the loop point are dropped, and audio jitters |
| [T59](#t59) | medium | missing-capability | M | F7 | Rehearsal lacks standard practice aids: count-in, volume and audition, voice choice, hands-separate practice |
| [T60](#t60) | medium | bug | M | F7, F9 | Two separate transports: switching to the Composer tab freezes playback, and Composer playback is silent |
| [T61](#t61) | high | accessibility | S | F4, F7, X2 | Keyboard shortcuts: Space doesn't play, handlers steal keys from other controls, and nothing is discoverable |
| [T62](#t62) | medium | accessibility | L | F2, X1, X2 | The pad grid and Sounds list work only by mouse drag, and there is no click-to-place |
| [T63](#t63) | medium | accessibility | M | F1, F3, F5, F6, F9, F10, X1, X2 | Custom widgets lack roles, states and visible focus, and hover-only controls take invisible focus |
| [T64](#t64) | high | accessibility | M | F4, F7, F8, X1, X2 | Hard to read and see: text below the type scale, targets under 24px, contrast failures and colour-only state |
| [T65](#t65) | critical | bug | M | F9 | Presets don't work end to end: dropping does nothing, a stale handler overwrites pads, and saving records invented data |
| [T66](#t66) | high | bug | L | F9 | Composer lanes aren't tied to project Sound identity |
| [T67](#t67) | high | state-safety | L | F9 | The Composer keeps its state outside the project: edits are lost, aren't saved with the project, and can't be undone |
| [T68](#t68) | high | confusing | L | F9 | It's unclear what the Composer edits, and its flow is spread across three panels |
| [T69](#t69) | high | visual-layout | M | F9 | The step grid's geometry drifts, and the Composer toolbar reflows under the cursor |
| [T70](#t70) | high | missing-capability | M | F9 | The step sequencer lacks basics finger drummers need |

<a id="t01"></a>
### T01 — No read-only 'inspected layout': Preview, card clicks, Generate and Load Draft overwrite the Working/Test Layout, and the Active Layout can't be viewed

**Severity:** critical · **Kind:** state-safety · **Effort:** M · **Flows:** F2, F3, F4, F5, F6, F10, X2 · **Depends on:** —

**Problem.** Every Generate applies candidate #1 as the Working/Test Layout. 'Preview', any click on a card body, and 'Load Draft' on a variant also replace the draft with a clone. A hand-built draft that was never promoted or saved is lost without warning, and because of T02 it can't be recovered. The reverse is also true: while a draft exists there is no way to look at the Active Layout. Clicking the green Active card only clears the candidate selection and lights its ring, while the grid keeps showing the draft, now re-scored by a hidden beam analysis. So the performer can't answer 'what did I change?' or 'is this candidate better than my draft?' without destroying one of the two.

**Root cause.** useAutoAnalysis.ts:307-311, 340-344 dispatch APPLY_GENERATION_TO_LAYOUT after every run. LayoutOptionsPanel.tsx:198-206, 279-283 and CandidatePreviewCard.tsx:74 (card body onClick = onSelect = SELECT_CANDIDATE + APPLY_GENERATION_TO_LAYOUT). projectState.ts:1239-1276 replaces workingLayout wholesale, and LOAD_SAVED_VARIANT does the same at projectState.ts:1067-1081. The displayed layout is working ?? active (projectState.ts:221-223). The Active card click is SELECT_CANDIDATE(null), and its ring shows whenever !selectedCandidateId (LayoutOptionsPanel.tsx:110-117). The grid already accepts a read-only layoutOverride (PerformanceWorkspace.tsx:489-491).

**Recommendation.** Introduce one 'inspected layout' selector: {kind: active | working | candidate | variant, id}. Viewing Active, a candidate or a variant is read-only: it renders through layoutOverride with that layout's own plan and never writes workingLayout. Generate only fills the candidate list. Add explicit actions: 'Use as my draft' (confirm, or first save a non-empty draft as a variant), 'Promote', 'Keep as variant' and 'Back to my draft'. Clicking the Active card shows Active read-only with the bar 'Viewing Active · your draft is kept'. Layouts that aren't on screen get their analysis from a per-layout-hash cache (shared with T08).

**Invariants / canon.** Canon: manual edits default to the Working/Test Layout. A Candidate Solution is a proposal, not hidden project truth. Compare is read-only. Analysis-only state is not project truth. CLAUDE.md UI/Workflow core: grid, candidate, trace and timeline must stay consistent after preview, selection and promotion.

**Source findings:** [F2-03](#f2-03), [F3-02](#f3-02), [F4-V02](#f4-v02), [F10-01](#f10-01), [X2-V03](#x2-v03), [F3-12](#f3-12), [F5-V02](#f5-v02), [F10-10](#f10-10)

<a id="t02"></a>
### T02 — Undo is unreliable: analysis, candidate and sync actions fill the history, while Suggest is never recorded

**Severity:** critical · **Kind:** state-safety · **Effort:** S · **Flows:** F1, F2, F3, F6, F8, F9, F10, X2 · **Depends on:** —

**Problem.** Auto-analysis results, candidate lists and lane-to-stream syncs are all recorded as undo steps. After an edit, Generate, Discard or Promote, the first one or more Undo presses change nothing visible, re-trigger analysis and clear Redo. A project that has just been opened already shows Undo enabled, and pressing it wipes the analysis. Renaming, recolouring or muting a sound takes 2-3 presses to revert. 'Suggest a starting layout', which rewrites the whole grid, is never recorded at all. The one safety net that could make the draft-loss and Discard problems recoverable doesn't work.

**Root cause.** EPHEMERAL_ACTIONS (projectState.ts:393-416) omits SET_ANALYSIS_RESULT, SET_CANDIDATES, APPLY_GENERATION_TO_LAYOUT, SYNC_STREAMS_FROM_LANES and SELECT_STREAM, yet includes SUGGEST_STARTING_LAYOUT. useUndoRedo.ts:43-57 snapshots every non-ephemeral dispatch and clears redo. UnifiedTimeline.tsx:64-68 dispatches SYNC_STREAMS_FROM_LANES on every lanes change. Ctrl+G dispatches CREATE_LANE_GROUP plus one SET_LANE_GROUP per sound (VoicePalette.tsx:54-71).

**Recommendation.** Snapshot only project truth (layouts, sounds, constraints, locks, lanes), or mark every derived action ephemeral: SET_ANALYSIS_RESULT, SET_CANDIDATES, SET_PROCESSING, MARK_ANALYSIS_STALE, SYNC_STREAMS_FROM_LANES and SELECT_*. Record exactly one undo step per user intent (Suggest, 'Use candidate as draft', Discard, Promote, a grouping gesture, an import) by wrapping compound dispatches in a transaction. A freshly loaded project starts with Undo disabled. Label the button with its target ('Undo Discard'). Add reducer tests: place 3 sounds, press Undo 3 times, and the grid is empty; open a project, and Undo is disabled.

**Invariants / canon.** Do not turn analysis-only state into persistent truth. If SET_PROCESSING becomes ephemeral, isProcessing must still reset to false on both the success and the error path after optimizer runs.

**Source findings:** [F2-01](#f2-01), [F3-03](#f3-03), [F6-17](#f6-17), [F10-06](#f10-06), [X2-V02](#x2-v02), [F8-04](#f8-04)

<a id="t03"></a>
### T03 — No persistent layout-state bar: the screen never reliably says whether it shows Active, Working/Test or a Candidate

**Severity:** high · **Kind:** confusing · **Effort:** M · **Flows:** F2, F4, F5, F10, X1, X2 · **Depends on:** T01, T04

**Problem.** The only on-grid indicator ('Active' / 'Working Draft') is drawn inside the scaled, overflow-hidden grid. At 1600x1000 only a sliver shows, and at 1366x768 it is invisible, along with its 'Analysis outdated' text. Its logic knows only two roles, so a previewed candidate is labelled 'Working Draft'. The Costs tab header just says 'Cost Analysis' and the Events tab just says '32 events'; neither names the layout being analysed. Nothing shows how the draft differs from Active. Canon requires every analysis surface to name its subject.

**Root cause.** InteractiveGrid.tsx:779-796 renders the badge inside the grid ('Working Draft' : 'Active'). getDisplayedLayoutRole (projectState.ts:228-232) has no candidate role, while getDisplayedCandidate (301-303) prefers the selected candidate. PerformanceWorkspace.tsx:641-645 wraps the grid in overflow-hidden plus transform: scale. PerformanceCostsPanel.tsx:57-63 renders only a generic header, and EventsPanel.tsx:231-234 only a count.

**Recommendation.** Add a fixed-height, unscaled layout-state bar above the grid, driven by the T01 selector. It shows a role chip with its own colour and icon (ACTIVE green, WORKING/TEST amber, CANDIDATE #n violet, SAVED VARIANT), the layout name, a diff count against Active ('3 pads changed'), a freshness state ('Up to date' / 'Updating…') and the actions that apply to that role. Reuse one SubjectChip component at the top of Costs, the Layouts summary, the Events list, the moment inspector and the chart modal.

**Invariants / canon.** Canon §8: analysis must name its subject. Use the canonical terms Active Layout, Working/Test Layout and Candidate Solution. Desktop-only: give the bar a fixed height; no breakpoints.

**Source findings:** [F2-06](#f2-06), [F10-03](#f10-03), [F10-04](#f10-04), [X1-04](#x1-04), [X2-07](#x2-07), [F5-09](#f5-09), [X1-V01](#x1-v01), [F4-21](#f4-21)

<a id="t04"></a>
### T04 — The pad grid is clipped and starved of space at every viewport

**Severity:** high · **Kind:** visual-layout · **Effort:** M · **Flows:** F1, F2, F4, F7, X1 · **Depends on:** —

**Problem.** The grid is the primary truth surface, but it is shrunk with transform: scale() against a hard-coded 520px natural size. That constant underestimates the real content (badge, axes, hand-zone labels, transition line, bezel). The transform leaves the layout box at full size inside an overflow-hidden, vertically centred container, so the top and bottom pad rows, the state badge and the 'Left/Right Hand' labels are cut off even at 1600x1000. The timeline takes a fixed 480px however many lanes it has. At 1366x768 the grid is left about 209px, pads are 28px and labels about 5px, while roughly 100px under the last timeline lane sits empty. Arranging, reading onion skin or rehearsing on a laptop is impractical.

**Root cause.** PerformanceWorkspace.tsx:290 (GRID_NATURAL_SIZE = 520), 292-305 (scale clamped to 0.5-1.2), 641 (overflow-hidden items-center), 644 (transform: scale), 667 (timeline flex-[0_1_480px] min-h-[240px]). The enclosure is sized to the unscaled box (638-643). The backdrop blur and ambient glows in index.css:94-141 render nothing visible.

**Recommendation.** Drop transform: scale. Measure the grid container with a ResizeObserver and pass padSize as a CSS variable: padSize = clamp(32, floor(min((W - axisW)/8, (H - headerH - footerH)/8)) - gap, 72). Keep label font sizes fixed and hide secondary labels when pads are small. Size the timeline to its content (toolbar + ruler + lanes x row height, capped at about 40% of the body), give the grid a minimum size, and add a draggable, remembered splitter with a collapse control. Remove the invisible blur and glow layers and fit the hardware frame to the pad matrix. Add a Playwright check at 1366x768 and 1600x1000 that all 64 pads and the state bar are inside the viewport.

**Invariants / canon.** Desktop-only: size by measurement, not responsive breakpoints. The timeline must still fill its container width and show all streams (invariant 4, timeline rules).

**Source findings:** [F1-V02](#f1-v02), [F2-04](#f2-04), [F4-10](#f4-10), [F7-03](#f7-03), [X1-01](#x1-01), [X1-02](#x1-02), [F1-21](#f1-21), [X1-15](#x1-15)

<a id="t05"></a>
### T05 — The timeline transport toolbar pushes LOOP, CLICK, SOUND and '✕ REGION' off-screen

**Severity:** high · **Kind:** visual-layout · **Effort:** S · **Flows:** F7, X1 · **Depends on:** —

**Problem.** The timeline toolbar is one non-wrapping row inside an overflow-hidden panel. At 1366x768 (and at 1440 for SOUND), LOOP, CLICK and SOUND render past the panel edge and can't be clicked. At 1600x1000, adding a loop region pushes '✕ REGION' out and makes '7 sounds' and '▶ PLAY' wrap. On common laptop screens performers lose their rehearsal controls unless they collapse both side panels.

**Root cause.** UnifiedTimeline.tsx:573 (the toolbar row), 591-593, 626-635, 664-708. PerformanceWorkspace.tsx:667 makes the centre column overflow-hidden.

**Recommendation.** Split the toolbar in two. A transport cluster always stays visible: Play/Stop, Return, position, Speed, Loop, Metronome, Hits, as fixed-width icon-plus-label buttons with whitespace-nowrap. A secondary cluster (sound count, Import MIDI, zoom, clear region) moves into an overflow menu when the measured width is short. Add a test that every transport button can be clicked at 1366x768 with default panel widths.

**Invariants / canon.** Desktop-only: measure the width; no breakpoints. The Pattern Composer tab must stay in the same bottom drawer (invariant 3).

**Source findings:** [F7-02](#f7-02), [X1-03](#x1-03)

<a id="t06"></a>
### T06 — The pad context menu and other overlays render inside transformed containers, and modals lack dialog behaviour

**Severity:** critical · **Kind:** bug · **Effort:** S · **Flows:** F2, F5, X2 · **Depends on:** —

**Problem.** Right-clicking a pad opens PadContextMenu inside the scaled, backdrop-filtered grid wrapper, which becomes the containing block for position:fixed. The menu appears about 490px to the right, scaled down and clipped; for pads in columns 3 and up it is effectively invisible. It also ignores Escape. This menu is the only UI for placement locks and the most complete finger-preference control, so locks are unreachable. The same bug traps the 'Enlarge' difficulty chart and the 'View all' candidates overlay inside the ~270px right panel. Learn More, Compare and View all have no role=dialog, no focus trap, no Escape and no focus return.

**Root cause.** InteractiveGrid.tsx:917-925 renders the menu inside the grid. PerformanceWorkspace.tsx:642-644 applies .glass-panel-blur (backdrop-filter) plus transform: scale (index.css:137-138). PadContextMenu.tsx:43-56, 79-82 clamps in untransformed coordinates. EventCostChart.tsx:277-329 and LayoutOptionsPanel.tsx:243-263 are not portaled; LearnMoreModal.tsx:80-83 already fixed the same bug with a portal. CompareModal.tsx:71-80, 96-133 has fallback states with no close control.

**Recommendation.** Build one shared Dialog/Popover primitive. It portals to document.body, sets role=dialog or menu, aria-modal and aria-labelledby, traps focus, closes on Escape and outside click, and returns focus to the trigger. Use it for PadContextMenu (positioned from clientX/Y), the enlarged chart, View all, Compare and Learn More. Separately, give locks an always-visible entry point: a lock toggle in the Sounds row and in the pad inspector (T45, T28).

**Invariants / canon.** Explicit placement locks are the canonical hard placement rule, so they must be reachable. Learn More must stay available and in sync (invariant 2).

**Source findings:** [F2-02](#f2-02), [X2-01](#x2-01), [F5-16](#f5-16), [X2-V04](#x2-v04), [X2-03](#x2-03)

<a id="t07"></a>
### T07 — Selecting an event turns the feasibility verdict into a false 'Feasible · All events playable'

**Severity:** critical · **Kind:** bug · **Effort:** S · **Flows:** F2, F4, F5, X2 · **Depends on:** —

**Problem.** Whenever an event is selected (Events list, timeline pill, pad click, arrow key), both analysis panels pass diagnostics and counts as undefined. The badge then defaults to a green 'Feasible · All events playable', directly under 'SCORE 0% · UNPLAY 22'. Even an event whose own hand reads 'Unplayable' with cost Infinity shows green. At the same time the ergonomics block switches to a 3-factor fallback without Alternation, and 'Main burden' and Difficulty disappear. A performer stepping through the song gets a false all-clear on exactly the moments they are checking.

**Root cause.** PerformanceCostsPanel.tsx:155-164 and ActiveLayoutSummary.tsx:235-244 pass diagnostics, hardCount and unplayableCount as undefined in event mode. CostBreakdownBars.tsx:36-45 defaults to level='feasible' when unplayableCount is undefined. The fallback factor rows (CostBreakdownBars.tsx:113-132) omit Alternation. Unmapped and unplayable notes carry an all-zero costBreakdown.

**Recommendation.** Keep the whole-layout verdict pinned in place, and never derive it from missing data: show 'Unknown' rather than 'Feasible'. Show the selected moment in a separate 'Selected moment' card with its own verdict from assignment.difficulty (Easy/Medium/Hard/Unplayable) and all five canonical factors via FACTOR_META (T20). Add a unit test: an unplayable layout with an event selected never renders 'Feasible'.

**Invariants / canon.** The 5 canonical DiagnosticFactors must stay factorized, including per event. Clear feasibility verdicts are an engine touchpoint in the contract.

**Source findings:** [F5-01](#f5-01), [X2-02](#x2-02), [F4-04](#f4-04)

<a id="t08"></a>
### T08 — Compare shows wrong or dead-end content: a zeroed-out Active Layout, self-compare, and a fallback screen that can't be closed

**Severity:** critical · **Kind:** bug · **Effort:** M · **Flows:** F3, F5, F10 · **Depends on:** —

**Problem.** Whenever a draft exists, which is always the case after Generate, Compare replaces the Active Layout with a zero stub: empty grid, score 0, 'Easy', all tradeoffs 0. It then declares one side '13% easier'. The compare selection lives in local state and is never pruned. After a ticked candidate is deleted or promoted, 'Compare (2)' stays enabled and the modal compares a candidate with itself ('No differences'). After a regenerate, or a promote from inside the modal, it falls back to a full-screen 'Not enough candidates to compare.' panel with no close button that ignores Escape. Rank numbers also shift after a delete. Compare is a first-class workflow step, and here it gives misleading verdicts or traps the user.

**Root cause.** CompareModal.tsx:24-48 builds a zero stub when getAnalysisForLayout(activeLayout) is null, because projectState.ts:285-299 caches only one analysis. PadGrid.tsx:54 ignores its layout prop and draws only from assignments. candidateComparator.ts:23-24, 101-104 computes deltas against the zeros. PerformanceWorkspace.tsx:308, 498-514 keeps selectedForCompare in local state and never prunes it. CompareModal.tsx:57-69 sets rightIdx = min(1, len-1); 71-79 is a fallback with no close control; 82-88 keeps the modal open after promote. LayoutOptionsPanel.tsx:195 uses rank = index + 1.

**Recommendation.** Cache analysis per layout hash so Active keeps its last fresh plan, or evaluate any side without a fresh plan when Compare opens (as analysis-only state, with 'Analysing Active…'). Never render a stub; show 'Couldn't analyse' instead. Make PadGrid draw pads from the layout and overlay the assignments. Derive the compare set from current ids and prune it on SET_CANDIDATES, delete and promote. Disable Compare below 2 distinct valid layouts. Give candidates labels that stay stable for the session. After a promote inside the modal, either close with a toast or re-point to 'New Active vs <other>'. Every modal state gets a close button and Escape via the T06 Dialog.

**Invariants / canon.** Compare is read-only; anything computed for it is analysis-only state. Do not remove candidate comparison or baseline-relative diff summaries.

**Source findings:** [F5-02](#f5-02), [F10-02](#f10-02), [F3-14](#f3-14), [F5-03](#f5-03), [F10-12](#f10-12)

<a id="t09"></a>
### T09 — The moment view on the grid is broken: onion skin has no effect, next strikes are invisible, struck pads lose their identity, and nothing looks ahead during playback

**Severity:** critical · **Kind:** bug · **Effort:** M · **Flows:** F4, F7 · **Depends on:** T24

**Problem.** With an event selected, an inline style forces every other pad to 0.2 opacity in greyscale. That overrides the previous-event class, and the ghost overlay only renders on empty pads, so the Onion skin toggle changes nothing. Next-event pads get a dashed border that is greyed out as well. Transition arcs only draw when the same finger strikes different pads, which the engine's one-finger-per-sound rule almost never produces, so 'who moves where next' is never shown. Struck pads swap the sound's colour and name for the hand colour and 'L3', which erases the layout context. The onion toggle is an unlabeled 20px icon in the Events tab header, and 'Arrows' is a separate toggle under the grid. During playback nothing previews the next pad or finger at all.

**Root cause.** InteractiveGrid.tsx:528, 537, 635, 642, 666 (inline opacity 0.2 beats the 'opacity-60' class); 698-703 (ghost only when isPrevious && !voice); 648-666 and 705-709 (the name is replaced by the finger code); 212-263 and 817-829 (arc label computed but never drawn). selectionModel.ts:99-115 sets fromPad only when the same finger strikes in the current moment. EventsPanel.tsx:236-248 holds the onion toggle. InteractiveGrid.tsx:338-371 provides only a strike blink during playback.

**Recommendation.** Rebuild the moment view around strikes. Current strikes keep the sound's colour and short name, plus a hand-coloured ring and a finger badge. Next-moment strikes get a dashed hand-coloured outline, the finger label and a '+1' tag; previous strikes get a faint outline and '-1'. Other pads dim to about 45% without desaturation. Draw next-move arrows from each finger's (or hand's) last known pad, searching backwards. Replace both toggles with one labelled segmented control in the grid header, 'Now | Now + Next | Prev · Now · Next' (shortcut O, aria-pressed). Reuse the same overlay during playback, driven by the playhead (T10). Update the Learn More onion description to match.

**Invariants / canon.** Invariant 2: Learn More must match the onion and transition behaviour. Hand+finger labels read 'L2', never just '2'. The 'Show Finger Assignment' toggle must keep showing solver fingering.

**Source findings:** [F4-01](#f4-01), [F4-02](#f4-02), [F4-16](#f4-16), [F7-06](#f7-06), [F4-11](#f4-11)

<a id="t10"></a>
### T10 — Event selection and the transport are disconnected: a selection freezes the grid during playback, the playhead ignores the selection, and a paused grid is blank

**Severity:** critical · **Kind:** bug · **Effort:** M · **Flows:** F4, F7 · **Depends on:** T24, T09

**Problem.** PLAY doesn't clear or override the selected event. After any use of the Events list, a pill, the chart or the arrow keys, the grid stays frozen on that moment in 20% greyscale while the playhead moves on, and pad flashes are suppressed. Selecting a moment doesn't move the playhead, so PLAY starts from 0:00. There is no 'Play from here', 'Loop this bar' or 'Practise at 50%' in the Events list, the inspector or the chart. When playback stops mid-phrase the grid shows nothing, and clicking the ruler while stopped moves only the red line. There is no path from 'this moment is hard' to rehearsing it.

**Root cause.** InteractiveGrid.tsx:513, 537, 642, 666 set isGreyedOut = hasEventSelected && !isSelected whether or not playback is running; 632 skips the blink for selected pads; 338-371 marks pads only inside a 90ms strike window and clears them when stopped. TOGGLE_PLAYING only flips isPlaying (projectState.ts:1304-1305). EventsPanel.tsx:147-160 dispatches SELECT_EVENT and uses SET_CURRENT_TIME only as a fallback. UnifiedTimeline.tsx:528-542.

**Recommendation.** Define one 'current moment'. When stopped, it is the selected moment, and a ruler click snaps the selection to the moment at the playhead. When playing, it follows the playhead; the selection overlay is suspended and comes back on STOP. Selecting a moment moves the playhead there. Add a 'Rehearse' action on Events rows, the moment inspector and chart bars: it sets a bar-snapped loop around the moment (its bar plus one), optionally lowers the speed, and starts playback.

**Invariants / canon.** Clicking a timeline note must still highlight all notes of that moment. Speed stays rehearsal-only and never changes layout or analysis.

**Source findings:** [F7-01](#f7-01), [F4-15](#f4-15), [F7-V02](#f7-v02), [F7-07](#f7-07)

<a id="t11"></a>
### T11 — Beam and Annealing generation ignore placement locks and finger preferences, and manual drags ignore locks

**Severity:** critical · **Kind:** bug · **Effort:** M · **Flows:** F2, F3 · **Depends on:** —

**Problem.** With a sound locked, Beam or Annealing Generate moved it, put another sound on the locked pad and removed every lock from the applied draft, because each candidate is seeded from a fresh pose0 layout. Thorough (deep annealing) also ignores the user's finger preferences, while Beam and Greedy honour them. In manual editing 'Lock to this pad' locks nothing. A locked pad can be dragged anywhere and the lock moves with it. Dropping another sound on a locked pad evicts the locked sound and silently deletes the lock. The lock mark is an 8px emoji. The one hard placement rule the canon defines is not enforced.

**Root cause.** useAutoAnalysis.ts:327-337 always passes createDefaultPose0(), so multiCandidateGenerator.ts:260-279, 356-378 takes the pose0-offset branch. seedFromPose.ts:77-87, 123-141 returns placementLocks: {} and never reads existing placements. multiCandidateGenerator.ts:434-445 runs the annealing solve without manualAssignments (the beam branch passes them at 456). In manual editing, projectState.ts:766-772, 803-818, 820-844 move the lock with a swap and delete it on replace or remove. Lock rendering: InteractiveGrid.tsx:738-745, VoicePalette.tsx:580.

**Recommendation.** Seed Beam and Annealing candidates from the displayed layout, or at minimum pre-place locked sounds. Carry placementLocks through seeding, compaction and mutation, and post-validate every candidate (each locked sound on its pad), dropping failures with a stated reason. Pass manualAssignments or soft preferences into annealingSolver.solve, and show 'N finger preferences kept / relaxed' on each card. In manual editing, a locked pad refuses drags and drops with the tooltip 'Locked. Unlock to move'. Locks stay hard for manual edits (canon §11) unless the product owner explicitly chooses a Generate-only pin. Draw a clear lock glyph outside the name area. Add a regression test with a lock for all three methods.

**Invariants / canon.** Explicit placement locks are the hard rule; hand/finger preferences stay soft. The Solver Change Checklist applies: trace shape, seed=0 determinism, restart behaviour, isProcessing reset, and 0 unplayable events on TEST MIDI 1 for beam, annealing and greedy (testMidi1Integration.test.ts).

**Source findings:** [F3-01](#f3-01), [F3-V05](#f3-v05), [F2-08](#f2-08)

<a id="t12"></a>
### T12 — Discard leaves stale derived state: invisible ghost locks in the Active Layout and out-of-date finger constraints

**Severity:** high · **Kind:** state-safety · **Effort:** S · **Flows:** F2, F8, F10 · **Depends on:** —

**Problem.** Discard merges the draft's locks into the Active Layout without pruning them, so a lock set at a draft position survives, pointing at a pad the sound doesn't occupy in Active. No UI shows it, because lock indicators only draw when the sound sits on the locked pad. The next Generate still drags the sound back to the abandoned pad, so Discard has in effect edited the Active Layout. Discard and the other layout switches also never re-derive the layout's fingerConstraints from project-level voiceConstraints. The Sounds chip and the pad then show a preference the solver no longer uses, or the reverse.

**Root cause.** projectState.ts:925-948: DISCARD_WORKING_LAYOUT merges preservedLocks without calling prunePlacementLocks, unlike 777, 815 and 841. This contradicts projectState.ts:97 ('Changed only by explicit Promote'). InteractiveGrid.tsx:536 and VoicePalette.tsx:200 draw a lock only when the sound is on the pad. useAutoAnalysis.ts:94-99: the solver reads only the layout's fingerConstraints. projectState.ts:694-721.

**Recommendation.** On Discard, keep only locks whose sound sits on the locked pad in Active. For the rest, ask ('Keep the lock of Kick at (3,3)? This changes your Active Layout') or drop them. Re-derive fingerConstraints from voiceConstraints on every layout switch (Discard, Promote, Preview, Load), or have the solver read voiceConstraints directly. Decide explicitly whether Discard also reverts preferences set during the draft. Add a small Locks list so orphaned locks are visible. Add reducer tests for both cases.

**Invariants / canon.** The Active Layout changes only through Promote. Invariant 6: voiceConstraints is the single source of truth, and pad fingerConstraints must stay in sync with it automatically.

**Source findings:** [F2-V01](#f2-v01), [F10-V02](#f10-v02), [F8-V02](#f8-v02)

<a id="t13"></a>
### T13 — The two Promote paths behave differently, and both can lose work

**Severity:** high · **Kind:** state-safety · **Effort:** S · **Flows:** F3, F10 · **Depends on:** T01

**Problem.** After a preview, the toolbar Promote re-solves the layout with the beam analyzer. The fingering the user just reviewed changes (4 of 7 sounds in the probes, score 95% to 94%), the candidate stays in the list as a duplicate, the '(draft)' name is kept, and nothing asks for confirmation. The card's Promote asks first, removes the card and keeps the reviewed plan. Promoting a candidate or a saved variant also sets workingLayout to null, which throws away an unrelated hand-edited draft without saving it as a variant.

**Root cause.** PROMOTE_WORKING_LAYOUT (projectState.ts:950-985) sets analysisStale true, keeps the candidates and keeps the name. PROMOTE_CANDIDATE (987-1031) rebinds the plan and removes the candidate. projectState.ts:1017-1021 and 1107-1111 set workingLayout: null. WorkspaceToolbar.tsx:175-181.

**Recommendation.** Route every Promote through one action. If the promoted pad map matches a candidate's hash, promote it as that candidate: rebind its reviewed Execution Plan and remove or mark the card. Use the same confirmation and undo toast (T31) and the same naming (T32) everywhere. If a draft differs from both Active and the promoted item, auto-save it as a variant ('Draft – 14:02') and say so in the promote toast.

**Invariants / canon.** Promote is the normal path to a new Active Layout, and the replaced Active is auto-saved as a variant (keep this). Execution Plans are layout-bound, so staleness detection must still work after rebinding.

**Source findings:** [F3-13](#f3-13), [F10-05](#f10-05), [F10-V01](#f10-v01)

<a id="t14"></a>
### T14 — Analysis freshness is signalled wrongly: 'outdated' fires on non-changes, and real changes go unmarked

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F2, F5, F8, F9, F10 · **Depends on:** T01

**Problem.** After every pad edit, 'Analysis outdated' flashes for under a second in three places. The summary briefly falls back to the empty-state text 'Assign sounds to pads, then Generate to analyze' and 'Click Generate to create candidate layouts'. Edits that change only identity (rename, recolour, group, reorder), a drag dropped back on its own pad, and simply opening the Composer tab all mark the analysis stale. The no-op drag even creates a Working/Test Layout, which makes Promote and Discard appear. In the other direction, toggling a placement lock hides the Execution Plan for good: finger codes and the cost summary disappear, and auto-analysis never runs again. And with a candidate selected, a mute, solo or tempo change leaves its old plan on screen while the hidden re-analysis clears the stale flag.

**Root cause.** UnifiedTimeline.tsx:64-68 with lanesReducer.ts:78-87, 375-385: SYNC_STREAMS_FROM_LANES sets analysisStale for identity edits and on remount. projectState.ts:235-237 defines hasWorkingChanges as workingLayout !== null. updateWorkingLayout (projectState.ts:452-465) always forks a draft and marks stale. InteractiveGrid.tsx:434-446 turns a drop on the source pad into ASSIGN_VOICE_TO_PAD. TOGGLE_PLACEMENT_LOCK (projectState.ts:891-916) doesn't set analysisStale, although hashLayout includes locks (mappingResolver.ts:186-195). getDisplayedCandidate (projectState.ts:301-303) doesn't check freshness. Display: WorkspaceToolbar.tsx:203-208, InteractiveGrid.tsx:791-795, ActiveLayoutSummary.tsx:113, 169-218, 374-378.

**Recommendation.** Mark analysis stale only when events, analysis scope, tempo, placements, locks or constraints change, and make SYNC_STREAMS_FROM_LANES a no-op when the streams haven't changed. Set analysisStale in TOGGLE_PLACEMENT_LOCK, or leave locks out of the Execution Plan freshness hash. Compute 'has changes' as hashLayout(working) !== hashLayout(active), and drop an empty draft. While a re-solve is pending, keep the previous numbers dimmed and show 'Updating…' only if it takes longer than about 1.5s, instead of the empty state. When performance inputs change, mark the candidates stale or re-evaluate them. Tests: a rename does not mark the analysis stale, and a lock toggle brings the plan back.

**Invariants / canon.** Execution Plans are layout-bound with staleness detection (a key test invariant). Don't hide stale state behind UI patches; fix the invalidation rules.

**Source findings:** [F10-11](#f10-11), [F5-V03](#f5-v03), [F8-V03](#f8-v03), [F9-19](#f9-19), [F2-V05](#f2-v05), [F10-V04](#f10-v04), [F2-07](#f2-07)

<a id="t15"></a>
### T15 — Mute and Solo silently narrow the analysis, and Generate deletes muted sounds from the layout

**Severity:** high · **Kind:** state-safety · **Effort:** M · **Flows:** F3, F7, F8, X2 · **Depends on:** —

**Problem.** 'M' and 'S' look like DAW audition controls, but muted streams are dropped from the performance that the solver, Suggest and Generate work on. Muting a sound to hear the rest makes its pad's fingering and hit count vanish. Soloing one sound to learn it re-analyses a one-sound performance ('Score 100%'). Muting the 5 unplaced sounds of a 2-of-7 layout turned 'Infeasible 0%' into a green 'Feasible 75%'. No analysis panel says that sounds are excluded. Generating while a sound is muted deletes that sound's pad from the applied layout, and the score looks better for it. Mute and Solo also bump updatedAt, enter the undo history and trigger re-analysis.

**Root cause.** getActiveStreams / getActivePerformance filter out muted streams (projectState.ts:57-59, 192-206, 240-242). TOGGLE_MUTE and SOLO_STREAM (614-650) set analysisStale and updatedAt and are missing from EPHEMERAL_ACTIONS (395-416). Candidates are built only from sounds that have events (seedLayoutFromPose0 and the greedy seed features), and APPLY_GENERATION_TO_LAYOUT then replaces the whole working layout.

**Recommendation.** Split the two concepts. Audition Mute/Solo is session-only and audio-only: it stays out of undo and never touches analysis or the layout. 'Exclude from analysis' becomes an explicit action in the row menu, with a persistent badge and a scope line on every verdict ('Analysing 5 of 7 sounds · 2 excluded'). Generation never drops a sound that is already placed: excluded sounds stay pinned to their pads, and the cards say so.

**Invariants / canon.** Invariant 4 (timeline completeness): muted or excluded streams stay visible with a distinct style. Invariant 7: Generate must not silently remove placements.

**Source findings:** [F7-10](#f7-10), [F8-02](#f8-02), [X2-V01](#x2-v01), [F3-V01](#f3-v01)

<a id="t16"></a>
### T16 — Muted pads can't be edited, and Solo doesn't behave like a DAW's

**Severity:** medium · **Kind:** bug · **Effort:** S · **Flows:** F2, F8 · **Depends on:** T15

**Problem.** A muted sound's pad gets pointer-events:none, 30% opacity and draggable=false. It can't be moved, swapped, removed, right-clicked or dropped onto, so Solo freezes every pad but one, and nothing explains why. Solo has no lit state, so nothing shows which sound is soloed. While a solo is active, clicking 'M' on another sound does nothing. Un-soloing un-mutes everything, including sounds the user had muted beforehand.

**Root cause.** InteractiveGrid.tsx:641, 645, 668-677 give muted pads pointer-events none, draggable false and no context menu. SOLO_STREAM (projectState.ts:631-650) marks every other sound muted. lanesToStreams.ts:24, 47-49 computes muted = !(isSolo && !isMuted). The S buttons have static classes (VoicePalette.tsx:609-618, UnifiedTimeline.tsx:1062-1068).

**Recommendation.** Keep muted pads fully editable: mark them with a small speaker-off glyph, reduced saturation and the tooltip 'Muted: silent in rehearsal'. Make mute and solo independent per-sound flags, with audible = (any solo set) ? soloed : !muted. Light Solo yellow and Mute red, with aria-pressed. Support Alt-click for exclusive solo.

**Invariants / canon.** Muted streams stay visible in the timeline (invariant 4).

**Source findings:** [F2-17](#f2-17), [F8-13](#f8-13), [F8-05](#f8-05)

<a id="t17"></a>
### T17 — Imported Sounds all look alike (one amber colour, numbered names, truncated pad labels) and are hard to rename

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F1, F2, F8, X1, X2 · **Depends on:** —

**Problem.** Every Sound from a MIDI import gets the same group colour (#f59e0b) and a name made of the file name plus the pitch's rank ('TEST MIDI 1 1' to '1 7'). MIDI track names and note names are thrown away. Pad labels are cut at 11px down to the shared prefix, so every placed pad reads 'TEST M…' in the same amber on the grid, the timeline, the candidate mini-grids and Compare. The only remedy is to rename each sound by double-clicking an unfocusable span, which nothing hints at (after committing, Tab goes to the finger chip, not the next name), and to recolour through a 10px swatch. Manual arranging, onion skin, Compare and cost reading all turn into guesswork.

**Root cause.** useLaneImport.ts:17-20, 60-62, 79-92: GROUP_COLORS is indexed by state.laneGroups.length, which is always 0; names are `${displayName} ${i+1}`; colorMode is 'inherited'. midiImport.ts:62-66, 89-112, 165-172 already builds distinct VOICE_COLORS and note-name voices, which go unused, and never reads track.name. InteractiveGrid.tsx:629, 713-716 truncates at text-[11px]. VoicePalette.tsx:568-574 renames only on double-click, and the tooltip is just the name.

**Recommendation.** Give each new Sound a distinct colour from a 12-16 hue colour-blind-safe palette, continuing from the colours already in the project (colorMode 'custom'); keep the group colour as an optional tint. Default names follow decision Q3: the MIDI track name when a track has one pitch, otherwise the track or file name plus a short sequence letter ('Groove A'); the file name for single-pitch files. Note names appear only as provenance or through an opt-in 'Name from GM drum map' action. On pads, show an optional 4-6 character short label, or trim the prefix all sounds share and truncate in the middle; allow two lines. Add a pencil on hover and F2/Enter to rename; Enter or Tab moves to the next Sound's name.

**Invariants / canon.** Invariant 5: pitch and note names are provenance metadata and never drive placement; bottomLeftNote stays 36. Keep the current behaviour where a rename or recolour reaches every surface.

**Source findings:** [F1-01](#f1-01), [F1-02](#f1-02), [F2-05](#f2-05), [F8-01](#f8-01), [X1-05](#x1-05), [X2-V06](#x2-v06), [F8-08](#f8-08), [F1-16](#f1-16), [F8-14](#f8-14)

<a id="t18"></a>
### T18 — MIDI pitch is used as a fallback identity, merging sounds and matching Composer lanes to pads

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F8, F9 · **Depends on:** —

**Problem.** When an event's sound has no pad, the mapping resolver falls back to looking it up by pitch. Finger preferences and the stream lookup are keyed by pitch too. With multi-file imports, which are common, or with Composer lanes whose default pitches repeat after 8 lanes, an unplaced sound is 'played' on another sound's pad and inherits its fingering, so the analysis looks better than it is. The Composer's 'Pad' column, the pads Save Preset captures, and which sound a placed preset pad plays are all resolved by comparing lane.midiNote with originalMidiNote.

**Root cause.** mappingResolver.ts:84-100 (pitch fallback in resolveEventToPad). useAutoAnalysis.ts:103-123 (constraints keyed by noteNumber). soundStreamLookup.ts:8-39 (returns the first stream with this pitch). WorkspacePatternStudio.tsx:30, 102-117, 293-296. PerformanceWorkspace.tsx:254 (originalMidiNote: lane.midiNote ?? 36).

**Recommendation.** Resolve events, finger constraints, pads and Composer lanes strictly by Sound identity (voiceId). A sound with no pad is unmapped even when another sound shares its pitch. Remove the pitch fallbacks from soundStreamLookup, constraint mapping and the Composer lookups, and keep pitch only as export metadata. Add a test: two sounds share a pitch and one is unplaced, so its events are unmapped.

**Invariants / canon.** Invariant 5 (MIDI pitch independence) and stable Sound identity (engine contract). Voice IDs must survive clone, promote, variant save and discard (key test invariant).

**Source findings:** [F8-V01](#f8-v01), [F9-18](#f9-18)

<a id="t19"></a>
### T19 — Finger preference controls: a stray click commits the solver's suggestion, and three different controls use three notations

**Severity:** high · **Kind:** state-safety · **Effort:** S · **Flows:** F2, F8 · **Depends on:** —

**Problem.** Clicking the dimmed solver suggestion in a Sounds row opens a 2-character editor pre-filled with that suggestion, and blur commits it. So a click followed by a click elsewhere silently turns the suggestion into the user's own preference, creates a Working/Test Layout and re-runs analysis. Preferences can be set in three places with three notations. The Sounds row has a typed 'L2' field that silently ignores invalid input. The context menu, which is unreachable (T06), has a 10-item 'Finger Constraint' list whose wording sounds binding. The Selected Event panel has Hand L/R and TH/IN/MI/RI/PI buttons, where choosing a hand forces the index finger, so a hand-only preference is impossible. The chip shows only the sound's first solver assignment even when later hits use a different finger.

**Root cause.** FingerAssignmentInput.tsx:120-123 (on click, editText = displayValue), :100 (onBlur commits), :63-75 (invalid input silently reverts), 21-33, 124-130. PadContextMenu.tsx:19-30, 118-140. ActiveLayoutSummary.tsx:282-339 (at 308 the hand button defaults the finger to 'index'). VoicePalette.tsx:130-146 (the first assignment wins), 596.

**Recommendation.** Build one reusable 'Hand & finger preference (soft)' control: Left / Any / Right plus Thumb…Pinky / Any, with 'Auto (solver)' and an explicit 'Accept suggestion'. It opens empty with the suggestion as a placeholder; blur or Escape without typing changes nothing; invalid typed input is flagged inline. Use it in the Sounds row popover, the pad inspector, the Selected Event panel and the Composer. Show 'L2/L3' or 'mixed' when the plan uses more than one finger.

**Invariants / canon.** Invariant 6: a change in any panel reaches all others through voiceConstraints. UI rule: with no user constraint, the Sounds panel shows the solver suggestion at reduced opacity, and the '(XX)' text format must not be used. Hand/finger preferences are soft.

**Source findings:** [F2-V02](#f2-v02), [F8-03](#f8-03), [F2-16](#f2-16), [F8-16](#f8-16)

<a id="t20"></a>
### T20 — Engine vocabulary leaks into the UI: raw ids and keys, and each cost factor has 3-7 names and two colour schemes

**Severity:** high · **Kind:** copy-terminology · **Effort:** M · **Flows:** F5, F8, X1, X2 · **Depends on:** —

**Problem.** Compare lists 'Affected sounds: lane_1790132122139_xv1rsk, …' and reports '9 pads differ · 9 voices moved' for a 7-sound project: it counts pads, calls them voices, and 'voice' isn't a canonical term. 'Main burden: transition, gripNaturalness' prints engine keys under bars labelled Movement and Grip. Learn More's Constraints tab shows code keys (span, thumbDelta). The five factors appear as Grip / Grip Quality / gripNaturalness / Stretch / Finger Pref; Movement / Transition / Transitions; Alternation / Repetition / Finger Repetition; Balance / Hand balance; Constraints / Hard Constraints. Alternation and Balance also swap colours between the ergonomics bars and the difficulty chart on the same tab.

**Root cause.** CandidateCompare.tsx:84-91 joins raw voiceIds. CompareGridView.tsx:152-167 counts pad keys as 'voices moved'. CostBreakdownBars.tsx:88-111, 167-171 print raw topContributors keys and colour Alternation #22c55e, Balance #3b82f6. EventCostChart.tsx:40-46 swaps those colours. Labels are defined separately in types/diagnostics.ts:331-344, LearnMoreModal.tsx:19-45, the CandidatePreviewCard 'Top:' line and the SettingsGear toggles.

**Recommendation.** Create one FACTOR_META registry in src/ui/analysis, keyed by the 5 canonical DiagnosticFactors, holding label, short label, colour, a one-line description and polarity. Use it in CostBreakdownBars, EventCostChart, EventsPanel, CandidatePreviewCard, SettingsGear, Compare, the trace and LearnMoreModal. Resolve every voiceId to the Sound's name and colour chip. Phrase diffs as '6 sounds moved (9 pads changed)' with per-sound moves ('● Kick (3,3) → (4,2)'). Map constraint keys to plain-language labels.

**Invariants / canon.** Invariant 2: Learn More must use the same factor definitions and stay in sync. Say 'Sound', never 'voice', in user-facing copy. Keep the 5 factors factorized.

**Source findings:** [X2-04](#x2-04), [F5-05](#f5-05), [F8-07](#f8-07), [X2-V05](#x2-v05), [F5-04](#f5-04), [X1-07](#x1-07), [X2-05](#x2-05)

<a id="t21"></a>
### T21 — No coherent cost story: competing score scales, and before/after Generate is measured by different evaluators

**Severity:** high · **Kind:** confusing · **Effort:** L · **Flows:** F3, F5, F9 · **Depends on:** T20

**Problem.** One layout can show 'Score 95%', 'SCORE 95.1', 'Playability 87', a difficulty word from a separate overallScore, an optimizer 'cost 25.87', unitless factor sums and a per-moment '0.374'. Polarity differs too: 'Balance 0' is lower-is-better, while Compare's 'Hand Balance 100' is higher-is-better. Cards show both % and cost, which rank candidates differently (#3 has cost 50.29 and 91%, #4 has cost 48.68 and 86%). The preset inspector adds a third, pad-position-only 'Metric Breakdown' with developer wording. Worse, Suggest, manual edits, Beam and toolbar Promote are scored by the beam analyzer, while Greedy candidates show the greedy optimizer's own plan. Part of the 'improvement' after Generate is therefore just a change of units.

**Root cause.** ui/analysis/planScore.ts:1-3; engine/evaluation/planScore.ts:46-58; CompareModal.tsx:189-218; difficultyScoring.ts:143-161; CandidatePreviewCard.tsx:145-149; PresetInspector.tsx:127-135, 304-381. Greedy candidates carry greedy plans, while APPLY_GENERATION_TO_LAYOUT triggers a hidden beam re-analysis (useAutoAnalysis.ts). canonicalEvaluator.ts exists but is not the source of any displayed number.

**Recommendation.** Before display, re-score every layout on screen (Active, draft, candidates, variants, presets) with the canonical evaluator. Adopt one headline, for example 'Playability 0-100, higher = easier', shown as an integer everywhere, plus Hard and Unplayable counts, with factors shown as each one's share of the burden. Move optimizer cost, seed and move count into the trace or an info tooltip. Replace the preset metric breakdown with the canonical evaluator run on the preset's own notes. Compute every 'vs Active' delta from these same numbers.

**Invariants / canon.** Engine contract: one coherent cost story and factorized diagnostics. PerformabilityObjective stays the beam ranking model; don't collapse the factors into one opaque score. Learn More must explain the headline number (invariant 2).

**Source findings:** [F5-06](#f5-06), [F3-09](#f3-09), [F9-11](#f9-11), [F3-V02](#f3-v02)

<a id="t22"></a>
### T22 — Chord moments are counted once per note, so a moment's cost grows with chord size

**Severity:** high · **Kind:** bug · **Effort:** S · **Flows:** F4, F5 · **Depends on:** —

**Problem.** Both solvers attach the whole moment's cost to every note in it. The Events list, the difficulty chart and the greedy selected-event ergonomics then add those copies together, in a variable named 'avg'. A 3-note moment reads as three times its real cost, so every downbeat chord looks like the hardest moment in the piece, and the list's red rows contradict 'Nothing hard or unplayable'. Performers are sent to the chords instead of the genuinely hard moments.

**Root cause.** beamSolver.ts:612-641, 836-866, 1443-1471: each note's costComponents is the full stepComponents. greedyOptimizer.ts:978-986 puts momentCostBreakdown on every note. EventsPanel.tsx:193-219 sums momentCosts, and EventCostChart.tsx:88-104 aggregates the same way.

**Recommendation.** Aggregate once per moment, using the moment-level record or one note's breakdown, in the list, the chart and the inspector. Show the note count as a separate column. Unit test for both solvers: a moment's cost doesn't depend on how many notes it has.

**Invariants / canon.** Difficulty must stay temporal and inspectable per event; keep the factor breakdowns intact.

**Source findings:** [F4-05](#f4-05), [F5-V01](#f5-v01)

<a id="t23"></a>
### T23 — 'Events' means raw notes in some places and moments in others

**Severity:** high · **Kind:** copy-terminology · **Effort:** S · **Flows:** F1, F5, X1, X2 · **Depends on:** —

**Problem.** For TEST MIDI 1, the Library says '48 events', which counts notes. The Events tab and the EVENTS tile say 32, which counts moments. One panel shows 'All 48 events are playable' and 'Nothing hard or unplayable, but 37 events need attention' right next to 'EVENTS 32'. After Generate the same sentence says 'All 32 events'. A partial layout shows 'EVENTS 32' beside '22 unmapped, 22 unplayable of 48 events'. The counts can't be reconciled, which undermines trust in every verdict.

**Root cause.** ContinuePracticingHero.tsx:46-48, 84, 117 and PerformanceCard.tsx:48, 118 show the note count as 'events' (via indexedDbStore). ActiveLayoutSummary.tsx:177-190 and CostBreakdownBars.tsx:180-225 count notes for beam plans and moments for greedy plans.

**Recommendation.** Follow the terminology canon: a Performance Event is a moment everywhere, and individual hits are 'notes'. Library: '7 sounds · 48 notes · 32 events · 8 bars'. Verdicts: '22 of 48 notes can't be played'. Normalise the Hard/Medium/Easy/Unplayable counts to moments for both solvers, and add a test that their sum never exceeds the moment count.

**Invariants / canon.** 'Performance Event' is a canonical term (PUSHFLOW_TERMINOLOGY.md). Library cards must still show an event count (CLAUDE.md library rules); use the moment count.

**Source findings:** [F1-04](#f1-04), [F5-08](#f5-08), [X2-18](#x2-18), [X1-14](#x1-14)

<a id="t24"></a>
### T24 — There is no single moment identity: eventIndex numbers notes in beam plans and moments in greedy plans

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F4, F5 · **Depends on:** —

**Problem.** The selection is stored as a bare number and resolved with assignments.find(a => a.eventIndex === n). Beam plans number notes and greedy plans number moments. So after any re-analysis of a Generate or Preview plan, the inspected moment jumps to a different moment. One moment is '10' in the Events list, 'Event 16 (t=4.500s)' in the cost badge and 'Event 10' on the chart, whose x-axis reads 0/16/31. The Events list groups notes within 25ms, but the grid, stepping and the timeline ring match exact start times, so a played-in chord lights 1 of 3 pads and each list row takes three ←/→ presses. Placeholder pills for muted streams carry per-stream numbers that collide with plan indices, so clicking one selects an unrelated event.

**Root cause.** greedyOptimizer.ts:954, 990 set eventIndex = moment.momentIndex; beamSolver.ts:627-628 set eventIndex = group.eventIndices[i]. EventsPanel.tsx:100 groups with MOMENT_EPSILON 0.025 (performanceEvent.ts:25), while InteractiveGrid.tsx:186-188 and selectionModel.ts:46-58 match exact startTime. Labels differ in ActiveLayoutSummary.tsx:41-51, 241-243 and PerformanceCostsPanel.tsx:161-163. UnifiedTimeline.tsx:362-380, 960 give placeholder pills a per-stream eventIndex.

**Recommendation.** Make both solvers give eventIndex the same meaning, and add an explicit momentIndex. Store the selection as selectedMomentIndex (or as a stable eventKey re-resolved when the plan changes), built from one MOMENT_EPSILON grouping (MomentAssignment[] / buildMomentTransitionModel). Grid, timeline, list, keyboard, chart and inspector all read that. Placeholder pills for excluded streams show 'Excluded — not analysed' and resolve clicks by moment time, so the whole moment is still selected; muted streams are analysed normally (T15). Label moments the same way everywhere ('Event 3 · bar 1.1.3'; see decision Q7).

**Invariants / canon.** UI rule: clicking a timeline note highlights every note of that moment. Unplayable and unassigned events stay visible (invariant 4). If eventIndex semantics change, the Solver Change Checklist applies (UI consumers, trace).

**Source findings:** [F4-03](#f4-03), [F4-V01](#f4-v01), [F5-07](#f5-07), [F4-20](#f4-20), [F4-13](#f4-13)

<a id="t25"></a>
### T25 — Partly placed layouts are presented as failures

**Severity:** high · **Kind:** confusing · **Effort:** M · **Flows:** F2, F5 · **Depends on:** —

**Problem.** As soon as one sound is placed, the whole performance is scored. Unplaced sounds are listed under 'Sounds that cannot be played', and their notes turn red exactly like truly unplayable notes. The header shows 'Score 0%' and '✗ Infeasible: 22 unmapped, 22 unplayable of 48 events', with Movement as the main burden. The Costs tab doesn't even name the missing sounds. There is no '3 of 7 placed' progress and no positive signal for what is simply work in progress.

**Root cause.** ActiveLayoutSummary.tsx:169-191, 223-233, 438-447, 553-554. UnifiedTimeline.tsx:906-908 styles unmapped notes the same as unplayable ones. The empty-grid case is special-cased, but the partly placed case is not.

**Recommendation.** Add an 'unfinished layout' state: '3 of 7 sounds placed · scoring covers the 26 notes you can play so far', with the unplaced sounds listed with drag handles. Score only the placed sounds. Draw not-yet-placed notes in a distinct hatched or outline style. Reserve 'Infeasible' for placed material that can't be played.

**Invariants / canon.** Invariant 4: unplaced and unassigned events stay visible with a distinct style, never hidden. Keep the Strict/Relaxed/Fallback feasibility tiers unchanged for placed material.

**Source findings:** [F2-11](#f2-11), [F5-20](#f5-20)

<a id="t26"></a>
### T26 — Nothing is compared against the baseline: no diff vs Active, diversity measured from the draft, and Compare can't include the draft or variants

**Severity:** high · **Kind:** missing-capability · **Effort:** L · **Flows:** F3, F5, F10 · **Depends on:** T01, T08, T21

**Problem.** Candidate cards show absolute values only: no '+16 vs Active', no 'moves Kick and Snare'. Their mini grid encodes only occupancy and colour. The engine computes a baselineDiff for every candidate, but nothing renders it, and Generate passes the draft as both baseLayout and activeLayout, so diversity is measured from the draft rather than from Active. Compare accepts only Active and candidates: the draft has no card and variants have no checkbox, so 'is my hand-tuned draft better than Active?' can't be answered. Inside Compare the only narrative is 'Overall difficulty is similar. 9 pad assignment(s) differ'. It omits the five factors, the Hard/Unplayable deltas and the per-passage deltas it already computes, and it duplicates its own bars. It leaves about 45% of the modal empty at 1600px and pushes Promote below the fold at 1366px.

**Root cause.** MiniGridPreview.tsx:48-69. greedyCandidatePipeline.ts:328-339 computes baselineDiff, which nothing uses. useAutoAnalysis.ts:165/259, 297-298, 335-336 pass effectiveLayout as both baseLayout and activeLayout. LayoutOptionsPanel.tsx:109-185, 327-402: no draft row, and SavedVariantCard has no checkbox. CompareModal.tsx:57-62, 137-165, 221-242. CandidateCompare.tsx:15-20, 38-96. candidateComparator.ts:26-46 computes passage deltas that are never shown. CompareGridView.tsx:131-150.

**Recommendation.** Pass state.activeLayout as activeLayout and keep the draft as baseLayout. Give every layout row (Active pinned, Draft, Candidates, Variants) a compact score, delta chips against Active (score change, Hard/Unplayable change, biggest factor change, sounds moved) and a compare checkbox. Draw the diff on mini grids: outlined moved pads, a lock glyph, sound initials. Replace the Compare body with a 'What changed' table: Playability, Hard, Unplayable, the 5 factors (FACTOR_META), per-sound moves and per-passage deltas, in A | B | Δ columns with the change in words. Centre larger grids, style 'moved' and 're-fingered' differently, and keep the actions in a sticky footer.

**Invariants / canon.** Canon workflow step 7: compare the Active Layout, Working/Test Layout, candidates and variants. Engine contract: diversity is measured relative to the Active Layout. Compare stays read-only. A real candidate must show at least one unlocked placement change or a materially different tradeoff profile.

**Source findings:** [F3-08](#f3-08), [F10-V03](#f10-v03), [F5-10](#f5-10), [F5-11](#f5-11), [F5-22](#f5-22), [F10-09](#f10-09)

<a id="t27"></a>
### T27 — The Events list and moment inspector don't help find or understand hard moments

**Severity:** high · **Kind:** missing-capability · **Effort:** M · **Flows:** F4, F5, F8 · **Depends on:** T22, T24, T20

**Problem.** Each event row shows only an index, bar.beat, a raw cost and 'Nn', not which sounds or fingers are played, even though the component already computes sound names and colours. Row colours use fixed thresholds (above 10 red, above 5 amber) unrelated to the plan's Easy/Medium/Hard/Unplayable classes, and unplayable moments print 'Infinity'. 'N events need attention' is plain text. The engine's explainEvent, explainTransition and identifyHardMoments are never used, so there is no 'why is this hard', no sorting or filtering by difficulty, and no jump to the next hard moment. Moment detail lives only in the right panel's Layouts tab and covers only the first note of a chord, looked up by MIDI pitch. Expanded rows swallow clicks, so the row can't be selected.

**Root cause.** EventsPanel.tsx:31-37, 57-69 compute the sounds, but 315-341 don't render them. EventsPanel.tsx:298-301, 332 hold the thresholds and print Infinity. EventsPanel.tsx:296, 329, 345: per-row expansion state and a stopPropagation on the breakdown. The 'need attention' text is in CostBreakdownBars.tsx. src/engine/analysis/eventExplainer.ts:1-50, 131 has no UI consumer. PerformanceWorkspace.tsx:744-763 and ActiveLayoutSummary.tsx:41-51, 85, 269-292 hold the inspector.

**Recommendation.** Row layout: bar.beat.sub · sound chips · finger chips (L1 R2) · a difficulty badge in the same colours as the timeline borders. Put the number in a tooltip and show an 'Unplayable' badge instead of Infinity. Group rows under bar headers. Add filter chips All / Medium+ / Hard / Unplayable and Prev/Next hard buttons with keyboard shortcuts. Make 'N need attention' a button that applies that filter. Dock a moment inspector next to the list or under the grid: it lists every strike in the moment, with a one-line explainEvent verdict and an explainTransition sentence. A click anywhere on a row selects it; only one row expands at a time, with aria-expanded.

**Invariants / canon.** Canon requires quick navigation through difficult passages and event-level explanations. Keep the 5 factors factorized.

**Source findings:** [F4-06](#f4-06), [F5-13](#f5-13), [F4-07](#f4-07), [F8-17](#f8-17), [F4-V03](#f4-v03), [F4-09](#f4-09), [F4-12](#f4-12)

<a id="t28"></a>
### T28 — Selecting a pad and selecting an event are the same action

**Severity:** high · **Kind:** confusing · **Effort:** M · **Flows:** F2, F4 · **Depends on:** —

**Problem.** A plain click on a pad selects that sound's first hit in the song. Every other pad dims to 20% greyscale, the pad's name is replaced by a finger code, the right panel switches to Selected Event, and whatever moment the user was inspecting is lost. There is no way to simply select a pad. Delete and Backspace remove the pad of the selected event without needing grid focus, a confirmation or a toast. So a Backspace pressed while stepping through events with the arrow keys, or after clicking a timeline pill, silently removes a sound from the grid and creates a draft.

**Root cause.** InteractiveGrid.tsx:492-507: a pad click selects the first assignment on that pad (plus 513, 537, 642, 666, 705-709 for the dimming). useKeyboardShortcuts.ts:84-98: Delete/Backspace act on the selected event.

**Recommendation.** Separate pad selection from moment selection. A pad click outlines the pad and opens a small pad inspector: sound, hit count, preference, lock, remove, and 'show its hits'. Only an explicit event action dims the grid. While a moment is selected, a pad click highlights that sound's hits in the timeline without moving the moment; add Prev/Next hit of this sound. Bind Delete only to an explicit pad selection, and toast 'Removed Snare from (3,3) · Undo'.

**Invariants / canon.** Manual edits are exploratory and go to the Working/Test Layout. Keep 'click a note → highlight every note of that moment'.

**Source findings:** [F2-10](#f2-10), [F4-19](#f4-19), [F2-V03](#f2-v03), [F4-18](#f4-18)

<a id="t29"></a>
### T29 — Saved Variants all get the same name, can't be renamed and show no scores

**Severity:** high · **Kind:** ux-friction · **Effort:** S · **Flows:** F6, F10 · **Depends on:** —

**Problem.** The toolbar's 'Save Variant' saves at once as '<Active name> variant', which is 'Default variant' every time, with no prompt and no feedback. Saving twice gives two identical cards with the same date and no time. Variants can't be renamed, show no score, and only the last 3 are visible. The canon's durable 'worth keeping' object is the hardest thing in the app to tell apart, and the library doesn't show how many variants a project has.

**Root cause.** WorkspaceToolbar.tsx:182-188, 337-345. projectState.ts:1045-1065, and 1128-1145 where RENAME_LAYOUT targets only active and working. LayoutOptionsPanel.tsx:56, 220-239 (slice(-3)), 327-402 (SavedVariantCard has no rename and no score).

**Recommendation.** On Save as variant, show an inline name field pre-filled from the displayed layout's base name plus a descriptor ('Default – 23 Sep 14:02', or the candidate's strategy), and confirm with a toast that scrolls to the new card. Allow renaming on variant cards by adding a variant target to RENAME_LAYOUT. Show the score and Hard/Unplayable counts on each card, and list every variant under 'View all'.

**Invariants / canon.** Save as variant creates a durable Saved Layout Variant without changing the Active Layout. Voice IDs must survive variant save.

**Source findings:** [F6-19](#f6-19), [F10-07](#f10-07)

<a id="t30"></a>
### T30 — Candidates are temporary, and there is no way to keep one

**Severity:** medium · **Kind:** missing-capability · **Effort:** S · **Flows:** F3, F6, F10 · **Depends on:** T01, T29

**Problem.** The canon lists 'save candidate as variant' as a core feature and the reducer supports it, yet cards offer only Preview and Promote. The workaround, Preview followed by the toolbar's Save Variant, first overwrites the draft and then names the variant after the Active Layout. Each Generate replaces the whole candidate list, so runs with different methods or strategies can't be compared. Candidates and the trace also vanish silently when the user leaves the project, and nothing says they are temporary.

**Root cause.** CandidatePreviewCard.tsx:233-265 has no save action. SAVE_AS_VARIANT with source 'candidate' is supported (projectState.ts:1045-1056) but has no UI caller. SET_CANDIDATES replaces the list (projectState.ts:1155-1162). Candidates are deliberately not persisted (projectSerializer.ts:79-80, 168-185).

**Recommendation.** Add 'Keep' (save as variant, named after the candidate) to every card and to each side of Compare. Add each run as a collapsible group ('Run 2 · Structural · 1 min ago'), capped, with 'Clear older runs'; or add a pin that survives regeneration. Caption the list 'Candidates are temporary · Save the ones you like as variants', and warn on leaving when unkept candidates exist.

**Invariants / canon.** A Candidate Solution is a proposal, not hidden project truth: keep candidates unpersisted and route 'keep' through Saved Layout Variant. Don't reduce multi-candidate generation to a single result.

**Source findings:** [F3-20](#f3-20), [F10-08](#f10-08), [F3-V04](#f3-v04), [F6-05](#f6-05)

<a id="t31"></a>
### T31 — Committing and destructive actions confirm inconsistently, and none report what happened

**Severity:** high · **Kind:** ux-friction · **Effort:** M · **Flows:** F2, F9, F10, X1, X2 · **Depends on:** —

**Problem.** Toolbar Promote and Discard act instantly, even on an infeasible 3-of-7 draft. Card Promote uses an inline 'Confirm?' that reverts after 3s. View all wraps that in a second native confirm(), and Compare uses window.confirm with different wording. The Composer and presets use window.prompt, alert and confirm for naming, placement errors and deletes. Nothing reports the outcome: the app has no toast or aria-live region at all, so Promote, Save Variant, Discard, Duplicate and Backspace removal are silent. Disabled Generate, Compare and Calculate Cost explain themselves only in a title tooltip, which never shows because .pf-btn:disabled sets pointer-events:none.

**Root cause.** WorkspaceToolbar.tsx:175-195 (no confirmation), 302-313, 318-329. CandidatePreviewCard.tsx:93-123, 240-264 (3s timeout). LayoutOptionsPanel.tsx:284-288, 404-428 (confirm() plus the inline confirm). CompareModal.tsx (window.confirm). WorkspacePatternStudio.tsx:270, 341; PerformanceWorkspace.tsx:223, 409; PresetLibraryPanel.tsx:74, 90. index.css:280-286 (pointer-events:none on disabled). SettingsGear.tsx:228-229. There is no aria-live anywhere in src/ui.

**Recommendation.** Add one toast system backed by an aria-live=polite region, with Undo. Use two tiers. Reversible actions (Promote, since the previous Active is auto-saved; Discard; deleting a candidate; removing a pad; clearing the Composer) act at once and show an Undo toast that summarises the change. Irreversible actions (deleting a project) use an in-app confirmation popover that names the consequences. Promote shows the verdict and warns about unplaced sounds. Replace every native prompt, alert and confirm with in-app popovers, and show invalid-placement reasons on the drag ghost. Remove pointer-events:none from disabled buttons and show the reason as inline helper text.

**Invariants / canon.** Promote stays the normal path to Active, and the replaced Active is auto-saved. isProcessing still resets on success and error after optimizer runs.

**Source findings:** [F2-12](#f2-12), [F10-14](#f10-14), [X2-16](#x2-16), [X2-09](#x2-09), [F9-21](#f9-21), [X1-V02](#x1-v02), [X2-10](#x2-10)

<a id="t32"></a>
### T32 — Layout roles are written into layout names, and lifecycle wording drifts from the canon

**Severity:** medium · **Kind:** copy-terminology · **Effort:** S · **Flows:** F2, F10, X2 · **Depends on:** T03

**Problem.** Working layouts are created as '<name> (draft)'. Suggest appends '(suggested)', Generate appends '(draft)', and Promote keeps the name as it is. The Active card therefore reads 'ACTIVE · Coordination-Optimized (draft)', and the next edit produces 'Default (draft) (draft)'. The same concept appears as 'Working Draft' (grid), 'DRAFT' (summary), '(draft)' (name), 'Load Draft' (a button that turns a variant into the draft), 'working changes' and 'working layout'. 'Duplicate Layout' is a third name for saving a variant. Learn More's App Flow doesn't explain Promote, Save variant or Discard.

**Root cause.** projectState.ts:439-444 (the clone's name gets ' (draft)'), 957-972 (Promote keeps the name; replaced-variant naming), 1184, 1246-1251. InteractiveGrid.tsx:788; ActiveLayoutSummary.tsx:112, 164; LayoutOptionsPanel.tsx:369; SettingsGear.tsx:133; LearnMoreModal.tsx:71; CandidatePreviewCard.tsx:132.

**Recommendation.** Store a clean base name plus provenance (origin: manual | suggested | candidate:<strategy> | variant:<id>), and build display labels from role and base name ('Draft of Default', 'Active: Coordination'). Never write role suffixes into names. Choose one user-facing vocabulary (Active, Working/Test with the tooltip 'your unsaved experiment', Candidate, Saved variant) and use it for badges, buttons ('Edit as draft' instead of 'Load Draft') and a new lifecycle section in Learn More.

**Invariants / canon.** Canonical terms: Active Layout, Working/Test Layout, Saved Layout Variant, Candidate Solution. Learn More sync (invariant 2).

**Source findings:** [F2-V04](#f2-v04), [F10-13](#f10-13), [X2-06](#x2-06), [F10-16](#f10-16)

<a id="t33"></a>
### T33 — The optimization trace is incomplete and contradicts itself

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F3 · **Depends on:** —

**Problem.** Beam and Annealing runs show no trace at all: the annealing solver builds annealingTrace, but nothing renders it. stopReason never reaches the panel. Because the panel reads the trace from the selected candidate, it disappears when the Active card is clicked or a candidate is promoted from its card. Where the trace does show, step 1 reads delta -44.29 but 'Cost Before 86.51 → After 88.22'. 'Cost Saved -56.81' is a double negative. 'Init (0)' and 'Placements 0' are always zero for Greedy. Replaying a step switches the grid to a historical layout with no banner saying so.

**Root cause.** state.moveHistory, iterationTrace and moveHistoryStopReason are only ever set to null (useAutoAnalysis.ts:264; projectState.ts:1348-1353). The panel reads selectedCandidate.iterationTrace instead (PerformanceWorkspace.tsx:484, 764-770). greedyOptimizer.ts:249-349, 449 computes stopReason but never stores it on the candidate. No component in src/ui consumes the annealing trace. The inconsistent numbers come from MoveTracePanel's cost fields.

**Recommendation.** Attach a trace and stopReason to every candidate: the greedy move history; annealing snapshots as a cost/temperature sparkline with accepted moves; a beam summary. Title it 'How candidate #2 was found' with a line 'Stopped: <reason>'. Keep the trace of the latest run and of the promoted candidate available after promotion. Use one cost convention, in words ('-44 cost · better'), with Before/After consistent with the delta. Hide phases with 0 steps. During replay, show 'Replaying step 1/100 · Esc to exit' over the grid.

**Invariants / canon.** The trace is a required product surface. Don't remove MoveTracePanel or disconnect it from state.moveHistory, and don't drop stopReason. Keep the OptimizerMove and AnnealingIterationSnapshot shapes from the canonical optimizer output contract. Run the TEST MIDI 1 integration test if optimizer output changes.

**Source findings:** [F3-06](#f3-06), [F3-07](#f3-07)

<a id="t34"></a>
### T34 — Optimizer internals are the main Generate UI: raw method, strategy and intensity selects, choices that do nothing, and jargon card names

**Severity:** high · **Kind:** remove-or-demote · **Effort:** M · **Flows:** F3, F5, X1, X2 · **Depends on:** —

**Problem.** The main toolbar holds unlabeled Greedy/Beam/Annealing, 'All Strategies' and 'Intensity' selects that have no dropdown arrow. Beam and Annealing/Quick run the same code and give identical results, because only 'deep' actually anneals. Quick cards still claim 'Quick optimization (3000 iterations, 0 restarts)', and Beam silently reuses a hidden Intensity value. Run times range from 0.4s to about 23 minutes with no hint. Cards read 'Clustered M…', 'Exploratory Variant (seed 3)', 'Greedy Soft Greedy (Boltzmann): 92 moves, cost 50.29' and 'pose0-offset-1'. Every card says 'Easy' and 'balanced across all dimensions', and #1 and #2 both claim 'strongest playability'. Learn More names the methods differently and doesn't mention strategies.

**Root cause.** WorkspaceToolbar.tsx:62, 265-313: the selects, with generationMode as local state passed to every method. useAutoAnalysis.ts:316-337: the non-greedy path never reads the method key. multiCandidateGenerator.ts:413-418, 468-470: the summary reports iterations for runs that didn't anneal. index.css:309-321: .pf-select uses appearance:none with no chevron. CandidatePreviewCard.tsx:132, 145-149, 173-190; a ±0.02 tie tolerance in greedyCandidatePipeline; LearnMoreModal.tsx:47-63, 483-525.

**Recommendation.** Keep every method, strategy and the full trace, but move them behind a 'Generate ▾' options popover. Give options musician-facing names, one-line descriptions and expected times ('Quick alternatives ~20s', 'Deep search, minutes'; focus: Comfort / Fast alternation / Memorable shapes / Surprise me), with the technical names secondary. Show intensity only where it applies, and make labels report what actually ran. Give each strategy family one musician-facing name, shown in full. Move method, seed, move count and raw cost into an info tooltip or the trace. Write card copy that ranks against the other candidates and against Active and differs across the set; show a difficulty word only when it differs. Use the same names in Learn More.

**Invariants / canon.** Multiple optimization methods (beam, annealing, greedy) must stay available through the registry, and greedy is first-class. Deterministic seed=0 mode must stay reachable, for example in the options popover or on the debug page.

**Source findings:** [F3-04](#f3-04), [F3-17](#f3-17), [X2-19](#x2-19), [X1-13](#x1-13), [X1-V06](#x1-v06), [F3-10](#f3-10), [F5-15](#f5-15)

<a id="t35"></a>
### T35 — Generation shows no progress or ETA, can't be cancelled, and leaves conflicting actions live

**Severity:** high · **Kind:** ux-friction · **Effort:** M · **Flows:** F3 · **Depends on:** —

**Problem.** The only feedback is an indeterminate, truncated pill and a pulsing 'Generating candidates…' line. Runs last from 0.4s to about 23 minutes with no step count, no estimate and no Cancel. The method selects disappear while it runs, which shifts the toolbar. Edits, Discard and a second Generate stay available, and when the run finishes its result is applied over whatever changed in the meantime. The status is not announced to screen readers.

**Root cause.** WorkspaceToolbar.tsx: the status pill, and the selects hidden while processing. useAutoAnalysis.ts:310, 343: the result is applied unconditionally after the run. The solvers have yield points but no abort flag.

**Recommendation.** Show real progress ('Candidate 2 of 4 · ~8s left', or iterations for annealing) and a Cancel that sets an abort flag checked at the existing yield points. Keep the controls in place but disabled. Queue or block conflicting edits, or skip the run's auto-apply if the draft changed (no longer needed once T01 lands). Announce start and finish in the aria-live region.

**Invariants / canon.** isProcessing must reset to false on the success, error and cancel paths. A cancelled run must not leave partial trace state behind, and it should report stopReason 'cancelled' rather than dropping it.

**Source findings:** [F3-05](#f3-05)

<a id="t36"></a>
### T36 — Beam and Annealing return near-copies, and the lack of diversity is never explained

**Severity:** medium · **Kind:** bug · **Effort:** M · **Flows:** F3 · **Depends on:** —

**Problem.** The three Beam/Annealing candidates are the same 7-pad shape shifted up one row at a time (pose offsets 0, 1, 2), scoring 80, 78 and 75%. The UI throws away the generation summary (duplicates removed, diversity information), so nothing tells the user that the alternatives are near-identical or that the constraints left little room.

**Root cause.** multiCandidateGenerator.ts seeds with pose0 offsets 0, 1 and 2. useAutoAnalysis.ts drops the generation summary. The diversity filter doesn't treat pure translations as duplicates.

**Recommendation.** Treat pure translations as duplicates in the diversity filter. When fewer than N meaningful alternatives exist, show fewer cards and a note ('Only 1 distinct alternative. Your 2 locks and finger choices leave little room'). Show the generation summary in the candidates header.

**Invariants / canon.** Candidate diversity relative to the Active Layout is required; a real candidate must show an unlocked placement change or a materially different tradeoff. After changing generation, verify 0 unplayable events on TEST MIDI 1.

**Source findings:** [F3-11](#f3-11)

<a id="t37"></a>
### T37 — Explicit placement actions are inconsistent: Generate on an empty grid places everything, and Suggest disappears once anything is placed

**Severity:** medium · **Kind:** confusing · **Effort:** S · **Flows:** F3 · **Depends on:** T01

**Problem.** On an empty grid, Generate is enabled and after about 21 seconds places every sound and applies the result as the draft. Meanwhile the same screen shows the Suggest box and 'Assign sounds to pads, then Generate to analyze'. Once any sound is placed, 'Suggest a starting layout' disappears, although its reducer only fills unplaced sounds. So 'I placed the kick and snare, fill in the rest' is impossible. Suggest also can't be undone.

**Root cause.** ActiveLayoutSummary.tsx:169, 201-216 shows Suggest only when mappedCount === 0 and there is no analysis; 374-378 holds the empty-state copy. useAutoAnalysis.ts enables Generate as soon as streams exist and auto-applies its result. SUGGEST_STARTING_LAYOUT is in EPHEMERAL_ACTIONS (projectState.ts:393-416).

**Recommendation.** Whenever unplaced sounds exist, show 'Place remaining N sounds' in the summary and in the Sounds panel's 'To place' header, as a single undoable step. On an empty grid, label the button 'Generate layouts from scratch' and have it produce proposals without applying any (T01), so the user picks one explicitly.

**Invariants / canon.** Invariant 7: nothing is placed without explicit user action. The verifier judged an explicit Generate click acceptable, so keep Suggest explicit and discardable. Never auto-lay out on import.

**Source findings:** [F3-15](#f3-15), [F3-16](#f3-16)

<a id="t38"></a>
### T38 — Workspace layout: analysis duplicated across tabs, candidates buried, related information scattered, and competing primary buttons

**Severity:** high · **Kind:** confusing · **Effort:** L · **Flows:** F3, F5, F10, X1 · **Depends on:** T03, T04

**Problem.** The Layouts tab's 'Layout Summary' re-renders the Costs tab's tiles, feasibility, ergonomics and chart through copy-pasted components, yet each tab lacks something the other has; for example, Costs has no subject and no 'What is limiting this layout'. Four candidate cards of about 390px each, the variants and the trace are stacked in one scrolling column. Card #1 starts around y=600 at 1600 and is barely visible at 1366. One moment is spread across the Events list (left), the grid (centre), the Selected Event card (right, Layouts tab only) and the timeline (bottom). S/M appear twice per sound, and Compare appears twice. The side panels default to 320px and 340px, 48% of a 1366px screen, and are mostly empty. The toolbar shows a filled green Promote, a blue Generate, a purple Compare and a 'Saved' pill at the same time. Lifecycle buttons pop in next to the project name, far from the grid. Save Variant's styling compiles to nothing because an opacity modifier is applied to a hex CSS variable.

**Root cause.** PerformanceWorkspace.tsx:60-66, 595-617, 624-631, 697-702, 744-774. PerformanceCostsPanel.tsx:13-53, 191-210 duplicate ActiveLayoutSummary.tsx:40-76, 387-406. WorkspaceToolbar.tsx:170-198, 232-247, 302-329. tailwind.config.js maps tokens without <alpha-value>.

**Recommendation.** Reorganise by job. Left: Sounds (identity, filters, the only S/M). Centre: the grid with its state bar and lifecycle actions, plus the moment inspector. Right: one 'Analysis' panel (subject chip, verdict, limits, factors, chart, selected moment, Learn more) and a separate 'Layouts' list (Active, Draft, Candidates and Variants as compact ~140px rows that expand), with Trace in its own tab. One primary action per region: Generate while there are no candidates, and Promote only in the state bar. Use narrower default side panels when the measured centre is narrow, and visible resize grips. Fix the token alpha mapping so Save Variant renders.

**Invariants / canon.** The Pattern Composer must remain a bottom-drawer tab (invariant 3). MoveTracePanel must stay visible and wired to optimizer output (trace core). Desktop-only: size by measurement, not breakpoints.

**Source findings:** [F5-14](#f5-14), [F3-18](#f3-18), [X1-08](#x1-08), [X1-18](#x1-18), [X1-09](#x1-09), [F10-15](#f10-15)

<a id="t39"></a>
### T39 — The 'View settings' gear mixes view toggles, a dead toggle, a hidden duplicate of Save Variant, and cost toggles that don't affect the analysis

**Severity:** medium · **Kind:** remove-or-demote · **Effort:** S · **Flows:** F2, F5, F10, X1 · **Depends on:** T21

**Problem.** The gear holds, side by side: view toggles; 'Organize by 4x4 Banks', which nothing reads and whose only feedback is a text-colour change; 'Duplicate Layout', a hidden second Save Variant that dispatches create, save and discard as three undo entries and clears the selection; cost-family checkboxes; and 'Calculate Cost', the only explicit Analyze trigger. Unchecking a cost family changes nothing in the Score, bars or Difficulty, because auto-analysis ignores the toggles and no stale badge appears. Calculate Cost then adds a separate card with a third number system ('Per moment 0.374'). View preferences reset every session.

**Root cause.** SettingsGear.tsx:66-67, 91, 117-138, 142-158, 193-231. viewSettings.tsx:37-38, 58, 95, 114: organize4x4Banks is never read, and settings live in useState, unpersisted. WorkspaceToolbar.tsx:337-345 (Duplicate Layout). SET_COST_TOGGLES doesn't mark analysis stale (projectState.ts:1342-1343), and the auto-analysis effect omits costToggles from its deps (useAutoAnalysis.ts:158-162, 254). PerformanceCostsPanel.tsx renders the separate manualCostResult card.

**Recommendation.** Remove 'Organize by 4x4 Banks' until it's implemented, or implement it as quadrant guide lines. Remove 'Duplicate Layout', or replace it with 'Save copy as variant' on the Active row, dispatching SAVE_AS_VARIANT without the create/discard round trip. Move the view toggles into a view control on the grid frame and remember them per viewer. Then either move the cost toggles and Calculate Cost to the Optimizer Debug page, or make them first-class: a toggle marks the analysis stale and re-runs it, the subject chip says 'Custom weighting: Movement off', and results use the same scale and FACTOR_META labels as everything else.

**Invariants / canon.** Invariant 2: the Learn More Constraints tab must reflect the active constraints. The 'Show Finger Assignment' toggle must keep showing solver fingering. Optimizer output must still echo costTogglesUsed.

**Source findings:** [X1-19](#x1-19), [F2-21](#f2-21), [X1-V03](#x1-v03), [F10-17](#f10-17), [F5-18](#f5-18), [X1-V05](#x1-v05)

<a id="t40"></a>
### T40 — Cost bars and the difficulty chart have no absolute scale, no thresholds and no musical time axis

**Severity:** medium · **Kind:** visual-layout · **Effort:** M · **Flows:** F5 · **Depends on:** T21

**Problem.** Each layout's ergonomics bars are scaled to its own largest factor, so Movement values of 3, 14 and 92 all draw as the same full bar. The values have no units, the panel never says lower is better, and the tooltips are written in engine terms ('Fitts's Law transition cost'). The difficulty chart is collapsed behind a small toggle and, once opened, retitles itself 'STACKED DIFFICULTY CHARTS'. Its grid lines are unlabelled, it has no Medium/Hard thresholds, and its x-axis shows indices (0/16/31) that don't line up with the timeline below.

**Root cause.** CostBreakdownBars.tsx:95-99, 134, 151-163 set maxValue to the local maximum. ActiveLayoutSummary.tsx:249-265; PerformanceCostsPanel.tsx:166-183; EventCostChart.tsx:145-150, 223-225.

**Recommendation.** Use a fixed scale: the per-moment average against easy/ok/hard bands, or each factor's share of the total burden, with the absolute value secondary and 'lower = easier' next to the header. Take tooltip text from FACTOR_META in plain language. Open the chart by default once analysis exists, title it 'Difficulty over time', label the y-axis in the headline unit, draw Medium/Hard bands and use bar.beat ticks. Consider an optional Difficulty lane aligned with the timeline.

**Invariants / canon.** Factor-level analysis stays factorized. Learn More must describe the scale (invariant 2).

**Source findings:** [F5-12](#f5-12), [F5-17](#f5-17)

<a id="t41"></a>
### T41 — Learn More doesn't explain the numbers on screen and can't be reached from the Costs tab

**Severity:** medium · **Kind:** missing-capability · **Effort:** M · **Flows:** F5 · **Depends on:** T20, T21, T23

**Problem.** Nothing explains SCORE %, HARD, UNPLAY, Easy/Moderate/Hard/Extreme, or Compare's Playability, Compactness and Transitions. The Cost Factors tab talks about 'attractor force', 'Fitts's Law' and a 'quadratic penalty'. The Constraints tab shows code keys and 'supination'. The Overview infographic shows placeholder numbers (350, 570), and App Flow leaves out the lifecycle. No ⓘ button leads from a metric to its definition.

**Root cause.** LearnMoreModal.tsx:19-45, 65-73, 235-241, 531-612. The only 'Learn more' link is on the Layouts tab (ActiveLayoutSummary.tsx:117-122, 382).

**Recommendation.** Add a 'Reading your results' section generated from FACTOR_META and the headline-score definition, so it stays in sync. Open each factor with a sentence written for musicians and keep the maths as secondary detail. Replace the placeholder numbers with the project's own. Add ⓘ popovers beside every tile, factor and Compare row that link to the matching Learn More section. Add a lifecycle section.

**Invariants / canon.** Invariant 2: any change to cost factors, constraints or metrics must be reflected in LearnMoreModal, and the Constraints tab must show the currently active constraints.

**Source findings:** [F5-19](#f5-19)

<a id="t42"></a>
### T42 — Hand colours, finger notation and colour meanings change from one surface to the next

**Severity:** medium · **Kind:** visual-layout · **Effort:** M · **Flows:** F4, F5, F8, X1 · **Depends on:** —

**Problem.** The right hand is orange-red (#FF4400) on the grid, purple (#a855f7) on timeline pills and Compare grids, and orange (#f09060) in the Sounds chips. The left hand is #0088FF, #3b82f6 or #6da3f5. The same fact is written 'L3', 'L-1', 'left'/'thumb', 'TH IN MI RI PI' or 'L-MI'. Purple also means Compare, the Grip factor and 'layout B'; in Compare, blue and purple mark both A/B and left/right hands. A selected sound uses the same #60a5fa as the 'next event' marker, and the only way to clear it is to click its row again.

**Root cause.** Hex values are hard-coded per component: InteractiveGrid.tsx:54-63, 523, 655-662; UnifiedTimeline.tsx:29-38, 961; PadGrid.tsx:37-42; FingerAssignmentInput.tsx:113-116; CompareGridView.tsx:139, 148; CandidateCompare.tsx:33-35, 52, 61-63, 73; ActiveLayoutSummary.tsx:286-290, 325, 358. Sound selection: VoicePalette.tsx:34, 82-105; useKeyboardShortcuts.ts:43-46.

**Recommendation.** Define semantic colour tokens once and ban raw hex in components: --hand-left and --hand-right (grid, a coloured edge on timeline pills, Compare, chips, inspector); --sound-1..16, never used for UI state; --status-ok/warn/bad; --role-active/working/candidate. Use one finger-notation module (L1-R5, with the finger name in the tooltip). Mark A/B in Compare with neutral letter chips. Give sound selection its own style (a neutral outline or corner tab), cleared by Escape or a click on empty space.

**Invariants / canon.** Timeline pills must show hand+finger ('L2'), never the digit alone.

**Source findings:** [F4-14](#f4-14), [X1-06](#x1-06), [F5-V04](#f5-v04), [F8-V05](#f8-v05)

<a id="t43"></a>
### T43 — Positions and times are shown in developer notation

**Severity:** medium · **Kind:** copy-terminology · **Effort:** S · **Flows:** F2, F4, F7, F8 · **Depends on:** T24

**Problem.** Off-beat events get identical labels ('1.1, 1.1, 1.1, 1.1, 1.2') because formatBeatPosition drops the sub-beat. The transport shows seconds ('4.56s', sometimes '-0.00s'), and loop bounds are in seconds too, while the ruler and the list use bar.beat. Speed shows only a multiplier. Every empty pad prints an 8px coordinate counted from 0, and positions appear as '[3,3]', '(3,3)', 'Pad [3,3]' and '3,4'; none of them says which number is the row and which the column.

**Root cause.** EventsPanel.tsx:41-49: both branches return `${bar}.${beat}`. UnifiedTimeline.tsx:623-625, 671-675 format with toFixed(2)+'s'. InteractiveGrid.tsx:679-681, 725-729, 763-765; utils/padPosition.ts formatPadPosition; PadContextMenu.tsx:86; ActiveLayoutSummary.tsx:284.

**Recommendation.** Use bar.beat.sixteenth everywhere (1.1.3), with milliseconds in tooltips. Show the position as bar.beat.tick, the loop as 'Bars 5-6', and the effective tempo next to Speed ('0.75x · 90 BPM'). Clamp time so it never goes below the region start. Leave empty pads blank by default (the Position Labels toggle covers them) and use one 1-based format ('Row 4 · Col 4') or a mini locator everywhere.

**Invariants / canon.** All displays, including the Composer, use the project BPM (invariant 8).

**Source findings:** [F4-08](#f4-08), [F7-16](#f7-16), [F2-15](#f2-15), [F8-20](#f8-20)

<a id="t44"></a>
### T44 — Empty-state and next-step guidance is scattered and mixes up Analyze and Generate

**Severity:** medium · **Kind:** copy-terminology · **Effort:** S · **Flows:** F1, F2, X1, X2 · **Depends on:** —

**Problem.** In a new project the grid shows no empty-state text. The Sounds panel says 'No sounds loaded.' with no action. The right panel says 'Assign sounds to pads, then Generate to analyze' and 'Click Generate…' while Generate is disabled. The only working call to action sits in the timeline, and its 'or open the Pattern Composer' has no link. After import, 'Import MIDI' stays primary and Generate also turns primary while the grid is still empty. The copy keeps telling users to 'Generate to analyze' or 'Run Generate first', although analysis runs automatically. This contradicts the canon rule that Analyze and Generate stay visibly distinct.

**Root cause.** VoicePalette.tsx:294-296. UnifiedTimeline.tsx:546-580 (Import as pf-btn-primary). WorkspaceToolbar.tsx:302-313. ActiveLayoutSummary.tsx:374-378. SettingsGear.tsx:229. The PerformanceCostsPanel empty state and the Learn More App Flow.

**Recommendation.** Show one staged empty state in the centre of the grid that also accepts dropped .mid files. Step 1: 'Import MIDI' or 'Build a pattern in Composer' (switches to the Composer tab). Step 2: 'Drag sounds onto pads, or Suggest a starting layout'. Once sounds exist, demote Import to a secondary '+ MIDI' button. Rewrite the copy as 'Analysis updates automatically as you place sounds. Generate proposes alternative layouts.' and show 'Analyzing… / Up to date' near the score.

**Invariants / canon.** Canon #9: Analyze and Generate must stay visibly distinct. Invariant 7: the empty state must never auto-place. Invariant 3: the Composer tab stays reachable.

**Source findings:** [F1-13](#f1-13), [X1-16](#x1-16), [F1-14](#f1-14), [F2-22](#f2-22), [X2-17](#x2-17)

<a id="t45"></a>
### T45 — The Sounds panel has no placement status, filters or row actions, and grouping is half-finished

**Severity:** medium · **Kind:** missing-capability · **Effort:** M · **Flows:** F2, F8 · **Depends on:** T17

**Problem.** Rows show no hit count, and placed and unplaced sounds are mixed together; the only sign of 'not placed' is a missing '(r,c)'. There is no search, no 'All · Not placed · Placed · Locked' filter (a canon Sounds-tab feature) and no 'n of 7 placed'. Rows can't lock, unplace or delete a sound. Once groups exist, 'Unassigned (n)' and 'Ungrouped (n)' mix grouping with placement. Groups can only be made with Ctrl-click plus Ctrl+G. Group assignment is buried in the colour popover, and the group delete × never appears. Grouping or recolouring a group overwrites colours the user picked. The timeline ignores group order, and its lane headers can't select a sound. An unused lanes/ folder already contains search, filtering and drag-to-group, while S/M are duplicated in every Sounds row.

**Root cause.** VoicePalette.tsx:1-7, 40-77, 93-101, 148-166, 235-303, 345 (the parent lacks the 'group' class), 400-406, 478-638. SET_SOUND_COLOR leaves colorMode 'inherited' (projectState.ts:652-692), so group colours overwrite it (lanesReducer.ts:252-255, 321-326). UnifiedTimeline.tsx:77, 733-744, 1026-1031. src/ui/components/lanes/ (LaneSidebar, LaneRow, LaneGroupHeader) is never imported.

**Recommendation.** Add a header with search, a segmented filter with counts ('7 sounds · 3 on grid · 4 to place · 0 locked') and a progress bar. Keep group sections with 'Ungrouped' for the rest; show placement status only as filter chips (All / To place / On grid / Locked) and a per-row 'To place' pill or pad locator, never as a section label. Each row shows its hit count, a pad locator or 'Not on grid' pill, a lock toggle, and an overflow menu: Rename, Colour, Group, Short label, Exclude from analysis, Unplace, Delete (with undo). Salvage the search, filter and drag-to-group logic from lanes/, then delete the folder. Make SET_SOUND_COLOR set colorMode 'custom', and apply a group colour only to members without a custom colour. Add a selection action bar (Group · Colour · Unplace), fix the hover class, share one ordering with the timeline, and make lane headers select their sound. Keep S/M in one place only.

**Invariants / canon.** CLAUDE.md sound grouping rules: ungrouped sounds are labelled 'Ungrouped', not 'On Grid', and Cmd/Ctrl+G toggles group/ungroup. The canon requires the Sounds-tab filter. Invariant 7: 'Place remaining' stays an explicit action.

**Source findings:** [F2-19](#f2-19), [F8-09](#f8-09), [F8-10](#f8-10), [F8-11](#f8-11), [F8-21](#f8-21), [F8-06](#f8-06), [F8-19](#f8-19), [F8-18](#f8-18)

<a id="t46"></a>
### T46 — Grid editing gestures are limited and give no feedback (silent eviction, pad-to-list drag reorders the list, no multi-select)

**Severity:** medium · **Kind:** ux-friction · **Effort:** M · **Flows:** F2, F8 · **Depends on:** —

**Problem.** Dropping a Sounds row on an occupied pad replaces its sound, which goes back to unplaced, while dropping a pad on it swaps them. During the drag the target only gains a thin border: no preview, and no toast afterwards about what was evicted. Dragging a pad onto the Sounds list doesn't unplace it. Because the row-drag reorder target is never cleared, it reorders the list instead. There is no multi-pad selection, group move, nudge or mirroring between hands.

**Root cause.** projectState.ts:744-780 (the replaced voice is removed). InteractiveGrid.tsx:412-511, 431-456, 639, 659. VoicePalette.tsx:185-192, 227-229, 494-499: reorderTarget is never cleared on dragend. projectState.ts:744-844 has only single-pad reducers.

**Recommendation.** While dragging, show a ghost of the incoming sound and a one-line hint ('Swap with Snare', 'Replace: Snare goes back to unplaced', 'Move from (3,3)'), and toast evictions with Undo. Clear reorderTarget on dragend, allow reordering only through a dedicated handle with its own dataTransfer type, and accept pads dropped on the Sounds panel as 'unplace', with a highlighted drop zone. Later: shift or marquee selection, group drag, arrow-key nudging and 'Mirror L↔R', each as one undo step.

**Invariants / canon.** A sound occupies only one pad (keep this). Manual edits go to the Working/Test Layout.

**Source findings:** [F2-09](#f2-09), [F2-18](#f2-18), [F8-12](#f8-12), [F2-20](#f2-20)

<a id="t47"></a>
### T47 — Import only appends: re-importing duplicates every Sound, and files or Sounds can't be removed

**Severity:** high · **Kind:** missing-capability · **Effort:** M · **Flows:** F1, F8 · **Depends on:** —

**Problem.** Each import gets a new source id and is appended. Re-importing a clip after editing it in Live silently adds a second set of Sounds with identical names and colours. There is no replace option, no list of imported files, no 'remove file' and no 'delete sound' anywhere in the workspace; REMOVE_LANE_SOURCE is wired only to the Composer. Undoing an import takes several presses because of T02.

**Root cause.** useLaneImport.ts:43, 56-62, 79-92, 108-111. lanesReducer.ts:146-159 vs 161-182: import never uses UPSERT_LANE_SOURCE. VoicePalette.tsx:411-640 has no delete control. REMOVE_LANE_SOURCE is used only in WorkspacePatternStudio.tsx:210, 362.

**Recommendation.** Add a 'Source files' section to the Sounds tab listing each imported file (name, sound count, tempo, date) with Replace and Remove (confirm plus undo). When an incoming file's name matches an existing source, ask 'Replace (keeps pad placements for matching sounds) / Add as new / Cancel', reusing UPSERT_LANE_SOURCE and matching sounds by name or track. Add 'Delete sound' with an undo toast.

**Invariants / canon.** Voice IDs must survive a replace where sounds match. The timeline keeps showing all streams. A replace must not auto-place new sounds (invariant 7).

**Source findings:** [F1-06](#f1-06), [F1-07](#f1-07), [F8-V04](#f8-v04)

<a id="t48"></a>
### T48 — Import errors are mislabelled, edge cases pass silently, and there is no import review step

**Severity:** medium · **Kind:** ux-friction · **Effort:** M · **Flows:** F1, F3 · **Depends on:** T17

**Problem.** A bad MIDI file sets the single global state.error. It appears in a top banner that pushes the workspace down, and again in the Layouts panel as 'Generation failed' with a Retry that starts a full optimizer run. A file with a tempo but no notes does nothing visible, yet it is recorded as a source, so the next real file's tempo is never adopted. A file with 70 pitches creates 70 Sounds for a 64-pad grid without warning. After the file picker closes, Sounds simply appear: no summary of tracks, sounds, notes, bars, tempo or meter, and no chance to rename, recolour or drop Sounds. The canon step 'define or confirm sound identities' has no confirmation moment.

**Root cause.** useLaneImport.ts:65-111, 125, 133-135. PerformanceWorkspace.tsx:535-545, 762. LayoutOptionsPanel.tsx:72-92 renders its error box for any state.error, with Retry wired to handleGenerate.

**Recommendation.** Tag errors by source (import, drag, analysis, generation), and show 'Generation failed' with Retry only for generation errors. Show import errors in a dismissible toast or in the import review, with a specific message. Refuse files with no notes and don't record them. Add a lightweight import review sheet: a header such as 'TEST MIDI 1.mid · 1 track · 7 sounds · 48 notes · 32 events · 8 bars · 120 BPM 4/4', one editable row per Sound (name, colour, pitch as provenance, note count, include), and a warning above 64 Sounds.

**Invariants / canon.** Invariant 5: pitch is shown as provenance only, and bottomLeftNote is untouched. Invariant 7: the review must not place sounds.

**Source findings:** [F1-08](#f1-08), [F3-V03](#f3-v03), [F1-10](#f1-10), [F1-11](#f1-11)

<a id="t49"></a>
### T49 — Notes are stored in absolute seconds, so tempo changes and multi-file imports shift notes off the bar grid

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F1, F6, F9 · **Depends on:** —

**Problem.** Imported notes are stored in seconds, computed at the file's tempo (or 120 BPM when the file has none). Typing the song's real BPM changes only state.tempo, so the ruler, the click and the bar.beat labels move while the notes stay put, and the Events tab gets duplicate beat labels. Composed notes are re-timed to a new BPM only if the Composer tab happens to be open. A second file at a different tempo is laid over the grid without notice; in a batch selection each file reads stale state, so the last file's tempo wins, and meter is ignored. The BPM field is small grey text that silently clamps values (5 becomes 20) and doesn't say that tempo changes difficulty.

**Root cause.** SET_TEMPO doesn't rescale events (projectState.ts:558-566). UnifiedTimeline.tsx:80-81 derives bar length from state.tempo. midiImport.ts:117-120 reads only the first tempo and ignores timeSignatures. useLaneImport.ts:38-138 reads stale state in its loop (124-128). The Composer re-times only when it syncs on mount (WorkspacePatternStudio / loopToLanes). WorkspaceToolbar.tsx:137-168 (BPM field).

**Recommendation.** Store event positions in musical time (ticks or beats) and derive seconds from the project tempo at render and analysis time, for imported and composed material alike. When BPM changes, rescale (or offer an explicit choice) and toast 'Tempo set to 90 BPM. Notes follow the bar grid.' Compute a batch import once, adopt the first file's tempo, and flag files whose tempo differs. Style BPM as a labelled number field that shows its range and the hint 'Tempo affects difficulty'.

**Invariants / canon.** Invariant 8: the Composer uses projectState.tempo and has no BPM of its own. Difficulty is temporal and depends on tempo, so a tempo change marks the analysis stale.

**Source findings:** [F1-V01](#f1-v01), [F9-07](#f9-07), [F1-09](#f1-09), [F6-21](#f6-21)

<a id="t50"></a>
### T50 — The timeline doesn't fill its width after importing a 4-bar clip at the project tempo

**Severity:** high · **Kind:** bug · **Effort:** S · **Flows:** F1 · **Depends on:** —

**Problem.** The auto-fit width is measured in an effect that depends only on totalDuration. The empty state returns early, so the scroll-container ref is null, and assumes a default length of 4 bars. Importing a 4-bar clip at the current tempo leaves totalDuration unchanged, so the effect never re-runs, containerWidth stays 0 and the timeline renders at a fallback width instead of filling its panel.

**Root cause.** UnifiedTimeline.tsx:95 (default of 4 bars), 226-237 (the effect depends only on [totalDuration]), 546-568 (the early return).

**Recommendation.** Measure with a callback ref or a ResizeObserver attached when the scroll container mounts. Add a regression test that imports a 4-bar clip at 120 BPM and checks that the ruler width equals the container width.

**Invariants / canon.** CLAUDE.md timeline rule: in auto-fit mode the timeline fills its container and recalculates after a MIDI import.

**Source findings:** [F1-03](#f1-03)

<a id="t51"></a>
### T51 — The Library can't start a project from a MIDI file, and projects are never named after the file

**Severity:** high · **Kind:** missing-capability · **Effort:** M · **Flows:** F1, F6 · **Depends on:** —

**Problem.** The canon lists 'import MIDI' and 'open demo project' as Portfolio features, but the Library's only import button accepts .json. Picking a .mid shows a raw JSON parser error ('Unexpected token M, MThd… is not valid JSON'). There is no demo project; the demoProjects fixture doesn't exist. Dropping a .mid anywhere does nothing, or makes the browser open it. New projects are always 'Untitled Project' and never take the file name or MIDI header name, and renaming means clicking the toolbar title, whose only hint is a hover underline. The Library fills up with identical cards, and every export downloads as 'Untitled_Project.pushflow.json'.

**Root cause.** ProjectLibraryPage.tsx:81-93, 109-114, 158-176 (accept='.json'). src/ui/fixtures contains only feasibilityDemos.ts. There is no window-level file drop handler; InteractiveGrid.tsx:412-459 prevents the default and ignores the file. midiImport.ts:152-156 computes performance.name, which is never used. useLaneImport.ts:113-126 adopts the tempo but not the name. WorkspaceToolbar.tsx:122-133.

**Recommendation.** Make 'Import MIDI' the Library's primary action. It accepts .mid/.midi (and .pushflow.json, detected by content), creates a project named after the file and goes straight to import review. Add 'Open demo project'. Add a window-level drop overlay ('Drop MIDI to import') in both the Library and the workspace, rejecting non-MIDI files with a message. On the first import into an untouched project, take the name from the file and toast 'Named "TEST MIDI 1" · Rename'. Show a pencil next to the title.

**Invariants / canon.** Import must not auto-place sounds (invariant 7) or adjust bottomLeftNote (invariant 5). Project is the top-level container.

**Source findings:** [F1-05](#f1-05), [F6-12](#f6-12), [F1-15](#f1-15), [F1-12](#f1-12), [F6-06](#f6-06)

<a id="t52"></a>
### T52 — The Library misrepresents projects: empty thumbnails for draft work, missing metadata, and a 'Current Session' that isn't the current session

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F1, F6, F10 · **Depends on:** —

**Problem.** Cards and the hero draw the mini grid and pad count from the Active Layout only. Manual edits, Suggest and Generate all produce drafts, so a project whose work sits in an unpromoted draft shows an empty 8x8 grid and 'Active Pads 0 / 64'. Cards lack the bar length, created date and last-visited date that CLAUDE.md requires, and show no Active Layout, pending-draft or variant status. Reopening a project silently restores the draft. Every 'New Project' click saves an empty project, and 'View Presets' also creates one, so an abandoned empty project becomes the 'Current Session' hero. 'Current Session' is simply the project with the newest updatedAt. '← Library' re-saves and re-stamps updatedAt even when nothing changed, so just looking at a song moves it into the hero. 'Resume Session' and 'Open Layout Editor' do the same thing.

**Root cause.** PerformanceCard.tsx:46-66, 93-120; ContinuePracticingHero.tsx:13-18, 49-51, 84-139. indexedDbStore.ts:119-131 computes durationBars, which is never shown. projectSerializer.ts:44-50, 76, 131-139. ProjectLibraryPage.tsx:70, 81-93, 204-205. QuickActionsCard.tsx:33. PerformanceWorkspace.tsx:86-89, 520 (saveNow on navigate). useAutoSave.ts:32-46 has no dirty check.

**Recommendation.** Draw the thumbnail from the layout the user will land on (working ?? active), with a state badge ('Draft, not promoted' / 'Active layout'). Card footer: '8 bars · 32 events · 7 sounds · 120 BPM'. Dates: 'Created Sep 20 · Opened 2h ago'. A status row gives the Active Layout's name, a draft pill and 'n variants'. When a reopened project restores a draft, show 'Draft from 23 Sep restored · 3 pads differ · Keep editing / Discard'. Save a new project only after its first meaningful action, or discard empty ones on leave. Make saveNow a no-op when nothing changed, track lastOpenedAt for the hero, and keep a single 'Open' button.

**Invariants / canon.** CLAUDE.md Project Library rules: cards show real BPM, sound count, bar length, event count, created date and last-visited date, and no mock data.

**Source findings:** [F1-19](#f1-19), [F6-11](#f6-11), [F6-01](#f6-01), [F10-19](#f10-19), [F1-18](#f1-18), [F6-08](#f6-08), [F6-09](#f6-09), [F6-V02](#f6-v02)

<a id="t53"></a>
### T53 — Project management actions are incomplete and risky

**Severity:** medium · **Kind:** ux-friction · **Effort:** S · **Flows:** F6 · **Depends on:** T31

**Problem.** Export and Delete exist only on grid cards. The 'Current Session' hero has neither, and the editor has no Export anywhere, so someone with a single project has no visible way to back it up. Delete is a hover-only 'close' glyph 6px from Export in a 28px cluster; it confirms through a native window.confirm and is permanent. Importing a backup gives no success feedback and always adds another identically named '<name> (imported)' copy. Import errors are developer text ('Project data missing id.').

**Root cause.** ContinuePracticingHero.tsx:13-18 takes no onExport or onDelete props. ProjectLibraryPage.tsx:95-124, 200-206. PerformanceCard.tsx:73-91, 121-123. exportProjectToFile is reachable only from cards.

**Recommendation.** Give the hero and cards the same '…' menu: Rename, Duplicate, Export, and Delete in red with a trash icon. Add 'Export project file' to the editor's title menu. Soft-delete with an Undo toast of about 10 seconds, or a 'Recently deleted' area. After an import, toast 'Imported "X" · Open'. On an id collision ask 'Replace / Keep both', and number copies. Rewrite error messages in plain language.

**Invariants / canon.** Keep the existing safeguard that a project-file import never silently overwrites a project.

**Source findings:** [F6-02](#f6-02), [F6-16](#f6-16), [F6-18](#f6-18)

<a id="t54"></a>
### T54 — The Library sidebar is mostly developer tools, vanity stats and copy for features that don't exist

**Severity:** medium · **Kind:** remove-or-demote · **Effort:** S · **Flows:** F1, F6 · **Depends on:** —

**Problem.** Quick Actions put 'Constraint Validator' and 'Temporal Evaluator', both synthetic-scenario debug harnesses, at the same level as 'New Performance', which is the third 'new' button on the page. 'View Presets' opens the most recent project in presets mode, or creates an empty project if there is none. The hero promises 'layout optimization and practice tracking', and no practice tracking exists.

**Root cause.** QuickActionsCard.tsx:29-58. LibraryStatsCard.tsx. ProjectLibraryPage.tsx:220, 275. PerformanceWorkspace.tsx:84-89 (?view=presets).

**Recommendation.** Replace Quick Actions with 'Import MIDI as new project', 'Open demo project', 'Import project file' and 'Export all'. Move the Validator and Evaluator behind a 'Developer tools' footer link or a debug flag; their routes stay. Make 'View presets' a read-only browser that never creates a project. Rewrite the hero copy around what actually exists.

**Invariants / canon.** Keep the /validator, /temporal-evaluator and /optimizer-debug routes working; only demote their entry points.

**Source findings:** [F1-20](#f1-20), [F6-14](#f6-14)

<a id="t55"></a>
### T55 — Library visuals: clipped previews, an oversized hero at 1366, a separate design system and a remote icon font

**Severity:** medium · **Kind:** visual-layout · **Effort:** M · **Flows:** F1, F6, X1 · **Depends on:** —

**Problem.** The hero's mini grid uses fixed cell sizes and overflows its overflow-hidden section (min-height 380), hiding the bottom pad rows and the 'Active Pads' caption; card thumbnails are cropped at 1366. At 1366x768 the hero fills the whole first screen. With 25 projects the page scrolls to 3490px, with no sort and no list view, and during a search the non-matching hero stays on top. The Library also uses its own type, gradient buttons and Material Symbols icons loaded from Google with no fallback, so offline the words 'search', 'arrow_forward', 'download' and 'close' appear over the UI.

**Root cause.** ContinuePracticingHero.tsx:54, 75, 124-148. MiniGridPreview.tsx:21-23 uses fixed pixel cells. PerformanceCard.tsx:81, 89, 121. ProjectLibraryPage.tsx:68-77, 141-183, 147-149, 260-262. index.html:11-12 loads the remote icon stylesheet.

**Recommendation.** Size MiniGridPreview to its container (a CSS grid with aspect-ratio 1 and width 100%) and let the hero grow to fit it. When the measured viewport is short, compact the hero to a ~160px 'Continue' strip. Add sorting (Last opened, Name, Created) and a dense list view, and hide the hero while a search is active. Use the workspace's component kit on both pages, and replace Material Symbols with bundled lucide-react icons that carry aria-labels.

**Invariants / canon.** Desktop-only: size by measurement, not breakpoints. Library cards keep showing real data.

**Source findings:** [F1-V03](#f1-v03), [F6-13](#f6-13), [F6-20](#f6-20), [X1-17](#x1-17), [F1-22](#f1-22)

<a id="t56"></a>
### T56 — Naming and copy style are inconsistent (Project / Performance / Session, casing, the 'SOUND' toggle)

**Severity:** medium · **Kind:** copy-terminology · **Effort:** S · **Flows:** F1, F6, F7, X2 · **Depends on:** —

**Problem.** The Library calls the same object 'New Project', 'New Performance', 'Add Performance', 'ACTIVE PERFORMANCES', 'PERFORMANCES', 'Current Session' and 'Resume Session', and 'Active' collides with 'Active Layout'. The transport is in ALL CAPS ('▶ PLAY', 'LOOP', 'CLICK', 'SOUND'), the toolbar in Title Case and links in sentence case. Names drift: 'Event Difficulty Chart' opens 'STACKED DIFFICULTY CHARTS', and there are both 'Import MIDI' and 'Import MIDI Files'. The toggle for audible hits is labelled 'SOUND', which collides with the canonical noun Sound used in '7 sounds' right beside it, and 'CLICK' reads like an instruction.

**Root cause.** ProjectLibraryPage.tsx:175-182, 220-227, 238, 264, 275. QuickActionsCard.tsx:39. LibraryStatsCard.tsx:63-64. ContinuePracticingHero.tsx:78, 95. UnifiedTimeline.tsx:592, 634-716. ActiveLayoutSummary.tsx:187, 204.

**Recommendation.** Use 'Project' for the container everywhere ('New project', 'Import project file', 'Your projects', 'Continue'), and keep 'performance' for the musical material only. Adopt a copy style guide: sentence case for buttons and labels, capitals only through .section-header, no abbreviations, one finger format. Rename the transport toggles 'Metronome' and 'Hits', with icons.

**Invariants / canon.** Canonical terminology (PUSHFLOW_TERMINOLOGY.md): Project is the top-level container, and 'Sound' is the noun for a Sound identity.

**Source findings:** [F1-17](#f1-17), [F6-10](#f6-10), [X2-20](#x2-20), [X2-22](#x2-22), [F7-V05](#f7-v05)

<a id="t57"></a>
### T57 — Saving can't be trusted: silent failures, a 'Saved' that isn't true, lost last edits and tabs overwriting each other

**Severity:** medium · **Kind:** state-safety · **Effort:** M · **Flows:** F6 · **Depends on:** —

**Problem.** Autosave and explicit save errors go only to the console, and clicking Save during a failure still flashes a green 'Saved'. If IndexedDB can't be opened, the Library looks as if every project was deleted, New Project silently does nothing, and existing projects show 'Project not found'. Edits made in the ~2 seconds before a reload are lost, because the async IndexedDB write fired from pagehide doesn't complete, and there is no beforeunload warning. Two tabs on the same project silently overwrite each other. The save indicator is a 'Saved' button plus a separate 'saved' label. On every edit it turns back into a 'Save' button, which suggests saving is manual. Clicking it re-stamps updatedAt, and Cmd/Ctrl+S isn't handled, so the browser's own save dialog opens.

**Root cause.** useAutoSave.ts:14, 32-46, 40-43, 65-85, 77-79, 95-109. WorkspaceToolbar.tsx:84-91, 230-248. ProjectLibraryPage.tsx:57-58, 81-93. ProjectEditorPage.tsx:42-46, 59-71. indexedDbStore.ts:52-61: put replaces the whole record. useKeyboardShortcuts.ts has no 's' handler.

**Recommendation.** Add an 'error' save status that shows a persistent red chip: 'Couldn't save · Retry · Export a copy'. Show 'Saved' only after the save actually succeeds. Tell 'no projects' apart from 'can't access storage' with a persistent error state. Save discrete, high-value actions immediately, and register beforeunload whenever the status isn't 'saved'. Keep a revision counter on each record and compare-and-swap on save. Broadcast saves over BroadcastChannel, with a banner 'Changed in another tab · Reload / Keep mine'. Replace the button and label with one passive status next to the project name, and map Cmd/Ctrl+S to 'save now'.

**Invariants / canon.** Analysis-only state (analysis, candidates) stays unpersisted. The CLAUDE.md default treats the Working/Test Layout as session-scoped unless saved or promoted, while the app currently persists it; make that choice explicit (see T52).

**Source findings:** [F6-03](#f6-03), [F6-V03](#f6-v03), [F6-07](#f6-07), [F6-04](#f6-04), [F6-V01](#f6-v01)

<a id="t58"></a>
### T58 — Transport and loop don't behave like a DAW: LOOP off still loops, loops don't snap, hits on the loop point are dropped, and audio jitters

**Severity:** high · **Kind:** bug · **Effort:** M · **Flows:** F7 · **Depends on:** —

**Problem.** With LOOP off, playback still wraps at the end, so a performance can't be played through once. Loop regions are converted straight from pixels to seconds: a drag from bar 2 to bar 4 gave 2.03-5.95s, which excludes the bar-2 downbeat. The drag ends as soon as the pointer leaves the 40px ruler. The gesture is described only in a tooltip, which gets it wrong ('shift-drag'), and there is no playhead handle. Hits and clicks exactly on the wrap point are dropped, so the opening chord is silent on every repeat. Audio is triggered 'now' from requestAnimationFrame deltas, with nothing scheduled ahead, so clicks jitter with frame timing and a main-thread stall releases a burst of skipped hits. RESET ignores the loop, and speed, loop and click settings reset every session.

**Root cause.** UnifiedTimeline.tsx:173-213: rAF time integration, and every wrap resets to regionStart. 636-644: RESET goes to 0. 758-763: I-beam cursor and onMouseLeave=handleRulerMouseUp. 671-675. rehearsalAudio.ts:205, 243 start sounds at ctx.currentTime. playWindow requires time > fromTime, and the metronome starts at floor(from/spb)+1. Transport settings are ephemeral (projectState.ts:402-410) and reset on load (projectSerializer.ts:173-188).

**Recommendation.** LOOP off stops at the end; LOOP on with no region loops the whole song. Use a look-ahead scheduler: every ~25ms, schedule the clicks and hits due in the next ~100ms at exact AudioContext times, and derive the playhead from ctx.currentTime. Make the first window after play, seek or wrap inclusive at its start, and clamp deltas to zero or more. Snap region edges to bars by default (beats with a modifier, free with Alt). Capture the pointer on mousedown. Draw the region as a draggable loop bar with bar.beat labels, add presets ('this bar', 'bars 2-3'), and separate scrubbing (the playhead handle) from region dragging. Return goes to the loop start. Remember the last loop and speed per project as rehearsal preferences, not layout truth.

**Invariants / canon.** Rehearsal settings are neither layout truth nor analysis inputs. Speed stays rehearsal-only.

**Source findings:** [F7-04](#f7-04), [F7-08](#f7-08), [F7-11](#f7-11), [F7-18](#f7-18), [F7-05](#f7-05), [F7-V01](#f7-v01)

<a id="t59"></a>
### T59 — Rehearsal lacks standard practice aids: count-in, volume and audition, voice choice, hands-separate practice

**Severity:** medium · **Kind:** missing-capability · **Effort:** M · **Flows:** F7 · **Depends on:** T58, T15

**Problem.** A countInBars state and reducer exist, but no UI sets them and playback never reads them, so there is no bar in which to get the hands back to the Push. RehearsalAudio supports a volume option and a preview(soundId) method, but neither is wired up: there is no master volume, no click/hits balance, and clicking a pad makes no sound. Each Sound's voice is a 60-900Hz blip derived from a hash of its id, so a kick can come out as a bright tick, and the same MIDI sounds different in two projects. Practising one hand at a time is impossible, even though the plan knows the hand for every hit.

**Root cause.** projectState.ts:179-180, 1328-1329: countInBars exists, but SET_COUNT_IN_BARS is never dispatched. rehearsalAudio.ts:36-37 (volume), 47-76 (voice from hashUnit), 169-173 (preview, never called). UnifiedTimeline.tsx:123-132: audibleHits filters only on mute; 647-719 has no hand filter.

**Recommendation.** Add a Count-in control (Off / 1 bar / 2 bars) next to the metronome: a click-only pre-roll with a visible 1-2-3-4 over the grid. Add a small volume popover with separate click and hits levels. Audition a pad with audio.preview() when it is clicked while stopped. Let each Sound choose a rehearsal voice (Kick / Snare / Hat / Perc / Tone), defaulting to the current hash voice. Add an ephemeral 'Hands: Both / L / R' filter that silences and dims the other hand without touching the analysis.

**Invariants / canon.** Voice choice must not be derived from MIDI pitch (invariant 5). The hands filter and audition are rehearsal-only and never feed the analysis.

**Source findings:** [F7-12](#f7-12), [F7-17](#f7-17), [F7-V03](#f7-v03), [F7-V04](#f7-v04)

<a id="t60"></a>
### T60 — Two separate transports: switching to the Composer tab freezes playback, and Composer playback is silent

**Severity:** medium · **Kind:** bug · **Effort:** M · **Flows:** F7, F9 · **Depends on:** —

**Problem.** The transport and audio engine live inside UnifiedTimeline, which unmounts when the drawer switches to the Composer. The animation loop stops and the AudioContext closes, but isPlaying stays true: the grid stops flashing, time freezes, and nothing says playback is paused. The Composer has its own Play button, which only moves the Composer's playhead. It makes no sound, lights no pads, and ignores LOOP, CLICK and SOUND.

**Root cause.** The transport and AudioContext belong to UnifiedTimeline, which unmounts on a tab switch. WorkspacePatternStudio.tsx:171-198 only dispatches SET_PLAYHEAD and has no audio.

**Recommendation.** Lift the transport and audio engine up to the workspace as a persistent transport bar above the drawer, so playback doesn't depend on which tab is visible. Composer Play then drives the shared transport, looped over the pattern region with click and hits, lighting pads and fingers as the timeline does. As an interim fix, keep both drawer tabs mounted and hide the inactive one with CSS.

**Invariants / canon.** Invariant 3: the Pattern Composer stays reachable through its bottom-drawer tab in PerformanceWorkspace. Invariant 8: the Composer uses the project tempo.

**Source findings:** [F7-13](#f7-13), [F9-16](#f9-16)

<a id="t61"></a>
### T61 — Keyboard shortcuts: Space doesn't play, handlers steal keys from other controls, and nothing is discoverable

**Severity:** high · **Kind:** accessibility · **Effort:** S · **Flows:** F4, F7, X2 · **Depends on:** T28

**Problem.** Space doesn't start or stop playback. Instead it re-activates whichever button was clicked last (LOOP, CLICK, a toolbar action). ←/→ work everywhere and wrap from the last moment back to the first, while ↑/↓/j/k work only when the Events tab is mounted and stop at the ends. Both handlers ignore only text inputs, so ArrowDown on a focused Speed or optimizer select changes the selected moment instead of the select. There is no shortcut legend, and M-to-mirror and Delete are documented nowhere.

**Root cause.** useKeyboardShortcuts.ts:18-99: no Space handler; stepping at 48-82 wraps at 70-74; Delete at 84-98. EventsPanel.tsx:163-183 adds a window listener that exempts only INPUT and TEXTAREA.

**Recommendation.** Route every shortcut through one registry that skips SELECT elements, contenteditable, role=listbox/menu and open dialogs. Space plays and stops everywhere, with preventDefault, except in text entry. Return/Home go to the start or the loop start, L toggles the loop, and [ ] change speed. Use one stepping behaviour that stops at the ends. Scope ↑/↓ to a focused Events listbox. Add a '?' shortcut sheet, a Keyboard section in Learn More, and inline hints like the existing ⌘G hint.

**Invariants / canon.** Keep the Cmd/Ctrl+G group/ungroup toggle and the existing exemption for text entry. Clicking a note still selects the whole moment.

**Source findings:** [F7-09](#f7-09), [X2-14](#x2-14), [F4-17](#f4-17), [X2-15](#x2-15)

<a id="t62"></a>
### T62 — The pad grid and Sounds list work only by mouse drag, and there is no click-to-place

**Severity:** medium · **Kind:** accessibility · **Effort:** L · **Flows:** F2, X1, X2 · **Depends on:** T28

**Problem.** None of the 64 pads can take focus, and none has a role or accessible name; all their information is in title tooltips. Sound rows are unfocusable divs. Placing, moving and swapping use HTML5 drag-and-drop only. The component's own header comment promises 'Click empty pad to assign selected sound', but clicking an empty pad only clears the event selection. Clicking a Sounds row already selects the sound, so the natural two-click flow is one handler away.

**Root cause.** InteractiveGrid.tsx:3-9 (the header comment), 492-500 (an empty-pad click only deselects), 625-682. VoicePalette.tsx:82-84 dispatches SELECT_STREAM on a row click. The probe found 64 pads and 0 focusable.

**Recommendation.** With a sound selected, clicking an empty pad places it, with an optional 'Next unplaced' auto-advance; clicking a placed pad and then an empty one moves it. Make the grid role=grid with a roving tabindex: arrows move, Enter places the selected sound or picks up/drops a pad to swap, Delete clears; Space stays play/stop (T61). Give pads aria-labels like 'Row 4, column 4, Kick, locked, left index', and make Sound rows focusable options.

**Invariants / canon.** Invariant 7: placement happens only on explicit user action, and click-to-place is explicit. Desktop-only: no touch handling needed.

**Source findings:** [F2-14](#f2-14), [X1-12](#x1-12), [X2-08](#x2-08), [F2-13](#f2-13)

<a id="t63"></a>
### T63 — Custom widgets lack roles, states and visible focus, and hover-only controls take invisible focus

**Severity:** medium · **Kind:** accessibility · **Effort:** M · **Flows:** F1, F3, F5, F6, F9, F10, X1, X2 · **Depends on:** T06

**Problem.** An ARIA census of the workspace found 1 aria attribute, 0 role=tab, 0 role=dialog and 0 live regions. Tabs expose no role or aria-selected. The settings 'checkboxes' are buttons that draw a fake box. Candidate and Active cards are clickable divs. Compare boxes are unlabeled 16px buttons, and the Active one is a div that can't take focus. Step-grid cells are divs. The 3-second timed 'Confirm?' is hard to use. Library cards are divs with onClick and tabIndex -1, and the project name and BPM are spans, so none of them can be opened or edited from the keyboard. Tab lands on opacity-0 Export, Delete and 'Remove from pad' buttons, so focus is invisible, and pressing Enter there silently removes a sound. The .focus-ring utility is never used, and pf-select removes its outline.

**Root cause.** src/ui has essentially no role or aria usage. LayoutOptionsPanel.tsx:111-137; CandidatePreviewCard.tsx:67-123, 250-255; LoopGridCanvas.tsx:177-193; LoopLaneRow.tsx:88-143; PresetCard.tsx:131-159; PerformanceCard.tsx:54-57, 74; WorkspaceToolbar.tsx:123-133, 158-167. InteractiveGrid.tsx:748-759 (opacity-0 remove button). index.css:177-180, 319.

**Recommendation.** Create a small set of primitives that require an accessible label and render role and state: Tabs (role=tablist/tab, aria-selected, ←/→), ToggleButton (aria-pressed), Checkbox, IconButton, Card (a real button or link) and GridCell. Migrate the panels to them. Replace timed confirms with the popover and undo pattern (T31). Reveal hover actions on :focus-within and focus-visible, or take them out of the tab order and offer the action by keyboard. Apply .focus-ring consistently, and make the project name and BPM real buttons or inputs.

**Invariants / canon.** Desktop-only: keyboard access is in scope, touch is not.

**Source findings:** [X2-11](#x2-11), [F3-19](#f3-19), [F10-18](#f10-18), [F5-21](#f5-21), [F9-22](#f9-22), [X1-V04](#x1-v04), [X2-21](#x2-21), [F6-15](#f6-15), [F1-23](#f1-23)

<a id="t64"></a>
### T64 — Hard to read and see: text below the type scale, targets under 24px, contrast failures and colour-only state

**Severity:** high · **Kind:** accessibility · **Effort:** M · **Flows:** F4, F7, F8, X1, X2 · **Depends on:** T04, T42

**Problem.** The pf type scale bottoms out at 11px, yet src/ui uses 10, 9, 8, 7 and 6px sizes: 68 visible text elements under 11px after import. Grid labels are then multiplied by the grid scale, so pad names are about 5.5px at 1366, and timeline finger labels are 7px on 15px pills; finger, hand and sound can't be read while playing. 84 interactive targets are under 24px (the 10px colour swatch, 20px S/M buttons, 16px compare box and delete ×, the 14px remove ×). The accent #2e5bff used as text measures 3.3-3.6:1, empty-pad coordinates 2.27:1, and hand-tinted pill text on amber 2.3:1. Several states are shown by colour alone: Solo has no active state; LOOP, CLICK and SOUND differ only by tint, and the idle PLAY looks exactly like an 'on' toggle; difficulty is a 2px border; Events costs are coloured numbers; 'next' is a dashed border on a 20%-opacity pad.

**Root cause.** The type scale in tailwind.config.js:54-62 is bypassed by text-[Npx] classes. InteractiveGrid.tsx:629, 714, 720, 726, 763. UnifiedTimeline.tsx:33-38, 626-634, 665-699, 916-974 (text-[7px]). VoicePalette.tsx:504-526, 609-636. index.css:25 (--accent-primary used as text). SettingsGear.tsx:117-124. EventsPanel.tsx:299-301.

**Recommendation.** Enforce the scale: at least 11px for UI text and 12-13px for data, with no arbitrary sizes below 11. Keep grid label sizes fixed regardless of pad size and hide secondary labels when pads are small. During playback, draw the current and next finger labels at 16-20px. Make every target at least 24x24, for example by padding S/M and the swatch into a 24px row. Use --accent-primary-soft for text and keep #2e5bff for fills. Pair every colour with a second cue: icons and filled/outlined states with aria-pressed for toggles, a larger primary PLAY button, text badges for difficulty, a hatch or glyph for unplayable, and shape cues for current and next.

**Invariants / canon.** Timeline pills show hand+finger ('L2'). Unplayable events keep a distinct visual style (invariant 4).

**Source findings:** [X1-10](#x1-10), [F7-15](#f7-15), [X2-13](#x2-13), [F8-15](#f8-15), [X1-11](#x1-11), [X2-12](#x2-12), [F4-22](#f4-22), [F7-14](#f7-14)

<a id="t65"></a>
### T65 — Presets don't work end to end: dropping does nothing, a stale handler overwrites pads, and saving records invented data

**Severity:** critical · **Kind:** bug · **Effort:** M · **Flows:** F9 · **Depends on:** T66

**Problem.** Dropping a preset on the grid does nothing, even though the ghost preview says the spot is valid: PresetCard allows only 'copy' while pads set dropEffect 'move', so the drop event never fires. Once that is fixed, the memoised drop handler keeps a stale closure: the collision check passes on occupied pads, the mirror state is ignored, and existing pads are overwritten and then pruned. With no explicit constraints, Save Preset assigns hands by column and the index finger to every pad, ignoring the fingering shown on the grid, and placement then writes these as pad constraints. Saving gives no feedback, silently creates 'pattern only' presets that can never be placed, and doesn't refresh an open preset list. The tag editor carries tags over from one preset to the next and saves them to the wrong preset. The preset UI uses raw greys, 6-10px text and cryptic 'dup ren del' labels, and shows an 'L+R' badge on presets with no pads.

**Root cause.** PresetCard.tsx:62 sets effectAllowed 'copy', while InteractiveGrid.tsx:463 sets dropEffect 'move'. InteractiveGrid.tsx:412-459: handleDrop's dependencies omit onPresetDrop. PerformanceWorkspace.tsx:204-278. WorkspacePatternStudio.tsx:281-355, with the column-rule hands and index finger at 313-326. composerPresetStorage.ts:26-41 fires no change event. PresetInspector.tsx:138-143, 388-396: TagEditor isn't keyed by preset id. PresetCard.tsx:72-176. computeHandedness in composerPreset.ts returns 'both' for an empty list.

**Recommendation.** Set dropEffect 'copy' for preset drags (or allow copyMove), read the latest onPresetDrop through a ref, validate against the layout at drop time, and show invalid reasons on the ghost. Add a Playwright drag test. At save time, capture the current Execution Plan's fingering marked as solver suggestions, or leave fingers blank, and apply them as soft preferences only on explicit request. Replace the prompt with an inline save popover that shows what will be captured and warns when no pads are placed. Fire the change event and key TagEditor by preset id. Restyle with pf tokens and full-word actions, and hide handedness when there are no pads.

**Invariants / canon.** Invariant 7: placing a preset is an explicit user action; keep it that way. Invariant 6: fingers applied from a preset go through voiceConstraints and stay soft. Placed pads must bind to real project Sound ids (T66).

**Source findings:** [F9-01](#f9-01), [F9-V01](#f9-v01), [F9-12](#f9-12), [F9-13](#f9-13), [F9-V05](#f9-v05), [F9-24](#f9-24)

<a id="t66"></a>
### T66 — Composer lanes aren't tied to project Sound identity

**Severity:** high · **Kind:** bug · **Effort:** L · **Flows:** F9 · **Depends on:** T18

**Problem.** Placing a preset creates pad voices with the Composer lane id ('llane_*'), while the matching timeline streams use 'workspace_pattern_llane_*'. The placed pads are therefore different identities from the timeline sounds, and they are pruned on the next lane action; the preset's notes never reach the timeline. Every Composer sync also overwrites the names, mute and solo of its sounds, so renaming 'Lane 1' to 'Kick' in the Sounds panel reverts as soon as the Composer syncs again. Composer finger edits are stored under the lane id, so a finger set on an unplaced lane is invisible to the Sounds panel and the solver, vanishes on the next edit, and can't be cleared.

**Root cause.** PerformanceWorkspace.tsx:227-258 sets the pad voice id to pad.laneId. loopToLanes.ts:52-54 uses the laneIdPrefix 'workspace_pattern_'. withoutOrphanedVoices (lanesReducer.ts:98-137) prunes the mismatched pads. Each Composer sync replaces the 'workspace_pattern_source' lanes with the Composer's own names, mute and solo. WorkspacePatternStudio.tsx:156-169 dispatches SET_VOICE_CONSTRAINT under the lane id and doesn't handle null.

**Recommendation.** Make the project Sound the only record. Composer lanes reference Sound ids and read name, colour, mute and solo from the project; the Composer syncs only notes. Placing a preset becomes one undoable 'Insert pattern' action with a short mapping step, where each preset slot maps to an existing Sound or a new one, and its notes are added to the one timeline at a chosen bar. Key Composer finger edits by the bound Sound id, allow clearing, and show solver suggestions as the Sounds panel does.

**Invariants / canon.** Stable Sound identity; one canonical performance timeline per project. Invariant 6: finger preferences sync across the Sounds panel, Grid Editor and Pattern Composer. Voice ID round-trip tests must keep passing.

**Source findings:** [F9-02](#f9-02), [F9-03](#f9-03), [F9-V04](#f9-v04)

<a id="t67"></a>
### T67 — The Composer keeps its state outside the project: edits are lost, aren't saved with the project, and can't be undone

**Severity:** high · **Kind:** state-safety · **Effort:** L · **Flows:** F9 · **Depends on:** T02

**Problem.** The Composer saves to localStorage 500ms after an edit and syncs to the timeline after 200ms. Switching tabs unmounts it and cancels both timers, so quick edits vanish. While the Composer plays, SET_PLAYHEAD fires every frame and restarts both timers, so nothing syncs or saves, and edits made during playback are lost on a tab switch. The pattern lives in localStorage keyed by project id, not in the IndexedDB project or its export, and placed-preset instances exist only in component memory. 'Clear' empties the Composer and removes its sounds and their pads with no confirmation, and neither the toolbar Undo nor Ctrl+Z brings it back. Meanwhile each debounced sync becomes a project undo step, so Undo desyncs the Composer from the timeline and pushes layout edits out of the 50-entry history.

**Root cause.** WorkspacePatternStudio.tsx:73-79, 183-196, 201-251, 246-250: the timers are cancelled on unmount, and loopState, which includes the playhead, is in the effect deps. WorkspacePatternStudio.tsx:357-365, 453-458 (Clear). loopStorage.ts:11-29, 51-53. composerWorkspaceReducer.ts:5 (LOAD_WORKSPACE is never used). projectSerializer doesn't include Composer state. UPSERT_LANE_SOURCE is not ephemeral (projectState.ts:393-416). useUndoRedo.ts:10 caps history at 50.

**Recommendation.** Move the Composer pattern (notes in beats) and the placement records into the project model, so they are included in autosave, export/import and the project undo stack. One note toggle becomes one undo step, and the Composer and timeline revert together. Keep the playhead in a ref or a separate, unpersisted slice. Flush pending saves and syncs on unmount and on Stop, or keep both drawer tabs mounted. Make Clear a soft action with an Undo toast that lists what was removed.

**Invariants / canon.** Invariant 3: the Composer stays a bottom-drawer tab. Invariant 8: it uses the project tempo. Don't persist analysis-only state.

**Source findings:** [F9-04](#f9-04), [F9-V02](#f9-v02), [F9-20](#f9-20), [F9-08](#f9-08), [F9-V03](#f9-v03)

<a id="t68"></a>
### T68 — It's unclear what the Composer edits, and its flow is spread across three panels

**Severity:** high · **Kind:** confusing · **Effort:** L · **Flows:** F9 · **Depends on:** T66, T67

**Problem.** The header says 'Changes sync directly into the shared performance timeline', yet the Composer shows none of the project's material ('0 lanes · 0 events' next to 7 imported sounds). What it actually does is append new generic sounds at bar 1, on top of the song, with no offset control. Composing happens in the bottom drawer and the preset library is a left tab. Preset details take over the right-hand 'Costs' tab, which keeps its label, has no close button, and stays that way after leaving Presets. Placing a preset needs the Sounds tab. A saved preset can't be reopened in the Composer or added to the timeline. The same things are called 'Lane', 'Workspace Pattern', 'Composer Presets' and 'Presets', and the Composer orders its buttons 'M S' where the rest of the app uses 'S M'.

**Root cause.** loopToLanes.ts:65 starts composed notes at step 0. PerformanceWorkspace.tsx:84-99, 163-176 (the M key handler), 600-605, 744-754 (PresetInspector swapped into the Costs slot). PresetLibraryPanel.tsx:73-98, 188-193. PresetCard.tsx:96-111, 131-159. WorkspacePatternStudio.tsx:31-33, 257. LoopLaneSidebar.tsx:37, 57. LoopLaneRow.tsx:112-134.

**Recommendation.** Pick one model and state it in the UI. Either the Composer is a quantised editor of the project timeline, showing every Sound as a lane with its imported notes, or it creates a named 'pattern section' that is inserted at a chosen bar. Put a Presets shelf inside the Composer drawer, with preset details shown in place. Give each preset 'Open in Composer', 'Add to timeline at bar…' and 'Place on grid'. Clear the preset selection when leaving Presets, and never take over the Costs tab. Use 'Sounds' wording and S/M order, and make Mirror a labelled toggle with an on-screen hint.

**Invariants / canon.** Invariant 3: the Composer stays reachable from its bottom-drawer tab; don't move or remove it without the user's explicit confirmation. One canonical performance timeline per project. Invariant 8.

**Source findings:** [F9-06](#f9-06), [F9-15](#f9-15), [F9-10](#f9-10), [F9-14](#f9-14), [F9-23](#f9-23)

<a id="t69"></a>
### T69 — The step grid's geometry drifts, and the Composer toolbar reflows under the cursor

**Severity:** high · **Kind:** visual-layout · **Effort:** M · **Flows:** F9 · **Depends on:** —

**Problem.** Step cells are given a width that the flex row then shrinks, while bar and beat lines and the playhead are placed using the unshrunk width. At 1600px, cells are 10.5px and bar headers fall every 84px but bar lines every 96px, so by bar 8 the lines are 84px off and cross the notes. At 1366px cells shrink to 6.8px, and 16-bar patterns can't be clicked. The Composer header wraps onto 2-3 rows. When the first note enables 'Save Preset', Clear wraps to a new row and the whole step grid jumps about 30px mid-sequence, so the next clicks land on the wrong lane. At 1366 the grid above is clipped too, leaving few targets for preset drops.

**Root cause.** Cell width is max(12, container/steps) without flex-shrink-0, while lines and the playhead are positioned from the unshrunk width (LoopGridCanvas / WorkspacePatternStudio). The Composer toolbar's button styles change width when a button becomes enabled.

**Recommendation.** Use one geometry source: cells, lines and playhead all computed from one cellWidth, with flex-shrink-0 on cells. Set a readable minimum cell width of 16-20px, with horizontal scrolling and a sticky lane column. Use a compact one-row toolbar with fixed-width controls and an overflow menu, so enabling a button never reflows it. Make the drawer resizable and collapsible, with a 'maximize Composer' option.

**Invariants / canon.** Desktop-only: size by measurement. The Composer tab stays in the drawer.

**Source findings:** [F9-05](#f9-05), [F9-17](#f9-17)

<a id="t70"></a>
### T70 — The step sequencer lacks basics finger drummers need

**Severity:** high · **Kind:** missing-capability · **Effort:** M · **Flows:** F9 · **Depends on:** T67

**Problem.** The finest grid is 1/8; there is no 1/16, 1/32 or triplet option. Velocity is fixed at 100, although the reducer supports SET_CELL_VELOCITY and cells already fade with velocity. Lane reorder, lane colour, MIDI note, GENERATE_RUDIMENT and GENERATE_TEST_PATTERN all exist in the reducer but not in the UI. There is no copy or duplicate bar and no pattern starters.

**Root cause.** WorkspacePatternStudio.tsx:402 offers only ['1/8','1/4','1/2','1/1']. loopEditor.ts:95-101 caps stepsPerBar at 8. loopEditorReducer.ts:36-55 holds the unused actions.

**Recommendation.** Make 1/16 the default and add 1/32 and triplets. Add velocity editing (drag vertically or Alt-click to cycle), duplicate bar, copy/paste of a selection, and lane reorder and colour. Offer an explicit 'Insert rudiment…' built on the existing rudiment generators. Rudiment insertion must add notes only and discard the generator's padAssignments and fingerAssignments; nothing is placed on the grid (invariant 7).

**Invariants / canon.** The Composer uses the project tempo and has no BPM of its own (invariant 8). A lane's MIDI note is export metadata only (invariant 5).

**Source findings:** [F9-09](#f9-09)

## All verified findings

Severity is after adversarial verification. "Verifier-added" findings were missed by the first reviewer and found by the skeptic.

### F1 · Importing a song as MIDI (first-run onboarding through sounds appearing)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f1-01"></a>F1-01 | high | broken | [T17](#t17) | Every imported Sound gets the same amber colour, so the grid cannot be read | adjusted |
| <a id="f1-02"></a>F1-02 | high | confusing | [T17](#t17) | Imported Sound names are meaningless; track names and note names are discarded | adjusted |
| <a id="f1-03"></a>F1-03 | high | broken | [T50](#t50) | Timeline does not fill its width after importing a 4-bar clip at the project tempo | confirmed |
| <a id="f1-04"></a>F1-04 | high | inconsistency | [T23](#t23) | 'Events' means notes on the Library page and moments in the workspace | confirmed |
| <a id="f1-05"></a>F1-05 | high | missing | [T51](#t51) | The Library cannot import MIDI; its only import button rejects .mid with a raw JSON parser error | confirmed |
| <a id="f1-06"></a>F1-06 | high | broken | [T47](#t47) | Re-importing a file silently duplicates every Sound | confirmed |
| <a id="f1-07"></a>F1-07 | high | missing | [T47](#t47) | No way to remove an imported file or delete a Sound; undoing an import takes 3 clicks | confirmed |
| <a id="f1-v01"></a>F1-V01 | high | broken | [T49](#t49) | Changing the BPM after import shifts the bar grid under the notes and gives the Events tab duplicate beat labels | verifier-added |
| <a id="f1-08"></a>F1-08 | medium | broken | [T48](#t48) | Import errors are generic, duplicated, and labelled 'Generation failed' with a Retry that runs Generate | adjusted |
| <a id="f1-09"></a>F1-09 | medium | broken | [T49](#t49) | Tempo and meter handling for second or batch imports is silent and sometimes wrong | confirmed |
| <a id="f1-10"></a>F1-10 | medium | missing | [T48](#t48) | Edge-case files get no feedback: empty files do nothing, more than 64 sounds import without warning | adjusted |
| <a id="f1-11"></a>F1-11 | medium | missing | [T48](#t48) | No import summary or review step | confirmed |
| <a id="f1-12"></a>F1-12 | medium | missing | [T51](#t51) | Projects are never named; the Library fills with identical 'Untitled Project' cards | confirmed |
| <a id="f1-13"></a>F1-13 | medium | confusing | [T44](#t44) | The empty workspace before import spreads guidance across four places, and only one can act | confirmed |
| <a id="f1-14"></a>F1-14 | medium | confusing | [T44](#t44) | After import the next step is ambiguous: two primary buttons plus conflicting copy | confirmed |
| <a id="f1-15"></a>F1-15 | medium | missing | [T51](#t51) | Dropping a MIDI file onto the app does not import it | confirmed |
| <a id="f1-16"></a>F1-16 | medium | friction | [T17](#t17) | Renaming Sounds is hidden and slow | confirmed |
| <a id="f1-17"></a>F1-17 | medium | inconsistency | [T56](#t56) | The Library alternates between 'Project' and 'Performance' for the same object | confirmed |
| <a id="f1-18"></a>F1-18 | medium | unnecessary | [T52](#t52) | The Library creates empty projects as a side effect | confirmed |
| <a id="f1-19"></a>F1-19 | medium | canon-violation | [T52](#t52) | Library cards are missing required project data, and the hero project cannot be deleted or exported | adjusted |
| <a id="f1-21"></a>F1-21 | medium | visual | [T04](#t04) | At 1366x768, the post-import workspace clips the grid and the rehearsal controls | adjusted |
| <a id="f1-23"></a>F1-23 | medium | accessibility | [T63](#t63) | Keyboard and screen-reader gaps in import and naming | adjusted |
| <a id="f1-v02"></a>F1-V02 | medium | visual | [T04](#t04) | Even at 1600x1000 the grid panel crops its own top and bottom, hiding the layout-state badge and hand-zone labels | verifier-added |
| <a id="f1-20"></a>F1-20 | low | unnecessary | [T54](#t54) | The first-run Library has dev tools, duplicate buttons and copy for a feature that doesn't exist | confirmed |
| <a id="f1-22"></a>F1-22 | low | visual | [T55](#t55) | Remote icon font with no fallback: icons show up as words | confirmed |
| <a id="f1-v03"></a>F1-V03 | low | visual | [T55](#t55) | The Library hero's mini-grid preview is cut off at the bottom | verifier-added |

### F2 · Manually arranging sounds on the grid

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f2-02"></a>F2-02 | critical | broken | [T06](#t06) | Pad right-click menu is drawn inside the scaled grid, so it is off-screen or shrunk; locks are unreachable | confirmed |
| <a id="f2-03"></a>F2-03 | critical | canon-violation | [T01](#t01) | Your manual draft is overwritten by Generate and by 'Preview' with no warning | confirmed |
| <a id="f2-01"></a>F2-01 | high | broken | [T02](#t02) | Undo cannot revert a manual edit (auto-analysis results fill the undo stack) | adjusted |
| <a id="f2-04"></a>F2-04 | high | visual | [T04](#t04) | Grid does not fit its space: rows, state badge and hand labels are clipped; pads are tiny on laptops | confirmed |
| <a id="f2-05"></a>F2-05 | high | visual | [T17](#t17) | Placed pads are indistinguishable: one colour for every sound and names cut to 'TEST M…' | confirmed |
| <a id="f2-07"></a>F2-07 | high | broken | [T14](#t14) | Locking a pad wipes all analysis and never re-runs it | confirmed |
| <a id="f2-10"></a>F2-10 | high | confusing | [T28](#t28) | Clicking a pad switches the whole workspace into event inspection | confirmed |
| <a id="f2-11"></a>F2-11 | high | confusing | [T25](#t25) | Partially placed layouts are presented as failures; unplaced sounds are called unplayable | adjusted |
| <a id="f2-v01"></a>F2-V01 | high | broken | [T12](#t12) | Discard leaves an invisible 'ghost' lock that drags the sound back to the abandoned pad on Generate | verifier-added |
| <a id="f2-v02"></a>F2-V02 | high | broken | [T19](#t19) | A stray click on a dimmed solver suggestion turns it into the user's own finger preference | verifier-added |
| <a id="f2-06"></a>F2-06 | medium | confusing | [T03](#t03) | The Working/Test Layout state is signalled weakly, inconsistently, and sometimes wrongly | adjusted |
| <a id="f2-08"></a>F2-08 | medium | canon-violation | [T11](#t11) | Placement locks do not hold during manual edits and are removed silently; the lock mark is barely visible | adjusted |
| <a id="f2-09"></a>F2-09 | medium | friction | [T46](#t46) | Dropping on an occupied pad silently evicts its sound, and drop feedback does not say what will happen | adjusted |
| <a id="f2-12"></a>F2-12 | medium | friction | [T31](#t31) | Discard and toolbar Promote have no guardrails; Discard cannot be undone | confirmed |
| <a id="f2-13"></a>F2-13 | medium | missing | [T62](#t62) | No click-to-place: drag is the only way to place or move a sound | confirmed |
| <a id="f2-14"></a>F2-14 | medium | accessibility | [T62](#t62) | Grid is mouse-only and hard to perceive: pads not focusable, tiny hover-only targets, colour-only cues | confirmed |
| <a id="f2-16"></a>F2-16 | medium | inconsistency | [T19](#t19) | Finger/hand preference lives in three different controls with three notations; hand-only preference is impossible | adjusted |
| <a id="f2-17"></a>F2-17 | medium | confusing | [T16](#t16) | Muting or soloing a sound freezes its pad (or every other pad) | confirmed |
| <a id="f2-19"></a>F2-19 | medium | missing | [T45](#t45) | Sounds list gives no priority or progress cues for manual arrangement | confirmed |
| <a id="f2-v03"></a>F2-V03 | medium | friction | [T28](#t28) | Backspace/Delete removes a sound from the grid whenever any event is selected, including via arrow keys or timeline clicks | verifier-added |
| <a id="f2-v04"></a>F2-V04 | medium | inconsistency | [T32](#t32) | Promoted Active Layout keeps the '(draft)' suffix, so the Active badge sits next to 'Default (draft)' | verifier-added |
| <a id="f2-15"></a>F2-15 | low | inconsistency | [T43](#t43) | Coordinate noise on every pad and four different position formats | adjusted |
| <a id="f2-18"></a>F2-18 | low | broken | [T46](#t46) | Dragging a pad onto the Sounds list reorders the list instead of unplacing the sound | adjusted |
| <a id="f2-20"></a>F2-20 | low | missing | [T46](#t46) | No multi-pad selection or group moves | adjusted |
| <a id="f2-21"></a>F2-21 | low | unnecessary | [T39](#t39) | Settings popover contains a no-op toggle and mixes grid display with cost-model controls | confirmed |
| <a id="f2-22"></a>F2-22 | low | canon-violation | [T44](#t44) | Placement copy tells users to 'Generate to analyze', mixing Analyze and Generate | confirmed |
| <a id="f2-v05"></a>F2-V05 | low | confusing | [T14](#t14) | No-op gestures create a Working/Test Layout and wipe the analysis | verifier-added |

### F3 · Automatically arranging sounds on the grid (Suggest starting layout + Generate candidates)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f3-01"></a>F3-01 | critical | canon-violation | [T11](#t11) | Beam and Annealing Generate ignore placement locks, delete them, and discard the user's arrangement | confirmed |
| <a id="f3-02"></a>F3-02 | critical | canon-violation | [T01](#t01) | Generate and Preview silently overwrite the Working/Test Layout with a candidate | confirmed |
| <a id="f3-03"></a>F3-03 | critical | broken | [T02](#t02) | Undo can't reverse Generate, Preview or Suggest | confirmed |
| <a id="f3-04"></a>F3-04 | high | confusing | [T34](#t34) | The method dropdown offers non-choices, and its labels misdescribe what ran | confirmed |
| <a id="f3-05"></a>F3-05 | high | friction | [T35](#t35) | Generation shows no progress or ETA, has no cancel, and leaves conflicting actions live | confirmed |
| <a id="f3-06"></a>F3-06 | high | broken | [T33](#t33) | The optimization trace exists only for Greedy, never shows stopReason, and vanishes on promote | confirmed |
| <a id="f3-08"></a>F3-08 | high | missing | [T26](#t26) | Cards don't show what changed; the mini grid is color-only and nearly information-free | confirmed |
| <a id="f3-12"></a>F3-12 | high | confusing | [T01](#t01) | The Active card, the draft and the previewed candidate blur together | confirmed |
| <a id="f3-v01"></a>F3-V01 | high | broken | [T15](#t15) | Generating while a sound is muted deletes that sound from the layout, and the score then looks better | verifier-added |
| <a id="f3-v02"></a>F3-V02 | high | inconsistency | [T21](#t21) | Before and after Generate are measured with two different yardsticks, so the improvement is partly a change of units | verifier-added |
| <a id="f3-07"></a>F3-07 | medium | confusing | [T33](#t33) | Trace numbers contradict each other, and step replay isn't labeled as replay | adjusted |
| <a id="f3-09"></a>F3-09 | medium | inconsistency | [T21](#t21) | Card scores use two conflicting number systems and don't differentiate candidates | adjusted |
| <a id="f3-10"></a>F3-10 | medium | visual | [T34](#t34) | Card names are truncated jargon that leaks algorithm internals | confirmed |
| <a id="f3-11"></a>F3-11 | medium | canon-violation | [T36](#t36) | Beam and Annealing return cosmetic copies, and low diversity is never explained | confirmed |
| <a id="f3-13"></a>F3-13 | medium | inconsistency | [T13](#t13) | The two Promote paths behave differently: confirm, naming, list, and even fingering | confirmed |
| <a id="f3-14"></a>F3-14 | medium | broken | [T08](#t08) | Compare selection goes stale after delete or regenerate, leading to a self-compare or a modal that can't be closed | confirmed |
| <a id="f3-16"></a>F3-16 | medium | missing | [T37](#t37) | 'Suggest a starting layout' disappears once any sound is placed, and it isn't undoable | confirmed |
| <a id="f3-18"></a>F3-18 | medium | visual | [T38](#t38) | Candidates are buried in a long single column, and at 1366x768 the grid hides the applied result | adjusted |
| <a id="f3-v03"></a>F3-V03 | medium | confusing | [T48](#t48) | The Layouts panel calls every error 'Generation failed' and offers a Retry that runs Generate | verifier-added |
| <a id="f3-v04"></a>F3-V04 | medium | missing | [T30](#t30) | Each Generate silently throws away the previous candidate set, so runs can't be compared | verifier-added |
| <a id="f3-15"></a>F3-15 | low | canon-violation | [T37](#t37) | Generate on an empty grid auto-places every sound, contradicting the on-screen guidance and CLAUDE.md invariant 7 | adjusted |
| <a id="f3-17"></a>F3-17 | low | missing | [T34](#t34) | Nothing helps the user choose method, strategy or intensity, and settings apply unevenly | adjusted |
| <a id="f3-19"></a>F3-19 | low | accessibility | [T63](#t63) | Candidate cards and controls are hard to use with keyboard or assistive tech | confirmed |
| <a id="f3-20"></a>F3-20 | low | missing | [T30](#t30) | No 'Save as variant' on candidate cards, and the workaround misnames the variant | confirmed |
| <a id="f3-v05"></a>F3-V05 | low | inconsistency | [T11](#t11) | Thorough (deep annealing) ignores the finger choices the user set | verifier-added |

### F4 · Viewing the performance on the selected layout (event stepping, onion skin, transitions, finger display, timeline↔grid sync)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f4-01"></a>F4-01 | critical | broken | [T09](#t09) | Onion skin toggle has no visible effect | confirmed |
| <a id="f4-02"></a>F4-02 | high | missing | [T09](#t09) | The upcoming transition (who moves where next) is effectively invisible | adjusted |
| <a id="f4-03"></a>F4-03 | high | broken | [T24](#t24) | Humanized or recorded chords break moment selection (list, grid, keys and timeline disagree) | adjusted |
| <a id="f4-04"></a>F4-04 | high | broken | [T07](#t07) | Event inspector gives misleading verdicts and hides the Alternation factor | adjusted |
| <a id="f4-05"></a>F4-05 | high | broken | [T22](#t22) | Events list inflates chord costs by the number of notes | confirmed |
| <a id="f4-09"></a>F4-09 | high | missing | [T27](#t27) | No 'why is this moment hard' explanation and no jump between difficult moments | confirmed |
| <a id="f4-10"></a>F4-10 | high | visual | [T04](#t04) | At 1366x768 the grid is squeezed and clipped, and transition info is off-screen | confirmed |
| <a id="f4-v01"></a>F4-V01 | high | broken | [T24](#t24) | The inspected moment silently jumps to a different moment after any re-analysis on Generate/Preview plans | verifier-added |
| <a id="f4-06"></a>F4-06 | medium | inconsistency | [T27](#t27) | Events list colours and values ignore the engine's difficulty classes | adjusted |
| <a id="f4-07"></a>F4-07 | medium | missing | [T27](#t27) | Event rows don't say what is played | adjusted |
| <a id="f4-08"></a>F4-08 | medium | broken | [T43](#t43) | Off-beat events get identical beat labels | adjusted |
| <a id="f4-11"></a>F4-11 | medium | confusing | [T09](#t09) | Selection rendering erases sound identity and layout context | adjusted |
| <a id="f4-12"></a>F4-12 | medium | confusing | [T27](#t27) | Selected-event inspector is far from the list and describes only one note | adjusted |
| <a id="f4-13"></a>F4-13 | medium | inconsistency | [T24](#t24) | Event numbers and time units differ between panels | adjusted |
| <a id="f4-14"></a>F4-14 | medium | inconsistency | [T42](#t42) | Hand/finger notation and hand colours vary by surface | confirmed |
| <a id="f4-15"></a>F4-15 | medium | friction | [T10](#t10) | Selection and playhead are disconnected; selection greys out playback | adjusted |
| <a id="f4-17"></a>F4-17 | medium | friction | [T61](#t61) | Keyboard stepping is inconsistent and undiscoverable | adjusted |
| <a id="f4-18"></a>F4-18 | medium | broken | [T28](#t28) | Backspace/Delete while inspecting an event removes a sound from the grid | confirmed |
| <a id="f4-20"></a>F4-20 | medium | broken | [T24](#t24) | Clicking a muted stream's note selects an unrelated event | adjusted |
| <a id="f4-v02"></a>F4-V02 | medium | canon-violation | [T01](#t01) | 'Preview' is not a preview: it overwrites the Working/Test Layout with the candidate | verifier-added |
| <a id="f4-16"></a>F4-16 | low | friction | [T09](#t09) | Onion and arrow controls are hidden, unlabeled and split across panels | adjusted |
| <a id="f4-19"></a>F4-19 | low | confusing | [T28](#t28) | Clicking a pad while inspecting jumps to that sound's first hit | adjusted |
| <a id="f4-21"></a>F4-21 | low | canon-violation | [T03](#t03) | Event views never name the layout they analyse | adjusted |
| <a id="f4-22"></a>F4-22 | low | accessibility | [T64](#t64) | Moment state relies on tiny text, colour only, and non-focusable pads | confirmed |
| <a id="f4-v03"></a>F4-V03 | low | friction | [T27](#t27) | Clicking inside an expanded Events row does not select it | verifier-added |

### F5 · Analyzing the costs of different layouts for a performance (costs panel, difficulty chart, compare, explanations)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f5-01"></a>F5-01 | critical | broken | [T07](#t07) | Selecting an event turns the feasibility banner into a false 'Feasible: All events playable' | confirmed |
| <a id="f5-02"></a>F5-02 | critical | broken | [T08](#t08) | Compare vs Active Layout shows an empty grid, all-zero metrics, the label 'Easy', and claims Active is '13% easier' | confirmed |
| <a id="f5-03"></a>F5-03 | high | broken | [T08](#t08) | Promoting from inside Compare leaves a dead-end 'Not enough candidates to compare.' screen | adjusted |
| <a id="f5-04"></a>F5-04 | high | inconsistency | [T20](#t20) | The same five cost factors appear under 7+ different names and two colour mappings | confirmed |
| <a id="f5-05"></a>F5-05 | high | canon-violation | [T20](#t20) | Compare lists raw internal ids instead of sound names, and counts pads as 'voices' | confirmed |
| <a id="f5-06"></a>F5-06 | high | confusing | [T21](#t21) | Four or more competing score systems, with different scales, polarity and precision | confirmed |
| <a id="f5-10"></a>F5-10 | high | missing | [T26](#t26) | No baseline-relative explanation outside Compare, and no way to compare against your own draft | confirmed |
| <a id="f5-v01"></a>F5-V01 | high | broken | [T22](#t22) | Chord moments are scored once per note, so the Events list and the difficulty chart mostly flag chords, not hard moments | verifier-added |
| <a id="f5-v02"></a>F5-V02 | high | confusing | [T01](#t01) | Clicking the Active card highlights it but keeps the draft on screen, and silently re-scores the draft with a different solver | verifier-added |
| <a id="f5-07"></a>F5-07 | medium | inconsistency | [T24](#t24) | The same moment gets three different numbers: Events list, cost-panel badge and chart | adjusted |
| <a id="f5-08"></a>F5-08 | medium | inconsistency | [T23](#t23) | 'Events' means notes in some places and moments in others (e.g. '37 events need attention' out of 32) | confirmed |
| <a id="f5-09"></a>F5-09 | medium | canon-violation | [T03](#t03) | The Costs tab never says which layout it describes, and a previewed candidate is labelled 'Draft', not 'Candidate' | adjusted |
| <a id="f5-11"></a>F5-11 | medium | missing | [T26](#t26) | Compare doesn't say what improved or worsened, omits the canonical factors, and duplicates its own bars | adjusted |
| <a id="f5-12"></a>F5-12 | medium | confusing | [T40](#t40) | Ergonomics bars are scaled to the layout's own largest factor and carry no units or direction | confirmed |
| <a id="f5-13"></a>F5-13 | medium | inconsistency | [T27](#t27) | Event cost colours contradict the Difficulty verdict, and 'N events need attention' isn't actionable | confirmed |
| <a id="f5-14"></a>F5-14 | medium | unnecessary | [T38](#t38) | Costs and Layouts tabs duplicate the analysis, but each is missing parts of it | confirmed |
| <a id="f5-15"></a>F5-15 | medium | confusing | [T34](#t34) | Candidate explanations don't tell candidates apart and use optimizer jargon | confirmed |
| <a id="f5-16"></a>F5-16 | medium | broken | [T06](#t06) | 'Enlarge' chart modal is trapped inside the ~270px right panel and ignores Escape | confirmed |
| <a id="f5-17"></a>F5-17 | medium | visual | [T40](#t40) | The difficulty chart has no scale, no thresholds, no musical time axis, and is hidden by default | confirmed |
| <a id="f5-18"></a>F5-18 | medium | confusing | [T39](#t39) | Cost-evaluation toggles don't affect the Costs panel, and 'Calculate Cost' adds a third number system | confirmed |
| <a id="f5-19"></a>F5-19 | medium | missing | [T41](#t41) | Learn More doesn't explain the numbers on screen, isn't reachable from the Costs tab, and reads like engine docs | confirmed |
| <a id="f5-20"></a>F5-20 | medium | confusing | [T25](#t25) | A partially placed layout reads as 'Infeasible, Score 0%', and the Costs tab doesn't say which sounds are missing | confirmed |
| <a id="f5-v03"></a>F5-V03 | medium | broken | [T14](#t14) | Muting, soloing or changing tempo while a candidate is selected leaves the cost panel on the old plan with no stale cue | verifier-added |
| <a id="f5-21"></a>F5-21 | low | accessibility | [T63](#t63) | Compare and analysis controls are hard to use by keyboard or screen reader | confirmed |
| <a id="f5-22"></a>F5-22 | low | visual | [T26](#t26) | Compare modal wastes space at 1600px and hides its actions below the fold at 1366px | adjusted |
| <a id="f5-v04"></a>F5-V04 | low | inconsistency | [T42](#t42) | In Compare, blue and purple mean both 'layout A vs B' and 'left vs right hand', and right hand is orange elsewhere | verifier-added |

### F6 · Saving and loading performances (projects, autosave, library, export/import)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f6-01"></a>F6-01 | high | confusing | [T52](#t52) | Library shows an empty grid for projects whose work is in an unpromoted draft | confirmed |
| <a id="f6-06"></a>F6-06 | high | friction | [T51](#t51) | Every project is 'Untitled Project' because the name never comes from the MIDI file and rename is hidden | adjusted |
| <a id="f6-17"></a>F6-17 | high | broken | [T02](#t02) | Undo is enabled on a freshly opened project, and pressing it quietly wipes the analysis | adjusted |
| <a id="f6-02"></a>F6-02 | medium | missing | [T53](#t53) | The current project can't be exported, deleted or renamed from the library, and the editor has no Export | adjusted |
| <a id="f6-03"></a>F6-03 | medium | broken | [T57](#t57) | Save failures are silent, and the Save button says 'Saved' even when the save failed | adjusted |
| <a id="f6-04"></a>F6-04 | medium | broken | [T57](#t57) | Edits made in the ~2s before a page reload are silently lost | adjusted |
| <a id="f6-05"></a>F6-05 | medium | confusing | [T30](#t30) | Generated candidates and the move trace disappear on leaving the project, with no warning | adjusted |
| <a id="f6-07"></a>F6-07 | medium | unnecessary | [T57](#t57) | Save indicator is doubled, looks like a button that must be pressed, flickers on every edit, and Cmd/Ctrl+S isn't handled | confirmed |
| <a id="f6-08"></a>F6-08 | medium | friction | [T52](#t52) | New Project saves an empty project immediately, and an abandoned one takes over 'Current Session' | confirmed |
| <a id="f6-09"></a>F6-09 | medium | confusing | [T52](#t52) | 'Resume Session' and 'Open Layout Editor' do the same thing, and 'Current Session' is just the last-modified project | confirmed |
| <a id="f6-10"></a>F6-10 | medium | inconsistency | [T56](#t56) | One object, five names (Project, Performance, Session, 'Active Performances') and copy that promises missing features | confirmed |
| <a id="f6-11"></a>F6-11 | medium | canon-violation | [T52](#t52) | Cards omit required metadata and layout status (bar length, created date, last visited, active layout, variants) | confirmed |
| <a id="f6-12"></a>F6-12 | medium | missing | [T51](#t51) | The library can't import MIDI directly or open a demo project | confirmed |
| <a id="f6-13"></a>F6-13 | medium | visual | [T55](#t55) | Library grid previews are clipped: the hero hides two pad rows and its 'Active Pads' footer, and cards are cropped at 1366 | adjusted |
| <a id="f6-14"></a>F6-14 | medium | unnecessary | [T54](#t54) | The library sidebar is mostly developer tools and vanity stats | confirmed |
| <a id="f6-15"></a>F6-15 | medium | accessibility | [T63](#t63) | The library and project title aren't keyboard-operable, and Tab lands on invisible controls | confirmed |
| <a id="f6-16"></a>F6-16 | medium | friction | [T53](#t53) | Delete is a hover-only 'X' next to Export, permanent, and drawn with a remote icon font | confirmed |
| <a id="f6-19"></a>F6-19 | medium | missing | [T29](#t29) | Save Variant saves with an automatic name and variants can't be renamed | confirmed |
| <a id="f6-v01"></a>F6-V01 | medium | broken | [T57](#t57) | Two tabs on the same project silently overwrite each other (last writer wins) | verifier-added |
| <a id="f6-v03"></a>F6-V03 | medium | confusing | [T57](#t57) | When storage is unavailable, the library looks empty, New Project does nothing, and existing projects show 'Project not found' | verifier-added |
| <a id="f6-18"></a>F6-18 | low | friction | [T53](#t53) | Import gives no success feedback and piles up identically named duplicates | adjusted |
| <a id="f6-20"></a>F6-20 | low | visual | [T55](#t55) | The library doesn't scale on a 1366x768 laptop: the hero fills the screen, there is no sort or list view, and search ignores the hero | confirmed |
| <a id="f6-21"></a>F6-21 | low | friction | [T49](#t49) | BPM edit is easy to miss, silently clamps values, and doesn't say it changes difficulty | confirmed |
| <a id="f6-v02"></a>F6-V02 | low | confusing | [T52](#t52) | Viewing a project marks it 'edited' and moves it to Current Session | verifier-added |

### F7 · Rehearsing a performance (playback, loop, speed, click, sound, following along on the grid)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f7-01"></a>F7-01 | critical | broken | [T10](#t10) | A selected event freezes the grid during playback and hides the pad flashes | confirmed |
| <a id="f7-02"></a>F7-02 | high | broken | [T05](#t05) | Rehearsal toggles are clipped off-screen (LOOP/CLICK/SOUND at 1366px, ✕ REGION even at 1600px) | confirmed |
| <a id="f7-03"></a>F7-03 | high | visual | [T04](#t04) | The grid is too small to follow along while rehearsing on a laptop, and there is no practice layout | confirmed |
| <a id="f7-07"></a>F7-07 | high | missing | [T10](#t10) | No direct path from a difficult event to rehearsing it | confirmed |
| <a id="f7-08"></a>F7-08 | high | friction | [T58](#t58) | Loop regions don't snap to the beat grid, so the loop starts just after the downbeat | confirmed |
| <a id="f7-09"></a>F7-09 | high | accessibility | [T61](#t61) | No Space-bar play/stop, and Space re-triggers whatever button was last clicked | confirmed |
| <a id="f7-v01"></a>F7-V01 | high | broken | [T58](#t58) | Rehearsal audio is frame-driven, so clicks jitter and skipped hits fire as a burst after any stall | verifier-added |
| <a id="f7-04"></a>F7-04 | medium | broken | [T58](#t58) | LOOP off still loops, so there is no way to play the performance once | adjusted |
| <a id="f7-05"></a>F7-05 | medium | broken | [T58](#t58) | Hits and clicks exactly on the loop or wrap point are dropped, so the first chord is silent on every repeat | adjusted |
| <a id="f7-06"></a>F7-06 | medium | missing | [T09](#t09) | No look-ahead: the grid only reacts to the current strike and never shows what comes next | adjusted |
| <a id="f7-10"></a>F7-10 | medium | canon-violation | [T15](#t15) | Mute and Solo for listening silently change the analysis and project state | adjusted |
| <a id="f7-11"></a>F7-11 | medium | friction | [T58](#t58) | Loop-drag gesture is fragile and undiscoverable, and clashes with scrubbing | confirmed |
| <a id="f7-12"></a>F7-12 | medium | missing | [T59](#t59) | No count-in, even though the state for it exists | confirmed |
| <a id="f7-13"></a>F7-13 | medium | inconsistency | [T60](#t60) | Switching to the Composer tab silently freezes playback, and there are two separate transports | confirmed |
| <a id="f7-14"></a>F7-14 | medium | confusing | [T64](#t64) | Toggle on/off states are ambiguous and inconsistent | confirmed |
| <a id="f7-15"></a>F7-15 | medium | visual | [T64](#t64) | Finger, hand and sound identity is hard to read while playing | confirmed |
| <a id="f7-v02"></a>F7-V02 | medium | missing | [T10](#t10) | Pausing leaves the grid blank, so you can't stop and look at where your hands should be | verifier-added |
| <a id="f7-16"></a>F7-16 | low | inconsistency | [T43](#t43) | Position is shown in seconds while everything else uses bars and beats, and it can read '-0.00s' | confirmed |
| <a id="f7-17"></a>F7-17 | low | missing | [T59](#t59) | Audio controls are incomplete: no volume, no pad audition, no click level | confirmed |
| <a id="f7-18"></a>F7-18 | low | friction | [T58](#t58) | Practice setup is not remembered and has no progression aids | confirmed |
| <a id="f7-v03"></a>F7-V03 | low | missing | [T59](#t59) | No hands-separate practice | verifier-added |
| <a id="f7-v04"></a>F7-V04 | low | confusing | [T59](#t59) | Rehearsal voices are arbitrary hashed blips that don't resemble the part | verifier-added |
| <a id="f7-v05"></a>F7-V05 | low | inconsistency | [T56](#t56) | The 'SOUND' toggle label collides with the canonical 'Sound' noun | verifier-added |

### F8 · Defining and managing Sound identity (rename, color, grouping, mute/solo, finger preferences, filters)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f8-01"></a>F8-01 | high | visual | [T17](#t17) | Imported sounds get meaningless names and one shared color, so all sounds look alike everywhere | adjusted |
| <a id="f8-02"></a>F8-02 | high | broken | [T15](#t15) | Mute/Solo silently removes sounds from analysis, and Generate drops them from the layout | adjusted |
| <a id="f8-03"></a>F8-03 | high | broken | [T19](#t19) | Clicking a suggested finger and clicking away silently makes it a user preference | confirmed |
| <a id="f8-04"></a>F8-04 | high | broken | [T02](#t02) | Undo takes 2–3 presses per sound edit; the first presses do nothing visible | confirmed |
| <a id="f8-07"></a>F8-07 | high | inconsistency | [T20](#t20) | Compare lists 'Affected sounds' as internal IDs | confirmed |
| <a id="f8-v01"></a>F8-V01 | high | canon-violation | [T18](#t18) | Sounds that share a MIDI pitch are merged in analysis: unplaced sounds are 'played' on another sound's pad | verifier-added |
| <a id="f8-v02"></a>F8-V02 | high | broken | [T12](#t12) | Finger preference shown on the chip and grid disagrees with the finger the plan uses (after Discard, and whenever the solver overrides) | verifier-added |
| <a id="f8-05"></a>F8-05 | medium | broken | [T16](#t16) | Solo has no lit state, ignores Unmute while active, and wipes earlier mutes | adjusted |
| <a id="f8-06"></a>F8-06 | medium | broken | [T45](#t45) | Grouping or recoloring a group overwrites colors the user picked | adjusted |
| <a id="f8-08"></a>F8-08 | medium | visual | [T17](#t17) | Pad labels cut off the part of the name that tells sounds apart | adjusted |
| <a id="f8-09"></a>F8-09 | medium | canon-violation | [T45](#t45) | No assigned/unassigned/locked filter or search in the Sounds tab (canon requires it) | confirmed |
| <a id="f8-10"></a>F8-10 | medium | confusing | [T45](#t45) | Grouping and placement status are mixed in one list, and 'not placed' is barely visible | confirmed |
| <a id="f8-11"></a>F8-11 | medium | missing | [T45](#t45) | The Sounds row cannot lock, unplace or delete a sound | adjusted |
| <a id="f8-12"></a>F8-12 | medium | broken | [T46](#t46) | Dragging a pad onto the Sounds list silently reorders the list | confirmed |
| <a id="f8-13"></a>F8-13 | medium | friction | [T16](#t16) | A muted sound's pad cannot be edited on the grid | confirmed |
| <a id="f8-14"></a>F8-14 | medium | accessibility | [T17](#t17) | Rename works only by double-click, and rows cannot be reached by keyboard | adjusted |
| <a id="f8-16"></a>F8-16 | medium | confusing | [T19](#t19) | The finger chip hides key facts: first assignment only, typed input only, invalid input ignored | confirmed |
| <a id="f8-17"></a>F8-17 | medium | inconsistency | [T27](#t27) | The Events list and candidate mini-grids don't say which sounds they contain | confirmed |
| <a id="f8-18"></a>F8-18 | medium | inconsistency | [T45](#t45) | The timeline ignores grouping and order, and its lane headers can't select a sound | adjusted |
| <a id="f8-19"></a>F8-19 | medium | friction | [T45](#t45) | Grouping is hidden and half-finished | confirmed |
| <a id="f8-v03"></a>F8-V03 | medium | confusing | [T14](#t14) | Pure identity edits (rename, recolor, group, reorder) mark the analysis 'outdated' and re-run the solver | verifier-added |
| <a id="f8-v04"></a>F8-V04 | medium | missing | [T47](#t47) | Import only appends: a second or accidental import duplicates every sound (same names, same amber) and there is no way to remove a file or a sound | verifier-added |
| <a id="f8-15"></a>F8-15 | low | accessibility | [T64](#t64) | Controls are tiny, unlabeled and low-contrast | adjusted |
| <a id="f8-20"></a>F8-20 | low | inconsistency | [T43](#t43) | Pad positions appear as bare 0-indexed coordinates in four formats | confirmed |
| <a id="f8-21"></a>F8-21 | low | unnecessary | [T45](#t45) | Dead lane components and duplicated S/M controls | confirmed |
| <a id="f8-v05"></a>F8-V05 | low | visual | [T42](#t42) | Sound highlight uses the same blue as the 'next event' pad marker and can only be cleared by re-clicking the row | verifier-added |

### F9 · Composing patterns in-app (Pattern Composer tab + Presets)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f9-01"></a>F9-01 | critical | broken | [T65](#t65) | Dropping a preset on the grid does nothing, while the ghost preview says the spot is valid | confirmed |
| <a id="f9-02"></a>F9-02 | high | confusing | [T66](#t66) | Placing a preset adds duplicate sounds with no notes and leaves the timeline untouched | adjusted |
| <a id="f9-03"></a>F9-03 | high | canon-violation | [T66](#t66) | The Composer undoes renames (and M/S changes) made elsewhere to its sounds | confirmed |
| <a id="f9-04"></a>F9-04 | high | broken | [T67](#t67) | Composer edits are lost when switching tabs quickly | confirmed |
| <a id="f9-05"></a>F9-05 | high | visual | [T69](#t69) | Step-grid layout is wrong: bar lines and playhead drift, and cells become invisible at 1366 px | confirmed |
| <a id="f9-06"></a>F9-06 | high | confusing | [T68](#t68) | It is unclear what the Composer edits or how it relates to the imported song | confirmed |
| <a id="f9-08"></a>F9-08 | high | broken | [T67](#t67) | Clear and other destructive Composer actions have no confirmation and cannot be undone | adjusted |
| <a id="f9-09"></a>F9-09 | high | missing | [T70](#t70) | The step sequencer lacks basics finger drummers need (no 1/16, no velocity, no pattern starters) | confirmed |
| <a id="f9-v01"></a>F9-V01 | high | broken | [T65](#t65) | Preset drop handler is stale: it skips collision checks, overwrites existing pads, and those pads are then deleted | verifier-added |
| <a id="f9-v02"></a>F9-V02 | high | broken | [T67](#t67) | Composer playback freezes syncing and saving, and edits made while playing are lost on a tab switch | verifier-added |
| <a id="f9-v04"></a>F9-V04 | high | canon-violation | [T66](#t66) | Composer finger field: fingers on unplaced lanes vanish on the next edit, are never shown in the Sounds panel, and cannot be cleared | verifier-added |
| <a id="f9-07"></a>F9-07 | medium | inconsistency | [T49](#t49) | Changing BPM re-times composed notes only if the Composer tab happens to be open | adjusted |
| <a id="f9-10"></a>F9-10 | medium | friction | [T68](#t68) | Selecting a preset takes over the Costs tab and leaves it there | confirmed |
| <a id="f9-11"></a>F9-11 | medium | canon-violation | [T21](#t21) | Preset 'Metric Breakdown' is a second, non-standard scoring system with developer wording | confirmed |
| <a id="f9-12"></a>F9-12 | medium | broken | [T65](#t65) | Save Preset records made-up fingerings that then spread back as constraints | confirmed |
| <a id="f9-13"></a>F9-13 | medium | friction | [T65](#t65) | Save Preset gives no feedback, can create presets that can never be placed, and leaves the list stale | confirmed |
| <a id="f9-14"></a>F9-14 | medium | missing | [T68](#t68) | A saved preset can't be reopened in the Composer or added to the timeline | confirmed |
| <a id="f9-15"></a>F9-15 | medium | confusing | [T68](#t68) | The flow is spread over three panels and hard to discover | confirmed |
| <a id="f9-16"></a>F9-16 | medium | missing | [T60](#t60) | Composer playback is silent and not connected to the grid or the main transport | confirmed |
| <a id="f9-18"></a>F9-18 | medium | canon-violation | [T18](#t18) | Composer lanes are matched to sounds and pads by MIDI pitch | adjusted |
| <a id="f9-19"></a>F9-19 | medium | broken | [T14](#t14) | Just looking at the Composer marks the project unsaved and the analysis outdated | confirmed |
| <a id="f9-20"></a>F9-20 | medium | missing | [T67](#t67) | Composer work and placed presets are not stored with the project | confirmed |
| <a id="f9-22"></a>F9-22 | medium | accessibility | [T63](#t63) | The step grid and preset actions can't be used from the keyboard or by screen readers | confirmed |
| <a id="f9-v03"></a>F9-V03 | medium | broken | [T67](#t67) | Every Composer sync becomes a project Undo step: Undo desyncs Composer and timeline and pushes out layout history | verifier-added |
| <a id="f9-v05"></a>F9-V05 | medium | broken | [T65](#t65) | Preset tag editor carries tags from one preset to the next and saves them to the wrong preset | verifier-added |
| <a id="f9-17"></a>F9-17 | low | visual | [T69](#t69) | At 1366x768 the grid is clipped and the Composer header jumps while you click | adjusted |
| <a id="f9-21"></a>F9-21 | low | friction | [T31](#t31) | Browser pop-ups (prompt, alert, confirm) are used for naming, placement errors and deletes | adjusted |
| <a id="f9-23"></a>F9-23 | low | inconsistency | [T68](#t68) | Naming and control order don't match the rest of the app | confirmed |
| <a id="f9-24"></a>F9-24 | low | visual | [T65](#t65) | Preset panel looks unlike the rest of the app and shows misleading details | confirmed |

### F10 · Layout state & lifecycle (Active vs Working/Test vs Saved Variant vs Candidate; Promote / Save Variant / Discard; returning to variants)

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="f10-01"></a>F10-01 | critical | broken | [T01](#t01) | Preview, a click on a candidate card, Generate and Load Draft all silently overwrite the user's Working draft | confirmed |
| <a id="f10-02"></a>F10-02 | critical | broken | [T08](#t08) | Compare shows the Active Layout as empty and 'Easy' with a score of 0 whenever a draft exists, then says it is the easier layout | confirmed |
| <a id="f10-06"></a>F10-06 | critical | broken | [T02](#t02) | Undo is not a safety net for Discard or Promote: the first Undo undoes an invisible analysis step | adjusted |
| <a id="f10-04"></a>F10-04 | high | visual | [T03](#t03) | The grid state chip is clipped at 1600px and invisible at 1366px | confirmed |
| <a id="f10-05"></a>F10-05 | high | inconsistency | [T13](#t13) | Two Promote buttons do different things: the toolbar one after a preview discards the candidate's fingering and leaves a duplicate card | confirmed |
| <a id="f10-07"></a>F10-07 | high | confusing | [T29](#t29) | Saved Variants all get the same name, can't be renamed, give no save feedback, and show no scores | confirmed |
| <a id="f10-09"></a>F10-09 | high | canon-violation | [T26](#t26) | Compare can't include the Working draft or Saved Variants (canon workflow step 7) | confirmed |
| <a id="f10-11"></a>F10-11 | high | broken | [T14](#t14) | The staleness indicator flashes on every edit but stays silent when a previewed candidate really is stale | adjusted |
| <a id="f10-v01"></a>F10-V01 | high | broken | [T13](#t13) | Promoting a candidate or a saved variant silently throws away the Working draft | verifier-added |
| <a id="f10-v02"></a>F10-V02 | high | broken | [T12](#t12) | Discard writes the draft's locks into the Active Layout as invisible locks that pull the sound back on the next Generate | verifier-added |
| <a id="f10-03"></a>F10-03 | medium | canon-violation | [T03](#t03) | The screen never says when a Candidate is being previewed; the analysis subject is unnamed (canon #8) | adjusted |
| <a id="f10-08"></a>F10-08 | medium | missing | [T30](#t30) | A Candidate can't be saved as a variant, and candidates vanish without warning on the next Generate or on reload | adjusted |
| <a id="f10-10"></a>F10-10 | medium | confusing | [T01](#t01) | The Active Layout can't be viewed while a draft exists, and clicking the Active card suggests it can | confirmed |
| <a id="f10-12"></a>F10-12 | medium | broken | [T08](#t08) | The compare selection isn't cleared after promote or delete, and candidate numbers shift | confirmed |
| <a id="f10-13"></a>F10-13 | medium | inconsistency | [T32](#t32) | Layout names pile up suffixes and mislabel the role (the Active Layout is called '(draft)') | confirmed |
| <a id="f10-14"></a>F10-14 | medium | friction | [T31](#t31) | Promote, Discard and Save Variant have inconsistent confirmation, no result feedback, and no guard against promoting a broken draft | confirmed |
| <a id="f10-19"></a>F10-19 | medium | missing | [T52](#t52) | Reopening a project restores an old draft silently, and the library doesn't show it | adjusted |
| <a id="f10-v03"></a>F10-V03 | medium | canon-violation | [T26](#t26) | Candidates never show a diff against the Active Layout, and the engine's baseline diff is computed against the draft | verifier-added |
| <a id="f10-v04"></a>F10-V04 | medium | confusing | [T14](#t14) | After every edit, the Layout Summary tells the user to 'Generate to analyze', which merges Analyze and Generate (canon #9) | verifier-added |
| <a id="f10-15"></a>F10-15 | low | visual | [T38](#t38) | Lifecycle buttons sit far from the grid, pop in and out of the toolbar, and outshout everything else | adjusted |
| <a id="f10-16"></a>F10-16 | low | inconsistency | [T32](#t32) | Draft terminology is inconsistent and Learn More doesn't explain the lifecycle | confirmed |
| <a id="f10-17"></a>F10-17 | low | unnecessary | [T39](#t39) | 'Duplicate Layout' in View Options is a hidden second Save Variant | adjusted |
| <a id="f10-18"></a>F10-18 | low | accessibility | [T63](#t63) | Lifecycle controls aren't fully keyboard-accessible and rely on a timed confirmation | adjusted |

### X1 · Cross-cutting: visual design, information architecture & layout density across viewports

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="x1-01"></a>X1-01 | high | broken | [T04](#t04) | Grid scale math is wrong: the grid is clipped at every tested viewport | adjusted |
| <a id="x1-02"></a>X1-02 | high | visual | [T04](#t04) | The timeline, not the grid, gets the space: the grid only gets what's left | confirmed |
| <a id="x1-03"></a>X1-03 | high | broken | [T05](#t05) | Rehearsal toggles (LOOP, CLICK, SOUND) are pushed off-screen at ≤1440px; PLAY and '7 sounds' wrap | confirmed |
| <a id="x1-04"></a>X1-04 | high | canon-violation | [T03](#t03) | The grid never shows which layout state is on screen, and never says 'Candidate' | adjusted |
| <a id="x1-05"></a>X1-05 | high | visual | [T17](#t17) | Sound identity is lost: every imported sound is the same amber, and pad labels truncate to identical 'TEST M…' | adjusted |
| <a id="x1-08"></a>X1-08 | high | confusing | [T38](#t38) | Related information is spread across distant panels and duplicated between tabs | adjusted |
| <a id="x1-10"></a>X1-10 | high | visual | [T64](#t64) | Text is too small and too monospaced; the type scale is bypassed, then shrunk again by the grid scale | confirmed |
| <a id="x1-v01"></a>X1-V01 | high | canon-violation | [T03](#t03) | The Costs tab never names which layout its analysis describes | verifier-added |
| <a id="x1-06"></a>X1-06 | medium | inconsistency | [T42](#t42) | Color semantics are overloaded, and hand colors change from surface to surface | adjusted |
| <a id="x1-07"></a>X1-07 | medium | inconsistency | [T20](#t20) | Cost factors have swapped colors and four different names across bars, chart and Learn More | adjusted |
| <a id="x1-09"></a>X1-09 | medium | visual | [T38](#t38) | No single primary action, and Save Variant's styling is broken | adjusted |
| <a id="x1-11"></a>X1-11 | medium | accessibility | [T64](#t64) | Dark-theme contrast failures on links, empty pads and pill markers | confirmed |
| <a id="x1-12"></a>X1-12 | medium | accessibility | [T62](#t62) | Placement is mouse-drag-only and tabs and glyph buttons lack semantics | adjusted |
| <a id="x1-13"></a>X1-13 | medium | unnecessary | [T34](#t34) | Engine and dev vocabulary shown as first-class UI to a musician | confirmed |
| <a id="x1-14"></a>X1-14 | medium | inconsistency | [T23](#t23) | The same thing has different names and numbers on different surfaces | adjusted |
| <a id="x1-17"></a>X1-17 | medium | inconsistency | [T55](#t55) | The library and the workspace look like two products, and the library has layout bugs | adjusted |
| <a id="x1-19"></a>X1-19 | medium | confusing | [T39](#t39) | The 'View settings' gear hides the Analyze action and mixes unrelated controls | adjusted |
| <a id="x1-v02"></a>X1-V02 | medium | confusing | [T31](#t31) | Disabled buttons can't explain why: pointer-events:none swallows their tooltips | verifier-added |
| <a id="x1-v03"></a>X1-V03 | medium | broken | [T39](#t39) | 'Organize by 4x4 Banks' is a dead control | verifier-added |
| <a id="x1-v04"></a>X1-V04 | medium | accessibility | [T63](#t63) | Keyboard focus is invisible and lands on hidden destructive 'Remove from pad' buttons | verifier-added |
| <a id="x1-v05"></a>X1-V05 | medium | confusing | [T39](#t39) | Changing cost toggles silently leaves stale analysis, and 'Calculate Cost' produces a second, parallel number system | verifier-added |
| <a id="x1-15"></a>X1-15 | low | visual | [T04](#t04) | Blur and glow layers add nothing visible, and the Push enclosure doesn't fit the grid | confirmed |
| <a id="x1-16"></a>X1-16 | low | friction | [T44](#t44) | The first-run workspace scatters guidance across four panels and leaves the grid empty | adjusted |
| <a id="x1-18"></a>X1-18 | low | friction | [T38](#t38) | Side panels are wide and mostly empty for typical projects; resize handles are nearly invisible | confirmed |
| <a id="x1-v06"></a>X1-V06 | low | visual | [T34](#t34) | Toolbar dropdowns have no dropdown affordance | verifier-added |

### X2 · Cross-cutting: accessibility, keyboard, feedback/error states, terminology & copy

| ID | Sev | Category | Theme | Finding | Verification |
|----|-----|----------|-------|---------|--------------|
| <a id="x2-01"></a>X2-01 | critical | broken | [T06](#t06) | Pad context menu (lock + finger constraint) renders off-cursor behind the side panel and ignores Escape | adjusted |
| <a id="x2-02"></a>X2-02 | critical | broken | [T07](#t07) | Selecting an event makes the cost panel say 'Feasible — All events playable' on an unplayable layout | confirmed |
| <a id="x2-04"></a>X2-04 | high | canon-violation | [T20](#t20) | Raw engine identifiers and internal IDs shown as user copy | confirmed |
| <a id="x2-05"></a>X2-05 | high | inconsistency | [T20](#t20) | Each cost factor has 3–6 names, and the Alternation and Balance colors are swapped between adjacent charts | confirmed |
| <a id="x2-07"></a>X2-07 | high | visual | [T03](#t03) | The on-screen state indicator is clipped, has no Candidate state, and can contradict itself | adjusted |
| <a id="x2-09"></a>X2-09 | high | missing | [T31](#t31) | Silent success and a long Generate with no progress or cancel | confirmed |
| <a id="x2-v01"></a>X2-V01 | high | confusing | [T15](#t15) | Mute/Solo silently narrow the analysis, so an incomplete layout reads green 'Feasible' | verifier-added |
| <a id="x2-v02"></a>X2-V02 | high | broken | [T02](#t02) | Undo is unreliable: analysis results take undo steps, and 'Suggest a starting layout' can't be undone | verifier-added |
| <a id="x2-v03"></a>X2-V03 | high | canon-violation | [T01](#t01) | Generate and candidate 'Preview' silently overwrite the user's Working/Test Layout | verifier-added |
| <a id="x2-v06"></a>X2-V06 | high | visual | [T17](#t17) | Imported sounds get identical-looking names and one shared color, so every pad reads 'TEST M…' | verifier-added |
| <a id="x2-03"></a>X2-03 | medium | accessibility | [T06](#t06) | Learn More, Compare and View-All modals: no Escape, no dialog semantics, no focus management | adjusted |
| <a id="x2-06"></a>X2-06 | medium | canon-violation | [T32](#t32) | Layout-state vocabulary drifts from canon; 'ACTIVE … (draft)' after Promote | adjusted |
| <a id="x2-08"></a>X2-08 | medium | accessibility | [T62](#t62) | Core editing is mouse-only: pads, sound rows, project cards, name and BPM can't be reached by keyboard | adjusted |
| <a id="x2-10"></a>X2-10 | medium | broken | [T31](#t31) | Disabled-reason tooltips can't be seen (pointer-events:none on disabled buttons) | adjusted |
| <a id="x2-11"></a>X2-11 | medium | accessibility | [T63](#t63) | Custom tabs, toggles and checkboxes have no roles or states | confirmed |
| <a id="x2-12"></a>X2-12 | medium | accessibility | [T64](#t64) | Important state is shown by color alone | confirmed |
| <a id="x2-13"></a>X2-13 | medium | accessibility | [T64](#t64) | Many sub-24px hit targets and tiny or low-contrast text, worse at 1366x768 | confirmed |
| <a id="x2-14"></a>X2-14 | medium | missing | [T61](#t61) | Shortcuts are incomplete and undiscoverable; Space does not play | confirmed |
| <a id="x2-15"></a>X2-15 | medium | broken | [T61](#t61) | Global key handlers take keys from other controls, and Backspace deletes silently | confirmed |
| <a id="x2-16"></a>X2-16 | medium | inconsistency | [T31](#t31) | Five different confirmation patterns, including native alert/confirm/prompt | confirmed |
| <a id="x2-17"></a>X2-17 | medium | canon-violation | [T44](#t44) | Copy conflates Analyze with Generate | confirmed |
| <a id="x2-18"></a>X2-18 | medium | inconsistency | [T23](#t23) | 'Events' means both time-slices (32) and notes (48) side by side | confirmed |
| <a id="x2-19"></a>X2-19 | medium | confusing | [T34](#t34) | Optimizer jargon in the main toolbar and cards, with two opposing score scales on each card | confirmed |
| <a id="x2-20"></a>X2-20 | medium | inconsistency | [T56](#t56) | Project vs Performance vs Session naming on the library page | confirmed |
| <a id="x2-v04"></a>X2-V04 | medium | broken | [T06](#t06) | 'View all' overlay is trapped inside the 274px right panel | verifier-added |
| <a id="x2-v05"></a>X2-V05 | medium | inconsistency | [T20](#t20) | Compare diff counts contradict themselves ('9 voices moved' in a 7-sound project) | verifier-added |
| <a id="x2-21"></a>X2-21 | low | accessibility | [T63](#t63) | Controls that appear only on hover, a remote icon font without fallback, and an unlabeled search field | confirmed |
| <a id="x2-22"></a>X2-22 | low | inconsistency | [T56](#t56) | Inconsistent casing, spelling, abbreviations and finger notation | confirmed |
