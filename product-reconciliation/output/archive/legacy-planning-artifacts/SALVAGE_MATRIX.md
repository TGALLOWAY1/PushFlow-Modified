# Salvage Matrix

## Quality Scale

- `High`: strong product fit and coherent user meaning
- `Medium`: useful, but ambiguous or incomplete
- `Low`: confusing, weakly integrated, or product-destabilizing

### Project Entry Flow

- **Decision**: **Merge**
- **Quality**: V1 (Medium) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1 had clearer entry destinations; V2 had better import naming,
  demos, and project re-entry.
- **Notes**: V3 entry should keep V2 import quality but avoid equal emphasis on
  blank creation, demos, import, and history.

### Midi Import Workflow

- **Decision**: **Keep from V2**
- **Quality**: V1 (Medium) / V2 (High)
- **Risk**: Low
- **Reason**: V2's naming step and clearer project creation are better product
  scaffolding.
- **Notes**: Keep import grouped by sound identity, but make its result feed one
  canonical workflow.

### Terminology Model

- **Decision**: **Rewrite**
- **Quality**: V1 (Medium) / V2 (Low)
- **Risk**: High
- **Reason**: Neither version achieved a stable canon; V2 made the visible
  vocabulary worse.
- **Notes**: V3 must retire `stream`, `lane`, and `loop` from core product copy
  unless technically necessary.

### Domain Object Model

- **Decision**: **Merge**
- **Quality**: V1 (Medium) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1 had the cleaner core; V2 had the better articulation of
  candidate and execution artifacts.
- **Notes**: Keep the V1-sized core and add V2's candidate concept.

### Mapping/Layout Authoring

- **Decision**: **Merge**
- **Quality**: V1 (High) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1's authoring was more legible; V2 improved event-linked context
  around edits.
- **Notes**: Preserve direct grid editing, but do not let authoring and
  composition become the same task.

### Grid Editing

- **Decision**: **Keep from V2**
- **Quality**: V1 (Medium) / V2 (High)
- **Risk**: Low
- **Reason**: V2's grid overlays, compare mode, and selected-event linkage are
  stronger.
- **Notes**: Keep only the editing interactions that serve the core workflow;
  hidden power gestures still need simplification.

### Voice/Sound Organization

- **Decision**: **Keep from V1**
- **Quality**: V1 (High) / V2 (Medium)
- **Risk**: Low
- **Reason**: V1's Detected / Unassigned / Placed model is clearer than V2's
  mixed sound/constraint palette.
- **Notes**: V3 should organize source material by assignment state, not by
  implementation model.

### Natural Hand Pose Personalization

- **Decision**: **Keep from V1**
- **Quality**: V1 (High) / V2 (Low)
- **Risk**: Medium
- **Reason**: V1 treated pose as a real product concept and workflow step; V2
  effectively buried it.
- **Notes**: Pose should remain important, but V3 must clarify whether it is
  required setup or contextual setup.

### Analysis Workflow

- **Decision**: **Merge**
- **Quality**: V1 (High) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1 had the better deep-analysis spine; V2 had better inline
  summary and feedback loops.
- **Notes**: Summary analysis belongs in the workspace; deep explanation belongs
  in a dedicated analysis mode.

### Event/Transition Inspection

- **Decision**: **Keep from V1**
- **Quality**: V1 (High) / V2 (Medium)
- **Risk**: Low
- **Reason**: V1's dedicated Event Analysis is still the clearest user-facing
  explanation surface.
- **Notes**: V2's local panels are useful previews, not substitutes for a
  first-class analysis flow.

### Optimization Workflow

- **Decision**: **Merge**
- **Quality**: V1 (Medium) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1 separated analysis from auto-arrange more clearly; V2 improved
  candidate generation.
- **Notes**: V3 should distinguish analyze current layout from generate
  alternatives.

### Candidate Comparison

- **Decision**: **Keep from V2**
- **Quality**: V1 (Low) / V2 (High)
- **Risk**: Low
- **Reason**: This is one of V2's clearest genuine product improvements.
- **Notes**: Comparison should be easier to find and should feed back into
  editing and event analysis.

### State/Source-Of-Truth Model

- **Decision**: **Merge**
- **Quality**: V1 (Medium) / V2 (Low)
- **Risk**: High
- **Reason**: V1 had the simpler truth model; V2 had better awareness of stale
  analysis and candidate lifecycle.
- **Notes**: One performance truth is non-negotiable for V3.

### Visualization And Feedback

- **Decision**: **Merge**
- **Quality**: V1 (High) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1 explained difficult transitions better; V2 linked grid,
  timeline, and metrics better during editing.
- **Notes**: V3 should keep V2's live coupling and restore V1's dedicated
  explanatory hierarchy.

### Screen Architecture

- **Decision**: **Merge**
- **Quality**: V1 (High) / V2 (Low)
- **Risk**: High
- **Reason**: V1 had clearer boundaries; V2 proved that some integration is
  useful.
- **Notes**: Recommended V3 shape is library + workspace + event analysis, with
  debug internal-only.

### Debug Tools

- **Decision**: **Keep from V2**
- **Quality**: V1 (Medium) / V2 (High)
- **Risk**: Low
- **Reason**: V2's internal debug/reporting layer is stronger and more
  systematic.
- **Notes**: Keep it explicitly internal, not part of the user-facing product
  definition.

### Timeline Workflow

- **Decision**: **Rewrite**
- **Quality**: V1 (Medium) / V2 (Medium)
- **Risk**: High
- **Reason**: V1's timeline was clear but limited; V2's timeline is powerful but
  conceptually overloaded.
- **Notes**: V3 needs one timeline concept: a support surface tied to the
  canonical performance.

### Composer / Pattern Generation

- **Decision**: **Rewrite**
- **Quality**: V1 (Low) / V2 (Medium)
- **Risk**: High
- **Reason**: V1 barely had it; V2 made it real but let it destabilize the
  mission and state model.
- **Notes**: It should be deferred or isolated as an adjunct workflow, not left
  embedded as a co-equal pillar.

### Constraints Model

- **Decision**: **Rewrite**
- **Quality**: V1 (Medium) / V2 (Low)
- **Risk**: Medium
- **Reason**: V1 already had assignment ambiguity; V2 made constraint levels
  even harder to understand.
- **Notes**: V3 needs one visible constraint hierarchy, not pad, sound, and
  solver rules all presented the same way.

### Export Model

- **Decision**: **Rewrite**
- **Quality**: V1 (Medium) / V2 (Low)
- **Risk**: Medium
- **Reason**: V1 mixed song autosave, project export, and analysis export; V2
  narrowed to JSON but left core downstream value unresolved.
- **Notes**: V3 should define what the saved project is before expanding export
  promises.

### Project Container Model

- **Decision**: **Merge**
- **Quality**: V1 (Medium) / V2 (Medium)
- **Risk**: Medium
- **Reason**: V1's song shell gave continuity; V2's project shell better matches
  the actual workflow.
- **Notes**: V3 should use `Project` as the main object and treat song metadata
  as optional context, not the product backbone.

### Demo / Fixture Strategy

- **Decision**: **Keep from V2**
- **Quality**: V1 (Low) / V2 (High)
- **Risk**: Low
- **Reason**: Demo projects and feasibility scenarios are useful for onboarding
  and QA.
- **Notes**: Keep demos, but subordinate them to the main import-and-work flow.

## Bottom Line

The highest-value salvage pattern is:

- keep V1's workflow spine, pose visibility, voice organization, and dedicated
  event analysis
- keep V2's import quality, candidate comparison, grid feedback, diagnostics,
  and internal debug tooling
- rewrite the terminology, state model, timeline model, constraint model, and
  composer positioning
