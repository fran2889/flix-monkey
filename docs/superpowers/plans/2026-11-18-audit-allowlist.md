# Audit Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `npm audit` with `better-npm-audit` so the merge gate keeps auditing the full dependency tree while `GHSA-fc5q-39xc-vjpf` is excepted until 2 December 2026.

**Architecture:** An exactly-pinned devDependency wraps `npm audit --json`. A root `.nsprc` holds one active exception keyed on the advisory's GHSA URL, with notes and an expiry. The tool fails only on root advisories and derives the transitive chains itself, so one entry covers all 19 current findings (`picomatch` is the only entry in `npm audit --json` with an object `via`; the other 18 have string-only `via`). No workflow file changes: CI keeps running `npm run audit`.

**Tech Stack:** npm 11, Node 24.x, better-npm-audit 4.2.1, YAML `.nsprc`.

**Spec:** No committed spec file. That is deliberate: it keeps this change to three files. The approved design (2026-11-18) is reproduced under Design Context, so the plan carries it.

## Design Context

- **Intent.** `npm audit` cannot suppress one advisory. All 19 findings derive from `GHSA-fc5q-39xc-vjpf` (`picomatch` <= 4.0.7, no patched release), so the merge gate is red for a reason nobody can fix. Wrapping the audit keeps full-tree coverage while excepting exactly that advisory for two weeks. Supersedes PR #312, which scoped the gate to production dependencies; this project has none, so that gate could never fail.
- **Goals.** `npm run audit` still audits dev and prod at moderate. Suppress only this advisory. Fail automatically when the exception expires or loses its notes/expiry. Every other advisory still fails.
- **Non-goals.** No `--omit=dev`/`--production`, no PR-template change, no changes to `audit:fix`, `ci.yml`, or any other workflow.
- **Anti-goals.** Lowering the severity threshold, module-wide ignores, permanent exceptions.
- **Decisions.** Exactly-pinned devDependency (rejected pinned `npx`: this script is in the documented local pre-PR check). Exception is advisory-wide, not path-scoped, because there are zero production dependencies. `audit:fix` stays on `npm audit fix`. `AGENTS.md` and `CONTRIBUTING.md` need no edits.

## Global Constraints

- `engines.node` is `24.x`. **This machine runs Node 26.13.1** and `.npmrc` sets `engine-strict=true`, so every npm install/ci command must be prefixed `npm_config_engine_strict=false`.
- `.npmrc` sets `save-prefix=^`, so `npm install` needs `--save-exact`.
- `.npmrc` sets `min-release-age=5`. better-npm-audit 4.2.1 was published 2026-11-05 (13 days old), so it resolves.
- Never pass `--production`, `--omit`, `-x`, or `-m`; never lower `--level` below `moderate`.
- Suppressions live only in `.nsprc`, each with `notes` and `expiry`.
- Exclusion expiry is `'2026-12-02T23:59:59Z'`, the end of 2 December 2026 and two weeks from approval.
- CI runs `npm ci --ignore-scripts` on Node 24.x; `.github/workflows/ci.yml` is not modified.
- The working tree is currently on `build/audit-prod-deps` (PR #312). `docs/reviews/` is untracked user work; never stage or delete it.

## Review Focus

The spec's silence on these is not permission for them to break. Each is pinned by a step below.

1. **A gate that cannot fail.** The #312 failure mode was a green audit over zero packages. Proved live by Task 1 Step 5 and Task 2 Step 4.
2. **The exception swallowing a different advisory.** A stale or wrong key must fail, not silently suppress. Task 2 Step 8.
3. **The exception outliving its deadline.** Once expired it must stop applying without anyone editing code. Task 2 Step 5.
4. **A future exception with no reason or no end date.** Task 2 Steps 6-7.
5. **CI installing the tool differently from a dev box.** `npm ci --ignore-scripts` on Node 24.x is the real path. Task 3 Step 1.

---

### Task 1: Run the audit through better-npm-audit (expected red)

**Files:**

- Modify: `package.json` (`scripts.audit`, `devDependencies`), `package-lock.json`
- Modify: `docs/superpowers/plans/2026-11-18-audit-allowlist.md` (this file, commit it)
- Test: command-line verification; no test file exists for build configuration

**Interfaces:**

- Consumes: nothing.
- Produces: `npm run audit` runs `better-npm-audit audit --level moderate --require-notes --require-expiry`; the `better-npm-audit` binary resolves from `node_modules/.bin`; no `.nsprc` exists yet.

- [x] **Step 0: Branch from main**

```bash
git fetch origin
git switch -c build/audit-allowlist origin/main
```

Expected: `Switched to a new branch 'build/audit-allowlist'` at `origin/main`.

- [x] **Step 1: Commit the plan document**

```bash
git add docs/superpowers/plans/2026-11-18-audit-allowlist.md
git commit -m "docs: add the audit allowlist implementation plan"
```

Expected: one commit containing only this file (plus nothing from `docs/reviews/`).

- [ ] **Step 2: Install the exact pin**

```bash
npm_config_engine_strict=false npm install --save-dev --save-exact better-npm-audit@4.2.1
```

Expected: `package.json` gains `"better-npm-audit": "4.2.1"` under `devDependencies`. `git diff package.json` shows only that line. If npm rewrote unrelated lines, restore them with `git checkout -- package.json` and re-apply only the dependency line by hand.

- [ ] **Step 3: Verify the pin**

```bash
node -p "require('./package.json').devDependencies['better-npm-audit']"
npm ls better-npm-audit --depth=0
```

Expected: `4.2.1`, then `better-npm-audit@4.2.1`.

- [ ] **Step 4: Point the script at the tool**

Replace exactly this line in `package.json`:

```diff
-        "audit": "npm audit --audit-level=moderate",
+        "audit": "better-npm-audit audit --level moderate --require-notes --require-expiry",
```

Leave `audit:fix` untouched. The explicit `--level moderate` matters: the tool defaults to `info`.

- [ ] **Step 5: Run it and confirm the gate is live (RED)**

```bash
npm run audit; echo "exit=$?"
```

Expected: `exit=1` and `1 vulnerabilities found. Node security advisories: 1247710`.

`1` is the right number, not 19: the tool reports root advisories, and only `picomatch` carries the advisory object; the other 18 packages reach it through string `via` entries that the tool deliberately skips. If this run reports **no** vulnerability, stop and report: the gate is not seeing the tree the design assumed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: run dependency audits through better-npm-audit"
```

---

### Task 2: Except the advisory, and prove the exception is narrow

**Files:**

- Create: `.nsprc`
- Test: command-line verification against the live audit report

**Interfaces:**

- Consumes: `npm run audit` from Task 1.
- Produces: `.nsprc` with exactly one key, `GHSA-fc5q-39xc-vjpf`, `active: true`, notes, `expiry: '2026-12-02T23:59:59Z'`.

- [ ] **Step 1: Create `.nsprc` with exactly this content**

```yaml
'GHSA-fc5q-39xc-vjpf':
    active: true
    notes: 'picomatch ReDoS in <=4.0.7; no patched release yet. Refs #311.'
    expiry: '2026-12-02T23:59:59Z'
```

Four-space indent to match the repo's YAML. The key matches `npm audit`'s advisory URL (`https://github.com/advisories/GHSA-fc5q-39xc-vjpf`) by suffix, which is how the tool resolves GHSA keys.

- [ ] **Step 2: Green**

```bash
npm run audit; echo "exit=$?"
```

Expected: `exit=0`, an exception table row for `GHSA-fc5q-39xc-vjpf` with status `active` and expiry `Wed, 02 Dec 2026 23:59:59 GMT`, and the final line `🤝  All good!`.

- [ ] **Step 3: Assert it mechanically, not by eye**

```bash
npx better-npm-audit audit --level moderate --require-notes --require-expiry --json 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);
console.log(JSON.stringify({passed:j.passed,unhandled:j.unhandledIds,unused:j.unusedExceptionIds,total:j.summary.total,excepted:j.vulnerabilities.map(v=>v.excepted)}));})"
```

Expected exactly: `{"passed":true,"unhandled":[],"unused":[],"total":1,"excepted":[true]}`. `total:1` is correct: the tool reports only the root advisory; the other 18 are derived chains.

- [ ] **Step 4: Confirm nothing is hidden from npm itself**

```bash
npm audit --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(Object.keys(j.vulnerabilities).length)})"
```

Expected: `19`. The exception is policy, not data removal.

- [ ] **Step 5: Snapshot before mutating**

```bash
cp .nsprc /tmp/opencode/nsprc.bak
```

Each remaining step edits `.nsprc`, runs the audit, then restores with `cp /tmp/opencode/nsprc.bak .nsprc`.

- [ ] **Step 6: An expired exception must not apply**

Set `expiry: '2026-11-01T00:00:00Z'`, then:

```bash
npm run audit; echo "exit=$?"
```

Expected: `exit=1`, status `expired` in the exception table, and `1 vulnerabilities found. Node security advisories: 1247710`. Restore.

- [ ] **Step 7: Missing notes must fail**

Delete the `notes:` line, then run the same command.

Expected: `exit=1` and `Exclusion GHSA-fc5q-39xc-vjpf in .nsprc is missing notes`. Restore.

- [ ] **Step 8: Missing expiry must fail**

Delete the `expiry:` line, then run the same command.

Expected: `exit=1` and `Exclusion GHSA-fc5q-39xc-vjpf in .nsprc is missing an expiry date`. Restore.

- [ ] **Step 9: A wrong key must not silently suppress**

Change the key to `'GHSA-0000-0000-0000'`, then run the same command.

Expected: `exit=1`, `1 vulnerabilities found. Node security advisories: 1247710`, and an unused-exception warning naming `GHSA-0000-0000-0000`. Restore.

- [ ] **Step 10: Confirm the restored file is byte-identical and green**

```bash
diff .nsprc /tmp/opencode/nsprc.bak && npm run audit; echo "exit=$?"
```

Expected: no `diff` output, then `exit=0`.

- [ ] **Step 11: Confirm lint and format ignore the new file**

```bash
npm run format:check && npm run lint
```

Expected: both pass. `.nsprc` matches none of the Prettier/ESLint globs, so no config change is needed.

- [ ] **Step 12: Commit**

```bash
git add .nsprc
git commit -m "build: except the picomatch advisory until 2 December 2026"
```

---

### Task 3: Verify under CI conditions and replace the open PR

**Files:** none. This task updates GitHub artifacts and runs a clean-install check.

**Interfaces:**

- Consumes: `npm run audit` and `.nsprc` from Task 2.

- [ ] **Step 1: Prove the CI install path**

```bash
npm_config_engine_strict=false npm ci --ignore-scripts
npm run audit; echo "exit=$?"
```

Expected: install succeeds; `exit=0`. `npm ci` wipes and rebuilds `node_modules`, so this is the same install CI performs.

- [ ] **Step 2: Run the documented local check**

```bash
npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage
```

Expected: all pass. This machine runs Node 26 against an `engines: 24.x` project; if a failure is clearly a Node-version mismatch unrelated to this change, record it and let CI on Node 24 decide rather than editing source.

- [ ] **Step 3: Rewrite issue #311's requirements**

Save this body to `/tmp/opencode/issue-311.md`:

```markdown
`npm audit` cannot suppress a single advisory, so `GHSA-fc5q-39xc-vjpf` (`picomatch` <= 4.0.7, no patched release) is excepted in `.nsprc` with an expiry. The gate audits the full tree, dev dependencies included.

Remove the exception after a patched release is available and past the repository's five-day minimum release age.

## Requirements

- The resolved `picomatch` version is above `4.0.7`.
- `.nsprc` contains no exceptions, and `npm run audit` reports nothing excepted.
- `npm audit --audit-level=moderate` reports no vulnerabilities with dev dependencies included.
- Type-check, lint, format, build, and coverage tests pass.
```

Then:

```bash
gh issue edit 311 --body-file /tmp/opencode/issue-311.md
```

Expected: `https://github.com/fran2889/flix-monkey/issues/311` printed.

- [ ] **Step 4: Push and open the replacement PR**

Save this body to `/tmp/opencode/pr-audit-allowlist.md`:

```markdown
## Summary

- Run the merge-gate audit through `better-npm-audit` so one unfixable advisory can be excepted without dropping dev dependencies from scope.
- Except `GHSA-fc5q-39xc-vjpf` (`picomatch` <= 4.0.7) in `.nsprc` until 2 December 2026.

## Test Plan

- `npm run audit` exits 1, not 0, when the exception's expiry is in the past, when its notes are removed, and when its key is changed to a different advisory.
- `npm run audit` exits 0 with the exception active, while `npm audit --json` still reports all 19 findings.

## Notes

- The exception is self-enforcing: `--require-notes --require-expiry` plus the expiry date make the gate fail on its own once it lapses or loses its reason.
- Supersedes #312, which scoped the audit to production dependencies; this project has none, so that gate could never fail.
- Related to #311.
```

Then:

```bash
git push -u origin build/audit-allowlist
gh pr create --base main --head build/audit-allowlist \
  --title "build: gate audits on better-npm-audit with an expiring exception" \
  --body-file /tmp/opencode/pr-audit-allowlist.md
```

Expected: a new PR URL. Do not use `Resolves #311`: the audit exception, not the dependency, is what this PR adds.

- [ ] **Step 5: Close #312 as superseded**

```bash
gh pr close 312 --comment "Superseded by #<new-number>: the gate keeps auditing dev dependencies through a scoped exception instead of \`--omit=dev\`."
```

Expected: PR #312 closed with the comment.

- [ ] **Step 6: Confirm CI**

```bash
gh pr checks <new-number>
```

Expected: `lint-and-audit` passes along with the other merge-gate jobs. `lint-and-audit` passing is the end-to-end proof that `npm ci --ignore-scripts` installs the tool and the script exits 0.
