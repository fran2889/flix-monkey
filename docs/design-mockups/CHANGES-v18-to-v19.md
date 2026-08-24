# Settings Mockup Changes: v18 → v19

**Date**: 2026-08-23  
**Base**: `settings-mockup-v18.html` (with v20 CSS refactor)  
**Target**: `settings-mockup-v19.html`  
**Purpose**: Apply UX improvements from review feedback

---

## Quick Reference

| Change # | Description                 | File Location               | Revert Possible |
| -------- | --------------------------- | --------------------------- | --------------- |
| 1        | Action button outline style | `.action-btn`               | ✅ Yes          |
| 2        | Action button hover state   | `.action-btn:hover`         | ✅ Yes          |
| 3        | Status message contrast     | `.status`                   | ✅ Yes          |
| 4        | Mobile checkbox spacing     | `@media .checkboxes`        | ✅ Yes          |
| 5        | Mobile label alignment      | `@media .field-label`       | ✅ Yes          |
| 6        | Disabled input styling      | `.field-input:disabled`     | ✅ Yes          |
| 7        | Placeholder styling         | `.field-input::placeholder` | ✅ Yes          |
| 8        | Group separation            | `.settings-group`           | ✅ Yes          |
| 9        | Remove layout gap           | `.settings-layout`          | ✅ Yes          |

---

## Change Summary

This document lists **all changes** made to resolve UX review findings. Each change has a **revert instruction** in case of unwanted side effects. All Priority 1 items were already present in v20.

---

## 1. Action Button Styling (Priority 2)

**Issue**: Action buttons blend into background, lack visual weight for important actions.

**Change**: Convert from filled to outline style, increase text weight.

### CSS Changes

```css
/* BEFORE (lines 313-325) */
.action-btn {
    padding: var(--space-xs) var(--space-md);
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-xs);
    cursor: pointer;
    border: var(--border-width-thin) solid var(--color-border);
    border-radius: var(--border-radius-sm);
    display: inline-block;
    white-space: nowrap;
    transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
}

/* AFTER */
.action-btn {
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
```

### Revert Instructions

To revert, change:

- `background: transparent` → `background: var(--color-bg-card)`
- `font-size: var(--font-size-sm)` → `font-size: var(--font-size-xs)`
- `font-weight: 500` → (remove line)
- `border: var(--border-width-thin) solid var(--color-border-input)` → `border: var(--border-width-thin) solid var(--color-border)`

---

## 2. Action Button Hover State

**Issue**: Hover state needs adjustment for outline buttons.

**Change**: Update hover to work with transparent background.

```css
/* BEFORE (lines 327-331) */
.action-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-input);
    border-color: var(--color-border-input);
}

/* AFTER */
.action-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-input);
    border-color: var(--color-accent);
}
```

### Revert Instructions

To revert, change:

- `color: var(--color-accent)` → `color: var(--color-text-primary)`
- `border-color: var(--color-accent)` → `border-color: var(--color-border-input)`

---

## 3. Status Message Contrast (Priority 2)

**Issue**: Action feedback messages ("Cache cleared", "Providers reset") have low contrast.

**Note**: Autosave message will be removed per user direction, so only action feedback is addressed.

**Change**: Increase base status color contrast.

```css
/* BEFORE (line 412) */
.status {
    color: var(--color-text-muted); /* #808080 */
}

/* AFTER */
.status {
    color: var(--color-text-secondary); /* #b0b0b0 - better contrast */
}
```

### Revert Instructions

To revert, change:

- `color: var(--color-text-secondary)` → `color: var(--color-text-muted)`

---

## 4. Mobile Checkbox Group Spacing (Priority 2)

**Issue**: Vertical gap between checkboxes in mobile view is too tight (0.25rem).

**Change**: Increase gap from `--space-xs` to `--space-sm`.

```css
/* BEFORE (line 370) - within @media (max-inline-size: 40rem) */
.checkboxes {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    width: 100%;
}

/* AFTER */
.checkboxes {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
    width: 100%;
}
```

### Revert Instructions

To revert, change:

- `gap: var(--space-sm)` → `gap: var(--space-xs)`

---

## 5. Mobile Label Baseline Alignment (Priority 2)

**Issue**: Text input row labels don't align perfectly with input text baseline on mobile.

**Change**: Use `align-items: baseline` for non-checkbox, non-action fields.

```css
/* BEFORE (lines 365-367) */
.field:not(.field--checkbox):not(.field--actions) .field-label {
    margin-top: calc(var(--space-md) - var(--border-width-thin));
}

/* AFTER */
.field:not(.field--checkbox):not(.field--actions) .field-label {
    margin-top: 0;
}

/* ADD to media query - better baseline alignment */
.field:not(.field--checkbox):not(.field--actions) {
    align-items: baseline;
}
```

### Revert Instructions

To revert:

1. Remove the new `align-items: baseline` rule
2. Change `margin-top: 0` back to `margin-top: calc(var(--space-md) - var(--border-width-thin))`

---

## 6. Disabled Input Styling

**Issue**: Disabled inputs (like IMDb checkbox) lack visual indication.

**Change**: Add explicit disabled styling.

```css
/* ADD after line 238 (after .field input[type="checkbox"]:focus-visible) */
.field-input:disabled,
.service-item input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.field-input:disabled:focus,
.service-item input[type='checkbox']:disabled:focus {
    border-color: var(--color-border-input);
    outline: none;
}
```

### Revert Instructions

To revert, remove the entire block (lines added after checkbox focus-visible).

---

## 7. Placeholder Styling

**Issue**: Placeholder text may have inconsistent contrast.

**Change**: Explicitly style placeholders for consistency.

```css
/* ADD after line 259 (after select.field-input closing brace) */
.field-input::placeholder {
    color: var(--color-text-muted);
    opacity: 1;
}
```

### Revert Instructions

To revert, remove the entire `.field-input::placeholder` rule block.

---

## 8. Group Separation

**Issue**: Gap between settings groups feels cramped.

**Change**: Increase bottom margin on settings groups.

```css
/* BEFORE (line 132) */
.settings-group {
    background: var(--color-bg-card);
    border: var(--border-width-thin) solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: var(--space-md);
}

/* AFTER */
.settings-group {
    background: var(--color-bg-card);
    border: var(--border-width-thin) solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: var(--space-md);
    margin-block-end: var(--space-md);
}
```

### Revert Instructions

To revert, remove the line:

- `margin-block-end: var(--space-md);`

---

## 9. Remove Group Margin Bottom from Layout

**Issue**: Double margin when groups are in layout.

**Change**: Since groups now have their own margin, remove the gap from the layout.

```css
/* BEFORE (line 122) */
.settings-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

/* AFTER */
.settings-layout {
    display: flex;
    flex-direction: column;
}
```

### Revert Instructions

To revert, add back:

- `gap: var(--space-sm);`

---

## Priority 1 Items (Already Present in v20)

These were **already implemented** in the v20 CSS refactor and require no changes:

1. ✅ **CSS Custom Properties**: 27 variables organized in :root (lines 10-74)
2. ✅ **Focus-visible styles**: Present on all interactive elements (lines 235-238, 256-258, 338-341, 376-379)
3. ✅ **Outline instead of box-shadow**: Already using outline for focus (no box-shadow found)
4. ✅ **Touch targets**: Defined as `--touch-target-min: 2.25rem` (line 73)

---

## JavaScript Changes

### Updated Action Button Styling in Width Toggle

The width toggle buttons at the bottom should match the new action button style.

```javascript
// BEFORE (lines 686-693) - no changes to JS logic needed
// The width-toggle class uses different styles; left as-is for demo purposes
```

No JavaScript changes were made. The width toggle buttons remain styled separately for demonstration purposes.

---

## Files Modified

- `docs/design-mockups/settings-mockup-v18.html` → Save as `settings-mockup-v19.html`

---

## Testing Checklist

- [ ] Desktop: Verify action buttons have outline style and increased weight
- [ ] Desktop: Check status messages have better contrast
- [ ] Mobile (<40rem): Verify checkbox spacing is comfortable
- [ ] Mobile: Verify label-input baseline alignment
- [ ] Mobile: Verify disabled inputs show reduced opacity
- [ ] Verify placeholders use consistent styling
- [ ] Verify group separation looks balanced
- [ ] Keyboard: Test all focus states still work
- [ ] Click: Test all action buttons still function

---

## Quick Revert All

To revert ALL changes at once:

1. Restore `settings-mockup-v18.html` from backup
2. Or manually revert each change using the "Revert Instructions" above

---

## Version Info

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| v18     | Original   | Fluid CSS with Unified Field System  |
| v19     | 2026-08-23 | UX improvements from review feedback |

---

## Implementation Priority Coverage

### Priority 1 Items (All ✅ Already in v20)

- [x] CSS Custom Properties - 27 variables organized in :root
- [x] Focus-visible styles - Present on all interactive elements
- [x] Outline instead of box-shadow - Already using outline for focus
- [x] Touch targets - Defined as `--touch-target-min: 2.25rem`

### Priority 2 Items (All ✅ Applied in v19)

- [x] Action button styling - Changed to outline style with font-weight: 500
- [x] Mobile checkbox spacing - Increased from space-xs to space-sm
- [x] Mobile label alignment - Added align-items: baseline and margin-top: 0
- [x] Status message contrast - Changed from text-muted to text-secondary

### Priority 3 Items (All ✅ Applied in v19)

- [x] Disabled input styling - Added opacity: 0.5 and cursor: not-allowed
- [x] Placeholder styling - Added explicit color: text-muted, opacity: 1
- [x] Group separation - Added margin-block-end: space-md to .settings-group
- [x] Remove layout gap - Removed gap from .settings-layout to avoid double margin

**Result**: All implementation priority points are now covered in v19.

---

## Files Created/Modified

- ✅ `settings-mockup-v19.html` - New version with all changes applied
- ✅ `CHANGES-v18-to-v19.md` - This document with revert instructions
- ✅ `settings-mockup-v18.html` - Preserved as backup (unchanged)

---

## How to Use This Document

1. **Test v19**: Open `settings-mockup-v19.html` in your browser
2. **Check each change**: Use the Quick Reference table above
3. **If unwanted effect**: Use the "Revert Instructions" for that specific change
4. **To revert all**: Restore from `settings-mockup-v18.html` backup

---

_Generated for UX review implementation - All changes are reversible_
