# Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Settings UI design specification to match the defined visual design and DOM structure while preserving all existing functionality.

**Architecture:** Refactor `settings-view.js` to use centralized UI metadata from `config-fields.js` (GROUPS, ROW_LABELS), introduce new field properties (suffix, disabled), and update `styles.js` with the new CSS. Maintain decoupling between configuration and rendering.

**Tech Stack:** JavaScript ES2022, CSS Custom Properties, DOM manipulation, Vitest + jsdom for testing

## Global Constraints

- Keep `SettingsUI` class public API unchanged
- Preserve autosave, validation, and action handling behavior
- Keep `CONFIG_FIELDS` as single source of truth for field definitions
- Maintain decoupling between configuration and rendering
- All changes scoped under `.fm-settings-container`
- Use checkbox (`- [ ]`) syntax for task tracking

---

## File Structure

| File                                       | Responsibility                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/core/config-fields.js`                | Add GROUPS, ROW_LABELS exports; add suffix/disabled properties to fields                                    |
| `src/core/ui/settings-view.js`             | Refactor DOM generation: rename .field-row to .field, add modifiers, support suffix, handle disabled fields |
| `src/core/ui/styles.js`                    | Replace SETTINGS_STYLES with new CSS from design spec                                                       |
| `tests/unit/core/config-fields.test.js`    | Add tests for new GROUPS and ROW_LABELS exports                                                             |
| `tests/unit/core/ui/settings-view.test.js` | Update selectors for new class names, add tests for suffix/disabled                                         |

---

## Task 1: Update config-fields.js with UI Metadata

**Files:**

- Modify: `src/core/config-fields.js`
- Test: `tests/unit/core/config-fields.test.js`

**Interfaces:**

- Produces: `GROUPS` object (exported), `ROW_LABELS` object (exported), new field properties: `suffix` (string), `disabled` (boolean)

- [ ] **Step 1: Add GROUPS export**

Add after CONFIG_FIELDS definition:

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

- [ ] **Step 2: Add ROW_LABELS export**

Add after GROUPS:

```javascript
export const ROW_LABELS = {
    services: 'Show on',
    'ratings-display': 'Show',
};
```

- [ ] **Step 3: Add suffix property to cache TTL fields**

Modify the three cache TTL field definitions in CONFIG_FIELDS:

```javascript
{
    key: 'cacheTtlRatedOldYear',
    label: 'Older Titles',
    group: 'cache',
    type: 'text',
    default: String(CACHE_TTL_INFINITE),
    title: 'Cache duration (days) for older titles. -1 = forever',
    row: 'cache-fields',
    validate: validateCacheTtl,
    suffix: 'days',
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
    suffix: 'days',
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
    suffix: 'days',
},
```

- [ ] **Step 4: Add disabled property to showImdbRating field**

Modify the showImdbRating field definition:

```javascript
{
    key: 'showImdbRating',
    label: 'IMDb',
    group: 'display',
    type: 'checkbox',
    default: true,
    title: 'IMDb score is always shown',
    row: 'ratings-display',
    disabled: true,
},
```

- [ ] **Step 5: Write tests for new exports**

Create or update test file:

```javascript
import { assert, describe, it } from 'vitest';
import { GROUPS, ROW_LABELS, CONFIG_FIELDS } from '../../../src/core/config-fields.js';

describe('config-fields UI metadata', () => {
    it('should export GROUPS with all required groups', () => {
        assert.hasOwnProperty(GROUPS, 'services');
        assert.hasOwnProperty(GROUPS, 'display');
        assert.hasOwnProperty(GROUPS, 'providers');
        assert.hasOwnProperty(GROUPS, 'fade');
        assert.hasOwnProperty(GROUPS, 'cache');
        assert.hasOwnProperty(GROUPS, 'debug');
    });

    it('should export ROW_LABELS with services and ratings-display', () => {
        assert.equal(ROW_LABELS.services, 'Show on');
        assert.equal(ROW_LABELS['ratings-display'], 'Show');
    });

    it('should have cache fields with suffix property', () => {
        const cacheFields = CONFIG_FIELDS.filter(f => f.group === 'cache' && f.type === 'text');
        cacheFields.forEach(field => {
            assert.hasOwnProperty(field, 'suffix');
            assert.equal(field.suffix, 'days');
        });
    });

    it('should have showImdbRating field with disabled property', () => {
        const imdbField = CONFIG_FIELDS.find(f => f.key === 'showImdbRating');
        assert.exists(imdbField);
        assert.isTrue(imdbField.disabled);
    });
});
```

- [ ] **Step 6: Run tests**

Run: `npm run test:unit -- tests/unit/core/config-fields.test.js`
Expected: All tests PASS

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/core/config-fields.js tests/unit/core/config-fields.test.js
git commit -m "feat(config): add GROUPS, ROW_LABELS exports and field metadata

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 2: Update styles.js with New CSS

**Files:**

- Modify: `src/core/ui/styles.js`

**Interfaces:**

- Consumes: None (standalone CSS update)
- Produces: Updated `SETTINGS_STYLES` string constant

- [ ] **Step 1: Replace SETTINGS_STYLES**

Replace the entire `SETTINGS_STYLES` string in `src/core/ui/styles.js` with the CSS from the design spec, ensuring it is scoped under `.fm-settings-container`. The CSS should include all sections: Custom Properties, Base Styles, Layout Components, Settings Groups, Field System, Field Labels, Field Values & Inputs, Checkbox Groups & Service Items, Action Buttons, Responsive Layout, Status & Notifications, and Utility classes.

The complete CSS is available in the design specification document at `docs/superpowers/specs/2026-08-23-settings-ui-design.md` section 3.3.1.

- [ ] **Step 2: Verify CSS syntax**

Run: `npm run build`
Expected: Build completes without CSS errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/styles.js
git commit -m "feat(styles): update settings UI CSS to match new design

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 3: Refactor settings-view.js DOM Generation

**Files:**

- Modify: `src/core/ui/settings-view.js`
- Test: `tests/unit/core/ui/settings-view.test.js`

**Interfaces:**

- Consumes: `GROUPS` from config-fields.js, `ROW_LABELS` from config-fields.js
- Produces: Updated DOM with .field classes, modifiers, suffix support, disabled handling

- [ ] **Step 1: Update imports**

Change from:

```javascript
import { CONFIG_FIELDS } from '../config-fields.js';
```

To:

```javascript
import { CONFIG_FIELDS, GROUPS, ROW_LABELS } from '../config-fields.js';
```

- [ ] **Step 2: Remove hardcoded GROUPS and ROW_LABELS**

Delete any local definitions of `GROUPS` or `ROW_LABELS` constants in the file.

- [ ] **Step 3: Update #createGroupElement to use GROUPS**

Modify to use imported GROUPS:

```javascript
#createGroupElement(group, settings) {
    const groupMeta = GROUPS[group.id];
    const header = document.createElement('div');
    header.className = 'settings-group-header';

    const icon = document.createElement('span');
    icon.className = 'settings-group-icon';
    icon.textContent = groupMeta.icon;

    const title = document.createElement('span');
    title.className = 'settings-group-title';
    title.textContent = groupMeta.label;

    header.append(icon, title);
    // ... rest of method
}
```

- [ ] **Step 4: Update #groupFieldsByRow**

Replace with:

```javascript
#groupFieldsByRow(fields) {
    const rows = {};
    for (const field of fields) {
        const rowId = (field.type === 'checkbox' && field.row) ? field.row : field.key;
        if (!rows[rowId]) {
            rows[rowId] = { id: rowId, fields: [] };
        }
        rows[rowId].fields.push(field);
    }
    return Object.values(rows);
}
```

- [ ] **Step 5: Add #createInputWithSuffix helper**

Add new method:

```javascript
#createInputWithSuffix(field, settings) {
    const container = document.createElement('div');
    container.className = 'input-with-suffix';

    const input = this.#createInput(field, settings);
    container.appendChild(input);

    if (field.suffix) {
        const suffix = document.createElement('span');
        suffix.className = 'field-suffix';
        suffix.textContent = field.suffix;
        container.appendChild(suffix);
    }

    return container;
}
```

- [ ] **Step 6: Update #createFieldRow to use .field and modifiers**

Refactor to create `.field` elements instead of `.field-row`, add modifiers:

```javascript
#createFieldRow(row, settings) {
    const fieldElement = document.createElement('div');

    // Determine if this is an action row
    const isActionRow = row.fields.every(f => f.type === 'action');
    if (isActionRow) {
        fieldElement.className = 'field field--actions';
    } else if (row.fields.length === 1 && row.fields[0].type === 'checkbox' && !row.fields[0].row) {
        fieldElement.className = 'field field--checkbox';
    } else {
        fieldElement.className = 'field';
    }

    // Create label
    const label = document.createElement('label');
    label.className = 'field-label';

    // For action rows, hide label and use empty text
    if (isActionRow) {
        label.textContent = '\u00A0';
        label.style.visibility = 'hidden';
    } else {
        const rowLabel = ROW_LABELS[row.id] || row.fields[0].label;
        label.textContent = rowLabel;
        if (row.fields[0].id) {
            label.htmlFor = row.fields[0].id;
        }
    }

    fieldElement.appendChild(label);

    // Create value container
    const valueContainer = document.createElement('div');
    valueContainer.className = 'field-value';

    // Handle different field types
    for (const field of row.fields) {
        if (field.type === 'checkbox' && row.fields.length > 1) {
            // Checkbox group
            const checkboxes = document.createElement('div');
            checkboxes.className = 'checkboxes';
            for (const checkboxField of row.fields) {
                const item = document.createElement('div');
                item.className = 'service-item';
                const input = this.#createInput(checkboxField, settings);
                const cbLabel = document.createElement('label');
                cbLabel.className = 'field-label';
                cbLabel.textContent = checkboxField.label;
                cbLabel.htmlFor = `fm-${checkboxField.key}`;
                item.append(input, cbLabel);
                checkboxes.appendChild(item);
            }
            valueContainer.appendChild(checkboxes);
        } else if (field.type === 'action') {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.id = `fm-${field.key}`;
            btn.textContent = field.actionLabel;
            btn.addEventListener('click', this.#actions[field.key]);
            valueContainer.appendChild(btn);
        } else {
            if (field.suffix) {
                valueContainer.appendChild(this.#createInputWithSuffix(field, settings));
            } else {
                valueContainer.appendChild(this.#createInput(field, settings));
            }
        }
    }

    fieldElement.appendChild(valueContainer);
    return fieldElement;
}
```

- [ ] **Step 7: Update #createInput to handle disabled fields**

Add at the end of the method:

```javascript
if (field.disabled) {
    input.disabled = true;
}
```

- [ ] **Step 8: Update readValues to skip disabled fields**

Modify to:

```javascript
readValues() {
    const values = {};
    for (const field of this.#fields) {
        if (field.type === 'action') continue;
        if (field.disabled) continue;
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

- [ ] **Step 9: Update validate to skip disabled fields**

Modify to:

```javascript
validate(values) {
    const errors = [];
    for (const field of this.#fields) {
        if (field.type === 'action') continue;
        if (field.disabled) continue;
        const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
        if (!input) continue;
        const error = field.validate ? field.validate(values[field.key], values) : null;
        input.classList.toggle('error', Boolean(error));
        if (error) errors.push(error);
    }
    return errors;
}
```

- [ ] **Step 10: Update showStatus to use new class names**

Modify to:

```javascript
showStatus(message, type) {
    const status = this.#container.querySelector('[id="fm-status"]');
    if (status) {
        status.textContent = message;
        status.className = type ? `status status--${type}` : 'status';
    }
}
```

- [ ] **Step 11: Update render to add status class**

Ensure the status element has both the ID and class:

```javascript
const statusEl = document.createElement('div');
statusEl.id = 'fm-status';
statusEl.className = 'status';
```

- [ ] **Step 12: Run build**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 13: Run existing tests**

Run: `npm run test:unit -- tests/unit/core/ui/settings-view.test.js`
Expected: Tests may fail due to selector changes - note failures for Task 4

- [ ] **Step 14: Commit**

```bash
git add src/core/ui/settings-view.js
git commit -m "feat(ui): refactor settings-view DOM to match new design

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 4: Update settings-view Tests

**Files:**

- Modify: `tests/unit/core/ui/settings-view.test.js`

**Interfaces:**

- Consumes: Updated class names from Task 3

- [ ] **Step 1: Update selectors for .field instead of .field-row**

Replace all instances of `.field-row` with `.field` in selectors.

- [ ] **Step 2: Update selectors for action rows**

Replace `.field-row.action-row` with `.field.field--actions`.

- [ ] **Step 3: Add tests for disabled field handling**

Add test:

```javascript
it('should skip disabled fields in readValues', () => {
    const fields = [
        { key: 'enabledField', type: 'text', default: 'value' },
        { key: 'disabledField', type: 'text', default: 'value', disabled: true },
    ];
    const view = new SettingsView({ fields });
    const container = document.createElement('div');
    view.render(container, { enabledField: 'test', disabledField: 'ignored' });

    const values = view.readValues();
    assert.hasOwnProperty(values, 'enabledField');
    assert.notHasOwnProperty(values, 'disabledField');
});
```

- [ ] **Step 4: Add tests for suffix rendering**

Add test:

```javascript
it('should render suffix text for fields with suffix property', () => {
    const fields = [{ key: 'cacheDays', type: 'text', default: '30', suffix: 'days' }];
    const view = new SettingsView({ fields });
    const container = document.createElement('div');
    view.render(container, { cacheDays: '30' });

    const suffixEl = container.querySelector('.field-suffix');
    assert.exists(suffixEl);
    assert.equal(suffixEl.textContent, 'days');
});
```

- [ ] **Step 5: Add tests for field--checkbox modifier**

Add test:

```javascript
it('should add field--checkbox modifier for single checkbox fields', () => {
    const fields = [{ key: 'singleCheckbox', type: 'checkbox', default: true }];
    const view = new SettingsView({ fields });
    const container = document.createElement('div');
    view.render(container, { singleCheckbox: true });

    const fieldEl = container.querySelector('.field--checkbox');
    assert.exists(fieldEl);
});
```

- [ ] **Step 6: Add tests for field--actions modifier**

Add test:

```javascript
it('should add field--actions modifier and hide label for action rows', () => {
    const fields = [{ key: 'clearCache', type: 'action', actionLabel: 'Clear' }];
    const view = new SettingsView({ fields, actions: { clearCache: () => {} } });
    const container = document.createElement('div');
    view.render(container, {});

    const actionField = container.querySelector('.field--actions');
    assert.exists(actionField);

    const label = actionField.querySelector('.field-label');
    assert.equal(getComputedStyle(label).visibility, 'hidden');
});
```

- [ ] **Step 7: Run tests**

Run: `npm run test:unit -- tests/unit/core/ui/settings-view.test.js`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add tests/unit/core/ui/settings-view.test.js
git commit -m "test(ui): update settings-view tests for new DOM structure

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 5: Final Integration and Verification

**Files:**

- All modified files from Tasks 1-4

**Interfaces:**

- Consumes: All previous task outputs

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run lint and format**

Run: `npm run lint && npm run format`
Expected: No errors, formatting applied

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: All targets build successfully

- [ ] **Step 4: Manual verification**

Open the options page in a browser and verify:

- Settings UI renders with new styling
- All fields visible and functional
- Checkbox groups display horizontally
- Cache fields show "days" suffix
- IMDb rating field is disabled
- Action buttons have outline styling
- Responsive layout works at < 40rem viewport

- [ ] **Step 5: Commit final verification**

```bash
git add .
git commit -m "feat: implement settings UI design specification

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Self-Review Checklist

**1. Spec coverage:**

- [ ] Task 1 covers config-fields.js changes (GROUPS, ROW_LABELS, suffix, disabled)
- [ ] Task 2 covers styles.js CSS replacement
- [ ] Task 3 covers settings-view.js DOM refactoring
- [ ] Task 4 covers test updates
- [ ] Task 5 covers integration and verification

**2. Placeholder scan:**

- [ ] No TBD, TODO, or placeholder text in any task
- [ ] All code blocks contain complete, runnable code
- [ ] All test code is complete and specific

**3. Type consistency:**

- [ ] GROUPS and ROW_LABELS used consistently across Tasks 1 and 3
- [ ] suffix and disabled properties referenced consistently
- [ ] Class names match between implementation and tests

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-24-settings-ui-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
