# Copyright (C) 2026 Fran
#
# This file is part of FlixMonkey.
#
# FlixMonkey is free software: you can redistribute it and/or modify it under the
# terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version.
#
# FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
# PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# FlixMonkey. If not, see <https://www.gnu.org/licenses/>.

import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[2] / 'scripts/capture-surface-fixtures.py'
SPEC = importlib.util.spec_from_file_location('capture_surface_fixtures', SCRIPT_PATH)
CAPTURE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CAPTURE)


class AnonymiserPrivacyTest(unittest.TestCase):
    def test_does_not_store_derived_known_profile_identifiers(self):
        source = SCRIPT_PATH.read_text(encoding='utf-8')

        self.assertNotIn('_KNOWN_CAPTURED_PROFILE_NAME_HASHES', source)
        self.assertNotIn('import hashlib', source)

    def test_removes_personalised_subtrees_and_tracking_contexts(self):
        source = '''
            <main>
                <div data-uia="navigation+notifications">
                    <a href="https://www.netflix.com/notification/private-capability">Private</a>
                </div>
                <div data-uia="account-dropdown-button">Account</div>
                <div id="onetrust-consent-sdk">Consent metadata</div>
                <iframe data-uia="adtech-iframe" src="https://ae.nflximg.net/adtech_iframe_target.html?data=private"></iframe>
                <a
                    href="/watch/123?trackId=456&amp;tctx=private&amp;foo=bar"
                    data-tracking-uuid="11111111-2222-4333-8444-555555555555"
                    data-ui-tracking-context="%7B%22request_id%22%3A%22private%22%7D"
                    data-request-id="private"
                >Keep</a>
            </main>
        '''

        result = CAPTURE.anonymise(source)

        self.assertNotIn('navigation+notifications', result)
        self.assertNotIn('account-dropdown-button', result)
        self.assertNotIn('onetrust-consent-sdk', result)
        self.assertNotIn('adtech-iframe', result)
        self.assertNotIn('data-tracking-uuid', result)
        self.assertNotIn('data-ui-tracking-context', result)
        self.assertNotIn('data-request-id', result)
        self.assertNotIn('trackId=', result)
        self.assertNotIn('tctx=', result)
        self.assertIn('foo=bar', result)
        self.assertIn('Keep', result)

    def test_syntheticises_progress_card_content_deterministically(self):
        source = '''
            <a
                data-uia="progress-card"
                aria-label="Private Show"
                title="Private Show - Private Episode"
                href="/browse?jbv=12345678"
            >
                <img
                    src="https://occ.example/opaque-private-image.jpg"
                    alt="Private Show - Private Episode"
                    title="Private Show - Private Episode"
                    data-video-id="12345678"
                    style="background-image: url(https://occ.example/private-background.jpg)"
                >
                <span>Private Show</span>
            </a>
            <a data-uia="progress-card" aria-label="Private Show" href="/browse?jbv=12345678">
                <img src="https://occ.example/opaque-private-image.jpg" alt="Private Show">
            </a>
        '''

        result = CAPTURE.anonymise(source)

        self.assertNotIn('Private Show', result)
        self.assertNotIn('12345678', result)
        self.assertNotIn('opaque-private-image', result)
        self.assertNotIn('private-background', result)
        self.assertNotIn('Private Episode', result)
        self.assertEqual(result.count('aria-label="Synthetic Progress Title 01"'), 2)
        self.assertEqual(result.count('title="Synthetic Progress Title 01"'), 2)
        self.assertIn('alt="Synthetic Progress Title 01"', result)
        self.assertEqual(result.count('href="/browse?jbv=99000001"'), 2)
        self.assertEqual(
            result.count('src="https://example.invalid/netflix/progress-card-01.jpg"'),
            2,
        )
        self.assertIn('data-uia="progress-card"', result)

    def test_redacts_profile_name_split_across_sibling_text_nodes(self):
        result = CAPTURE.anonymise(
            '<h2>Continue Watching for Private<span> Profile</span></h2>',
            profile_name='Private Profile',
        )

        self.assertIn('Test User', result)
        self.assertNotIn('Private', result)
        self.assertNotIn('Profile', result)

    def test_redacts_profile_name_split_inside_words(self):
        result = CAPTURE.anonymise(
            '<div>Pri<span>vate Pro</span>file</div>',
            profile_name='Private Profile',
        )

        self.assertIn('Test User', result)
        self.assertNotIn('Pri', result)
        self.assertNotIn('vate Pro', result)
        self.assertNotIn('file', result)

    def test_preserve_existing_reanonymises_legacy_fixture(self):
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        path = Path(temporary_directory.name) / 'legacy.html'
        path.write_text(
            '<div data-ui-tracking-context="%7B%22request_id%22%3A%22private%22%7D">Legacy</div>',
            encoding='utf-8',
        )

        CAPTURE.preserve_existing(path, 'legacy preview')

        content = path.read_text(encoding='utf-8')
        self.assertIn('Legacy', content)
        self.assertNotIn('data-ui-tracking-context', content)


class FixturePrivacyValidationTest(unittest.TestCase):
    def _write_fixture(self, html):
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        path = Path(temporary_directory.name) / 'fixture.html'
        path.write_text(html, encoding='utf-8')
        return path

    def test_accepts_synthetic_progress_card_and_static_content(self):
        path = self._write_fixture('''
            <main lang="en-HR">
                <a data-uia="progress-card" aria-label="Synthetic Progress Title 01" href="/browse?jbv=99000001">
                    <img src="https://example.invalid/netflix/progress-card-01.jpg" alt="">
                </a>
                <div data-uia="standard-card" aria-label="Breaking Bad"></div>
            </main>
        ''')

        CAPTURE.validate_fixture_privacy([path], profile_names=['Private Profile'])

    def test_rejects_each_forbidden_privacy_pattern(self):
        unsafe_fragments = {
            'notification URL': '<a href="https://www.netflix.com/notification/private">x</a>',
            'relative notification URL': '<a href="/notification/private">x</a>',
            'tracking UUID': '<div data-tracking-uuid="11111111-2222-4333-8444-555555555555"></div>',
            'tracking context': '<div data-ui-tracking-context="%7B%7D"></div>',
            'request identifier': '<div data-request-id="private"></div>',
            'entity-encoded request identifier': '<div data-x="request&#95;id"></div>',
            'double-encoded request identifier': '<div data-x="request%255Fid"></div>',
            'list identifier': '<div data-list-id="private"></div>',
            'encoded request identifier': '<div data-x="%22request_id%22%3A%22private%22"></div>',
            'adtech membership metadata': '<iframe src="?membership_status=CURRENT_MEMBER"></iframe>',
            'adtech country metadata': '<iframe src="?country=HR"></iframe>',
            'adtech region metadata': '<iframe src="?region_code=21&amp;is_member=current"></iframe>',
            'tracking query context': '<a href="/watch/1?tctx=private">x</a>',
        }

        for label, fragment in unsafe_fragments.items():
            with self.subTest(label=label):
                path = self._write_fixture(fragment)
                with self.assertRaisesRegex(RuntimeError, 'Privacy validation failed'):
                    CAPTURE.validate_fixture_privacy([path])

    def test_rejects_known_profile_name_after_html_entity_decoding(self):
        path = self._write_fixture(
            '<div aria-label="Private&#32;Profile - Account"></div>'
        )

        with self.assertRaisesRegex(RuntimeError, 'known profile name'):
            CAPTURE.validate_fixture_privacy(
                [path],
                profile_names=['Private Profile'],
            )

    def test_does_not_match_common_profile_name_inside_unrelated_words(self):
        path = self._write_fixture('''
            <style>:root { --search-max-width: 10rem; }</style>
            <div aria-label="Maximum maturity rating">Static content</div>
        ''')

        CAPTURE.validate_fixture_privacy([path], profile_names=['Max'])

    def test_rejects_non_synthetic_progress_content(self):
        path = self._write_fixture('''
            <a data-uia="progress-card" aria-label="Private Show" href="/browse?jbv=12345678">
                <img src="https://occ.example/private.jpg" alt="">
            </a>
        ''')

        with self.assertRaisesRegex(RuntimeError, 'progress-card aria-label'):
            CAPTURE.validate_fixture_privacy([path])

    def test_rejects_private_values_inside_synthetic_progress_card(self):
        path = self._write_fixture('''
            <a data-uia="progress-card" aria-label="Synthetic Progress Title 01" href="/browse?jbv=99000001">
                <div
                    data-video-id="12345678"
                    style="background-image: url(https://occ.example/private.jpg)"
                >Private Show</div>
            </a>
        ''')

        with self.assertRaisesRegex(RuntimeError, 'progress-card'):
            CAPTURE.validate_fixture_privacy([path])

    def test_rejects_private_suffix_in_progress_descriptive_attribute(self):
        path = self._write_fixture('''
            <a
                data-uia="progress-card"
                aria-label="Synthetic Progress Title 01"
                title="Synthetic Progress Title 01 - Private Episode"
                href="/browse?jbv=99000001"
            ></a>
        ''')

        with self.assertRaisesRegex(RuntimeError, 'progress-card title'):
            CAPTURE.validate_fixture_privacy([path])

    def test_rejects_profile_name_split_across_sibling_text_nodes(self):
        path = self._write_fixture(
            '<div>Private<span> Profile</span></div>'
        )

        with self.assertRaisesRegex(RuntimeError, 'known profile name'):
            CAPTURE.validate_fixture_privacy(
                [path],
                profile_names=['Private Profile'],
            )

    def test_rejects_profile_name_split_inside_words(self):
        path = self._write_fixture(
            '<div>Pri<span>vate Pro</span>file</div>'
        )

        with self.assertRaisesRegex(RuntimeError, 'known profile name'):
            CAPTURE.validate_fixture_privacy(
                [path],
                profile_names=['Private Profile'],
            )


if __name__ == '__main__':
    unittest.main()
