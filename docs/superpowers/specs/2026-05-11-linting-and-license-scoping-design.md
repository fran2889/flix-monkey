# Design Spec: Refined Linting and License Scoping

## 1. Problem Statement
The current ESLint configuration applies license header requirements to all JavaScript files, including utility scripts and configuration files. The user wants to restrict license headers strictly to `src/` and `tests/` while maintaining code quality checks across the entire codebase.

## 2. Proposed Changes

### 2.1 ESLint Configuration (`eslint.config.js`)
We will refactor the configuration to separate "General Linting" from "License Header Enforcement".

- **General Linting Block:**
  - **Files:** `['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.config.js']`
  - **Purpose:** Enforce code quality (recommended rules, `no-var`, `prefer-const`, etc.).
  - **Constraint:** Does **not** include the `headers` plugin or rule.

- **License Header Block:**
  - **Files:** `['{src,tests}/**/*.js']`
  - **Purpose:** Specifically enforce the presence of the license header using `eslint-plugin-headers`.
  - **Implementation:** Uses the brace expansion glob `{src,tests}` for consolidation.

### 2.2 Formatting (`package.json`)
The existing `format` script and `lint-staged` configuration will remain unchanged as they already provide appropriate coverage for aesthetic consistency across the project.

## 3. Architecture & Data Flow
1. **Developer Action:** Runs `npm run lint` or `npm run lint:fix`.
2. **ESLint Execution:**
   - Evaluates files in `scripts/` and root against the General Linting Block.
   - Evaluates files in `src/` and `tests/` against **both** the General Linting Block and the License Header Block.
3. **Outcome:** Files in `scripts/` pass without license headers; files in `src/` and `tests/` fail if headers are missing or incorrect.

## 4. Verification Plan

### 4.1 Automated Tests
- Run `npm run lint` and observe failures in `src/` or `tests/` if headers are removed.
- Run `npm run lint` and observe success for `scripts/` files even without headers.

### 4.2 Manual Check
- Inspect a file in `scripts/` to confirm it lacks a header but is otherwise lint-clean.
- Inspect a file in `src/` to confirm it has the correct header.
