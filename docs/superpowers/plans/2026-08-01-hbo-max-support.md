# HBO Max Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default-enabled HBO Max ratings for movie, show, and mini-series tiles in the userscript, Firefox extension, and Chrome extension.

**Architecture:** Register an HBO Max service and an HBO-specific surface manager. Add an optional surface title callback so its label parser stays isolated while Netflix continues to use attribute-based discovery.

**Tech Stack:** JavaScript ES2022, Vitest/jsdom, Rollup, MV3 manifests, ESLint, and Prettier.

## Global Constraints

- Support only `play.hbomax.com`.
- Default `enableHboMax` to `true` in the existing services row.
- Discover only movie, show, and mini-series tiles. Exclude heroes, episodes/videos, sport, topical cards, menus, and hover-only views.
- Reuse the existing cache, API, renderer, fade, mutation observer, and SPA handling unchanged.
- Add GPL headers to every new `src/` or `tests/` file.
- Keep code and copy ASCII except where tests need directional-control characters.
- Update `README.md`, `package.json`, and `docs/store-description.txt`.

---

### Task 1: Add HBO Max Surface Discovery

**Files:**

- Modify: `src/core/surfaces.js`
- Modify: `tests/unit/core/surfaces.test.js`
- Create: `tests/fixtures/hbomax-browse.html`
- Create: `tests/ui/hbomax-browse.ui.test.js`

**Interfaces:**

- Produces: `HBO_MAX_SURFACES`, `extractHboMaxTitle(tile)`, and `HboMaxSurfaceManager`.
- Preserves: `SurfaceManager.discover(root)` result objects: `{ container, title, fadeable, showFadeToggle }`.

- [ ] **Step 1: Write failing parser and callback tests**

Import `HboMaxSurfaceManager` and `extractHboMaxTitle`. Add:

```js
it('uses a surface getTitle callback', () => {
    const sm = new SurfaceManager(
        {
            card: {
                titleSelector: '[data-title]',
                containerSelector: '[data-title]',
                getTitle: el => el.dataset.title,
            },
        },
        createMockLogger()
    );
    document.body.innerHTML = '<div data-title="Callback Title"></div>';
    expect(sm.discover(document.body)[0].title).toBe('Callback Title');
});

it.each([
    ['\u2066\u2068Peacemaker\u2069\u2069. \u20682 of 20\u2069\u2069', 'Peacemaker'],
    ['Mr. & Mrs. Smith. 1 of 20.', 'Mr. & Mrs. Smith'],
])('extracts %s', (ariaLabel, expected) => {
    const tile = document.createElement('a');
    tile.dataset.sonicType = 'show';
    tile.setAttribute('aria-label', ariaLabel);
    expect(extractHboMaxTitle(tile)).toBe(expected);
});

it.each(['video', 'sport', 'topical'])('skips %s tiles', type => {
    document.body.innerHTML = `<a data-testid="id_tile" data-sonic-type="${type}" aria-label="Title. 1 of 20."></a>`;
    expect(new HboMaxSurfaceManager(createMockLogger()).discover(document.body)).toEqual([]);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/unit/core/surfaces.test.js`

Expected: FAIL because the callback and HBO Max exports do not exist.

- [ ] **Step 3: Implement the callback and manager**

Make `titleAttribute` optional in `SurfaceDefinition`; document optional `getTitle(element)`. In `discover()`, use:

```js
const rawTitle = surface.getTitle ? surface.getTitle(titleEl) : titleEl.getAttribute(surface.titleAttribute);
const title = rawTitle?.trim() ?? null;
```

Add this code to `src/core/surfaces.js` without altering Netflix definitions:

```js
export function extractHboMaxTitle(tile) {
    if (!['movie', 'show', 'mini-series'].includes(tile.dataset.sonicType)) return null;
    const label = tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
    const match = label?.match(/^(.+?)\.\s+\d+\s+\D+\s+\d+(?:\.|$)/u);
    return match?.[1]?.trim() || null;
}

export const HBO_MAX_SURFACES = Object.freeze({
    TILE: Object.freeze({
        titleSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        containerSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        getTitle: extractHboMaxTitle,
        fadeable: true,
        showFadeToggle: false,
    }),
});

export class HboMaxSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(HBO_MAX_SURFACES, logger);
    }
}
```

- [ ] **Step 4: Verify unit tests pass**

Run: `npx vitest run tests/unit/core/surfaces.test.js`

Expected: PASS.

- [ ] **Step 5: Add fixture-backed UI tests**

Create `tests/fixtures/hbomax-browse.html` with sanitized movie, show, mini-series, video, and sport tile links. Give each link `data-testid="<id>_tile"`, `data-sonic-type`, and an `aria-label` in `Title. N of M.` form.

Create `tests/ui/hbomax-browse.ui.test.js`, including the GPL header. Load the fixture, use `HboMaxSurfaceManager` with the existing mock helpers, and assert:

```js
expect(surfaceManager.discover(document.body).map(surface => surface.title)).toEqual([
    'Movie Title',
    'Show Title',
    'Mini Series Title',
]);

surfaceManager.discover(document.body).forEach(({ container }) => {
    overlayRenderer.injectOverlay(container, { rating: 8.5, imdbUrl: 'https://www.imdb.com/title/tt1234567/' });
});
expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(3);
```

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run tests/unit/core/surfaces.test.js tests/ui/hbomax-browse.ui.test.js`

Expected: PASS.

```bash
git add src/core/surfaces.js tests/unit/core/surfaces.test.js tests/fixtures/hbomax-browse.html tests/ui/hbomax-browse.ui.test.js
git commit -m "feat(surfaces): add HBO Max tile discovery"
```

### Task 2: Register HBO Max and Its Default Setting

**Files:**

- Modify: `src/core/services.js`
- Modify: `src/core/config-fields.js`
- Modify: `tests/unit/core/services.test.js`
- Modify: `tests/unit/core/config-fields.test.js`

**Interfaces:**

- Consumes: `HboMaxSurfaceManager` and `ConfigManager.getBool(key)`.
- Produces: `HboMaxService`, `SERVICES.hbomax`, and `enableHboMax` defaulting to `true`.

- [ ] **Step 1: Write failing service and setting tests**

Import `HboMaxService`; test ID `hbomax`, frozen `['play.hbomax.com']` domains, `HboMaxSurfaceManager`, enabled/disabled `getBool` results, and `SERVICES.hbomax`. Add `ServiceRegistry.detect()` cases for `play.hbomax.com` (`hbomax`) and `www.hbomax.com` (`null`). In the config field test, add:

```js
expect(CONFIG_FIELDS.find(field => field.key === 'enableHboMax')).toMatchObject({
    label: 'HBO Max',
    type: 'checkbox',
    default: true,
    row: 'services',
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/core/services.test.js tests/unit/core/config-fields.test.js`

Expected: FAIL because HBO Max is not registered or configured.

- [ ] **Step 3: Implement the service and field**

Import `HboMaxSurfaceManager`, then add:

```js
export class HboMaxService extends StreamingService {
    get id() {
        return 'hbomax';
    }
    get domains() {
        return Object.freeze(['play.hbomax.com']);
    }
    get SurfaceManager() {
        return HboMaxSurfaceManager;
    }
    isEnabled(configManager) {
        return configManager.getBool('enableHboMax');
    }
}
```

Add `hbomax: new HboMaxService()` to `SERVICES`. Insert this immediately after `enableNetflix` in `src/core/config-fields.js`:

```js
{
    key: 'enableHboMax', label: 'HBO Max', type: 'checkbox', default: true,
    title: 'Enable FlixMonkey on HBO Max', row: 'services',
},
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run tests/unit/core/services.test.js tests/unit/core/config-fields.test.js`

Expected: PASS.

```bash
git add src/core/services.js src/core/config-fields.js tests/unit/core/services.test.js tests/unit/core/config-fields.test.js
git commit -m "feat(services): register HBO Max"
```

### Task 3: Wire All Targets and Settings Reload

**Files:**

- Modify: `src/targets/chrome/manifest.json`
- Modify: `src/targets/firefox/manifest.json`
- Modify: `src/targets/userscript/metadata.js`
- Modify: `src/targets/extension/options.js`
- Modify: `tests/unit/targets/options.test.js`

**Interfaces:**

- Produces: injection on `play.hbomax.com` and settings reload for Netflix and HBO Max tabs.

- [ ] **Step 1: Write the failing reload test**

Replace the Netflix-only expected query with:

```js
expect(tabsQuerySpy).toHaveBeenCalledWith({
    url: ['*://*.netflix.com/*', '*://play.hbomax.com/*'],
});
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/targets/options.test.js`

Expected: FAIL because only Netflix is queried.

- [ ] **Step 3: Add exact match patterns and reload query**

Add `"https://play.hbomax.com/*"` to `host_permissions` and `content_scripts[0].matches` in both manifests. Add `// @match        https://play.hbomax.com/*` after the Netflix userscript match. Change the options query to:

```js
const tabs = await browser.tabs.query({
    url: ['*://*.netflix.com/*', '*://play.hbomax.com/*'],
});
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run tests/unit/targets/options.test.js && npm run build`

Expected: PASS; Rollup creates userscript, Firefox, and Chrome output without manifest errors.

```bash
git add src/targets/chrome/manifest.json src/targets/firefox/manifest.json src/targets/userscript/metadata.js src/targets/extension/options.js tests/unit/targets/options.test.js
git commit -m "feat(targets): inject on HBO Max"
```

### Task 4: Update Product Copy and Verify the Complete Change

**Files:**

- Modify: `README.md`
- Modify: `package.json`
- Modify: `docs/store-description.txt`

**Interfaces:**

- Produces: consistent two-service copy.

- [ ] **Step 1: Update package and store description**

Set `package.json` description to:

```json
"description": "See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix and HBO Max."
```

Set the opening of `docs/store-description.txt` to “FlixMonkey adds title ratings directly to Netflix and HBO Max, helping you decide what to watch before you press play.” Change the first feature bullet to name Netflix and HBO Max titles.

- [ ] **Step 2: Update README**

Replace the introduction with “See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix and HBO Max.” Change Multi-Tab Sync to name Netflix and HBO Max tabs. Add an Enabled Streaming Services setting row listing Netflix and HBO Max as default-enabled. Retain existing Netflix screenshots and do not add an invented screenshot asset.

- [ ] **Step 3: Run full verification**

Run: `npm run lint && npm run format:check && npm test && npm run build`

Expected: all commands exit 0. Confirm the built userscript includes the HBO Max `@match`; confirm both built manifests include `https://play.hbomax.com/*` in permissions and content-script matches.

- [ ] **Step 4: Commit and inspect status**

```bash
git add README.md package.json docs/store-description.txt
git commit -m "docs: mention HBO Max support"
git status --short
git log --oneline -4
```

Expected: no unintended changes remain and commits cover discovery, registration, target wiring, and copy.

## Plan Self-Review

- Spec coverage: Task 1 handles safe tile selection and fixtures; Task 2 adds shared-service registration and default enablement; Task 3 covers all delivery targets; Task 4 covers required copy plus lint, test, and build evidence.
- Placeholder scan: every test, code change, command, expected result, and commit message is explicit.
- Type consistency: `getTitle`, `extractHboMaxTitle`, `HBO_MAX_SURFACES`, `HboMaxSurfaceManager`, `HboMaxService`, and `enableHboMax` use one spelling throughout.
