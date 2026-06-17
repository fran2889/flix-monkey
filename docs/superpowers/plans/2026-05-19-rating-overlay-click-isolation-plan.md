# Rating Overlay Click Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Correct the interaction model of the rating overlay so that RT and MC ratings are non-interactive and do not pass click events to the Netflix UI layer.

**Architecture:** Modify CSS in `src/core/overlay.js` to isolate click events by applying `pointer-events` selectively.

**Tech Stack:** JavaScript (ES6+), CSS.

---

### Task 1: Update Rating Overlay CSS

**Files:**

- Modify: `src/core/overlay.js`
- Test: `tests/ui/overlay.ui.test.js`

- [x] **Step 1: Modify CSS in `src/core/overlay.js`**

Change the `injectStyles` method to set `pointer-events: none` on the container and update the children's `pointer-events`.

```javascript
// src/core/overlay.js (within injectStyles)
// ...
        style.textContent = `
            .${this.#OVERLAY_CLASS} {
                position: absolute;
                ${positionCss}
                z-index: 9999;
                display: flex;
                flex-direction: ${flexDirection};
                gap: 4px;
                pointer-events: none; /* Changed from pointer-events: none; - oh wait, it already is! */
            }
            .${this.#OVERLAY_CLASS} > * {
                background: rgba(0,0,0,0.72);
                font-family: Arial, sans-serif;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: default; /* Changed from cursor: pointer; */
                text-decoration: none;
                white-space: nowrap;
                pointer-events: auto; /* Ensure children can be targeted if needed */
                transition: background 0.15s;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .${this.#OVERLAY_CLASS} > *:hover { background: rgba(0,0,0,0.92); }
            /* Add special rule for the IMDb link */
            .${this.#OVERLAY_CLASS} a {
                cursor: pointer;
            }
// ...
```

_Self-correction_: The current code sets `pointer-events: none` on the container and `pointer-events: all` on the children. The fix is to remove `pointer-events: all` from the children (specifically RT/MC) and keep `pointer-events: all` ONLY on the IMDb link.

Revised CSS plan:

```javascript
            .${this.#OVERLAY_CLASS} {
                /* ... */
                pointer-events: none;
            }
            .${this.#OVERLAY_CLASS} > * {
                /* ... */
                /* Remove pointer-events: all here */
                cursor: default;
            }
            .${this.#OVERLAY_CLASS} a {
                pointer-events: auto;
                cursor: pointer;
            }
```

- [x] **Step 2: Update existing UI tests**

Verify that clicking RT/MC ratings in a test environment does not trigger navigation, while clicking the IMDb rating still works.

- [x] **Step 3: Run tests to verify they pass**

Run: `npm test tests/ui/overlay.ui.test.js`

- [x] **Step 4: Commit**

```bash
git add src/core/overlay.js tests/ui/overlay.ui.test.js
git commit -m "fix: isolate click events for rating overlay elements"
```
