# Consolidated Configuration UI Design

## Overview

Currently, FlixMonkey maintains two separate configuration UI implementations: a custom DOM builder for browser extensions and the `GM_config` library for userscripts. This design proposes a unified, platform-agnostic configuration engine that handles rendering, validation, and storage interaction through the `PlatformAdapter`.

## Goals

- **Unification:** Single source of truth for UI structure and behavior.
- **Validation:** Support for "on-save" field validation.
- **Independence:** Remove `GM_config` dependency to reduce complexity and improve styling control.
- **Maintainability:** Shared logic for secondary actions (Clear Cache, Reset Clients).

## Architecture

### 1. Enhanced Metadata (`src/core/config-fields.js`)

The `CONFIG_FIELDS` array will be expanded to include optional validation logic and refined metadata.

```javascript
{
    key: 'fadeRatingThreshold',
    label: 'Fade Threshold (IMDb)',
    type: 'text',
    default: '6.0',
    validate: (val) => {
        const n = parseFloat(val);
        return (isNaN(n) || n < 0 || n > 10) ? 'Value must be between 0.0 and 10.0' : null;
    }
}
```

### 2. Settings Engine (`src/core/ui/settings-ui.js`)

A core class `SettingsUI` will manage the lifecycle of the settings panel.

- **`render(container)`**: Generates the form based on `CONFIG_FIELDS`.
- **`load()`**: Retrieves current values via `adapter.storageGet`.
- **`save()`**:
    1. Extracts values from the UI.
    2. Runs `validate()` functions for all fields.
    3. Displays errors if validation fails.
    4. Persists values via `adapter.storageSet` if valid.
- **Secondary Actions**: Standardized buttons for "Clear Cache" and "Reset Disabled Clients".

### 3. Modal Utility (`src/core/ui/modal.js`)

Since `GM_config` provided its own modal, we will implement a lightweight `Modal` class to wrap the `SettingsUI` for userscript targets.

- Handles overlay creation, positioning, and "Close" behavior.
- Responds to escape key and outside clicks.

### 4. Platform Adapter Updates (`src/platform/adapter.js`)

The `PlatformAdapter` will be extended to support the required storage patterns for the unified UI:

- `storageGetAll()`: To load all settings at once.
- `storageSetMany(object)`: To save all settings at once.
- Standardized methods for cache clearing and client resetting.

### 5. Unified Styling (`src/core/ui/styles.js`)

A shared CSS implementation based on the "Netflix-dark" theme. This will be injected by the `SettingsUI` engine or the `Modal` utility.

## Data Flow

1. **Entry Point** (Extension `options.js` or Userscript `entry.js`) initializes the `SettingsUI` with the platform-specific `Adapter`.
2. **SettingsUI** renders the form and populates it with data from the `Adapter`.
3. **User** modifies fields and clicks **Save**.
4. **SettingsUI** validates input.
5. **Success**: Data is sent to `Adapter.storageSetMany`. UI shows a "Saved" status.
6. **Failure**: Error messages appear next to invalid fields.

## Verification Plan

- **Unit Tests**: Test the `SettingsUI` logic in isolation using JSDOM. Verify validation triggers correctly and errors are displayed.
- **Integration Tests**: Verify that both the Extension and Userscript targets correctly initialize the shared UI and that data persists across reloads.
- **Manual Verification**:
    - Open Extension options page and save valid/invalid data.
    - Trigger Userscript settings modal via menu command and save valid/invalid data.
