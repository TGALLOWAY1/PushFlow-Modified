/**
 * DifficultyHeatmap Component.
 *
 * Visualizes passage-level difficulty as a horizontal bar chart.
 */

import { type DifficultyAnalysis } from '../../types/candidateSolution';

interface DifficultyHeatmapProps {
  analysis: DifficultyAnalysis;
}

function scoreColor(score: number): string {
  if (score <= 0.2) return '#22c55e';  // green - Easy
  if (score <= 0.45) return '#eab308'; // yellow - Moderate
  if (score <= 0.7) return '#f97316';  // orange - Hard
  return '#ef4444';                     // red - Extreme
}

function scoreLabel(score: number): string {
  if (score <= 0.2) return 'Easy';
  if (score <= 0.45) return 'Moderate';
  if (score <= 0.7) return 'Hard';
  return 'Extreme';
}

export function DifficultyHeatmap({ analysis }: DifficultyHeatmapProps) {
  const { overallScore, passages, bindingConstraints } = analysis;

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Overall:</span>
        <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full rounded transition-all duration-300"
            style={{
              width: `${Math.max(overallScore * 100, 2)}%`,
              backgroundColor: scoreColor(overallScore),
            }}
          />
        </div>
        <span className="text-sm font-mono" style={{ color: scoreColor(overallScore) }}>
          {(overallScore * 100).toFixed(0)}% {scoreLabel(overallScore)}
        </span>
      </div>

      {/* Per-passage bars */}
      {passages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-gray-500">Passages</span>
          {passages.map((p, i) => (
            <div key={p.section.id ?? i} className="group">
              <div className="flex items-center gap-2">
                <span className="w-24 text-[11px] text-gray-400 truncate" title={p.section.name}>
                  {p.section.name}
                </span>
                <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${Math.max(p.score * 100, 1)}%`,
                      backgroundColor: scoreColor(p.score),
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono w-10 text-right" style={{ color: scoreColor(p.score) }}>
                  {(p.score * 100).toFixed(0)}%
                </span>
              </div>
              {/* Dominant factors on hover */}
              {p.dominantFactors.length > 0 && (
                <div className="hidden group-hover:flex gap-2 ml-24 mt-0.5 text-[10px] text-gray-500">
                  {p.dominantFactors.map((f, fi) => (
                    <span key={fi}>{f.factor}: {(f.contribution * 100).toFixed(0)}%</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Binding constraints */}
      {bindingConstraints.length > 0 && (
        <div className="space-y-1 mt-2">
          <span className="text-xs text-gray-500">Constraints</span>
          {bindingConstraints.map((c, i) => (
            <div key={i} className="text-[11px] text-amber-400/80 pl-2 border-l border-amber-400/30">
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
