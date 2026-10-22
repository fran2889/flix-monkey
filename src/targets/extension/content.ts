/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { startApp } from '../../core/app';
import type { StorageValue } from '../../platform/adapter';
import { WebExtensionAdapter } from '../../platform/webextension';

/*
 * Settings that can be hot-applied without a page reload: they only affect overlay
 * appearance, so calling redecorate() (clear + re-render) is sufficient to reflect the
 * change immediately. All other storage changes still update the snapshot (so configGet
 * stays accurate) but do not trigger redecorate(). A provider change (apiClient) needs a
 * page reload because ApiClientManager is constructed at startup; cacheTtl* and debug
 * are read on demand and need no re-render.
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

/* NOSONAR: MV3 content scripts are classic IIFE bundles, so top-level await is unavailable. */ void (async (): Promise<void> => {
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
    const appRef = { app: undefined as ReturnType<typeof startApp> };

    browser.storage.onChanged.addListener((changes: Record<string, { newValue?: unknown }>, _areaName: string) => {
        Object.entries(changes).forEach(([k, v]) => {
            if (v.newValue !== undefined) {
                stored[k] = v.newValue as StorageValue;
            }
        });
        if (Object.keys(changes).some(k => VISUAL_SETTINGS.has(k))) {
            appRef.app?.redecorate();
        }
    });

    appRef.app = startApp(adapter);
})().catch((error: unknown) => {
    console.error('FlixMonkey content script failed to start', error);
});
