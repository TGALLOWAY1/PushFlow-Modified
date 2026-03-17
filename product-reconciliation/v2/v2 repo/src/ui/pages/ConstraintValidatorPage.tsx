/**
 * Constraint Validator Page.
 *
 * Top-level orchestrator for the atomic constraint validator.
 * Three-panel layout: scenario selection, grid, results.
 * State management and re-evaluation on edits.
 *
 * No solver, no ProjectContext — pure local state.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Layout } from '../../types/layout';
import { type PadFingerAssignment } from '../../types/executionPlan';
import { type PerformanceMoment } from '../../types/performanceEvent';
import { type FingerType } from '../../types/fingerModel';
import { padKey } from '../../types/padGrid';
import { type ValidatorResult } from '../validator/types';
import { runValidation, updateMomentPadIds } from '../validator/validatorEngine';
import { getValidatorScenarios, getValidatorScenario } from '../validator/validatorScenarios';
import { ValidatorScenarioPanel } from '../validator/ValidatorScenarioPanel';
import { ValidatorGrid } from '../validator/ValidatorGrid';
import { ValidatorResultsPanel } from '../validator/ValidatorResultsPanel';

const scenarios = getValidatorScenarios();

function deepCloneLayout(layout: Layout): Layout {
  return {
    ...layout,
    padToVoice: { ...layout.padToVoice },
    fingerConstraints: { ...layout.fingerConstraints },
    placementLocks: { ...layout.placementLocks },
  };
}

function deepCloneMoment(moment: PerformanceMoment): PerformanceMoment {
  return {
    ...moment,
    notes: moment.notes.map(n => ({ ...n })),
  };
}

export function ConstraintValidatorPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const [layout, setLayout] = useState<Layout>(() => deepCloneLayout(scenarios[0].layout));
  const [assignment, setAssignment] = useState<PadFingerAssignment>(() => ({ ...scenarios[0].padFingerAssignment }));
  const [moment, setMoment] = useState<PerformanceMoment>(() => deepCloneMoment(scenarios[0].moment));
  const [result, setResult] = useState<ValidatorResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Run validation whenever state changes
  useEffect(() => {
    const r = runValidation(layout, assignment, moment);
    setResult(r);
  }, [layout, assignment, moment]);

  // Select a new scenario
  const handleSelectScenario = useCallback((id: string) => {
    const scenario = getValidatorScenario(id);
    if (!scenario) return;
    setSelectedId(id);
    setLayout(deepCloneLayout(scenario.layout));
    setAssignment({ ...scenario.padFingerAssignment });
    setMoment(deepCloneMoment(scenario.moment));
    setIsDirty(false);
  }, []);

  // Reset to original scenario state
  const handleReset = useCallback(() => {
    const scenario = getValidatorScenario(selectedId);
    if (!scenario) return;
    setLayout(deepCloneLayout(scenario.layout));
    setAssignment({ ...scenario.padFingerAssignment });
    setMoment(deepCloneMoment(scenario.moment));
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

      // Update moment padIds
      const newMoment = updateMomentPadIds(moment, newLayout);

      setLayout(newLayout);
      setAssignment(newAssignment);
      setMoment(newMoment);
      setIsDirty(true);
    },
    [layout, assignment, moment],
  );

  // Reassign a finger
  const handleReassignFinger = useCallback(
    (pk: string, hand: 'left' | 'right', finger: FingerType) => {
      setAssignment(prev => ({
        ...prev,
        [pk]: { hand, finger },
      }));
      setIsDirty(true);
    },
    [],
  );

  // Compute violated pads from evidence
  const violatedPads = useMemo(() => {
    const set = new Set<string>();
    if (!result) return set;
    for (const e of result.evidence) {
      if (e.pads) {
        for (const p of e.pads) set.add(p);
      }
    }
    return set;
  }, [result]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-gray-200">
            Constraint Validator
          </h1>
        </div>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">
          Single-moment evaluation — no solver
        </span>
      </div>

      {/* Three-panel layout */}
      <div className="flex gap-6">
        {/* Left: Scenario Panel */}
        <div className="w-64 flex-shrink-0">
          <ValidatorScenarioPanel
            scenarios={scenarios}
            selectedId={selectedId}
            onSelect={handleSelectScenario}
            onReset={handleReset}
            isDirty={isDirty}
          />
        </div>

        {/* Center: Grid */}
        <div className="flex-shrink-0">
          <ValidatorGrid
            layout={layout}
            padFingerAssignment={assignment}
            moment={moment}
            violatedPads={violatedPads}
            onMovePad={handleMovePad}
            onReassignFinger={handleReassignFinger}
          />
        </div>

        {/* Right: Results Panel */}
        <div className="flex-1 min-w-[280px] max-w-[360px]">
          <ValidatorResultsPanel result={result} />
        </div>
      </div>
    </div>
  );
}
