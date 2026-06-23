# Architectural Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the robustness, testability, and resilience of the `flix-monkey` codebase by formalizing error handling, decoupling configuration, and improving API orchestration.

**Architecture:** Centralized logging, dependency-injected configuration management, and health-aware API client orchestration.

**Tech Stack:** JavaScript (ES6+), Vitest (Testing)

---

### Task 1: Centralized Logging

**Files:**

- Create: `src/core/logger.js`
- Modify: `src/core/api-clients.js`
- Modify: `src/core/api-manager.js`
- Modify: `src/core/app.js`

- [x] **Step 1: Create `src/core/logger.js`**

```javascript
export class Logger {
    #prefix = '[FlixMonkey]';

    warn(message) {
        console.warn(`${this.#prefix} ${message}`);
    }

    error(message) {
        console.error(`${this.#prefix} ${message}`);
    }

    info(message) {
        console.info(`${this.#prefix} ${message}`);
    }
}

export const logger = new Logger();
```

- [x] **Step 2: Update `src/core/api-clients.js` to use `Logger`**
      Replace `createClientLogger` and direct `console.warn` calls with `logger`.

- [x] **Step 3: Update `src/core/api-manager.js` to use `Logger`**
      Replace `console.warn` with `logger.warn`.

- [x] **Step 4: Update `src/core/app.js` and other files if needed**
      Ensure any other direct console calls in domain logic are replaced.

- [x] **Step 5: Verify logging consistency**
      Run existing tests to ensure no regressions.

- [x] **Step 6: Commit**

```bash
git add src/core/logger.js src/core/api-clients.js src/core/api-manager.js src/core/app.js
git commit -m "refactor: centralize logging in Logger class"
```

### Task 2: Decoupled Configuration

**Files:**

- Create: `src/core/config-manager.js`
- Create: `tests/unit/core/config-manager.test.js`
- Modify: `src/core/api-manager.js`
- Modify: `src/core/api-clients.js`
- Modify: `src/core/app.js`

- [x] **Step 1: Create `src/core/config-manager.js`**

```javascript
import { CONFIG_DEFAULTS } from './config-fields.js';

export class ConfigManager {
    #getter;

    constructor(getterFn = key => CONFIG_DEFAULTS[key]) {
        this.#getter = getterFn;
    }

    get(key, fallback) {
        try {
            return this.#getter(key) ?? fallback ?? CONFIG_DEFAULTS[key];
        } catch {
            return fallback ?? CONFIG_DEFAULTS[key];
        }
    }

    getInt(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? fallback : num;
    }

    getFloat(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? fallback : num;
    }
}
```

- [x] **Step 2: Write tests for `ConfigManager`**
      Create `tests/unit/core/config-manager.test.js`.

- [x] **Step 3: Update `ApiClientManager` to accept `ConfigManager`**
      Modify constructor and initialization logic.

- [x] **Step 4: Update API clients to accept `ConfigManager`**
      Inject `ConfigManager` into clients and use it instead of the global `CONFIG`.

- [x] **Step 5: Update `startApp` in `src/core/app.js` to wire up `ConfigManager`**

- [x] **Step 6: Run tests and verify**
      `npm test tests/unit/core/config-manager.test.js`

- [x] **Step 7: Commit**

```bash
git add src/core/config-manager.js tests/unit/core/config-manager.test.js src/core/api-manager.js src/core/api-clients.js src/core/app.js
git commit -m "refactor: decouple configuration with ConfigManager"
```

### Task 3: API Resilience and Health Checks

**Files:**

- Modify: `src/core/api-clients.js`
- Modify: `src/core/api-manager.js`
- Modify: `tests/unit/core/api-manager.test.js`

- [x] **Step 1: Add health-check interface to `BaseApiClient`**
      Add `async getStatus()` returning `{ healthy: boolean, reason?: string }`.

- [x] **Step 2: Update `ApiClientManager` to use health checks**
      Prioritize healthy clients and handle degraded states.

- [x] **Step 3: Implement basic retry/fall-through mechanism**
      In `ApiClientManager.getData`, if a client fails, try the next one even if not "better".

- [x] **Step 4: Update tests to verify resilience**
      Modify `tests/unit/core/api-manager.test.js` to simulate failures.

- [x] **Step 5: Verify and Commit**

```bash
git add src/core/api-clients.js src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "feat: improve API resilience with health checks and fall-through"
```
