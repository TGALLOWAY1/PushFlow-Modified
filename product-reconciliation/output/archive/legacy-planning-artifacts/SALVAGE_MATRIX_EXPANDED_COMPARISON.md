# Salvage Matrix Expanded Comparison

This document expands the categories you flagged as too ambiguous for approval
in
[`SALVAGE_MATRIX.md`](/Users/tjgalloway/Programming%20Projects%202026/PushFlow%20V3/product-reconciliation/output/SALVAGE_MATRIX.md).
It is intentionally structured as:

- `V1 does this`
- `V2 does this`
- `What is actually better`
- `What still needs your judgment`

## 1. Terminology Model

## V1 does this

V1's implied user-facing terminology is built around a relatively small set of
concepts:

- `Song`
  - portfolio-level container on the dashboard
- `ProjectState`
  - internal working state attached to a song
- `Performance`
  - imported MIDI-derived event sequence
- `Voice`
  - one unique note identity extracted from the performance
- `Pad`
  - one physical Push grid location
- `GridMapping`
  - the editable pad assignment artifact
- `Natural Hand Pose`
  - personalized finger resting arrangement
- `EngineResult`
  - stored analysis result
- `Event Analysis`
  - dedicated event/transition inspection mode

V1 terminology problems:

- `layout` means too many things:
  - `LayoutSnapshot`
  - `GridMapping`
  - overall arrangement idea
- `song` and `project` are both real, but the user mostly sees `song`
- `voice`, `sound`, and `note` are not perfectly separated
- `section` language remains visible after section workflow stopped being
  primary

## V2 does this

V2's docs try to formalize a richer canon:

- `Project`
  - top-level saved working container
- `Performance`
  - solver-facing event sequence
- `Sound`
  - user-facing identity
- `Voice`
  - mapped identity in the layout
- `SoundStream`
  - current runtime sequence per pitch
- `PerformanceLane`
  - authoring-oriented timeline model
- `Layout`
  - static pad assignment artifact
- `Execution Plan`
  - dynamic hand/finger realization over time
- `Candidate Solution`
  - layout + execution + difficulty + tradeoff bundle
- `Difficulty Analysis`
  - aggregate burden interpretation
- `LoopState`
  - composer-local step-grid model

V2 terminology problems:

- one user has to think in several adjacent models:
  - sound
  - voice
  - stream
  - lane
  - loop
- `analysis`, `diagnostics`, and `compare` are separate surfaces without a clean
  taxonomy
- `score`, `difficulty`, and `complexity` are all live concepts with weak
  boundaries
- `workspace`, `workbench`, and `grid editor` all remain in circulation

## What is actually better

- V1 is better for user-legible product naming.
- V2 is better for formalizing the engine outputs that actually matter:
  - `Layout`
  - `Execution Plan`
  - `Candidate`

## What still needs your judgment

You need to approve:

1. whether the top-level object is `Project` or `Song Project`
2. whether user-facing language should use `Sound` or `Voice`
3. whether `Execution Plan` is a user-facing term or an internal term behind
   `Analysis`
4. whether `Candidate` stays user-facing or is rephrased

## Working recommendation

For V3, the cleanest product-facing canon is:

- `Project`
- `Performance`
- `Sound`
- `Pad`
- `Layout`
- `Natural Hand Pose`
- `Candidate`
- `Event Analysis`

And the following should stay internal unless needed:

- `ProjectState`
- `SoundStream`
- `PerformanceLane`
- `LoopState`
- raw solver-family names

## 2. Grid Editing

This category means the exact interactive behavior of the Push grid and its
immediate companion controls, not the broader mapping workflow.

## V1 does this

Grid-editing functionality in V1:

- drag unassigned voices from the library to pads
- move a placed voice to another pad
- swap two occupied pads
- unassign a placed voice back to staging
- clear the whole grid
- rename placed voices inline
- show layout mode chip
- edit pose by clicking pads in pose-edit mode
- right-click pad context menu for:
  - finger locks
  - reachability view
  - remove sound
- show finger-color overlays and finger badges when analysis exists
- show pose ghost markers while editing pose

V1 grid-editing characteristics:

- more dedicated and focused
- tightly coupled to the library and pose panel
- physically centered
- discoverability problems because key actions are hidden in the context menu

## V2 does this

Grid-editing functionality in V2:

- drag sound from the palette to a pad
- move a sound between pads
- swap two occupied pads
- remove a sound from a pad
- right-click pad context menu
- pad-level finger constraints
- compare-grid mode for two candidates
- onion-skin toggle in the workspace
- selected-event highlight on the grid
- shared-pad highlight between current and next event
- movement arcs
- impossible-move highlighting
- event detail and transition detail panels immediately below or beside the grid

V2 grid-editing characteristics:

- stronger event-linked visual context
- stronger candidate comparison support
- more tightly connected to selected-event inspection
- still not clearly superior for core editing ergonomics
- loses the explicit pose-centered grid workflow that V1 had

## What is actually better

V1 is better if the question is:

- which version makes the grid feel like the dedicated mapping tool?
- which version keeps pose and source-material editing closer to the grid?

V2 is better if the question is:

- which version gives the grid richer event-linked visual feedback?
- which version gives the grid a stronger role in candidate comparison?

## What still needs your judgment

You need to decide whether the V3 grid should prioritize:

- dedicated editing clarity
- or integrated event-analysis overlays

My revised read is:

- V2 is not simply "better at grid editing"
- V2 is better at grid-linked feedback
- V1 is better at grid-centered editing clarity

## 3. Voice / Sound Organization

## V1 does this

V1 organizes source material around assignment state:

- `Detected`
  - all imported note identities
- `Unassigned`
  - voices not yet placed
- `Placed`
  - voices currently on the grid

V1 source-material features:

- rename voice
- recolor voice
- hide voice from filtered analysis
- destructively delete all events for a note
- clear staging
- drag from source list directly to grid

V1 strengths:

- assignment-state model is easy to understand
- strong link between source inventory and mapping progress
- user always knows what is placed versus not placed

V1 weaknesses:

- destructive actions sit too close to ordinary organization actions
- terminology still mixes `voice`, `sound`, and `note`

## V2 does this

V2 organizes source material around a broader palette model:

- `VoicePalette` / sound list in the left rail
- stream identity shown with counts and current assignment context
- sound-level constraints
- mute and timeline-related controls
- link into timeline and workspace flows

V2 source-material strengths:

- more integrated with timeline and project state
- better suited for projects with timeline muting, filtering, and lane-derived
  material
- stronger link between imported identity and ongoing workspace behavior

V2 source-material weaknesses:

- less obvious assignment-state grouping than V1
- mixes inventory, visibility, muting, and constraints into one surface
- stream/lane/sound distinctions leak into user cognition

## What is actually better

- V1 is better at "what is placed vs unplaced?"
- V2 is better at "how does this source identity behave across the workspace and
  timeline?"

## What still needs your judgment

For V3, you need to choose whether source organization is primarily:

- assignment-state driven
- or timeline/state driven

My current recommendation is not a pure V1 keep. It is:

- keep V1's assignment-state framing
- add only the V2 source controls that materially help the main workflow

## 4. Optimization Workflow

This is high risk because V1 and V2 are not just different UIs. They express
different product meanings.

## V1 does this

V1 optimization and analysis are distinct actions:

- `Run Analysis`
  - evaluate current mapping
- `Auto-Arrange`
  - mutate mapping through annealing
- helper actions before optimization:
  - `Seed`
  - `Natural`
  - `Random`
  - `Organize by 4x4 Banks`

V1 optimization flow:

1. build or seed a mapping
2. ensure full coverage
3. run analysis
4. optionally auto-arrange
5. inspect result in summary, timeline, or event analysis

V1 strengths:

- clearer distinction between evaluation and mutation
- explicit full-coverage rule
- easier to understand what changed when auto-arrange ran

V1 weaknesses:

- helper actions are too numerous and poorly narrated
- candidate comparison is weak
- optimization still overwrites the active mapping in place

## V2 does this

V2 optimization is centered on `Generate` plus auto-analysis:

- auto-analysis refreshes the active layout after edits
- `Generate` can:
  - seed an empty layout chromatically
  - run candidate generation
  - run beam search / annealing-backed layout search
  - populate three candidates
  - select one as active
- compare mode is built into the workflow

V2 strengths:

- much better alternative exploration
- stronger candidate lifecycle
- stronger compare workflow
- better alignment with the idea that there may be multiple plausible solutions

V2 weaknesses:

- `Generate` bundles too many meanings together
- user cannot easily tell when the system is:
  - analyzing current layout
  - inventing new layouts
  - seeding a blank layout
  - promoting a candidate
- the importance of classical `Auto-Arrange` is reduced, but not replaced with a
  simpler mental model

## What is actually better

- V1 is better at preserving the difference between "evaluate" and "change."
- V2 is better at comparison and search breadth.

## What still needs your judgment

You need to decide whether V3 should center optimization around:

- a distinct `Analyze` action plus a distinct `Generate Alternatives` action
- or a single unified optimization command

Given your note, I would now treat this category as:

- keep V2's candidate model and bug-fix direction
- keep V1's separation between evaluation and mutation
- do not treat `Auto-Arrange` itself as the core thing being salvaged

## 5. State / Source-of-Truth

## V1 does this

Effective V1 truth hierarchy:

- `Song`
  - portfolio container
- `ProjectState`
  - main working truth
- durable inputs inside `ProjectState`
  - imported performance
  - mappings
  - active mapping id
  - natural hand poses
  - manual assignments
  - solver results
- derived views
  - filtered performance
  - analyzed events
  - transitions
  - onion-skin model

V1 duplication problems:

- `Song` vs `ProjectState`
- `LayoutSnapshot` vs `GridMapping`
- raw vs filtered performance
- dormant `sectionMaps`

V1 overall read:

- still imperfect
- but coherent enough that a user is mostly editing one thing

## V2 does this

Effective V2 truth hierarchy:

- `ProjectState`
  - top-level editor truth
- spatial truth
  - active `Layout`
- displayed analysis truth
  - `analysisResult`
  - `candidates`
- performance truth contenders
  - `soundStreams`
  - `performanceLanes`
  - composer-local `LoopState`
- derived solver input
  - `Performance` from unmuted streams

V2 duplication problems:

- `soundStreams` vs `performanceLanes`
- project timeline vs composer `LoopState`
- `analysisResult` vs `candidates`
- `voiceConstraints` vs `layout.fingerConstraints`
- imported structural metadata vs later edited timeline

V2 overall read:

- richer
- but much less safe as a product definition

## What is actually better

- V1 is better as a user-facing source-of-truth model.
- V2 is better at exposing where invalidation and candidate state actually
  exist.

## What still needs your judgment

For V3, the highest-leverage question is:

- what is the one canonical performance object?

Until that is answered, no screen or workflow decision will stay stable.

## 6. Visualization and Feedback

## V1 does this

Primary feedback surfaces in V1:

- Dashboard:
  - MIDI linked
  - status badges
- Workbench grid:
  - finger-color overlays
  - finger badges
  - finger-lock indicators
  - pose ghost markers
  - reachability tint
  - layout mode chip
- Analysis panel:
  - ergonomic score
  - hand balance
  - metric averages
  - assignment table
- Timeline:
  - voice lanes
  - note blocks
  - finger labels
- Event Analysis:
  - transition heat bars
  - event log with overrides
  - onion-skin grid
  - transition metrics
  - practice loop stepping
- Cost Debug:
  - per-event costs
  - annealing trace

V1 strengths:

- best deep-analysis explanation spine
- best onion-skin-centered transition understanding
- clearer separation of summary analysis, event analysis, and debug

V1 weaknesses:

- weaker integrated edit -> reanalyze -> compare loop
- less immediate inline explanation during editing
- poor guidance on what matters most next

## V2 does this

Primary feedback surfaces in V2:

- Project cards:
  - difficulty badge
  - event/sound counts
- Grid:
  - selected-event highlights
  - onion-skin overlays
  - shared pads
  - movement arcs
  - impossible-move highlighting
  - compare-grid mode
- Timeline:
  - event pills
  - assignment overlays
  - event selection driving other panels
- Analysis:
  - candidate switcher
  - compare mode
- Diagnostics:
  - score
  - drift
  - fatigue
  - hand balance
  - suggestions
- Event detail:
  - selected event facts and local cost detail
- Transition detail:
  - current-to-next movement explanation
- Debug dashboard:
  - sanity
  - irrational assignment
  - violations
  - movement
  - detailed cost breakdown

V2 strengths:

- better local feedback during editing
- better candidate comparison support
- better immediate event-selection loop
- honest stale-analysis signaling

V2 weaknesses:

- user-facing analysis story is fragmented
- `Analysis` label is misleading
- some feedback is reliable only if the hidden state synchronization is behaving
- composer and timeline side effects weaken trust

## What is actually better

- V1 is better for explanatory reliability and deep-analysis structure.
- V2 is better for local editing feedback and comparison support.

## Reliable carry-forward features

Features that are worth carrying forward if you want reliability:

- V1 onion-skin event-analysis structure
- V1 transition metrics framing
- V1 cost debug breakdown
- V2 selected-event linkage between timeline and grid
- V2 compare-grid mode
- V2 stale-analysis badge
- V2 event and transition detail previews inside the workspace

## 7. Screen Architecture

You said this should come from deeper analysis. I agree.

Current working comparison only:

- V1 has clearer responsibilities.
- V2 has stronger integration.
- the real V3 choice is not "many screens vs one screen"
- the real choice is "which responsibilities stay distinct even if the UI is
  unified?"

## 8. Debug Tools

## V1 does this

V1 debug tooling is anchored by `Cost Debug`:

- per-event cost breakdown
- sort by cost or time
- annealing trajectory
- annealing metrics

V1 debug strength:

- cost-focused
- legible
- useful when understanding why a specific event is expensive

## V2 does this

V2 debug tooling is anchored by `/optimizer-debug`:

- event timeline
- finger usage
- cost breakdown
- violations
- movement
- irrational assignments
- sanity checks
- candidate reports

V2 debug strength:

- broader and more systematic
- better for verifying solver quality across candidate results

## What is actually better

This is not a clean replacement.

- V1 cost debug is still useful and should not be assumed obsolete.
- V2 optimizer debug expands the toolkit rather than superseding V1's event-cost
  view.

## Working recommendation

Debug salvage should now read:

- keep V1 `Cost Debug` concepts
- keep V2 `Optimizer Debug` concepts
- merge them into one internal debug architecture with separate tabs or modes

## 9. Timeline Workflow

## V1 timeline workflow

Primary use case:

- inspect the mapped performance chronologically after mapping and analysis
  exist

Typical flow:

1. open dedicated timeline page
2. hydrate song state
3. resolve active mapping and solver result
4. show one row per mapped voice
5. inspect note timing and finger labels
6. zoom or seek
7. return to workbench or event analysis

Timeline features in V1:

- dedicated route
- zoom control
- voice-lane display
- finger labels
- click-to-seek

V1 timeline meaning:

- an inspection surface
- not a primary authoring surface

## V2 timeline workflow

Primary use cases:

- inspect timing inside the workspace
- import additional MIDI into the project
- filter and mute material
- select events that drive the rest of the workspace

Typical flow:

1. open timeline drawer
2. inspect current streams or import more MIDI into lanes
3. filter or mute visible material
4. zoom or use visual transport
5. click event pills
6. watch the grid, event detail, and transition detail update

Timeline features in V2:

- embedded timeline in the workspace
- MIDI import
- stream/lane synchronization
- mute and filtering
- zoom
- visual transport
- event selection as global coordination input

V2 timeline meaning:

- both an authoring surface and an inspection surface
- one of the main causes of source-of-truth ambiguity

## Best use cases by version

V1 timeline is better for:

- clean chronological inspection
- separating "time view" from "layout edit view"

V2 timeline is better for:

- keeping time and space linked during editing
- using event selection as the coordination spine

## What still needs your judgment

You need to decide whether V3 timeline is:

- inspection-first
- editing-first
- or dual-purpose

If it is dual-purpose, V3 must explicitly solve the source-of-truth problem that
V2 did not.

## 10. Composer

## V1 does this

- composer is not a meaningful core product path in V1

## V2 does this

Composer is a real alternative creation path:

- create or edit loop lanes
- toggle steps in a grid
- use presets, random generation, and recipe editing
- generate pad assignments and finger assignments
- sync generated material into project lanes
- bulk-update the main grid layout

V2 composer strengths:

- genuinely useful if the user has no MIDI and wants to originate material
- integrated enough to share the same physical analysis frame

V2 composer risks:

- carries its own local state model
- rewrites shared project state
- weakly explains when it is acting as a sandbox versus the main truth

## Working recommendation

Your framing is sensible:

- composer should be an alternative path when a project is created without MIDI
- that implies it should be a clearly declared branch, not a quietly co-equal
  embedded pillar

If you keep it, V3 must define:

- the canonical timeline object it writes into
- whether it is an alternative entry path or always-available side tool
- whether its lane model is the same as the main editable MIDI timeline

## 11. Constraints Model

## V1 does this

Visible constraint concepts in V1:

- pad-level finger locks on the grid
- manual per-event hand/finger overrides in Event Analysis
- hidden engine feasibility rules
  - reach
  - speed
  - alternation
  - balance
- reachability visualization from the grid context menu

V1 strengths:

- strong local control at the pad and event level
- debug page helps explain event costs

V1 weaknesses:

- no clean user-facing hierarchy of constraint types
- users can still confuse a pad lock with a solver preference or an event
  override

## V2 does this

Visible constraint concepts in V2:

- voice-level hand/finger constraints in the palette
- pad-level finger constraints in event detail or context menu
- hidden solver feasibility rules
- debug constraint validator and violation reporting

V2 strengths:

- more explicit that there are multiple constraint layers
- better debug support for violations

V2 weaknesses:

- the user cannot easily tell which level actually controls the solver most
  strongly
- voice constraints appear weaker or less reliable than pad constraints
- product meaning is more ambiguous than in V1 because more layers are visible

## What still needs your judgment

You said you will be the final say of the canon. The key decision is:

- which constraint layer is primary in the user model?

The cleanest options are:

1. one primary visible constraint layer and everything else stays internal
2. two visible layers, but with explicit names and precedence

What V3 should not do is keep all current layers visible without a hierarchy.

## 12. What “Grid Feedback” Means

In the `Bottom Line` section of
[`SALVAGE_MATRIX.md`](/Users/tjgalloway/Programming%20Projects%202026/PushFlow%20V3/product-reconciliation/output/SALVAGE_MATRIX.md),
`grid feedback` meant the event-linked visual information that V2 puts directly
on or around the grid during editing and inspection.

Specifically:

- selected-event highlight on the grid
- onion-skin previous/next overlays
- shared-pad highlighting
- movement arcs
- impossible-move highlighting
- compare-grid mode
- immediate linkage between timeline event selection and what the grid shows

It did not mean that V2's core grid-editing workflow was categorically better.
It meant that V2 gave the grid richer inline analysis feedback during use.
