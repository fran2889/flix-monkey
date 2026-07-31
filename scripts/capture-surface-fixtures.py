#!/usr/bin/env python3
"""Capture anonymized Netflix surface fixtures from Chromium on port 9222."""

import base64
import json
import os
import re
import socket
import struct
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


# ---------------------------------------------------------------------------
# CDP transport
# ---------------------------------------------------------------------------

def _find_netflix_ws():
    data = urllib.request.urlopen('http://localhost:9222/json/list').read()
    for page in json.loads(data):
        parsed = urllib.parse.urlparse(page.get('url', ''))
        host = parsed.hostname
        if page.get('type') == 'page' and host and (
            host == 'netflix.com' or host.endswith('.netflix.com')
        ):
            return page['webSocketDebuggerUrl'].replace('ws://localhost:9222', '')
    raise RuntimeError('No Netflix page found on port 9222')


def _connect(ws_path):
    key = base64.b64encode(os.urandom(16)).decode()
    connection = socket.create_connection(('localhost', 9222))
    connection.settimeout(15)
    request = (
        f'GET {ws_path} HTTP/1.1\r\nHost: localhost:9222\r\n'
        'Upgrade: websocket\r\nConnection: Upgrade\r\n'
        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
    )
    connection.sendall(request.encode())
    response = b''
    while b'\r\n\r\n' not in response:
        response += connection.recv(4096)
    return connection


def _send(connection, message):
    data = message.encode()
    mask = os.urandom(4)
    length = len(data)
    if length <= 125:
        header = bytes([0x81, 0x80 | length]) + mask
    elif length <= 65535:
        header = bytes([0x81, 0xFE]) + struct.pack('>H', length) + mask
    else:
        header = bytes([0x81, 0xFF]) + struct.pack('>Q', length) + mask
    payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(data))
    connection.sendall(header + payload)


def _recv(connection):
    def read(length):
        data = b''
        while len(data) < length:
            data += connection.recv(length - len(data))
        return data

    header = read(2)
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack('>H', read(2))[0]
    elif length == 127:
        length = struct.unpack('>Q', read(8))[0]
    return read(length).decode('utf-8', 'replace')


_message_id = 0


def call(connection, method, params=None):
    global _message_id
    _message_id += 1
    current_id = _message_id
    _send(connection, json.dumps({
        'id': current_id,
        'method': method,
        'params': params or {},
    }))
    while True:
        try:
            message = json.loads(_recv(connection))
        except Exception:
            continue
        if message.get('id') == current_id:
            return message.get('result', {})


def evaluate(connection, expression):
    result = call(connection, 'Runtime.evaluate', {
        'expression': expression,
        'returnByValue': True,
    }).get('result', {})
    if result.get('subtype') == 'error':
        raise RuntimeError(result.get('description', 'Evaluation failed'))
    return result.get('value')


def navigate(connection, url):
    call(connection, 'Page.navigate', {'url': url})
    time.sleep(3)


# ---------------------------------------------------------------------------
# Fixture sanitization
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r'^[A-Za-z0-9+/=_\-]{40,}$')
_SENSITIVE_ATTRIBUTES = frozenset({
    'data-list-id',
    'data-lolomo-id',
    'data-request-id',
    'data-tracking-uuid',
    'data-ui-tracking-context',
})
_TRACKING_QUERY_PARAMETERS = frozenset({
    'g',
    'lkid',
    'lnktrk',
    'tctx',
    'trackid',
    'trkid',
})
_PROGRESS_MEDIA_ATTRIBUTES = frozenset({
    'data-entity-id',
    'data-image-key',
    'data-playable-id',
    'data-supp-video-id',
    'data-unified-entity-id',
    'data-video-id',
    'id',
})
_VOID_TAGS = frozenset({
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr',
})


def _strip_tracking_query(value):
    try:
        parsed = urllib.parse.urlsplit(value)
        params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    except ValueError:
        return value
    filtered = [
        (name, item)
        for name, item in params
        if name.lower() not in _TRACKING_QUERY_PARAMETERS
    ]
    return urllib.parse.urlunsplit((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        urllib.parse.urlencode(filtered),
        parsed.fragment,
    ))


class _Sanitizer(HTMLParser):
    """Strip tracking data and replace progress-card viewing history."""

    def __init__(self):
        super().__init__()
        self.output = []
        self.skip_depth = 0
        self.progress_depth = 0
        self.progress_index = 0
        self.progress_title = ''
        self.progress_id = ''

    def _attributes(self, attrs):
        result = []
        asset = (
            f'https://example.invalid/netflix/progress-card-'
            f'{self.progress_index:02d}.jpg'
        )
        for name, value in attrs:
            if value is None:
                result.append((name, value))
                continue
            normalized_name = name.lower().replace('_', '-')
            if normalized_name in _SENSITIVE_ATTRIBUTES or _TOKEN_RE.match(value):
                continue
            if name in ('href', 'action'):
                value = _strip_tracking_query(value)
            if self.progress_depth:
                if name == 'href':
                    value = f'/browse?jbv={self.progress_id}'
                elif name in ('src', 'poster', 'srcset'):
                    value = asset
                elif name in _PROGRESS_MEDIA_ATTRIBUTES:
                    value = f'synthetic-progress-{self.progress_id}'
                elif name in ('alt', 'aria-label', 'title') and value:
                    value = self.progress_title
                elif name == 'style' and 'url(' in value.lower():
                    value = re.sub(r'url\([^)]*\)', f'url({asset})', value)
            result.append((name, value))
        return result

    @staticmethod
    def _format_attributes(attrs):
        parts = [
            name if value is None else f'{name}="{value}"'
            for name, value in attrs
        ]
        return (' ' + ' '.join(parts)) if parts else ''

    def handle_starttag(self, tag, attrs):
        if self.skip_depth:
            if tag not in _VOID_TAGS:
                self.skip_depth += 1
            return
        attr_dict = dict(attrs)
        if tag == 'script':
            self.skip_depth = 1
            return
        if tag == 'link' and attr_dict.get('rel', '').lower() in (
            'stylesheet', 'preload', 'prefetch'
        ):
            return
        if attr_dict.get('data-uia') == 'progress-card':
            self.progress_index += 1
            self.progress_depth = 1
            self.progress_title = f'Synthetic Progress Title {self.progress_index:02d}'
            self.progress_id = f'{99000000 + self.progress_index}'
        elif self.progress_depth and tag not in _VOID_TAGS:
            self.progress_depth += 1
        attrs = self._attributes(attrs)
        self.output.append(f'<{tag}{self._format_attributes(attrs)}>')

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if self.progress_depth:
            self.progress_depth -= 1
            if not self.progress_depth:
                self.progress_title = ''
                self.progress_id = ''
        self.output.append(f'</{tag}>')

    def handle_startendtag(self, tag, attrs):
        if not self.skip_depth:
            attrs = self._attributes(attrs)
            self.output.append(f'<{tag}{self._format_attributes(attrs)} />')

    def handle_data(self, data):
        if not self.skip_depth:
            self.output.append(self.progress_title if self.progress_depth and data.strip() else data)

    def handle_entityref(self, name):
        if not self.skip_depth:
            self.output.append(f'&{name};')

    def handle_charref(self, name):
        if not self.skip_depth:
            self.output.append(f'&#{name};')


def sanitize(html):
    sanitizer = _Sanitizer()
    sanitizer.feed(html)
    return ''.join(sanitizer.output)


_FORBIDDEN_FIXTURE_PATTERNS = (
    'data-tracking-uuid',
    'data-ui-tracking-context',
    'data-request-id',
    'data-list-id',
    '/notification/',
)


def validate_fixture(path):
    content = Path(path).read_text(encoding='utf-8')
    for pattern in _FORBIDDEN_FIXTURE_PATTERNS:
        if pattern.lower() in content.lower():
            raise RuntimeError(f'{path}: retained private metadata {pattern}')
    for card in re.findall(
        r'<a[^>]*data-uia="progress-card"[^>]*>.*?</a>',
        content,
        re.DOTALL,
    ):
        if not re.search(r'aria-label="Synthetic Progress Title \d{2}"', card):
            raise RuntimeError(f'{path}: progress-card title is not synthetic')
        if 'occ-' in card or 'nflxso.net' in card:
            raise RuntimeError(f'{path}: progress-card media is not synthetic')


# ---------------------------------------------------------------------------
# Capture helpers
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent
SURFACE_DIR = ROOT / 'tests/fixtures/surfaces'
FIXTURE_PATHS = (
    SURFACE_DIR / 'title-card.html',
    SURFACE_DIR / 'progress-card.html',
    SURFACE_DIR / 'ranked-card.html',
    SURFACE_DIR / 'standard-card.html',
    SURFACE_DIR / 'preview-mini.html',
    SURFACE_DIR / 'preview-detail.html',
)


def capture_all(connection, selector, limit=0):
    return evaluate(connection, f"""(() => {{
        let elements = [...document.querySelectorAll({json.dumps(selector)})];
        if ({limit}) elements = elements.slice(0, {limit});
        return elements.map(element => element.outerHTML).join('\\n');
    }})()""") or ''


def capture_one(connection, selector):
    return evaluate(connection, f"""(() => {{
        const element = document.querySelector({json.dumps(selector)});
        return element ? element.outerHTML : '';
    }})()""") or ''


def require_capture(name, html):
    if not html.strip():
        raise RuntimeError(f'Could not capture required Netflix surface: {name}')
    return html


def save(path, html):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = f'<html><body>{sanitize(html)}</body></html>'
    path.write_text(content, encoding='utf-8')
    print(f'  wrote {path} ({len(content):,} chars)')


def preserve(path, name):
    existing = require_capture(name, path.read_text(encoding='utf-8'))
    path.write_text(sanitize(existing), encoding='utf-8')
    print(f'  {name} absent; preserving {path}')


def materialize_browse_rows(connection):
    evaluate(connection, 'window.scrollTo(0, document.body.scrollHeight)')
    time.sleep(5)
    evaluate(connection, 'window.scrollTo(0, 0)')
    time.sleep(1)


def hover_card(connection):
    position = evaluate(connection, """(() => {
        const cards = [...document.querySelectorAll(
            '.title-card, [data-uia="standard-card"]'
        )];
        const card = cards.find(element => {
            const rect = element.getBoundingClientRect();
            return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight;
        });
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    })()""")
    if not position:
        return False
    call(connection, 'Input.dispatchMouseEvent', {
        'type': 'mouseMoved',
        'x': position['x'],
        'y': position['y'],
    })
    time.sleep(2.5)
    return True


def open_detail(connection):
    position = evaluate(connection, """(() => {
        const button = document.querySelector(
            '.previewModal--wrapper.mini-modal [data-uia="expand-to-detail-button"]'
        );
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    })()""")
    if not position:
        return False
    for event_type in ('mousePressed', 'mouseReleased'):
        call(connection, 'Input.dispatchMouseEvent', {
            'type': event_type,
            'x': position['x'],
            'y': position['y'],
            'button': 'left',
            'clickCount': 1,
        })
    time.sleep(2.5)
    return True


def main():
    connection = _connect(_find_netflix_ws())
    try:
        print('[1/4] Browse cards')
        navigate(connection, 'https://www.netflix.com/browse')
        materialize_browse_rows(connection)
        browse_surfaces = {
            'title-card': '.title-card a[aria-label]',
            'progress-card': '[data-uia="progress-card"][aria-label]',
            'ranked-card': '[data-uia="ranked-card"][aria-label]',
        }
        for name, selector in browse_surfaces.items():
            html = capture_all(connection, selector)
            path = SURFACE_DIR / f'{name}.html'
            if not html.strip():
                preserve(path, name)
            else:
                save(path, require_capture(name, html))

        print('[2/4] Search cards')
        navigate(connection, 'https://www.netflix.com/search?q=breaking+bad')
        save(
            SURFACE_DIR / 'standard-card.html',
            require_capture(
                'standard card',
                capture_all(
                    connection,
                    '[data-uia="standard-card"][aria-label]',
                    limit=6,
                ),
            ),
        )

        print('[3/4] Mini preview')
        navigate(connection, 'https://www.netflix.com/browse')
        time.sleep(1)
        mini_html = ''
        if hover_card(connection):
            mini_html = capture_one(connection, '.previewModal--wrapper.mini-modal')
        if mini_html.strip():
            save(SURFACE_DIR / 'preview-mini.html', mini_html)
        else:
            preserve(SURFACE_DIR / 'preview-mini.html', 'mini preview')

        print('[4/4] Detail preview')
        detail_html = ''
        if mini_html.strip() and open_detail(connection):
            detail_html = capture_one(connection, '.previewModal--wrapper.detail-modal')
        if detail_html.strip():
            save(SURFACE_DIR / 'preview-detail.html', detail_html)
        else:
            preserve(SURFACE_DIR / 'preview-detail.html', 'detail preview')

        for path in FIXTURE_PATHS:
            require_capture(path.name, path.read_text(encoding='utf-8'))
            validate_fixture(path)
        print(f'privacy validation passed for {len(FIXTURE_PATHS)} fixtures')
        print('Done.')
    finally:
        connection.close()


if __name__ == '__main__':
    main()
