/**
 * LearnMoreModal.
 *
 * Educational overlay explaining PushFlow's analysis workflow,
 * app flow, and cost factor definitions.
 */

import { useState } from 'react';

interface LearnMoreModalProps {
  open: boolean;
  onClose: () => void;
}

type LearnMoreTab = 'overview' | 'workflow' | 'costs';

const COST_DEFINITIONS = [
  {
    name: 'Stretch',
    color: '#a855f7',
    description: 'Measures how far fingers must spread to reach the required pads. High stretch means the hand shape deviates significantly from a natural resting position. Reducing stretch improves comfort and reliability.',
  },
  {
    name: 'Movement',
    color: '#f97316',
    description: 'Fitts\'s Law transition cost between consecutive events. Captures how far the hand must travel between pads in sequence. Lower movement means smoother, faster performance.',
  },
  {
    name: 'Speed',
    color: '#22c55e',
    description: 'Penalty for rapid transitions that exceed comfortable hand movement speed. When events are too close in time and too far apart in space, speed cost increases.',
  },
  {
    name: 'Repetition',
    color: '#3b82f6',
    description: 'Same-finger rapid repetition penalty. When the same finger must hit different pads in quick succession, alternation cost increases. Better layouts distribute work across fingers.',
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
      <div className="fixed inset-4 md:inset-x-auto md:inset-y-8 md:max-w-2xl md:mx-auto z-[61] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">Learn More</h2>
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg"
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
          ]).map(t => (
            <button
              key={t.id}
              className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                tab === t.id
                  ? 'bg-gray-800 text-gray-200 border border-gray-700 border-b-gray-900'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview' && <OverviewSection />}
          {tab === 'workflow' && <WorkflowSection />}
          {tab === 'costs' && <CostFactorsSection />}
        </div>
      </div>
    </>
  );
}

function OverviewSection() {
  return (
    <div className="space-y-4">
      {/* Placeholder infographic region */}
      <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-8 text-center">
        <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Infographic</div>
        <div className="text-gray-400 text-sm">
          PushFlow helps you find the most playable pad layout for your performance on Push 3.
        </div>
        <div className="mt-4 flex justify-center gap-6 text-[10px] text-gray-600">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center text-lg">
              &diams;
            </div>
            <span>Layout</span>
          </div>
          <div className="flex items-center text-gray-700">&rarr;</div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center text-lg">
              &diamondsuit;
            </div>
            <span>Execution Plan</span>
          </div>
          <div className="flex items-center text-gray-700">&rarr;</div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center text-lg">
              &star;
            </div>
            <span>Analysis</span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-400 space-y-2">
        <p>
          <strong className="text-gray-300">What are the charts?</strong> The stacked difficulty chart shows per-event cost,
          broken down by factor. Taller bars mean harder moments. Use it to spot difficulty spikes.
        </p>
        <p>
          <strong className="text-gray-300">What are candidates?</strong> Each candidate is a complete layout + execution plan proposal.
          PushFlow generates multiple alternatives so you can compare tradeoffs.
        </p>
        <p>
          <strong className="text-gray-300">How do I use this?</strong> Generate candidates, compare their difficulty profiles,
          then promote the one that best fits your playing style to become your active layout.
        </p>
      </div>
    </div>
  );
}

function WorkflowSection() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-4">
        PushFlow follows an iterative workflow. Each step builds on the last.
      </p>
      <div className="space-y-2">
        {WORKFLOW_STEPS.map((step, i) => (
          <div key={step.step} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-[11px] text-blue-400 font-medium">
              {step.step}
            </div>
            <div className="pt-0.5">
              <div className="text-xs font-medium text-gray-300">{step.title}</div>
              <div className="text-[11px] text-gray-500">{step.description}</div>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className="absolute ml-3 mt-6 w-px h-2 bg-gray-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CostFactorsSection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        PushFlow evaluates layouts using these difficulty factors. Lower values mean easier performance.
      </p>
      {COST_DEFINITIONS.map(cost => (
        <div key={cost.name} className="flex gap-3">
          <div
            className="w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: cost.color }}
          />
          <div>
            <div className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cost.color }}
              />
              {cost.name}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
              {cost.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
