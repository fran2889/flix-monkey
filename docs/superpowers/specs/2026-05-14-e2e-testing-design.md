# E2E Testing Architecture Design

## Overview

This design defines a unified end-to-end (E2E) testing infrastructure for the flix-monkey project, enabling consistent validation across Greasemonkey scripts, Firefox extensions, and Chrome extensions. The architecture leverages Playwright for browser automation, connecting to active, authenticated Netflix sessions via the Chrome DevTools Protocol (CDP).

## Core Principles

1. **Target-Agnostic Test Suites:** Tests describe _what_ to do, while the platform-specific implementation is abstracted.
2. **Surface-Aware Interaction:** UI interactions are encapsulated by surface definitions (browse, hover, info, search), shielding tests from Netflix's frequent DOM changes.
3. **Programmatic State Injection:** Functional tests use programmatic state updates for settings and commands to ensure speed, with a dedicated suite for Options UI verification.

## Architecture

### 1. Automation Framework

- **Framework:** Playwright (Node.js).
- **Mode:** `browserType.connectOverCDP` to attach to a local browser instance (launched with `--remote-debugging-port=9222`).

### 2. Test Adapter Interface

A unified `TestAdapter` interface will be implemented for each platform:

- **Core Methods:**
    - `navigate(url: string)`
    - `waitForElement(selector: string)`
    - `click(selector: string)`
    - `evaluate<T>(func: () => T)`
- **Platform Orchestration:**
    - `triggerExtensionCommand(commandName: string)`: Triggers extension-internal command handlers.
    - `setExtensionSettings(settings: object)`: Injects configuration state programmatically.

### 3. Surface-Aware Interaction

- **Surface Layer:** `adapter.getSurface(surfaceName)` provides a scoped interface for Netflix surfaces:
    - `browse`
    - `hover`
    - `info`
    - `search`
- **Goal:** Stable interactions by isolating Netflix-specific selectors inside the adapter implementation.

### 4. Settings UI Verification

- **Dedicated Adapter:** `SettingsUIAdapter` targets `options.html` directly.
- **Verification Strategy:** Perform UI actions (click/input) and verify internal state via `ConfigManager` introspection.

## Implementation Path

1. Define the `TestAdapter` interface.
2. Implement platform-specific adapters (starting with Userscript).
3. Migrate existing UI tests to the surface-aware API.
4. Implement dedicated options page test suite.
