# Netflix More Like This Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show ordinary browse-style rating badges on every Netflix More Like This tile in the title detail modal.

**Architecture:** Add one `MORE_LIKE_THIS` surface definition scoped to `.moreLikeThis--wrapper .titleCard--container`, with an exported title extractor and an artwork-wrapper container resolver. The existing discovery, fade, cache, and overlay guards do the rest. A fixture-backed UI test covers the collapsed and expanded section; unit tests cover extraction, flags, container fallback, and selector scope.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest with jsdom, ESLint, Prettier, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-07-netflix-more-like-this-design.md`

## Global Constraints

- Scope the new surface to `.moreLikeThis--wrapper .titleCard--container`; do not change any other Netflix surface selector or behavior.
- More Like This tiles are ordinary browse cards: `fadeable: true`, `showFadeToggle: false`, and the normal rating retrieval path.
- Decorate every discovered tile immediately, including collapsed ones. Do not add visibility or lazy-loading checks.
- Title comes from a trimmed `aria-label`, else the trimmed `alt` of `.titleCard-imageWrapper img[alt]` or any `img[alt]`, else the tile is skipped.
- Container is `.titleCard-imageWrapper`, else the tile itself.
- Fixture-backed UI tests live in `tests/ui/`; synthetic edge-case tests live in `tests/unit/`.
- Strict TypeScript, sorted imports, SPDX headers, and JSDoc on exported declarations.
- Branch from `main` and preserve the unrelated working tree changes on `fix/provider-miss-logging`.
- Do not edit generated output under `dist/` or `coverage/`.
- Netflix enablement stays where it is: `startApp` already returns early when `NetflixService.isEnabled` is false, and the surface must not add its own enablement logic.
- Conventional Commits, one commit per task.
- Required checks: `npm run type-check`, `npm run lint`, `npm run format:check`, `npm run build`, and `npm run test:coverage`.

## Review Focus

- A whitespace-only `aria-label` with a valid artwork `alt` uses the alt, not an empty title. Task 1 pins this with a test.
- A tile with neither a usable label nor alt is skipped, with no overlay and no lookup. Tasks 1 and 2 pin this with tests.
- A tile without `.titleCard-imageWrapper` anchors its overlay to the tile itself, not the surrounding row. Task 2 pins this with a test.
- Repeated discovery after expansion keeps exactly one overlay per tile. Task 2 pins this with a UI test.
- `.titleCard--container` markup outside `.moreLikeThis--wrapper` is not discovered. Task 2 pins this with a test.
- Disabling Netflix prevents `startApp` from constructing the surface manager, so no More Like This lookups occur. Existing `NetflixService.isEnabled` coverage pins this; no new test.

---

### Task 0: Commit the design and plan

**Files:**

- Add: `docs/superpowers/specs/2026-11-07-netflix-more-like-this-design.md`
- Add: `docs/superpowers/plans/2026-11-07-netflix-more-like-this.md`

- [x] **Step 1: Confirm the approved design and plan are present**

Run: `git status --short docs/superpowers/specs/2026-11-07-netflix-more-like-this-design.md docs/superpowers/plans/2026-11-07-netflix-more-like-this.md`
Expected: both files are listed as untracked or modified.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-07-netflix-more-like-this-design.md docs/superpowers/plans/2026-11-07-netflix-more-like-this.md
git commit -m "docs: add Netflix More Like This design and plan"
```

---

### Task 1: More Like This title extractor

**Files:**

- Modify: `src/core/surfaces/surface-definitions/netflix-surfaces.ts`
- Modify: `src/core/surfaces/index.ts:8`
- Test: `tests/unit/core/surfaces/surfaces.test.ts` (new describe block after the existing `SurfaceManager` describe)

**Interfaces:**

- Produces: `extractNetflixMoreLikeThisTitle(element: Element): string | undefined`, exported from `netflix-surfaces.ts` and re-exported from `src/core/surfaces/index.ts`.

- [x] **Step 1: Write the failing extraction tests**

Add `extractNetflixMoreLikeThisTitle` to the import block in `tests/unit/core/surfaces/surfaces.test.ts`, then add:

```ts
describe('Netflix More Like This title extraction', () => {
    function extract(html: string): string | undefined {
        document.body.innerHTML = html;
        const tile = document.querySelector('.titleCard--container');
        if (!tile) throw new Error('fixture tile missing');
        return extractNetflixMoreLikeThisTitle(tile);
    }

    it('prefers the tile aria-label over the artwork alt', () => {
        expect(
            extract(`
                <div class="titleCard--container" aria-label="Caramelo">
                    <div class="titleCard-imageWrapper"><img alt="Wrong"></div>
                </div>
            `)
        ).toBe('Caramelo');
    });

    it('falls back to the artwork alt when the label is missing', () => {
        expect(
            extract(`
                <div class="titleCard--container">
                    <div class="titleCard-imageWrapper"><img alt="Alt Only Title"></div>
                </div>
            `)
        ).toBe('Alt Only Title');
    });

    it('falls back to the artwork alt when the label is whitespace-only', () => {
        expect(
            extract(`
                <div class="titleCard--container" aria-label="   ">
                    <div class="titleCard-imageWrapper"><img alt="Alt Only Title"></div>
                </div>
            `)
        ).toBe('Alt Only Title');
    });

    it('trims the aria-label and artwork alt', () => {
        expect(
            extract(`
                <div class="titleCard--container" aria-label="  Caramelo  ">
                    <div class="titleCard-imageWrapper"><img alt="Other"></div>
                </div>
            `)
        ).toBe('Caramelo');
        expect(
            extract(`
                <div class="titleCard--container">
                    <div class="titleCard-imageWrapper"><img alt="  Alt Only Title  "></div>
                </div>
            `)
        ).toBe('Alt Only Title');
    });

    it('returns undefined when neither the label nor the artwork alt is usable', () => {
        expect(
            extract(`
                <div class="titleCard--container" aria-label="   ">
                    <div class="titleCard-imageWrapper"><img alt="   "></div>
                </div>
            `)
        ).toBeUndefined();
        expect(extract('<div class="titleCard--container"></div>')).toBeUndefined();
    });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts`
Expected: FAIL because `extractNetflixMoreLikeThisTitle` is not exported.

- [x] **Step 3: Implement the extractor in `src/core/surfaces/surface-definitions/netflix-surfaces.ts`**

Add below the imports:

```ts
/**
 * Extracts the title from a Netflix More Like This tile.
 *
 * @param element - A `.titleCard--container` element.
 * @returns The trimmed accessible label, the trimmed artwork alt, or undefined.
 */
export function extractNetflixMoreLikeThisTitle(element: Element): string | undefined {
    const label = element.getAttribute('aria-label')?.trim();
    if (label) return label;

    const artwork = element.querySelector('.titleCard-imageWrapper img[alt]') ?? element.querySelector('img[alt]');
    const alt = artwork?.getAttribute('alt')?.trim();
    return alt || undefined;
}
```

- [x] **Step 4: Re-export the extractor from `src/core/surfaces/index.ts`**

```ts
export {
    extractNetflixMoreLikeThisTitle,
    NETFLIX_SURFACES,
    NetflixSurfaceManager,
} from './surface-definitions/netflix-surfaces';
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts`
Expected: PASS, including the new extraction tests.

- [x] **Step 6: Commit**

```bash
git add src/core/surfaces/surface-definitions/netflix-surfaces.ts src/core/surfaces/index.ts tests/unit/core/surfaces/surfaces.test.ts
git commit -m "feat(surfaces): extract Netflix More Like This titles"
```

---

### Task 2: More Like This surface, fixture, and UI coverage

**Files:**

- Modify: `src/core/surfaces/surface-definitions/netflix-surfaces.ts`
- Modify: `tests/fixtures/netflix-surfaces.ts`
- Test: `tests/ui/netflix.ui.test.ts`
- Test: `tests/unit/core/surfaces/surfaces.test.ts`
- Modify: `README.md:49`

**Interfaces:**

- Consumes: `extractNetflixMoreLikeThisTitle(element: Element): string | undefined` from Task 1.
- Produces: `NETFLIX_SURFACES.MORE_LIKE_THIS` and the `NETFLIX_MORE_LIKE_THIS_SECTION` fixture with `name`, `collapsedHtml`, and `expandedHtml`.

- [x] **Step 1: Add the sanitized section fixture**

In `tests/fixtures/netflix-surfaces.ts`, add this before the default export:

```ts
export interface MoreLikeThisSectionFixture {
    name: string;
    collapsedHtml: string;
    expandedHtml: string;
}

export const NETFLIX_MORE_LIKE_THIS_SECTION: MoreLikeThisSectionFixture = {
    name: "Netflix More Like This section",
    collapsedHtml: `
        <div class="moreLikeThis--wrapper">
            <div class="moreLikeThis--container">
                <div class="titleCard--container" aria-label="Caramelo" role="button" tabindex="0">
                    <div class="titleCard-imageWrapper has-duration">
                        <div class="ptrack-content">
                            <img src="https://example.com/caramelo.jpg" alt="Caramelo">
                        </div>
                        <div class="titleCard-playIcon"></div>
                        <span class="duration ellipsized">1h 41m</span>
                    </div>
                </div>
                <div class="titleCard--container" aria-label="The Crown" role="button" tabindex="0">
                    <div class="titleCard-imageWrapper has-duration">
                        <div class="ptrack-content">
                            <img src="https://example.com/the-crown.jpg" alt="The Crown">
                        </div>
                        <span class="duration ellipsized">4 seasons</span>
                    </div>
                </div>
            </div>
        </div>`,
    expandedHtml: `
        <div class="moreLikeThis--container moreLikeThis--expanded">
            <div class="titleCard--container" role="button" tabindex="0">
                <div class="titleCard-imageWrapper has-duration">
                    <div class="ptrack-content">
                        <img src="https://example.com/alt-only.jpg" alt="Alt Only Title">
                    </div>
                    <span class="duration ellipsized">2h 5m</span>
                </div>
            </div>
            <div class="titleCard--container" aria-label="No Artwork Label" role="button" tabindex="0">
                <div class="titleCard-imageWrapper has-duration">
                    <div class="ptrack-content">
                        <img src="https://example.com/no-alt.jpg" alt="">
                    </div>
                    <span class="duration ellipsized">1h 30m</span>
                </div>
            </div>
        </div>`
};
```

- [x] **Step 2: Write the failing UI test**

In `tests/ui/netflix.ui.test.ts`, add `expect` to the Vitest import, import `Title`, import the `DiscoveredSurface` type, and import `NETFLIX_MORE_LIKE_THIS_SECTION`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { NetflixService } from '../../src/core/services/index';
import { NetflixSurfaceManager } from '../../src/core/surfaces/index';
import { Title } from '../../src/core/title';
import type { DiscoveredSurface } from '../../src/types/surfaces';
import fixtures, { NETFLIX_MORE_LIKE_THIS_SECTION } from '../fixtures/netflix-surfaces';
import { testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';
```

Add inside the `describe('Netflix surfaces')` block:

```ts
function attachOverlay(surface: DiscoveredSurface): void {
    if (overlayRenderer.hasOverlay(surface.container as HTMLElement)) return;
    overlayRenderer.injectOverlay(
        surface.container as HTMLElement,
        new Title({ displayTitle: surface.title, imdbRating: 8.5, imdbId: 'tt1234567' }),
        {
            displayTitle: surface.title,
            onEditClick: () => {},
            onRefreshClick: () => {},
            fadeToggleState: undefined,
            onFadeToggleClick: undefined,
        }
    );
}

it('should decorate collapsed and expanded More Like This tiles once', () => {
    document.body.innerHTML = NETFLIX_MORE_LIKE_THIS_SECTION.collapsedHtml;

    let surfaces = surfaceManager.discover(document.body);
    expect(surfaces).toHaveLength(2);
    expect(surfaces.map(surface => surface.title)).toEqual(['Caramelo', 'The Crown']);
    surfaces.forEach(surface => {
        expect(surface.fadeable).toBe(true);
        expect(surface.showFadeToggle).toBe(false);
        expect(surface.container).toHaveClass('titleCard-imageWrapper');
        attachOverlay(surface);
    });

    const wrapper = document.querySelector('.moreLikeThis--wrapper');
    if (!wrapper) throw new Error('More Like This wrapper missing');
    wrapper.insertAdjacentHTML('beforeend', NETFLIX_MORE_LIKE_THIS_SECTION.expandedHtml);

    surfaces = surfaceManager.discover(document.body);
    expect(surfaces).toHaveLength(4);
    expect(surfaces.map(surface => surface.title)).toEqual([
        'Caramelo',
        'The Crown',
        'Alt Only Title',
        'No Artwork Label',
    ]);
    surfaces.forEach(attachOverlay);

    document.querySelectorAll('.titleCard-imageWrapper').forEach(container => {
        expect(container.querySelectorAll('.fm-rating-overlay')).toHaveLength(1);
    });

    surfaces.forEach(attachOverlay);
    expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(4);
});
```

- [x] **Step 3: Run the UI test to verify it fails**

Run: `npx vitest run tests/ui/netflix.ui.test.ts`
Expected: FAIL because no More Like This surface is defined, so discovery returns zero tiles.

- [x] **Step 4: Add the failing unit discovery tests**

In `tests/unit/core/surfaces/surfaces.test.ts`, add `NetflixSurfaceManager` to the import block, then add:

```ts
describe('Netflix More Like This surfaces', () => {
    function discoverMoreLikeThis(html: string) {
        document.body.innerHTML = html;
        return new NetflixSurfaceManager(buildLogger().build()).discover(document.body);
    }

    it('discovers a tile with browse-card flags and the artwork container', () => {
        const [surface] = discoverMoreLikeThis(`
            <div class="moreLikeThis--wrapper">
                <div class="titleCard--container" aria-label="Caramelo">
                    <div class="titleCard-imageWrapper"><img alt="Caramelo"></div>
                </div>
            </div>
        `);
        expect(surface).toMatchObject({ title: 'Caramelo', fadeable: true, showFadeToggle: false });
        expect(surface.container).toBe(document.querySelector('.titleCard-imageWrapper'));
    });

    it('discovers a tile from the artwork alt when the label is missing', () => {
        const [surface] = discoverMoreLikeThis(`
            <div class="moreLikeThis--wrapper">
                <div class="titleCard--container">
                    <div class="titleCard-imageWrapper"><img alt="Alt Only Title"></div>
                </div>
            </div>
        `);
        expect(surface.title).toBe('Alt Only Title');
    });

    it('anchors to the tile itself when the image wrapper is missing', () => {
        const [surface] = discoverMoreLikeThis(`
            <div class="moreLikeThis--wrapper">
                <div class="titleCard--container" aria-label="No Wrapper">
                    <img alt="No Wrapper">
                </div>
            </div>
        `);
        expect(surface.container).toBe(document.querySelector('.titleCard--container'));
    });

    it('does not discover a tile without a usable label or alt', () => {
        expect(
            discoverMoreLikeThis(`
                <div class="moreLikeThis--wrapper">
                    <div class="titleCard--container" aria-label="   ">
                        <div class="titleCard-imageWrapper"><img alt="   "></div>
                    </div>
                </div>
            `)
        ).toEqual([]);
    });

    it('does not discover titleCard--container markup outside the More Like This wrapper', () => {
        expect(
            discoverMoreLikeThis(`
                <div class="previewModal--wrapper detail-modal">
                    <div class="titleCard--container" aria-label="Hero">
                        <div class="titleCard-imageWrapper"><img alt="Hero"></div>
                    </div>
                </div>
            `)
        ).toEqual([]);
    });
});
```

- [x] **Step 5: Run the unit tests to verify they fail**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts`
Expected: FAIL because the More Like This surface is not defined yet.

- [x] **Step 6: Implement the surface definition**

In `src/core/surfaces/surface-definitions/netflix-surfaces.ts`, add below the import block:

```ts
const containerFromMoreLikeThisArtwork = (element: Element): Element | undefined => {
    return element.querySelector('.titleCard-imageWrapper') ?? element;
};
```

Add the entry after `RANKED_CARD` and before `PREVIEW_MINI`:

```ts
    // Title detail modal "More Like This" recommendations: the tile carries the label and the
    // artwork wrapper is the badge anchor. Ordinary browse-card fade behavior applies.
    MORE_LIKE_THIS: Object.freeze({
        titleSelector: '.moreLikeThis--wrapper .titleCard--container',
        getTitle: extractNetflixMoreLikeThisTitle,
        getContainer: containerFromMoreLikeThisArtwork,
        fadeable: true,
        showFadeToggle: false,
    }),
```

- [x] **Step 7: Run the focused tests to verify they pass**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts tests/ui/netflix.ui.test.ts`
Expected: PASS. The existing fixture suite also confirms that every other Netflix surface still discovers exactly one surface.

- [x] **Step 8: Update the README feature line**

In `README.md`, replace the `Rating Badges` bullet with:

```md
- **Rating Badges**: View IMDb ratings on titles, title previews, detail pages, and More Like This recommendations. Metacritic and Rotten Tomatoes scores appear when the selected provider supplies them
```

- [x] **Step 9: Check formatting before committing**

Run: `npm run format:check`
Expected: PASS. If it fails, run `npm run format` and include the changes in the task commit.

- [x] **Step 10: Commit**

```bash
git add src/core/surfaces/surface-definitions/netflix-surfaces.ts tests/fixtures/netflix-surfaces.ts tests/ui/netflix.ui.test.ts tests/unit/core/surfaces/surfaces.test.ts README.md
git commit -m "feat(surfaces): show ratings on Netflix More Like This tiles"
```

---

### Task 3: Full verification

**Files:** None.

- [ ] **Step 1: Run the type check**

Run: `npm run type-check`
Expected: PASS with no errors.

- [ ] **Step 2: Run lint and formatting checks**

Run: `npm run lint && npm run format:check`
Expected: PASS with no findings.

- [ ] **Step 3: Build all three targets**

Run: `npm run build`
Expected: PASS; userscript, Firefox, and Chrome outputs build without errors.

- [ ] **Step 4: Run the coverage suite**

Run: `npm run test:coverage`
Expected: PASS; all unit and UI tests pass and coverage thresholds hold.

- [ ] **Step 5: Confirm no generated files were changed**

Run: `git status --short`
Expected: only the source, test, README, spec, and plan files from this work are listed, plus the pre-existing unrelated changes under `tests/unit/core/api/omdb-api-client.test.ts` and `docs/reviews/`. No `dist/` or `coverage/` entries.
