### Task 8.3: Migrate Chrome Target

**Files:**

- Modify: `src/targets/chrome/service-worker.js` → `service-worker.ts`

**Interfaces:**

- Produces: Typed Chrome service worker

- [ ] **Step 1: Migrate service-worker.ts**

- [ ] **Step 2: Run type-check, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/chrome/service-worker.ts
git commit -m "feat(ts-migration): migrate Chrome target to TypeScript"
```

---

**Global Constraints from Plan:**

- Node.js: >= 24
- Use `null`, not `undefined`
- All code paths must explicitly return
- Optional properties accept only absence, not `undefined`
- Type checking: `npm run type-check` (tsc --noEmit)
- Build: `npm run build` (rollup -c && node scripts/package.js)
- Test: `npm test` (vitest run tests/unit tests/ui)
- All tests must pass after each migration
- Build must succeed after each migration
- Lint must pass after each migration
