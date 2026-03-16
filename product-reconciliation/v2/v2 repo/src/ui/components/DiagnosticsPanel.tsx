/**
 * DiagnosticsPanel.
 *
 * Shows fatigue map, hand balance, spatial stats from the current analysis.
 */

import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { DifficultyHeatmap } from './DifficultyHeatmap';

export function DiagnosticsPanel() {
  const { state } = useProject();
  const result = state.analysisResult;

  if (!result) {
    return (
      <div className="text-xs text-gray-500 py-2 text-center">
        No analysis available.
      </div>
    );
  }

  const { executionPlan } = result;

  // Hand balance
  const handStats = useMemo(() => {
    let left = 0, right = 0, unplayable = 0;
    for (const a of executionPlan.fingerAssignments) {
      if (a.assignedHand === 'left') left++;
      else if (a.assignedHand === 'right') right++;
      else unplayable++;
    }
    const total = left + right + unplayable;
    return { left, right, unplayable, total };
  }, [executionPlan.fingerAssignments]);

  // Top fatigue entries
  const topFatigue = useMemo(() =>
    Object.entries(executionPlan.fatigueMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6),
    [executionPlan.fatigueMap]
  );

  const balanceRatio = handStats.total > 0
    ? handStats.left / (handStats.left + handStats.right || 1)
    : 0.5;

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-gray-800 pb-4">
        <h4 className="text-xs text-gray-400 font-medium tracking-wide uppercase">Analysis</h4>
        <DifficultyHeatmap analysis={result.difficultyAnalysis} />

        {/* Score stats */}
        <div className="flex gap-2 text-[11px] pt-1">
          <StatBadge
            label="Score"
            value={executionPlan.score.toFixed(1)}
            tooltip="Total execution cost (lower is better). <5 easy, 5-15 moderate, >15 difficult"
            quality={executionPlan.score < 5 ? 'good' : executionPlan.score < 15 ? 'ok' : 'bad'}
          />
          <StatBadge
            label="Drift"
            value={executionPlan.averageDrift.toFixed(2)}
            tooltip="Avg hand movement per event (lower = more compact). <0.5 compact, >1.0 spread out"
            quality={executionPlan.averageDrift < 0.5 ? 'good' : executionPlan.averageDrift < 1.0 ? 'ok' : 'bad'}
          />
          <StatBadge
            label="Hard"
            value={String(executionPlan.hardCount)}
            warn={executionPlan.hardCount > 0}
            tooltip="Events requiring difficult reaches or fast hand switches. Zero is ideal"
          />
        </div>

        {/* Finger usage */}
        <div className="space-y-1 pt-1">
          <span className="text-[10px] text-gray-500">Finger Usage</span>
          <div className="flex flex-wrap gap-1 text-[10px] text-gray-400">
            {Object.entries(executionPlan.fingerUsageStats).map(([finger, count]) => (
              <span key={finger} className="bg-gray-800/80 px-1.5 py-0.5 rounded flex items-center gap-1 border border-gray-700/50">
                {finger}: <span className="text-gray-200">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs text-gray-400 font-medium tracking-wide uppercase">Diagnostics</h4>

        {/* Hand balance */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-500 cursor-help" title="Distribution of events between left and right hands. A balanced split (40-60%) is usually ideal.">Hand Balance</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-blue-400 w-6 text-right">{handStats.left}</span>
          <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden flex">
            <div
              className="h-full bg-blue-500/60"
              style={{ width: `${balanceRatio * 100}%` }}
            />
            <div
              className="h-full bg-purple-500/60"
              style={{ width: `${(1 - balanceRatio) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-purple-400 w-6">{handStats.right}</span>
        </div>
        {handStats.unplayable > 0 && (
          <span className="text-[10px] text-red-400">
            {handStats.unplayable} unplayable
          </span>
        )}
      </div>

      {/* Score summary */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <DiagnosticItem label="Total Score" value={executionPlan.score.toFixed(1)} tooltip="Sum of all event costs. Lower is better. <5 easy, 5-15 moderate, >15 difficult." />
        <DiagnosticItem label="Avg Drift" value={executionPlan.averageDrift.toFixed(3)} tooltip="Average hand displacement per event. <0.5 = compact layout, >1.0 = too spread out." />
        <DiagnosticItem label="Hard Events" value={String(executionPlan.hardCount)} warn={executionPlan.hardCount > 0} tooltip="Events where the finger assignment is strained — big reaches, fast switches, or awkward grips." />
        <DiagnosticItem label="Unplayable" value={String(executionPlan.unplayableCount)} warn={executionPlan.unplayableCount > 0} tooltip="Events that cannot be physically played — no valid finger assignment exists." />
      </div>

      {/* Average metrics */}
      <div className="space-y-1">
        <span className="text-[10px] text-gray-500 cursor-help" title="Average cost per event, broken down by factor. Lower is better for each.">Avg Cost Breakdown</span>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <MetricBar label="Move" value={executionPlan.averageMetrics.movement} tooltip="Distance fingers travel between events" />
          <MetricBar label="Stretch" value={executionPlan.averageMetrics.stretch} tooltip="How far fingers spread within a single grip" />
          <MetricBar label="Drift" value={executionPlan.averageMetrics.drift} tooltip="Hand center displacement from resting position" />
          <MetricBar label="Bounce" value={executionPlan.averageMetrics.bounce} tooltip="Same-finger repeated use without alternation" />
          <MetricBar label="Fatigue" value={executionPlan.averageMetrics.fatigue} tooltip="Accumulated finger workload over time" />
          <MetricBar label="Cross" value={executionPlan.averageMetrics.crossover} tooltip="Hands crossing over each other's zone" />
        </div>
      </div>

      {/* Fatigue */}
      {topFatigue.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 cursor-help" title="Accumulated workload per finger. >1.0 means that finger is overworked — consider redistributing.">Finger Fatigue</span>
          <div className="space-y-0.5">
            {topFatigue.map(([finger, fatigue]) => (
              <div key={finger} className="flex items-center gap-1 text-[10px]">
                <span className="text-gray-400 w-12 truncate">{finger}</span>
                <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.min(fatigue * 50, 100)}%`,
                      backgroundColor: fatigue > 1 ? '#ef4444' : fatigue > 0.5 ? '#f97316' : '#22c55e',
                    }}
                  />
                </div>
                <span className="text-gray-500 w-8 text-right">{fatigue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Actionable suggestions */}
      <ActionableSuggestions
        metrics={executionPlan.averageMetrics}
        balanceRatio={balanceRatio}
        topFatigue={topFatigue}
        unplayableCount={executionPlan.unplayableCount}
        hardCount={executionPlan.hardCount}
      />
    </div>
    </div>
  );
}

function ActionableSuggestions({ metrics, balanceRatio, topFatigue, unplayableCount, hardCount }: {
  metrics: { movement: number; stretch: number; drift: number; bounce: number; fatigue: number; crossover: number };
  balanceRatio: number;
  topFatigue: [string, number][];
  unplayableCount: number;
  hardCount: number;
}) {
  const suggestions: { text: string; severity: 'error' | 'warn' | 'info' }[] = [];

  if (unplayableCount > 0) {
    suggestions.push({ text: `${unplayableCount} event${unplayableCount > 1 ? 's' : ''} cannot be played. Move sounds closer together or split across hands.`, severity: 'error' });
  }
  if (metrics.movement > 1.0) {
    suggestions.push({ text: 'High movement cost — sounds that play in sequence are too far apart. Group frequently alternating sounds on adjacent pads.', severity: 'warn' });
  }
  if (metrics.stretch > 0.8) {
    suggestions.push({ text: 'High stretch — simultaneous sounds require a wide finger spread. Move chords closer together.', severity: 'warn' });
  }
  if (metrics.crossover > 0.5) {
    suggestions.push({ text: 'Frequent hand crossover — sounds are not well-separated by hand zone. Move left-hand sounds to columns 0-3 and right-hand sounds to columns 4-7.', severity: 'warn' });
  }
  if (balanceRatio < 0.2 || balanceRatio > 0.8) {
    const heavy = balanceRatio < 0.2 ? 'right' : 'left';
    suggestions.push({ text: `${heavy} hand is doing most of the work. Redistribute some sounds to the other hand zone.`, severity: 'warn' });
  }
  if (metrics.bounce > 0.6) {
    suggestions.push({ text: 'Same finger used repeatedly — consider spreading hits across multiple fingers by adjusting pad positions.', severity: 'info' });
  }
  if (metrics.drift > 0.8) {
    suggestions.push({ text: 'High drift — hand center moves a lot. Cluster frequently-used sounds closer to each hand\'s resting position.', severity: 'info' });
  }
  const overworkedFingers = topFatigue.filter(([, f]) => f > 1.0);
  if (overworkedFingers.length > 0) {
    suggestions.push({ text: `${overworkedFingers.map(([f]) => f).join(', ')} overworked. Pin some events to other fingers using pad constraints.`, severity: 'info' });
  }
  if (hardCount > 0 && suggestions.length === 0) {
    suggestions.push({ text: `${hardCount} hard event${hardCount > 1 ? 's' : ''}. Try Generate to explore alternative layouts.`, severity: 'info' });
  }

  if (suggestions.length === 0) return null;

  const severityStyles = {
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
    warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-gray-500">Suggestions</span>
      {suggestions.slice(0, 3).map((s, i) => (
        <div key={i} className={`text-[10px] px-2 py-1.5 rounded border ${severityStyles[s.severity]}`}>
          {s.text}
        </div>
      ))}
    </div>
  );
}

function DiagnosticItem({ label, value, warn, tooltip }: { label: string; value: string; warn?: boolean; tooltip?: string }) {
  return (
    <div
      className={`px-2 py-1 rounded border text-center ${
        warn ? 'border-amber-500/30 bg-amber-500/10' : 'border-gray-700 bg-gray-800/50'
      } ${tooltip ? 'cursor-help' : ''}`}
      title={tooltip}
    >
      <div className="text-[9px] text-gray-500">{label}</div>
      <div className={`font-mono ${warn ? 'text-amber-400' : 'text-gray-300'}`}>{value}</div>
    </div>
  );
}

function MetricBar({ label, value, tooltip }: { label: string; value: number; tooltip?: string }) {
  // Dynamic max: scale to nearest meaningful ceiling so bars are readable
  const effectiveMax = Math.max(value * 1.5, 0.5);
  const pct = Math.min((value / effectiveMax) * 100, 100);
  const severity = value > 1.0 ? 'high' : value > 0.4 ? 'medium' : 'low';
  const barColor = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#22c55e';
  const severityLabel = severity === 'high' ? 'High' : severity === 'medium' ? 'Moderate' : 'Low';

  return (
    <div className={`space-y-0.5 ${tooltip ? 'cursor-help' : ''}`} title={tooltip ? `${tooltip} (${severityLabel}: ${value.toFixed(2)})` : undefined}>
      <div className="flex justify-between text-gray-500">
        <span>{label}</span>
        <span className={severity === 'high' ? 'text-red-400' : severity === 'medium' ? 'text-orange-400' : 'text-gray-500'}>{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

const QUALITY_STYLES = {
  good: { border: 'border-green-500/30', bg: 'bg-green-500/10', dot: 'bg-green-400' },
  ok: { border: 'border-gray-700', bg: 'bg-gray-800/50', dot: 'bg-yellow-400' },
  bad: { border: 'border-red-500/30', bg: 'bg-red-500/10', dot: 'bg-red-400' },
} as const;

function StatBadge({ label, value, warn, tooltip, quality }: {
  label: string; value: string; warn?: boolean; tooltip?: string;
  quality?: 'good' | 'ok' | 'bad';
}) {
  const qStyle = quality ? QUALITY_STYLES[quality] : null;
  const borderClass = warn ? 'border-amber-500/30' : qStyle?.border ?? 'border-gray-700';
  const bgClass = warn ? 'bg-amber-500/10' : qStyle?.bg ?? 'bg-gray-800/50';

  return (
    <div
      className={`px-2 py-1 rounded border text-[11px] ${borderClass} ${bgClass} cursor-help`}
      title={tooltip}
    >
      <span className="text-[9px] text-gray-500 uppercase mr-1">{label}</span>
      {quality && <span className={`inline-block w-1.5 h-1.5 rounded-full ${qStyle!.dot} mr-1 align-middle`} />}
      <span className={`font-mono ${warn ? 'text-amber-400' : 'text-gray-200'}`}>{value}</span>
    </div>
  );
}
