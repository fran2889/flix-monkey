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
