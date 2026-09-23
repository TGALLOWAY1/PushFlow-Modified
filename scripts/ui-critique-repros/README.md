# UI critique reproduction scripts

Playwright probes written during the September 2026 UI critique
([docs/product/UI_CORE_FLOWS_CRITIQUE.md](../../docs/product/UI_CORE_FLOWS_CRITIQUE.md)).
Each `C*` folder independently reproduces one of the nine critical problems listed in
[docs/product/UI_ISSUE_REGISTER.md](../../docs/product/UI_ISSUE_REGISTER.md#critical-problems-independent-reproduction).
`capture-flows.mjs` is the walkthrough that produced the flow screenshots at 1600×1000 and 1366×768.

These are exploratory probes, not tests. Roadmap phase P0 turns each one into an expected-fail
spec under `test/e2e/`, and the PR that fixes the bug flips it to passing. They are kept here so that
work starts from the exact reproduction steps.

| Folder | Problem | Theme |
|--------|---------|-------|
| C1 | Pad right-click menu renders off-cursor / off-screen | T06 |
| C2 | Generate / Preview overwrite the Working/Test Layout | T01 |
| C3 | Beam & Annealing ignore and delete placement locks | T11 |
| C4 | Undo unreliable (analysis results fill the history) | T02 |
| C5 | Onion skin has no visible effect | T09 |
| C6 | Selecting an event shows a false "Feasible" verdict | T07 |
| C7 | Compare shows the Active Layout as empty / zero-scored | T08 |
| C8 | A selected event freezes the grid during playback | T10 |
| C9 | Dropping a Composer preset on the grid does nothing | T65 |

## Running one

```bash
npm run dev                      # in another terminal (http://localhost:5173)
node scripts/ui-critique-repros/C6/probe.mjs
```

Run from the repository root. Screenshots, logs and JSON results go to `.ui-repro-out/` (git-ignored).

- `URL` overrides the dev-server address (default `http://localhost:5173`).
- `W` / `H` set the viewport (most scripts default to 1600×1000).
- `PW_CHROMIUM` points at a Chromium binary if Playwright's bundled browser isn't installed.

Some scripts read further variables such as `SCEN` or `METHOD`; see the top of each file.

**Caveat:** `C4/probe.mjs` reads React fiber internals to inspect the undo history. The P0 spec
must not; it should use a dev-only test hook instead (see the roadmap).
