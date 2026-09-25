/**
 * P2-9 (S2.2b, T20): every factor label and colour comes from FACTOR_META.
 *
 * A grep over the UI source: no second name for a factor ("Grip Quality",
 * "Repetition", "Hand Balance" …), no hand-written factor label list
 * (`label: 'Movement'`, `['Grip', …]`), and in the surfaces that draw factors,
 * no hard-coded factor colour. factorMeta.ts is the one place these live.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { FACTOR_KEYS, FACTOR_META } from '../../../src/ui/analysis/factorMeta';

const SRC_UI = path.resolve(__dirname, '../../../src/ui');
const SRC_TYPES = path.resolve(__dirname, '../../../src/types');

/**
 * Not product surfaces for this rule: the developer routes (kept as they are,
 * roadmap "the trace and debug routes stay"), and the preset inspector, whose
 * pad-position metrics S8.2 replaces with canonical evaluation (T21).
 */
const EXCLUDED = [
  'analysis/factorMeta.ts',
  'temporal/',
  'validator/',
  'pages/OptimizerDebugPage.tsx',
  'pages/ConstraintValidatorPage.tsx',
  'pages/TemporalEvaluatorPage.tsx',
  'components/composer/PresetInspector.tsx',
];

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const uiFiles = sourceFiles(SRC_UI).filter(f => {
  const rel = path.relative(SRC_UI, f).split(path.sep).join('/');
  return !EXCLUDED.some(ex => rel === ex || rel.startsWith(ex));
});

/** Other names the five factors used to go by. */
const ALIASES = [
  'Grip Quality', 'Stretch', 'Finger Pref', 'Movement Cost', 'Transition Cost', 'Transitions',
  'Repetition', 'Finger Repetition', 'Hand Balance', 'Hard Constraints', 'Balance',
];

const CANONICAL = FACTOR_KEYS.map(k => FACTOR_META[k].label);

function hits(pattern: RegExp, files: string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (pattern.test(line)) found.push(`${path.relative(SRC_UI, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  return found;
}

const quoted = (names: string[]) => names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

describe('FACTOR_META is the only source of factor names and colours (P2-9)', () => {
  it('finds no other name for a factor in the UI or the types', () => {
    const typeFiles = sourceFiles(SRC_TYPES);
    const alias = new RegExp(`['"\`>](${quoted(ALIASES)})['"\`<]`);
    expect(hits(alias, [...uiFiles, ...typeFiles])).toEqual([]);
  });

  it('finds no hand-written list of factor labels', () => {
    const list = new RegExp(`(label|name):\\s*['"](${quoted(CANONICAL)})['"]|\\[\\s*['"](${quoted(CANONICAL)})['"]\\s*,`);
    // Learn More's "Constraints" tab is named for the Constraints section, not the factor.
    const allowed = (hit: string) => hit.includes("id: 'constraints' as const, label: 'Constraints'");
    expect(hits(list, uiFiles).filter(h => !allowed(h))).toEqual([]);
  });

  it('draws factors only in FACTOR_META colours on the surfaces that show them', () => {
    const surfaces = [
      'components/panels/CostBreakdownBars.tsx',
      'components/panels/EventCostChart.tsx',
      'components/EventsPanel.tsx',
      'components/panels/SettingsGear.tsx',
      'components/CandidateCompare.tsx',
      'components/panels/CompareModal.tsx',
      'components/panels/PerformanceCostsPanel.tsx',
      'components/panels/SelectedEventCard.tsx',
    ].map(f => path.join(SRC_UI, f));
    // The --factor-* token values, written out by hand.
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/index.css'), 'utf8');
    const factorHexes = [...css.matchAll(/--factor-[a-z]+:\s*(#[0-9a-fA-F]{6})/g)].map(m => m[1]!);
    expect(factorHexes).toHaveLength(5);
    expect(hits(new RegExp(factorHexes.join('|'), 'i'), surfaces)).toEqual([]);
  });

  it('every FACTOR_META colour is a --factor-* token', () => {
    for (const key of FACTOR_KEYS) expect(FACTOR_META[key].color).toMatch(/^var\(--factor-[a-z]+\)$/);
  });
});
