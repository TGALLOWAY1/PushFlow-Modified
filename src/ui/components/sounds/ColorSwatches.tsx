/**
 * The Sound colours as a row of named swatches (S5.1): the Sounds row's menu,
 * the selection bar and a group's header pick from the same 16-hue palette
 * new Sounds get (utils/soundPalette.ts), each swatch named for assistive tech.
 */

import { SOUND_PALETTE, SOUND_PALETTE_NAMES } from '../../../utils/soundPalette';

export function ColorSwatches({ value, onPick, testId = 'color-swatches' }: {
  /** The colour now, marked as chosen. */
  value?: string | null;
  onPick: (color: string) => void;
  testId?: string;
}) {
  const current = value?.toUpperCase();
  return (
    <div role="group" aria-label="Colour" data-testid={testId} className="grid grid-cols-8 gap-1">
      {SOUND_PALETTE.map((color, i) => {
        const chosen = color.toUpperCase() === current;
        return (
          <button
            key={color}
            type="button"
            aria-label={SOUND_PALETTE_NAMES[i]}
            aria-pressed={chosen}
            title={SOUND_PALETTE_NAMES[i]}
            data-color={color}
            className={`focus-ring w-6 h-6 rounded-pf-sm border transition-transform hover:scale-110 ${chosen ? 'border-white ring-1 ring-white' : 'border-black/20'}`}
            style={{ backgroundColor: color }}
            onClick={() => onPick(color)}
          />
        );
      })}
    </div>
  );
}
