/**
 * The count-in over the grid (S4.3b, T59): while the transport counts in, the
 * beat of the bar (1-2-3-4) large over the pads, readable from the Push, and
 * which bar of the count-in it is. It takes no pointer events, so the pads
 * stay live; the grid under it shows the strikes the music starts with.
 */

import { useCountIn } from '../audio/TransportProvider';
import { BEATS_PER_BAR } from '../audio/transportMath';

export function CountInOverlay({ width, height, padSize, offsetX = 0 }: {
  /** The pads' area, and how far from the frame's left edge it starts. */
  width: number;
  height: number;
  padSize: number;
  offsetX?: number;
}) {
  const countIn = useCountIn();
  if (!countIn) return null;
  const beat = (countIn.beat % BEATS_PER_BAR) + 1;
  const bar = Math.floor(countIn.beat / BEATS_PER_BAR) + 1;
  const bars = Math.max(1, Math.round(countIn.beats / BEATS_PER_BAR));
  return (
    <div
      data-testid="count-in"
      data-beat={beat}
      data-bar={bar}
      className="absolute top-0 z-40 flex flex-col items-center justify-center pointer-events-none"
      style={{ left: offsetX, width, height }}
    >
      <span
        data-testid="count-in-beat"
        aria-hidden="true"
        className="font-bold tabular-nums leading-none text-[var(--text-primary)]"
        style={{ fontSize: Math.round(padSize * 2.2), textShadow: '0 2px 16px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.9)' }}
      >
        {beat}
      </span>
      <span role="status" className="mt-1 px-2 py-0.5 rounded-pf-sm bg-black/70 text-pf-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">
        Count-in{bars > 1 ? ` · bar ${bar} of ${bars}` : ''}
      </span>
    </div>
  );
}
