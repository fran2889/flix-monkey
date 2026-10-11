/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '../../../../src/core/cache/index';
import { CONFIG_FIELDS, ConfigManager } from '../../../../src/core/config/index';
import { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import { Logger } from '../../../../src/core/logger';
import { SettingsUI } from '../../../../src/core/ui/settings-ui';
import { buildMockAdapter, type MockPlatformAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

describe('SettingsUI', () => {
    let mockAdapter: MockPlatformAdapter;
    let settingsUI: SettingsUI;
    let container: HTMLDivElement;
    let mockCacheManager: CacheManager;
    let mockDisabledClientsManager: DisabledClientsManager;
    let mockLogger: Logger;

    beforeEach(() => {
        mockAdapter = buildMockAdapter().build();
        mockLogger = buildLogger().build();
        const config = new ConfigManager(mockAdapter, mockLogger);
        mockCacheManager = new CacheManager(mockAdapter, config, mockLogger);
        mockDisabledClientsManager = new DisabledClientsManager(mockAdapter);
        vi.spyOn(mockCacheManager, 'clear').mockResolvedValue();
        vi.spyOn(mockDisabledClientsManager, 'resetAll').mockResolvedValue([]);
        settingsUI = new SettingsUI(mockAdapter, mockLogger, mockCacheManager, mockDisabledClientsManager);
        container = document.createElement('div');
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    describe('Action button wiring', () => {
        it('routes the clear-cache button to cache clearing', async () => {
            await settingsUI.render(container);

            (container.querySelector('#fm-clearCache') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockCacheManager.clear).toHaveBeenCalledOnce();
            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(mockDisabledClientsManager.resetAll).not.toHaveBeenCalled();
        });

        it('routes the reset-providers button to disabled-client reset', async () => {
            await settingsUI.render(container);

            (container.querySelector('#fm-resetClients') as HTMLElement)?.click();
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
                if (field.type !== 'action' && !(field as { disabled?: boolean }).disabled) {
                    expect(Object.hasOwn(saved, field.key)).toBe(true);
                }
            });
        });

        it('persists updated input values', async () => {
            await settingsUI.render(container);
            const input = container.querySelector('[id="fm-xmdbApiKey"]') as HTMLInputElement;
            input.value = 'new-api-key';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledWith(
                expect.objectContaining({ xmdbApiKey: 'new-api-key' })
            );
        });

        it('persists the same value snapshot that was validated', async () => {
            const field = {
                key: 'snapshot',
                label: 'Snapshot',
                type: 'text' as const,
                default: 'initial',
                validate: (_value: unknown, _allValues?: Record<string, unknown>): string | null => {
                    container.querySelector('#fm-snapshot')?.setAttribute('value', 'changed-during-validation');
                    return null;
                },
            };
            settingsUI = new SettingsUI(mockAdapter, mockLogger, mockCacheManager, mockDisabledClientsManager, [field]);
            await settingsUI.render(container);

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledWith({ snapshot: 'initial' });
        });

        it('saves settings with async storage', async () => {
            let resolveStorage: () => void = () => {};
            mockAdapter.storageSetMany = vi.fn().mockReturnValue(
                new Promise<void>(resolve => {
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
            const fadeInput = container.querySelector('#fm-fadeRatingThreshold') as HTMLInputElement;
            fadeInput.value = 'abc';
            const cacheInput = container.querySelector('#fm-cacheTtlRatedOldYear') as HTMLInputElement;
            cacheInput.value = 'invalid';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(container.querySelector('#fm-status')?.textContent).toBe(
                'Fade threshold must be a number between 0 and 10\n' + 'Cache duration must be -1 or a positive integer'
            );
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--error');
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
            const apiClientInput = container.querySelector('[id="fm-apiClient"]') as HTMLSelectElement;
            apiClientInput.value = 'xmdb';
            const apiKeyInput = container.querySelector('[id="fm-xmdbApiKey"]') as HTMLInputElement;
            apiKeyInput.value = '';

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
            expect(container.querySelector('#fm-status')?.textContent).toBe('XMDb API Key is required');
        });

        it('handles storage errors during save', async () => {
            mockAdapter.storageSetMany = vi.fn().mockRejectedValue(new Error('storage error'));
            await settingsUI.render(container);

            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
            expect(mockLogger.error).toHaveBeenCalledWith('Settings save error:', expect.any(Error));
        });
    });

    describe('Cache clearing', () => {
        it('clears the cache and shows the success message', async () => {
            await settingsUI.render(container);

            (container.querySelector('#fm-clearCache') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockCacheManager.clear).toHaveBeenCalledOnce();
            expect(container.querySelector('#fm-status')?.textContent).toBe('Cache cleared.');
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--success');
        });

        it('shows an error when clearing fails', async () => {
            (mockCacheManager.clear as import('vitest').Mock).mockRejectedValue(new Error('disk full'));
            await settingsUI.render(container);

            (container.querySelector('#fm-clearCache') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(container.querySelector('#fm-status')?.textContent).toBe('Error: disk full');
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--error');
        });
    });

    describe('Collaborator wiring', () => {
        it('gives the cache manager a working config logger', async () => {
            mockAdapter.configGet = vi.fn(() => {
                throw new Error('config read failed');
            });

            await mockCacheManager.write('Some Title', buildTitle().withApiTitle('Some Title').build());

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'ConfigManager.get error, using fallback',
                expect.objectContaining({ key: 'cacheTtlNoRating' })
            );
        });
    });

    describe('Disabled provider reset', () => {
        it('resets clients and shows re-enabled names', async () => {
            (mockDisabledClientsManager.resetAll as import('vitest').Mock).mockResolvedValue(['omdb', 'tmdb']);
            await settingsUI.render(container);

            (container.querySelector('#fm-resetClients') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockDisabledClientsManager.resetAll).toHaveBeenCalledOnce();
            expect(container.querySelector('#fm-status')?.textContent).toBe('Re-enabled API clients: omdb, tmdb');
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--success');
        });

        it('shows the no-clients message when there is nothing to reset', async () => {
            await settingsUI.render(container);

            (container.querySelector('#fm-resetClients') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(container.querySelector('#fm-status')?.textContent).toBe(
                'No disabled API clients found to re-enable.'
            );
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--success');
        });

        it('shows an error when reset fails', async () => {
            (mockDisabledClientsManager.resetAll as import('vitest').Mock).mockRejectedValue(
                new Error('storage unavailable')
            );
            await settingsUI.render(container);

            (container.querySelector('#fm-resetClients') as HTMLElement)?.click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(container.querySelector('#fm-status')?.textContent).toBe('Error: storage unavailable');
            expect((container.querySelector('#fm-status') as HTMLElement)?.className).toBe('status status--error');
        });
    });
});
