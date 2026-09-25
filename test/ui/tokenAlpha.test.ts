/**
 * T38 slice (S2.2b): token colours take Tailwind's opacity modifier.
 *
 * The theme mapped tokens to a bare var(), which Tailwind can't make
 * translucent, so every `bg-[var(--accent-primary)]/80`-style class compiled to
 * nothing and Save Variant rendered as a transparent button. The theme now
 * maps tokens through color-mix with <alpha-value>, and the UI uses the token
 * names (bg-accent-primary/80) instead of arbitrary var() values.
 */

import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config.js';

const ROOT = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

async function compile(files: string[]): Promise<string> {
  const result = await postcss([tailwindcss({ ...config, content: files })]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

describe('token colours take opacity modifiers (T38)', () => {
  it('maps every var() colour in the theme through <alpha-value>', () => {
    const colors = config.theme.extend.colors as Record<string, string>;
    const bare = Object.entries(colors).filter(([, v]) => v.includes('var(') && !v.includes('<alpha-value>'));
    expect(bare).toEqual([]);
  });

  it('compiles Save Variant\'s fill and border', async () => {
    // Save variant moved from the toolbar to the layout-state bar in S3.2.
    const css = await compile([path.join(ROOT, 'src/ui/components/workspace/LayoutStateBar.tsx')]);
    expect(css).toContain('.bg-accent-primary\\/80');
    expect(css).toContain('color-mix(in srgb, var(--accent-primary) calc(0.8 * 100%), transparent)');
    expect(css).toContain('.border-accent-primary\\/30');
  });

  it('leaves a token without a modifier exactly its own colour', async () => {
    const css = await compile([path.join(ROOT, 'src/ui/components/workspace/WorkspaceToolbar.tsx')]);
    // The opacity variable is 1 unless an opacity utility changes it: 100% of the token.
    expect(css).toMatch(/\.text-accent-primary-soft \{\s*--tw-text-opacity: 1;\s*color: color-mix\(in srgb, var\(--accent-primary-soft\) calc\(var\(--tw-text-opacity, 1\) \* 100%\), transparent\)/);
  });

  it('finds no arbitrary var() colour with an opacity modifier in the UI (it compiles to nothing)', () => {
    const offenders = sourceFiles(path.join(ROOT, 'src')).flatMap(file =>
      fs.readFileSync(file, 'utf8').split('\n').flatMap((line, i) =>
        /[a-z]-\[var\(--[a-z0-9-]+\)\]\/\d+/.test(line) ? [`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`] : []));
    expect(offenders).toEqual([]);
  });
});
