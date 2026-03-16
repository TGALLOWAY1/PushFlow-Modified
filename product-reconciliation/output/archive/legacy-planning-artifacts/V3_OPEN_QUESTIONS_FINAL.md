# V3 Open Questions — Final Reconciliation Pass

## 1. Purpose of this document

This file exists to surface only the questions that still require a user decision before merge/design work proceeds.

Items that are already settled by the master draft, prior reconciliation outputs, source docs, and later clarifications should not remain framed as open. Each remaining question below is written to be answerable without another translation pass.

## 2. What is already resolved

| Item | Decision/status | Short explanation | Why it should no longer remain open |
|------|-----------------|-------------------|-------------------------------------|
| V3 product mission | Resolved | V3 is a Push playability and layout-convergence product, not a general composition workspace or debug lab. | The master draft and later clarifications are more specific than the earlier outputs, and they supersede the narrower imported-MIDI-only framing in `V3_PRODUCT_DECISIONS.md`. |
| Imported vs manual entry paths | Resolved | Imported MIDI and manually created/edited MIDI are both first-class inputs into the same canonical performance workflow. | The user explicitly clarified this, and the master draft already treats timeline authoring as core rather than optional. |
| Manual mapping status | Resolved | Manual mapping is a primary capability, not a convenience feature or fallback. | Multiple earlier outputs drifted toward optimizer-first framing; that drift is now corrected. |
| Single-event difficulty evaluation | Resolved | Evaluating the difficulty of a specific event under a specific layout and finger assignment is a core product function. | This is now a stated non-negotiable requirement because it anchors trust, debugging, experimentation, and candidate verification. |
| Primary access to single-event analysis | Resolved | V3 must support both inline timeline selection -> grid + diagnostics and a dedicated Event Analysis flow. | The master draft already settles this as two valid access paths rather than a single surface choice. |
| `Project` vs `Song Project` | Resolved | `Project` is the canonical top-level container term. | The original question was answered directly; keeping it open adds noise. |
| `Natural Hand Pose` role | Resolved at policy level | Pose is essential supporting information for seeding and optimization, but it is not itself a hard infeasibility rule. | The remaining work is UX treatment, not product meaning. |
| Timeline authoring scope | Resolved | Timeline authoring is in scope for core V3, including blank 4/8/16 bar starts, lane creation, naming/coloring, grouping, and convergence into the same canonical performance truth as imported MIDI. | The earlier “inspection-first vs editing-first” question has already been answered. |
| Automated pattern generation | Resolved | Automated pattern generation should be removed from MVP/core scope. | The user explicitly rejected it as a core pillar, and the master draft records that decision. |
| Initial export scope | Resolved | A formal Push/Ableton export is not required for the first V3 pass; a clear human-readable assignment artifact is sufficient. | This was a direct answer to an earlier open question. |
| Analyze vs mutate/generate distinction | Resolved | `Analyze Current Layout` and `Generate Alternatives` must remain distinct meanings, even if they live in one workspace. | Earlier docs sometimes flattened this into “Auto-Arrange” or “Generate”; the master draft corrects that. |
| Candidate comparison | Resolved | V2 candidate generation/comparison is worth salvaging, but it belongs inside a clearer analysis hierarchy. | The question is no longer whether candidate comparison stays; it is how it is framed. |
| Grid editor baseline | Resolved at the directional level | V1 is the baseline for editing clarity; V2 contributes selective feedback overlays and compare behaviors. | “V2 is better at grid editing” is not supportable from the source docs, so that broad preference question should not survive. |
| Voice/sound area as-is salvage | Resolved | Neither V1 nor V2 should be accepted wholesale; this is a rewrite target with selective salvage. | V1 is clearer about placement state, V2 is conceptually stronger about project-wide identity, and V2 propagation is not trustworthy enough to keep as-is. |
| Debug tooling direction | Resolved | V1 Cost Debug concepts and V2 optimizer-debug breadth should both survive as internal tools. | This is a merge decision, not an open product question. |

## 3. True remaining open questions

### Open Question 1

#### Question

When a user manually places, swaps, removes, constrains, or overrides something, exactly which edits must optimization preserve, which may it change, and how should conflicts be shown?

#### Why this is still open

The existing materials settle that manual mapping is primary and that optimization must run from a partially manual state, but they do not define action-by-action behavior. V1 and V2 both expose multiple manual-control layers, and neither the master draft nor the prior outputs turns those layers into a clear preservation/override contract.

#### What V1 contributes

- Clear distinction between `Run Analysis` and `Auto-Arrange`.
- Pad-level finger locks on the grid.
- Manual per-event hand/finger overrides in Event Analysis.
- Full-coverage requirement before optimization.
- Stronger sense that the user is editing one active mapping.

#### What V2 contributes

- Pad-level finger constraints with more direct solver integration.
- Voice-level hand/finger constraints, even though their solver effect is unclear.
- Candidate generation and candidate comparison.
- Stale-analysis signaling after edits.
- Better surfacing of the fact that layout changes and solver state can diverge.

#### What is being decided

The user-facing contract for manual edits during analysis, optimization, and candidate comparison.

#### Recommended framing for user decision

Do not answer this as “How manual should V3 be?” Instead, decide each manual action type as one of:

- hard preserve
- soft preference
- temporary test input
- freely editable state

#### Specific points requiring user input

- Whether an explicit sound-to-pad placement is a hard preserve during optimization.
- Whether move/swap/remove actions change the active canonical layout immediately or create a reviewable pending state.
- Whether pad-level finger constraints are hard rules or user preferences.
- Whether sound-level hand/finger preferences should exist in MVP at all.
- Whether per-event manual finger overrides are local diagnostic tests, persistent performance truth, or promotable-to-rule actions.
- What the optimizer should do when a hard manual rule conflicts with a better-scoring candidate: block, warn, or generate alternatives that respect the rule.
- Whether candidate comparison must explicitly show which manual rules each candidate preserved or violated.

#### Suggested provisional direction

Treat explicit sound-to-pad placements and pad-level finger locks as hard preserves, treat pose and sound-level preferences as soft influences, and treat per-event overrides as local diagnostic tests unless the user explicitly promotes them.

### Open Question 2

#### Question

What exactly is the user-facing thing being mapped to pads in V3: pitch-derived sounds, project-wide sound identities that are not defined solely by pitch, or a hybrid?

#### Why this is still open

The earlier reconciliation outputs correctly noticed that V1 is clearer about assignment state and that V2 was reaching toward broader project-wide sound identity, but they do not settle the canonical V3 identity model. The source docs also stop short of doing so: V1 is largely pitch-derived, while V2 introduces `Sound`, `SoundStream`, and `PerformanceLane` without stabilizing their product meaning. The user explicitly asked that V2’s conceptual uncoupling from original MIDI pitch be taken seriously, but not accepted wholesale.

#### What V1 contributes

- `Detected` / `Unassigned` / `Placed` organization.
- Simple “what is placed vs not placed?” mental model.
- Strong linkage between source inventory and mapping progress.
- Fewer propagation surfaces, so renamed/recolored identities stay more legible.

#### What V2 contributes

- `Project` as the main container rather than a song shell.
- User-facing `Sound` language instead of a purely pitch-centric `Voice` framing.
- Stronger link between identity, timeline behavior, and workspace behavior.
- Naming flow during import.
- Clear evidence that the product wants project-wide sound awareness, not just local pad occupancy.

#### What is being decided

The canonical mapped identity model and the propagation guarantees attached to it.

#### Recommended framing for user decision

Do not answer this as “Do you prefer V1 voice organization or V2 sound organization?” Decide instead:

- what the mapped object is
- what metadata defines it
- how edits to that object propagate everywhere else

#### Specific points requiring user input

- Whether MVP may merge multiple source events or pitches into one canonical mapped sound identity, or whether each mapped sound remains one imported/authored pitch identity.
- Whether source pitch should remain defining identity or only provenance metadata.
- Whether assignment-state grouping remains the primary left-rail organization even if sound identity becomes broader than pitch.
- Which properties belong to the canonical sound identity in MVP: name, color, group, mute state, constraints, source provenance.
- Which surfaces must update immediately when that identity changes: grid, timeline, candidate compare, event analysis, saved outputs.

#### Suggested provisional direction

Use a user-facing `Sound` as the canonical mapped object, keep source pitch as provenance metadata rather than the only identity hook, retain V1-style assignment-state grouping, and require one propagation rule across grid, timeline, analysis, and compare surfaces.

### Open Question 3

#### Question

Which V2-style grid-linked analysis behaviors belong in the default V3 editor, which belong in explicit focus/compare modes, and which should wait until reliability is proven?

#### Why this is still open

The master draft correctly rejects the vague claim that V2 is “better at grid editing,” but the current materials still do not choose a default grid-feedback bundle or define the MVP boundary. The source docs show a real tradeoff: V1 is better at editing clarity and pose-centered authoring, while V2 is better at event-linked overlays and candidate compare support.

#### What V1 contributes

- Grid as a dedicated mapping tool.
- Explicit pose-centered editing workflow.
- Direct assignment, move, swap, unassign, and clear interactions.
- Finger badges, finger colors, finger-lock markers, layout mode chip.
- Tight linkage between source inventory and pad editing.

#### What V2 contributes

- Selected-event highlight on the grid.
- Onion-skin overlays in the main workspace.
- Shared-pad highlighting.
- Movement arcs.
- Impossible-move highlighting.
- Compare-grid mode.
- Event and transition detail panels tied to current selection.
- Honest stale-analysis signaling.

#### What is being decided

The default V3 grid-editor behavior and the MVP-vs-backlog split for advanced overlays.

#### Recommended framing for user decision

Do not answer this as “Which version’s grid do you prefer?” Decide instead:

- the minimal always-on editor cues
- the opt-in focus/compare overlays
- the behaviors that should wait until synchronization and propagation are trustworthy

#### Specific points requiring user input

- Which cues are always visible in the default editor: selected-event highlight, active pads, finger labels, finger locks, layout mode.
- Which cues are opt-in toggles: onion skin, movement arcs, shared-pad highlighting, compare grid.
- Whether compare-grid belongs in MVP or immediately after MVP.
- Whether impossible-move highlighting is trustworthy enough for MVP.
- Whether pose editing should remain an explicit dedicated mode/tab or become an inline editor state on the same grid.
- How much visual density is acceptable before the default grid stops feeling like a reliable manual authoring tool.

#### Suggested provisional direction

Use V1 editing clarity as the default editor baseline, keep selected-event highlight and active-pad/finger visibility always on, make onion skin and compare-grid opt-in focus tools, and defer impossible-move highlighting until reliability is proven.

## 4. Special section: Grid Editor decision breakdown

| Category | What V1 did | What V2 did | Resolved or still open | Exact user input needed |
|----------|-------------|-------------|-------------------------|-------------------------|
| Assignment interactions | Drag from library, move, swap, unassign back to staging, clear grid. | Drag from palette, move, swap, remove from pad. | Mostly resolved. V1 is the stronger baseline for core editing clarity. | None at the broad level; detailed preservation semantics belong to Open Question 1. |
| Source inventory linkage | `Detected` / `Unassigned` / `Placed` made assignment progress explicit. | Sound palette mixed assignment, constraints, counts, and timeline context. | Resolved direction: keep assignment-state clarity. | Whether V3 still shows these as separate buckets by default if canonical sound identity becomes broader than pitch. |
| Pose-centered editing | Explicit pose tab and pose ghost markers, with the grid acting as the pose editor. | Pose is largely buried in the live shell. | Direction resolved: V3 should keep explicit pose-aware editing. | Whether pose editing stays as a dedicated tab/mode or becomes an inline grid state. |
| Selected-event feedback | Mostly available through dedicated Event Analysis rather than inline grid editing. | Timeline/event selection updates the grid directly. | Resolved requirement: event selection must update the grid inline. | None on the requirement itself. |
| Onion-skin overlays | Rich dedicated onion-skin view in Event Analysis with vectors and transition framing. | Lightweight onion-skin toggle in the main workspace. | Still open. | Whether onion skin is default off, default on, or analysis/focus mode only in MVP. |
| Transition overlays | Transition metrics and movement cues lived mainly in Event Analysis. | Shared-pad highlight, movement arcs, impossible-move cues live on the main grid. | Still open. | Which of shared-pad highlight, arcs, and impossible-move cues are MVP, and which are opt-in toggles. |
| Compare modes | No strong inline compare-grid workflow. | Side-by-side compare-grid tied to candidate comparison. | Still open. | Whether compare-grid is MVP and whether it must support event-linked comparison or only static layout comparison at first. |
| Pad-state clarity | Finger badges, finger colors, finger-lock markers, layout mode chip. | Current assignment context plus event-linked highlighting. | Mostly resolved: V1 clarity should survive. | Whether any additional V2 contextual pad-state markers are needed in the default view. |
| Propagation/reliability | Fewer models, so edit propagation is simpler and generally easier to trust. | Richer coupling, but hidden synchronization makes trust weaker. | Resolved requirement: V3 must prefer reliability over density. | None on the principle; implementation detail comes later. |
| Synchronization with analysis/timeline | Cross-route linkage exists, but selection is less immediate. | Timeline event selection acts as a coordination spine for grid and detail panels. | Resolved requirement: editing, timeline, and event analysis must remain synchronized. | None on the requirement itself. |
| Visual clarity / density / clutter | Clearer default editing surface, but weaker inline analysis. | Denser default surface with more local cues, but higher clutter risk. | Still open. | How dense the default grid may be before it stops feeling like a manual editor first. |

The important takeaway is that the grid-editor decision is not “pick V1” or “pick V2.” The resolved baseline is:

- V1 for direct editing clarity, pose-centered authoring, and assignment-state legibility.
- V2 for event-linked feedback, compare-grid support, and stale-analysis honesty.

The still-open part is the default overlay bundle and MVP boundary.

## 5. Special section: Workflow / mission clarity

| Area | Current clarity after this pass | Remaining vagueness to call out |
|------|--------------------------------|---------------------------------|
| V3 product mission | Clear enough to proceed. V3 is a playability/layout convergence product. | Earlier imported-MIDI-only wording in `V3_PRODUCT_DECISIONS.md` is now too narrow and should not be treated as canon. |
| Imported vs manual entry paths | Clear at the product level. Both are first-class inputs. | The remaining question is not whether manual entry exists, but which exact manual-entry surface becomes the canonical authoring path. Current evidence points to timeline authoring, not the V2 composer. |
| Manual mapping as a primary feature | Clear. Manual mapping is core, and optimization must start from partially manual state. | The unresolved piece is the preservation contract for manual edits during optimization. |
| Single-event difficulty evaluation as a core function | Clear and non-negotiable. It must be available inline and in a dedicated analysis flow. | Several earlier outputs still under-weighted this by treating analysis mostly as summary/candidate comparison. That language should be considered outdated. |
| Analyze vs mutate/generate distinction | Clear. This must remain explicit in V3. | Earlier V2-facing wording around `Generate` still risks collapsing analyze, seed, and mutate into one mental model. |
| Candidate comparison workflow | Clear enough directionally: keep it, but subordinate it to a clear analysis hierarchy. | The remaining open detail is how deep comparison must go in MVP: static layout compare only, or event-linked explanation as well. |
| MVP vs backlog boundary | Not yet clear enough in the prior docs. | The prior materials discuss scope qualitatively, but they do not define a decision-ready MVP/backlog split. This should be written explicitly after the remaining open questions are answered. |

The prior materials were especially too vague in four places:

- They sometimes framed V3 as primarily imported-MIDI optimization, which is no longer faithful to the user’s clarified mission.
- They often treated manual authoring and manual mapping as secondary when they are actually central.
- They talked about “analysis” as though summary metrics and candidate switching were enough, which underplays event-level difficulty evaluation.
- They still do not define an explicit MVP/backlog boundary, even though the user asked for one.

## 6. Special section: Comprehensiveness and correctness audit

| Area | Reconciliation coverage quality | Accuracy vs source docs | Notes |
|------|--------------------------------|--------------------------|-------|
| Product mission by version | High | Medium | The comparison doc correctly distinguishes V1’s focused performer tool from V2’s broader workspace, but `V3_PRODUCT_DECISIONS.md` narrows V3 too far toward imported MIDI and understates manual authoring. |
| Workflow spine | High | High | V1’s clearer dashboard -> workbench -> event-analysis flow and V2’s unified workspace flow are both represented faithfully. |
| Manual mapping / manual authoring | Medium | Medium | Prior outputs captured manual mapping, but often demoted manual authoring and manual sequencing too aggressively. Later clarifications correct that. |
| Single-event difficulty evaluation | Medium | Medium-low | The master draft elevates it correctly, but several earlier outputs treated analysis too much as summary metrics or candidate switching. |
| Grid editor comparison | Medium | Medium-low | Earlier salvage docs overstated V2 with vague phrases like “better local editing.” The source docs support a split verdict: V1 editing clarity, V2 inline feedback. |
| Voice / sound organization | Medium | Medium | Reconciliation docs correctly note V1 assignment-state clarity and V2 conceptual ambition, but earlier versions under-emphasized V2 propagation failures and the need for a rewrite. |
| Optimization workflow | High | High after the master draft | Earlier wording flattened V1 into “Auto-Arrange.” The master draft correctly restores the analyze vs mutate/generate distinction and preserves V2 candidate comparison. |
| State / source-of-truth | High | High | The prior materials faithfully represent V1 as simpler and V2 as explicitly but problematically multi-truth. |
| Timeline / composer scope | High | High | The source docs strongly support the claim that V2’s timeline and composer create source-of-truth ambiguity. The remaining correction is product framing, not factual accuracy. |
| Analysis / feedback hierarchy | High | High | V1’s dedicated Event Analysis strength and V2’s event-linked local panels are represented accurately. The remaining work is hierarchy, not discovery. |
| MVP vs prioritized backlog | Low | Not applicable | The reconciliation materials do not yet produce the clear MVP/backlog boundary the user asked for. |
| Domain model caution | Medium | Medium | The outputs correctly identify domain pressure points, but some recommendations still read too close to canon before the canonical identity model is actually decided. |

## 7. Missing details the user explicitly asked for

- Product missions by version: earlier materials improved this, but V3 was still sometimes framed too narrowly around imported MIDI instead of imported plus manual performance creation.
- Workflow clarity: earlier docs said V1 had a better “workflow spine,” but often did not translate that into a precise V3 step sequence.
- Exact meaning of alleged V2 UX improvements: several outputs used vague phrases such as “better local editing,” “linked inline feedback,” or “better visualization” without feature-level breakdown.
- MVP vs prioritized backlog: this remains missing as a decision-ready artifact, even though the user explicitly asked for it.
- Domain model caution / verification need: the outputs correctly warned about ambiguity, but some recommendations still drifted toward prematurely canonizing the V3 model from summaries.
- Visualization claims needing proof: claims about V2 advantages were too often stated without saying whether they meant selected-event highlighting, onion skin, compare-grid, transition arcs, stale-analysis signaling, or something else.
- Manual mapping and manual sequencing treatment: prior docs too often treated composition/manual authoring as secondary or adjunct, which is not faithful to the clarified mission.
- Single-event difficulty analysis as a must-work feature: this was under-emphasized in the earlier reconciliation outputs and needs to remain explicit in future artifacts.
- Voice / sound organization implications: earlier docs did not fully spell out the tradeoff between V1 assignment-state clarity, V2 project-wide sound identity ambition, and V2 propagation failures.

## 8. Final recommendation

We are not ready to proceed directly to merge/design artifacts yet.

The remaining work is now narrow. One final decision pass is still needed first, and it should answer only the three open questions above:

1. the manual-edit preservation and constraint-precedence matrix
2. the canonical sound identity and propagation model
3. the default grid-overlay bundle and MVP boundary

The smallest possible next artifact is not another broad reconciliation summary. It is a short approval matrix that records the user’s answers to those three decisions. Once that matrix exists, the reconciliation is decision-ready enough to proceed to the domain/workflow/design artifacts without another ambiguity-clearing pass.
