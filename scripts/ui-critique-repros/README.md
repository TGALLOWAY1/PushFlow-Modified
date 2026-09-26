# UI critique reproduction scripts

Playwright probes written during the September 2026 UI critique
([docs/product/UI_CORE_FLOWS_CRITIQUE.md](../../docs/product/UI_CORE_FLOWS_CRITIQUE.md)).
Each `C*` folder independently reproduced one of the nine critical problems listed in
[docs/product/UI_ISSUE_REGISTER.md](../../docs/product/UI_ISSUE_REGISTER.md#critical-problems-independent-reproduction).
`capture-flows.mjs` is the walkthrough that produced the flow screenshots at 1600×1000 and 1366×768;
the roadmap's final re-critique prompt runs it again.

These are exploratory probes, not tests. Roadmap phase P0 turned each one into an expected-fail
spec under `test/e2e/`, and the PR that fixes a bug flips its spec to passing. A probe stays here
until its spec passes, so work starts from the exact reproduction steps; then it is retired.
C1–C8 were retired on 2026-09-26 and can be restored from commit `fa04025f`
(see [docs/ARCHIVE.md](../../docs/ARCHIVE.md)).

| Folder | Problem | Theme | Spec | Probe |
|--------|---------|-------|------|-------|
| C1 | Pad right-click menu renders off-cursor / off-screen | T06 | `c1-pad-menu.spec.ts` passes | retired |
| C2 | Generate / Preview overwrite the Working/Test Layout | T01 | `c2-draft-overwrite.spec.ts` passes | retired |
| C3 | Beam & Annealing ignore and delete placement locks | T11 | `c3-locks.spec.ts` passes | retired |
| C4 | Undo unreliable (analysis results fill the history) | T02 | `c4-undo.spec.ts` passes | retired |
| C5 | Onion skin has no visible effect | T09 | `c5-onion-skin.spec.ts` passes | retired |
| C6 | Selecting an event shows a false "Feasible" verdict | T07 | `c6-false-feasible.spec.ts` passes | retired |
| C7 | Compare shows the Active Layout as empty / zero-scored | T08 | `c7-compare.spec.ts` passes | retired |
| C8 | A selected event freezes the grid during playback | T10 | `c8-selection-playback.spec.ts` passes | retired |
| C9 | Dropping a Composer preset on the grid does nothing | T65 | `c9-presets.spec.ts` still expected-fail | `C9/` |

## Running one

```bash
npm run dev                      # in another terminal (http://localhost:5173)
node scripts/ui-critique-repros/C9/probe.mjs
```

Run from the repository root. Screenshots, logs and JSON results go to `.ui-repro-out/` (git-ignored).

- `URL` overrides the dev-server address (default `http://localhost:5173`).
- `W` / `H` set the viewport (most scripts default to 1600×1000).
- `PW_CHROMIUM` points at a Chromium binary if Playwright's bundled browser isn't installed.

Some scripts read further variables such as `SCEN` or `METHOD`; see the top of each file.
