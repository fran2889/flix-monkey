# Fade Toggle in Mini Preview — Design Spec

**Date:** 2026-06-28
**Status:** Approved

## Overview

Add a per-title fade override toggle to the mini-modal (hover preview) overlay. The toggle cycles through three states — **always**, **never**, **auto** — and persists the override in adapter storage. A new `enableFadeToggle` checkbox in Settings controls whether the toggle is shown. All other surfaces and the existing global fade rule are unaffected.

This is a clean reimplementation targeting `main`; the earlier `feat/manual-fade-toggle` branch is not used.

---

## Feature Behaviour

- The toggle appears inside the mini-modal overlay as a compact badge alongside the rating badges.
- It is only shown when `enableFadeToggle` is `true` in Settings.
- Three states, cycled on each click:

| State  | Stored value         | Effect                                                             | Emoji               |
| ------ | -------------------- | ------------------------------------------------------------------ | ------------------- |
| auto   | absent (key deleted) | Follow `enableFadeUnderRating` + `fadeRatingThreshold` global rule | ⭐                  |
| always | `'always'`           | Force-fade the title cards regardless of rating                    | 👁️ (dimmed via CSS) |
| never  | `'never'`            | Never fade the title cards regardless of rating                    | 👁️ (full opacity)   |

- Cycle order: `auto → always → never → auto`
- Changes apply immediately: card containers (`fm-faded` class) update on click without page reload.
- The override persists across page reloads and browser restarts (adapter storage).

---

## Architecture

Five touch points. One new file.

| File                        | Change                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| `src/core/fade-manager.js`  | **New** — override storage and fade decision logic                             |
| `src/core/config-fields.js` | Add `enableFadeToggle` checkbox in `fade-settings` row                         |
| `src/core/surfaces.js`      | Add `showFadeToggle: true` to mini-modal surface; `false` on all others        |
| `src/core/overlay.js`       | Add `#createFadeToggle`; extend `injectOverlay`; simplify `applyFade`          |
| `src/core/app.js`           | Inject `FadeManager`; read override; wire click handler; stamp card containers |

Data flows one way: `FadeManager` → `OverlayRenderer` (read for rendering) and `FadeManager` ← `FlixMonkeyApp` (write on click). The renderer never touches storage.

---

## `FadeManager` (`src/core/fade-manager.js`)

Single responsibility: storage key management and fade decision. No DOM access, no direct config reads.

**Storage:**

```
key:    fm-fade:<dedupKey>
values: 'always' | 'never' | absent (= auto)
```

**Public API:**

```js
getOverride(dedupKey);
// Returns: 'always' | 'never' | null (null = auto)

setOverride(dedupKey, state);
// state: 'always' | 'never' | null
// null → deletes key; 'always'/'never' → writes string

shouldFade(override, rating, config);
// override: 'always' | 'never' | null
// Returns boolean:
//   'always' → true
//   'never'  → false
//   null     → config.getBool('enableFadeUnderRating')
//              && typeof rating === 'number'
//              && rating < config.getFloat('fadeRatingThreshold')

nextState(current);
// Cycle: null → 'always' → 'never' → null
```

The `fadeable` guard is handled at the call site in `app.js`, not inside `shouldFade`.

---

## Config Field (`src/core/config-fields.js`)

New field appended to the `fade-settings` row, after the existing `enableFadeUnderRating` and `fadeRatingThreshold` fields:

```js
{
    key: 'enableFadeToggle',
    label: 'Fade override per title',
    type: 'checkbox',
    default: true,
    title: 'Shows a button in the hover preview to always fade, never fade, or follow the rating rule for individual titles.',
    row: 'fade-settings',
}
```

Default `true` — visible to all users on first install.

---

## Surfaces (`src/core/surfaces.js`)

`discover()` return shape gains `showFadeToggle`:

```js
{
    (container, title, fadeable, showFadeToggle);
}
```

Surface definitions:

| Surface                | `fadeable` | `showFadeToggle` |
| ---------------------- | ---------- | ---------------- |
| title-card (browse)    | `true`     | `false`          |
| standard-card (search) | `true`     | `false`          |
| mini-modal             | `false`    | `true`           |
| detail-modal           | `false`    | `false`          |

---

## `OverlayRenderer` changes (`src/core/overlay.js`)

### `#createFadeToggle(state, onClick)`

Returns a badge element styled identically to rating badges. Displays:

- `⭐` for `null` (auto)
- `👁️` at full opacity for `'never'`
- `👁️` with `fm-fade-toggle--faded` CSS class for `'always'` (opacity: 0.35)

The element has a `data-state` attribute (`'always'` | `'never'` | `'auto'`) for CSS targeting and direct update on click. Note: `FadeManager` uses `null` internally for auto; the app maps `null → 'auto'` when setting this attribute.

Click stops propagation and calls `onClick`.

### `injectOverlay(container, titleObj, fadeToggleState, onFadeToggleClick)`

Two new optional params. When `onFadeToggleClick` is provided and `config.getBool('enableFadeToggle')` is true, the fade toggle badge is appended to the overlay. Otherwise behaviour is unchanged.

### `applyFade(container, shouldFade)`

Simplified to a pure DOM operation — no config reads, no `fadeable` check:

```js
applyFade(container, shouldFade) {
    container.classList.toggle('fm-faded', shouldFade);
}
```

The caller (`app.js`) is responsible for computing `shouldFade` and guarding on `fadeable`.

### CSS additions

```css
.fm-fade-toggle {
    cursor: pointer;
}
.fm-fade-toggle--faded {
    opacity: 0.35;
}
```

---

## `FlixMonkeyApp` changes (`src/core/app.js`)

### Constructor

`FadeManager` added as a constructor dependency:

```js
constructor(cache, api, renderer, surfaces, fadeManager, logger);
```

### `#decorateContainer(container, displayTitle, fadeable, showFadeToggle)`

Gains `showFadeToggle` param. After data fetch:

1. Reads `fadeOverride = await fadeManager.getOverride(dedupKey)` when `showFadeToggle` is true; otherwise `null`.
2. Computes `shouldFade = fadeable && fadeManager.shouldFade(fadeOverride, rating, config)`.
3. Calls `renderer.applyFade(container, shouldFade)`.
4. Stamps `container.dataset.fmKey = dedupKey` when `fadeable` — card containers only, enables sibling lookup.
5. Passes `fadeToggleState` and `onFadeToggleClick` closure to `renderer.injectOverlay` when `showFadeToggle` is true.

### `#handleFadeToggleClick(dedupKey, rating, currentState, toggleBadgeEl)`

Called by the closure captured in step 5 above:

1. `nextState = fadeManager.nextState(currentState)`
2. `await fadeManager.setOverride(dedupKey, nextState)`
3. Updates `toggleBadgeEl` directly (state attribute + CSS class) — no re-render of full overlay.
4. Queries `document.querySelectorAll('[data-fm-key="<dedupKey>"]')` to find all stamped card containers and calls `renderer.applyFade(container, shouldFade)` for each.

### `startApp`

Constructs `FadeManager(adapter)` and passes it to `FlixMonkeyApp`.

---

## Known Limitation (deferred)

When the same title appears in two carousels simultaneously, clicking the toggle updates all stamped `[data-fm-key]` containers. However, if a sibling card was decorated before `data-fm-key` stamping was introduced (e.g. from a previous page load state), it will not receive the update until Netflix re-renders it. This is narrow in practice and self-heals on carousel re-render. Not in scope for this implementation.

---

## Testing

- **Unit:** `FadeManager` — `getOverride`, `setOverride`, `shouldFade`, `nextState` against all state combinations and edge cases (missing key, unknown stored value).
- **Unit:** `OverlayRenderer` — `#createFadeToggle` renders correct emoji and CSS class per state; `applyFade` toggles `fm-faded` correctly.
- **Unit:** `FlixMonkeyApp` — `#decorateContainer` passes correct `fadeToggleState` to renderer; `#handleFadeToggleClick` cycles state, persists, and updates DOM.
- **UI:** mini-modal shows toggle badge when `enableFadeToggle` true; toggle absent when false; click cycles state and updates card fade in the browse surface.
