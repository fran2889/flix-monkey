# SettingsUI Validation and Saving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement validation and saving functionality in the `SettingsUI` rendering engine.

**Architecture:** Add `_validate` to perform form validation against `CONFIG_FIELDS` and update the DOM, and `save` to collect values, trigger validation, use the adapter for persistence, and provide user feedback.

**Tech Stack:** JavaScript (ES6+), Vitest

---

### Task 1: Add validation and save logic to `SettingsUI`

**Files:**

- Modify: `src/core/ui/settings-ui.js`

- [ ] **Step 1: Implement `_validate()` in `SettingsUI` class**

```javascript
    _validate() {
        let hasErrors = false;
        this.fields.forEach(field => {
            const input = document.getElementById(`fm-${field.key}`);
            if (!input) return;

            const errorMsg = field.validate ? field.validate(input.value) : null;
            let errorEl = input.parentElement.querySelector('.error-message');

            if (errorMsg) {
                hasErrors = true;
                if (!errorEl) {
                    errorEl = document.createElement('div');
                    errorEl.className = 'error-message';
                    input.parentElement.appendChild(errorEl);
                }
                errorEl.textContent = errorMsg;
                input.classList.add('error');
            } else {
                if (errorEl) {
                    errorEl.remove();
                }
                input.classList.remove('error');
            }
        });
        return !hasErrors;
    }
```

- [ ] **Step 2: Implement `save()` in `SettingsUI` class**

```javascript
    async save() {
        const isValid = this._validate();
        const statusDiv = document.getElementById('fm-status');

        if (!isValid) {
            statusDiv.textContent = 'Please fix errors before saving.';
            statusDiv.style.color = 'red';
            return;
        }

        const values = {};
        this.fields.forEach(field => {
            const input = document.getElementById(`fm-${field.key}`);
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        });

        await this.adapter.storageSetMany(values);
        statusDiv.textContent = 'Saved!';
        statusDiv.style.color = 'green';
    }
```

- [ ] **Step 3: Wire up Save button in `render()`**

Modify `render` method in `src/core/ui/settings-ui.js`:

```javascript
const saveBtn = document.createElement('button');
saveBtn.id = 'fm-saveBtn';
saveBtn.textContent = 'Save';
saveBtn.onclick = () => this.save(); // Add this line
actionsDiv.appendChild(saveBtn);
```

- [ ] **Step 4: Commit changes**

```bash
git add src/core/ui/settings-ui.js
git commit -m "feat(ui): implement validation and save functionality in SettingsUI"
```

### Task 2: Add unit tests for validation and saving

**Files:**

- Modify: `tests/unit/core/ui/settings-ui.test.js`

- [ ] **Step 1: Setup save button mock and storage mock**

Update `tests/unit/core/ui/settings-ui.test.js` to include:

```javascript
beforeEach(() => {
    // ... previous setup ...
    adapter = {
        storageGetAll: vi.fn().mockResolvedValue({}),
        storageSetMany: vi.fn().mockResolvedValue(),
    };
    // ...
});
```

- [ ] **Step 2: Add test: "should not save when validation fails"**

```javascript
it('should not save when validation fails', async () => {
    await settingsUI.render(container);
    const apiKeyInput = container.querySelector('[id="fm-xmdbApiKey"]');
    apiKeyInput.value = ''; // Trigger validation error

    const saveBtn = container.querySelector('#fm-saveBtn');
    await saveBtn.click();

    expect(adapter.storageSetMany).not.toHaveBeenCalled();
    expect(container.querySelector('#fm-status').textContent).toBe('Please fix errors before saving.');
});
```

- [ ] **Step 3: Add test: "should save when validation passes"**

```javascript
it('should save when validation passes', async () => {
    await settingsUI.render(container);
    const apiKeyInput = container.querySelector('[id="fm-xmdbApiKey"]');
    apiKeyInput.value = 'new-api-key';

    const saveBtn = container.querySelector('#fm-saveBtn');
    await saveBtn.click();

    expect(adapter.storageSetMany).toHaveBeenCalledWith(
        expect.objectContaining({
            xmdbApiKey: 'new-api-key',
        })
    );
    expect(container.querySelector('#fm-status').textContent).toBe('Saved!');
});
```

- [ ] **Step 4: Run tests**

```bash
npm test tests/unit/core/ui/settings-ui.test.js
```

- [ ] **Step 5: Commit changes**

```bash
git add tests/unit/core/ui/settings-ui.test.js
git commit -m "test(ui): add validation and saving tests for SettingsUI"
```
