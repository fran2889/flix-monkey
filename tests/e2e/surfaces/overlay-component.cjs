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
class OverlayComponent {
    constructor(page, container) {
        this.page = page;
        this.container = container;
        this.selector = '.fm-rating-overlay';
    }

    locator() {
        return this.container.locator(this.selector);
    }

    async waitForLoaded() {
        // Wait for overlay to exist and NOT have the loading class
        const loc = this.locator();
        await loc.waitFor({ state: 'visible', timeout: 5000 });
        await this.page.waitForFunction(
            (sel, parent) => {
                const el = parent.querySelector(sel);
                return el && !el.classList.contains('fm-loading');
            },
            this.selector,
            await this.container.elementHandle()
        );
    }

    async getImdbValue() {
        const text = await this.locator().textContent();
        // Regex to find decimal or integer (e.g. "8.5" or "8")
        const match = text.match(/IMDb\s+([\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
    }

    async isFaded() {
        return this.container.evaluate(el => el.classList.contains('fm-faded'));
    }
}

module.exports = OverlayComponent;
