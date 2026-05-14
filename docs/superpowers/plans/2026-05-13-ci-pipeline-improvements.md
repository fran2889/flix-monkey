# CI Pipeline Improvements Plan

## Overview
Optimize the CI pipeline to improve build speeds, reliability, and visibility.

## Tasks
1. **Caching Optimization**: Modify `ci.yml` to run a single `install` job that caches `node_modules` and uploads it as an artifact, used by subsequent jobs via `actions/download-artifact`.
2. **Coverage Reporting**: Create `test-coverage` CI job that executes `npm run test:coverage` and uploads results.
3. **Audit Hardening**: Update `npm run audit` to use `--audit-level=high` to ensure build failure on high-severity vulnerabilities.
4. **Resilience**: Add `timeout-minutes: 10` (or similar) to all CI jobs in `ci.yml`.
5. **Release-Please**: Ensure `release-please.yml` uses a pinned Node version.

## Verification
- Verify CI pipeline runs successfully on a new commit.
- Observe install time savings in CI logs.
- Verify `npm run audit` fails on a simulated high-severity audit issue.
- Verify coverage reports are generated as artifacts.
