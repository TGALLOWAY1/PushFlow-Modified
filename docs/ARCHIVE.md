# Archived material

Files that left the working tree, why they left, and how to get any of them back.
Nothing here is lost: git keeps every removed file in history, and each removal below names
the commit that still has it.

## Recovery points

| Date | What left the tree | Recover from |
|------|--------------------|--------------|
| 2026-09-26 (PR #112) | `archive/`, P0–P3 screenshot evidence, stale March docs, retired UI-critique probes, unreachable source files ([details](#what-the-2026-09-26-cleanup-removed)) | `fa04025f6ecbd90ffd14689ad9a31778370836dc` |

`fa04025f` is the `main` commit the cleanup started from ("Merge pull request #110"). It stays in
`main`'s history however the cleanup PR is merged. Browse it on GitHub:
[tree at fa04025f](https://github.com/TGALLOWAY1/PushFlow-Modified/tree/fa04025f6ecbd90ffd14689ad9a31778370836dc).

## Restoring something

```bash
SHA=fa04025f6ecbd90ffd14689ad9a31778370836dc

# A shallow clone (as in Claude Code cloud sessions) may not have the commit: fetch it
# first. GitHub needs the full 40-character hash here. A full clone can skip this step.
git fetch --depth=1 origin $SHA

# See what is there
git ls-tree -r --name-only $SHA -- archive/v1-reference/src | head

# Read one file without touching the working tree
git show "$SHA:archive/v1-reference/README.md"

# Put a file or folder back in the working tree (commit it only if it should stay)
git checkout $SHA -- docs/screenshots/S2.4

# Every file that existed at the recovery point and is gone now
git diff --name-only --diff-filter=D $SHA HEAD
```

Without `git fetch`, a shallow clone answers `git checkout $SHA -- …` with
`fatal: reference is not a tree`.

A tag would give the commit a friendlier name. None exists yet; to add one:
`git tag -a pre-cleanup-2026-09-26 fa04025f -m "Before the 2026-09-26 cleanup" && git push origin pre-cleanup-2026-09-26`.

## What the 2026-09-26 cleanup removed

The tree went from 1,137 files (54.0 MB) to 516 files (10.5 MB).

| Removed | What it was | Why it went |
|---------|-------------|-------------|
| `archive/` (327 files, 3.9 MB) | `v1-reference/`: the V1 codebase, with a committed `dist/` build and V1 test data. `engine-comparison/`, `cost-model-planning/`, `reconciliation/`, `v2-planning/`, `v2-docs/`, `superseded-canonical/`, `superseded-workflow-artifacts/`, `tasks/`: V1/V2 comparison and V2-era planning. `v2-planning/CLAUDE.md`: an outdated agent-instruction file that Claude Code loaded whenever an agent read that folder. | Superseded by the four canon files and the live code; unchanged since 2026-03-19. Its one live dependency, TEST MIDI 1, is read from `test/fixtures/midi/` (a byte-identical copy). For the engine, read `docs/optimization/BIOMECHANICAL_ENGINE.md`, not the March cost-model plans. |
| `docs/screenshots/S0.1/` … `S3.4/`, `audit-P1a/` … `audit-P3/` (244 PNGs, 37.7 MB) | Before/after evidence for roadmap sessions and phase audits P0–P3 | Those phases are Done. `docs/product/UI_ROADMAP_PROGRESS.md` still cites the paths; they resolve at the recovery point. |
| `docs/screenshots/*.png` (15 files at the top level) | An old README candidate set (`01`–`07`) and a `rehearsal-*` set | Nothing linked them. The README's images are now in `docs/screenshots/readme/`. |
| `docs/product/SOURCE_OF_TRUTH.md`, `TERMINOLOGY.md` | A pre-canon product description and terminology table | They contradicted `docs/canonical/` (e.g. "Mapping", "Cell") while their names claimed authority. |
| `docs/product/CANON_ALIGNMENT_REVIEW.md`, `ENGINEERING_AUDIT_2026-03-22.md`, `BUGS.md`, `MILESTONES.md` | March point-in-time reviews, notes and an early rebuild plan | Snapshots with no inbound links; `MILESTONES.md` was a byte-identical copy of an archived PRD. |
| `docs/optimization/OPTIMIZER_REGRESSION_GUARD.md` | The March optimizer regression write-up | Its rules live in CLAUDE.md's "Do Not Regress" section. |
| `scripts/ui-critique-repros/C1`–`C8` | Playwright probes from the September UI critique | Their e2e specs (`test/e2e/c1`–`c8`) pass. `C9/` stays until `c9-presets.spec.ts` does. |
| `src/ui/components/lanes/`, `src/ui/fixtures/feasibilityDemos.ts`, `src/ui/persistence/presetStorage.ts` | UI modules | Nothing imported them. |
| `src/engine/analysis/constraintExplainer.ts`, `structure/performanceAnalyzer.ts`, `prior/ergonomicConstants.ts`, `diagnostics/fatigueModel.ts` | Engine modules, re-exported by `src/engine/index.ts` | Nothing imported them, directly or through the barrel. |
| npm packages `clsx`, `tailwind-merge`, `uuid`, `@types/uuid` | Dependencies | Imported nowhere. |
| `public/pwa-192x192.png`, `pwa-512x512.png` | PWA icons | The PWA service worker was removed on 2026-03-24 (`ee7401b1`); no manifest uses them. |

## How the repository got here

1. **2026-03-15, `c6c31a7d`:** two separate codebases were imported side by side, V1 as
   `product-reconciliation/v1/` and V2 as `product-reconciliation/v2/`: 28,778 files, 27,977 of
   them `node_modules`.
2. **2026-03-16, `fc4bb9d9`:** the tracked `node_modules` and `.DS_Store` files were removed.
3. **2026-03-19:** V2 was promoted to the repository root (`ec41ac4a`), V1 moved to
   `archive/v1-reference/` (`1bc1f710`), the planning material to `archive/` (`b35b1ee1`), and a
   four-file canon replaced the old canonical docs (`ab284219`).
4. **2026-09-26:** `archive/` and the material above left the working tree.

History still holds all of it, including the March `node_modules`, so a full clone's `.git` is
about 94 MB. Shrinking that would mean rewriting history and force-pushing `main`; it isn't worth
breaking every existing clone.

## Keeping the tree lean

Every file in the tree costs agents context: it turns up in searches and file listings, and a
stale doc can be mistaken for the truth.

- **Screenshots are review evidence, not documentation.** Roadmap sessions may commit
  before/after screenshots under `docs/screenshots/<session-id>/`. Once a phase's audit has
  merged, the next session's first PR moves that phase's session folders and its
  `audit-<phase>/` folder out: note the current `main` commit, `git rm -r` the folders, add a row
  to [Recovery points](#recovery-points), and extend the note under "How to use this file" in
  `docs/product/UI_ROADMAP_PROGRESS.md`. The only screenshots meant to stay are
  `docs/screenshots/readme/` (regenerate with `node scripts/take-screenshots.mjs`) and
  `docs/screenshots/ui-critique/` (the critique's "before" set).
- **No build output or caches.** `dist/`, `coverage/` and `*.tsbuildinfo` are git-ignored; keep
  them that way.
- **Retire scaffolding when its replacement lands.** A probe goes when its spec passes; a plan
  goes when its phase is Done.
- **One source of truth.** Change `docs/canonical/` or CLAUDE.md rather than adding a document
  that restates them.
- **Record every removal here**, with the commit that still has the files.
