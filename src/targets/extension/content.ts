/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
// webextension-polyfill has no types, we cast it below
import browser from 'webextension-polyfill';

import { startApp } from '../../core/app.js';
import type { StorageValue } from '../../platform/adapter.js';
import { WebExtensionAdapter } from '../../platform/webextension.js';

/*
 * Settings that can be hot-applied without a page reload: they only affect overlay
 * appearance, so calling redecorate() (clear + re-render) is sufficient to reflect the
 * change immediately. All other storage changes still update the snapshot (so configGet
 * stays accurate), but functional settings - apiClient, cacheTtl*, debug - require a
 * page reload because they affect stateful objects (ApiClientManager, CacheManager,
 * logger) that are not reinitialized by redecorate(). The options page handles this by
 * reloading all open Netflix tabs on save.
 */
const VISUAL_SETTINGS = new Set<string>([
    'overlayCorner',
    'showRtRating',
    'showMcRating',
    'enableFadeUnderRating',
    'fadeRatingThreshold',
]);

/**
 * Type for migration response from background script.
 */
interface MigrationResponse {
    error?: string;
}

/* NOSONAR: MV3 content scripts are classic IIFE bundles, so top-level await is unavailable. */ (async () => {
    const migrationResponse: MigrationResponse = await browser.runtime.sendMessage({ type: 'FM_RUN_MIGRATIONS' });
    if (migrationResponse?.error) {
        throw new Error(migrationResponse.error);
    }

    const adapter = new WebExtensionAdapter();
    const stored: Record<string, StorageValue> = (await browser.storage.local.get(null)) as Record<
        string,
        StorageValue
    >;
    adapter.setConfigData(stored);

    /*
     * Register storage listener BEFORE starting the app to ensure any configuration changes
     * are reflected in the 'stored' object which the adapter uses for synchronous reads.
     * The ref wrapper avoids a temporal dead zone: the listener closure captures the object,
     * and app is assigned into it synchronously before any storage events can fire.
     */
    const appRef = { app: null as ReturnType<typeof startApp> };

    browser.storage.onChanged.addListener(((changes: Record<string, { newValue: unknown }>, _areaName: string) => {
        Object.entries(changes).forEach(([k, v]) => {
            stored[k] = v.newValue as StorageValue;
        });
        if (Object.keys(changes).some(k => VISUAL_SETTINGS.has(k))) {
            appRef.app?.redecorate();
        }
    }) as Parameters<typeof browser.storage.onChanged.addListener>[0]);

    appRef.app = startApp(adapter);
})();
