/**
 * ModeGlyph (S9.0): the shape for a Push mode, wherever the Performance Route
 * shows one (mode strip, badge, pills, picker). Shape carries the meaning and
 * colour only repeats it, so every mode reads apart at 9 px without colour:
 *
 * - Session View: three clip rows
 * - Instrument: a keyboard (outlined, with key lines)
 * - Drum Rack: four pads (round)
 * - FX / Device: a knob (ring with a pointer)
 * - Control: a button press (diamond)
 *
 * Drawn in currentColor on a 12-unit grid; decorative unless `label` is set.
 * The shapes are this repo's; check them against the Performance Route
 * mockup when S9.2 builds the strip.
 */

import { type PushMode, PUSH_MODE_LABELS } from '../../../types/performanceRoute';

const SHAPES: Record<PushMode, JSX.Element> = {
  session: (
    <>
      <rect x="1" y="1.5" width="10" height="2.5" rx="0.75" />
      <rect x="1" y="4.75" width="10" height="2.5" rx="0.75" />
      <rect x="1" y="8" width="10" height="2.5" rx="0.75" />
    </>
  ),
  instrument: (
    <>
      <rect x="1.25" y="1.25" width="9.5" height="9.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 1.5v9M7.5 1.5v9" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </>
  ),
  drum: (
    <>
      <circle cx="3.5" cy="3.5" r="2.25" />
      <circle cx="8.5" cy="3.5" r="2.25" />
      <circle cx="3.5" cy="8.5" r="2.25" />
      <circle cx="8.5" cy="8.5" r="2.25" />
    </>
  ),
  fx: (
    <>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6L8.6 2.9" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  control: <path d="M6 0.75L11.25 6L6 11.25L0.75 6Z" />,
};

export function ModeGlyph({ mode, size = 10, label = false, className }: {
  mode: PushMode;
  /** Width and height in px. The Route uses 9 (narrow spans), 10 (pills) and 28 (picker). */
  size?: number;
  /** Announce the mode's name; otherwise the glyph is decorative next to its text. */
  label?: boolean;
  className?: string;
}) {
  return (
    <svg
      data-mode={mode}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="currentColor"
      className={className}
      {...(label ? { role: 'img', 'aria-label': PUSH_MODE_LABELS[mode] } : { 'aria-hidden': true })}
    >
      {SHAPES[mode]}
    </svg>
  );
}
