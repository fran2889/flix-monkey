### Task 5.2: Migrate Platform Implementations

**Files:**

- Modify: `src/platform/userscript.js` → `userscript.ts`
- Modify: `src/platform/webextension.js` → `webextension.ts`
- Modify: `tests/mocks/userscript.js` → `userscript.ts`
- Modify: `tests/mocks/webextension.js` → `webextension.ts`

**Interfaces:**

- Produces: Typed platform implementations
- Consumes: Extends adapter from Task 5.1

- [ ] **Step 1: Migrate each implementation**

- [ ] **Step 2: Migrate corresponding mocks**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/platform/*.ts tests/mocks/userscript.ts tests/mocks/webextension.ts
git commit -m "feat(ts-migration): migrate platform implementations to TypeScript"
```

---

## Phase 5: UI Components
