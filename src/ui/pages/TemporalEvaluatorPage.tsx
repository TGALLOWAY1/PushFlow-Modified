/**
 * Temporal Evaluator Page.
 *
 * Dedicated temporal constraint / sequence evaluator.
 * Three-panel layout: scenario selection, grid+timeline, results.
 * State management and re-evaluation on edits.
 *
 * No solver, no ProjectContext — pure local state + canonical evaluator.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type FingerType } from '../../types/fingerModel';
import { padKey } from '../../types/padGrid';
import { type TemporalEvaluationResult } from '../temporal/types';
import { runTemporalEvaluation, updateMomentsPadIds } from '../temporal/temporalEngine';
import { getTemporalScenarios, getTemporalScenario } from '../temporal/temporalScenarios';
import { TemporalScenarioPanel } from '../temporal/TemporalScenarioPanel';
import { TemporalGrid } from '../temporal/TemporalGrid';
import { TemporalTimeline } from '../temporal/TemporalTimeline';
import { TemporalResultsPanel } from '../temporal/TemporalResultsPanel';

const scenarios = getTemporalScenarios();

function deepCloneLayout(layout: Layout): Layout {
  return {
    ...layout,
    padToVoice: { ...layout.padToVoice },
    fingerConstraints: { ...layout.fingerConstraints },
    placementLocks: { ...layout.placementLocks },
  };
}

function deepCloneMoments(moments: PerformanceMoment[]): PerformanceMoment[] {
  return moments.map(m => ({
    ...m,
    notes: m.notes.map(n => ({ ...n })),
  }));
}

export function TemporalEvaluatorPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const [layout, setLayout] = useState<Layout>(() => deepCloneLayout(scenarios[0].layout));
  const [assignment, setAssignment] = useState<PadFingerAssignment>(() => ({ ...scenarios[0].padFingerAssignment }));
  const [moments, setMoments] = useState<PerformanceMoment[]>(() => deepCloneMoments(scenarios[0].moments));
  const [selectedMomentIndex, setSelectedMomentIndex] = useState(0);
  const [result, setResult] = useState<TemporalEvaluationResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Run evaluation whenever state changes
  useEffect(() => {
    const r = runTemporalEvaluation(layout, assignment, moments);
    setResult(r);
  }, [layout, assignment, moments]);

  // Select a new scenario
  const handleSelectScenario = useCallback((id: string) => {
    const scenario = getTemporalScenario(id);
    if (!scenario) return;
    setSelectedId(id);
    setLayout(deepCloneLayout(scenario.layout));
    setAssignment({ ...scenario.padFingerAssignment });
    setMoments(deepCloneMoments(scenario.moments));
    setSelectedMomentIndex(0);
    setIsDirty(false);
  }, []);

  // Reset to original scenario state
  const handleReset = useCallback(() => {
    const scenario = getTemporalScenario(selectedId);
    if (!scenario) return;
    setLayout(deepCloneLayout(scenario.layout));
    setAssignment({ ...scenario.padFingerAssignment });
    setMoments(deepCloneMoments(scenario.moments));
    setSelectedMomentIndex(0);
    setIsDirty(false);
  }, [selectedId]);

  // Move a pad (drag-and-drop)
  const handleMovePad = useCallback(
    (fromPadKey: string, toRow: number, toCol: number) => {
      const toPadKey = padKey(toRow, toCol);
      const voice = layout.padToVoice[fromPadKey];
      if (!voice) return;

      // Update layout: move voice from old pad to new pad
      const newPadToVoice = { ...layout.padToVoice };
      delete newPadToVoice[fromPadKey];
      newPadToVoice[toPadKey] = voice;
      const newLayout: Layout = { ...layout, padToVoice: newPadToVoice };

      // Update assignment: move finger ownership
      const newAssignment = { ...assignment };
      if (newAssignment[fromPadKey]) {
        newAssignment[toPadKey] = newAssignment[fromPadKey];
        delete newAssignment[fromPadKey];
      }

      // Update all moments' padIds
      const newMoments = updateMomentsPadIds(moments, newLayout);

      setLayout(newLayout);
      setAssignment(newAssignment);
      setMoments(newMoments);
      setIsDirty(true);
    },
    [layout, assignment, moments],
  );

  // Reassign a finger
  const handleReassignFinger = useCallback(
    (pk: string, hand: 'left' | 'right', finger: FingerType) => {
      setAssignment((prev: PadFingerAssignment) => ({
        ...prev,
        [pk]: { hand, finger },
      }));
      setIsDirty(true);
    },
    [],
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-gray-200">
            Temporal Sequence Evaluator
          </h1>
        </div>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">
          Multi-moment evaluation — no solver
        </span>
      </div>

      {/* Main three-panel layout */}
      <div className="flex gap-4">
        {/* Left: Scenario Panel */}
        <div className="w-56 flex-shrink-0">
          <TemporalScenarioPanel
            scenarios={scenarios}
            selectedId={selectedId}
            onSelect={handleSelectScenario}
            onReset={handleReset}
            isDirty={isDirty}
          />
        </div>

        {/* Center: Grid + Timeline */}
        <div className="flex-1 flex flex-col gap-3">
          <TemporalGrid
            layout={layout}
            padFingerAssignment={assignment}
            moments={moments}
            selectedMomentIndex={selectedMomentIndex}
            transitionResults={result?.transitionResults ?? []}
            onMovePad={handleMovePad}
            onReassignFinger={handleReassignFinger}
          />
          <TemporalTimeline
            moments={moments}
            selectedMomentIndex={selectedMomentIndex}
            transitionResults={result?.transitionResults ?? []}
            firstFailingTransitionIndex={result?.firstFailingTransitionIndex ?? -1}
            onSelectMoment={setSelectedMomentIndex}
          />
        </div>

        {/* Right: Results Panel */}
        <div className="w-80 flex-shrink-0">
          <TemporalResultsPanel
            result={result}
            selectedMomentIndex={selectedMomentIndex}
          />
        </div>
      </div>
    </div>
  );
}
