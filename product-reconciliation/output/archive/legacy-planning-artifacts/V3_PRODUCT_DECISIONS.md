# V3 Product Decisions

## Recommended Product Mission

PushFlow V3 should be a performance-mapping and playability-analysis tool for
Ableton Push. Its job is to take imported MIDI performance material, map it onto
the Push grid, evaluate whether human hands can actually play it, and help the
user improve that result with clear comparisons and targeted event-level
explanation.

## Recommended Primary User

The primary user is a Push performer or producer who already has MIDI material
and needs to make it physically playable, learnable, and defensible on the
hardware.

This is not primarily a practice tracker, a general composition environment, or
a solver-debug application.

## Top 3 User Goals

1. Turn imported performance material into a complete Push layout with full note
   coverage.
2. Understand why the current layout is easy or hard at the summary, passage,
   and event-transition levels.
3. Compare and refine alternate layouts using the user's own hand pose and
   technique constraints.

## Primary JTBD Statement

When I have MIDI material I want to perform on Push, I want to map it onto the
grid and iteratively evaluate it against real hand movement so I can end up with
a layout that is physically playable for me rather than merely musically correct
in software.

## Canonical Workflow

1. Create or open a `Project`.
2. Import MIDI and name the detected `Sounds`.
3. Review the imported `Performance` and confirm the source material.
4. Create a starting `Layout` through one primary guided action.
5. Configure `Natural Hand Pose` when the user first needs personalized
   generation or analysis.
6. Run or refresh `Analysis` on the current layout.
7. Inspect hard passages and transitions in `Event Analysis`.
8. Edit layout or constraints and compare `Candidates`.
9. Save the project or export the project artifact.

The key decision is that generation, analysis, and comparison are one iterative
loop around imported performance material. Composition is not the core loop.

## Recommended Screen Architecture

### `Project Library`

- **Role**: Entry and re-entry
- **What belongs here**: create project, import MIDI, open saved work, open
  demos
- **What does not belong here**: deep editing, analysis, composition

### `Project Workspace`

- **Role**: Primary editing shell
- **What belongs here**: sound inventory, grid editing, starting-layout
  generation, summary analysis, candidate comparison, embedded timeline context
- **What does not belong here**: developer diagnostics, full event-analysis
  workflow, hidden alternate editors

### `Event Analysis`

- **Role**: Dedicated deep inspection mode
- **What belongs here**: passage/event/transition explanation, onion-skin view,
  focused metrics, manual override of local technique decisions
- **What does not belong here**: project entry, broad authoring, general debug
  instrumentation

### `Debug Tools`

- **Role**: Internal-only tools
- **What belongs here**: solver validation, irrational-assignment checks,
  low-level reports
- **What does not belong here**: user-facing navigation, product copy, core
  workflow promises

Recommended structural simplification:

- Keep the timeline as an embedded support surface inside the workspace.
- Do not keep timeline authoring, composition, and analysis as three equal
  product pillars.
- Restore Event Analysis as a first-class user mode instead of leaving it
  implied by side panels.

## Canonical Terminology

| Term                | Meaning in V3                                                | Terms to retire or demote                                                    |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `Project`           | The saved unit of work                                       | `Song` as the primary product object                                         |
| `Performance`       | The canonical imported or edited time-based musical sequence | `stream` or `lane` as user-facing primary terms                              |
| `Sound`             | A user-facing musical identity derived from the performance  | mixed use of `voice`, `note`, and `sound` in the UI                          |
| `Pad`               | One physical Push grid location                              | `cell`                                                                       |
| `Layout`            | The static assignment of sounds to pads                      | using `layout` to also mean project, performance snapshot, or workflow state |
| `Natural Hand Pose` | The user's preferred neutral hand placement                  | `Pose 0`, `neutral pose`, `resting pose` as co-equal user terms              |
| `Execution Plan`    | The derived hand/finger realization over time                | generic `solver result` as the main user-facing term                         |
| `Candidate`         | A proposed layout plus its execution analysis                | raw solver-family names as primary product concepts                          |
| `Event Analysis`    | Focused explanation of difficult passages and transitions    | `analysis`, `diagnostics`, and `compare` used interchangeably                |
| `Constraint`        | A deliberate user-imposed playing rule with clear scope      | multiple unnamed constraint types presented without hierarchy                |

## Recommended Domain Source-of-Truth Model

### Durable product truth

- `Project`
- one canonical `Performance`
- one set of `Sounds` derived from that performance
- one or more `Layouts`
- one `Natural Hand Pose` profile
- one explicit `Constraint` model

### Derived analysis truth

- `Execution Plan`
- `Difficulty Analysis`
- `Candidate` comparison data
- `Event Analysis` views such as passages, transitions, and onion-skin context

### Source-of-truth rules

1. The product must have one canonical performance timeline.
2. Timeline views, lane views, and any future composition tools may edit or
   present that timeline, but they are not separate truths.
3. A `Layout` is the only canonical static mapping artifact.
4. A `Candidate` is a derived proposal, not a second hidden project model.
5. Analysis is always derived from the currently selected performance, layout,
   hand pose, and constraints.
6. Debug artifacts are never treated as user-facing source of truth.

## Features to Exclude from V3

- Pattern composer as a core product pillar
- Practice-tracking or song-portfolio semantics as primary positioning
- User-facing solver-family comparison as a headline workflow
- Section/template workflows without a clear user need
- Hidden alternate timeline or loop editors
- Developer debug tools in the main user navigation

## Features to Defer

- Push/Ableton-specific downstream export beyond project export
- Cross-project layout standardization tools
- Real playback or rehearsal tooling beyond current analysis-driven inspection
- Advanced structure analytics such as section role editing
- Composer or pattern-generation tooling, if retained at all, as a separate
  later workflow

## Important Simplifications

1. One mission: imported performance -> playable Push layout.
2. One primary user: performer adapting existing material.
3. One performance truth: no parallel stream, lane, and loop truths.
4. One primary editor shell, plus one dedicated deep-analysis mode.
5. One analysis hierarchy: summary -> compare -> event analysis -> internal
   debug.
6. One visible generation path for creating a starting layout.
7. One terminology canon that hides implementation distinctions from the user
   unless they matter.

## Recommended V3 Direction in One Paragraph

PushFlow V3 should be a focused Push performance-mapping product, not a hybrid
of song library, composition tool, and debug lab. Compared with V1, it should
keep the clearer workflow spine and dedicated event-analysis responsibility;
compared with V2, it should keep the stronger project entry, candidate
comparison, and integrated grid-timeline feedback. The problem it solves is
specific: helping a Push performer take imported MIDI material, map it to the
grid, understand the physical consequences of that mapping, and converge on a
layout that is actually playable for their hands.
