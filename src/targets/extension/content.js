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
import browser from 'webextension-polyfill';
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { startApp } from '../../core/app.js';

/*
 * Settings that can be hot-applied without a page reload: they only affect overlay
 * appearance, so calling redecorate() (clear + re-render) is sufficient to reflect the
 * change immediately. All other storage changes still update the snapshot (so configGet
 * stays accurate), but functional settings — apiClient, cacheTtl*, debug — require a
 * page reload because they affect stateful objects (ApiClientManager, CacheManager,
 * logger) that are not reinitialized by redecorate(). The options page handles this by
 * reloading all open Netflix tabs on save.
 */
const VISUAL_SETTINGS = new Set([
    'overlayCorner',
    'showRtRating',
    'showMcRating',
    'enableFadeUnderRating',
    'fadeRatingThreshold',
]);

(async () => {
    const adapter = new WebExtensionAdapter();
    const stored = await browser.storage.local.get(null);
    adapter.setConfigData(stored);

    /*
     * Register storage listener BEFORE starting the app to ensure any configuration changes
     * are reflected in the 'stored' object which the adapter uses for synchronous reads.
     * The ref wrapper avoids a temporal dead zone: the listener closure captures the object,
     * and app is assigned into it synchronously before any storage events can fire.
     */
    const appRef = { app: null };

    browser.storage.onChanged.addListener(changes => {
        Object.entries(changes).forEach(([k, v]) => {
            stored[k] = v.newValue;
        });
        if (Object.keys(changes).some(k => VISUAL_SETTINGS.has(k))) {
            appRef.app?.redecorate();
        }
    });

    appRef.app = startApp(adapter);
})();
