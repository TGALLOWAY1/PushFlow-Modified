#!/usr/bin/env node
// Fails if the e2e-only window.__pf test hook leaked into the production build.
// Run after `npm run build` (CI and deploy do this). Roadmap P0 exit criterion P0-7.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const hits = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html|map)$/.test(name) && readFileSync(p, 'utf8').includes('__pf')) hits.push(p);
  }
};
walk(root);
if (hits.length) {
  console.error(`window.__pf test hook found in production build:\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: no window.__pf in ${root}/`);
