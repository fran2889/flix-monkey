# Release Automation Design

## Overview
This design outlines the implementation of automated versioning and release management using Google's [Release Please](https://github.com/googleapis/release-please) for the `flixmonkey` project. This system replaces manual version bumping and changelog maintenance with an automated, conventional-commit-based process.

## Architecture
- **Tool:** `googleapis/release-please-action`.
- **Workflow:** A new GitHub Action workflow, `.github/workflows/release-please.yml`.
- **Configuration:** `release-please-config.json` in the root directory.

## Configuration
The `release-please-config.json` file will be configured for a Node.js package:
```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "flixmonkey"
    }
  }
}
```

## Workflow Implementation
The `.github/workflows/release-please.yml` workflow will:
1. Trigger on pushes to the `main` branch.
2. Use the `release-please-action` to scan commit history.
3. Automatically open or update a "Release" Pull Request when changes (features, fixes, etc.) are detected.
4. Upon merging the "Release" Pull Request, automatically create a GitHub Release and tag the repository.

## Requirements
- **Conventional Commits:** All contributions merged to `main` must adhere to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
    - `fix: ...` triggers a patch version bump.
    - `feat: ...` triggers a minor version bump.
    - `feat!: ...` or `perf!: ...` triggers a major version bump.

## Validation
1. Verify the release-please workflow by creating a branch with a `feat:` commit.
2. Ensure a "Release" Pull Request is automatically generated.
3. Merge the "Release" Pull Request to verify automatic tag and release creation.
