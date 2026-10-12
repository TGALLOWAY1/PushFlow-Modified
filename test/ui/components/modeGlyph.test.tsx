// @vitest-environment happy-dom
/**
 * S9.0 · ModeGlyph (P9-0b): five distinct shapes at the Route's three sizes.
 *
 * Shape carries a Push mode's meaning, not colour, so no two modes may share
 * a shape at any size, and the glyph takes its colour from the text around it.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModeGlyph } from '../../../src/ui/components/shared/ModeGlyph';
import { PUSH_MODES, PUSH_MODE_LABELS } from '../../../src/types/performanceRoute';

describe('ModeGlyph', () => {
  it.each([9, 10, 28])('P9-0b: renders five distinct shapes at %i px', size => {
    const shapes = PUSH_MODES.map(mode => {
      const { container, unmount } = render(<ModeGlyph mode={mode} size={size} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe(String(size));
      expect(svg.getAttribute('height')).toBe(String(size));
      expect(svg.getAttribute('data-mode')).toBe(mode);
      expect(svg.children.length).toBeGreaterThan(0);
      const shape = svg.innerHTML;
      unmount();
      return shape;
    });
    expect(new Set(shapes).size).toBe(5);
  });

  it('is drawn in the surrounding colour, never a fixed one', () => {
    for (const mode of PUSH_MODES) {
      const { container, unmount } = render(<ModeGlyph mode={mode} />);
      const colours = [...container.querySelectorAll('[fill], [stroke]')]
        .flatMap(el => [el.getAttribute('fill'), el.getAttribute('stroke')])
        .filter((c): c is string => !!c && c !== 'none');
      expect(colours.every(c => c === 'currentColor'), mode).toBe(true);
      unmount();
    }
  });

  it('is decorative by default, and names the mode when labelled', () => {
    const { container, getByRole } = render(
      <>
        <ModeGlyph mode="drum" />
        <ModeGlyph mode="fx" label />
      </>,
    );
    expect(container.querySelector('[data-mode="drum"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(getByRole('img').getAttribute('aria-label')).toBe(PUSH_MODE_LABELS.fx);
  });
});
