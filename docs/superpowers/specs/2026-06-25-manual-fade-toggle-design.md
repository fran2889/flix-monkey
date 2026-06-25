# Manual Fade Toggle

**Date:** 2026-06-25
**Scope:** Per-title fade override toggle with persistent storage, new `FadeManager` class, and updated fade logic

---

## Problem

The current fade feature is all-or-nothing based on IMDb rating threshold. Users cannot override it for individual titles — a well-rated title they dislike stays visible, and a low-rated title they want to watch stays faded. There's no way to manually control fade behavior per title.

---

## Design

### 1. Toggle UI

A pill-shaped 3-state toggle (~48px wide, ~18px tall) rendered inside the existing `.fm-rating-overlay` flex container, appended after all rating badges. Because the overlay uses `flex-direction: column` for top corners and `column-reverse` for bottom corners, the toggle naturally sits below top-aligned ratings and above bottom-aligned ratings.

**Three states:**

| Position | State     | Track color                        | Meaning                          |
| -------- | --------- | ---------------------------------- | -------------------------------- |
| Left     | Faded     | Muted (`rgba(255,255,255,0.15)`)   | Always fade this title           |
| Center   | Auto      | Neutral (`rgba(255,255,255,0.25)`) | Use rating-based logic (default) |
| Right    | Not Faded | Bright (`rgba(255,255,255,0.4)`)   | Never fade this title            |

**Circular click cycling (same order, different entry point):**

- Rating-faded title starts at **Faded** → Not Faded → Auto → Faded → ...
- Non-faded title starts at **Auto** → Faded → Not Faded → Auto → ...

The knob slides with a CSS transition. The toggle itself is hidden by default and fades in when the title's container is hovered (CSS-driven, e.g., `.container:hover .fm-fade-toggle { opacity: 1; }`).

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
1. Discover surface (container, title, fadeable)
2. Inject loading overlay
3. Read stored fade override via FadeManager.getOverride(dedupKey)
4. Apply fade immediately based on override (FadeManager.shouldFade)
5. Fetch rating data from API/cache
6. Inject final overlay with ratings + toggle
7. Re-apply fade with full context (override + rating data)
```

Applying fade at step 4 (before API fetch) ensures titles with manual overrides fade/unfade instantly without waiting for the network.

### 5. OverlayRenderer changes

- New private method `#createFadeToggle(initialState, onClick)` builds the pill toggle DOM element
- `#createOverlay()` gains parameters for toggle state and click callback; appends toggle after badges when `enableFadeToggle` is on
- `applyFade(container, shouldFade)` simplified to accept a boolean and add/remove `fm-faded` class (decision logic moved to `FadeManager`)
- `injectStyles()` gains CSS for the toggle: pill track, knob, three positions, hover visibility, slide transitions

### 6. FlixMonkeyApp changes

- Receives `FadeManager` instance via constructor (created in `startApp()`)
- `#decorateContainer()` reads override before loading overlay, applies early fade, and passes toggle callback to renderer
- Toggle callback: calls `FadeManager.setOverride()`, then re-applies fade and updates toggle knob position on the container

### 7. Config option

New field in `config-fields.js`:

```javascript
{
    key: 'enableFadeToggle',
    label: 'Show fade toggle',
    type: 'checkbox',
    default: true,
    title: 'Show per-title fade override toggle on hover.',
    row: 'fade-toggle-settings',
}
```

When disabled:

- Toggle element is not rendered
- Stored overrides are ignored by `FadeManager.shouldFade()` (but not deleted from storage)
- Re-enabling restores previous overrides

### 8. CSS additions

```css
.fm-fade-toggle {
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
    /* pill track styles, knob styles, position variants */
}

/* Show on container hover */
.title-card:hover .fm-fade-toggle,
[data-uia='standard-card']:hover .fm-fade-toggle {
    opacity: 1;
    pointer-events: auto;
}
```

Knob position controlled by a data attribute or class (`fm-toggle-faded`, `fm-toggle-auto`, `fm-toggle-not-faded`) with `transform: translateX()` for smooth sliding.

---

## Files changed

| File                        | Change                                                |
| --------------------------- | ----------------------------------------------------- |
| `src/core/fade-manager.js`  | **New.** FadeManager class                            |
| `src/core/overlay.js`       | Add toggle rendering, simplify `applyFade()`, new CSS |
| `src/core/app.js`           | Integrate FadeManager, early fade, toggle callback    |
| `src/core/config-fields.js` | Add `enableFadeToggle` field                          |

---

## Not in scope

- Bulk management UI for viewing/clearing all overrides
- Exporting/importing overrides
- Override by IMDb ID (accepted trade-off: title strings are the existing dedup key)
