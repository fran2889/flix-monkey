# Multi-Target Build — Progress

Plan: `docs/superpowers/plans/2026-05-01-multi-target-build.md`

## Completed

- [x] **Task 1** — Install build dependencies and scaffold project
  - rollup, @rollup/plugin-node-resolve, @rollup/plugin-commonjs, webextension-polyfill installed
  - package.json: version 0.10.0, build/lint/format scripts added
  - rollup.config.js stub created (will fail until Task 12 wires real entry points — expected)
  - dist/ added to .gitignore
  - src/ directory tree scaffolded

- [x] **Task 2** — Extract `src/core/constants.js` and `src/core/title.js`
  - Both files created as verbatim ES module extractions from FlixMonkey.user.js

## Resume From

**Task 3** — Create `src/platform/adapter.js` and `src/platform/userscript.js`

All subsequent tasks (3–18) are unstarted. The plan file has complete code for each task.

## Last Commit

```
3bf2fd2 chore: fix @rollup/plugin-commonjs version range to match installed ^29.0.0
9ed1770 refactor: extract constants and Title to src/core modules
2cca37c chore: add rollup build tooling and scaffold src/ structure
```
