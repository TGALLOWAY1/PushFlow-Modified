# Performance Route · design assessment and implementation plan

**Status:** Proposed · 2026-10-01 · no code yet. This plan reads the `/design` mockup
*PushFlow Performance Route* (file `PushFlow_Performance_Route.html`, 11 screens plus a component
sheet, 1600 × 1000, "Night Transit" fixture) as a feature set and lays out how it lands in PushFlow
without replacing the layout-optimisation workflow. Once a session picks it up, its phases get
entries in `UI_ENHANCEMENT_ROADMAP.md` and `UI_ROADMAP_PROGRESS.md` as phase **P9**; by the
lean-tree rule in `docs/ARCHIVE.md` this plan leaves the tree when P9 is Done.

Attach the mockup HTML to any session that implements a P9 phase; it is not committed (1.6 MB,
and screenshots are review evidence, not documentation).

---

## 1. Objective

Add a **Performance Route**: a rehearsal and performance-planning view of the whole song that
says, bar by bar, *what you do* on Push (which Push mode you are in, which tracks you perform by
hand and which play from clips), and that zooms from the song down to the individual pad press,
driven by the same transport, Layout and Execution Plan the editor already uses.

The optimiser workflow stays as it is. The Route reads the Active Layout and its Execution Plan;
it never moves a Sound or changes a fingering. It adds one new kind of project truth, the route
itself (sections, Push-mode spans, performed lanes), and one new page.

---

## 2. What the design contains

Every screen is one live component in a different state. Grouped by surface:

### 2.1 Page shell
- **Header:** project name, `128 BPM · 4/4 · 160 bars · 5:00`, the layout **role chip**
  ("Active layout · Kit A", design decision D3: the role chip is the square sentence-case box and
  lives only in the header; mode pills are capsules and live only in the route), an
  **EDIT ROUTE** button, and a **position readout** (beat dots, elapsed `0:43`, `24.2.4`
  bar.beat.sixteenth).
- **Staleness chip** (screen 09b): "Execution Plan out of date · Kit A changed after the last
  analysis · Re-run analysis".
- **Transport bar** (bottom): *Up to <level>* (Esc), Play/Stop (Space) with state word
  (PLAYING / STOPPED / END OF SONG / PAUSED FOR EDITING), **LOOP** the current item (L) showing
  its name and bar range, **PRACTICE TEMPO** `[` `]` as BPM and percent, and the shortcut hints
  `=` `−` zoom, Enter open card, Esc up, `?` all shortcuts.

### 2.2 Zoom rail (left)
Five levels, each a button: **SONG · SECTION · PHRASE · ACTION · PAD / CONTROL**, with live
captions ("160 bars", "16 bars", "4 bars", "1–7 beats", "1 press"). A marker slides continuously
with the zoom span, so mid-animation it sits between nodes. Reached nodes ring in ink.

### 2.3 Route band (cards) and route line
- **Section cards** (92 px tall, width ∝ bars): mode pills, the section's "what you do" text as
  title, states *upcoming* (panel 75 %, ink-2 title) · *active* (1.6 px border and glow in the
  live mode's colour) · *done* (check mark), hover and focus-visible states, and an italic
  "Add what you do here" placeholder when there is no text.
- **Phrase cards** replace section cards at the section level (title 16 px, one-line sub,
  sequence pill "DRM → INS" for a phrase that changes mode).
- **Action cards** at the phrase level, sized by duration; a one-beat card falls back to its
  short title ("Switch").
- Cards **degrade by width**: full pills → abbreviations → glyphs → one glyph → state only with a
  tooltip (220 / 150 / 92 / 58 / 30 px).
- **Route line** above the cards: dashed ahead, solid ink behind the playhead, a node per
  section (phrase and action nodes fade in as you zoom), filled end square when done,
  `n / 7 sections done`.
- **Semantic zoom:** click or Enter on a card zooms into it in 520 ms
  (`cubic-bezier(.65,0,.35,1)`); Esc goes up; `=` / `−` step; the rail jumps directly.

### 2.4 Push-mode strip and badge
A 20 px strip under the cards: contiguous spans coloured by Push mode — **Session View,
Instrument, Drum Rack, FX / Device, Control** (Control is the quarter-beat of presses between
modes, e.g. Capture then track select). Labels degrade glyph+label → abbreviation → none; passed
spans dim to 50 %. A **mode badge** follows the playhead on the strip, flips in 240 ms when the
mode changes, glows while playing, sits at 60 % after the song ends, and reads "NO MODE SET"
where the strip is empty.

### 2.5 Arrangement lanes ("What Ableton plays")
Six lanes in the fixture (Drums MIDI, Bass MIDI, Melody MIDI, Vocal AUDIO, Percussion MIDI,
Texture/FX AUDIO). Each lane shows **clips** (grey boxes with names like "KIT · DROP") and a
**performed overlay** in the mode colour (24 % fill, 2.5 px top rule) wherever the user performs
that lane by hand; the rest "plays from clip". Zoomed out, each bar is a **density bar**; at
≥ 50 px per bar the lanes switch to **notes** (drum rows kick/snare/hat, pitch rows for bass and
melody, amplitude for audio). Lanes with nothing performed in the current view dim to 45 %. The
lane being performed now carries a live dot. **Unplayable** strikes stay drawn with a 1 px red
outline, never hidden (CLAUDE.md invariant 4). A legend explains "Plays from clip" vs "You
perform it" vs "Can't be played as fingered".

### 2.6 Ruler
Bar numbers whose density adapts to zoom (every 16 / 4 / 1 bars, then beats `71.2`, then
sixteenths), section labels with bar ranges and the section text when there is room, and at
the phrase level a `DROP › PHRASE 2` breadcrumb. Click seeks (snapped to a beat). In edit mode,
hovering offers "+ Add a boundary at bar 33" and click splits the section.

### 2.7 Edit mode (screen 08, "Authoring the route")
Playback pauses ("PAUSED FOR EDITING"). Section cards become a **name field** (uppercase) and a
**"What you do" textarea**. Section **boundaries are drag handles** (ghost line and a chip
"Bar 141 · Drop 2 28 bars · Outro 20 bars"). Clicking a mode-strip span selects it and opens a
**PUSH MODE picker** (keys 1–5) with draggable blue span ends; "Lanes you perform light in the
new mode's colour". Header reads "Each change is one undo step" with UNDO ⌘Z and DONE EDITING.

### 2.8 Empty state (screen 09a, "Detected sections only")
With no authored route, sections come from **silence-split detection** ("Found from silences",
gaps ≥ 2 s) and are named "Section 1–5" with the italic placeholder. The mode strip uses the
**D5 default**: Drum Rack wherever the performed Drums lane plays, empty elsewhere. One CTA,
**NAME SECTIONS**, opens edit mode.

### 2.9 Pad / Control level (screens 06, 07a, 07b, 09b)
A two-panel view entered by a 320 ms crossfade from the action:
- **Left, the Push:** a static Push chrome (track tabs DRUMS BASS …, CAPTURE, NOTE / SESSION /
  DEVICE buttons) around the **8 × 8 grid showing the analysed Layout** ("Kit A": 12 Sounds at
  their positions in their Sound colours, no step sequencer). The next pad to hit gets a **ring
  and finger badge coloured by hand** (L = `#0088ff`, R = `#ff4400`, 620 ms lead); a struck pad
  **flashes** in its Sound colour for 380 ms with a 93 % scale. Below: "LAYOUT · KIT A …
  Read-only: the Route never moves Sounds or changes fingering."
- **Right, the cue lane:** a "note highway": one row per Sound in play (plus CAPTURE / BASS TRACK
  control rows and pitch rows for the bass riff), a NOW line, the next two bars scrolling at
  practice tempo, **cue chips** labelled with the finger and coloured by hand (upcoming 90 %,
  sounding solid with glow, past 22.5 %, long notes stretched, unplayable outlined red).
- **Top:** breadcrumbs `DROP › PHRASE 2 · BARS 69–72 › ACTIONS`, the action title and mode pill,
  a fingered description ("Kick L2 · Clap R3 · Hat R2 — both hands on the drum pads"), NEXT.
- **Bottom:** an **action strip** of the phrase's actions with progress fill, done checks, and
  index numbers; clicking one jumps there.
- **07a, Instrument fallback (D6):** only Drum Rack spans are simulated on the 8 × 8. In an
  Instrument span the grid dims and a card says "Pads not simulated in v1", showing the riff as
  a fingered note sequence (C1 L1 · C1 L1 · E♭1 L2 …) and when the pads return.
- **07b, FUTURE:** an in-key Instrument grid (C minor in fourths, roots in ink). Labelled
  "NOT IN V1".
- **09b, no current Execution Plan:** the Layout still shows and cue rings and chips keep their
  timing, but they are neutral with "–" for the finger "so no hand is claimed that the plan
  doesn't back".

### 2.10 Palette, type and tokens
- Two palettes: the route's cool navy (`#0f141e`) and, in screen 10, the same screen on the app's
  **warm charcoal** tokens (decision D1 left open by the design: "the four mode colours read
  slightly hotter on warm grey, and the clip and note greys had to be derived").
- Fonts: **Sofia Sans**, **Sofia Sans Condensed** (labels, 11 px uppercase tracked), **DM Mono**
  (positions, fingers). Design rule D4: labels ≥ 11 px outside pads.
- Mode colours: session `#34d39a`, instrument `#5e9eff`, drum `#ffb33f`, fx `#ee6bd0`,
  control `#c7d0dc`; "mode glyphs: shape carries meaning, not colour".
- Hand colours and role-chip colours match the app's existing `--hand-*` and `--role-*` tokens.
- A **canvas layer** draws ruler, grid, lanes, route line and playhead (design spec §11); cards,
  strip, badge and pad view are DOM.

### 2.11 Decisions the design already took
D1 palette (open), D3 role chip vs mode pill, D4 label floor, D5 default mode strip,
D6 only Drum Rack simulated in v1, spec §8 badge at 60 % after the end, spec §11 canvas layer,
520 ms zoom and 320 ms pad crossfade, 240 ms Esc.

---

## 3. Current-state reading

What exists today (file references are current at HEAD 7e57162):

| Design needs | Today | Verdict |
|---|---|---|
| Song sections with text, bar ranges | `ProjectState.sections: Section[]` exists (`src/ui/state/projectState.ts:124`) but is engine-detected, in **seconds**, always `[]`, and is an **analysis input** (`analysisInputs.ts:63`, `analysisCache.ts:67`) so any edit would re-run the solver | Do not reuse. New field. |
| Phrases, actions | `analyzePhraseStructure` (`src/engine/structure/phraseStructure.ts:125`) gives a phrase length in bars; nothing authored | Derive in v1 |
| Push-mode spans, performed lanes | Nothing | New field |
| Arrangement lanes / tracks / clips | `PerformanceLane` is one MIDI pitch (one Sound), not a track (`src/types/performanceLane.ts:55`); `LaneGroup` is the only container; no audio, no clips | Map groups → route lanes; derive clips |
| Tempo, time signature, bar count | `tempo` (BPM) only; 4/4 hard-coded (`transportMath.ts:22`, `musicalTime.ts:15`); song length derived by `songSpan()` | Reuse; show "4/4" as a constant |
| Transport: play/stop, seek, loop, speed | `TransportProvider` (`src/ui/audio/TransportProvider.tsx`): `seek`, `play`, `rehearse`, `useTransportPosition()`; state `loopEnabled/loopStart/loopEnd` (seconds, saved), `playbackRate` 0.1–2 (saved), count-in, metronome, hands filter | Reuse wholesale |
| Follow / auto-advance | Timeline auto-scrolls near the edge; `useCurrentMoment()` follows the playhead | Reuse the hook; add zoom-level follow |
| Position readout | `formatBarBeat` ("3.2.1"), `PositionReadout` in `TransportBar.tsx:54` | Reuse |
| Execution Plan per press, finger, hand, pad, unplayable | `FingerAssignment` (`src/types/executionPlan.ts:158`): `assignedHand 'left'|'right'|'Unplayable'`, `finger`, `row/col`, `eventKey`; `momentOverlay.ts` gives now/next per pad | Reuse |
| Plan staleness | `checkPlanFreshness` by layout hash; `analysisStale`; `getDisplayedExecutionPlan` | Reuse for 09b |
| Read-only grid with overlays | `InteractiveGrid` is edit-coupled (1344 lines); `PadGrid` is read-only but has no per-moment overlay props | Extend `PadGrid` or extract pad cells |
| Keyboard | Table-driven `INPUT_TABLE` + `useInputHandler`; rows exist for Space, Esc, L, `[` `]`, `?`; none for `=` `−` | Add rows |
| Shortcut sheet, Learn More keyboard tab | Generated from the table | Free |
| Overlay, Toast, Popover, FingerChip, StrikeChip, RoleChip | `src/ui/components/shared/` | Reuse |
| Routing | `src/ui/App.tsx` routes; `/project/:id` mounts `ProjectProvider` → `PerformanceWorkspace` → `TransportProvider`; no shared shell | Add a nested project route; lift providers |
| Theme | Warm charcoal tokens, Inter + Space Grotesk, no mono font bundled, no theme switching | Tokens needed for modes; palette is decision R-D1 |
| Canvas | None in `src/ui` | New, scoped to the lanes layer |
| Silence detection | `detectSections()` (`src/engine/structure/sectionDetection.ts:30`), gap-based, unused by the UI | Reuse for the empty state |
| Persistence | `PERSISTED_SCHEMA_VERSION = 8`; migrations array with backup; `DOCUMENT_FIELD_SET` typed so a missed field fails typecheck | Add 8 → 9 |
| Undo | Document snapshots; `transact(label)`; `historyLabels.ts` | Free once the field is a document field |
| E2E | `window.__pf` installs under `ProjectProvider`; `status()` has transport fields | Extend `status()` with route level |

Related open work in the tracker: S5.3 will move note times to beats and convert the saved loop
bounds (follow-ups L1796, L1818). S8.2 puts the Composer on the shared transport. Neither blocks
P9 if the route stores its positions in bars (see §4.1).

---

## 4. Gap analysis against the canon

The canon (`docs/canonical/`) defines one project = one performance timeline plus a family of
layouts. The Route adds a second kind of durable truth about the same timeline. These gaps must
be closed in the canon before code, because the four canon files are the only planning truth.

### 4.1 New terms and truths (canon amendment, phase S9.0)
- **Performance Route**: the project's authored plan of what the performer does over the song.
  One per project, bound to the one canonical timeline, independent of which layout is active.
- **Section**: a named bar range `[start, end)` with "what you do" text. Sections tile the song
  without gaps or overlap. Positions are **bars** (0-based, fractional for sub-bar spans) so a
  tempo change moves nothing and S5.3's beats migration leaves the route untouched.
- **Push mode** and **Mode span**: the Push 3 mode the performer is in over a bar range:
  Session View, Instrument, Drum Rack, FX / Device, Control. Spans tile the song; "unset" is
  allowed and renders as NO MODE SET.
- **Arrangement lane**: a track as Ableton plays it. In v1 a lane is a `LaneGroup`, or an
  ungrouped Sound. A lane has a kind (`midi` now; `audio` reserved for a later import).
- **Clip**: a contiguous region where a lane has material. Derived in v1 (see §5.2); authored
  when `.als` import exists.
- **Performed span**: a (lane, bar range) the performer plays by hand, as opposed to playing
  from a clip. Default rule (design D5): lanes whose Sounds are on the Layout are performed
  wherever they have notes **inside a Drum Rack span**. Other modes have no performed lanes
  until the user marks them in edit mode.
- **Phrase** and **Action**: sub-divisions of a section used for zoom. **Derived in v1**
  (phrase = 4 bars or the engine's detected phrase length; action = one bar, split at mode
  boundaries). Authored titles ("Capture drums, switch to bass") are a later phase.
- **Cue**: the next press, with its pad and finger from the Execution Plan, shown on the grid
  and in the cue lane.

### 4.2 Rules that follow from the existing canon
- **Analysis-only state is not project truth** and **do not silently convert analysis-only state
  into persistent truth**: the route stores only what the user authored or the default rule
  derives from authored data. Phrases, actions, clips, cues and the "done" state are derived at
  render time and never saved.
- **Execution Plan is derived from a specific layout state**: the pad level reads
  `getDisplayedExecutionPlan` for the Active Layout only, and shows the 09b neutral state
  whenever `checkPlanFreshness` fails or `analysisStale` is set. The Route never shows the
  Working/Test Layout (it is a rehearsal surface for the committed baseline; CANON §3).
- **Invariant 4, timeline completeness**: route lanes draw every Sound stream, including
  unplayable strikes (red outline) and excluded Sounds (clip only, no performed overlay).
- **Invariant 7, no automatic grid layout**: nothing here places or fingers anything.
- **Invariant 8**: practice tempo is `playbackRate` on `state.tempo`; there is no second BPM.
- **Compare is read-only; the Route is read-only too** except for its own route fields.
- **Analysis-input question deferred:** today the solver plans *every* event. The route can say
  "Drums play from a clip during the Verse", which means those events are not performed and
  arguably should not cost anything. Making mode spans a solver input changes optimizer inputs
  and so triggers the Solver Change Checklist and TEST MIDI 1 verification. That is a later
  phase (§6, "Later"), not v1. v1 is explicit about it in the Route's Learn More text.

### 4.3 Mismatches between the mockup and the product
- The mockup's lanes are Ableton tracks from a Live Set ("Night Transit.als") with audio clips.
  PushFlow imports MIDI files and has no audio. v1 lanes are groups of Sounds; the FX and Vocal
  audio lanes of the mockup have no v1 equivalent. The lane model carries `kind: 'audio'` so an
  `.als` importer can fill it later without a migration.
- The mockup's Control-mode presses (CAPTURE with L1, track select with R1) are fingered by the
  designer, not by the engine. The engine fingers pads only. v1 shows Control spans and their
  text; it claims no finger for a button press.
- The mockup plays the fixture at 94 % practice tempo in 5 % steps (`[` `]`). The app has
  `REHEARSAL_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5]`. Keep the app's steps for consistency and
  add 0.9 and 0.95; show both BPM and percent like the mockup.
- The mockup header says `4/4`. The app assumes 4/4 everywhere; render the constant and record a
  follow-up for time signature.

---

## 5. Salvage strategy

### 5.1 Reuse as-is
`TransportProvider` and `useTransportPosition`, `useCurrentMoment`, `momentOverlay.ts`
(now/next per pad), `getEventTimeline` / `TimelineEvent`, `getDisplayedExecutionPlan` and
`checkPlanFreshness`, `formatBarBeat` / `formatBarRange` / `barSeconds` / `snapTime`,
`detectSections`, the input registry and `ShortcutSheet`, `Dialog` / `Popover` / `Toast`,
`FingerChip`, `RoleChip`, `orderSounds`, the migration runner, `useUndoRedo` and `transact`,
`useAutoSave`, `useAutoAnalysis`, the e2e hook.

### 5.2 Adapt
- **Lanes:** `LaneGroup` → route lane; ungrouped Sound → its own lane. Clips are derived per
  lane as runs of bars with notes, split where a gap ≥ `clipGapBars` (default 2) occurs, and
  named `<lane> · <section>` as the mockup does.
- **Default sections:** `detectSections` output snapped to bar lines, minimum section length
  4 bars, named "Section n".
- **Pad grid:** give `PadGrid` an `overlay` prop (`Map<padKey, {finger, hand, phase:
  'cue'|'strike'|'none', strength}>`) and a `chrome` slot, or extract `InteractiveGrid`'s pad
  cell into a shared `PadCell`. Do not fork a third grid.
- **Position readout:** reuse `PositionReadout`; add elapsed time and beat dots next to it.
- **Transport bar:** the Route's transport is a new slim composition of existing pieces
  (Play/Stop, loop, speed) rather than `TransportBar.tsx`, which is sized for the drawer.
  Both dispatch the same actions, so there is still one transport (T60).
- **Routing:** make `/project/:id` a parent route that loads the project and mounts
  `ProjectProvider` + `TransportProvider` + `ViewSettingsProvider`, with `/project/:id` (editor)
  and `/project/:id/route` as children rendered through an `Outlet`. Playback and the loaded
  project then survive switching pages, and `window.__pf` is present on both.

### 5.3 New
Route types, reducer slice and actions, the derivation module (sections → phrases → actions,
clips, performed spans, LOD maths), the canvas lanes layer, the zoom animation, the cards and
mode strip, edit mode, the pad level with the cue lane, mode tokens and glyphs.

### 5.4 From V1 history
Nothing in the archived V1/V2 material (`docs/ARCHIVE.md`) covers sections, arrangement or
performance planning; there is nothing to salvage there.

---

## 6. Phase-by-phase sequence (phase P9)

Sizes follow the roadmap's scale. Each session is one or two PRs of under ~400 lines of
non-test diff where possible. Order is by dependency: truth model first, then the read-only
page, then zoom, then editing, then the pad level, then integration. The Route is useful to
the user from S9.2 onwards.

### S9.0 · Canon, decisions and tokens (S, 1 PR)
**Goal.** Make the new truths legitimate before any code stores them.
**Deliverables**
- Amend `PUSHFLOW_TERMINOLOGY.md` (terms in §4.1), `PUSHFLOW_CANON.md` (a "Performance Route"
  truth: authored, bar-based, layout-independent, never a solver input in v1) and
  `PUSHFLOW_SURFACE_FEATURES.md` (a §7 Performance Route surface: core features, should-not).
- Record decisions R-D1…R-D6 (§9) in `UI_ROADMAP_PROGRESS.md` §1 and add the P9 phase section
  and criterion table.
- Add `--mode-session/-instrument/-drum/-fx/-control` and `--mode-on-fill` tokens to
  `src/index.css` and `tailwind.config.js`; add the five mode glyphs as one `ModeGlyph` component
  (shape carries meaning).
- CLAUDE.md: add the Route to the surface list and a one-line non-regression rule ("The Route
  never writes to layouts or voice constraints").
**Exit criteria**
- [ ] P9-0a The four canon files name every term in §4.1 and no other doc restates them.
- [ ] P9-0b `ModeGlyph` renders five distinct shapes at 9, 10 and 28 px in a happy-dom test.

### S9.1 · Route truth model and persistence (M, 1–2 PRs)
**Goal.** Store the route as a document field with undo, autosave and migration.
**Deliverables**
- `src/types/performanceRoute.ts`: `PerformanceRoute { version: 1; sections: RouteSection[];
  modeSpans: ModeSpan[]; performedSpans: PerformedSpan[]; lanes: RouteLaneMeta[] }`;
  `RouteSection { id, name, text, startBar, endBar }`; `ModeSpan { startBar, endBar, mode }`;
  `PerformedSpan { laneId, startBar, endBar }`; `RouteLaneMeta { laneId, kind: 'midi'|'audio',
  hidden? }`. Invariants: sections and mode spans tile `[0, songBars)`, sorted, no overlap;
  validated by a pure `normalizeRoute()`.
- `ProjectDocument.performanceRoute: PerformanceRoute | null` (`null` = never authored, so the
  empty state derives everything). Entry in `DOCUMENT_FIELD_SET`, `createEmptyProjectState`,
  serializer, `applyPersistedDefaults`, migration 8 → 9 `'performance-route'` (adds `null`),
  `PERSISTED_SCHEMA_VERSION = 9`.
- Actions: `ROUTE_SET_SECTION_NAME`, `ROUTE_SET_SECTION_TEXT`, `ROUTE_MOVE_BOUNDARY`,
  `ROUTE_SPLIT_SECTION`, `ROUTE_MERGE_SECTION`, `ROUTE_SET_MODE_SPAN`, `ROUTE_SET_SPAN_ENDS`,
  `ROUTE_SET_PERFORMED`, `ROUTE_ADOPT_DETECTED` (materialises the detected default when the user
  first edits), `ROUTE_CLEAR`. Each bumps `updatedAt`, none touches `analysisStale`. Labels in
  `historyLabels.ts`.
- `src/ui/route/derive.ts` (pure): `detectedRoute(state)` (silence-split via `detectSections`,
  bar-snapped, min 4 bars, D5 default mode spans and performed spans), `routeLanes(state)`
  (groups → lanes), `clipsFor(lane)`, `phrasesFor(section)`, `actionsFor(phrase)`,
  `modeAt(bar)`, `songBars(state)`.
- `LaneGroup` and Sound deletion keep the route valid (`normalizeRoute` drops orphan
  `performedSpans`); the lane reducer's `withSyncedStreams` calls it.
**Exit criteria**
- [ ] P9-1a A project saved by `main` (schema 8) loads with `performanceRoute: null`; the 8 → 9
  migration is idempotent and backed up (same pattern as `mute-as-exclusion.spec.ts`).
- [ ] P9-1b On TEST MIDI 1, `detectedRoute` yields ≥ 1 section tiling the song, and
  `normalizeRoute` rejects overlap, gaps and reversed bounds (unit tests).
- [ ] P9-1c Every route action is one undo step with a readable label, and none marks the
  analysis stale (`analysisInputsChanged` test).
- [ ] P9-1d `SET_TEMPO` leaves every route bar position unchanged.

### S9.2 · Route page, Song level, read-only (L, 2 PRs)
**Goal.** The user opens the Route, sees the whole song, plays it and follows the mode badge.
**Deliverables**
- Nested project route (§5.2) and `/project/:id/route` → `PerformanceRoutePage`. A **ROUTE**
  button in `WorkspaceToolbar` and a "Back to the editor" link in the Route header. The page
  calls `useAutoSave`, `useAutoAnalysis` and the editor's `useKeyboardShortcuts` (Space, L,
  `[` `]`, Home, `?`).
- Header: name, `BPM · 4/4 · bars · m:ss`, `RoleChip` for the Active Layout, position readout
  with beat dots and elapsed, EDIT ROUTE (disabled with a `DisabledReason` until S9.4).
- Zoom rail at level 0 (buttons present, SONG only reachable until S9.3).
- Route band with section cards (states, pills, degrade-by-width, tooltips, aria labels), the
  route line and `n / N sections done`.
- Mode strip with the badge, legend, "What you do" and "What Ableton plays" labels.
- Canvas lanes layer: ruler (bar LOD), section labels, clips, performed overlays, density bars,
  playhead; lane sidebar in DOM with live dot. Unplayable strikes in red at density LOD.
- Transport bar: Play/Stop, LOOP whole song, PRACTICE TEMPO with `[` `]`, shortcut hints.
- Empty state (09a): detected sections, NO MODE SET where unset, NAME SECTIONS CTA (opens S9.4).
- `window.__pf.status()` gains `route: { level, viewStart, viewSpan, sectionId, editing }`.
- Input rows `zoom-in` (`=`), `zoom-out` (`−`) registered but no-ops until S9.3; `KEY_NAME`
  recognises `=` and `-`.
**Exit criteria**
- [ ] P9-2a At 1366×768 and 1600×1000 the Route fills the viewport with no horizontal scroll;
  cards, strip and lanes span the same bar axis to the pixel (screenshot baseline).
- [ ] P9-2b Pressing Space in the Route starts playback; `__pf.transport().running` is true; the
  badge and the active card follow the playhead; switching to the editor mid-play keeps playing
  (transport survives the route change).
- [ ] P9-2c With TEST MIDI 1 and an authored route of 3 sections, the three cards read the
  authored text; with no route, five-bar-snapped detected sections appear with the placeholder
  and the CTA.
- [ ] P9-2d An unplayable strike in the plan is drawn with the red outline in its lane.
- [ ] P9-2e No visible text under 11 px; every control ≥ 24 px; axe finds 0 serious issues.

### S9.3 · Semantic zoom: Section, Phrase, Action (M, 1–2 PRs)
**Goal.** Click or Enter zooms into a card; Esc goes up; the lanes switch from density to notes.
**Deliverables**
- View model `{ x0, span }` in bars with `zoomBetween` (log-span interpolation), 520 ms with the
  design's easing, `prefers-reduced-motion` → 0 ms; LOD crossfades for section/phrase/action
  cards and for density → notes at ≥ 50 px per bar; beat and sixteenth gridlines.
- Derived phrases and actions (S9.1) rendered as cards; sequence pills; action short titles.
- Rail marker follows `levelOf(span)`; rail captions live; rail click walks down through the
  item under the playhead.
- Follow: at section/phrase/action level playback auto-advances to the next item; LOOP loops
  the current item (`SET_LOOP_REGION` from bars); the loop button shows the item name and range.
- Ruler click seeks to the beat; the breadcrumb label at the phrase level.
**Exit criteria**
- [ ] P9-3a Enter on the active section card changes `__pf.status().route.level` to 1 and the
  view span to the section's length; Esc returns to 0; `=`/`−` step the same path.
- [ ] P9-3b At the section level the lanes draw individual strikes (no density bars) and the
  cards are phrases; at the action level the ruler shows beats and sixteenths.
- [ ] P9-3c With LOOP on at the phrase level, playback wraps at the phrase end
  (`__pf.transport().region` equals the phrase's seconds).
- [ ] P9-3d With reduced motion, zoom completes in one frame.

### S9.4 · Edit mode (M, 1–2 PRs)
**Goal.** Author the route in place; each change is one undo step.
**Deliverables**
- EDIT ROUTE / DONE EDITING; playback pauses; the state word reads PAUSED FOR EDITING; the rail
  and zoom are inert while editing.
- Section cards become name + "what you do" inputs (uppercase name, textarea), with focus ring.
- Boundary handles with the ghost line and chip; drag snaps to bars, clamped to one bar per
  side; ruler hover offers a split; click splits with a NEW SECTION focused.
- Mode strip: click selects a span, `Popover` picker (keys 1–5) with span-end handles;
  "Lanes you perform" checklist inside the picker (sets `performedSpans`).
- `ROUTE_ADOPT_DETECTED` on the first edit from the empty state; UNDO button in the header.
- Merge: deleting a boundary (Backspace on a focused handle) merges two sections.
**Exit criteria**
- [ ] P9-4a Renaming a section, dragging a boundary, splitting and picking a mode each add
  exactly one entry to `__pf.history()` with a readable label, and `analysisStale` stays false.
- [ ] P9-4b After DONE EDITING and a reload, the route is unchanged (autosave).
- [ ] P9-4c A boundary cannot be dragged past its neighbours; sections still tile the song.
- [ ] P9-4d The 09a → edit → named sections flow works with keyboard only.

### S9.5 · Pad / Control level (L, 2 PRs)
**Goal.** From an action, see the Push, the next pad and finger, and the cue lane.
**Deliverables**
- `PadGrid` overlay prop (or shared `PadCell`), the Push chrome (track tabs from route lanes,
  CAPTURE / NOTE / SESSION / DEVICE as static labels), Sound colours and short labels.
- Cue rings and finger badges from `momentOverlay` + `FingerAssignment` (hand colour, 620 ms
  lead scaled by rate); strike flash from `useTransportPosition`; "LAYOUT · <name>" caption.
- Cue lane: rows for the Sounds struck in the action (ordered by first strike), beat gridlines,
  NOW line, chips for the next two bars at practice tempo, past/sounding/upcoming/unplayable
  states.
- Header: breadcrumbs, action title, mode pill, fingered description built from the plan
  ("Kick L2 · Clap R3 · Hat R2"), NEXT; action strip with progress.
- D6 fallback: in a non-Drum-Rack span the grid dims and the card explains; the cue lane still
  lists the strikes for Sounds on the Layout.
- 09b: when `checkPlanFreshness` fails or `analysisStale`, rings and chips go neutral with "–",
  the staleness chip with "Re-run analysis" appears in the header.
- Entry crossfade 320 ms, Esc 240 ms; `Enter` on an action card with no pad-level plan is
  disabled with a tooltip.
**Exit criteria**
- [ ] P9-5a With TEST MIDI 1 placed and analysed, entering the pad level during playback marks
  the next strike's pad with the finger the plan assigns (`__pf.fingering('active')` agrees).
- [ ] P9-5b After moving a Sound in the editor without re-analysing, the pad level shows "–"
  chips and the staleness chip; after analysis, fingers return.
- [ ] P9-5c An unplayable strike is a red-outlined chip and never a hand colour.
- [ ] P9-5d The grid redraws only on cue or strike changes, not every frame
  (follow-up L1798 must not get worse: measure with the React profiler in the PR).

### S9.6 · Integration and polish (S/M, 1 PR)
**Deliverables**
- Library card: "Route: 7 sections" when authored; "Route not set up" otherwise.
- Learn More: a Route section in Overview and Workflow tabs stating the v1 limits (D6,
  analysis unaffected by mode spans); the keyboard tab picks up the new rows automatically.
- README Performance Timeline & Rehearsal section and `docs/dataflow-diagram.md` updated.
- Screenshots in `docs/screenshots/S9.x/` per the tracker convention; P9 audit.
**Exit criteria**
- [ ] P9-6a The full suite (typecheck, test:run, Playwright at 1366 and 1600) is green.
- [ ] P9-6b Every P9 criterion above is ticked with its PR and verification.

### Later (not scheduled, each needs its own decision)
- **Authored phrases and actions** with titles, subs and NEXT text; Control presses as authored
  cue rows (no finger claimed unless the user types one).
- **Mode spans as a solver input** (events outside performed spans are not planned). Solver
  Change Checklist and TEST MIDI 1 verification apply.
- **`.als` import**: real tracks, audio lanes, clip names, locators as section defaults.
- **In-key Instrument grid** (screen 07b).
- **Time signature** in the document.

---

## 7. Validation and exit criteria (summary)

Per session above. Cross-cutting:
- Deterministic unit tests for the route reducer and `normalizeRoute`, the derivation module
  (detected sections, clips, phrases, actions, `modeAt`), bar↔second conversion, and the
  migration (idempotent, backup written).
- Persistence: save by `main`, open on the branch, edit, reload.
- Freshness: route edits never flip `analysisStale`; layout edits do flip the pad level to 09b.
- Playwright specs `route-song`, `route-zoom`, `route-edit`, `route-pad` at both viewports, using
  TEST MIDI 1 through `openTestMidi1` and authoring sections through `__pf.dispatch`.
- Screenshot baselines generated in CI only (never locally).
- No optimizer code changes in P9, so the TEST MIDI 1 integration rule is not triggered; if a
  later phase makes mode spans a solver input, run it.

---

## 8. Risks

- **Second truth about the timeline.** Sections in bars and notes in seconds can disagree after
  S5.3 or a tempo edit. Mitigation: bars are the route's unit by canon; the only conversion is
  at render and loop time via `barSeconds(tempo)`.
- **The dead `sections` field.** Two fields named "section" will confuse agents. Mitigation:
  a follow-up to retire `ProjectState.sections` from the document, the analysis inputs and the
  cache key in its own PR (it is always empty, so behaviour is unchanged).
- **Lane fidelity.** The mockup's lanes are Ableton tracks; v1 lanes are Sound groups. Users
  without groups get one lane per Sound (7 lanes for TEST MIDI 1, more for a full kit).
  Mitigation: the Sounds panel already groups; the Route explains the mapping in Learn More.
- **Canvas in a DOM app.** First canvas surface; screenshot diffs and HiDPI. Mitigation: pure
  draw function with a fixed-size test harness; the DOM owns everything interactive.
- **Lifting providers to a parent route.** Touches every editor spec. Mitigation: do it as the
  first PR of S9.2 with no visible change and the full suite green.
- **Frame-rate work.** The rail marker, badge, cue rings and chips update every frame.
  Mitigation: `useSyncExternalStore` subscriptions as the transport already does; memoised
  derivations; measure in S9.5.
- **Scope creep toward the Push simulator.** Control presses, Instrument grid and `.als` are
  tempting. Mitigation: D6 and the "Later" list are explicit; v1 claims nothing the plan can't
  back.
- **Fonts and palette** (R-D1). Bundling three new font families or restyling the app is a
  separate visual decision; the Route is built on tokens so either choice is a token change.

---

## 9. Decisions to record (defaults apply unless the user says otherwise)

None of these blocks S9.0 or S9.1. R-D1 should be settled before S9.2 merges.

| Id | Question | Default |
|---|---|---|
| R-D1 | Palette and type: route navy + Sofia Sans / DM Mono (screens 01–09) or the app's warm charcoal + Inter / Space Grotesk (screen 10)? | Build on `--route-*` aliases of the app tokens (screen 10) and the app fonts, no new font bundles; the mode colours become app tokens. Revisit as an app-wide restyle if wanted. |
| R-D2 | Lane source | `LaneGroup` → lane, ungrouped Sound → lane; `.als` later. |
| R-D3 | Phrases and actions | Derived in v1 (4-bar phrases or detected phrase length; 1-bar actions split at mode boundaries). |
| R-D4 | Do mode spans affect analysis? | No in v1; the Route is a plan layer over the full Execution Plan. |
| R-D5 | Where the Route lives | Its own page under `/project/:id/route`, sharing the project and transport providers; not a drawer tab. |
| R-D6 | Which layout the Route shows | The Active Layout only; Working/Test and Candidates stay in the editor and Compare. |

Truly blocking: none. The one question that would change S9.1's shape is R-D2 (if the user
wants `.als` import first, lanes and clips become imported truth and the derivation module
shrinks); the default keeps v1 inside what PushFlow can import today.
