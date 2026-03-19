# CLAUDE.md

## Project

**Performance Ergonomics Optimization Engine for Ableton Push 3**

This project converts MIDI-derived musical material into physically playable Ableton Push 3 performances by jointly optimizing:

1. **Layout** — static assignment of musical identities to Push pads
2. **Execution plan** — time-based hand/finger assignments over the event sequence

The goal is not just musical correctness. The goal is **human playability on Push 3**.

---

## Core Objective

Optimize for song-level performance feasibility and ergonomics.

A strong solution should improve:
- playability
- biomechanical realism
- motion efficiency
- learnability
- robustness across sections
- expressive usefulness

Do **not** reduce the product to static layout generation only.

---

## Non-Negotiable Truths

- Layout and execution are a **coupled problem**
- A layout is only good relative to the sequence it must support
- Evaluation must be **temporal**, not only spatial
- Push pad position materially affects playability
- Natural hand pose and hand-zone priors are core constraints
- Dense and difficult passages must meaningfully affect scoring
- Multiple plausible candidate solutions are valid
- Outputs must be explainable to users

---

## Product Priorities

When making tradeoffs, prioritize in this order:

1. Performability correctness
2. Biomechanical plausibility
3. Explainability
4. Learnability and robustness
5. User control and editability
6. UI clarity
7. Implementation simplicity
8. Legacy behavior compatibility

Do not preserve existing behavior just because it already exists.

---

## Canonical Vocabulary

Use these terms precisely:

- **Layout** = full static pad-assignment artifact
- **Mapping** = assignment relationship / data structure
- **Pad** = physical Push button
- **Grid Position** = `(row, col)`
- **Performance Event** = time-based trigger in the sequence
- **Execution Plan** = full timeline of hand/finger assignments
- **Finger Assignment** = per-event decision
- **Feasibility** = whether something can physically happen
- **Ergonomics** = comfort / strain tendency
- **Performance Difficulty** = composite burden over time
- **Natural Hand Pose** = canonical biomechanical prior
- **Home Pose** = current neutral reference state
- **Candidate Solution** = layout + execution + analysis

In user-facing docs, prefer **grid editor** over **Workbench** unless referring to a legacy code artifact.

---

## Push Surface Model

Preserve these physical conventions:

- Push surface is **8×8**
- Rows increase **bottom → top**
- Columns increase **left → right**
- Every pad has stable identity `(row, col)`
- Pad identity is physical and must not be conflated with MIDI note number
- Left/right hand zones should be modeled explicitly
- Cross-hand use may be valid, but should be intentional
- Thumbs generally sit lower than fingers in natural pad interaction
- Impossible reaches or simultaneity must be rejected or heavily penalized

---

## How to Work on This Project

### 1) Audit first
Before changing code:
- inspect the relevant files
- trace runtime data flow
- identify source of truth
- identify invariants
- separate intentional behavior from accidental behavior

Do not jump straight into coding.

### 2) State findings clearly
When analyzing an issue, provide:
- current behavior
- desired behavior
- root cause
- decisions / invariants
- recommended plan
- risks / regressions

### 3) Make surgical changes
- prefer small, explicit, high-leverage changes
- avoid parallel logic paths
- avoid duplicate state transformations
- avoid silent fallback behavior for invalid core state

### 4) Validate
Validate changes with:
- deterministic canonical tests
- simple synthetic MIDI cases
- edge cases
- persistence / hydration checks where relevant
- UI interaction checks where relevant

---

## Coding Rules

- Do not create competing sources of truth
- Do not patch UI symptoms if the data model is wrong
- Do not mask solver issues visually
- Do not add heuristic complexity before validating the pipeline
- If changing core contracts, explain affected files and migration implications
- Prefer explicit invariants over magical recovery
- Preserve or improve debuggability and explainability

---

## Optimization Rules

Good solutions usually show:
- sensible left/right hand distribution
- compact clusters
- low unnecessary crossover
- low repeated abuse of one finger
- predictable movement patterns
- natural hand-zone bias
- phrase-level coherence, not greedy local behavior only

Treat these as likely failure signals:
- one hand doing nearly everything without musical reason
- one finger playing many pads when alternation is available
- random-looking placements
- layouts that ignore natural hand pose
- unstable results on trivial equivalent cases

If the system fails simple cases, do not trust it on real songs.

---

## UX Rules

The UI should help the user understand:
- what exists
- where it is placed
- when it occurs
- which hand/finger is expected
- why something is difficult
- what can be changed

Avoid:
- clutter
- overlapping controls
- dialogs going off-screen
- disappearing controls after navigation
- UI that exposes implementation complexity instead of product intent

Every panel should justify its existence.

---

## Tech / Repo Guidance

Use the current repository as implementation evidence, not product truth.

Do not treat these as canonical:
- current solver choice
- current file structure
- current state management approach
- current UI decomposition

Preserve intent even if the implementation changes.

---

## Required Deliverable Shapes

### For audits
1. Executive summary
2. What is working
3. What is broken
4. What is partial / redundant
5. Highest-leverage fixes
6. Suggested implementation order

### For implementation plans
1. Objective
2. Current behavior
3. Desired behavior
4. Root cause
5. Decisions / invariants
6. File-by-file changes
7. Validation plan
8. Risks / follow-ups

### For optimization work
1. Objective formulation
2. Constraints / factor families
3. Failure modes
4. Canonical tests
5. Validation strategy

---

## External References

Read these before making major changes:

- `docs/canonical_product_spec.md`
- `docs/terminology.md`
- `docs/canonical_test_suite.md`
- `docs/repo_map.md`

If there is conflict between implementation and canonical intent, prefer canonical intent and call out the mismatch explicitly.


## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.