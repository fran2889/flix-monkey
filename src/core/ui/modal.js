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

export class Modal {
    #returnFocus = null;
    #escHandler = null;

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
        document.body.appendChild(this.overlay);
    }

    getContentContainer() {
        return this.overlay.querySelector('.fm-modal-body');
    }

    open() {
        if (this.#escHandler) return;
        this.#returnFocus = document.activeElement;
        this.overlay.style.display = 'flex';
        this.overlay.querySelector('.fm-modal-content').focus();
        this.#escHandler = e => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.#escHandler);
    }

    close() {
        if (this.#escHandler) {
            document.removeEventListener('keydown', this.#escHandler);
            this.#escHandler = null;
        }
        this.overlay.remove();
        this.#returnFocus?.focus();
    }
}
