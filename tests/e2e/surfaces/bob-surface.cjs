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
const OverlayComponent = require('./overlay-component.cjs');

class BobSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
        this.containerSelector = '.bob-container';
    }

    async triggerHover(cardLocator) {
        await cardLocator.hover();
        const bobContainer = this.page.locator(this.containerSelector);
        await bobContainer.waitFor({ state: 'visible', timeout: 5000 });
        // Wait for Netflix scaling/fade animation to settle
        await this.page.waitForTimeout(500);
        return bobContainer;
    }

    getOverlay() {
        return new OverlayComponent(this.page.locator(this.containerSelector));
    }
}

module.exports = BobSurface;
