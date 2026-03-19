/**
 * Part 6 — Optimizer Debug Dashboard.
 *
 * Developer debugging page at /optimizer-debug.
 *
 * Sections:
 *   1. Event Timeline — sortable table of events with cost breakdowns
 *   2. Finger Usage Chart — bar chart detecting pinky/thumb abuse
 *   3. Cost Breakdown — stacked bars per cost component
 *   4. Constraint Violations — table of all violations
 *   5. Movement Visualization — highlights long jumps
 *   6. Irrational Assignments — flagged suspicious decisions
 *   7. Sanity Check Summary — pass/fail dashboard
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { type CandidateSolution } from '../../types/candidateSolution';
import { type ExecutionPlanResult } from '../../types/executionPlan';
import {
  extractEvaluationRecords,
  generateCandidateReport,
  detectIrrationalAssignments,
  validateExecutionPlan,
  generateVisualizationData,
  runSanityChecks,
  type OptimizationEvaluationRecord,
  type CandidateReport,
  type IrrationalAssignment,
  type ConstraintViolation,
  type SanityCheckReport,
  type VisualizationData,
} from '../../engine/debug';

// ============================================================================
// Debug Data Store (populated externally via window.__PUSHFLOW_DEBUG__)
// ============================================================================

declare global {
  interface Window {
    __PUSHFLOW_DEBUG__?: {
      candidates?: CandidateSolution[];
      latestResult?: ExecutionPlanResult;
    };
  }
}

type SortField = 'eventIndex' | 'totalCost' | 'travel' | 'pose' | 'fingerPenalty' | 'timestamp';
type SortDir = 'asc' | 'desc';
type DebugTab = 'timeline' | 'fingers' | 'costs' | 'violations' | 'movement' | 'irrational' | 'sanity';

export function OptimizerDebugPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DebugTab>('timeline');
  const [sortField, setSortField] = useState<SortField>('eventIndex');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedCandidate, setSelectedCandidate] = useState(0);

  // Read debug data from global store
  const debugData = typeof window !== 'undefined' ? window.__PUSHFLOW_DEBUG__ : undefined;
  const candidates = debugData?.candidates ?? [];
  const latestResult = debugData?.latestResult;

  const candidate = candidates[selectedCandidate] ?? null;
  const result = candidate?.executionPlan ?? latestResult ?? null;

  // Compute all debug artifacts
  const records = useMemo(
    () => (result ? extractEvaluationRecords(result) : []),
    [result],
  );

  const report = useMemo(
    () => (candidate ? generateCandidateReport(candidate) : null),
    [candidate],
  );

  const irrationalFlags = useMemo(
    () => detectIrrationalAssignments(records),
    [records],
  );

  const violations = useMemo(
    () => (result ? validateExecutionPlan(result) : []),
    [result],
  );

  const vizData = useMemo(
    () => generateVisualizationData(records),
    [records],
  );

  const sanityReport = useMemo(
    () => (result ? runSanityChecks(result) : null),
    [result],
  );

  // Sorted records for timeline view
  const sortedRecords = useMemo(() => {
    const sorted = [...records];
    sorted.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'eventIndex': va = a.eventIndex; vb = b.eventIndex; break;
        case 'totalCost': va = a.totalCost; vb = b.totalCost; break;
        case 'travel': va = a.costs.travel; vb = b.costs.travel; break;
        case 'pose': va = a.costs.pose; vb = b.costs.pose; break;
        case 'fingerPenalty': va = a.costs.fingerPenalty; vb = b.costs.fingerPenalty; break;
        case 'timestamp': va = a.timestamp; vb = b.timestamp; break;
        default: va = a.eventIndex; vb = b.eventIndex;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return sorted;
  }, [records, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Optimizer Debug Dashboard</h1>
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">
              No optimization data available.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Run an optimization from the Editor tab, then return here.
              Data is exposed via <code className="bg-gray-800 px-1 rounded">window.__PUSHFLOW_DEBUG__</code>.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
            >
              Go to Project Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: DebugTab; label: string; count?: number }[] = [
    { id: 'timeline', label: 'Event Timeline', count: records.length },
    { id: 'fingers', label: 'Finger Usage' },
    { id: 'costs', label: 'Cost Breakdown' },
    { id: 'violations', label: 'Violations', count: violations.length },
    { id: 'movement', label: 'Movement' },
    { id: 'irrational', label: 'Irrational', count: irrationalFlags.length },
    { id: 'sanity', label: 'Sanity', count: sanityReport ? sanityReport.checks.filter(c => !c.passed).length : 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Optimizer Debug Dashboard</h1>
            <p className="text-gray-500 text-xs mt-1">
              {records.length} events | Score: {result.score.toFixed(2)} | Unplayable: {result.unplayableCount} | Hard: {result.hardCount}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {candidates.length > 1 && (
              <select
                className="bg-gray-800 text-gray-200 px-3 py-1.5 rounded text-sm border border-gray-700"
                value={selectedCandidate}
                onChange={e => setSelectedCandidate(Number(e.target.value))}
              >
                {candidates.map((c, i) => (
                  <option key={c.id} value={i}>
                    Candidate {i + 1} ({c.metadata.strategy})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              Back
            </button>
          </div>
        </div>

        {/* Sanity Check Banner */}
        {sanityReport && !sanityReport.allPassed && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm font-medium">
              {sanityReport.errors} error(s), {sanityReport.warnings} warning(s) detected
            </p>
            <div className="mt-1 space-y-0.5">
              {sanityReport.checks.filter(c => !c.passed).map(c => (
                <p key={c.name} className="text-red-400 text-xs">
                  {c.severity === 'error' ? '✕' : '⚠'} {c.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-800 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-t text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                  tab.id === 'violations' || tab.id === 'irrational' || tab.id === 'sanity'
                    ? 'bg-red-900 text-red-300'
                    : 'bg-gray-700 text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-900 rounded-lg p-4">
          {activeTab === 'timeline' && (
            <EventTimelineTab
              records={sortedRecords}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
          {activeTab === 'fingers' && <FingerUsageTab report={report} />}
          {activeTab === 'costs' && <CostBreakdownTab report={report} records={records} />}
          {activeTab === 'violations' && <ViolationsTab violations={violations} />}
          {activeTab === 'movement' && <MovementTab vizData={vizData} />}
          {activeTab === 'irrational' && <IrrationalTab flags={irrationalFlags} />}
          {activeTab === 'sanity' && <SanityTab report={sanityReport} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 1: Event Timeline
// ============================================================================

function EventTimelineTab({
  records,
  sortField,
  sortDir,
  onSort,
}: {
  records: OptimizationEvaluationRecord[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-2 py-1.5 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
      onClick={() => onSort(field)}
    >
      {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-gray-300">Event Timeline ({records.length} events)</h2>
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr>
              <SortHeader field="eventIndex" label="#" />
              <SortHeader field="timestamp" label="Time" />
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-400">Pad</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-400">Hand</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-400">Finger</th>
              <SortHeader field="totalCost" label="Total Cost" />
              <SortHeader field="travel" label="Travel" />
              <SortHeader field="pose" label="Pose" />
              <SortHeader field="fingerPenalty" label="Finger" />
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-400">Zone</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-400">Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr
                key={r.eventIndex}
                className={`border-t border-gray-800 hover:bg-gray-800/50 ${
                  r.difficulty === 'Unplayable' ? 'bg-red-950/30' :
                  r.difficulty === 'Hard' ? 'bg-orange-950/20' :
                  ''
                }`}
              >
                <td className="px-2 py-1 text-gray-400">{r.eventIndex}</td>
                <td className="px-2 py-1 text-gray-300">{r.timestamp.toFixed(3)}s</td>
                <td className="px-2 py-1 font-mono text-gray-300">[{r.pad[0]},{r.pad[1]}]</td>
                <td className="px-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    r.hand === 'left' ? 'bg-blue-900/50 text-blue-300' :
                    r.hand === 'right' ? 'bg-green-900/50 text-green-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {r.hand}
                  </span>
                </td>
                <td className="px-2 py-1 text-gray-300">{r.finger ?? '—'}</td>
                <td className="px-2 py-1 font-mono">
                  <CostBadge value={r.totalCost} />
                </td>
                <td className="px-2 py-1 font-mono text-gray-400">{r.costs.travel.toFixed(1)}</td>
                <td className="px-2 py-1 font-mono text-gray-400">{r.costs.pose.toFixed(1)}</td>
                <td className="px-2 py-1 font-mono text-gray-400">{r.costs.fingerPenalty.toFixed(1)}</td>
                <td className="px-2 py-1 font-mono text-gray-400">
                  {r.costs.zoneViolation > 0 ? r.costs.zoneViolation.toFixed(1) : '—'}
                </td>
                <td className="px-2 py-1">
                  <DifficultyBadge level={r.difficulty} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 2: Finger Usage
// ============================================================================

function FingerUsageTab({
  report,
}: {
  report: CandidateReport | null;
}) {
  const fingers: Array<{ name: string; key: keyof import('../../engine/debug').FingerUsageBreakdown }> = [
    { name: 'Thumb', key: 'thumb' },
    { name: 'Index', key: 'index' },
    { name: 'Middle', key: 'middle' },
    { name: 'Ring', key: 'ring' },
    { name: 'Pinky', key: 'pinky' },
  ];

  const usage = report?.fingerUsage.combined ?? { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 text-gray-300">Finger Usage Distribution</h2>
      <div className="grid grid-cols-2 gap-6">
        {/* Combined */}
        <div>
          <h3 className="text-xs text-gray-400 mb-2">Combined</h3>
          <div className="space-y-2">
            {fingers.map(f => (
              <BarRow key={f.key} label={f.name} value={usage[f.key]} warn={f.key === 'pinky' && usage.pinky > 20} />
            ))}
          </div>
        </div>

        {/* Per Hand */}
        <div className="space-y-4">
          {(['left', 'right'] as const).map(hand => (
            <div key={hand}>
              <h3 className="text-xs text-gray-400 mb-2">{hand === 'left' ? 'Left Hand' : 'Right Hand'}</h3>
              <div className="space-y-1">
                {fingers.map(f => {
                  const val = report?.fingerUsage[hand]?.[f.key] ?? 0;
                  return <BarRow key={f.key} label={f.name} value={val} warn={f.key === 'pinky' && val > 25} small />;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hand Balance */}
      {report && (
        <div className="mt-6">
          <h3 className="text-xs text-gray-400 mb-2">Hand Balance</h3>
          <div className="flex gap-2 items-center">
            <span className="text-blue-400 text-xs w-16 text-right">Left {report.handUsage.left.toFixed(1)}%</span>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden flex">
              <div className="bg-blue-600" style={{ width: `${report.handUsage.left}%` }} />
              <div className="bg-green-600" style={{ width: `${report.handUsage.right}%` }} />
              <div className="bg-red-600" style={{ width: `${report.handUsage.unplayable}%` }} />
            </div>
            <span className="text-green-400 text-xs w-16">Right {report.handUsage.right.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab 3: Cost Breakdown
// ============================================================================

function CostBreakdownTab({
  report,
  records,
}: {
  report: CandidateReport | null;
  records: OptimizationEvaluationRecord[];
}) {
  const costs = report?.costTotals ?? {
    travel: 0, transitionSpeed: 0, pose: 0, zoneViolation: 0,
    fingerPenalty: 0, repetitionPenalty: 0, collisionPenalty: 0,
    feasibilityPenalty: 0, total: 0,
  };

  const components = [
    { label: 'Travel/Movement', value: costs.travel, color: 'bg-blue-500' },
    { label: 'Pose Naturalness', value: costs.pose, color: 'bg-purple-500' },
    { label: 'Finger Penalty', value: costs.fingerPenalty, color: 'bg-yellow-500' },
    { label: 'Zone Violation', value: costs.zoneViolation, color: 'bg-orange-500' },
    { label: 'Repetition', value: costs.repetitionPenalty, color: 'bg-red-500' },
    { label: 'Feasibility', value: costs.feasibilityPenalty, color: 'bg-pink-500' },
  ];

  const maxVal = Math.max(...components.map(c => c.value), 0.001);

  // Top 10 most expensive events
  const topExpensive = [...records]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 text-gray-300">Cost Breakdown (Totals)</h2>
      <div className="space-y-2 mb-6">
        {components.map(c => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-32 text-right">{c.label}</span>
            <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full ${c.color} transition-all`}
                style={{ width: `${(c.value / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-300 w-16">{c.value.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-gray-400">Total Cost:</span>
        <span className="font-mono font-bold text-white">{costs.total.toFixed(2)}</span>
      </div>

      {/* Top Expensive Events */}
      <h3 className="text-xs text-gray-400 mb-2">Top 10 Most Expensive Events</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-gray-400">#</th>
            <th className="px-2 py-1 text-left text-gray-400">Pad</th>
            <th className="px-2 py-1 text-left text-gray-400">Hand/Finger</th>
            <th className="px-2 py-1 text-left text-gray-400">Cost</th>
            <th className="px-2 py-1 text-left text-gray-400">Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {topExpensive.map(r => (
            <tr key={r.eventIndex} className="border-t border-gray-800">
              <td className="px-2 py-1">{r.eventIndex}</td>
              <td className="px-2 py-1 font-mono">[{r.pad[0]},{r.pad[1]}]</td>
              <td className="px-2 py-1">{r.hand} {r.finger}</td>
              <td className="px-2 py-1 font-mono"><CostBadge value={r.totalCost} /></td>
              <td className="px-2 py-1 text-gray-500">
                T:{r.costs.travel.toFixed(1)} P:{r.costs.pose.toFixed(1)} F:{r.costs.fingerPenalty.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Tab 4: Constraint Violations
// ============================================================================

function ViolationsTab({ violations }: { violations: ConstraintViolation[] }) {
  if (violations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-green-400 text-sm">No constraint violations detected.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-gray-300">
        Constraint Violations ({violations.length})
      </h2>
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr>
              <th className="px-2 py-1.5 text-left text-gray-400">Event</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Constraint</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Type</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Actual</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Limit</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={i} className={`border-t border-gray-800 ${v.type === 'hard' ? 'bg-red-950/20' : ''}`}>
                <td className="px-2 py-1">{v.eventIndex}</td>
                <td className="px-2 py-1 font-mono">{v.constraintName}</td>
                <td className="px-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    v.type === 'hard' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                    {v.type}
                  </span>
                </td>
                <td className="px-2 py-1 font-mono">{v.actual === Infinity ? '∞' : v.actual.toFixed(1)}</td>
                <td className="px-2 py-1 font-mono">{v.limit.toFixed(1)}</td>
                <td className="px-2 py-1 text-gray-400">{v.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 5: Movement Visualization
// ============================================================================

function MovementTab({ vizData }: { vizData: VisualizationData }) {
  const moves = vizData.movementDistanceTimeline;
  const longJumps = moves.filter(m => m.distance > 3.0);

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-gray-300">
        Movement Analysis ({moves.length} transitions)
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatBox label="Total Moves" value={moves.length.toString()} />
        <StatBox
          label="Avg Distance"
          value={moves.length > 0
            ? (moves.reduce((s, m) => s + m.distance, 0) / moves.length).toFixed(2)
            : '0'}
        />
        <StatBox label="Max Distance" value={moves.length > 0 ? Math.max(...moves.map(m => m.distance)).toFixed(2) : '0'} />
        <StatBox label="Long Jumps (>3)" value={longJumps.length.toString()} warn={longJumps.length > 5} />
      </div>

      {/* Long Jumps Table */}
      {longJumps.length > 0 && (
        <>
          <h3 className="text-xs text-gray-400 mb-2">Long Jumps (&gt;3 grid units)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-gray-400">Event</th>
                <th className="px-2 py-1 text-left text-gray-400">From</th>
                <th className="px-2 py-1 text-left text-gray-400">To</th>
                <th className="px-2 py-1 text-left text-gray-400">Distance</th>
                <th className="px-2 py-1 text-left text-gray-400">Hand</th>
              </tr>
            </thead>
            <tbody>
              {longJumps.slice(0, 20).map(m => (
                <tr key={m.eventIndex} className="border-t border-gray-800">
                  <td className="px-2 py-1">{m.eventIndex}</td>
                  <td className="px-2 py-1 font-mono">[{m.fromPad[0]},{m.fromPad[1]}]</td>
                  <td className="px-2 py-1 font-mono">[{m.toPad[0]},{m.toPad[1]}]</td>
                  <td className="px-2 py-1 font-mono text-orange-400">{m.distance.toFixed(2)}</td>
                  <td className="px-2 py-1">{m.hand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 8x8 Grid Heatmap (transitions) */}
      <h3 className="text-xs text-gray-400 mb-2 mt-4">Pad Activity Heatmap</h3>
      <PadHeatmap moves={moves} />
    </div>
  );
}

// ============================================================================
// Tab 6: Irrational Assignments
// ============================================================================

function IrrationalTab({ flags }: { flags: IrrationalAssignment[] }) {
  if (flags.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-green-400 text-sm">No irrational assignments detected.</p>
      </div>
    );
  }

  const severityColor = (sev: string) => {
    if (sev === 'definitely_irrational') return 'bg-red-900 text-red-300';
    if (sev === 'likely_irrational') return 'bg-orange-900 text-orange-300';
    return 'bg-yellow-900 text-yellow-300';
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-gray-300">
        Irrational Finger Assignments ({flags.length})
      </h2>
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr>
              <th className="px-2 py-1.5 text-left text-gray-400">Event</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Finger</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Rule</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Severity</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Explanation</th>
              <th className="px-2 py-1.5 text-left text-gray-400">Better Options</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f, i) => (
              <tr key={i} className="border-t border-gray-800">
                <td className="px-2 py-1">{f.eventIndex}</td>
                <td className="px-2 py-1">{f.assignedFinger}</td>
                <td className="px-2 py-1 font-mono">{f.ruleName}</td>
                <td className="px-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${severityColor(f.severity)}`}>
                    {f.severity}
                  </span>
                </td>
                <td className="px-2 py-1 text-gray-400">{f.explanation}</td>
                <td className="px-2 py-1 text-green-400">{f.betterAlternatives.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 7: Sanity Check
// ============================================================================

function SanityTab({ report }: { report: SanityCheckReport | null }) {
  if (!report) return <p className="text-gray-400 text-sm">No data.</p>;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 text-gray-300">
        Sanity Checks — {report.allPassed ? 'ALL PASSED' : `${report.errors} error(s), ${report.warnings} warning(s)`}
      </h2>
      <div className="space-y-2">
        {report.checks.map(c => (
          <div
            key={c.name}
            className={`flex items-center gap-3 p-2 rounded ${
              c.passed ? 'bg-green-950/20' : c.severity === 'error' ? 'bg-red-950/30' : 'bg-yellow-950/20'
            }`}
          >
            <span className={`text-lg ${c.passed ? 'text-green-400' : c.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
              {c.passed ? '✓' : '✕'}
            </span>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-200">{c.name}</p>
              <p className="text-xs text-gray-400">{c.message}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-gray-300">{c.actual.toFixed(1)}</p>
              <p className="text-xs text-gray-500">limit: {c.threshold.toFixed(1)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function CostBadge({ value }: { value: number }) {
  const color = value >= 100 ? 'text-red-400' : value >= 10 ? 'text-orange-400' : value >= 3 ? 'text-yellow-400' : 'text-green-400';
  return <span className={`${color}`}>{value >= 9999 ? '∞' : value.toFixed(2)}</span>;
}

function DifficultyBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Easy: 'bg-green-900/50 text-green-300',
    Medium: 'bg-yellow-900/50 text-yellow-300',
    Hard: 'bg-orange-900/50 text-orange-300',
    Unplayable: 'bg-red-900/50 text-red-300',
  };
  return <span className={`px-1.5 py-0.5 rounded text-xs ${styles[level] ?? 'text-gray-400'}`}>{level}</span>;
}

function BarRow({ label, value, warn, small }: { label: string; value: number; warn?: boolean; small?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${small ? '' : ''}`}>
      <span className={`text-xs text-gray-400 ${small ? 'w-16' : 'w-20'} text-right`}>{label}</span>
      <div className={`flex-1 ${small ? 'h-3' : 'h-5'} bg-gray-800 rounded overflow-hidden`}>
        <div
          className={`h-full transition-all rounded ${warn ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${warn ? 'text-red-400' : 'text-gray-300'} w-12`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function StatBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`p-2 rounded ${warn ? 'bg-red-950/30 border border-red-800' : 'bg-gray-800'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-mono font-bold ${warn ? 'text-red-400' : 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

function PadHeatmap({ moves }: { moves: import('../../engine/debug').MovementDistanceTimelinePoint[] }) {
  // Count hits per pad
  const hits: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (const m of moves) {
    if (m.toPad[0] >= 0 && m.toPad[0] < 8 && m.toPad[1] >= 0 && m.toPad[1] < 8) {
      hits[m.toPad[0]][m.toPad[1]]++;
    }
  }
  const maxHits = Math.max(1, ...hits.flat());

  // Display top-to-bottom (row 7 at top)
  return (
    <div className="inline-grid grid-cols-8 gap-0.5">
      {Array.from({ length: 8 }, (_, ri) => {
        const row = 7 - ri; // top-to-bottom
        return Array.from({ length: 8 }, (_, col) => {
          const count = hits[row][col];
          const intensity = count / maxHits;
          const bg = count === 0
            ? 'bg-gray-800'
            : intensity > 0.7 ? 'bg-red-600' : intensity > 0.3 ? 'bg-orange-600' : 'bg-blue-600';
          return (
            <div
              key={`${row}-${col}`}
              className={`w-8 h-8 ${bg} rounded-sm flex items-center justify-center text-xs`}
              style={{ opacity: count === 0 ? 0.3 : 0.3 + intensity * 0.7 }}
              title={`[${row},${col}]: ${count} hits`}
            >
              {count > 0 ? count : ''}
            </div>
          );
        });
      })}
    </div>
  );
}
