# Surfaces Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead surfaces (BOB, jawBone), tighten previewModal to its one live selector and split it into mini-modal / detail-modal surfaces, refresh all Netflix DOM fixtures from a live Chromium session with user data anonymised, and wire two new UI tests to the previewModal fixtures.

**Architecture:** `SurfaceManager.#SURFACES` drives discovery; each entry is self-contained (one selector, one container, one Netflix UI area). Fixtures are captured from Chromium via CDP, anonymised in-process, and saved as HTML files. UI tests load fixture files; unit tests use hand-crafted inline DOM for edge cases only.

**Tech Stack:** Vitest 4.x, jsdom, Python 3 (fixture capture script), Chrome DevTools Protocol over raw WebSocket.

## Global Constraints

- All test files need the GPL-3 licence header (copy from any existing test file verbatim)
- Test runner: `npm run test:unit` (unit only), `npm run test:ui` (UI only), `npm test` (both)
- jsdom environment; `__dirname` is available in test files
- `SurfaceManager` constructor signature: `new SurfaceManager(logger)` — unit tests pass `createMockLogger()`; UI tests call `new SurfaceManager()` (no logger) following the existing pattern in `browse.ui.test.js`
- New files follow existing import style (named ESM imports, no default exports in tests)
- Commit message format: `type(scope): description` — e.g. `test(surfaces): ...`, `refactor(surfaces): ...`, `test(fixtures): ...`

---

## File Map

| Action    | Path                                          | Role                                                             |
| --------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Modify    | `src/core/surfaces.js`                        | Remove BOB + jawBone; split + tighten previewModal; add comments |
| Modify    | `tests/unit/core/surfaces.test.js`            | Remove dead tests; add mini-modal + detail-modal unit tests      |
| Create    | `tests/ui/preview-mini.ui.test.js`            | UI test: mini-modal surface against live fixture                 |
| Create    | `tests/ui/preview-detail.ui.test.js`          | UI test: detail-modal surface against live fixture               |
| Create    | `tests/fixtures/surfaces/preview-mini.html`   | Anonymised mini-modal DOM extract from Chromium                  |
| Create    | `tests/fixtures/surfaces/preview-detail.html` | Anonymised detail-modal DOM extract from Chromium                |
| Create    | `tests/fixtures/surfaces/title-card.html`     | Anonymised browse row DOM extract from Chromium                  |
| Create    | `tests/fixtures/surfaces/standard-card.html`  | Anonymised search grid DOM extract from Chromium                 |
| Overwrite | `tests/fixtures/netflix-browse.html`          | Refreshed from Chromium, user data anonymised                    |
| Overwrite | `tests/fixtures/netflix-search.html`          | Refreshed from Chromium, user data anonymised                    |
| Overwrite | `tests/fixtures/netflix-hover.html`           | Refreshed from Chromium, user data anonymised                    |
| Overwrite | `tests/fixtures/netflix-modal.html`           | Refreshed from Chromium, user data anonymised                    |
| Create    | `scripts/capture-surface-fixtures.py`         | Reusable CDP capture + anonymise script                          |

---

## Task 1: Rewrite `surfaces.test.js`

**Files:**

- Modify: `tests/unit/core/surfaces.test.js`

**Interfaces:**

- Consumes: `SurfaceManager` from `src/core/surfaces.js` (unchanged in this task), `createMockLogger` from `tests/mocks/logger.js`
- Produces: failing tests for mini-modal and detail-modal (surfaces.js not updated yet); deleted tests for BOB, jawBone, stale previewModal selectors

- [x] **Step 1: Replace the file contents**

Replace `tests/unit/core/surfaces.test.js` entirely with:

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect } from 'vitest';
import { SurfaceManager } from '../../../src/core/surfaces.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('SurfaceManager', () => {
    function discover(html) {
        const sm = new SurfaceManager(createMockLogger());
        document.body.innerHTML = html;
        return sm.discover(document.body);
    }

    it('returns empty array when no matching elements exist', () => {
        expect(discover('<div>nothing</div>')).toEqual([]);
    });

    it('discovers title-card surface', () => {
        const results = discover(`
            <div class="title-card">
                <div class="fallback-text">Bones</div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Bones');
        expect(results[0].container.className).toBe('title-card');
        expect(results[0].fadeable).toBe(true);
    });

    it('discovers standard-card surface', () => {
        const results = discover(`
            <div data-uia="standard-card" aria-label="Breaking Bad"></div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Breaking Bad');
        expect(results[0].container.getAttribute('data-uia')).toBe('standard-card');
        expect(results[0].fadeable).toBe(true);
    });

    it('discovers preview mini-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Sweet Magnolias">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Sweet Magnolias');
        expect(results[0].container.className).toBe('previewModal--player_container');
        expect(results[0].fadeable).toBe(false);
    });

    it('discovers preview detail-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper detail-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Sweet Magnolias">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Sweet Magnolias');
        expect(results[0].container.className).toBe('previewModal--player_container');
        expect(results[0].fadeable).toBe(false);
    });

    it('skips element with empty title', () => {
        expect(discover('<div class="title-card"><div class="fallback-text">   </div></div>')).toHaveLength(0);
    });

    it('skips element with null title', () => {
        const mockEl = {
            textContent: null,
            closest: () => document.body,
            parentElement: document.body,
            getAttribute: () => null,
        };
        const sm = new SurfaceManager(createMockLogger());
        expect(sm.discover({ querySelectorAll: () => [mockEl] })).toHaveLength(0);
    });

    it('deduplicates when multiple title elements share the same container', () => {
        const results = discover(`
            <div class="title-card">
                <div class="fallback-text">First</div>
                <div class="fallback-text">Second</div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('First');
    });

    it('falls back to parentElement when containerSel does not match', () => {
        const logger = createMockLogger();
        const sm = new SurfaceManager(logger);
        document.body.innerHTML = `
            <div class="not-a-title-card">
                <div class="fallback-text">Orphan</div>
            </div>
        `;
        const results = sm.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan');
        expect(results[0].container.className).toBe('not-a-title-card');
        expect(logger.warn).toHaveBeenCalledWith('Surface container selector failed, falling back to parentElement', {
            selector: '.title-card',
        });
    });

    it('returns empty array when querySelectorAll throws', () => {
        const sm = new SurfaceManager(createMockLogger());
        expect(
            sm.discover({
                querySelectorAll: () => {
                    throw new Error('fail');
                },
            })
        ).toEqual([]);
    });
});
```

- [x] **Step 2: Run the unit tests and confirm expected failures**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|✓|×|preview"
```

Expected: the two new `preview mini-modal` and `preview detail-modal` tests **fail** (current surfaces.js has no scoped wrapper selectors). All other tests pass. If BOB or jawBone tests appear, they were not deleted — check the file.

- [x] **Step 3: Commit the test rewrite**

```bash
git add tests/unit/core/surfaces.test.js
git commit -m "test(surfaces): remove dead surface tests, add mini/detail modal tests"
```

---

## Task 2: Update `surfaces.js`

**Files:**

- Modify: `src/core/surfaces.js`

**Interfaces:**

- Consumes: nothing new
- Produces: `SurfaceManager.#SURFACES` with 4 entries; priority comment updated; `discover()` unchanged

- [x] **Step 1: Replace `#SURFACES` in `src/core/surfaces.js`**

Replace the `#SURFACES` field and its leading comment (lines 24–72 in the current file) with:

```javascript
    // Surface priority order: title-card → search → previewModal-mini → previewModal-detail.
    // A container matched by an earlier surface is added to `seen` and skipped by
    // all later surfaces, so declaration order determines which definition "wins".
    #SURFACES = [
        {
            // Browse and genre page row cards. `.fallback-text` is the text title
            // Netflix renders for cards whose thumbnail has no baked-in title logo.
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
        },
        {
            // Search result grid cards. The card element itself carries the full
            // title via aria-label; there is no separate fallback-text here.
            titleSelectors: '[data-uia="standard-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="standard-card"]',
            fadeable: true,
        },
        {
            // Hover mini-modal (card mouse-over). Scoped to `.mini-modal` so the
            // detail-modal surface can target the same player container independently.
            titleSelectors: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
        },
        {
            // Full "More Info" detail modal. The boxart <img alt> inside the player
            // container is the only selector that matches in both mini and detail contexts.
            titleSelectors: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
        },
    ];
```

- [x] **Step 2: Run the unit tests — all must pass**

```bash
npm run test:unit
```

Expected output: all tests pass, no failures.

- [x] **Step 3: Commit**

```bash
git add src/core/surfaces.js
git commit -m "refactor(surfaces): remove BOB and jawBone, split previewModal into mini/detail"
```

---

## Task 3: Capture and anonymise DOM fixtures from Chromium

**Files:**

- Create: `scripts/capture-surface-fixtures.py`
- Create: `tests/fixtures/surfaces/preview-mini.html`
- Create: `tests/fixtures/surfaces/preview-detail.html`
- Create: `tests/fixtures/surfaces/title-card.html`
- Create: `tests/fixtures/surfaces/standard-card.html`
- Overwrite: `tests/fixtures/netflix-browse.html`
- Overwrite: `tests/fixtures/netflix-search.html`
- Overwrite: `tests/fixtures/netflix-hover.html`
- Overwrite: `tests/fixtures/netflix-modal.html`

**Prerequisites:** Chromium running with `--remote-debugging-port=9222` and `www.netflix.com/browse` open and logged in.

- [x] **Step 1: Create the capture script**

Create `scripts/capture-surface-fixtures.py`:

```python
#!/usr/bin/env python3
"""
Captures and anonymises Netflix surface fixtures from a live Chromium session.

Usage:
    python3 scripts/capture-surface-fixtures.py

Prerequisites:
    - Chromium launched with --remote-debugging-port=9222
    - Netflix /browse page open and logged in

Outputs:
    tests/fixtures/surfaces/title-card.html
    tests/fixtures/surfaces/standard-card.html
    tests/fixtures/surfaces/preview-mini.html
    tests/fixtures/surfaces/preview-detail.html
    tests/fixtures/netflix-browse.html
    tests/fixtures/netflix-search.html
    tests/fixtures/netflix-hover.html
    tests/fixtures/netflix-modal.html
"""
import json, os, re, socket, struct, time, urllib.request
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------------------
# CDP transport (no external dependencies)
# ---------------------------------------------------------------------------

def _find_netflix_ws():
    data = urllib.request.urlopen('http://localhost:9222/json/list').read()
    pages = json.loads(data)
    for p in pages:
        if 'netflix.com' in p.get('url', '') and p.get('type') == 'page':
            return p['webSocketDebuggerUrl'].replace('ws://localhost:9222', '')
    raise RuntimeError('No Netflix page found on port 9222')

def _connect(ws_path):
    import base64
    key = base64.b64encode(os.urandom(16)).decode()
    s = socket.create_connection(('localhost', 9222))
    s.settimeout(15)
    req = (
        f'GET {ws_path} HTTP/1.1\r\nHost: localhost:9222\r\n'
        'Upgrade: websocket\r\nConnection: Upgrade\r\n'
        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
    )
    s.sendall(req.encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        buf += s.recv(4096)
    return s

def _send(s, msg):
    import base64, os
    data = msg.encode()
    mask = os.urandom(4)
    n = len(data)
    if n <= 125:
        hdr = bytes([0x81, 0x80 | n]) + mask
    elif n <= 65535:
        hdr = bytes([0x81, 0xFE]) + struct.pack('>H', n) + mask
    else:
        hdr = bytes([0x81, 0xFF]) + struct.pack('>Q', n) + mask
    s.sendall(hdr + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

def _recv(s):
    def read(n):
        buf = b''
        while len(buf) < n:
            buf += s.recv(n - len(buf))
        return buf
    h = read(2)
    n = h[1] & 0x7F
    if n == 126:
        n = struct.unpack('>H', read(2))[0]
    elif n == 127:
        n = struct.unpack('>Q', read(8))[0]
    return read(n).decode('utf-8', 'replace')

_mid = 0

def call(s, method, params=None):
    global _mid
    _mid += 1
    m = _mid
    _send(s, json.dumps({'id': m, 'method': method, 'params': params or {}}))
    while True:
        try:
            msg = json.loads(_recv(s))
        except Exception:
            continue
        if msg.get('id') == m:
            return msg.get('result', {})

def ev(s, expr):
    r = call(s, 'Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    res = r.get('result', {})
    if res.get('subtype') == 'error':
        raise RuntimeError(res.get('description', 'eval error'))
    return res.get('value')

def navigate(s, url):
    call(s, 'Page.navigate', {'url': url})
    time.sleep(3)

def screenshot(s, path):
    r = call(s, 'Page.captureScreenshot', {'format': 'png'})
    if 'data' in r:
        import base64
        Path(path).write_bytes(base64.b64decode(r['data']))

# ---------------------------------------------------------------------------
# Anonymisation
# ---------------------------------------------------------------------------

SYNTHETIC_TITLES = ['Bones', 'Avatar: The Last Airbender', 'Sweet Magnolias',
                    'Breaking Bad', 'Narcos', 'Gladiator II']

_TOKEN_RE = re.compile(r'^[A-Za-z0-9+/=_\-]{32,}$')

def _looks_like_token(val):
    """Heuristic: long opaque string or JWT."""
    val = val.strip()
    if val.startswith('ey') and val.count('.') == 2:
        return True
    return bool(_TOKEN_RE.match(val)) and len(val) >= 40


class _Anonymiser(HTMLParser):
    """
    Streaming HTML anonymiser.  Applies anonymisation rules in one pass:
      - Removes <script> elements entirely
      - Removes <link rel="stylesheet"> elements
      - Strips avatar img src (profile picture, identified by context)
      - Replaces profile display name text with 'Test User'
      - Strips data-* attributes whose values look like auth tokens
    Output is reconstructed HTML.
    """

    def __init__(self, profile_name: str = ''):
        super().__init__()
        self._out = []
        self._skip_depth = 0   # >0 while inside a skipped element
        self._skip_tag = None
        self._profile_name = profile_name
        self._in_profile_text = False

    # -- helpers -------------------------------------------------------------

    def _attr_str(self, attrs):
        parts = []
        for name, val in attrs:
            if val is None:
                parts.append(name)
                continue
            if name.startswith('data-') and _looks_like_token(val):
                continue   # strip token-shaped data attributes
            parts.append(f'{name}="{val}"')
        return (' ' + ' '.join(parts)) if parts else ''

    # -- HTMLParser overrides ------------------------------------------------

    def handle_starttag(self, tag, attrs):
        if self._skip_depth > 0:
            self._skip_depth += 1
            return

        attr_dict = dict(attrs)

        # Skip <script> and <link rel=stylesheet> wholesale
        if tag == 'script':
            self._skip_tag = 'script'
            self._skip_depth = 1
            return
        if tag == 'link' and attr_dict.get('rel', '').lower() in ('stylesheet', 'preload', 'prefetch'):
            # void element — just drop it
            return

        # Strip avatar src: the profile <img> sits inside the account menu
        # and has a nflximg.net or nflxso.net URL in its src.
        if tag == 'img':
            clean = []
            for name, val in attrs:
                if name == 'src' and val and ('nflximg' in val or 'nflxso' in val) and attr_dict.get('class', '').startswith('profile'):
                    clean.append((name, ''))
                elif name.startswith('data-') and val and _looks_like_token(val):
                    continue
                else:
                    clean.append((name, val))
            attrs = clean

        self._out.append(f'<{tag}{self._attr_str(attrs)}>')

    def handle_endtag(self, tag):
        if self._skip_depth > 0:
            self._skip_depth -= 1
            if self._skip_depth == 0:
                self._skip_tag = None
            return
        self._out.append(f'</{tag}>')

    def handle_startendtag(self, tag, attrs):
        if self._skip_depth > 0:
            return
        if tag == 'link' and dict(attrs).get('rel', '').lower() in ('stylesheet', 'preload', 'prefetch'):
            return
        self._out.append(f'<{tag}{self._attr_str(attrs)} />')

    def handle_data(self, data):
        if self._skip_depth > 0:
            return
        # Replace profile display name
        if self._profile_name and self._profile_name in data:
            data = data.replace(self._profile_name, 'Test User')
        self._out.append(data)

    def handle_comment(self, data):
        if self._skip_depth > 0:
            return

    def handle_entityref(self, name):
        if self._skip_depth > 0:
            return
        self._out.append(f'&{name};')

    def handle_charref(self, name):
        if self._skip_depth > 0:
            return
        self._out.append(f'&#{name};')

    def result(self):
        return ''.join(self._out)


def anonymise(html: str, profile_name: str = '') -> str:
    p = _Anonymiser(profile_name)
    p.feed(html)
    return p.result()


def remove_row_by_heading(html: str, heading: str) -> str:
    """Remove the Netflix lolomo row whose visible heading contains `heading`."""
    # Rows are large nested divs; use a simple state-machine approach on the
    # raw HTML rather than a full DOM parse, since we only need to drop one row.
    pattern = re.compile(
        r'(<div[^>]*class="[^"]*lolomoRow[^"]*"[^>]*>)',
        re.IGNORECASE
    )
    result = []
    i = 0
    while i < len(html):
        m = pattern.search(html, i)
        if not m:
            result.append(html[i:])
            break
        result.append(html[i:m.start()])
        # scan forward to find end of this row
        depth = 1
        j = m.end()
        while j < len(html) and depth > 0:
            open_tag = html.find('<div', j)
            close_tag = html.find('</div>', j)
            if open_tag != -1 and (close_tag == -1 or open_tag < close_tag):
                depth += 1
                j = open_tag + 4
            elif close_tag != -1:
                depth -= 1
                j = close_tag + 6
            else:
                j = len(html)
                break
        row_html = html[m.start():j]
        # Only include the row if its heading does NOT match
        if heading.lower() not in row_html.lower():
            result.append(row_html)
        i = j
    return ''.join(result)


# ---------------------------------------------------------------------------
# Capture helpers
# ---------------------------------------------------------------------------

def capture_outer_html(s, selector):
    return ev(s, f"""(() => {{
        const el = document.querySelector({json.dumps(selector)});
        return el ? el.outerHTML : null;
    }})()""")

def capture_row_html(s, selector):
    """Capture outerHTML of all matching elements joined."""
    return ev(s, f"""(() => {{
        const els = [...document.querySelectorAll({json.dumps(selector)})];
        return els.map(e => e.outerHTML).join('\\n');
    }})()""")

def get_profile_name(s):
    return ev(s, """(() => {
        const el = document.querySelector(
            '.account-menu-item .profile-name, [data-uia="profile-name"], .profileName'
        );
        return el ? el.textContent.trim() : '';
    })()""") or ''

def hover_card(s, index=2):
    pos = ev(s, f"""(() => {{
        const cards = [...document.querySelectorAll('.title-card')];
        const card = cards[{index}];
        if (!card) return null;
        const r = card.getBoundingClientRect();
        return {{x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)}};
    }})()""")
    if not pos:
        raise RuntimeError('No title-card found to hover')
    call(s, 'Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'], 'y': pos['y']})
    time.sleep(2.5)

def click_more_info(s):
    pos = ev(s, """(() => {
        const btns = [...document.querySelectorAll('.previewModal--wrapper.mini-modal button')];
        const last = btns[btns.length - 1];
        if (!last) return null;
        const r = last.getBoundingClientRect();
        return {x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)};
    })()""")
    if not pos:
        raise RuntimeError('More Info button not found — hover a card first')
    call(s, 'Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'], 'y': pos['y']})
    time.sleep(0.2)
    call(s, 'Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
    call(s, 'Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': pos['x'], 'y': pos['y'], 'button': 'left', 'clickCount': 1})
    time.sleep(2.5)

def close_modal(s):
    call(s, 'Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape'})
    time.sleep(1)

def wrap(html):
    return f'<html><body>{html}</body></html>'

def save(path_str, html):
    p = Path(path_str)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(html, encoding='utf-8')
    print(f'  wrote {p} ({len(html):,} chars)')

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent  # repo root

def main():
    ws_path = _find_netflix_ws()
    print(f'Connecting to {ws_path}')
    s = _connect(ws_path)

    # ---- 1. Browse page (title-card surface + full-page fixture) -----------
    print('\n[1/4] Browse page — title-card surface')
    navigate(s, 'https://www.netflix.com/browse')
    profile_name = get_profile_name(s)
    print(f'  Profile name detected: {repr(profile_name)}')

    # Minimal surface extract: first two populated rows of title cards
    row_html = ev(s, """(() => {
        const rows = [...document.querySelectorAll('[class*="lolomoRow"]')].filter(
            row => row.querySelector('.title-card .fallback-text')
        ).slice(0, 2);
        return rows.map(r => r.outerHTML).join('\\n');
    })()""") or ''
    row_html = remove_row_by_heading(row_html, 'My List')
    row_html = remove_row_by_heading(row_html, 'Continue Watching')
    save(ROOT / 'tests/fixtures/surfaces/title-card.html',
         wrap(anonymise(row_html, profile_name)))

    # Full-page fixture: entire body content minus My List / Continue Watching
    body_html = ev(s, 'document.body.outerHTML') or ''
    body_html = remove_row_by_heading(body_html, 'My List')
    body_html = remove_row_by_heading(body_html, 'Continue Watching')
    save(ROOT / 'tests/fixtures/netflix-browse.html',
         anonymise(body_html, profile_name))

    # ---- 2. Search page (standard-card surface) ----------------------------
    print('\n[2/4] Search page — standard-card surface')
    navigate(s, 'https://www.netflix.com/search?q=breaking+bad')

    grid_html = ev(s, """(() => {
        const cards = [...document.querySelectorAll('[data-uia="standard-card"]')].slice(0, 6);
        const parent = cards[0]?.parentElement;
        return parent ? parent.outerHTML : cards.map(c => c.outerHTML).join('\\n');
    })()""") or ''
    save(ROOT / 'tests/fixtures/surfaces/standard-card.html',
         wrap(anonymise(grid_html, profile_name)))

    body_html = ev(s, 'document.body.outerHTML') or ''
    save(ROOT / 'tests/fixtures/netflix-search.html',
         anonymise(body_html, profile_name))

    # ---- 3. Hover mini-modal -----------------------------------------------
    print('\n[3/4] Hover mini-modal — previewModal-mini surface')
    navigate(s, 'https://www.netflix.com/browse')
    time.sleep(1)
    hover_card(s, index=2)

    mini_html = capture_outer_html(s, '.previewModal--wrapper.mini-modal') or ''
    save(ROOT / 'tests/fixtures/surfaces/preview-mini.html',
         wrap(anonymise(mini_html, profile_name)))
    save(ROOT / 'tests/fixtures/netflix-hover.html',
         anonymise(mini_html, profile_name))

    # ---- 4. Full detail modal ----------------------------------------------
    print('\n[4/4] Full detail modal — previewModal-detail surface')
    click_more_info(s)

    detail_html = capture_outer_html(s, '.previewModal--wrapper.detail-modal') or ''
    save(ROOT / 'tests/fixtures/surfaces/preview-detail.html',
         wrap(anonymise(detail_html, profile_name)))
    save(ROOT / 'tests/fixtures/netflix-modal.html',
         anonymise(detail_html, profile_name))

    close_modal(s)
    s.close()
    print('\nDone.')

if __name__ == '__main__':
    main()
```

- [x] **Step 2: Ensure the `tests/fixtures/surfaces/` directory exists**

The script creates it via `Path.mkdir(parents=True, exist_ok=True)` — no manual action needed.

- [x] **Step 3: Run the capture script**

Make sure Chromium is running with `--remote-debugging-port=9222` and Netflix `/browse` is open and logged in, then:

```bash
python3 scripts/capture-surface-fixtures.py
```

Expected output (paths and sizes will vary):

```
Connecting to /devtools/page/...
  Profile name detected: 'Blaženka'

[1/4] Browse page — title-card surface
  wrote tests/fixtures/surfaces/title-card.html (12,345 chars)
  wrote tests/fixtures/netflix-browse.html (98,765 chars)

[2/4] Search page — standard-card surface
  wrote tests/fixtures/surfaces/standard-card.html (8,765 chars)
  wrote tests/fixtures/netflix-search.html (145,678 chars)

[3/4] Hover mini-modal — previewModal-mini surface
  wrote tests/fixtures/surfaces/preview-mini.html (9,012 chars)
  wrote tests/fixtures/netflix-hover.html (9,012 chars)

[4/4] Full detail modal — previewModal-detail surface
  wrote tests/fixtures/surfaces/preview-detail.html (18,234 chars)
  wrote tests/fixtures/netflix-modal.html (18,234 chars)

Done.
```

If any fixture is empty, check that the browser was on the right page/state before running.

- [x] **Step 4: Verify fixtures contain expected selectors**

```bash
grep -c "title-card" tests/fixtures/surfaces/title-card.html
grep -c 'data-uia="standard-card"' tests/fixtures/surfaces/standard-card.html
grep -c "mini-modal" tests/fixtures/surfaces/preview-mini.html
grep -c "detail-modal" tests/fixtures/surfaces/preview-detail.html
```

Each command should print a number greater than 0. If any prints 0, the capture for that surface failed — re-run after verifying the browser state.

- [x] **Step 5: Verify anonymisation — no profile name in any fixture**

Replace `Blaženka` with whatever the script reported as the detected profile name:

```bash
grep -r "Blaženka" tests/fixtures/ && echo "FAIL: profile name found" || echo "OK: profile name absent"
```

Expected: `OK: profile name absent`

- [x] **Step 6: Verify anonymisation — no cookie or token patterns**

```bash
grep -rE "document\.cookie|authURL|Bearer [A-Za-z0-9]" tests/fixtures/ && echo "FAIL" || echo "OK"
```

Expected: `OK`

- [x] **Step 7: Run the full test suite — existing tests must still pass**

```bash
npm test
```

Expected: all tests pass. The existing `browse.ui.test.js` and `search.ui.test.js` use the refreshed fixtures — they should still find the selectors they rely on.

- [x] **Step 8: Commit**

```bash
git add scripts/capture-surface-fixtures.py tests/fixtures/
git commit -m "test(fixtures): capture and anonymise Netflix surface fixtures from Chromium"
```

---

## Task 4: Add UI tests for the previewModal surfaces

**Files:**

- Create: `tests/ui/preview-mini.ui.test.js`
- Create: `tests/ui/preview-detail.ui.test.js`
- Test: both files are the test

**Interfaces:**

- Consumes: `tests/fixtures/surfaces/preview-mini.html` and `preview-detail.html` (Task 3), `SurfaceManager` from `src/core/surfaces.js` (Task 2)
- Produces: two passing UI test files covering the two previewModal surfaces

- [x] **Step 1: Create `tests/ui/preview-mini.ui.test.js`**

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import fs from 'fs';
import path from 'path';

describe('Preview Mini-Modal UI Surface', () => {
    let surfaceManager, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/surfaces/preview-mini.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
    });

    it('discovers exactly one surface from the mini-modal fixture', () => {
        const results = surfaceManager.discover(document.body);
        expect(results.length).toBeGreaterThanOrEqual(1);
        // Mini-modal has a single player container
        const miniResults = results.filter(r => r.container.classList.contains('previewModal--player_container'));
        expect(miniResults.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts a non-empty title from the boxart alt attribute', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.title).toBeTruthy();
            expect(typeof r.title).toBe('string');
        });
    });

    it('sets fadeable to false for the mini-modal surface', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.fadeable).toBe(false);
        });
    });

    it('does not discover a detail-modal surface from the mini-modal fixture', () => {
        const results = surfaceManager.discover(document.body);
        const wrappers = [...document.querySelectorAll('.previewModal--wrapper')];
        const hasDetailModal = wrappers.some(w => w.classList.contains('detail-modal'));
        expect(hasDetailModal).toBe(false);
        // All discovered surfaces come from the mini-modal wrapper, not a detail-modal one
        expect(results.length).toBeGreaterThanOrEqual(1);
    });
});
```

- [x] **Step 2: Create `tests/ui/preview-detail.ui.test.js`**

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import fs from 'fs';
import path from 'path';

describe('Preview Detail-Modal UI Surface', () => {
    let surfaceManager, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/surfaces/preview-detail.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
    });

    it('discovers exactly one surface from the detail-modal fixture', () => {
        const results = surfaceManager.discover(document.body);
        expect(results.length).toBeGreaterThanOrEqual(1);
        const detailResults = results.filter(r => r.container.classList.contains('previewModal--player_container'));
        expect(detailResults.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts a non-empty title from the boxart alt attribute', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.title).toBeTruthy();
            expect(typeof r.title).toBe('string');
        });
    });

    it('sets fadeable to false for the detail-modal surface', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.fadeable).toBe(false);
        });
    });

    it('does not discover a mini-modal surface from the detail-modal fixture', () => {
        const wrappers = [...document.querySelectorAll('.previewModal--wrapper')];
        const hasMiniModal = wrappers.some(w => w.classList.contains('mini-modal'));
        expect(hasMiniModal).toBe(false);
    });
});
```

- [x] **Step 3: Run the UI tests**

```bash
npm run test:ui
```

Expected: all UI tests pass, including the two new ones.

- [x] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add tests/ui/preview-mini.ui.test.js tests/ui/preview-detail.ui.test.js
git commit -m "test(ui): add preview-mini and preview-detail surface UI tests"
```

---

## Self-Review

**Spec coverage:**

| Spec section                                                                 | Covered by                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Remove BOB surface                                                           | Task 2 (`#SURFACES` rewrite)                     |
| Remove jawBone surface                                                       | Task 2 (`#SURFACES` rewrite)                     |
| Split previewModal into mini + detail                                        | Task 2 (`#SURFACES` rewrite)                     |
| Add comments to each surface                                                 | Task 2 (comments in `#SURFACES`)                 |
| Capture surface DOM extracts from Chromium                                   | Task 3 (capture script)                          |
| Anonymise: profile name, avatar, cookies, tokens, My List, Continue Watching | Task 3 (`_Anonymiser` + `remove_row_by_heading`) |
| Keep real show data                                                          | Task 3 (no title/image replacement)              |
| Refresh `netflix-browse.html` and `netflix-search.html`                      | Task 3 (capture script outputs)                  |
| Refresh `netflix-hover.html` and `netflix-modal.html`                        | Task 3 (capture script outputs)                  |
| New UI tests for previewModal surfaces                                       | Task 4                                           |
| Unit test: remove BOB, jawBone, stale selectors                              | Task 1                                           |
| Unit test: add mini-modal + detail-modal cases                               | Task 1                                           |
| Unit test: retain edge-case tests                                            | Task 1 (all retained)                            |
| Fixture-based tests in `tests/ui/`, not unit test                            | Tasks 3 + 4 ✓                                    |

**No gaps found.**

**Placeholder scan:** No TBDs, no "similar to above", no missing code blocks.

**Type consistency:** `SurfaceManager(logger?)` — unit tests pass `createMockLogger()`, UI tests omit logger (matches existing pattern). `discover(root)` returns `{ container: HTMLElement, title: string, fadeable: boolean }[]` — all assertions reference these properties by name consistently across tasks.
