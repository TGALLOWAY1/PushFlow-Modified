# Optimization Debugging Tools

Comprehensive framework for inspecting, validating, and diagnosing optimization decisions in PushFlow.

## Architecture

```
src/engine/debug/
├── types.ts                 # Core data structures
├── evaluationRecorder.ts    # Part 1: Extracts per-event evaluation records
├── candidateReport.ts       # Part 2: Generates candidate solution reports
├── irrationalDetector.ts    # Part 3: Detects irrational finger assignments
├── constraintValidator.ts   # Part 4: Validates constraint compliance
├── visualizationData.ts     # Part 5: Produces visualization datasets
├── sanityChecks.ts          # Part 8: Automatic sanity assertions
└── index.ts                 # Barrel exports

src/ui/pages/
└── OptimizerDebugPage.tsx   # Part 6: Debug dashboard at /optimizer-debug

test/optimizer/
└── syntheticStressTests.test.ts  # Part 7: Synthetic stress tests
```

## Data Structures

### OptimizationEvaluationRecord

Captured for every event in the execution plan:

```typescript
{
  eventIndex: number;
  timestamp: number;
  pad: [row, col];
  hand: 'left' | 'right' | 'Unplayable';
  finger: FingerType | null;
  previousPad: [row, col] | null;
  previousFinger: FingerType | null;
  noteNumber: number;
  difficulty: DifficultyLevel;
  costs: {
    travel: number;            // Fitts's Law movement
    transitionSpeed: number;   // Speed component
    pose: number;              // Pose naturalness
    zoneViolation: number;     // Zone boundary penalty
    fingerPenalty: number;     // Finger dominance cost
    repetitionPenalty: number; // Same-finger rapid repeat
    collisionPenalty: number;  // Simultaneous finger collision
    feasibilityPenalty: number; // Fallback/relaxed grip
  };
  totalCost: number;
  timeDelta: number;
  movementDistance: number;
}
```

### CandidateReport

Full diagnostic summary of a candidate solution:

- **layoutSummary**: Pad → voice name mapping
- **fingerUsage**: Per-hand and combined finger percentages
- **handUsage**: Left/right/unplayable percentages
- **costTotals**: Aggregated cost by component
- **costAverages**: Per-event average costs
- **constraintViolations**: All detected violations
- **evaluationRecords**: Complete event timeline

### ConstraintViolation

```typescript
{
  eventIndex: number;
  constraintName: 'impossible_reach' | 'simultaneous_collision' |
                  'tempo_infeasible' | 'zone_violation' |
                  'speed_exceeded';
  explanation: string;
  actual: number;
  limit: number;
  type: 'hard' | 'soft';
}
```

### IrrationalAssignment

```typescript
{
  eventIndex: number;
  assignedFinger: FingerType;
  betterAlternatives: FingerType[];
  ruleName: 'pinky_misuse' | 'thumb_abuse' |
            'same_finger_streak' | 'cross_hand_unnecessary';
  explanation: string;
  severity: 'suspicious' | 'likely_irrational' | 'definitely_irrational';
  assignedCost: number;
}
```

## Instrumentation Design

The debugging framework is **non-invasive** — it reads the existing `ExecutionPlanResult` output and reconstructs cost breakdowns using the same functions the beam solver uses:

1. `extractEvaluationRecords(result)` — reads `FingerAssignment[]` and enriches each event with zone violations and finger dominance costs from the biomechanical model
2. No modifications to `beamSolver.ts` or `annealingSolver.ts` are required
3. All debug data is computed on-demand, not during optimization

## UI Dashboard Design

Route: `/optimizer-debug`

### Data Source

Optimization results are exposed via `window.__PUSHFLOW_DEBUG__`:

```typescript
window.__PUSHFLOW_DEBUG__ = {
  candidates: CandidateSolution[],
  latestResult: ExecutionPlanResult,
};
```

### Tabs

1. **Event Timeline** — Sortable table of all events with pad, hand, finger, cost breakdown, difficulty. Sort by highest cost to find problem events.

2. **Finger Usage** — Bar charts showing per-finger usage percentages. Red highlight when pinky > 20%. Per-hand breakdown and combined view. Hand balance bar.

3. **Cost Breakdown** — Stacked horizontal bars for each cost component (travel, pose, finger penalty, zone, repetition, feasibility). Top 10 most expensive events table.

4. **Violations** — Table of all constraint violations with event index, constraint name, type (hard/soft), actual vs. limit values, and explanations.

5. **Movement** — Statistics (avg distance, max distance, long jump count). Table of long jumps (>3 grid units). 8×8 pad activity heatmap.

6. **Irrational** — Table of flagged irrational assignments with severity badges, rule names, explanations, and suggested better alternatives.

7. **Sanity** — Pass/fail dashboard for all automatic checks. Green/red indicators. Actual values vs. thresholds.

### Sanity Check Banner

A red banner appears at the top when any sanity check fails, showing error/warning counts and messages.

## Verification Tests

Located in `test/optimizer/syntheticStressTests.test.ts`:

| Pattern | Expected Behavior |
|---------|-------------------|
| Fast alternation (kick/snare, 125ms) | Hand alternation, low same-finger repetition |
| Rapid repetition (same note, 100ms) | Finger alternation, all playable |
| Wide leap (col 0 → col 7) | High motion cost, potential long jump flags |
| Dense chord sequence (3 simultaneous) | No finger collisions |
| Cross-zone pattern | Zone violations detected |
| Simple well-behaved pattern | All sanity checks pass |
| Extreme fast pattern (20ms) | Sanity system runs end-to-end |

### Running Tests

```bash
npx vitest run test/optimizer/syntheticStressTests.test.ts
```

## Irrational Assignment Rules

| Rule | Trigger | Severity |
|------|---------|----------|
| Pinky Misuse | Pinky at central pad (cols 2-5) when not at hand edge | likely_irrational |
| Thumb Abuse | Thumb on upper rows (5-7) | likely_irrational |
| Same-Finger Streak | 3+ consecutive events on same hand+finger, especially at fast tempo | definitely_irrational (fast) |
| Cross-Hand Unnecessary | Hand used 2+ columns outside preferred zone | likely_irrational |

## Sanity Check Thresholds (Defaults)

| Check | Threshold | Severity |
|-------|-----------|----------|
| Pinky usage | < 20% | warning (error if > 30%) |
| Thumb usage | < 15% | warning (error if > 22.5%) |
| Zone violations | < 10% | warning (error if > 20%) |
| Impossible moves | == 0 | error |
| Hand imbalance | < 80% dominant | warning (error if > 90%) |
| Average cost | < 25 | warning (error if > 50) |
| Same-finger rapid repeat | < 30% | warning (error if > 45%) |
