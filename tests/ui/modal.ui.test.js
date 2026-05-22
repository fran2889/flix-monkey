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
import { describe, it, expect, beforeEach } from 'vitest';
import { Modal } from '../../src/core/ui/modal.js';

describe('Modal UI Component', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should correctly render the modal and its sub-elements', () => {
        const _modal = new Modal('Test Modal');

        expect(document.querySelector('.fm-modal-overlay')).not.toBeNull();
        expect(document.querySelector('.fm-modal-content')).not.toBeNull();
        expect(document.querySelector('.fm-modal-header')).not.toBeNull();
        expect(document.querySelector('.fm-modal-title')).not.toBeNull();
        expect(document.querySelector('.fm-modal-title').textContent).toBe('Test Modal');
        expect(document.querySelector('.fm-modal-close')).not.toBeNull();
        expect(document.querySelector('.fm-modal-body')).not.toBeNull();
    });

    it('should return the correct content container', () => {
        const modal = new Modal('Test Modal');
        const container = modal.getContentContainer();
        expect(container.className).toBe('fm-modal-body');
    });

    it('should show the modal when open() is called', () => {
        const modal = new Modal('Test Modal');
        modal.open();
        expect(document.querySelector('.fm-modal-overlay').style.display).toBe('flex');
    });

    it('should remove the modal from DOM when close() is called', () => {
        const modal = new Modal('Test Modal');
        modal.close();
        expect(document.querySelector('.fm-modal-overlay')).toBeNull();
    });

    it('should close the modal when clicking the close button', () => {
        const _modal = new Modal('Test Modal');
        const closeBtn = document.querySelector('.fm-modal-close');
        closeBtn.click();
        expect(document.querySelector('.fm-modal-overlay')).toBeNull();
    });
});
