# Terminology

Use these terms consistently in code comments, specs, plans, and user-facing recommendations.

## Core Rules

- Prefer precise domain language over overloaded generic terms
- Do not use multiple terms interchangeably unless the distinction truly does not matter
- In user-facing product language, prefer **grid editor** over **Workbench**
- Keep physical concepts separate from MIDI concepts

---

## Canonical Terms

| Term | Definition | Avoid / Deprecated |
|---|---|---|
| Layout | Full static assignment of musical identities to Push pads | Using “mapping” ambiguously for everything |
| Mapping | The assignment relationship or data structure connecting identities to pads | Using as synonym for full recommended artifact |
| Pad | Physical Push button on the 8×8 surface | “Cell” when referring to physical location |
| Grid Position | Physical coordinate `(row, col)` of a pad | x/y without explicit convention |
| Cell | Optional abstract slot/index concept if needed | Using to mean physical pad |
| Performance Event | Time-based trigger in the sequence | Calling every timeline concept a “note” |
| Note | MIDI pitch or event identity | Using as synonym for sound, role, or action |
| Sound | Timbral identity such as kick, snare, stab | Using “note” when timbre is intended |
| Voice | Distinct mapped entity / stream tracked through the sequence | “Track” when ambiguous |
| Musical Role | Functional role such as pulse, accent, fill, lead | Treating all events as equal |
| Finger Assignment | Per-event hand/finger decision | Calling this the full performance artifact |
| Execution Plan | Full timeline of hand/finger assignments | Using “fingering” ambiguously for both local and global artifact |
| Feasibility | Whether something can physically happen | Interchanging with ergonomics or difficulty |
| Ergonomics | Comfort / strain tendency | Interchanging with feasibility |
| Performance Difficulty | Composite burden over time | Treating a single scalar as complete truth |
| Natural Hand Pose | Canonical comfortable hand/finger geometry prior | Treating as optional preference |
| Home Pose | Current neutral reference pose in context | Assuming always identical to natural pose |
| Hand Zone | Preferred left/right region on the grid | Hard partition assumptions without context |
| Candidate Solution | A complete option: layout + execution + analysis | “Best solution” as universal singular truth |
| Robustness | Stability across sections and conditions | Mistaking local ease for global quality |
| Learnability | Memorability and coherence burden | Ignoring cognitive load entirely |
| Expressiveness | Ability to preserve accents, dynamics, and musical intent | Treating all pads as expressively equivalent |

---

## Distinctions That Matter

### Layout vs Mapping
Use **layout** when referring to the full user-facing artifact.  
Use **mapping** when referring to the assignment relation or stored structure.

### Pad vs Grid Position
A **pad** is the physical button.  
A **grid position** is the coordinate `(row, col)`.

### Note vs Sound vs Voice vs Role
- **Note** = MIDI identity
- **Sound** = timbral identity
- **Voice** = tracked mapped entity
- **Role** = musical function

Do not collapse these into one concept unless the simplification is intentional and harmless.

### Finger Assignment vs Execution Plan
A **finger assignment** is one decision for one event.  
An **execution plan** is the full timeline artifact.

### Feasibility vs Ergonomics vs Performance Difficulty
- **Feasibility** asks: can it happen at all?
- **Ergonomics** asks: how natural or strained is it?
- **Performance Difficulty** asks: what is the composite burden over time?

### Natural Hand Pose vs Home Pose
**Natural hand pose** is the canonical prior.  
**Home pose** is the current local neutral reference state.  
They are related but not always identical.

### Candidate Solution vs Best Solution
Prefer **candidate solution** unless the objective weights are explicitly specified.  
Avoid implying a universal optimum.

---

## Naming Guidance for Plans and Specs

Preferred section names:
- Layout
- Execution Plan
- Candidate Solutions
- Performance Difficulty
- Feasibility Constraints
- Ergonomic Factors
- Grid Position
- Hand Zones
- Natural Hand Pose

Avoid:
- Workbench layout logic
- cell map for physical pads
- notes everywhere
- best layout without qualification
- fingering when you really mean full execution plan

---

## User-Facing Language

Use:
- grid editor
- layout candidate
- performance plan
- difficult passage
- hand assignment
- finger assignment
- playability
- physical feasibility
- ergonomic burden

Avoid:
- solver artifact
- state hydration issue
- mapping relation object
- workbench semantics
- cell occupancy model

Translate implementation terms into performer-friendly language whenever possible.

---

## Coordinate Convention

Unless explicitly stated otherwise:

- row increases **bottom → top**
- column increases **left → right**
- grid position is written as `(row, col)`

Do not introduce alternate coordinate systems without clearly documenting them.

---

## Terminology Discipline Rule

If a design discussion becomes confusing because terms are being used loosely:

1. restate the canonical term
2. define it explicitly
3. continue using that term consistently

Precision in naming is part of correctness for this project.