/**
 * MiniGridPreview.
 *
 * Compact 8x8 grid visualization for candidate layout previews.
 * Shows voice placement with color coding.
 */

import { type Layout } from '../../../types/layout';
import { type SoundStream } from '../../state/projectState';
import { buildSoundStreamLookup } from '../../analysis/soundStreamLookup';

interface MiniGridPreviewProps {
  layout: Layout;
  soundStreams: SoundStream[];
  /** Optional size multiplier (default 1) */
  size?: number;
  /** Whether this card has a border highlight */
  highlighted?: boolean;
}

export function MiniGridPreview({ layout, soundStreams, size = 1, highlighted = false }: MiniGridPreviewProps) {
  const cellSize = Math.round(18 * size);
  const gap = 1;
  const gridSize = cellSize * 8 + gap * 7;
  const soundStreamLookup = buildSoundStreamLookup(soundStreams);

  return (
    <div
      className={`rounded-lg overflow-hidden border ${
        highlighted ? 'border-blue-500/50' : 'border-gray-700/50'
      }`}
      style={{
        width: gridSize + 4,
        height: gridSize + 4,
        padding: 2,
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows: `repeat(8, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
      >
        {/* Row 7 at top, row 0 at bottom (Push orientation) */}
        {Array.from({ length: 64 }, (_, i) => {
          const row = 7 - Math.floor(i / 8);
          const col = i % 8;
          const padKey = `${row},${col}`;
          const voice = layout.padToVoice[padKey];
          const stream = soundStreamLookup.forVoice(voice);
          const color = stream?.color ?? voice?.color ?? '#4b5563';

          return (
            <div
              key={padKey}
              className="rounded-sm"
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: color ?? 'rgba(31, 41, 55, 0.5)',
                opacity: voice ? 0.85 : 0.3,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
