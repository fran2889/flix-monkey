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
        this.overlay.innerHTML = `
            <div class="fm-modal-content" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
                <div class="fm-modal-header">
                    <h2 class="fm-modal-title" id="${titleId}"></h2>
                    <button class="fm-modal-close">×</button>
                </div>
                <div class="fm-modal-body"></div>
            </div>
        `;
        this.overlay.querySelector('.fm-modal-title').textContent = this.title;
        this.overlay.querySelector('.fm-modal-close').onclick = () => this.close();
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
