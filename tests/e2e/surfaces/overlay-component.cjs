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
    constructor(container) {
        this.container = container;
        this.selector = '.fm-rating-overlay';
    }

    locator() {
        return this.container.locator(this.selector);
    }

    async waitForLoaded() {
        // Wait for the specific version of the overlay that is NOT loading.
        // This is more robust than elementHandle as it survives re-renders and element replacement.
        await this.container.locator(`${this.selector}:not(.fm-loading)`).waitFor({ state: 'visible', timeout: 5000 });
    }

    async getImdbValue() {
        const text = await this.locator().textContent();
        if (!text) return null;

        // Regex to find decimal or integer (e.g. "8.5" or "8")
        const match = text.match(/IMDb\s+([\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
    }

    async isFaded() {
        return this.container.evaluate(el => el.classList.contains('fm-faded'));
    }
}

module.exports = OverlayComponent;
