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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsUI } from '../../src/core/ui/settings-ui.js';

describe('SettingsUI Component', () => {
    const mockAdapter = {
        storageGetAll: vi.fn().mockResolvedValue({}),
        storageSetMany: vi.fn().mockResolvedValue({}),
    };

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '<div id="container"></div>';
        vi.clearAllMocks();
    });

    it('should render the settings container and inject styles', async () => {
        const container = document.getElementById('container');
        const ui = new SettingsUI(mockAdapter);
        await ui.render(container);

        expect(container.classList.contains('fm-settings-container')).toBe(true);
        expect(document.getElementById('flixmonkey-settings-styles')).not.toBeNull();
    });

    it('should render title, fields, and action buttons', async () => {
        const container = document.getElementById('container');
        const ui = new SettingsUI(mockAdapter);
        await ui.render(container);

        expect(container.querySelector('h1').textContent).toBe('FlixMonkey Settings');
        expect(container.querySelectorAll('.field').length).toBeGreaterThan(0);

        expect(document.getElementById('fm-saveBtn')).not.toBeNull();
        expect(document.getElementById('fm-clearCacheBtn')).not.toBeNull();
        expect(document.getElementById('fm-resetClientsBtn')).not.toBeNull();
    });
});
