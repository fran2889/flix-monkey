---
title: Settings UI v19 Recreation
author: Mistral Vibe
date: 2026-08-23
---

# Settings UI v19 Recreation - Design Specification

## 1. Overview

### 1.1 Purpose

Recreate the Settings UI to match the visual design and DOM structure of mockup v19. The mockup file (`docs/design-mockups/settings-mockup-v19.html`) will be deleted after implementation and must not be referenced in code or documentation.

### 1.2 Goals

- Match mockup v19's DOM structure and CSS styling
- Preserve all existing functionality: autosave, validation, action handlers, status display
- Keep CONFIG_FIELDS as the single source of truth for field definitions
- Consolidate all UI metadata (groups, row labels, icons) in `config-fields.js`
- Maintain decoupling between configuration and rendering

### 1.3 Non-Goals

- Change the public API of `SettingsUI` class
- Modify behavior of autosave, validation, or action handling
- Reference the mockup file in any code or documentation

---

## 2. Architecture

### 2.1 Component Structure

```
settings-ui.js (unchanged)
    └── settings-view.js (refactored)
            └── config-fields.js (expanded with GROUPS, ROW_LABELS)
            └── styles.js (replaced with v19 CSS)
```

### 2.2 Data Flow

1. `SettingsUI.render()` calls `SettingsView.render()` with current settings
2. `SettingsView` reads `CONFIG_FIELDS`, `GROUPS`, `ROW_LABELS` from `config-fields.js`
3. `SettingsView` generates DOM matching mockup v19 structure
4. `SettingsView` injects CSS from `styles.js` (scoped under `.fm-settings-container`)
5. User interactions trigger callbacks defined in `SettingsUI` constructor

---

## 3. File Changes

### 3.1 `src/core/config-fields.js`

#### 3.1.1 New Exports

**GROUPS object (moved from settings-view.js):**

```javascript
export const GROUPS = {
    services: { label: 'Streaming Services', icon: '📺' },
    display: { label: 'Display Settings', icon: '🎨' },
    providers: { label: 'Rating Providers', icon: '📊' },
    fade: { label: 'Fade Settings', icon: '🌑' },
    cache: { label: 'Cache Settings', icon: '💾' },
    debug: { label: 'Debug', icon: '🐛' },
};
```

**ROW_LABELS object (new):**

```javascript
export const ROW_LABELS = {
    services: 'Show on',
    'ratings-display': 'Show',
};
```

#### 3.1.2 CONFIG_FIELDS Modifications

**New optional field properties:**

| Property   | Type    | Description                                        | Applicable Types |
| ---------- | ------- | -------------------------------------------------- | ---------------- |
| `suffix`   | string  | Text to display after input (e.g., "days")         | text             |
| `disabled` | boolean | Field is non-interactive and excluded from storage | all              |

**Modified fields:**

```javascript
// Add suffix to cache TTL fields
{
    key: 'cacheTtlRatedOldYear',
    label: 'Older Titles',
    group: 'cache',
    type: 'text',
    default: String(CACHE_TTL_INFINITE),
    title: 'Cache duration (days) for older titles. -1 = forever',
    row: 'cache-fields',
    validate: validateCacheTtl,
    suffix: 'days',  // NEW
},
{
    key: 'cacheTtlRatedNewYear',
    label: 'Recent Titles',
    group: 'cache',
    type: 'text',
    default: '30',
    title: 'Cache duration (days) for recent titles',
    row: 'cache-fields',
    validate: validateCacheTtl,
    suffix: 'days',  // NEW
},
{
    key: 'cacheTtlNoRating',
    label: 'No Rating',
    group: 'cache',
    type: 'text',
    default: '1',
    title: 'Cache duration (days) for titles without ratings',
    row: 'cache-fields',
    validate: validateCacheTtl,
    suffix: 'days',  // NEW
},

// Add disabled IMDb rating field
{
    key: 'showImdbRating',
    label: 'IMDb',
    group: 'display',
    type: 'checkbox',
    default: true,
    title: 'IMDb score is always shown',
    row: 'ratings-display',
    disabled: true,  // NEW
},
```

### 3.2 `src/core/ui/settings-view.js`

#### 3.2.1 Import Changes

**Remove:**

```javascript
// DELETE: hardcoded GROUPS constant
const GROUPS = {...};

// DELETE: hardcoded ROW_LABELS constant
const ROW_LABELS = {...};
```

**Add:**

```javascript
import { CONFIG_FIELDS, GROUPS, ROW_LABELS } from '../config-fields.js';
```

#### 3.2.2 Constructor Changes

No changes to constructor signature. Accept `fields` parameter (defaults to `CONFIG_FIELDS`).

#### 3.2.3 DOM Structure Changes

| Current Class              | Mockup v19 Class               | Action                                    |
| -------------------------- | ------------------------------ | ----------------------------------------- |
| `.field-row`               | `.field`                       | Rename                                    |
| `.field-row.action-row`    | `.field.field--actions`        | Add modifier class                        |
| `.action-row .field-label` | `.field--actions .field-label` | Update selector, set `visibility: hidden` |
| N/A                        | `.field--checkbox`             | New modifier for single checkbox fields   |
| N/A                        | `.input-with-suffix`           | New container for input + suffix          |
| N/A                        | `.field-suffix`                | New class for suffix text                 |

#### 3.2.4 New Helper Methods

**`#createField(field, settings)`:**

```javascript
// Creates .field element with appropriate modifiers
// - Adds field--checkbox for single checkbox fields
// - Adds field--actions for action rows
// - Sets up label and value container
```

**`#createInputWithSuffix(field, settings)`:**

```javascript
// Creates .input-with-suffix div containing:
// - input element
// - .field-suffix span with field.suffix text
// Only used when field.suffix is defined
```

#### 3.2.5 Modified Methods

**`#groupFieldsByRow(fields)`:**

```javascript
#groupFieldsByRow(fields) {
    const rows = {};
    for (const field of fields) {
        // Only group checkboxes by row; others get individual rows
        const rowId = (field.type === 'checkbox' && field.row) ? field.row : field.key;
        if (!rows[rowId]) {
            rows[rowId] = { id: rowId, fields: [] };
        }
        rows[rowId].fields.push(field);
    }
    return Object.values(rows);
}
```

**`#createGroupElement(group, settings)`:**

- Use `GROUPS[group.id]` for group header icon and label
- No other changes to logic

**`#createFieldRow(row, settings)`:**

```javascript
// 1. Create .field element (not .field-row)
// 2. Determine row label: ROW_LABELS[row.id] || firstField.label
// 3. For action rows: add field--actions modifier, hide label
// 4. For checkbox groups (services, ratings-display):
//    - Create .checkboxes container
//    - Create .service-item for each field
//    - Apply disabled attribute if field.disabled
// 5. For fields with suffix:
//    - Use #createInputWithSuffix()
// 6. For single checkbox fields:
//    - Add field--checkbox modifier
//    - Don't create duplicate label in value column
```

**`#createInput(field, settings)`:**

```javascript
// Add at end:
if (field.disabled) {
    input.disabled = true;
}
```

**`readValues()`:**

```javascript
readValues() {
    const values = {};
    for (const field of this.#fields) {
        if (field.type === 'action') continue;
        if (field.disabled) continue;  // NEW: skip disabled fields
        const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
        if (input) {
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        }
    }
    return values;
}
```

**`validate(values)`:**

```javascript
validate(values) {
    const errors = [];
    for (const field of this.#fields) {
        if (field.type === 'action') continue;
        if (field.disabled) continue;  // NEW: skip disabled fields
        const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
        if (!input) continue;
        const error = field.validate ? field.validate(values[field.key], values) : null;
        input.classList.toggle('error', Boolean(error));
        if (error) errors.push(error);
    }
    return errors;
}
```

**`showStatus(message, type)`:**

```javascript
showStatus(message, type) {
    const status = this.#container.querySelector('[id="fm-status"]');
    if (status) {
        status.textContent = message;
        // Use mockup class names: status--success, status--error
        status.className = type ? `status status--${type}` : 'status';
    }
}
```

#### 3.2.6 Deleted Code

- Remove hardcoded `GROUPS` constant
- Remove hardcoded `ROW_LABELS` constant

### 3.3 `src/core/ui/styles.js`

#### 3.3.1 Replace SETTINGS_STYLES

Replace entire `SETTINGS_STYLES` string with the following, scoped under `.fm-settings-container`:

```css
/* =============================================
   CSS CUSTOM PROPERTIES
   ============================================= */
:root {
    /* Colors - Background */
    --color-bg-primary: #141414;
    --color-bg-secondary: #1e1e1e;
    --color-bg-card: #252526;
    --color-bg-input: #333333;

    /* Colors - Text */
    --color-text-primary: #ffffff;
    --color-text-secondary: #b0b0b0;
    --color-text-muted: #808080;

    /* Colors - Accent & Feedback */
    --color-accent: #e50914;
    --color-accent-hover: #f40612;
    --color-accent-text: #ffffff;
    --color-link: #79f;
    --color-link-hover: #9cf;
    --color-success: #4caf50;
    --color-error: #e05252;

    /* Colors - Borders */
    --color-border: #333333;
    --color-border-input: #555555;

    /* Typography */
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.8125rem;
    --font-size-base: 0.875rem;
    --font-size-lg: 1.25rem;
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;

    /* Spacing */
    --space-xs: 0.25rem;
    --space-sm: 0.375rem;
    --space-md: 0.5rem;
    --space-lg: 0.75rem;
    --space-xl: 1.125rem;
    --space-2xl: 1.25rem;

    /* Borders */
    --border-width-thin: 1px;
    --border-radius-sm: 0.25rem;
    --border-radius-md: 0.375rem;

    /* Focus */
    --focus-ring: 0.125rem;
    --focus-outline-width: 2px;

    /* Layout */
    --label-min-width: clamp(6rem, 20%, 10rem);
    --label-max-width: clamp(8rem, 25%, 12rem);
    --container-max-width: min(100%, 60rem);

    /* Form Controls */
    --input-padding-inline: var(--space-lg);
    --input-padding-block: var(--space-md);
    --input-short-width: 4.5rem;
    --btn-action-width: 8rem;
    --select-padding-end: 1.875rem;
    --checkbox-size: var(--space-xl);

    /* Touch targets for mobile */
    --touch-target-min: 2.25rem;
}

/* =============================================
   BASE STYLES
   ============================================= */
.fm-settings-container {
    font-family: var(--font-family);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    min-block-size: 100vh;
    padding: var(--space-sm);
}

.fm-settings-container * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

.fm-settings-container button {
    font-family: inherit;
    background: none;
    border: none;
    cursor: pointer;
}

/* =============================================
   LAYOUT COMPONENTS
   ============================================= */
.fm-settings-container .settings-layout {
    display: flex;
    flex-direction: column;
}

/* =============================================
   SETTINGS GROUPS
   ============================================= */
.fm-settings-container .settings-group {
    background: var(--color-bg-card);
    border: var(--border-width-thin) solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: var(--space-md);
    margin-block-end: var(--space-md);
}

.fm-settings-container .settings-group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-block-end: var(--space-md);
    padding-block-end: var(--space-sm);
    border-block-end: var(--border-width-thin) solid var(--color-border);
    flex-wrap: wrap;
}

.fm-settings-container .settings-group-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.fm-settings-container .settings-group-icon {
    color: var(--color-accent);
}

/* =============================================
   FIELD SYSTEM
   ============================================= */
.fm-settings-container .field {
    display: grid;
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) minmax(0, 1fr);
    gap: var(--space-md);
    align-items: center;
    margin-block-end: var(--space-sm);
}

.fm-settings-container .field:last-child {
    margin-block-end: 0;
}

/* Field modifiers */
.fm-settings-container .field--checkbox {
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) auto;
}

.fm-settings-container .field--actions {
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) auto;
}

.fm-settings-container .field--actions .field-label {
    visibility: hidden;
}

/* =============================================
   FIELD LABELS
   ============================================= */
.fm-settings-container .field-label {
    text-align: right;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-end: var(--space-sm);
}

.fm-settings-container .field-label a {
    color: var(--color-link);
    text-decoration: none;
}

.fm-settings-container .field-label a:hover {
    color: var(--color-link-hover);
    text-decoration: underline;
}

/* Service item labels (checkbox labels) */
.fm-settings-container .service-item .field-label {
    cursor: pointer;
    text-align: left;
    white-space: normal;
}

/* =============================================
   FIELD VALUES & INPUTS
   ============================================= */
.fm-settings-container .field-value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
}

/* Checkbox inputs */
.fm-settings-container .field input[type='checkbox'] {
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    cursor: pointer;
    accent-color: var(--color-accent);
    grid-column: 2;
    justify-self: start;
}

.fm-settings-container .field input[type='checkbox']:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: 2px;
}

/* Disabled input styling */
.fm-settings-container .field-input:disabled,
.fm-settings-container .service-item input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.fm-settings-container .field-input:disabled:focus,
.fm-settings-container .service-item input[type='checkbox']:disabled:focus {
    border-color: var(--color-border-input);
    outline: none;
}

/* Text inputs */
.fm-settings-container .field-input {
    padding: var(--input-padding-block) var(--input-padding-inline);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    border: var(--border-width-thin) solid var(--color-border-input);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-base);
    font-family: inherit;
}

.fm-settings-container .field-input:focus {
    outline: none;
    border-color: var(--color-accent);
}

.fm-settings-container .field-input:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: -1px;
}

/* Placeholder styling */
.fm-settings-container .field-input::placeholder {
    color: var(--color-text-muted);
    opacity: 1;
}

/* Select inputs */
.fm-settings-container select.field-input {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.625rem center;
    padding-inline-end: var(--select-padding-end);
}

/* Short input fields */
.fm-settings-container .field-input.short {
    width: var(--input-short-width);
    min-inline-size: var(--input-short-width);
    max-inline-size: var(--input-short-width);
    flex: none;
}

/* Input with suffix container */
.fm-settings-container .input-with-suffix {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    white-space: nowrap;
}

/* Suffix text */
.fm-settings-container .field-suffix {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
}

/* =============================================
   CHECKBOX GROUPS & SERVICE ITEMS
   ============================================= */
.fm-settings-container .service-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.fm-settings-container .checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
    align-items: center;
}

/* =============================================
   ACTION BUTTONS
   ============================================= */
.fm-settings-container .action-btn {
    padding: var(--space-xs) var(--space-md);
    background: transparent;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    border: var(--border-width-thin) solid var(--color-border-input);
    border-radius: var(--border-radius-sm);
    display: inline-block;
    white-space: nowrap;
    transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
}

.fm-settings-container .action-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-input);
    border-color: var(--color-accent);
}

.fm-settings-container .action-btn:active {
    color: var(--color-accent);
    background: var(--color-border);
}

.fm-settings-container .action-btn:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: 2px;
}

.fm-settings-container .field--actions .action-btn {
    grid-column: 2;
    justify-self: start;
    width: var(--btn-action-width);
}

/* =============================================
   RESPONSIVE LAYOUT
   ============================================= */
@media (max-inline-size: 40rem) {
    .fm-settings-container .field {
        align-items: start;
    }

    .fm-settings-container .field-label {
        text-align: left;
        white-space: normal;
        padding-inline-end: var(--space-md);
        margin-top: 0;
    }

    /* Text input rows: align label with input text baseline */
    .fm-settings-container .field:not(.field--checkbox):not(.field--actions) .field-label {
        margin-top: 0;
    }

    .fm-settings-container .field:not(.field--checkbox):not(.field--actions) {
        align-items: baseline;
    }

    .fm-settings-container .field-value,
    .fm-settings-container .checkboxes {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-sm);
        width: 100%;
    }

    .fm-settings-container .field-input {
        width: 100%;
        min-block-size: var(--touch-target-min);
    }

    .fm-settings-container .input-with-suffix {
        width: 100%;
    }

    .fm-settings-container .field input[type='checkbox'],
    .fm-settings-container .service-item input[type='checkbox'] {
        margin-top: 0;
    }

    .fm-settings-container .service-item {
        justify-content: flex-start;
        align-items: flex-start;
        width: 100%;
    }

    .fm-settings-container .field--actions .action-btn {
        grid-column: 2;
        justify-self: start;
        width: var(--btn-action-width);
        min-block-size: var(--touch-target-min);
    }
}

/* =============================================
   STATUS & NOTIFICATIONS
   ============================================= */
.fm-settings-container .status {
    text-align: center;
    margin-block-start: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    min-block-size: var(--space-xl);
}

.fm-settings-container .status--success {
    color: var(--color-success);
}

.fm-settings-container .status--error {
    color: var(--color-error);
}

/* =============================================
   UTILITY: Visually Hidden
   ============================================= */
.fm-settings-container .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
    padding: 0;
}
```

#### 3.3.2 ID Changes

| Current     | Mockup v19                                     | Action                         |
| ----------- | ---------------------------------------------- | ------------------------------ |
| `fm-status` | Keep `fm-status` as ID, but add `status` class | Add class alongside ID for CSS |

Note: Keep all `fm-*` IDs for JavaScript selector compatibility, but add appropriate classes for CSS styling.

---

## 4. Behavior Preservation

### 4.1 Autosave

- **Current:** Debounced save on input/change events (1000ms)
- **Mockup v19:** Auto-save pattern (no Save button)
- **Implementation:** Keep existing `#setupAutoSave()` logic unchanged

### 4.2 Validation

- **Current:** Field-level validation via `validate` function in CONFIG_FIELDS
- **Mockup v19:** Error messages displayed, invalid fields highlighted
- **Implementation:** Keep existing validation logic, update error class to match mockup

### 4.3 Action Handlers

- **Current:** `clearCache`, `resetClients` callbacks via `SettingsUI`
- **Mockup v19:** "Clear Cache" and "Reset Providers" buttons
- **Implementation:** Keep existing callback mechanism, update button styling

### 4.4 Status Display

- **Current:** `showStatus(message, type)` with `fm-status--error`, `fm-status--success`
- **Mockup v19:** `status`, `status--error`, `status--success` classes
- **Implementation:** Update class names in `showStatus()` method

---

## 5. DOM ID Conventions

All input elements must have IDs matching the pattern `fm-{field.key}` for JavaScript selectors:

```
fm-enableNetflix
fm-enableHboMax
fm-enableDisneyPlus
fm-showImdbRating
fm-showMcRating
fm-showRtRating
fm-overlayCorner
fm-apiClient
fm-omdbApiKey
fm-xmdbApiKey
fm-enableFadeUnderRating
fm-fadeRatingThreshold
fm-enableFadeToggle
fm-cacheTtlRatedOldYear
fm-cacheTtlRatedNewYear
fm-cacheTtlNoRating
fm-debug
fm-clearCache (action button)
fm-resetClients (action button)
```

Status element: `fm-status` (ID preserved for compatibility)

---

## 6. Testing Considerations

### 6.1 Unit Tests

- Update selectors in `tests/unit/ui/settings-view.test.js` to match new class names
- Verify `readValues()` skips disabled fields
- Verify `validate()` skips disabled fields
- Verify new `suffix` property renders correctly
- Verify new `disabled` property renders correctly

### 6.2 UI Tests

- Update fixture expectations to match new DOM structure
- Verify group headers have icons
- Verify checkbox groups render horizontally
- Verify cache fields have suffix text
- Verify action buttons have outline styling
- Verify responsive layout at < 40rem viewport

---

## 7. Migration Steps

1. Update `config-fields.js` (add GROUPS, ROW_LABELS, modify fields)
2. Update `settings-view.js` (refactor DOM generation, update methods)
3. Update `styles.js` (replace SETTINGS_STYLES)
4. Update tests (selectors, expectations)
5. Verify build passes
6. Manual verification in browser

---

## 8. Open Questions

None at this time.

---

## Appendix A: Complete CONFIG_FIELDS with New Properties

```javascript
// Groups and row labels
win.GROUPS = {
    services: { label: 'Streaming Services', icon: '📺' },
    display: { label: 'Display Settings', icon: '🎨' },
    providers: { label: 'Rating Providers', icon: '📊' },
    fade: { label: 'Fade Settings', icon: '🌑' },
    cache: { label: 'Cache Settings', icon: '💾' },
    debug: { label: 'Debug', icon: '🐛' },
};

win.ROW_LABELS = {
    services: 'Show on',
    'ratings-display': 'Show',
};

win.CONFIG_FIELDS = [
    {
        key: 'enableNetflix',
        label: 'Netflix',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Netflix',
        row: 'services',
    },
    {
        key: 'enableHboMax',
        label: 'HBO Max',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on HBO Max',
        row: 'services',
    },
    {
        key: 'enableDisneyPlus',
        label: 'Disney+',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Disney+',
        row: 'services',
    },
    {
        key: 'overlayCorner',
        label: 'Badge Position',
        group: 'display',
        type: 'select',
        options: [
            ['top-left', 'Top Left'],
            ['top-right', 'Top Right'],
            ['bottom-left', 'Bottom Left'],
            ['bottom-right', 'Bottom Right'],
        ],
        default: 'top-left',
        title: 'Badge position on thumbnails',
    },
    {
        key: 'showImdbRating',
        label: 'IMDb',
        group: 'display',
        type: 'checkbox',
        default: true,
        title: 'IMDb score is always shown',
        row: 'ratings-display',
        disabled: true, // NEW
    },
    {
        key: 'showMcRating',
        label: 'Metacritic',
        group: 'display',
        type: 'checkbox',
        default: false,
        title: 'Show Metacritic score',
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Rotten Tomatoes',
        group: 'display',
        type: 'checkbox',
        default: false,
        title: 'Show Rotten Tomatoes score',
        row: 'ratings-display',
    },
    {
        key: 'apiClient',
        label: 'Rating Provider',
        group: 'providers',
        type: 'select',
        options: [
            ['agregarr', 'Agregarr'],
            ['omdb', 'OMDb'],
            ['xmdb', 'XMDb'],
        ],
        default: 'agregarr',
        title: 'Rating data source',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDb API Key',
        group: 'providers',
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text',
        default: '',
        title: 'OMDb key. Needed if OMDb is selected',
        validate: (val, allValues) => {
            if (allValues?.apiClient !== 'omdb') return null;
            return val && val.length > 0 ? null : 'OMDb API Key is required';
        },
    },
    {
        key: 'xmdbApiKey',
        label: 'XMDb API Key',
        group: 'providers',
        labelUrl: 'https://xmdbapi.com/api-key',
        type: 'text',
        default: '',
        title: 'XMDb key. Needed if XMDb is selected',
        validate: (val, allValues) => {
            if (allValues?.apiClient !== 'xmdb') return null;
            return val && val.length > 0 ? null : 'XMDb API Key is required';
        },
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade below rating',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Fade thumbnails rated below threshold',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Threshold',
        group: 'fade',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating threshold (0-10)',
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Fade threshold must be a number between 0 and 10';
            const n = Number(val);
            return !Number.isNaN(n) && n >= 0.0 && n <= 10.0
                ? null
                : 'Fade threshold must be a number between 0 and 10';
        },
    },
    {
        key: 'enableFadeToggle',
        label: 'Allow override',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Allow manual override of fade state on supported title surfaces',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Older Titles',
        group: 'cache',
        type: 'text',
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration (days) for older titles. -1 = forever',
        section: 'Cache Settings',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days', // NEW
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Recent Titles',
        group: 'cache',
        type: 'text',
        default: '30',
        title: 'Cache duration (days) for recent titles',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days', // NEW
    },
    {
        key: 'cacheTtlNoRating',
        label: 'No Rating',
        group: 'cache',
        type: 'text',
        default: '1',
        title: 'Cache duration (days) for titles without ratings',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days', // NEW
    },
    {
        key: 'debug',
        label: 'Enable debug logging',
        group: 'debug',
        type: 'checkbox',
        default: true,
        title: 'Enable debug logging in console',
        row: 'debug-settings',
    },
    {
        key: 'clearCache',
        type: 'action',
        group: 'debug',
        row: 'action-clearCache',
        label: '',
        actionLabel: 'Clear Cache',
        default: null,
    },
    {
        key: 'resetClients',
        type: 'action',
        group: 'debug',
        row: 'action-resetClients',
        label: '',
        actionLabel: 'Reset Providers',
        default: null,
    },
];
```
