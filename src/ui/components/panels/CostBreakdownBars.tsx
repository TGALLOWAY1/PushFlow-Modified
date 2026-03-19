/**
 * CostBreakdownBars.
 *
 * Horizontal bar display of aggregate cost by category.
 * Shows total values with colored progress bars.
 */

import { type V1CostBreakdown } from '../../../types/diagnostics';

interface CostBreakdownBarsProps {
  metrics: V1CostBreakdown;
}

interface CostRow {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}

export function CostBreakdownBars({ metrics }: CostBreakdownBarsProps) {
  const rows: CostRow[] = [
    {
      label: 'Stretch',
      value: metrics.fingerPreference + metrics.handShapeDeviation,
      color: '#a855f7',
      tooltip: 'Grip shape deviation + finger preference cost',
    },
    {
      label: 'Movement',
      value: metrics.transitionCost,
      color: '#f97316',
      tooltip: 'Fitts\'s Law transition cost between events',
    },
    {
      label: 'Speed',
      value: metrics.constraintPenalty,
      color: '#22c55e',
      tooltip: 'Hard constraint penalty from speed or reach violations',
    },
    {
      label: 'Repetition',
      value: metrics.handBalance,
      color: '#3b82f6',
      tooltip: 'Hand balance / repetition penalty',
    },
  ];

  const maxValue = Math.max(...rows.map(r => r.value), 0.01);

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
        Cost Breakdown
      </h4>
      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2 group" title={row.tooltip}>
            <div className="flex items-center gap-1.5 w-20">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-[11px] text-gray-400">{row.label}</span>
            </div>
            <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${Math.max((row.value / maxValue) * 100, row.value > 0 ? 2 : 0)}%`,
                  backgroundColor: row.color,
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="text-[11px] text-gray-500 font-mono w-10 text-right">
              {row.value > 0 ? row.value.toFixed(0) : '0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
