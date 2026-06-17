# Per-Item Cache Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refactor CacheManager to store each title's rating in its own storage key (`fmc:<title_key>`) instead of a single massive JSON blob.

**Architecture:** Update PlatformAdapter with `storageDelete` and `storageGetKeys` methods. Update CacheManager to use O(1) storage operations for read/write. Remove the global `fm_cache` dependency.

**Tech Stack:** JavaScript (ESM), Vitest, WebExtensions API, Userscript (GM\_\*) APIs.

---

### Task 1: Update PlatformAdapter Interface

**Files:**

- Modify: `src/platform/adapter.js`

- [x] **Step 1: Add abstract methods to PlatformAdapter**

```javascript
export class PlatformAdapter {
    // ... existing methods
    /** @abstract */
    async storageDelete(_key) {
        throw new Error('PlatformAdapter: storageDelete() must be implemented by subclass');
    }

    /** @abstract */
    async storageGetKeys(_prefix) {
        throw new Error('PlatformAdapter: storageGetKeys() must be implemented by subclass');
    }
}
```

- [x] **Step 2: Commit changes**

```bash
git add src/platform/adapter.js
git commit -m "refactor: add storageDelete and storageGetKeys to PlatformAdapter"
```

---

### Task 2: Implement Adapter Methods in Userscript

**Files:**

- Modify: `src/platform/userscript.js`

- [x] **Step 1: Implement storageDelete and storageGetKeys**

```javascript
export class UserscriptAdapter extends PlatformAdapter {
    // ...
    async storageDelete(key) {
        GM_deleteValue(key);
    }

    async storageGetKeys(prefix) {
        return GM_listValues().filter(k => k.startsWith(prefix));
    }
}
```

- [x] **Step 2: Commit changes**

```bash
git add src/platform/userscript.js
git commit -m "feat(userscript): implement storageDelete and storageGetKeys"
```

---

### Task 3: Implement Adapter Methods in WebExtension

**Files:**

- Modify: `src/platform/webextension.js`

- [x] **Step 1: Implement storageDelete and storageGetKeys**

```javascript
export class WebExtensionAdapter extends PlatformAdapter {
    // ...
    async storageDelete(key) {
        await browser.storage.local.remove(key);
    }

    async storageGetKeys(prefix) {
        const all = await browser.storage.local.get(null);
        return Object.keys(all).filter(k => k.startsWith(prefix));
    }
}
```

- [x] **Step 2: Commit changes**

```bash
git add src/platform/webextension.js
git commit -m "feat(extension): implement storageDelete and storageGetKeys"
```

---

### Task 4: Refactor CacheManager Implementation

**Files:**

- Modify: `src/core/cache.js`

- [x] **Step 1: Update CacheManager methods**
      Replace `#storageKey` with `#prefix = 'fmc:'`. Refactor `read`, `write`, and `clear`.

```javascript
export class CacheManager {
    #prefix = 'fmc:';
    #adapter;
    #config;

    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
    }

    #getCacheKey(displayTitle, domYear) {
        const slug = `${displayTitle.toLowerCase().replace(/\s+/g, '_')}${domYear ? `_${domYear}` : ''}`;
        return `${this.#prefix}${slug}`;
    }

    // Remove #loadCacheData - no longer needed for O(1) ops

    async read(displayTitle, domYear) {
        const key = this.#getCacheKey(displayTitle, domYear);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            const entry = JSON.parse(raw);
            return Date.now() > entry.expires ? null : Title.fromJSON(entry.data);
        } catch {
            return null;
        }
    }

    async write(displayTitle, domYear, titleObj) {
        const key = this.#getCacheKey(displayTitle, domYear);
        const now = Date.now();
        const ttl = this.#calculateTtl(titleObj);
        const entry = {
            data: titleObj,
            expires: ttl === Infinity ? Infinity : now + ttl,
        };
        await this.#adapter.storageSet(key, JSON.stringify(entry));
    }

    async clear() {
        const keys = await this.#adapter.storageGetKeys(this.#prefix);
        const count = keys.length;
        for (const key of keys) {
            await this.#adapter.storageDelete(key);
        }
        logger.info(`Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }
}
```

- [x] **Step 2: Commit changes**

```bash
git add src/core/cache.js
git commit -m "feat(core): refactor CacheManager to use per-item storage keys"
```

---

### Task 5: Update Cache Tests

**Files:**

- Modify: `tests/unit/core/cache.test.js`

- [x] **Step 1: Update mocks and assertions**
      Ensure `storageGet` is called with the prefixed key and `storageSet` is called with individual data. Add `storageDelete` and `storageGetKeys` to the mock adapter.

- [x] **Step 2: Run tests**
      Run: `npm test tests/unit/core/cache.test.js`
      Expected: PASS

- [x] **Step 3: Commit changes**

```bash
git add tests/unit/core/cache.test.js
git commit -m "test(core): update cache tests for per-item storage"
```
