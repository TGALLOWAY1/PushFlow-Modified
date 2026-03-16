# V1 vs V2 Product Comparison

## Overall Read

V1 had the clearer product spine: import a song, build a Push layout, analyze
playability, then deep-dive hard transitions. V2 improved the integrated
workspace, candidate generation, and comparison logic, but it also let too many
adjacent missions become first-class at once. V3 should keep V2's stronger
analysis engine and comparison concepts while restoring V1's workflow clarity,
screen boundaries, and simpler source-of-truth model.

## Structured Comparison

### Product mission

|        | Strengths                                                                                                                                        | Weaknesses                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **V1** | Clear practical read: a Push playability and mapping tool for imported MIDI.<br>Strong connection between layout editing and ergonomic analysis. | Top-level shell still mixed in song portfolio and practice semantics.<br>`Section` language lingered after the product stopped being section-led.                                          |
| **V2** | Canonical docs articulate the deeper intent well: jointly optimize layout and execution over time.                                               | Live product no longer expresses one dominant mission.<br>Verification, manual design, timeline authoring, candidate generation, and composition all compete as co-equal reasons to exist. |

**Recommendation for V3**: Make V3 explicitly about turning imported performance
material into a physically playable Push layout and explaining the tradeoffs.
Everything else is support or out of scope.

### Primary user

|        | Strengths                                                                                       | Weaknesses                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **V1** | Clearly centered on a Push performer or finger drummer adapting existing material.              | Song metadata suggested a practice-tracking persona the product did not truly serve.                          |
| **V2** | Better recognition of advanced users comparing alternatives and inspecting execution over time. | Added producer/composer and debug-heavy personas into the main shell, which diluted the core performer focus. |

**Recommendation for V3**: Optimize for the performer/producer adapting existing
MIDI to Push. Treat composer and debugger personas as secondary or deferred.

### Core JTBD

|        | Strengths                                                                                            | Weaknesses                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **V1** | Strong JTBD around mapping imported material to the grid and reducing physical strain.               | Comparison and multi-candidate exploration were weaker as first-class jobs.                   |
| **V2** | Better support for a second JTBD: compare multiple plausible solutions rather than trust one answer. | Creation-first JTBD and verification-first JTBD are both visible, with no declared hierarchy. |

**Recommendation for V3**: Lead JTBD: map imported MIDI to Push and iterate
until it is physically playable for this user. Supporting JTBDs: compare
alternatives and inspect hard transitions.

### Workflow clarity

|        | Strengths                                                                                                              | Weaknesses                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V1** | Natural end-to-end spine was visible: Dashboard -> MIDI -> Workbench -> Pose -> Mapping -> Analysis -> Event Analysis. | Too many equally weighted first-step actions after import: Seed, Natural, Random, Auto-Arrange, manual drag.                                             |
| **V2** | Unified workspace reduced route-hopping for many tasks.                                                                | The primary happy path became blurrier, not clearer.<br>The user can enter from library, timeline import, composer, or generate, with no dominant route. |

**Recommendation for V3**: Restore one canonical workflow spine. Keep alternate
flows, but demote them behind the main sequence.

### Domain model clarity

|        | Strengths                                                                                           | Weaknesses                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **V1** | Simpler durable model: Song, ProjectState, Performance, GridMapping, NaturalHandPose, EngineResult. | `layout` still overloaded because `LayoutSnapshot` and `GridMapping` coexisted under similar language. |
| **V2** | Stronger formal concepts around `Layout`, `Execution Plan`, and `Candidate Solution`.               | User-facing model fragmented across project, stream, lane, pattern, and candidate concepts.            |

**Recommendation for V3**: Merge V1's simpler core with V2's clearer output
artifacts. Canonical objects should be Project, Performance, Sound, Layout,
Candidate, Execution Plan, Natural Hand Pose.

### State model clarity

|        | Strengths                                                                                                            | Weaknesses                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **V1** | Clearer effective truth: song-scoped `ProjectState` plus derived analysis artifacts.                                 | Some confusion remained around filtered vs raw performance and dormant objects like `sectionMaps`.                 |
| **V2** | Better explicit acknowledgment that layout mutations invalidate analysis and that candidates are distinct artifacts. | Major regression: `soundStreams`, `performanceLanes`, `LoopState`, and derived `Performance` all compete as truth. |

**Recommendation for V3**: V3 needs one canonical performance timeline. Lanes,
drawer views, or composer state may exist only as editors or views of that one
truth, never as peers.

### Terminology consistency

|        | Strengths                                                                                      | Weaknesses                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **V1** | `Voice`, `Pad`, `Mapping`, and `Natural Hand Pose` were comparatively understandable.          | `Song`, `Project`, `Layout`, `Section`, and `Analysis` still drifted.                                                                   |
| **V2** | Docs tried harder to canonize terms like `Layout`, `Execution Plan`, and `Candidate Solution`. | Live UX became more confusing: sound vs voice vs stream vs lane; analysis vs diagnostics vs compare; score vs difficulty vs complexity. |

**Recommendation for V3**: Rewrite the terminology canon. Keep implementation
terms internal. Use one user-facing term per concept.

### Screen architecture

|        | Strengths                                                                                                                                                                    | Weaknesses                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **V1** | Strong responsibility split: Dashboard for entry, Workbench for editing, Event Analysis for deep inspection, Timeline for chronological review, Cost Debug for internal use. | Workbench and Event Analysis still overlapped enough to create some duplication.                                                              |
| **V2** | Unified workspace improved coupling between grid, timeline, and local detail.                                                                                                | One giant editor now holds too many verbs and too many conceptual objects.<br>Hidden retained screens prove the consolidation was incomplete. |

**Recommendation for V3**: Keep a unified workspace for editing, but restore a
dedicated Event Analysis mode. Keep Timeline as an embedded support surface or
focus mode, not a separate product pillar.

### UX coherence

|        | Strengths                                                                                                | Weaknesses                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **V1** | The product mostly behaved like one task with drill-downs.                                               | The empty-grid import model and pose significance were under-explained. Hidden right-click actions hurt discoverability.                        |
| **V2** | Richer inline feedback loops: stale-analysis honesty, selected-event linkage, compare grid, diagnostics. | The product feels mentally overloaded even when visually unified.<br>The drawer and side panel hide important modes instead of clarifying them. |

**Recommendation for V3**: Preserve the best linked feedback loops from V2, but
simplify the number of primary actions and visible modes.

### Feature scope

|        | Strengths                                                                                                                 | Weaknesses                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **V1** | Narrower and therefore easier to reason about. Strong bias toward mapping, analysis, and optimization.                    | Comparison workflow, import refinement, and modern library ergonomics were less developed.                                     |
| **V2** | More capable import flow, better project library, candidate comparison, diagnostics, demos, and integrated detail panels. | Capability accumulation became product drift: timeline authoring, composition, debug, and optimization all claim center stage. |

**Recommendation for V3**: Keep only features that directly support the core
JTBD. Defer or remove features that make the product feel like a general
composition workspace.

### Visualization / feedback quality

|        | Strengths                                                                                                                        | Weaknesses                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **V1** | Dedicated Event Analysis had the clearest explanatory spine in either version.<br>Onion-skin and transition metrics were strong. | Summary analysis was less connected to a continuous edit -> inspect -> compare loop.                |
| **V2** | Better integrated micro-feedback: stale badge, event-linked grid overlays, compare grid, diagnostics, candidate deltas.          | Analysis story is split across Analysis, Diagnostics, local detail panels, compare mode, and debug. |

**Recommendation for V3**: Merge V1's analysis legibility with V2's integrated
feedback loops. Summary, compare, and event analysis must form one clear
hierarchy.

### Analysis / debug separation

|        | Strengths                                                                                                                          | Weaknesses                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **V1** | Cost Debug was clearly developer-facing and separate from normal user analysis. Event Analysis had a distinct user-facing purpose. | Workbench summary and Event Analysis still overlapped enough to create ambiguity.                                       |
| **V2** | Debug tooling is much richer and internal heuristics are stronger.                                                                 | User-facing analysis taxonomy got worse: "Analysis" is mostly candidate switching, while real explanation is elsewhere. |

**Recommendation for V3**: V3 should define four layers explicitly: Summary,
Compare, Event Analysis, Debug. Debug stays internal and should not share the
same product vocabulary as user analysis.

## V3 Synthesis

V1 should be treated as the better product-structure reference. V2 should be
treated as the better engine-and-workspace capability reference. The correct V3
move is not to choose one wholesale; it is to combine V1's boundaries and task
hierarchy with V2's stronger comparison, diagnostics, and integrated
spatial-temporal feedback.
