# Manual Fade Toggle

**Date:** 2026-06-26 (revised)
**Scope:** Per-title fade override toggle with persistent storage, new `FadeManager` class, and updated fade logic

---

## Problem

The current fade feature is all-or-nothing based on IMDb rating threshold. Users cannot override it for individual titles — a well-rated title they dislike stays visible, and a low-rated title they want to watch stays faded. There's no way to manually control fade behavior per title.

---

## Design

### 1. Toggle UI

A pill-shaped 3-state toggle (~41px wide, ~15px tall) rendered inside the existing `.fm-rating-overlay` flex container on the **bob popup only** (`.bob-container`). The toggle is always visible when the bob is open — no hover-gating.

**Three states:**

| Position | State     | Knob icon                   | Meaning                          |
| -------- | --------- | --------------------------- | -------------------------------- |
| Left     | Faded     | Red `✕` via CSS `::after`   | Always fade this title           |
| Center   | Auto      | Plain white knob, no icon   | Use rating-based logic (default) |
| Right    | Not Faded | Green `✓` via CSS `::after` | Never fade this title            |

Track color does not change between states — the icons carry the state meaning.

**Circular click cycling (same order, different entry point):**

- Rating-faded title starts at **Faded** → Not Faded → Auto → Faded → ...
- Non-faded title starts at **Auto** → Faded → Not Faded → Auto → ...

The knob slides with a CSS transition.

### 2. Storage

Overrides stored as individual keys using the existing platform adapter storage API:

- **Key format:** `fm-fade:{title}` where `{title}` is the lowercase display title string (the same dedup key used by `#decorateContainer`)
- **Values:** `true` (always fade) / `false` (never fade) / key absent (auto — no override)

On toggle click: write `true`/`false` via `adapter.storageSet()`, or delete the key via `adapter.storageDelete()` when returning to auto. Overrides persist across sessions.

### 3. FadeManager

New class `src/core/fade-manager.js` following the existing manager pattern (`CacheManager`, `DisabledClientsManager`). Owns override storage and fade decision logic.

**Constructor:** `FadeManager(adapter, config)`

**Methods:**

| Method            | Signature                                     | Returns                              | Description                                                               |
| ----------------- | --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `getOverride`     | `async getOverride(titleKey)`                 | `true` / `false` / `null`            | Reads stored override for a title                                         |
| `setOverride`     | `async setOverride(titleKey, value)`          | `void`                               | Writes `true`/`false` or deletes key for `null`                           |
| `shouldFade`      | `shouldFade(fadeOverride, rating, fadeable)`  | `boolean`                            | Single decision function: override first, then rating logic, then default |
| `getToggleState`  | `getToggleState(fadeOverride, isRatingFaded)` | `'faded'` / `'auto'` / `'not-faded'` | Determines initial toggle position                                        |
| `nextToggleState` | `nextToggleState(currentState)`               | `'faded'` / `'auto'` / `'not-faded'` | Returns next state in the cycle: faded → not-faded → auto → faded         |

**`shouldFade` logic:**

```
1. If enableFadeToggle config is on and fadeOverride is not null:
   - true → return true (fade)
   - false → return false (don't fade)
2. If fadeable and enableFadeUnderRating config is on:
   - rating < threshold → return true
   - else → return false
3. Return false
```

### 4. Updated decoration pipeline

```
1. Discover surface (container, title, fadeable, showToggle)
2. Inject loading overlay
3. Read stored fade override via FadeManager.getOverride(dedupKey)
4. Apply fade immediately based on override (FadeManager.shouldFade)
5. Fetch rating data from API/cache
6. Inject final overlay with ratings + toggle (toggle only if showToggle is true and enableFadeToggle config is on)
7. Re-apply fade with full context (override + rating data)
8. If fadeable, stamp data-fm-dedup-key="{dedupKey}" on container
```

Applying fade at step 4 (before API fetch) ensures titles with manual overrides fade/unfade instantly without waiting for the network.

### 5. Surface changes

Each surface definition gains a `showToggle` boolean:

| Surface                                 | `fadeable` | `showToggle` |
| --------------------------------------- | ---------- | ------------ |
| `.title-card`                           | `true`     | `false`      |
| `[data-uia="standard-card"]`            | `true`     | `false`      |
| `.bob-container`                        | `false`    | `true`       |
| `.previewModal--player_container`       | `false`    | `false`      |
| `.jawBone` / `.jawBoneContainer` / etc. | `false`    | `false`      |

### 6. OverlayRenderer changes

- New private method `#createFadeToggle(initialState, onClick)` builds the pill toggle DOM element
- `#createOverlay()` gains parameters for toggle state and click callback; appends toggle after badges when `showToggle` is true and `enableFadeToggle` config is on
- `applyFade(container, shouldFade)` simplified to accept a boolean and add/remove `fm-faded` class (decision logic moved to `FadeManager`)
- `injectStyles()` gains CSS for the toggle: pill track, knob, three positions, icon pseudo-elements, slide transitions

### 7. FlixMonkeyApp changes

- Receives `FadeManager` instance via constructor (created in `startApp()`)
- `#decorateContainer()` receives `showToggle` from the surface and reads override before loading overlay, applies early fade, and passes toggle callback to renderer only when `showToggle` is true
- Decorated fadeable containers are stamped with `data-fm-dedup-key="{dedupKey}"` so the bob toggle can find them
- Toggle callback (bob):
    1. Calls `FadeManager.setOverride(dedupKey, newOverride)`
    2. Updates the toggle knob state in the bob DOM
    3. Queries `document.querySelectorAll('[data-fm-dedup-key="${dedupKey}"]')` and calls `applyFade` on each match

### 8. Config option

New field in `config-fields.js`:

```javascript
{
    key: 'enableFadeToggle',
    label: 'Show fade toggle',
    type: 'checkbox',
    default: true,
    title: 'Show per-title fade override toggle in the bob popup.',
    row: 'fade-toggle-settings',
}
```

When disabled:

- Toggle element is not rendered
- Stored overrides are ignored by `FadeManager.shouldFade()` (but not deleted from storage)
- Re-enabling restores previous overrides

### 9. CSS additions

```css
.fm-fade-toggle {
    cursor: pointer;
    padding: 0;
    background: transparent !important;
    /* always visible — bob is itself only shown on hover */
}

.fm-toggle-track {
    width: 41px;
    height: 15px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.25);
    position: relative;
    transition: background 0.2s;
}

.fm-toggle-knob {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 1.5px;
    left: 2px;
    transition: transform 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    line-height: 1;
}

/* Knob positions */
.fm-fade-toggle[data-state='faded'] .fm-toggle-knob {
    transform: translateX(0);
}
.fm-fade-toggle[data-state='auto'] .fm-toggle-knob {
    transform: translateX(12px);
}
.fm-fade-toggle[data-state='not-faded'] .fm-toggle-knob {
    transform: translateX(25px);
}

/* State icons via pseudo-element on knob */
.fm-fade-toggle[data-state='faded'] .fm-toggle-knob::after {
    content: '✕';
    color: #e53935;
}
.fm-fade-toggle[data-state='not-faded'] .fm-toggle-knob::after {
    content: '✓';
    color: #43a047;
}
```

No hover-visibility rules needed — the toggle is always visible when rendered.

---

## Files changed

| File                        | Change                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/fade-manager.js`  | Already complete — no changes needed                                                                                                   |
| `src/core/config-fields.js` | Already complete — no changes needed                                                                                                   |
| `src/core/surfaces.js`      | Add `showToggle` boolean to each surface definition                                                                                    |
| `src/core/overlay.js`       | Update CSS (remove hover rules, smaller size, icon pseudo-elements); toggle always visible when rendered                               |
| `src/core/app.js`           | Gate toggle on `showToggle` surface property; stamp `data-fm-dedup-key` on fadeable containers; sibling update in toggle click handler |

---

## Not in scope

- Toggle on browse thumbnails (removed from this design)
- Toggle on preview modal or jawBone
- Bulk management UI for viewing/clearing all overrides
- Exporting/importing overrides
- Override by IMDb ID (accepted trade-off: title strings are the existing dedup key)
- Updating duplicate title-cards simultaneously (handled as a side effect of the data-attribute query, but not a priority)
