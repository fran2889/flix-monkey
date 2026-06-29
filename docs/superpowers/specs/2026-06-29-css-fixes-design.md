# CSS Fixes: Overlay & Settings UI

**Date:** 2026-06-29
**Files touched:** `src/core/overlay.js`, `src/core/ui/styles.js`, `src/core/ui/settings-ui.js`

---

## Issues

### 1. Validation errors are unstyled and in the wrong location

`#validate()` creates `.error-message` divs inside each field container. There is no CSS rule for `.error-message`, so they render as default browser text — wrong colour, wrong size, not integrated with the design.

**Fix:** Remove the `.error-message` div creation entirely. Collect error text in `#validate()` and return it. `save()` displays all error messages in `#fm-status` (one per line). Add `white-space: pre-line` to the `#fm-status` rule so newlines render. The `.error` class stays on invalid inputs as a red-border highlight (see issue 2).

### 2. `.error` class on invalid inputs has no CSS rule

`#validate()` calls `input.classList.add('error')` on failing fields, but no rule in `SETTINGS_STYLES` targets `.error`. Inputs show no visual error state.

**Fix:** Add to `SETTINGS_STYLES`:

```css
.fm-settings-container .field input.error,
.fm-settings-container .field select.error {
    border-color: #e05252;
}
```

### 3. Status colour set via inline style, bypassing the CSS system

`statusDiv.style.color = 'red'` and `statusDiv.style.color = 'green'` appear across six call sites in `save()`, `clearCache()`, and `resetClients()`. Inline styles override any class-based rule. The named colours `red` (#ff0000) and `green` (#008000) are not in the project palette.

**Fix:** Add semantic classes to `SETTINGS_STYLES`:

```css
.fm-settings-container #fm-status.fm-status--error {
    color: #e05252;
}
.fm-settings-container #fm-status.fm-status--success {
    color: #4caf50;
}
```

Replace all six inline assignments with `statusDiv.className = 'fm-status--error'`, `'fm-status--success'`, or `''`.

### 4. `.fm-modal-body` has no CSS rule

`modal.js` creates a `<div class="fm-modal-body">` as the content container. `SETTINGS_STYLES` defines five `.fm-modal-*` rules but is missing this one. The body renders with no padding.

**Fix:** Add:

```css
.fm-modal-body {
    padding: 0 4px;
}
```

### 5. Three fade-toggle rules are unscoped globals

These rules in `injectStyles()` are bare globals injected into the Netflix page:

```css
.fm-fade-toggle {
    cursor: pointer;
}
.fm-fade-toggle .fm-label {
    color: #aaa;
}
.fm-fade-toggle--faded {
    opacity: 0.35;
}
```

Any Netflix element carrying these class names will receive unexpected styling.

**Fix:** Scope all three under `.fm-rating-overlay`:

```css
.fm-rating-overlay .fm-fade-toggle {
    cursor: pointer;
}
.fm-rating-overlay .fm-fade-toggle .fm-label {
    color: #aaa;
}
.fm-rating-overlay .fm-fade-toggle--faded {
    opacity: 0.35;
}
```

### 6. `cursor: default` on all labels blocks pointer affordance for checkbox labels

`.fm-settings-container .field label { cursor: default; }` applies to every label. Checkbox labels are interactive (clicking them toggles the checkbox), but the override hides that affordance.

**Fix:** Remove `cursor: default` from the label rule and let the browser default apply (pointer for checkbox labels, default for text labels).

### 7. Font-family mismatch between overlay badges and settings panel

Overlay badges use `Arial, sans-serif`. The settings panel uses `'Helvetica Neue', Helvetica, Arial, sans-serif`. Both surfaces appear on the same Netflix page.

**Fix:** Update the badge font-family in `injectStyles()` to `'Helvetica Neue', Helvetica, Arial, sans-serif`.

### 8. `border-radius: 5px` on the modal, `4px` everywhere else

`.fm-modal-content` uses `border-radius: 5px`. Every other rounded element in both files uses `4px`.

**Fix:** Change `.fm-modal-content` to `border-radius: 4px`.

### 9. Focus indicator inaccessible in forced-colour environments

Text inputs and selects suppress the browser outline via `outline: none`. The only replacement is `border-color: #e50914` on `:focus`. In Windows High Contrast / `forced-colors: active` mode, author-specified border colours are overridden by the system palette, leaving keyboard users with no visible focus indicator.

**Fix:** Add an explicit outline alongside the border change:

```css
.fm-settings-container .field input[type='text']:focus,
.fm-settings-container .field select:focus {
    border-color: #e50914;
    outline: 2px solid #e50914;
    outline-offset: 1px;
}
```

### 10. `.visually-hidden` uses deprecated `clip` with no modern fallback

The implementation uses `clip: rect(0, 0, 0, 0)`, which is deprecated. It is also missing `clip-path: inset(50%)`, `border: 0`, and `padding: 0` from the current canonical pattern.

**Fix:** Update the rule:

```css
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

### 11. Two separate `.fm-settings-container` rule blocks

`SETTINGS_STYLES` opens with a `.fm-settings-container { box-sizing: border-box; }` block, then immediately follows with a second `.fm-settings-container { ... }` block containing all other properties. The first can be merged into the second.

**Fix:** Merge the `box-sizing` declaration into the main `.fm-settings-container` block.

### 12. Redundant `pointer-events: auto` on `.fm-rating-overlay a`

The `.fm-rating-overlay > *` rule already sets `pointer-events: auto` on all direct children, including the IMDb `<a>`. The duplicate declaration on `.fm-rating-overlay a` is inert.

**Note:** `cursor: pointer` on the same rule is intentional and must be kept — it overrides the `cursor: default` inherited from `> *`.

**Fix:** Remove the `pointer-events: auto` declaration from `.fm-rating-overlay a`, keeping `cursor: pointer`.

---

## Constraints

- MC and RT badges are `<div>` elements (not links). They capture clicks via `stopPropagation` listeners and show `cursor: default` via the `> *` rule. Nothing in this spec changes that behaviour.
- The `field-label` and `field-input` class names assigned in `settings-ui.js` are dead CSS hooks (no rule targets them). They are harmless and out of scope.

---

## File summary

| File                         | Changes                         |
| ---------------------------- | ------------------------------- |
| `src/core/ui/settings-ui.js` | Issues 1, 3                     |
| `src/core/ui/styles.js`      | Issues 2, 3, 4, 6, 8, 9, 10, 11 |
| `src/core/overlay.js`        | Issues 5, 7, 12                 |
