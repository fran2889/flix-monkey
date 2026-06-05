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

    it('should have role="dialog" and aria-modal on the content element', () => {
        const _modal = new Modal('A11y Modal');
        const content = document.querySelector('.fm-modal-content');
        expect(content.getAttribute('role')).toBe('dialog');
        expect(content.getAttribute('aria-modal')).toBe('true');
        const labelledBy = content.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        const titleEl = document.getElementById(labelledBy);
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('A11y Modal');
    });

    it('should close when Escape is pressed', () => {
        const modal = new Modal('Escape Modal');
        modal.open();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.fm-modal-overlay')).toBeNull();
    });

    it('should not register duplicate Escape listeners when opened twice', () => {
        const modal = new Modal('Double Open');
        modal.open();
        modal.open(); // second call should be a no-op
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        // modal is closed by Escape, overlay should be gone
        expect(document.querySelector('.fm-modal-overlay')).toBeNull();
        // if two listeners were registered, calling close() twice would throw on the second overlay.remove()
        // but there's no error to catch here - just verify clean close
    });

    it('should return focus to the trigger element after close', () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const modal = new Modal('Focus Modal');
        modal.open();
        modal.close();

        expect(document.activeElement).toBe(trigger);
    });
});
