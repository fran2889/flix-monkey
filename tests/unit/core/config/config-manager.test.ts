/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import type { ConfigKey } from '../../../../src/core/config/config-manager';
import { CONFIG_DEFAULTS, ConfigManager } from '../../../../src/core/config/index';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';

describe('ConfigManager', () => {
    describe('get', () => {
        it('returns the value from adapter.configGet', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning((key: ConfigKey) => (key === 'overlayCorner' ? 'bottom-right' : undefined))
                    .build(),
                buildLogger().build()
            );
            expect(config.get('overlayCorner')).toBe('bottom-right');
        });

        it('keeps falsy but valid values such as 0 and the empty string', () => {
            const values: Partial<Record<ConfigKey, string | number | boolean>> = {
                cacheTtlNoRating: 0,
                omdbApiKey: '',
            };
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning((key: ConfigKey) => (values[key] ?? undefined) as string | undefined)
                    .build(),
                buildLogger().build()
            );
            expect(config.get('cacheTtlNoRating')).toBe('0');
            expect(config.get('omdbApiKey')).toBe('');
        });

        it('keeps legacy string checkbox values as strings', () => {
            const values: Partial<Record<ConfigKey, string>> = {
                showRtRating: 'true',
                showMcRating: 'false',
            };
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning((key: ConfigKey) => (values[key] ?? undefined) as string | undefined)
                    .build(),
                buildLogger().build()
            );
            expect(config.get('showRtRating')).toBe('true');
            expect(config.get('showMcRating')).toBe('false');
        });

        it('returns the default when the adapter returns undefined', () => {
            const config = new ConfigManager(buildMockAdapter().build(), buildLogger().build());
            expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        });

        it('falls back to the default when configGet returns null', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => null)
                    .build(),
                buildLogger().build()
            );
            expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        });

        it('returns the default when a stored overlayCorner is not a select option', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 'invalid-corner')
                    .build(),
                buildLogger().build()
            );
            expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        });

        it('returns the default when a stored apiClient is not a select option', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 'unknown-provider')
                    .build(),
                buildLogger().build()
            );
            expect(config.get('apiClient')).toBe(CONFIG_DEFAULTS.apiClient);
        });

        it('falls back to the default and warns when configGet throws', () => {
            const mockLogger = buildLogger().build();
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => {
                        throw new Error('Adapter error');
                    })
                    .build(),
                mockLogger
            );
            expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'ConfigManager.get error, using fallback',
                expect.objectContaining({ key: 'overlayCorner' })
            );
        });

        it('throws for an unknown key', () => {
            const config = new ConfigManager(buildMockAdapter().build(), buildLogger().build());
            expect(() => config.get('nonExistentKey' as ConfigKey)).toThrow(
                'ConfigManager: unknown config key "nonExistentKey"'
            );
        });

        it.each(Object.entries(CONFIG_DEFAULTS) as [ConfigKey, string | boolean][])(
            'returns the default for the key "%s"',
            (key, expectedValue) => {
                const config = new ConfigManager(buildMockAdapter().build(), buildLogger().build());
                expect(config.get(key as ConfigKey)).toBe(String(expectedValue));
            }
        );
    });

    describe('getInt', () => {
        it('parses an integer with getInt', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => '42')
                    .build(),
                buildLogger().build()
            );
            expect(config.getInt('cacheTtlNoRating')).toBe(42);
        });

        it('parses a numeric value that is not a string', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 42)
                    .build(),
                buildLogger().build()
            );
            expect(config.getInt('cacheTtlNoRating')).toBe(42);
        });

        it('parses a stored 0', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 0)
                    .build(),
                buildLogger().build()
            );
            expect(config.getInt('cacheTtlNoRating')).toBe(0);
        });

        it('falls back to the default for an invalid integer', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 'not-a-number')
                    .build(),
                buildLogger().build()
            );
            expect(config.getInt('cacheTtlNoRating')).toBe(
                Number.parseInt(String(CONFIG_DEFAULTS.cacheTtlNoRating), 10)
            );
        });
    });

    describe('getFloat', () => {
        it('parses a float with getFloat', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => '3.14')
                    .build(),
                buildLogger().build()
            );
            expect(config.getFloat('fadeRatingThreshold')).toBe(3.14);
        });

        it('parses a numeric float that is not a string', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 1.5)
                    .build(),
                buildLogger().build()
            );
            expect(config.getFloat('fadeRatingThreshold')).toBe(1.5);
        });

        it('parses a stored float 0', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 0)
                    .build(),
                buildLogger().build()
            );
            expect(config.getFloat('cacheTtlNoRating')).toBe(0);
        });

        it('falls back to the default for an invalid float', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => 'not-a-number')
                    .build(),
                buildLogger().build()
            );
            expect(config.getFloat('fadeRatingThreshold')).toBe(
                Number.parseFloat(String(CONFIG_DEFAULTS.fadeRatingThreshold))
            );
        });
    });

    describe('getBool', () => {
        it.each([
            { description: 'boolean true', stored: true, expected: true },
            { description: 'boolean false', stored: false, expected: false },
            { description: 'string "true"', stored: 'true', expected: true },
            { description: 'string "false"', stored: 'false', expected: false },
        ])('maps $description to $expected', ({ stored, expected }) => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => stored)
                    .build(),
                buildLogger().build()
            );
            expect(config.getBool('showRtRating')).toBe(expected);
        });

        it('uses the default for getBool when the adapter returns null', () => {
            const config = new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(() => null)
                    .build(),
                buildLogger().build()
            );
            expect(config.getBool('showRtRating')).toBe(CONFIG_DEFAULTS.showRtRating);
            expect(config.getBool('enableFadeUnderRating')).toBe(CONFIG_DEFAULTS.enableFadeUnderRating);
        });
    });
});
