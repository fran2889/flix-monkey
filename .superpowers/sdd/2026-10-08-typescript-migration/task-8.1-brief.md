### Task 8.1: Migrate Extension Targets

**Files:**

- Modify: `src/targets/extension/content.js` → `content.ts`
- Modify: `src/targets/extension/options.js` → `options.ts`
- Modify: `src/targets/extension/fetch-proxy.js` → `fetch-proxy.ts`
- Modify: `src/targets/extension/domains.js` → `domains.ts`

**Interfaces:**

- Produces: Typed entry points
- Consumes: Depends on all core modules

- [ ] **Step 1: Migrate each extension file**

- [ ] **Step 2: Run type-check, tests, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/extension/*.ts
git commit -m "feat(ts-migration): migrate extension entry points to TypeScript"
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
