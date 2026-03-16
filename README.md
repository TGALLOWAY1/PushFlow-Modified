# PushFlow V3

**Performance Ergonomics Optimizer for Ableton Push 3**

PushFlow analyzes MIDI performances and optimizes pad layouts on the Ableton Push 3's 8x8 grid for playability, ergonomics, and musical coherence. It models real-world biomechanical constraints — finger spans, hand speed, fatigue accumulation — to produce layouts that are physically comfortable and performable.

The product promise is not "generate a layout." The product promise is: **converge on a Layout plus Execution Plan that is playable, understandable, and worth keeping.**

![Project Library](docs/screenshots/01-project-library.png)

---

## Features

### MIDI Import & Sound Identity
- Import `.mid` files — each unique MIDI pitch becomes a **Voice** (Sound) with stable identity
- Voices persist across all layout operations: cloning, promotion, variant saving, and discard
- Color-coded voice palette with hit count, grid position, hand/finger preference controls

### Interactive 8x8 Push Grid
- Drag-and-drop sound assignment to the 64-pad grid
- Left Hand (columns 0-3) / Right Hand (columns 4-7) zone visualization
- Timeline-linked mode: grid highlights active pads during playback
- Onion skin overlay for comparing layouts visually

![Editor Workspace](docs/screenshots/02-editor-workspace.png)

### Layout Workflow (V3 State Model)
PushFlow uses a three-tier layout lifecycle:

| State | Purpose | Persistence |
|-------|---------|-------------|
| **Active Layout** | Committed baseline — the "real" layout | Durable (saved to project) |
| **Working/Test Layout** | Session-scoped draft for exploration | Ephemeral (discarded on close) |
| **Saved Layout Variant** | Named alternative preserved for later | Durable (named, timestamped) |

**Workflow actions:**
- **Promote** — Working layout becomes the new Active Layout; old Active auto-saved as a variant
- **Save Variant** — Preserve the current working state as a named variant without changing Active
- **Discard** — Abandon Working layout and revert to Active
- **Undo/Redo** — Full operation history within the working session

### Candidate Generation & Optimization
- **Generate** produces multiple alternative layouts (default: 3 candidates)
- Three generation strategies: baseline-aware, compact-right, compact-left
- Each candidate is independently scored and profiled
- Candidate switcher lets you preview each alternative on the grid instantly
- **Promote Candidate** to make a candidate the new Active Layout

![Generated Layout](docs/screenshots/03-generated-layout.png)

### Analysis & Diagnostics
- **Difficulty Heatmap** — per-event difficulty classification (Easy / Moderate / Hard / Extreme)
- **Score summary** — total execution cost, average drift, hard event count, unplayable count
- **Hand balance** — left/right distribution with visual bar
- **Cost breakdown** — per-factor average metrics (movement, stretch, drift, bounce, fatigue, crossover)
- **Finger fatigue** — accumulated workload per finger with overwork warnings
- **Actionable suggestions** — context-aware recommendations (e.g. "High movement cost — group frequently alternating sounds on adjacent pads")
- **Staleness indicator** — warns when analysis is outdated relative to current layout

### Candidate Comparison
- Side-by-side tradeoff profile comparison across 6 dimensions
- Layout diff highlighting: which pads changed between candidates
- Metric-by-metric breakdown showing which candidate wins each factor

### Performance Timeline
- Horizontal event timeline showing all MIDI events per voice
- Finger assignment annotations per event (L1-L5, R1-R5)
- Playback with real-time cursor and pad highlighting
- Zoom and voice filtering controls

### Pattern Composer
- Generative pattern pipeline: motif sampling, phrase building, two-hand coordination
- Rudiment library with standard drumming patterns
- Pattern-based event generation for testing layouts against musical material

---

## Cost Model & Scoring

PushFlow's engine uses a physics-informed cost model to evaluate how difficult a layout is to perform.

### PerformabilityObjective (3-Component)

The core objective function scores each event assignment:

**1. Pose Naturalness** — How comfortable is the current hand position?
- **Attractor cost (40%)** — Distance from hand center to an ideal resting position
- **Per-finger home cost (40%)** — How far each finger is from its natural home position
- **Finger dominance cost (20%)** — Penalty for assigning critical events to weak fingers

**2. Transition Difficulty** — How hard is it to move between consecutive events?
- Based on **Fitts's Law**: `cost = (distance^2 / MAX_HAND_SPEED^2) * SPEED_COST_WEIGHT`
- Accounts for actual timing between events (faster transitions are harder)
- Alternation penalty when the same finger must repeat within 250ms

**3. Constraint Penalty** — Does the assignment violate physical limits?
- Strict grip: 0 penalty (within normal reach)
- Relaxed grip: 200 penalty (1.5x normal limits — achievable but strained)
- Fallback grip: 1000 penalty (beyond comfortable reach — likely unplayable)

### Diagnostic Factors (5-Component Canonical)

Every execution plan produces factorized diagnostics:

| Factor | What It Measures |
|--------|------------------|
| `transition` | Movement cost between consecutive events |
| `gripNaturalness` | How natural the hand shape is for each event |
| `alternation` | Same-finger rapid reuse penalty |
| `handBalance` | Distribution of workload between hands |
| `constraintPenalty` | Physical constraint violations |

### Difficulty Breakdown (6-Dimension UI Display)

The UI shows a more granular breakdown for user interpretation:

| Metric | Description | Good | Moderate | Bad |
|--------|-------------|------|----------|-----|
| **Movement** | Distance fingers travel between events | <0.4 | 0.4-1.0 | >1.0 |
| **Stretch** | How far fingers spread within a single grip | <0.4 | 0.4-0.8 | >0.8 |
| **Drift** | Hand center displacement from resting position | <0.4 | 0.4-0.8 | >0.8 |
| **Bounce** | Same-finger repeated use without alternation | <0.4 | 0.4-0.6 | >0.6 |
| **Fatigue** | Accumulated finger workload over time | <0.5 | 0.5-1.0 | >1.0 |
| **Crossover** | Hands crossing over each other's zone | <0.4 | 0.4-0.5 | >0.5 |

### Tradeoff Profile (6-Dimension Candidate Scoring)

Each candidate solution is profiled across 6 dimensions (0-1 scale, higher = better):

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Playability** | 0.30 | Overall physical feasibility and comfort |
| **Transition Efficiency** | 0.20 | Low movement cost between sequential events |
| **Compactness** | 0.15 | Sounds clustered tightly for minimal hand travel |
| **Learnability** | 0.15 | Intuitive layout (pitched ordering, spatial logic) |
| **Hand Balance** | 0.10 | Even workload distribution between hands |
| **Robustness** | 0.10 | Tolerance to small timing/position variations |

### Difficulty Classification Thresholds

Events and overall layouts are classified into tiers:

| Classification | Score Range | Meaning |
|----------------|-------------|---------|
| Easy | 0 - 0.2 | Comfortable, no strain |
| Moderate | 0.2 - 0.45 | Requires attention but playable |
| Hard | 0.45 - 0.7 | Challenging, may need practice |
| Extreme | > 0.7 | Very difficult, consider layout changes |

---

## Optimization Engine

### Beam Solver (Finger Assignment)

The beam solver assigns fingers to performance events using **beam search**:

- Explores multiple assignment paths simultaneously (configurable beam width, default 5)
- At each event, generates candidate next-states by trying all valid finger assignments
- Prunes to top-K states by cumulative cost at each step
- Produces the globally best finger assignment sequence

**3-Tier Grip Feasibility:**
Each event is tested against progressively relaxed physical constraints:
1. **Strict** — Within normal finger span limits (0 penalty)
2. **Relaxed** — Up to 1.5x strict limits (200 penalty) — achievable but uncomfortable
3. **Fallback** — Beyond comfortable reach (1000 penalty) — flagged as problematic

### Annealing Solver (Layout Optimization)

The annealing solver optimizes pad placement using **simulated annealing**:

- **Mutation operators** (weighted random selection):
  - Swap two pads (35%) — exchange positions of two assigned sounds
  - Move to empty pad (35%) — relocate a sound to an unoccupied position
  - Cluster swap (15%) — swap sounds within a local neighborhood
  - Row/column shift (15%) — slide an entire row or column

- **Acceptance criterion:** Metropolis — always accept improvements, probabilistically accept worse solutions based on temperature

- **Presets:**

| Preset | Iterations | Restarts | Beam Width | Cooling Rate |
|--------|------------|----------|------------|--------------|
| Quick | 3,000 | 0 | 12-50 | 0.997 |
| Deep | 8,000 | 3 | 16-50 | 0.9985 |

### Multi-Candidate Generation

The generator produces diverse candidates by:
1. Running the annealing solver with different initialization strategies
2. Ensuring candidates differ meaningfully from the Active Layout baseline
3. Computing independent tradeoff profiles for each candidate
4. A real candidate must show at least one unlocked placement change or a materially different tradeoff profile

---

## Biomechanical Model

PushFlow models human hand biomechanics with calibrated constants:

### Physical Limits
| Parameter | Value | Description |
|-----------|-------|-------------|
| `MAX_HAND_SPAN` | 5.5 units | Maximum comfortable hand spread |
| `MAX_REACH` | 5.0 units | Maximum single-finger reach from wrist |
| `MAX_SPEED` | 12.0 units/sec | Maximum hand movement speed |

### Finger Dominance Cost
| Finger | Cost | Rationale |
|--------|------|-----------|
| Index | 0 | Strongest, most dexterous |
| Middle | 0 | Strong, good reach |
| Ring | 1 | Reduced independence |
| Pinky | 3 | Weakest, limited reach |
| Thumb | 5 | Limited lateral movement on pads |

### Inter-Finger Span Limits (Strict)
| Finger Pair | Max Span |
|-------------|----------|
| Index-Middle | 2.0 units |
| Middle-Ring | 2.0 units |
| Ring-Pinky | 1.5 units |
| Index-Ring | 3.5 units |
| Index-Pinky | 4.5 units |
| Middle-Pinky | 3.0 units |

The relaxed tier multiplies these by **1.15x** for achievable-but-strained grips.

### Timing Constants
| Parameter | Value | Description |
|-----------|-------|-------------|
| `ALTERNATION_DT_THRESHOLD` | 0.25 sec | Same-finger reuse within this window gets penalized |
| `ALTERNATION_PENALTY` | 1.5 | Multiplier for rapid same-finger alternation |
| `HAND_BALANCE_TARGET_LEFT` | 0.45 | Optimal left-hand share (slight right-hand bias) |

### Voice Role Multipliers
When computing role-weighted difficulty, backbone sounds matter more than fills:

| Role | Multiplier | Rationale |
|------|-----------|-----------|
| Backbone | 1.5x | Must be easy — forms the rhythmic foundation |
| Lead | 1.3x | Prominent, needs reliable execution |
| Fill | 0.8x | Occasional, can tolerate more difficulty |
| Texture | 0.7x | Background element, lower priority |
| Accent | 0.6x | Sparse, least critical |

---

## Constraint System

### Placement Locks
Users can **lock** a voice to a specific pad position. Locked placements are preserved across:
- Layout cloning
- Candidate generation (optimizer respects locks)
- Promotion (locks carry forward to the new Active Layout)

### Finger Constraints
Users can assign preferred hand/finger combinations per pad:
- Hand preference: Left / Right / Any
- Finger preference: specific finger or Any
- Soft constraints by default (optimizer considers but may override)

### Grip Feasibility
Every finger assignment is validated against the biomechanical model:
- All fingers must be within their pairwise span limits
- Hand position must be reachable given the previous position and available time
- Three tiers of feasibility with escalating penalties

---

## Architecture

```
src/
  engine/
    solvers/           # Beam solver (finger assignment)
    optimization/      # Annealing solver, multi-candidate generator
    evaluation/        # PerformabilityObjective, scoring
    analysis/          # Difficulty analysis, constraint explanation
    prior/             # Biomechanical model, feasibility checking
    mapping/           # Pad-to-finger resolution
    structure/         # Performance structure analysis
    rudiment/          # Drumming rudiment library
    pattern/           # Pattern generation pipeline
  types/
    layout.ts          # Layout, LayoutRole, cloneLayout, hashLayout
    voice.ts           # Voice (Sound identity)
    executionPlan.ts   # ExecutionPlan, FingerAssignment, DiagnosticFactors
    candidateSolution.ts  # CandidateSolution, TradeoffProfile
    diagnostics.ts     # DifficultyBreakdown, DifficultyAnalysis
    engineConfig.ts    # EngineConfiguration, AnnealingPreset
    performanceStructure.ts  # Performance, PerformanceEvent
  ui/
    components/        # React components (Grid, Palette, Toolbar, Panels)
    state/             # ProjectContext, reducer, actions
    hooks/             # Custom React hooks
    persistence/       # localStorage with migration support
  test/
    types/             # Type contract tests (voice identity, layout invariants)
    engine/            # Solver and optimization tests
    integration/       # End-to-end workflow tests
```

---

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
cd product-reconciliation/v2/v2\ repo
npm install
```

### Run Dev Server
```bash
npm run dev
# Opens at http://localhost:5173
```

### Run Tests
```bash
npm test
# 437 tests across type contracts, engine, and integration suites
```

### Build
```bash
npm run build
```

---

## Test Suite

The test suite validates critical invariants:

- **Voice Identity Round-Trip** — Voice IDs survive clone, promote, variant save, and discard
- **Layout State Transitions** — Active/Working/Variant lifecycle correctness
- **Execution Plan Validation** — Plans are layout-bound, staleness detection works
- **Baseline Compare** — Candidate comparison produces correct diffs
- **Event Explainer** — Per-event difficulty explanations are accurate
- **Constraint Explanation** — Constraint violations produce meaningful diagnostics
- **Solver Determinism** — Same input produces consistent output
- **Feasibility Tiers** — Strict/Relaxed/Fallback boundaries are correct
- **Candidate Diversity** — Generated candidates differ meaningfully from baseline

---

## Project Status

PushFlow V3 is under active development. The canonical workflow contract and implementation sequence are defined in:

- `product-reconciliation/output/PUSHFLOW_WORKFLOW_AND_PRODUCT_CONTRACT.md`
- `product-reconciliation/output/PUSHFLOW_DECISIONS_AND_OPEN_QUESTIONS.md`
- `product-reconciliation/output/PUSHFLOW_ENGINE_TOUCHPOINTS_AND_IMPLEMENTATION_SEQUENCE.md`

### Completed Phases
1. V3 Workflow State Model (Layout lifecycle, role transitions)
2. Execution Plan Layout Binding (Plans track which layout they belong to)
3. Staleness Detection (Analysis invalidation on layout changes)
4. Candidate Diversity Enforcement (Meaningful differences from baseline)
5. Constraint Explainer (Human-readable constraint violation explanations)
6. Event-Level Analysis (Per-event difficulty breakdown)
7. Baseline Compare Improvements (Tradeoff profile diffing)

---

## License

Private — All rights reserved.
