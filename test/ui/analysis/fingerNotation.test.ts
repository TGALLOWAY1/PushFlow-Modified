/**
 * S4.2 · one finger notation and the hand tokens (T42 part).
 *
 * Every finger reads L1–R5 with its name in the tooltip, from one module
 * (src/utils/fingerNotation.ts); hands are coloured by the --hand-left and
 * --hand-right tokens. The grep half keeps it that way: no product surface
 * keeps its own finger-number map, two-letter finger codes or hand hexes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { fingerLabel, fingerName, handColor, noteFinger } from '../../../src/utils/fingerNotation';
import { formatFingerConstraint, parseFingerConstraint } from '../../../src/utils/fingerConstraints';
import { fingerAssignmentLabel } from '../../../src/ui/components/shared/FingerAssignmentInput';

describe('the finger notation', () => {
  it('writes a finger as its hand letter and number, and names it', () => {
    expect(fingerLabel('left', 'thumb')).toBe('L1');
    expect(fingerLabel('right', 'pinky')).toBe('R5');
    expect(fingerName('left', 'index')).toBe('Left index finger');
    expect(fingerName('right', 'thumb')).toBe('Right thumb');
  });

  it('writes nothing for a note no hand or finger plays', () => {
    expect(fingerLabel('Unplayable', 'index')).toBe('');
    expect(fingerLabel('left', null)).toBe('');
    expect(fingerLabel('raw', 'unassigned')).toBe('');
    expect(noteFinger({ assignedHand: 'Unplayable', finger: null })).toBeNull();
    expect(noteFinger({ assignedHand: 'right', finger: 'ring' })).toEqual({
      hand: 'right', finger: 'ring', label: 'R4', name: 'Right ring finger',
    });
  });

  it('colours hands with their tokens', () => {
    expect(handColor('left')).toBe('var(--hand-left)');
    expect(handColor('right')).toBe('var(--hand-right)');
    expect(handColor('Unplayable')).toBeNull();
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8');
    expect(css).toMatch(/--hand-left:\s*#[0-9a-f]{6}/i);
    expect(css).toMatch(/--hand-right:\s*#[0-9a-f]{6}/i);
  });

  it('is the notation the stored preferences and the finger field use', () => {
    expect(formatFingerConstraint('left', 'middle')).toBe('L3');
    expect(parseFingerConstraint(formatFingerConstraint('right', 'ring'))).toEqual({ hand: 'right', finger: 'ring' });
    expect(fingerAssignmentLabel({ hand: 'right', finger: 'index' })).toBe('R2');
  });
});

describe('no surface keeps its own finger notation or hand colours (T42)', () => {
  const SRC_UI = path.resolve(__dirname, '../../../src/ui');
  // The developer routes stay as they are (roadmap: the trace and debug routes stay).
  const EXCLUDED = ['temporal/', 'validator/', 'pages/OptimizerDebugPage.tsx', 'pages/ConstraintValidatorPage.tsx', 'pages/TemporalEvaluatorPage.tsx'];

  function files(root: string): string[] {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) return files(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }

  const uiFiles = files(SRC_UI).filter(f => {
    const rel = path.relative(SRC_UI, f).split(path.sep).join('/');
    return !EXCLUDED.some(ex => rel.startsWith(ex));
  });

  function hits(pattern: RegExp): string[] {
    return uiFiles.flatMap(file => fs.readFileSync(file, 'utf8').split('\n')
      .map((line, i) => (pattern.test(line) ? `${path.relative(SRC_UI, file)}:${i + 1}: ${line.trim()}` : null))
      .filter((hit): hit is string => hit !== null));
  }

  it('finds no finger-number map or two-letter finger codes', () => {
    expect(hits(/thumb:\s*['"]1['"]|finger\.slice\(0,\s*2\)\.toUpperCase\(\)/)).toEqual([]);
  });

  it('finds no hand colour written as a hex', () => {
    expect(hits(/#0088ff|#ff4400/i)).toEqual([]);
  });
});
