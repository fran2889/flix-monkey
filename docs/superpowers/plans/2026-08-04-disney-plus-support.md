# Disney+ Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Disney+ movie and series rating badges, shared fading, and service configuration to all FlixMonkey targets.

**Architecture:** Add a Disney+-specific service and surface manager while leaving the shared application, rating, caching, fade, and SPA-observer pipelines unchanged. Discover Disney+ title links through stable `data-testid` attributes, parse their accessible labels locally, and decorate the parent shelf-card element so the renderer never nests its IMDb link inside a Disney+ link.

**Tech Stack:** JavaScript ES2022, Rollup, Vitest with jsdom, MSW, ESLint, Prettier, browser extension manifests, and userscript metadata.

## Global Constraints

- Node.js version floor is `>= 24`.
- Preserve ES modules, async/await conventions, private fields, existing service abstractions, and the GPL-3.0 license header in every changed source and test file.
- Match only `https://www.disneyplus.com/*` in extension manifests and userscript metadata; locale is represented by the URL path.
- Add no rating provider, cache behavior, or overlay-rendering behavior specific to Disney+.
- Decorate only movie and series shelf cards on home, browse, watchlist, search, and collection shelves. Exclude home hero, title-detail, live, scheduled-event, episode, and collection-page surfaces.
- Keep prose ASCII-only, use the Oxford comma, and avoid em dashes.
- Follow the repository test taxonomy: DOM fixture discovery and injection checks belong in `tests/ui/`; label parsing and service behavior belong in `tests/unit/`.

---

### Task 1: Add Disney+ surface discovery and parser coverage

**Files:**

- Modify: `src/core/surfaces.js`
- Modify: `tests/unit/core/surfaces.test.js`

**Interfaces:**

- Consumes: `SurfaceManager`, `containerFromParent`, and `SurfaceDefinition` from `src/core/surfaces.js`.
- Produces: `extractDisneyPlusTitle(tile: Element): string | null`, `DISNEY_PLUS_SURFACES`, and `DisneyPlusSurfaceManager`.
- Behavior contract: accepted cards match `a[data-testid="set-item"][data-item-id][href*="/browse/entity-"]`; their parent is the fadeable, non-toggle overlay container.

- [ ] **Step 1: Write failing unit tests for Disney+ label parsing and rejected labels**

    In `tests/unit/core/surfaces.test.js`, import `extractDisneyPlusTitle` and `DisneyPlusSurfaceManager`. Add a `describe('Disney+ surfaces', ...)` block with these exact parsing cases:

    ```js
    it.each([
        [
            'Subtitles Available Badge Avatar: Fire and Ash Rated 12+ Released 2025. Action and Adventure Select for details on this title.',
            'Avatar: Fire and Ash',
        ],
        ['Dubbing Available Badge Zootropolis 2 Select for details on this title.', 'Zootropolis 2'],
        ['The Doomies Disney+ Original Select for details on this title.', 'The Doomies'],
        ['Adults Hulu Original Series Select for details on this title.', 'Adults'],
        ['Spider-Man: Homecoming Select for details on this title.', 'Spider-Man: Homecoming'],
    ])('extracts a Disney+ title from %s', (ariaLabel, expected) => {
        const tile = document.createElement('a');
        tile.setAttribute('aria-label', ariaLabel);
        expect(extractDisneyPlusTitle(tile)).toBe(expected);
    });

    it.each([
        undefined,
        'LIVE Started 47 minutes ago Senior League Baseball Choose Feed Entry',
        'Upcoming 09/08 | 8:00pm New York XIST vs. Michigan Hybrid',
        'Avatar: Fire and Ash',
        'Select for details on this title.',
    ])('rejects unsupported Disney+ labels: %s', ariaLabel => {
        const tile = document.createElement('a');
        if (ariaLabel !== undefined) tile.setAttribute('aria-label', ariaLabel);
        expect(extractDisneyPlusTitle(tile)).toBeNull();
    });

    it('uses the shelf-card parent as the fadeable Disney+ overlay container', () => {
        document.body.innerHTML = `
            <div data-testid="set-shelf-item">
                <a data-testid="set-item" data-item-id="id" href="//en-gb/browse/entity-id"
                   aria-label="Loki Disney+ Original Select for details on this title."></a>
            </div>
        `;

        const [surface] = new DisneyPlusSurfaceManager(createMockLogger()).discover(document.body);
        expect(surface).toMatchObject({ title: 'Loki', fadeable: true, showFadeToggle: false });
        expect(surface.container).toBe(document.querySelector('[data-testid="set-shelf-item"]'));
    });
    ```

- [ ] **Step 2: Run the focused test file and verify the new cases fail**

    Run: `npx vitest run tests/unit/core/surfaces.test.js`

    Expected: FAIL because the Disney+ exports do not exist.

- [ ] **Step 3: Implement the parser, surface definition, and manager**

    In `src/core/surfaces.js`, add the following after the HBO Max surface definitions. Keep the existing Netflix and HBO Max exports unchanged.

    ```js
    export function extractDisneyPlusTitle(tile) {
        const label = tile
            .getAttribute('aria-label')
            ?.replace(/[\u2066-\u2069]/g, '')
            .trim();
        const detailsSuffix = 'Select for details on this title.';
        if (!label || /^(?:LIVE|Upcoming)\b/iu.test(label) || !label.endsWith(detailsSuffix)) return null;

        const content = label
            .slice(0, -detailsSuffix.length)
            .replace(/^(?:(?:Subtitles|Dubbing) Available Badge\s+)+/u, '')
            .trim();
        const title = content
            .split(/\s+(?:Rated\s+\S+|Released\s+\d{4}\b|(?:Disney\+|Hulu) Original(?: Series)?)(?=[.\s]|$)/u)[0]
            ?.trim();
        return title || null;
    }

    export const DISNEY_PLUS_SURFACES = Object.freeze({
        SHELF_CARD: Object.freeze({
            titleSelector: 'a[data-testid="set-item"][data-item-id][href*="/browse/entity-"]',
            getTitle: extractDisneyPlusTitle,
            getContainer: containerFromParent,
            fadeable: true,
            showFadeToggle: false,
        }),
    });

    export class DisneyPlusSurfaceManager extends SurfaceManager {
        constructor(logger) {
            super(DISNEY_PLUS_SURFACES, logger);
        }
    }
    ```

    The parent element is intentional: `OverlayRenderer.injectOverlay()` creates an IMDb anchor, and placing it inside Disney+'s title anchor would create invalid nested links.

- [ ] **Step 4: Run unit tests and formatting for the changed core files**

    Run: `npx vitest run tests/unit/core/surfaces.test.js && npx prettier --check src/core/surfaces.js tests/unit/core/surfaces.test.js`

    Expected: PASS.

- [ ] **Step 5: Commit the surface-manager deliverable**

    ```bash
    git add src/core/surfaces.js tests/unit/core/surfaces.test.js
    git commit -m "feat(surfaces): add disney plus card discovery"
    ```

### Task 2: Register Disney+ and expose its enabled-by-default setting

**Files:**

- Modify: `src/core/services.js`
- Modify: `src/core/config-fields.js`
- Modify: `tests/unit/core/services.test.js`
- Modify: `tests/unit/core/config-fields.test.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

**Interfaces:**

- Consumes: `DisneyPlusSurfaceManager` from `src/core/surfaces.js`, `StreamingService`, `ServiceRegistry`, and `CONFIG_FIELDS`.
- Produces: `DisneyPlusService` with ID `disneyplus`, domain `disneyplus.com`, and `isEnabled(configManager)` reading `enableDisneyPlus`; configuration field `enableDisneyPlus` defaulting to `true`.
- Behavior contract: `ServiceRegistry.detect()` returns `DisneyPlusService` for `www.disneyplus.com`, and the Settings UI renders the new checkbox as checked by default.

- [ ] **Step 1: Write failing registry and settings tests**

    Update `tests/unit/core/services.test.js` to import `DisneyPlusService` and `DisneyPlusSurfaceManager`, then extend existing tables:

    ```js
    ['Disney+', DisneyPlusService, DisneyPlusSurfaceManager, 'enableDisneyPlus'],
    ```

    Add the following service detection case:

    ```js
    ['www.disneyplus.com', DisneyPlusService],
    ```

    In `tests/unit/core/config-fields.test.js`, add a focused default assertion:

    ```js
    it('enables Disney+ by default', () => {
        expect(CONFIG_FIELDS.find(field => field.key === 'enableDisneyPlus')).toMatchObject({
            label: 'Disney+',
            type: 'checkbox',
            default: true,
            row: 'services',
        });
    });
    ```

    In `tests/unit/core/ui/settings-ui.test.js`, add a rendering assertion beside the existing Netflix test:

    ```js
    it('should render enableDisneyPlus as a checked checkbox by default', async () => {
        await settingsUI.render(container);
        const checkbox = container.querySelector('#fm-enableDisneyPlus');
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
    });
    ```

- [ ] **Step 2: Run focused tests and verify failure**

    Run: `npx vitest run tests/unit/core/services.test.js tests/unit/core/config-fields.test.js tests/unit/core/ui/settings-ui.test.js`

    Expected: FAIL because `DisneyPlusService` and `enableDisneyPlus` do not exist.

- [ ] **Step 3: Implement the service and setting**

    In `src/core/services.js`, add `DisneyPlusSurfaceManager` to the surfaces import, then add this class after `HboMaxService`:

    ```js
    export class DisneyPlusService extends StreamingService {
        get id() {
            return 'disneyplus';
        }

        get domains() {
            return Object.freeze(['disneyplus.com']);
        }

        get SurfaceManager() {
            return DisneyPlusSurfaceManager;
        }

        isEnabled(configManager) {
            return configManager.getBool('enableDisneyPlus');
        }
    }
    ```

    Register it in `SERVICES`:

    ```js
    disneyplus: new DisneyPlusService(),
    ```

    In `src/core/config-fields.js`, insert this checkbox immediately after `enableHboMax` so all service switches stay in the existing `services` row:

    ```js
    {
        key: 'enableDisneyPlus',
        label: 'Disney+',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Disney+',
        row: 'services',
    },
    ```

- [ ] **Step 4: Run focused tests and lint**

    Run: `npx vitest run tests/unit/core/services.test.js tests/unit/core/config-fields.test.js tests/unit/core/ui/settings-ui.test.js && npm run lint -- --quiet`

    Expected: PASS.

- [ ] **Step 5: Commit the service-registry deliverable**

    ```bash
    git add src/core/services.js src/core/config-fields.js tests/unit/core/services.test.js tests/unit/core/config-fields.test.js tests/unit/core/ui/settings-ui.test.js
    git commit -m "feat(services): register disney plus"
    ```

### Task 3: Enable the runtime on all targets and reload Disney+ tabs after settings changes

**Files:**

- Modify: `src/targets/chrome/manifest.json`
- Modify: `src/targets/firefox/manifest.json`
- Modify: `src/targets/userscript/metadata.js`
- Modify: `src/targets/extension/options.js`
- Modify: `tests/unit/targets/options.test.js`

**Interfaces:**

- Consumes: the `www.disneyplus.com` service host and the extension options `SettingsUI.onSave` callback.
- Produces: Chrome and Firefox content-script matches and host permissions, a userscript `@match`, and options-page reload coverage for Disney+ tabs.
- Behavior contract: installed extension and userscript code runs on `https://www.disneyplus.com/*`; saving settings reloads all matching Netflix, HBO Max, and Disney+ tabs.

- [ ] **Step 1: Write the failing options-page reload test**

    In `tests/unit/targets/options.test.js`, replace the HBO Max-only test description and expected query with:

    ```js
    it('should wire onSave to reload Netflix, HBO Max, and Disney+ tabs', async () => {
        expect(capturedInstance.onSave).toBeTypeOf('function');
        await capturedInstance.onSave();

        expect(tabsQuerySpy).toHaveBeenCalledWith({
            url: ['*://*.netflix.com/*', '*://play.hbomax.com/*', '*://www.disneyplus.com/*'],
        });
        expect(tabsReloadSpy).toHaveBeenCalledWith(1);
        expect(tabsReloadSpy).toHaveBeenCalledWith(42);
    });
    ```

- [ ] **Step 2: Run the target test and verify failure**

    Run: `npx vitest run tests/unit/targets/options.test.js`

    Expected: FAIL because the tab query does not include Disney+.

- [ ] **Step 3: Add Disney+ to target matches, permissions, and reload query**

    In both manifest files, add the same host pattern to `host_permissions` and `content_scripts[0].matches`:

    ```json
    "https://www.disneyplus.com/*"
    ```

    Keep JSON commas valid and retain all API host permissions. In `src/targets/userscript/metadata.js`, add:

    ```js
    // @match        https://www.disneyplus.com/*
    ```

    In `src/targets/extension/options.js`, change the `browser.tabs.query` URL list to:

    ```js
    url: ['*://*.netflix.com/*', '*://play.hbomax.com/*', '*://www.disneyplus.com/*'],
    ```

- [ ] **Step 4: Verify target tests, formatting, and builds**

    Run: `npx vitest run tests/unit/targets/options.test.js && npm run format:check && npm run build`

    Expected: PASS; all three targets build and package successfully.

- [ ] **Step 5: Commit the target-runtime deliverable**

    ```bash
    git add src/targets/chrome/manifest.json src/targets/firefox/manifest.json src/targets/userscript/metadata.js src/targets/extension/options.js tests/unit/targets/options.test.js
    git commit -m "feat(targets): enable disney plus support"
    ```

### Task 4: Add a Disney+ DOM fixture and UI-level surface coverage

**Files:**

- Create: `tests/fixtures/disneyplus-browse.html`
- Create: `tests/ui/disneyplus-browse.ui.test.js`

**Interfaces:**

- Consumes: `DisneyPlusSurfaceManager`, `DisneyPlusService`, `OverlayRenderer`, and the `data-testid` DOM contract from Disney+ shelf cards.
- Produces: fixture-backed discovery and injection coverage for supported Disney+ cards, live cards, scheduled cards, and collection-page links.
- Behavior contract: only eligible movie and series cards are discovered; overlays attach to shelf-card parents and never create nested anchors.

- [ ] **Step 1: Create the fixture with supported and excluded surfaces**

    Create `tests/fixtures/disneyplus-browse.html` with the GPL-3.0 HTML license header and this body structure:

    ```html
    <main>
        <div data-testid="set-shelf-item" role="group">
            <a
                data-testid="set-item"
                data-item-id="movie-id"
                href="//en-gb/browse/entity-movie-id"
                aria-label="Subtitles Available Badge Avatar: Fire and Ash Rated 12+ Released 2025. Action and Adventure Select for details on this title."
            ></a>
        </div>
        <div data-testid="set-shelf-item" role="group">
            <a
                data-testid="set-item"
                data-item-id="series-id"
                href="//en-gb/browse/entity-series-id"
                aria-label="Loki Disney+ Original Select for details on this title."
            ></a>
        </div>
        <div data-testid="set-shelf-item" role="group">
            <a
                data-testid="set-item"
                data-item-id="live-id"
                href="//en-gb/browse/entity-live-id"
                aria-label="LIVE Started 47 minutes ago Senior League Baseball Choose Feed Entry"
            ></a>
        </div>
        <div data-testid="set-shelf-item" role="group">
            <a
                data-testid="set-item"
                data-item-id="upcoming-id"
                href="//en-gb/browse/entity-upcoming-id"
                aria-label="Upcoming 09/08 | 8:00pm New York XIST vs. Michigan Hybrid"
            ></a>
        </div>
        <div data-testid="set-shelf-item" role="group">
            <a
                data-testid="set-item"
                data-item-id="collection-id"
                href="//en-gb/browse/page-collection-id"
                aria-label="Marvel Collection Select for details on this title."
            ></a>
        </div>
    </main>
    ```

- [ ] **Step 2: Write the failing fixture-backed UI test**

    Create `tests/ui/disneyplus-browse.ui.test.js` with the GPL-3.0 JS license header. Follow `tests/ui/hbomax-browse.ui.test.js`: load the fixture with `fs.readFileSync`, initialize `DisneyPlusSurfaceManager` and `OverlayRenderer`, then assert discovery and injection:

    ```js
    it('discovers supported Disney+ cards and injects parent overlays', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.map(surface => surface.title)).toEqual(['Avatar: Fire and Ash', 'Loki']);
        expect(surfaces.every(({ container }) => container.matches('[data-testid="set-shelf-item"]'))).toBe(true);
        expect(surfaces.every(({ fadeable, showFadeToggle }) => fadeable && !showFadeToggle)).toBe(true);

        surfaces.forEach(({ container }) => {
            overlayRenderer.injectOverlay(container, {
                rating: 8.5,
                imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            });
        });

        expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(2);
        expect(document.querySelectorAll('[data-testid="set-shelf-item"] > .fm-rating-overlay')).toHaveLength(2);
        expect(document.querySelectorAll('a a')).toHaveLength(0);
    });
    ```

- [ ] **Step 3: Run the UI test after the Task 1 surface manager is available**

    Run: `npx vitest run tests/ui/disneyplus-browse.ui.test.js`

    Expected: PASS. The parser's failing and passing test cycle is completed in Task 1; this task adds fixture-backed discovery and injection coverage for that implementation.

- [ ] **Step 4: Run UI coverage after completing fixture wiring**

    Run: `npx vitest run tests/ui/disneyplus-browse.ui.test.js tests/ui/hbomax-browse.ui.test.js tests/ui/netflix-browse.ui.test.js`

    Expected: PASS, proving that Disney+ support does not regress the existing fixture-backed surfaces.

- [ ] **Step 5: Commit the UI deliverable**

    ```bash
    git add tests/fixtures/disneyplus-browse.html tests/ui/disneyplus-browse.ui.test.js
    git commit -m "test(ui): cover disney plus browse cards"
    ```

### Task 5: Update user-facing service documentation and complete release verification

**Files:**

- Modify: `README.md`
- Modify: `docs/store-description.txt`
- Modify: `package.json`

**Interfaces:**

- Consumes: the supported-service list: Netflix, HBO Max, and Disney+.
- Produces: consistent service names in package metadata, store copy, README overview, settings help, troubleshooting, privacy text, and tab-reload documentation.

- [ ] **Step 1: Update product copy to name all three services**

    Make the following exact category of replacements, preserving existing meaning:

    ```text
    Netflix and HBO Max
    ```

    becomes:

    ```text
    Netflix, HBO Max, and Disney+
    ```

    Apply it to `package.json`'s description, the first two service references in `docs/store-description.txt`, and every user-facing Netflix/HBO Max service list in `README.md`, including multi-tab sync, the Enabled Streaming Services default, save behavior, troubleshooting, title lookup explanation, support guidance, and privacy disclosure. Keep the screenshots unchanged because no representative Disney+ screenshot is part of this scope.

- [ ] **Step 2: Check documentation formatting and package JSON**

    Run: `npm run format:check && node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('package.json valid')"`

    Expected: PASS and `package.json valid`.

- [ ] **Step 3: Run the full verification suite**

    Run: `npm run lint && npm run format:check && npm test && npm run build`

    Expected: all lint, format, unit, UI, build, icon-generation, and packaging steps PASS.

- [ ] **Step 4: Inspect the final change set**

    Run: `git status --short && git diff --check && git diff --stat`

    Expected: only the README, store description, and package metadata are uncommitted at this step; `git diff --check` reports no whitespace errors; and the diff stat contains only the intended Disney+ documentation changes.

- [ ] **Step 5: Commit the documentation deliverable**

    ```bash
    git add README.md docs/store-description.txt package.json
    git commit -m "docs: list disney plus support"
    ```
