# Build System Improvements Plan

## Overview
Address build system inefficiencies, specifically sourcemap generation, dependency management, and packaging stability.

## Tasks
1. **Sourcemaps**: Enable `sourcemap: true` in `rollup.config.js` for non-userscript extension targets.
2. **Packaging Robustness**: Promisify `zipDirectory` in `scripts/package.js` and ensure errors are propagated and the process exits non-zero on failure.
3. **Dependency Management**:
    - Move `dotenv` from `dependencies` to `devDependencies`.
    - Add `engines` field in `package.json` for Node >= 22.

## Verification
- Run `npm run build` and verify `dist/` contains valid `.map` files.
- Verify `npm run build` fails when `archiver` fails (e.g., via dummy error).
- Check `package.json` for proper dependency grouping and engine support.
