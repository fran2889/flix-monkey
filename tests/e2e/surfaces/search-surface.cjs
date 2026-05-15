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

class SearchSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async searchFor(query) {
        const url = `https://www.netflix.com/search?q=${encodeURIComponent(query)}`;
        await this.adapter.navigate(url);
        await this.page.waitForSelector('[data-uia="search-gallery-video-card"]', { timeout: 10000 });
    }

    async getResults() {
        return this.page.locator('[data-uia="search-gallery-video-card"]');
    }

    getOverlay(cardLocator) {
        return new OverlayComponent(this.page, cardLocator);
    }
}
module.exports = SearchSurface;
