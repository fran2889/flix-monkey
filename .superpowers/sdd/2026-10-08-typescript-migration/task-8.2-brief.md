### Task 8.2: Migrate Firefox Target

**Files:**

- Modify: `src/targets/firefox/background.js` → `background.ts`

**Interfaces:**

- Produces: Typed Firefox background script

- [ ] **Step 1: Migrate background.ts**

- [ ] **Step 2: Run type-check, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/firefox/background.ts
git commit -m "feat(ts-migration): migrate Firefox target to TypeScript"
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
