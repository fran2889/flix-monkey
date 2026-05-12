# Refined Linting and License Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict license header enforcement to `src/` and `tests/` while maintaining code quality rules across all project files.

**Architecture:** Split the ESLint configuration into two blocks: one for general code quality (broad scope) and one for license headers (narrow scope using `{src,tests}/**/*.js`).

**Tech Stack:** ESLint, eslint-plugin-headers

---

### Task 1: Refactor ESLint Configuration

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Isolate the license header rule**

Update `eslint.config.js` to split the shared configuration into a general block and a header-specific block.

```javascript
import js from '@eslint/js';
import globals from 'globals';
import headers from 'eslint-plugin-headers';

export default [
    js.configs.recommended,
    // Legacy single-file userscript — script context, GM_* globals
    {
        files: ['FlixMonkey.user.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    // General code quality for all project JS files
    {
        files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
                chrome: 'readonly',
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    // License header enforcement - src and tests only
    {
        files: ['{src,tests}/**/*.js'],
        plugins: { headers },
        rules: {
            'headers/header-format': [
                'error',
                {
                    source: 'file',
                    path: 'LICENSE_HEADER.template',
                    variables: {
                        year: new Date().getFullYear().toString(),
                    },
                },
            ],
        },
    },
];
```

- [ ] **Step 2: Verify configuration with a dry run**

Run: `npx eslint --print-config src/core/app.js | grep headers`
Expected: Should show the `headers/header-format` rule.

Run: `npx eslint --print-config scripts/package.js | grep headers`
Expected: Should NOT show the `headers/header-format` rule.

- [ ] **Step 3: Run project linting**

Run: `npm run lint`
Expected: PASS (assuming existing files already have headers).

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore: restrict license headers to src and tests directories"
```

### Task 3: Cleanup and Final Pass

**Files:**
- Modify: `eslint.config.js`
- Modify: Various files with `no-unused-vars` errors.

- [ ] **Step 1: Update ESLint to ignore variables starting with underscore**

Update `eslint.config.js` to include `varsIgnorePattern: '^_'`.

```javascript
        rules: {
            ...commonRules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
```

- [ ] **Step 2: Fix all remaining linting errors**

Remove unused imports and variables, or prefix them with `_` if they are intentional.

- [ ] **Step 3: Run final linting**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: cleanup unused variables and reach clean lint state"
```
