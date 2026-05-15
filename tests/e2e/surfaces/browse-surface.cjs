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

class BrowseSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
        this.cardSelector = '.title-card';
    }
    async clickPlay(cardLocator) {
        if (cardLocator) {
            await cardLocator.locator('.play-button').click();
        } else {
            await this.adapter.click('.play-button');
        }
    }

    getTitleCards() {
        return this.page.locator(this.cardSelector);
    }

    getOverlay(cardLocator) {
        return new OverlayComponent(cardLocator);
    }
}
module.exports = BrowseSurface;
