# Extension Packaging Design

## Overview
Automate the generation of distributable browser extension artifacts (Chrome `.zip` and Firefox `.xpi`) as a post-build step in the project's CI/CD pipeline.

## Requirements
1.  **Automated Packaging:** Packaging must trigger automatically following a successful build.
2.  **Platform Compatibility:**
    *   Chrome: Output as a `.zip` file.
    *   Firefox: Output as an `.xpi` file (functionally equivalent to a zip).
3.  **Naming Convention:** Artifacts must be versioned (e.g., `FlixMonkey-v<version>-chrome.zip`).
4.  **Distribution:** Artifacts will be stored in the existing `dist/` directory.

## Implementation Details
1.  **Post-Build Script (`scripts/package.js`):**
    *   Will be developed using the `archiver` library.
    *   Reads current version from `package.json`.
    *   Packages `dist/chrome/` into `dist/FlixMonkey-v<version>-chrome.zip`.
    *   Packages `dist/firefox/` into `dist/FlixMonkey-v<version>-firefox.xpi`.
2.  **Workflow Integration:**
    *   Update `package.json` to define the build pipeline: `"build": "rollup -c && node scripts/package.js"`.
    *   Add `archiver` as a `devDependencies`.

## Error Handling & Future Considerations
*   The script will validate the presence of source directories before attempting to package.
*   Future Firefox signing integration can be seamlessly added as an additional step in this packaging script.
