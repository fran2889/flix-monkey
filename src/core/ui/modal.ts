/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Accessible modal dialog component for settings and other UI overlays.
 */
export class Modal {
    #returnFocus: HTMLElement | null = null;
    #escHandler: ((_e: KeyboardEvent) => void) | null = null;
    overlay: HTMLDivElement;

    /**
     * Creates a modal dialog with the specified title.
     *
     * @param title - Modal title displayed in the header.
     */
    constructor(title: string) {
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
        heading.textContent = title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'fm-modal-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.#close();

        const body = document.createElement('div');
        body.className = 'fm-modal-body';

        header.append(heading, closeBtn);
        content.append(header, body);
        this.overlay.appendChild(content);
    }

    /**
     * Displays the modal and sets up keyboard navigation.
     */
    open(): void {
        if (this.#escHandler !== null) return;
        document.body.appendChild(this.overlay);
        this.#returnFocus = document.activeElement as HTMLElement | null;
        this.overlay.style.display = 'flex';
        const contentElement = this.overlay.querySelector('.fm-modal-content');
        if (contentElement) {
            (contentElement as HTMLElement).focus();
        }
        this.#escHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') this.#close();
        };
        document.addEventListener('keydown', this.#escHandler);
    }

    #close(): void {
        if (this.#escHandler !== null) {
            document.removeEventListener('keydown', this.#escHandler);
            this.#escHandler = null;
        }
        this.overlay.remove();
        this.#returnFocus?.focus?.();
    }

    /**
     * Returns the modal body container for adding custom content.
     *
     * @returns The modal body container.
     */
    getContentContainer(): HTMLElement {
        const body = this.overlay.querySelector('.fm-modal-body');
        if (body === null) {
            throw new Error('Modal body container not found');
        }
        return body as HTMLElement;
    }
}
