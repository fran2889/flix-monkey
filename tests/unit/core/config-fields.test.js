/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CONFIG_FIELDS, GROUPS, ROW_LABELS } from '../../../src/core/config-fields.js';

describe('core/config-fields', () => {
    it('enables Disney+ by default', () => {
        expect(CONFIG_FIELDS.find(field => field.key === 'enableDisneyPlus')).toMatchObject({
            label: 'Disney+',
            type: 'checkbox',
            default: true,
            row: 'services',
        });
    });

    describe('field structures', () => {
        it.each(CONFIG_FIELDS)('should have a valid structure for field "$key"', field => {
            expect(field).toHaveProperty('key');
            expect(field).toHaveProperty('label');
            expect(field).toHaveProperty('type');
            expect(field).toHaveProperty('default');

            if (field.type === 'select') {
                expect(field).toHaveProperty('options');
                expect(Array.isArray(field.options)).toBe(true);

                field.options.forEach(option => {
                    const isValidString = typeof option === 'string';
                    const isValidArray =
                        Array.isArray(option) &&
                        option.length === 2 &&
                        typeof option[0] === 'string' &&
                        typeof option[1] === 'string';

                    expect(
                        isValidString || isValidArray,
                        `Field "${field.key}" has invalid option format: ${JSON.stringify(option)}. ` +
                            `Options must be strings or [value, label] arrays.`
                    ).toBe(true);
                });
            }
        });
    });

    describe('validate functions', () => {
        describe.each([
            ['xmdbApiKey', 'xmdb'],
            ['omdbApiKey', 'omdb'],
        ])('%s validation', (key, provider) => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key);
            });

            it('should accept valid key when provider is selected', () => {
                expect(field.validate('valid-key', { apiClient: provider })).toBeNull();
            });

            it('should reject empty key when provider is selected', () => {
                expect(typeof field.validate('', { apiClient: provider })).toBe('string');
            });

            it('should accept empty key when provider is not selected', () => {
                expect(field.validate('', { apiClient: 'agregarr' })).toBeNull();
            });
        });

        describe('fadeRatingThreshold validation', () => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === 'fadeRatingThreshold');
            });

            it.each(['5.0', '10.0', '0.0'])('should accept valid threshold %s', val => {
                expect(field.validate(val)).toBeNull();
            });

            it.each(['-1.0', '11.0', 'not-a-number'])('should reject invalid threshold %s', val => {
                expect(typeof field.validate(val)).toBe('string');
                expect(field.validate(val)).toBe('Fade threshold must be a number between 0 and 10');
            });
        });

        describe.each(['cacheTtlRatedOldYear', 'cacheTtlRatedNewYear', 'cacheTtlNoRating'])('%s validation', key => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key);
            });

            it.each(['0', '30', '-1'])('should accept valid TTL value %s', val => {
                expect(field.validate(val)).toBeNull();
            });

            it.each(['-2', 'not-a-number', '5.5', ' '])('should reject invalid TTL value %s', val => {
                expect(typeof field.validate(val)).toBe('string');
                expect(field.validate(val)).toBe('Cache duration must be -1 or a positive integer');
            });
        });
    });

    it('should not have duplicate keys', () => {
        const keys = CONFIG_FIELDS.map(f => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    describe('field defaults alignment with types', () => {
        it.each(CONFIG_FIELDS)('should have default value matching type for field "$key"', field => {
            if (field.type === 'checkbox') {
                expect(typeof field.default).toBe('boolean');
            } else if (field.type === 'text' || field.type === 'select') {
                expect(typeof field.default).toBe('string');
            }
        });
    });

    describe('UI metadata exports', () => {
        it('should export GROUPS with all required groups', () => {
            expect(GROUPS).toHaveProperty('services');
            expect(GROUPS).toHaveProperty('display');
            expect(GROUPS).toHaveProperty('providers');
            expect(GROUPS).toHaveProperty('fade');
            expect(GROUPS).toHaveProperty('cache');
            expect(GROUPS).toHaveProperty('debug');
        });

        it('should have correct group structure', () => {
            Object.entries(GROUPS).forEach(([, value]) => {
                expect(value).toHaveProperty('label');
                expect(value).toHaveProperty('icon');
                expect(typeof value.label).toBe('string');
                expect(typeof value.icon).toBe('string');
            });
        });

        it('should export ROW_LABELS with services and ratings-display', () => {
            expect(ROW_LABELS.services).toBe('Show on');
            expect(ROW_LABELS['ratings-display']).toBe('Show');
        });

        it('should have cache fields with suffix property', () => {
            const cacheFields = CONFIG_FIELDS.filter(f => f.group === 'cache' && f.type === 'text');
            expect(cacheFields.length).toBeGreaterThan(0);
            cacheFields.forEach(field => {
                expect(field).toHaveProperty('suffix');
                expect(field.suffix).toBe('days');
            });
        });

        it('should have showImdbRating field with disabled property', () => {
            const imdbField = CONFIG_FIELDS.find(f => f.key === 'showImdbRating');
            expect(imdbField).toBeDefined();
            expect(imdbField.disabled).toBe(true);
        });

        it('should have action fields for clearCache and resetClients', () => {
            const clearCacheField = CONFIG_FIELDS.find(f => f.key === 'clearCache');
            const resetClientsField = CONFIG_FIELDS.find(f => f.key === 'resetClients');

            expect(clearCacheField).toBeDefined();
            expect(clearCacheField.type).toBe('action');
            expect(clearCacheField.group).toBe('debug');
            expect(clearCacheField.actionLabel).toBe('Clear Cache');

            expect(resetClientsField).toBeDefined();
            expect(resetClientsField.type).toBe('action');
            expect(resetClientsField.group).toBe('debug');
            expect(resetClientsField.actionLabel).toBe('Reset Providers');
        });

        it('should have all fields with group property', () => {
            CONFIG_FIELDS.forEach(field => {
                if (field.type !== 'action') {
                    expect(field).toHaveProperty('group');
                    expect(typeof field.group).toBe('string');
                    expect(Object.keys(GROUPS)).toContain(field.group);
                }
            });
        });
    });
});
