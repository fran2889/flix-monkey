/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '../../../../src/core/cache.js';
import { CONFIG_FIELDS } from '../../../../src/core/config-fields.js';
import { ConfigManager } from '../../../../src/core/config-manager.js';
import { DisabledClientsManager } from '../../../../src/core/disabled-clients.js';
import { Logger } from '../../../../src/core/logger.js';
import { SettingsUI } from '../../../../src/core/ui/settings-ui.js';
import { createMockAdapter } from '../../../mocks/adapter.js';

describe('SettingsUI', () => {
    let mockAdapter;
    let settingsUI;
    let container;
    let mockCacheManager;
    let mockDisabledClientsManager;

    beforeEach(() => {
        mockAdapter = createMockAdapter();
        mockCacheManager = new CacheManager(mockAdapter, new ConfigManager(mockAdapter), new Logger(mockAdapter));
        mockDisabledClientsManager = new DisabledClientsManager(mockAdapter);
        vi.spyOn(mockCacheManager, 'clear').mockResolvedValue();
        vi.spyOn(mockDisabledClientsManager, 'resetAll').mockResolvedValue([]);
        settingsUI = new SettingsUI(mockAdapter, mockCacheManager, mockDisabledClientsManager);
        container = document.createElement('div');
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    describe('Action button wiring', () => {
        it('routes the clear-cache button to cache clearing', async () => {
            await settingsUI.render(container);

            container.querySelector('#fm-clearCacheBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockCacheManager.clear).toHaveBeenCalledOnce();
            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(mockDisabledClientsManager.resetAll).not.toHaveBeenCalled();
        });

        it('routes the reset-providers button to disabled-client reset', async () => {
            await settingsUI.render(container);

            container.querySelector('#fm-resetClientsBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockDisabledClientsManager.resetAll).toHaveBeenCalledOnce();
            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(mockCacheManager.clear).not.toHaveBeenCalled();
        });
    });

    describe('Save', () => {
        it('calls storageSetMany with all field values', async () => {
            await settingsUI.render(container);

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
            const saved = mockAdapter.storageSetMany.mock.calls[0][0];
            CONFIG_FIELDS.forEach(field => {
                expect(Object.hasOwn(saved, field.key)).toBe(true);
            });
        });

        it('persists updated input values', async () => {
            await settingsUI.render(container);
            container.querySelector('[id="fm-xmdbApiKey"]').value = 'new-api-key';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledWith(
                expect.objectContaining({ xmdbApiKey: 'new-api-key' })
            );
        });

        it('persists the same value snapshot that was validated', async () => {
            const field = {
                key: 'snapshot',
                label: 'Snapshot',
                type: 'text',
                default: 'initial',
                validate: value => {
                    container.querySelector('#fm-snapshot').value = 'changed-during-validation';
                    return value === 'initial' ? null : 'Unexpected value';
                },
            };
            settingsUI = new SettingsUI(mockAdapter, mockCacheManager, mockDisabledClientsManager, [field]);
            await settingsUI.render(container);

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledWith({ snapshot: 'initial' });
        });

        it('does not show a success message after saving', async () => {
            await settingsUI.render(container);

            await settingsUI.save();

            expect(container.querySelector('#fm-status').textContent).toBe('');
        });

        it('saves settings without managing save button state', async () => {
            let resolveStorage;
            mockAdapter.storageSetMany = vi.fn().mockReturnValue(
                new Promise(resolve => {
                    resolveStorage = resolve;
                })
            );
            await settingsUI.render(container);

            const savePromise = settingsUI.save();

            resolveStorage();
            await savePromise;
            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
        });

        it('shows joined validation errors and does not persist invalid values', async () => {
            await settingsUI.render(container);
            container.querySelector('#fm-fadeRatingThreshold').value = 'abc';
            container.querySelector('#fm-cacheTtlRatedOldYear').value = 'invalid';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(container.querySelector('#fm-status').textContent).toBe(
                'Fade threshold must be a number between 0 and 10\n' + 'Cache duration must be -1 or a positive integer'
            );
            expect(container.querySelector('#fm-status').className).toBe('fm-status--error');
        });
    });

    describe('Autosave integration', () => {
        it('saves settings without external callback', async () => {
            await settingsUI.render(container);

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
        });

        it('does not persist invalid values during autosave flow', async () => {
            await settingsUI.render(container);
            container.querySelector('[id="fm-apiClient"]').value = 'xmdb';
            container.querySelector('[id="fm-xmdbApiKey"]').value = '';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(container.querySelector('#fm-status').textContent).toBe('XMDb API Key is required');
        });

        it('handles storage errors during save', async () => {
            mockAdapter.storageSetMany.mockRejectedValue(new Error('storage error'));
            await settingsUI.render(container);

            await expect(settingsUI.save()).rejects.toThrow('storage error');

            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
        });
    });

    describe('Cache clearing', () => {
        it('clears the cache and shows the success message', async () => {
            await settingsUI.render(container);

            await settingsUI.clearCache();

            expect(mockCacheManager.clear).toHaveBeenCalledOnce();
            expect(container.querySelector('#fm-status').textContent).toBe('Cache cleared.');
            expect(container.querySelector('#fm-status').className).toBe('fm-status--success');
        });

        it('shows an error when clearing fails', async () => {
            mockCacheManager.clear.mockRejectedValue(new Error('disk full'));
            await settingsUI.render(container);

            await settingsUI.clearCache();

            expect(container.querySelector('#fm-status').textContent).toBe('Error: disk full');
            expect(container.querySelector('#fm-status').className).toBe('fm-status--error');
        });
    });

    describe('Disabled provider reset', () => {
        it('resets clients and shows re-enabled names', async () => {
            mockDisabledClientsManager.resetAll.mockResolvedValue(['omdb', 'tmdb']);
            await settingsUI.render(container);

            await settingsUI.resetClients();

            expect(mockDisabledClientsManager.resetAll).toHaveBeenCalledOnce();
            expect(container.querySelector('#fm-status').textContent).toBe('Re-enabled API clients: omdb, tmdb');
            expect(container.querySelector('#fm-status').className).toBe('fm-status--success');
        });

        it('shows the no-clients message when there is nothing to reset', async () => {
            await settingsUI.render(container);

            await settingsUI.resetClients();

            expect(container.querySelector('#fm-status').textContent).toBe(
                'No disabled API clients found to re-enable.'
            );
            expect(container.querySelector('#fm-status').className).toBe('fm-status--success');
        });

        it('shows an error when reset fails', async () => {
            mockDisabledClientsManager.resetAll.mockRejectedValue(new Error('storage unavailable'));
            await settingsUI.render(container);

            await settingsUI.resetClients();

            expect(container.querySelector('#fm-status').textContent).toBe('Error: storage unavailable');
            expect(container.querySelector('#fm-status').className).toBe('fm-status--error');
        });
    });
});
