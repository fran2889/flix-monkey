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


class FixtureSanitizerTest(unittest.TestCase):
    def test_syntheticizes_progress_card_history(self):
        result = CAPTURE.sanitize('''
            <a data-uia="progress-card" aria-label="Private Show" href="/browse?jbv=123">
                <img src="https://occ.example/private.jpg" alt="Private Show">
                <span>Private Show</span>
            </a>
        ''')

        self.assertNotIn('Private Show', result)
        self.assertNotIn('occ.example', result)
        self.assertIn('aria-label="Synthetic Progress Title 01"', result)
        self.assertIn('href="/browse?jbv=99000001"', result)

    def test_strips_tracking_attributes_and_query_parameters(self):
        result = CAPTURE.sanitize('''
            <a href="/watch/1?trackId=2&amp;tctx=private&amp;foo=bar"
               data-tracking-uuid="private"
               data-ui-tracking-context="private">Keep</a>
        ''')

        self.assertNotIn('data-tracking-uuid', result)
        self.assertNotIn('data-ui-tracking-context', result)
        self.assertNotIn('trackId', result)
        self.assertNotIn('tctx', result)
        self.assertIn('foo=bar', result)

    def test_validator_rejects_private_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.html'
            path.write_text('<div data-request-id="private"></div>', encoding='utf-8')

            with self.assertRaisesRegex(RuntimeError, 'retained private metadata'):
                CAPTURE.validate_fixture(path)

    def test_validator_rejects_live_progress_media(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.html'
            path.write_text(
                '<a data-uia="progress-card" aria-label="Synthetic Progress Title 01">'
                '<img src="https://occ-1.nflxso.net/private.jpg"></a>',
                encoding='utf-8',
            )

            with self.assertRaisesRegex(RuntimeError, 'media is not synthetic'):
                CAPTURE.validate_fixture(path)


if __name__ == '__main__':
    unittest.main()
