/**
 * LearnMoreModal.
 *
 * Educational overlay explaining PushFlow's analysis workflow,
 * app flow, and cost factor definitions. The Overview tab contains
 * a rich infographic matching the PushFlow product visual.
 */

import { useState } from 'react';
import { Dialog, useOverlayTitleId } from '../shared/Overlay';
import { InputTableSections } from '../shared/ShortcutSheet';
import { CONSTRAINT_RULE_NAMES, OPTIMIZER_METHOD_KEYS, OPTIMIZER_METHOD_LABELS, PLAN_SCORE_WEIGHTS } from '@/engine';
import { VERDICT_TIERS } from '../../analysis/verdictTiers';
import { FACTOR_KEYS, FACTOR_META, type FactorKey } from '../../analysis/factorMeta';

interface LearnMoreModalProps {
  open: boolean;
  onClose: () => void;
}

type LearnMoreTab = 'overview' | 'workflow' | 'costs' | 'optimizers' | 'constraints' | 'keyboard';

/**
 * How each factor is computed: the detail under FACTOR_META's one-line
 * description. Names, colours and the musician-facing sentence come from
 * FACTOR_META only (T20, P2-9), so this tab can't drift from the panels.
 */
const FACTOR_DETAILS: Record<FactorKey, string> = {
  transition: 'Computed from how far the hand travels between pads and how little time it has (a Fitts\'s-law style cost). Lower movement means smoother, faster playing.',
  gripNaturalness: 'Combines the distance from a relaxed resting pose, each finger\'s distance from its home pad, and how comfortable the fingers used are. Lower values mean more natural hand shapes.',
  alternation: 'Rises when one finger has to strike different pads in quick succession. Better layouts share the work across fingers.',
  handBalance: 'A quadratic penalty as left/right use moves away from 50/50, so both hands share the work for sustained playing.',
  constraintPenalty: 'Charged when a plan has to break a rule: one finger on two pads at once, a grip beyond the strict geometry limits, or \u2014 only where no plan can avoid it \u2014 a hand outside its zone or a Sound played by a second finger. A plan that breaks a rule always ranks behind one that keeps it. It can be switched off for experimental evaluation.',
};

const OPTIMIZER_METHODS = [
  {
    name: 'Greedy Hill Climb',
    key: 'greedy',
    description: 'Builds an initial layout by placing sounds one at a time (most-used first), gives each sound one finger on the hand whose zone it sits in, then iteratively makes the single best local move. A move may never push a sound across to the other hand just to save cost. Every step is explainable. Best for understanding and debugging.',
  },
  {
    name: 'Beam Search',
    key: 'beam',
    description: 'Fast finger assignment via beam search. Keeps the K best candidates at each event step, looking ahead to avoid committing a sound to a finger that a later chord\u2019s grip cannot keep. Keeps hand separation and one finger per sound, relaxing them only when no plan can. Does not modify the layout. Best for quick analysis of a fixed layout.',
  },
  {
    name: 'Simulated Annealing',
    key: 'annealing',
    description: 'Jointly optimizes layout and finger assignment through randomized mutations. Accepts occasionally worse solutions to escape local minima. Best for finding globally better layouts.',
  },
];

// Analysis is automatic and Generate only proposes (T44): the flow says so.
const WORKFLOW_STEPS = [
  { step: '1', title: 'Import', description: 'Import a MIDI file (the Library starts a project from one) or build a pattern in the Composer' },
  { step: '2', title: 'Place', description: 'Click a Sound, then a pad (or drag it), or Suggest a starting layout' },
  { step: '3', title: 'Analyze', description: 'Analysis updates automatically as you place Sounds: costs and difficulty per event' },
  { step: '4', title: 'Generate', description: 'Generate proposes alternative layouts; your draft stays as it is' },
  { step: '5', title: 'Compare', description: 'Compare candidates side by side' },
  { step: '6', title: 'Keep', description: 'Save variant keeps a layout under a name, without changing the Active Layout' },
  { step: '7', title: 'Promote', description: 'Promote makes the layout you choose the new Active Layout' },
];

export function LearnMoreModal({ open, onClose }: LearnMoreModalProps) {
  const [tab, setTab] = useState<LearnMoreTab>('overview');
  const titleId = useOverlayTitleId();

  if (!open) return null;

  // A Dialog (T06): rendered into <body>, so the side panel it is opened from
  // can't squeeze it; Escape, outside press, focus trap and focus return.
  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      testId="learn-more-dialog"
      className="fixed inset-6 z-[61] max-w-3xl mx-auto rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-app)] shadow-pf-xl flex flex-col overflow-hidden"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h2 id={titleId} className="text-pf-lg font-semibold text-[var(--text-primary)]">Learn More</h2>
          <button
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-lg"
            onClick={onClose}
            aria-label="Close"
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
            { id: 'keyboard' as const, label: 'Keyboard & mouse' },
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
          {/* The same list as the '?' sheet, from the one input table (T61). */}
          {tab === 'keyboard' && <InputTableSections />}
        </div>
    </Dialog>
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
            {/* The five factors, from FACTOR_META (no placeholder numbers). */}
            <div className="grid grid-cols-3 gap-1 text-[11px] text-[var(--text-tertiary)] flex-1">
              {FACTOR_KEYS.map(key => (
                <div key={key} className="bg-[var(--bg-card)] rounded-pf-sm px-1 py-1 text-center border border-[var(--border-subtle)] flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: FACTOR_META[key].color }} aria-hidden="true" />
                  <span className="leading-tight">{FACTOR_META[key].label}</span>
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
              <p className="text-gray-600 leading-snug" data-testid="learn-more-onion">
                With an event selected, its pads are highlighted, the next event&apos;s pads get a dashed outline, and every other pad dims. Onion skin adds a dotted outline on the previous event&apos;s pads, empty or not.
              </p>
              <p className="text-[8px] text-gray-700">
                During playback the selection overlay pauses so struck pads flash normally; Stop brings it back.
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
            PushFlow generates multiple alternatives so you can compare tradeoffs. Generating never changes your layout:
            Preview a candidate to try it. If that replaces a draft you made, the draft is kept under Recovered drafts.
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
      {FACTOR_KEYS.map(key => {
        const meta = FACTOR_META[key];
        return (
          <div key={key} data-testid="learn-more-factor" data-factor={key} className="flex gap-3">
            <div
              className="w-1 rounded-full flex-shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <div>
              <div className="text-pf-base font-medium text-[var(--text-primary)] flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </div>
              <div className="text-pf-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {meta.description}
              </div>
              <div className="text-pf-sm text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                {FACTOR_DETAILS[key]}
              </div>
            </div>
          </div>
        );
      })}

      <ScoreSection />
      <VerdictsSection />
    </div>
  );
}

/**
 * The Score every layout shows (S3.1, one yardstick), explained from the
 * engine's own weights so the text can't drift from the number (invariant 2).
 */
function ScoreSection() {
  const { hardEvent, unplayableEvent, ergonomicCap } = PLAN_SCORE_WEIGHTS;
  return (
    <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
      <h4 className="text-pf-base font-medium text-[var(--text-primary)]">Score</h4>
      <p data-testid="learn-score" className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
        Every layout&rsquo;s Score is its Playability, from 0 to 100: higher is easier. PushFlow plays the layout with
        its own fingering (the same analysis for the Active Layout, your draft, each candidate and each saved variant),
        and the canonical evaluator scores that fingering: 100, minus {hardEvent} for each hard event, minus{' '}
        {unplayableEvent} for each event that can&rsquo;t be played, and minus up to {ergonomicCap} for the average cost
        per event of the {listNames(FACTOR_KEYS.map(k => FACTOR_META[k].label))} factors above (a cost family you switch
        off adds nothing). A hard event needs a grip beyond the strict hand-geometry limits; an event can&rsquo;t be
        played when a note has no pad, one finger would strike two pads at once, or a hand would have to move faster
        than it can. So the same layout scores the same wherever it appears (its row, the Analysis panel and Compare),
        whichever optimizer proposed it. &lsquo;Scoring&hellip;&rsquo; shows while a layout is being scored.
      </p>
    </div>
  );
}

/** Joins names as "A, B and C". */
function listNames(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Verdicts, rendered from the same tier list FeasibilityBadge uses, and the
 * per-event cost, named with the same FACTOR_META labels as the Selected event card.
 */
function VerdictsSection() {
  return (
    <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
      <h4 className="text-pf-base font-medium text-[var(--text-primary)]">Verdicts</h4>
      <p className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
        The layout verdict always describes the whole layout, whichever event you select. Under it, a scope line
        says what was analysed, for example &ldquo;Analysing 5 of 7 Sounds &middot; 2 muted&rdquo;: muted Sounds are
        left out of the analysis, and a Sound that isn&rsquo;t on the grid can&rsquo;t be played.
      </p>
      <div className="space-y-1.5">
        {VERDICT_TIERS.map(tier => (
          <div key={tier.level} data-testid={`learn-verdict-${tier.level}`} className="flex gap-2 text-pf-sm">
            <span className={`px-1.5 py-0.5 rounded-pf-sm border text-pf-xs font-medium flex-shrink-0 w-24 ${tier.className}`}>
              {tier.icon} {tier.label}
            </span>
            <span className="text-[var(--text-tertiary)] leading-relaxed">{tier.description}</span>
          </div>
        ))}
      </div>
      <p className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
        &lsquo;Unknown&rsquo; is not a warning about your layout: it means there is no analysis to judge it by yet
        (&lsquo;Analysing&hellip;&rsquo; while one runs). PushFlow never shows &lsquo;Feasible&rsquo; without an analysis
        that says so.
      </p>
      <h4 className="text-pf-base font-medium text-[var(--text-primary)]">Per-event cost</h4>
      <p data-testid="learn-per-event-cost" className="text-pf-sm text-[var(--text-tertiary)] leading-relaxed">
        An event is everything you strike at one instant, so a chord is one event with several notes. Its cost is
        counted once for the event, never once per note, so a three-note chord and a single note with the same
        difficulty cost the same. Selecting an event shows its own level (Easy, Medium, Hard or Unplayable) and its
        {' '}{listNames(FACTOR_KEYS.map(k => FACTOR_META[k].label))} costs, in a separate card below the layout
        verdict. An event with a note that can&rsquo;t be played reads Unplayable instead of showing empty bars.
      </p>
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
        <h4 className="text-pf-sm font-medium text-[var(--text-primary)] mb-2">Calculate cost</h4>
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

/**
 * The optimization methods, each of which pre-places locked Sounds and never
 * moves them: every method the engine offers (OPTIMIZER_METHOD_KEYS).
 */
export const LOCK_ENFORCING_METHODS: readonly string[] = OPTIMIZER_METHOD_KEYS.map(key => OPTIMIZER_METHOD_LABELS[key]);

/** The rule names the solvers' feasibility checks report; each has an entry below. */
export const SOLVER_CONSTRAINT_RULES = CONSTRAINT_RULE_NAMES;

export const HARD_CONSTRAINTS = [
  {
    // The user's own placement rule (canon section 11): enforced by every
    // method and every manual gesture, never traded for a better score.
    category: 'Placement (yours, hard)',
    color: '#f59e0b',
    rules: [
      {
        name: 'Placement Locks',
        key: 'placementLock',
        description: `A lock pins a Sound to one pad, and it is the one hard placement rule you set. ${listNames(LOCK_ENFORCING_METHODS)} all place locked Sounds first, on their locked pads, and never move them; a candidate that would break a lock is dropped, and the candidate list says so. Manual edits enforce locks too: a locked Sound cannot be dragged off its pad, and nothing can be dropped onto a locked pad (Locked \u00b7 Unlock to move); Remove from pad is refused too until the Sound is unlocked, and a Composer preset is never placed or mirrored over a locked Sound.`,
      },
      {
        name: 'Sound Identity',
        key: 'identity',
        description: 'Every event is matched to a pad by its Sound, never by MIDI pitch. A Sound with no pad is unmapped even when another Sound shares its pitch, so an unplaced Sound never borrows another Sound\u2019s pad or fingering, and its events count as unplayable until you place it. Imported pitch is kept only as provenance.',
      },
      {
        // Generate proposes; it never takes a placed Sound off the grid (T15).
        name: 'Placed Sounds Stay Placed',
        key: 'pinned',
        description: `Generate never removes a Sound that is already on the grid. A placed Sound whose events are not in the performance being optimized (a muted Sound) keeps its pad in every candidate from ${listNames(LOCK_ENFORCING_METHODS)}: it is pinned for that run, not locked, so no lock is added and you can still move it by hand. The candidate list says how many muted Sounds kept their pads.`,
      },
    ],
  },
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
        description: 'Hand movement between consecutive events cannot exceed 80 grid units/second (about 1.8 m/s on the Push 3\u2019s ~2.2\u202Fcm pad pitch \u2014 a hand crossing the full grid in roughly 100\u202Fms). Above 24 units/second the movement is still playable but costs steeply more.',
      },
      {
        name: 'Outward Rotation',
        key: 'outwardRotation',
        description: 'When two adjacent fingers share the same column, the outer finger (further from thumb) must not be placed below the inner finger (closer to thumb). E.g., R3 (middle) directly below R2 (index) in the same column forces outward hand rotation (supination). The reverse (R3 above R2) is inward rotation and natural. This only applies to same-column placement; a horizontal offset absorbs the vertical difference.',
      },
    ],
  },
  {
    // Hard rules that shape every plan. Unlike the biomechanical limits above
    // they CAN give way — but only where no plan keeps them, never to save cost.
    category: 'Structural Rules (hard, relaxed only when no plan keeps them)',
    color: '#a78bfa',
    rules: [
      {
        name: 'Hand Separation',
        key: 'zone',
        description: 'Each hand stays on its own side of the grid: the left hand plays columns 0\u20134 and the right hand columns 3\u20137 (columns 3\u20134 are shared). A plan that keeps both structural rules always wins over one that breaks either, however much cheaper the rule-breaking plan would be.',
      },
      {
        name: 'One Finger Per Sound',
        key: 'ownership',
        description: 'Every sound is played by the same finger for the whole performance, so the pad\u2192finger mapping is something you can memorise. If you set a finger for a sound, that is its finger; otherwise the solver picks one, looking ahead to avoid a finger that a later chord\u2019s grip cannot keep. A Sound has one finger setting, shared by the Sounds panel, the grid and the Composer; clearing it in any of them clears it everywhere. Save Preset records a pad\u2019s finger only when its Sound has a finger preference, and leaves it blank otherwise. Placing a Composer preset applies only those preferences: fingering marked unverified (in presets saved before this rule) is shown but never applied. A preset is placed only when all its Sounds are in this project and every pad it needs is empty; otherwise the drop is refused with the reason.',
      },
      {
        name: 'When a Rule Gives Way',
        key: 'relaxation',
        description: 'A rule gives way only when no plan can keep both \u2014 for example two pads in the right hand\u2019s zone too far apart for one hand to reach at once \u2014 or when your own finger choice for a sound asks for it. The solver then breaks as few strikes as it can, choosing the cheaper break: re-fingering on the same hand before switching hands, a short reach over the boundary before a long one, and a single stand-in finger for a sound rather than several. Those strikes are outlined in the timeline, listed per sound under the layout summary, and mark the plan as degraded rather than fully feasible.',
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
        description: 'When adjacent fingers are on the same column: index row \u2264 middle row \u2264 ring row \u2264 pinky row (bottom to top). Outer fingers placed directly below inner fingers in the same column force outward hand rotation (supination). Different columns are allowed.',
      },
    ],
  },
];

function ConstraintsSection() {
  return (
    <div className="space-y-5">
      <p className="text-pf-sm text-[var(--text-tertiary)]">
        PushFlow enforces hard constraints during solver execution. Biomechanical limits model what a human hand can
        physically do on an 8&times;8 Push grid: a grip that breaks one is rejected entirely, never merely penalised.
        The two structural rules &mdash; hand separation and one finger per sound &mdash; are just as firm, and give way
        only where no plan at all can keep them.
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
          Placement locks come first: {listNames(LOCK_ENFORCING_METHODS)} each start from the locked pads and never move a
          locked Sound, and manual edits respect locks too. When a biomechanical constraint is violated, the candidate
          grip is rejected entirely. Hand separation and one finger per sound are enforced just as strictly: the solver
          first searches only among plans that keep them, and considers breaking one only when that search cannot
          finish the performance. Any break is counted, shown per strike, and reflected in the feasibility verdict.
        </p>
      </div>
    </div>
  );
}
