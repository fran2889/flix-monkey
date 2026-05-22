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
import { Modal } from '../../src/core/ui/modal.js';

describe('Settings UI and Modal Rendering', () => {
    const mockAdapter = {
        storageGetAll: vi.fn().mockResolvedValue({}),
        storageSetMany: vi.fn().mockResolvedValue({}),
    };

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should correctly render the SettingsUI within a Modal', async () => {
        const modal = new Modal('FlixMonkey Settings');
        const container = modal.getContentContainer();
        const ui = new SettingsUI(mockAdapter);

        await ui.render(container);
        modal.open();

        // Verify Modal Structure
        const overlay = document.querySelector('.fm-modal-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.style.display).toBe('flex');

        const title = overlay.querySelector('.fm-modal-title');
        expect(title).not.toBeNull();
        expect(title.textContent).toBe('FlixMonkey Settings');

        // Verify Settings UI Structure inside the modal body
        const settingsContainer = overlay.querySelector('.fm-settings-container');
        expect(settingsContainer).not.toBeNull();
        expect(container).toBe(settingsContainer);

        // Verify fields are rendered
        const fields = settingsContainer.querySelectorAll('.field');
        expect(fields.length).toBeGreaterThan(0);

        // Verify action buttons are rendered
        const saveBtn = document.getElementById('fm-saveBtn');
        const clearBtn = document.getElementById('fm-clearCacheBtn');
        const resetBtn = document.getElementById('fm-resetClientsBtn');

        expect(saveBtn).not.toBeNull();
        expect(clearBtn).not.toBeNull();
        expect(resetBtn).not.toBeNull();
    });

    it('should apply correct CSS classes to modal elements', () => {
        const _modal = new Modal('Test Title');
        const overlay = document.querySelector('.fm-modal-overlay');
        const content = overlay.querySelector('.fm-modal-content');
        const header = overlay.querySelector('.fm-modal-header');
        const title = overlay.querySelector('.fm-modal-title');
        const closeBtn = overlay.querySelector('.fm-modal-close');

        expect(overlay).not.toBeNull();
        expect(content).not.toBeNull();
        expect(header).not.toBeNull();
        expect(title).not.toBeNull();
        expect(closeBtn).not.toBeNull();
    });

    it('should close the modal when close button is clicked', () => {
        const _modal = new Modal('Test Title');
        const closeBtn = document.querySelector('.fm-modal-close');

        expect(document.querySelector('.fm-modal-overlay')).not.toBeNull();

        closeBtn.click();

        expect(document.querySelector('.fm-modal-overlay')).toBeNull();
    });
});
