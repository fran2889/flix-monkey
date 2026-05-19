# Rating Overlay Click Isolation Design

## Overview

Improve the interaction model of the rating overlay by ensuring that only the IMDb rating is interactive, and that clicks on RT and MC ratings do not trigger any interaction (neither navigating nor bubbling up to the Netflix layer).

## Proposed Changes

- Modify the CSS for the `.fm-rating-overlay` container:
    - Set `pointer-events: none` on the container itself to ensure it does not capture clicks by default.
    - Explicitly set `pointer-events: all` on the IMDb link child element to maintain its interactivity.
- Update the CSS to remove `cursor: pointer` from all children of the overlay container.
- Explicitly set `cursor: pointer` only on the IMDb link.

## Expected Outcome

- Clicking the IMDb rating will open the IMDb link.
- Clicking the RT or MC ratings will do nothing (clicks will be ignored by the overlay and propagate to the Netflix layer correctly without triggering any overlay-specific actions).
