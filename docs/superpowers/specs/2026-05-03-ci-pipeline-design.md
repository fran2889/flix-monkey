# CI Pipeline Design

## Overview
This design outlines the implementation of a GitHub Actions CI pipeline for the flixmonkey project. The primary goal is to ensure code quality and stability by automatically running linting and testing on pull requests and pushes to the main branch.

## Architecture
- **Environment:** GitHub-hosted runners (ubuntu-latest).
- **Setup:** `actions/setup-node@v4` with Node.js version 22.
- **Workflow:** `.github/workflows/ci.yml`.

## Job Definition
A single `ci` job will perform the following steps:
1. **Checkout:** `actions/checkout@v4`
2. **Setup Node:** `actions/setup-node@v4` (Node.js 22)
3. **Install:** `npm ci`
4. **Lint:** `npm run lint`
5. **Test:** `npm test` (Runs all test suites: unit, UI, and integration)

## Triggers
- `pull_request` on branches targeting `main`
- `push` on the `main` branch

## Trade-offs
- **actions/setup-node vs. Docker:** Standard `setup-node` is chosen for faster startup and native GitHub Actions caching integration, which outweighs the benefit of pure environment containerization for this project's requirements.
