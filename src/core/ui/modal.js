/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export class Modal {
    #returnFocus = null;
    #escHandler = null;

    /** @param {string} title */
    constructor(title) {
        this.title = title;
        const titleId = `fm-modal-title-${crypto.randomUUID()}`;

        this.overlay = document.createElement('div');
        this.overlay.className = 'fm-modal-overlay';

        const content = document.createElement('div');
        content.className = 'fm-modal-content';
        content.setAttribute('role', 'dialog');
        content.setAttribute('aria-modal', 'true');
        content.setAttribute('aria-labelledby', titleId);
        content.setAttribute('tabindex', '-1');

        const header = document.createElement('div');
        header.className = 'fm-modal-header';

        const heading = document.createElement('h2');
        heading.className = 'fm-modal-title';
        heading.id = titleId;
        heading.textContent = this.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'fm-modal-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.close();

        const body = document.createElement('div');
        body.className = 'fm-modal-body';

        header.append(heading, closeBtn);
        content.append(header, body);
        this.overlay.appendChild(content);
    }

    /** @returns {HTMLDivElement} */
    getContentContainer() {
        return this.overlay.querySelector('.fm-modal-body');
    }

    /** @returns {void} */
    open() {
        if (this.#escHandler) return;
        document.body.appendChild(this.overlay);
        this.#returnFocus = document.activeElement;
        this.overlay.style.display = 'flex';
        this.overlay.querySelector('.fm-modal-content').focus();
        this.#escHandler = e => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.#escHandler);
    }

    /** @returns {void} */
    close() {
        if (this.#escHandler) {
            document.removeEventListener('keydown', this.#escHandler);
            this.#escHandler = null;
        }
        this.overlay.remove();
        this.#returnFocus?.focus();
    }
}
