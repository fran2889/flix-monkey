### Task 6.1: Migrate UI Modules

**Files:**

- Modify: `src/core/ui/modal.js` → `modal.ts`
- Modify: `src/core/ui/settings-ui.js` → `settings-ui.ts`
- Modify: `src/core/ui/settings-view.js` → `settings-view.ts`
- Modify: `src/core/ui/overlay-elements.js` → `overlay-elements.ts`
- Modify: `src/core/ui/overlay-styles.js` → `overlay-styles.ts`
- Modify: `src/core/ui/styles.js` → `styles.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed UI components
- Consumes: May depend on config, constants

- [ ] **Step 1: Migrate each UI file**

- [ ] **Step 2: Run type-check, tests, build**

- [ ] **Step 3: Commit**

```bash
git add src/core/ui/*.ts tests/unit/core/ui/*.test.ts
git commit -m "feat(ts-migration): migrate UI components to TypeScript"
```

---

## Phase 6: API Clients
