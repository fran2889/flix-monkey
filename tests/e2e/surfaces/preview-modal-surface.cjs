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

class PreviewModalSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async open(cardLocator) {
        const moreInfoButton = cardLocator.locator('[data-uia="play-button"] + button, .play-button + button');
        if (await moreInfoButton.isVisible()) {
            await moreInfoButton.click();
        } else {
            await cardLocator.click();
        }
        const previewModal = this.page.locator('.previewModal');
        await previewModal.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.locator('.previewModal--player-titleTreatmentWrapper').waitFor({ state: 'attached' });
    }

    getOverlay() {
        return new OverlayComponent(this.page.locator('.previewModal'));
    }
}

module.exports = PreviewModalSurface;
