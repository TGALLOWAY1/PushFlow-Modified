/**
 * ImprovementBadge.
 *
 * Small pill badge showing a 1-100 improvement score.
 * Color interpolates from red (low) through yellow to green (high).
 */

import chroma from 'chroma-js';

interface ImprovementBadgeProps {
  score: number;
}

const scale = chroma.scale(['#ef4444', '#eab308', '#22c55e']).mode('lab');

export function ImprovementBadge({ score }: ImprovementBadgeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = scale(clamped / 100).hex();
  const bgColor = scale(clamped / 100).alpha(0.15).css();

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{ backgroundColor: bgColor, color }}
    >
      {clamped}
    </span>
  );
}
