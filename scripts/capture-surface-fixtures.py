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
    tests/fixtures/surfaces/progress-card.html
    tests/fixtures/surfaces/ranked-card.html
    tests/fixtures/surfaces/standard-card.html
    tests/fixtures/surfaces/preview-mini.html
    tests/fixtures/surfaces/preview-detail.html
    tests/fixtures/netflix-browse.html
    tests/fixtures/netflix-search.html
    tests/fixtures/netflix-hover.html
    tests/fixtures/netflix-modal.html
"""
import html as html_lib
import json, os, re, socket, struct, time, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------------------
# CDP transport (no external dependencies)
# ---------------------------------------------------------------------------

def _find_netflix_ws():
    data = urllib.request.urlopen('http://localhost:9222/json/list').read()
    pages = json.loads(data)
    for p in pages:
        url = p.get('url', '')
        if p.get('type') == 'page':
            parsed = urllib.parse.urlparse(url)
            host = parsed.hostname
            if host and (host == 'netflix.com' or host.endswith('.netflix.com')):
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
_JWT_SHAPED_RE = re.compile(r'eyJ[A-Za-z0-9_-]*\.')
_TRACKING_METADATA_RE = re.compile(
    r'(?:request|list|lolomo)(?:_|-|%5f|%2d)?id',
    re.IGNORECASE,
)
_SYNTHETIC_PROGRESS_TITLE_RE = re.compile(r'^Synthetic Progress Title (\d{2})$')
_SENSITIVE_ATTRIBUTE_NAMES = frozenset({
    'data-list-id',
    'data-lolomo-id',
    'data-request-id',
    'data-tracking-uuid',
    'data-ui-tracking-context',
    'list-id',
    'request-id',
})
_TRACKING_QUERY_PARAMETERS = frozenset({
    'g',
    'lkid',
    'lnktrk',
    'tctx',
    'trackid',
    'trkid',
})
_PROGRESS_MEDIA_ATTRIBUTE_NAMES = frozenset({
    'data-entity-id',
    'data-image-key',
    'data-playable-id',
    'data-supp-video-id',
    'data-unified-entity-id',
    'data-video-id',
    'id',
})
_VOID_TAGS = frozenset({
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr',
})

def _looks_like_token(val):
    """Heuristic: long opaque string or JWT."""
    val = val.strip()
    if val.startswith('eyJ') or _JWT_SHAPED_RE.search(val):
        return True
    return bool(_TOKEN_RE.match(val)) and len(val) >= 40


def _is_sensitive_attribute(name, value):
    """Return whether an attribute directly carries tracking identifiers."""
    normalised_name = name.lower().replace('_', '-')
    return (
        normalised_name in _SENSITIVE_ATTRIBUTE_NAMES
        or 'tracking-context' in normalised_name
        or bool(value and _TRACKING_METADATA_RE.search(value))
    )


def _strip_tracking_query_parameters(value):
    """Remove Netflix tracking parameters while retaining functional URLs."""
    try:
        parsed = urllib.parse.urlsplit(value)
        parameters = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    except ValueError:
        return value
    filtered = [
        (name, parameter_value)
        for name, parameter_value in parameters
        if name.lower() not in _TRACKING_QUERY_PARAMETERS
    ]
    if len(filtered) == len(parameters):
        return value
    return urllib.parse.urlunsplit((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        urllib.parse.urlencode(filtered),
        parsed.fragment,
    ))


class _Anonymiser(HTMLParser):
    """
    Streaming HTML anonymiser.  Applies anonymisation rules in one pass:
      - Removes <script> elements entirely
      - Removes <link rel="stylesheet"> elements
      - Strips avatar img src (profile picture, identified by context)
      - Replaces profile display name text with 'Test User'
      - Strips attributes whose values look like auth tokens
    Output is reconstructed HTML.
    """

    def __init__(self, profile_name: str = ''):
        super().__init__()
        self._out = []
        self._text_output_indices = []
        self._skip_depth = 0   # >0 while inside a skipped element
        self._skip_tag = None
        self._profile_name = profile_name
        self._progress_depth = 0
        self._progress_original_title = ''
        self._progress_synthetic_id = ''
        self._progress_synthetic_title = ''
        self._progress_titles = {}

    # -- helpers -------------------------------------------------------------

    def _attr_str(self, attrs):
        parts = []
        for name, val in attrs:
            if val is None:
                parts.append(name)
                continue
            if _looks_like_token(val) or _is_sensitive_attribute(name, val):
                continue
            if name in ('href', 'action'):
                val = _strip_tracking_query_parameters(val)
            parts.append(f'{name}="{val}"')
        return (' ' + ' '.join(parts)) if parts else ''

    @staticmethod
    def _is_profile_menu(attrs):
        """Return whether attrs identify Netflix's account-profile UI."""
        return any(
            name == 'data-uia' and val and val.startswith('navigation+profile-menu')
            for name, val in attrs
        )

    @staticmethod
    def _is_personalised_subtree(attrs):
        """Return whether attrs identify privacy-sensitive page chrome."""
        attr_dict = dict(attrs)
        data_uia = (attr_dict.get('data-uia') or '').lower()
        element_id = (attr_dict.get('id') or '').lower()
        classes = set((attr_dict.get('class') or '').lower().split())
        return (
            data_uia.startswith('navigation+profile-menu')
            or data_uia.startswith('navigation+notifications')
            or data_uia.startswith('notification-manager')
            or data_uia.startswith('notification-asset')
            or data_uia.startswith('notification-text')
            or data_uia in {
                'account-dropdown-button',
                'adtech-iframe',
                'notification-badge',
                'notification-bell',
                'notifications-menu-button',
            }
            or element_id.startswith('onetrust-')
            or 'account-menu-item' in classes
        )

    def _begin_progress_card(self, attrs):
        attr_dict = dict(attrs)
        original_title = (attr_dict.get('aria-label') or '').strip()
        if original_title not in self._progress_titles:
            index = len(self._progress_titles) + 1
            self._progress_titles[original_title] = (
                f'Synthetic Progress Title {index:02d}',
                f'{99000000 + index}',
            )
        synthetic_title, synthetic_id = self._progress_titles[original_title]
        self._progress_depth = 1
        self._progress_original_title = original_title
        self._progress_synthetic_id = synthetic_id
        self._progress_synthetic_title = synthetic_title

    def _syntheticise_progress_attrs(self, attrs):
        synthetic_asset = (
            'https://example.invalid/netflix/'
            f'progress-card-{int(self._progress_synthetic_id) - 99000000:02d}.jpg'
        )
        synthetic_attrs = []
        for name, value in attrs:
            if value is None:
                synthetic_attrs.append((name, value))
                continue
            if name == 'href':
                value = f'/browse?jbv={self._progress_synthetic_id}'
            elif name in ('src', 'poster', 'srcset'):
                value = synthetic_asset
            elif name in _PROGRESS_MEDIA_ATTRIBUTE_NAMES:
                value = f'synthetic-progress-{self._progress_synthetic_id}'
            elif name == 'style' and 'url(' in value.lower():
                value = re.sub(r'url\([^)]*\)', f'url({synthetic_asset})', value)
            elif name in ('alt', 'aria-label', 'title') and value:
                value = self._progress_synthetic_title
            elif self._progress_original_title:
                value = value.replace(
                    self._progress_original_title,
                    self._progress_synthetic_title,
                )
            synthetic_attrs.append((name, value))
        return synthetic_attrs

    # -- HTMLParser overrides ------------------------------------------------

    def handle_starttag(self, tag, attrs):
        if self._skip_depth > 0:
            if tag not in _VOID_TAGS:
                self._skip_depth += 1
            return

        attr_dict = dict(attrs)

        # The active profile is exposed in the trigger image alt text, and the
        # menu can contain every secondary profile name.  Neither is needed by
        # card-surface tests, so remove this privacy-sensitive UI wholesale.
        if self._is_profile_menu(attrs) or self._is_personalised_subtree(attrs):
            if tag not in _VOID_TAGS:
                self._skip_tag = tag
                self._skip_depth = 1
            return

        # Skip <script> and <link rel=stylesheet> wholesale
        if tag == 'script':
            self._skip_tag = 'script'
            self._skip_depth = 1
            return
        if tag == 'link' and attr_dict.get('rel', '').lower() in ('stylesheet', 'preload', 'prefetch'):
            # void element — just drop it
            return

        if attr_dict.get('data-uia') == 'progress-card':
            self._begin_progress_card(attrs)
        elif self._progress_depth > 0 and tag not in _VOID_TAGS:
            self._progress_depth += 1

        if self._progress_depth > 0:
            attrs = self._syntheticise_progress_attrs(attrs)
            attr_dict = dict(attrs)

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
        if self._progress_depth > 0:
            self._progress_depth -= 1
            if self._progress_depth == 0:
                self._progress_original_title = ''
                self._progress_synthetic_id = ''
                self._progress_synthetic_title = ''
        self._out.append(f'</{tag}>')

    def handle_startendtag(self, tag, attrs):
        if self._skip_depth > 0:
            return
        if self._is_profile_menu(attrs) or self._is_personalised_subtree(attrs):
            return
        if tag == 'link' and dict(attrs).get('rel', '').lower() in ('stylesheet', 'preload', 'prefetch'):
            return
        if self._progress_depth > 0:
            attrs = self._syntheticise_progress_attrs(attrs)
        self._out.append(f'<{tag}{self._attr_str(attrs)} />')

    def handle_data(self, data):
        if self._skip_depth > 0:
            return
        # Replace profile display name
        if self._profile_name and self._profile_name in data:
            data = data.replace(self._profile_name, 'Test User')
        if self._progress_depth > 0 and self._progress_original_title:
            data = data.replace(
                self._progress_original_title,
                self._progress_synthetic_title,
            )
        self._text_output_indices.append(len(self._out))
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
        self._redact_profile_across_text_nodes()
        return ''.join(self._out)

    def _redact_profile_across_text_nodes(self):
        """Replace profile names even when markup splits their text."""
        if not self._profile_name or not self._text_output_indices:
            return
        original_nodes = [self._out[index] for index in self._text_output_indices]
        rendered_text = ''.join(original_nodes)
        name_parts = self._profile_name.split()
        if not name_parts:
            return
        profile_pattern = re.compile(
            r'\s+'.join(re.escape(part) for part in name_parts),
            re.IGNORECASE,
        )
        matches = list(profile_pattern.finditer(rendered_text))
        if not matches:
            return

        def locate(position):
            offset = 0
            for node_index, node in enumerate(original_nodes):
                next_offset = offset + len(node)
                if position < next_offset:
                    return node_index, position - offset
                offset = next_offset
            raise ValueError('Profile text position is outside rendered output')

        updated_nodes = original_nodes.copy()
        for match in reversed(matches):
            start_node, start_offset = locate(match.start())
            end_node, end_offset = locate(match.end() - 1)
            end_offset += 1
            if start_node == end_node:
                node = updated_nodes[start_node]
                updated_nodes[start_node] = (
                    node[:start_offset] + 'Test User' + node[end_offset:]
                )
                continue
            updated_nodes[start_node] = (
                updated_nodes[start_node][:start_offset] + 'Test User'
            )
            for node_index in range(start_node + 1, end_node):
                updated_nodes[node_index] = ''
            updated_nodes[end_node] = updated_nodes[end_node][end_offset:]

        for output_index, value in zip(self._text_output_indices, updated_nodes):
            self._out[output_index] = value


def anonymise(html: str, profile_name: str = '') -> str:
    p = _Anonymiser(profile_name)
    p.feed(html)
    return p.result()


class _ProgressPrivacyValidator(HTMLParser):
    """Validate that progress cards contain only deterministic synthetic media."""

    def __init__(self):
        super().__init__()
        self.violations = []
        self._depth = 0
        self._expected_asset = ''
        self._expected_id = ''
        self._expected_title = ''

    def _validate_attrs(self, attrs):
        attr_dict = dict(attrs)
        for name in ('href', 'action'):
            value = attr_dict.get(name)
            if value is not None and value != f'/browse?jbv={self._expected_id}':
                self.violations.append(f'progress-card {name} is not synthetic')
        for name in ('src', 'poster', 'srcset'):
            value = attr_dict.get(name)
            if value is not None and value != self._expected_asset:
                self.violations.append(f'progress-card {name} is not synthetic')
        for name in _PROGRESS_MEDIA_ATTRIBUTE_NAMES:
            value = attr_dict.get(name)
            if value is not None and value != f'synthetic-progress-{self._expected_id}':
                self.violations.append(f'progress-card {name} is not synthetic')
        style = attr_dict.get('style') or ''
        style_urls = re.findall(r'url\(([^)]*)\)', style, re.IGNORECASE)
        if any(url.strip(' "\'') != self._expected_asset for url in style_urls):
            self.violations.append('progress-card style URL is not synthetic')
        for name in ('alt', 'aria-label', 'title'):
            value = attr_dict.get(name) or ''
            if value and value != self._expected_title:
                self.violations.append(f'progress-card {name} is not synthetic')

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if self._depth == 0 and attr_dict.get('data-uia') == 'progress-card':
            label = attr_dict.get('aria-label') or ''
            match = _SYNTHETIC_PROGRESS_TITLE_RE.fullmatch(label)
            if not match:
                self.violations.append('progress-card aria-label is not synthetic')
                index = 0
            else:
                index = int(match.group(1))
            self._expected_id = f'{99000000 + index}'
            self._expected_title = f'Synthetic Progress Title {index:02d}'
            self._expected_asset = (
                f'https://example.invalid/netflix/progress-card-{index:02d}.jpg'
            )
            self._depth = 1
        elif self._depth > 0 and tag not in _VOID_TAGS:
            self._depth += 1

        if self._depth > 0:
            self._validate_attrs(attrs)

    def handle_endtag(self, tag):
        if self._depth > 0:
            self._depth -= 1
            if self._depth == 0:
                self._expected_asset = ''
                self._expected_id = ''
                self._expected_title = ''

    def handle_data(self, data):
        value = data.strip()
        if self._depth > 0 and value and value != self._expected_title:
            self.violations.append('progress-card text is not synthetic')


def _decode_privacy_text(value):
    """Decode HTML and URL encoding repeatedly to expose nested metadata."""
    decoded = value
    for _ in range(3):
        next_value = urllib.parse.unquote(html_lib.unescape(decoded))
        if next_value == decoded:
            break
        decoded = next_value
    return decoded


def _word_tokens(value):
    return tuple(re.findall(r'\w+', _decode_privacy_text(value).casefold()))


class _ProfilePrivacyValidator(HTMLParser):
    """Find known profile names only in rendered text and descriptive attrs."""

    _DESCRIPTIVE_ATTRS = frozenset({'alt', 'aria-label', 'title'})

    def __init__(self, profile_names):
        super().__init__()
        self._found = False
        self._ignored_depth = 0
        self._rendered_text = []
        self._profile_tokens = [
            _word_tokens(name)
            for name in profile_names
            if _word_tokens(name)
        ]

    def _check(self, value):
        tokens = _word_tokens(value)
        for profile_tokens in self._profile_tokens:
            width = len(profile_tokens)
            if any(
                tokens[index:index + width] == profile_tokens
                for index in range(len(tokens) - width + 1)
            ):
                self._found = True

    @property
    def found(self):
        self._check(''.join(self._rendered_text))
        return self._found

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self._ignored_depth += 1
            return
        if self._ignored_depth > 0:
            return
        for name, value in attrs:
            if name in self._DESCRIPTIVE_ATTRS and value:
                self._check(value)

    def handle_endtag(self, tag):
        if tag in ('script', 'style') and self._ignored_depth > 0:
            self._ignored_depth -= 1

    def handle_data(self, data):
        if self._ignored_depth == 0:
            self._rendered_text.append(data)


_FORBIDDEN_PRIVACY_PATTERNS = (
    ('notification URL', re.compile(
        r'(?:https?://(?:www\.)?netflix\.com)?/notification/',
        re.I,
    )),
    ('notification subtree', re.compile(r'data-uia=["\'][^"\']*notification', re.I)),
    ('account subtree', re.compile(r'data-uia=["\']account-dropdown-button', re.I)),
    ('privacy consent subtree', re.compile(r'id=["\']onetrust-', re.I)),
    ('adtech subtree', re.compile(r'adtech(?:_|-iframe|iframe)', re.I)),
    ('tracking UUID', re.compile(r'data-tracking-uuid', re.I)),
    ('tracking context', re.compile(
        r'data-ui-tracking-context|(?:[?&]|&amp;)tctx=',
        re.I,
    )),
    ('request identifier', re.compile(r'request(?:_|-|%5f|%2d)?id', re.I)),
    ('list identifier', re.compile(r'list(?:_|-|%5f|%2d)?id', re.I)),
    ('membership metadata', re.compile(
        r'membership(?:_|-|%5f|%2d)?status|'
        r'is(?:_|-|%5f|%2d)?member|wasformermember',
        re.I,
    )),
    ('country metadata', re.compile(
        r'(?:%22|["\'])country(?:%22|["\'])\s*(?::|%3a)|'
        r'(?:[?&]|&amp;)country=',
        re.I,
    )),
    ('region metadata', re.compile(r'region(?:_|-|%5f|%2d)?code', re.I)),
)


def validate_fixture_privacy(paths, profile_names=()):
    """Fail if captured fixtures retain account or viewing-history metadata."""
    violations = []
    known_names = [name.strip() for name in profile_names if name and name.strip()]
    for path in paths:
        fixture_path = Path(path)
        content = fixture_path.read_text(encoding='utf-8')
        decoded_content = _decode_privacy_text(content)
        for label, pattern in _FORBIDDEN_PRIVACY_PATTERNS:
            if pattern.search(decoded_content):
                violations.append(f'{fixture_path}: {label}')

        profile_validator = _ProfilePrivacyValidator(known_names)
        profile_validator.feed(content)
        if profile_validator.found:
            violations.append(f'{fixture_path}: known profile name')

        progress_validator = _ProgressPrivacyValidator()
        progress_validator.feed(content)
        violations.extend(
            f'{fixture_path}: {message}'
            for message in progress_validator.violations
        )

    if violations:
        details = '\n  '.join(violations)
        raise RuntimeError(f'Privacy validation failed:\n  {details}')


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

def require_capture(name, html):
    """Return captured HTML or fail before an empty fixture is written."""
    if not html or not html.strip():
        raise RuntimeError(f'Could not capture required Netflix surface: {name}')
    return html

def materialise_browse_rows(s):
    """Scroll through lazy browse rows so all current card surfaces are present."""
    ev(s, 'window.scrollTo(0, document.body.scrollHeight)')
    time.sleep(5)
    ev(s, 'window.scrollTo(0, 0)')
    time.sleep(1)

def get_profile_name(s):
    return ev(s, """(() => {
        const el = document.querySelector(
            '.account-menu-item .profile-name, [data-uia="profile-name"], .profileName'
        );
        if (el) return el.textContent.trim();
        const heading = [...document.querySelectorAll('h2')].find(node =>
            node.textContent.startsWith('Continue Watching for ')
        );
        return heading ? heading.textContent.replace('Continue Watching for ', '').trim() : '';
    })()""") or ''

def hover_card(s, index=2):
    pos = ev(s, f"""(() => {{
        const titleCards = [...document.querySelectorAll('.title-card')];
        const cards = titleCards.length
            ? titleCards
            : [...document.querySelectorAll('[data-uia="standard-card"]')];
        const visibleCards = cards.filter(card => {{
            const r = card.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
        }});
        const card = visibleCards[{index}] || visibleCards[0];
        if (!card) return null;
        const r = card.getBoundingClientRect();
        return {{x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)}};
    }})()""")
    if not pos:
        print('  no visible legacy hover surface found; preserving existing preview fixtures')
        return False
    call(s, 'Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'], 'y': pos['y']})
    time.sleep(2.5)
    return True

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

def preserve_existing(path, name, profile_name=''):
    """Keep and re-sanitise a fixture when its live surface is unavailable."""
    p = Path(path)
    existing = require_capture(name, p.read_text(encoding='utf-8'))
    sanitised = anonymise(existing, profile_name)
    if sanitised != existing:
        p.write_text(sanitised, encoding='utf-8')
    print(f'  {name} surface absent; preserving existing {p}')

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent  # repo root
FIXTURE_PATHS = (
    ROOT / 'tests/fixtures/surfaces/title-card.html',
    ROOT / 'tests/fixtures/surfaces/progress-card.html',
    ROOT / 'tests/fixtures/surfaces/ranked-card.html',
    ROOT / 'tests/fixtures/surfaces/standard-card.html',
    ROOT / 'tests/fixtures/surfaces/preview-mini.html',
    ROOT / 'tests/fixtures/surfaces/preview-detail.html',
    ROOT / 'tests/fixtures/netflix-browse.html',
    ROOT / 'tests/fixtures/netflix-search.html',
    ROOT / 'tests/fixtures/netflix-hover.html',
    ROOT / 'tests/fixtures/netflix-modal.html',
)

def main():
    ws_path = _find_netflix_ws()
    print(f'Connecting to {ws_path}')
    s = _connect(ws_path)

    # ---- 1. Browse page (title-card surface + full-page fixture) -----------
    print('\n[1/4] Browse page — title-card surface')
    navigate(s, 'https://www.netflix.com/browse')
    profile_name = get_profile_name(s)
    print(f'  Profile name detected: {bool(profile_name)}')
    materialise_browse_rows(s)

    browse_surfaces = {
        'title-card': '.title-card a[aria-label]',
        'progress-card': '[data-uia="progress-card"][aria-label]',
        'ranked-card': '[data-uia="ranked-card"][aria-label]',
    }
    for name, selector in browse_surfaces.items():
        card_html = capture_row_html(s, selector)
        if name == 'title-card' and not card_html.strip():
            preserve_existing(
                ROOT / 'tests/fixtures/surfaces/title-card.html',
                'legacy title-card',
                profile_name,
            )
            continue
        card_html = require_capture(name, card_html)
        save(
            ROOT / f'tests/fixtures/surfaces/{name}.html',
            wrap(anonymise(card_html, profile_name)),
        )

    # Full-page fixture: entire body content minus My List
    body_html = require_capture('browse page', ev(s, 'document.body.outerHTML') or '')
    body_html = remove_row_by_heading(body_html, 'My List')
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
    grid_html = require_capture('standard card', grid_html)
    save(ROOT / 'tests/fixtures/surfaces/standard-card.html',
         wrap(anonymise(grid_html, profile_name)))

    body_html = require_capture('search page', ev(s, 'document.body.outerHTML') or '')
    save(ROOT / 'tests/fixtures/netflix-search.html',
         anonymise(body_html, profile_name))

    # ---- 3. Hover mini-modal -----------------------------------------------
    print('\n[3/4] Hover mini-modal — previewModal-mini surface')
    navigate(s, 'https://www.netflix.com/browse')
    time.sleep(1)
    hovered = hover_card(s, index=2)
    mini_html = (
        capture_outer_html(s, '.previewModal--wrapper.mini-modal') or ''
        if hovered else ''
    )
    if mini_html.strip():
        save(ROOT / 'tests/fixtures/surfaces/preview-mini.html',
             wrap(anonymise(mini_html, profile_name)))
        save(ROOT / 'tests/fixtures/netflix-hover.html',
             anonymise(mini_html, profile_name))
    else:
        preserve_existing(
            ROOT / 'tests/fixtures/surfaces/preview-mini.html',
            'mini preview',
            profile_name,
        )
        preserve_existing(
            ROOT / 'tests/fixtures/netflix-hover.html',
            'hover preview',
            profile_name,
        )

    # ---- 4. Full detail modal ----------------------------------------------
    print('\n[4/4] Full detail modal — previewModal-detail surface')
    if mini_html.strip():
        click_more_info(s)

    detail_html = capture_outer_html(s, '.previewModal--wrapper.detail-modal') or ''
    if detail_html.strip():
        save(ROOT / 'tests/fixtures/surfaces/preview-detail.html',
             wrap(anonymise(detail_html, profile_name)))
        save(ROOT / 'tests/fixtures/netflix-modal.html',
             anonymise(detail_html, profile_name))
    else:
        preserve_existing(
            ROOT / 'tests/fixtures/surfaces/preview-detail.html',
            'detail preview',
            profile_name,
        )
        preserve_existing(
            ROOT / 'tests/fixtures/netflix-modal.html',
            'modal preview',
            profile_name,
        )

    close_modal(s)
    s.close()
    validate_fixture_privacy(FIXTURE_PATHS, profile_names=[profile_name])
    print(f'  privacy validation passed for {len(FIXTURE_PATHS)} fixtures')
    print('\nDone.')

if __name__ == '__main__':
    main()
