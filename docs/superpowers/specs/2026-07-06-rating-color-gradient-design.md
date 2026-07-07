# Rating Color Gradient Design

**Date:** 2025-07-06  
**Status:** Draft  
**Author:** Mistral Vibe  
**Feature:** Threshold-Based Gradient Text Color for Rating Values

---

## 1. Summary

This design adds visual color coding to FlixMonkey rating values using a threshold-based gradient system. Ratings below the low threshold appear in red, ratings above the high threshold appear in dark green, and ratings between the thresholds smoothly transition between these colors. The feature is always enabled and applies to all rating sources (IMDb, Rotten Tomatoes, Metacritic).

**User Value:** At-a-glance quality assessment. Users can quickly identify high-quality, medium-quality, and low-quality titles based on rating value colors without needing to read the actual numbers.

## 2. Requirements

### Functional Requirements

- [ ] Rating values display with color coding based on quality thresholds
- [ ] IMDb ratings (0-10 scale): ≤ 5.0 = red, ≥ 9.0 = dark green, 5.0-9.0 = red→green transition
- [ ] Percentage ratings (RT/MC, 0-100% scale): ≤ 50% = red, ≥ 90% = dark green, 50-90% = red→green transition
- [ ] N/A ratings and search state (🔍) maintain neutral styling (no color gradient)
- [ ] Color thresholds and shades are defined as constants for easy maintenance
- [ ] Feature is always enabled (no user toggle)

### Non-Functional Requirements

- [ ] Follow existing code patterns and style in `overlay.js`
- [ ] Maintain backward compatibility (existing functionality unchanged)
- [ ] Colors must be readable against the semi-transparent black background
- [ ] No additional CSS classes or files required

## 3. Architecture

### 3.1 Constants

Add to `src/core/constants.js`:

```javascript
export const RATING_COLOR_LOW_THRESHOLD = 5.0; // IMDb: ≤5.0, RT/MC: ≤50%
export const RATING_COLOR_HIGH_THRESHOLD = 9.0; // IMDb: ≥9.0, RT/MC: ≥90%
export const RATING_COLOR_RED = '#ff0000'; // Pure red
export const RATING_COLOR_GREEN = '#00cc00'; // Dark green
```

### 3.2 Implementation

**File Modified:** `src/core/overlay.js`

#### New Method

Add to `OverlayRenderer` class:

```javascript
#calculateRatingColor(rating, isPercentage = false) {
    if (rating === null || rating === undefined) return null;

    // Apply thresholds based on rating type
    const low = isPercentage ? RATING_COLOR_LOW_THRESHOLD * 10 : RATING_COLOR_LOW_THRESHOLD;
    const high = isPercentage ? RATING_COLOR_HIGH_THRESHOLD * 10 : RATING_COLOR_HIGH_THRESHOLD;

    if (rating <= low) return RATING_COLOR_RED;
    if (rating >= high) return RATING_COLOR_GREEN;

    // Interpolate between red and green for values between thresholds
    const progress = (rating - low) / (high - low);
    const r = Math.round(255 * (1 - progress));
    const g = Math.round(255 * progress);
    return `rgb(${r}, ${g}, 0)`;
}
```

#### Modified Method

Update `#createRatingElement`:

```javascript
#createRatingElement(label, value, className = '') {
    const el = this.#createBadgeElement(label, value, className, 'fm-value');

    // Apply gradient color to rating values
    const numericValue = Number(value.replace('%', ''));
    const isPercentage = value.includes('%');
    const color = this.#calculateRatingColor(numericValue, isPercentage);
    if (color && el.lastChild) {
        el.lastChild.style.color = color;
    }

    return el;
}
```

#### Unchanged Methods

`#createMissingRatingElement` and `#createSearchRatingElement` remain unchanged to preserve neutral styling for N/A and search states.

## 4. Data Flow

```
OverlayRenderer.#createOverlay(titleObj)
    ↓
For each rating (IMDb, RT, MC):
    ↓
#createRatingElement(label, value, className)
    ↓
Extract numeric value, detect if percentage
    ↓
#calculateRatingColor(rating, isPercentage)
    ↓
Return color based on thresholds and interpolation
    ↓
Apply inline style.color to rating value span
```

## 5. Color Calculation

### Interpolation Algorithm

For a rating `r` between low threshold `L` and high threshold `H`:

```
progress = (r - L) / (H - L)
red_component = 255 * (1 - progress)
green_component = 255 * progress
color = rgb(red_component, green_component, 0)
```

### Example Calculations

| Rating | Type | Progress | RGB Color        | Hex Approx          |
| ------ | ---- | -------- | ---------------- | ------------------- |
| 3.2    | IMDb | 0.00     | rgb(255, 0, 0)   | #ff0000             |
| 5.0    | IMDb | 0.00     | rgb(255, 0, 0)   | #ff0000             |
| 5.8    | IMDb | 0.20     | rgb(204, 51, 0)  | #cc3300             |
| 7.0    | IMDb | 0.50     | rgb(128, 128, 0) | #808000             |
| 7.2    | IMDb | 0.55     | rgb(115, 140, 0) | #738c00             |
| 8.5    | IMDb | 0.88     | rgb(30, 219, 0)  | #1edb00             |
| 9.0    | IMDb | 1.00     | rgb(0, 255, 0)   | #00ff00 → #00cc00\* |
| 9.5    | IMDb | 1.00     | rgb(0, 255, 0)   | #00ff00 → #00cc00\* |

\*Note: High threshold uses constant #00cc00, not calculated rgb(0,255,0)

## 6. Edge Cases

| Case                  | Handling                                                          |
| --------------------- | ----------------------------------------------------------------- |
| Null/undefined rating | Return null from #calculateRatingColor, no color applied          |
| N/A rating            | Created via #createMissingRatingElement, neutral color maintained |
| Search state (🔍)     | Created via #createSearchRatingElement, neutral color maintained  |
| Percentage values     | Scale thresholds by 10x (5→50%, 9→90%)                            |
| Decimal values        | Number conversion handles correctly                               |
| Negative ratings      | Clamped to low threshold (red)                                    |
| Ratings above max     | Clamped to high threshold (green)                                 |

## 7. Testing Strategy

### Unit Tests

1. **#calculateRatingColor tests**
    - Null/undefined input returns null
    - IMDb rating ≤ 5.0 returns RATING_COLOR_RED
    - IMDb rating ≥ 9.0 returns RATING_COLOR_GREEN
    - IMDb rating between 5.0-9.0 returns interpolated color
    - Percentage rating ≤ 50 returns RATING_COLOR_RED
    - Percentage rating ≥ 90 returns RATING_COLOR_GREEN
    - Percentage rating between 50-90 returns interpolated color

2. **#createRatingElement tests**
    - Applies color to valid rating values
    - Does not apply color to N/A values
    - Does not apply color to search state values

### UI Tests

3. **Fixture-based tests**
    - Verify IMDb rating values have correct colors
    - Verify RT rating values have correct colors
    - Verify MC rating values have correct colors
    - Verify N/A ratings maintain neutral color

### Test Coverage

All new code paths must achieve 100% coverage to maintain the existing 90%+ threshold.

## 8. Files Changed

| File                    | Change Type                  | Lines Added | Lines Removed |
| ----------------------- | ---------------------------- | ----------- | ------------- |
| `src/core/constants.js` | New constants                | 4           | 0             |
| `src/core/overlay.js`   | New method + modify existing | ~15         | ~2            |

## 9. Acceptance Criteria

- [ ] Rating values display with threshold-based gradient colors
- [ ] IMDb, RT, and MC ratings all use the color scheme
- [ ] N/A and search state ratings remain neutral
- [ ] Colors are readable against dark overlay background
- [ ] All existing tests pass
- [ ] New tests cover all code paths
- [ ] Code follows existing style and patterns
- [ ] Lint passes

## 10. Open Questions

None. Design is complete and ready for implementation.

---

**Next Steps:** Implementation plan creation via writing-plans skill after user approval.
