/**
 * LearnMoreModal.
 *
 * Educational overlay explaining PushFlow's analysis workflow,
 * app flow, and cost factor definitions. The Overview tab contains
 * a rich infographic matching the PushFlow product visual.
 */

import { useState } from 'react';

interface LearnMoreModalProps {
  open: boolean;
  onClose: () => void;
}

type LearnMoreTab = 'overview' | 'workflow' | 'costs' | 'optimizers' | 'constraints';

const COST_DEFINITIONS = [
  {
    name: 'Grip Quality',
    color: '#a855f7',
    description: 'Measures how far fingers must spread to reach the required pads. Combines attractor force (distance from resting pose), per-finger home distance, and finger dominance preference. Lower values mean more natural hand shapes.',
  },
  {
    name: 'Movement',
    color: '#f97316',
    description: 'Fitts\'s Law transition cost between consecutive events. Captures how far the hand must travel between pads in sequence. Lower movement means smoother, faster performance.',
  },
  {
    name: 'Hard Constraints',
    color: '#ef4444',
    description: 'Penalty for biomechanically infeasible grips (relaxed/fallback tier). When the required hand shape exceeds physical limits, this cost increases. Hard constraints can be toggled off for experimental evaluation.',
  },
  {
    name: 'Repetition',
    color: '#3b82f6',
    description: 'Same-finger rapid repetition penalty. When the same finger must hit different pads in quick succession, alternation cost increases. Better layouts distribute work across fingers.',
  },
  {
    name: 'Hand Balance',
    color: '#22c55e',
    description: 'Quadratic penalty when left/right hand usage deviates from 50/50 balance. Ensures both hands share the workload evenly for sustained performance.',
  },
];

const OPTIMIZER_METHODS = [
  {
    name: 'Greedy Hill Climb',
    key: 'greedy',
    description: 'Builds an initial layout by placing sounds one at a time (most-used first), assigns fingers by hand zone, then iteratively makes the single best local move. Every step is explainable. Best for understanding and debugging.',
  },
  {
    name: 'Beam Search',
    key: 'beam',
    description: 'Fast finger assignment via beam search. Keeps the K best candidates at each event step. Does not modify the layout. Best for quick analysis of a fixed layout.',
  },
  {
    name: 'Simulated Annealing',
    key: 'annealing',
    description: 'Jointly optimizes layout and finger assignment through randomized mutations. Accepts occasionally worse solutions to escape local minima. Best for finding globally better layouts.',
  },
];

const WORKFLOW_STEPS = [
  { step: '1', title: 'Import', description: 'Import MIDI or create performance material' },
  { step: '2', title: 'Inspect', description: 'Review events, structure, and sound assignments' },
  { step: '3', title: 'Generate', description: 'Generate candidate layout solutions' },
  { step: '4', title: 'Analyze', description: 'Review costs and difficulty factors per event' },
  { step: '5', title: 'Compare', description: 'Compare candidates side by side' },
  { step: '6', title: 'Promote', description: 'Promote best candidate to active layout' },
  { step: '7', title: 'Iterate', description: 'Continue editing, adjusting, and regenerating' },
];

export function LearnMoreModal({ open, onClose }: LearnMoreModalProps) {
  const [tab, setTab] = useState<LearnMoreTab>('overview');

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-6 z-[61] max-w-3xl mx-auto rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-app)] shadow-pf-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-pf-lg font-semibold text-[var(--text-primary)]">Learn More</h2>
          <button
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-lg"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-5 pt-3">
          {([
            { id: 'overview' as const, label: 'Overview' },
            { id: 'workflow' as const, label: 'App Flow' },
            { id: 'costs' as const, label: 'Cost Factors' },
            { id: 'optimizers' as const, label: 'Optimizers' },
            { id: 'constraints' as const, label: 'Constraints' },
          ]).map(t => (
            <button
              key={t.id}
              className={`px-3 py-1.5 text-pf-sm rounded-t transition-colors ${
                tab === t.id
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] border-b-[var(--bg-app)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview' && <OverviewInfographic />}
          {tab === 'workflow' && <WorkflowSection />}
          {tab === 'costs' && <CostFactorsSection />}
          {tab === 'optimizers' && <OptimizersSection />}
          {tab === 'constraints' && <ConstraintsSection />}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Overview Infographic — rich HTML/CSS recreation of the PushFlow visual
 * ═══════════════════════════════════════════════════════════════════════ */

function OverviewInfographic() {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">PushFlow</h2>
        <p className="text-pf-lg text-[var(--text-secondary)] mt-0.5">
          Performance Layout Optimization and Event Analysis for Push-Style Grid Instruments
        </p>
        <p className="text-pf-sm text-[var(--text-tertiary)] mt-1">
          Design, inspect, and optimize playable sound layouts across time.
        </p>
      </div>

      {/* 6-step grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Step 1: Build or Import */}
        <InfoCard step="1" category="Input Layer" title="Build or Import a Performance">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-pf-lg bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>
              </div>
              <span className="text-[9px] text-gray-500">MIDI Import</span>
            </div>
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/80" /> Kick</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/80" /> Snare</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-400/80" /> Closed HH</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400/80" /> Open HH</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400/80" /> Bass 1</div>
            </div>
          </div>
        </InfoCard>

        {/* Step 2: Group Notes */}
        <InfoCard step="2" category="Event Model" title="Group Notes Into Performance Events">
          <div className="space-y-2">
            <div className="text-[10px] text-cyan-400/80 font-medium text-center">
              Performance Events = time slices
            </div>
            <div className="flex justify-center gap-1">
              {/* Mini timeline blocks */}
              {[
                { colors: ['#f87171', '#22d3ee'], label: 'Kick + HH' },
                { colors: ['#fbbf24'], label: 'Snare' },
                { colors: ['#34d399', '#a78bfa'], label: 'Open HH + Bass' },
              ].map((ev, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className="flex gap-px">
                    {ev.colors.map((c, j) => (
                      <div key={j} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c, opacity: 0.7 }} />
                    ))}
                  </div>
                  <span className="text-[8px] text-gray-600 text-center leading-tight">{ev.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-600 text-center">
              Each event = everything played at one moment in time
            </p>
          </div>
        </InfoCard>

        {/* Step 3: Map Sounds */}
        <InfoCard step="3" category="Layout and Finger Mapping" title="Map Sounds to Pads and Fingers">
          <div className="flex items-center gap-3">
            <MiniGrid />
            <div className="text-[9px] text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-blue-400">L1-L5</span>
                <span className="text-gray-600">|</span>
                <span className="text-orange-400">R1-R5</span>
              </div>
              <p className="text-gray-600 leading-snug">
                8&times;8 Push grid maps pad location + intended finger/hand usage
              </p>
              <div className="flex gap-0.5 mt-1">
                <div className="w-6 h-1 rounded-full bg-blue-500/30" />
                <div className="w-6 h-1 rounded-full bg-orange-500/30" />
              </div>
              <p className="text-[8px] text-gray-700">Hand zone hints</p>
            </div>
          </div>
        </InfoCard>

        {/* Step 4: Analyze */}
        <InfoCard step="4" category="Analysis Engine" title="Analyze Playability">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[8px] text-gray-500 flex-1">
              {[
                { label: 'Static Ergonomic Cost', icon: '350' },
                { label: 'Transition Cost', icon: '570' },
                { label: 'Finger Usage Burden', icon: '' },
                { label: 'Reach & Awkwardness', icon: '' },
                { label: 'Movement Difficulty', icon: '' },
                { label: 'Overall Playability', icon: '' },
              ].map((f, i) => (
                <div key={i} className="bg-[var(--bg-card)] rounded-pf-sm px-1 py-1 text-center border border-[var(--border-subtle)]">
                  {f.icon && <div className="text-pf-xs text-[var(--text-secondary)] font-mono">{f.icon}</div>}
                  <div className="leading-tight">{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </InfoCard>

        {/* Step 5: Inspect Events */}
        <InfoCard step="5" category="Event Inspection" title="Inspect Events One Moment at a Time">
          <div className="flex items-center gap-3">
            <div className="relative">
              <MiniGrid size={0.7} />
              {/* Onion arc overlay */}
              <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 60 60" fill="none">
                <path d="M15 45 Q30 25 45 40" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
                <circle cx="15" cy="45" r="2" fill="#60a5fa" opacity="0.5" />
                <circle cx="45" cy="40" r="2" fill="#f97316" opacity="0.5" />
              </svg>
            </div>
            <div className="text-[9px] text-gray-500 space-y-1">
              <div className="text-[10px] text-gray-400">Onion view:</div>
              <p className="text-gray-600 leading-snug">
                Ghosted previous/next event states with curved transition arcs
              </p>
              <p className="text-[8px] text-gray-700">
                Active sounds highlighted for selected event
              </p>
            </div>
          </div>
        </InfoCard>

        {/* Step 6: Compare */}
        <InfoCard step="6" category="Optimization" title="Compare and Optimize Layouts">
          <div className="space-y-2">
            <div className="flex gap-2 justify-center">
              {['A', 'B', 'C'].map((label, i) => (
                <div key={label} className="text-center">
                  <div className="text-[8px] text-gray-500 mb-0.5">Candidate {label}</div>
                  <MiniGrid size={0.5} seed={i} />
                  <div className="mt-1 flex gap-px justify-center">
                    <div className="h-1 rounded-full" style={{ width: [18, 22, 14][i], backgroundColor: '#3b82f6', opacity: 0.6 }} />
                    <div className="h-1 rounded-full" style={{ width: [12, 8, 16][i], backgroundColor: '#a855f7', opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[8px] text-gray-600 px-2">
              <span>easier layout</span>
              <span>smoother transitions</span>
              <span>lower strain</span>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Why PushFlow Matters */}
      <div className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h3 className="text-pf-lg font-semibold text-[var(--text-primary)] mb-2">Why PushFlow Matters</h3>
        <div className="space-y-1.5">
          {[
            'Turn MIDI patterns into playable performance layouts',
            'Understand difficulty before practicing',
            'See how sound placement affects movement',
            'Improve ergonomics and execution',
            'Make layout decisions with visual feedback',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-pf-sm text-[var(--text-secondary)]">
              <span className="text-cyan-500/60 text-xs">{'>'}</span>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ section */}
      <div className="space-y-3">
        <div className="text-pf-base text-[var(--text-secondary)] space-y-2">
          <p>
            <strong className="text-[var(--text-primary)]">What are the charts?</strong> The stacked difficulty chart shows per-event cost,
            broken down by factor. Taller bars mean harder moments. Use it to spot difficulty spikes.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">What are candidates?</strong> Each candidate is a complete layout + execution plan proposal.
            PushFlow generates multiple alternatives so you can compare tradeoffs.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">What is the Greedy optimizer?</strong> It builds a layout step by step, then improves it
            one move at a time. Every change is logged with a plain-English explanation so you can see exactly why each decision was made.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">What are cost toggles?</strong> You can enable/disable individual cost factors in the
            Cost Evaluation section. This lets you evaluate a layout focusing on specific concerns (e.g., movement only, grip only).
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">What does Calculate Cost do?</strong> It evaluates your current layout and finger assignment
            using the active cost toggles, without running a full optimization. Useful for manual assessment.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Infographic helper components ──────────────────────────────────── */

function InfoCard({ step, category, title, children }: {
  step: string;
  category: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-2">
      <div>
        <div className="text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider">{category}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-pf-sm font-bold text-[var(--text-primary)]">{step}.</span>
          <span className="text-pf-sm font-medium text-[var(--text-primary)]">{title}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Tiny 8x8 grid with randomized colored pads for visual preview */
function MiniGrid({ size = 1, seed = 0 }: { size?: number; seed?: number }) {
  const cellSize = Math.round(6 * size);
  const gap = 1;

  // Deterministic pseudo-random pad colors
  const colors = ['#f87171', '#fbbf24', '#34d399', '#22d3ee', '#a78bfa', '#f472b6', '#60a5fa'];
  const occupied = new Set<number>();
  let s = seed * 7 + 13;
  for (let i = 0; i < 8; i++) {
    s = (s * 31 + 17) % 64;
    occupied.add(s);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(8, ${cellSize}px)`,
        gridTemplateRows: `repeat(8, ${cellSize}px)`,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: 64 }, (_, i) => {
        const hasColor = occupied.has(i);
        const colorIdx = (i * 3 + seed * 5) % colors.length;
        return (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: hasColor ? colors[colorIdx] : 'rgba(31,41,55,0.4)',
              opacity: hasColor ? 0.7 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Workflow Section — step-by-step app flow
 * ═══════════════════════════════════════════════════════════════════════ */

function WorkflowSection() {
  return (
    <div className="space-y-3">
      <p className="text-pf-sm text-[var(--text-tertiary)] mb-4">
        PushFlow follows an iterative workflow. Each step builds on the last.
      </p>
      <div className="space-y-2">
        {WORKFLOW_STEPS.map((step, i) => (
          <div key={step.step} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-pf-sm text-blue-400 font-medium">
                {step.step}
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="w-px h-4 bg-[var(--border-subtle)] mt-1" />
              )}
            </div>
            <div className="pt-0.5">
              <div className="text-pf-sm font-medium text-[var(--text-primary)]">{step.title}</div>
              <div className="text-pf-sm text-[var(--text-tertiary)]">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Cost Factors Section — canonical definitions
 * ═══════════════════════════════════════════════════════════════════════ */

function CostFactorsSection() {
  return (
    <div className="space-y-4">
      <p className="text-pf-sm text-[var(--text-tertiary)]">
        PushFlow evaluates layouts using these difficulty factors. Lower values mean easier performance.
      </p>
      {COST_DEFINITIONS.map(cost => (
        <div key={cost.name} className="flex gap-3">
          <div
            className="w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: cost.color }}
          />
          <div>
            <div className="text-pf-base font-medium text-[var(--text-primary)] flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cost.color }}
              />
              {cost.name}
            </div>
            <div className="text-pf-sm text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
              {cost.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Optimizers Section — available optimization methods
 * ═══════════════════════════════════════════════════════════════════════ */

function OptimizersSection() {
  return (
    <div className="space-y-4">
      <p className="text-pf-sm text-[var(--text-tertiary)]">
        PushFlow supports multiple optimization methods. Select your preferred method from the toolbar dropdown before clicking Generate.
      </p>
      {OPTIMIZER_METHODS.map(method => (
        <div key={method.key} className="flex gap-3">
          <div className="w-1 rounded-full flex-shrink-0 bg-cyan-500/60" />
          <div>
            <div className="text-pf-base font-medium text-[var(--text-primary)] flex items-center gap-2">
              {method.name}
              <span className="text-pf-micro font-mono px-1.5 py-0.5 rounded-pf-sm bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                {method.key}
              </span>
            </div>
            <div className="text-pf-sm text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
              {method.description}
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 mt-4">
        <h4 className="text-pf-sm font-medium text-[var(--text-primary)] mb-2">Cost Toggles</h4>
        <p className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
          All cost factors can be individually toggled on/off in the Cost Evaluation section of the analysis panel.
          Disabled factors contribute zero to the total cost during both manual evaluation (Calculate Cost) and optimization.
          Disabling hard constraints enters experimental mode and is flagged in the UI.
        </p>
      </div>

      <div className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        <h4 className="text-pf-sm font-medium text-[var(--text-primary)] mb-2">Calculate Cost</h4>
        <p className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
          The Calculate Cost button evaluates your current layout and finger assignment without running a full optimization.
          It shows total cost, static/temporal subtotals, per-factor breakdown, feasibility verdict, and event counts.
          The result uses the currently active cost toggles.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * Constraints Section — active voice constraints, placement locks, finger constraints
 * ═══════════════════════════════════════════════════════════════════════ */

const HARD_CONSTRAINTS = [
  {
    category: 'Biomechanical',
    color: '#ef4444',
    rules: [
      {
        name: 'Finger Span',
        key: 'span',
        description: 'Per-finger-pair maximum Euclidean distance on the grid. E.g., index-middle max 2.0 units, pinky-ring max 1.5 units (linked tendons), thumb-to-pinky envelope max 5.5 units.',
      },
      {
        name: 'Finger Ordering',
        key: 'ordering',
        description: 'Fingers must maintain anatomical left-to-right order on the grid. No crossovers allowed (e.g., index cannot cross over pinky).',
      },
      {
        name: 'Collision',
        key: 'collision',
        description: 'Two different fingers cannot occupy the same pad simultaneously.',
      },
      {
        name: 'Thumb Position',
        key: 'thumbDelta',
        description: 'Thumb cannot be positioned more than 1 row above the index finger. Enforces natural "thumbs below" hand posture.',
      },
      {
        name: 'Reachability',
        key: 'reachability',
        description: 'Each finger must stay within 5.0 grid units of the hand anchor. Pads outside this envelope are unreachable.',
      },
      {
        name: 'Transition Speed',
        key: 'speed',
        description: 'Hand movement between consecutive events cannot exceed 12.0 grid units/second. Faster transitions are physically impossible.',
      },
      {
        name: 'Outward Rotation',
        key: 'outwardRotation',
        description: 'For simultaneous notes on the same hand, a finger further from the thumb must not be placed on a lower row than a finger closer to the thumb. E.g., R3 (middle) below R2 (index) forces outward hand rotation (supination), which is unnatural. The reverse (R3 above R2) is inward rotation and is allowed. Rule: index row \u2264 middle row \u2264 ring row \u2264 pinky row.',
      },
    ],
  },
  {
    category: 'Hand Zones',
    color: '#3b82f6',
    rules: [
      {
        name: 'Left Hand Zone',
        key: 'zone-left',
        description: 'Left hand is restricted to columns 0\u20134 of the 8\u00d78 grid.',
      },
      {
        name: 'Right Hand Zone',
        key: 'zone-right',
        description: 'Right hand is restricted to columns 3\u20137 of the 8\u00d78 grid.',
      },
      {
        name: 'Shared Zone',
        key: 'zone-shared',
        description: 'Columns 3\u20134 are a shared zone accessible by either hand.',
      },
    ],
  },
  {
    category: 'Topology',
    color: '#a855f7',
    rules: [
      {
        name: 'Hand Topology (Horizontal)',
        key: 'topology',
        description: 'Left hand: pinky \u2264 ring \u2264 middle \u2264 index \u2264 thumb (left to right). Right hand: thumb \u2264 index \u2264 middle \u2264 ring \u2264 pinky (left to right). Violations mean an anatomically impossible hand shape.',
      },
      {
        name: 'Hand Topology (Vertical)',
        key: 'outwardRotation',
        description: 'Both hands: index row \u2264 middle row \u2264 ring row \u2264 pinky row (bottom to top). Outer fingers placed below inner fingers force outward hand rotation (supination), which is unnatural and strained.',
      },
    ],
  },
];

function ConstraintsSection() {
  return (
    <div className="space-y-5">
      <p className="text-pf-sm text-[var(--text-tertiary)]">
        PushFlow enforces hard biomechanical constraints during solver execution. Violations result in infeasibility
        (the grip is rejected entirely), not soft penalties. These constraints model the physical limits of human hands
        on an 8&times;8 Push grid.
      </p>

      {HARD_CONSTRAINTS.map(group => (
        <div key={group.category}>
          <h4 className="section-header mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
            {group.category}
          </h4>
          <div className="space-y-1.5">
            {group.rules.map(rule => (
              <div key={rule.key} className="flex gap-3 px-2 py-2 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="w-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                <div>
                  <div className="text-pf-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    {rule.name}
                    <span className="text-pf-micro font-mono px-1.5 py-0.5 rounded-pf-sm bg-[var(--bg-panel)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                      {rule.key}
                    </span>
                  </div>
                  <div className="text-pf-sm text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                    {rule.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-pf-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        <h4 className="text-pf-sm font-medium text-[var(--text-primary)] mb-1">Enforcement</h4>
        <p className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
          When any constraint is violated, the candidate grip is rejected entirely (returns infeasibility).
          The solver only considers grips that pass all hard constraints at the strict tier. Relaxed and fallback
          tiers widen limits slightly when no strict solution exists, flagged by the feasibility verdict.
        </p>
      </div>
    </div>
  );
}
