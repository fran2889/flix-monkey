/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import type { ConfigField } from '../../../../src/core/config/index';
// eslint-disable-next-line no-duplicate-imports
import { CONFIG_DEFAULTS, CONFIG_FIELDS, GROUPS, ROW_LABELS } from '../../../../src/core/config/index';

describe('core/config-fields', () => {
    describe('CONFIG_DEFAULTS', () => {
        // Action fields carry no stored value. If they leaked into CONFIG_DEFAULTS,
        // ConfigManager.get would accept them as keys and stringify the missing value.
        it('should exclude action fields', () => {
            const actionKeys = CONFIG_FIELDS.filter(f => f.type === 'action').map(f => f.key);
            expect(actionKeys.length).toBeGreaterThan(0);
            expect(actionKeys.every(key => !(key in CONFIG_DEFAULTS))).toBe(true);
        });

        it('should hold a concrete value for every settings key', () => {
            const settingKeys = CONFIG_FIELDS.filter(f => f.type !== 'action').map(f => f.key);
            expect(Object.keys(CONFIG_DEFAULTS).sort()).toEqual([...settingKeys].sort());
            for (const value of Object.values(CONFIG_DEFAULTS)) {
                expect(['string', 'boolean']).toContain(typeof value);
            }
            expect(CONFIG_DEFAULTS.debug).toBe(true);
        });
    });

    describe('field structures', () => {
        it.each(CONFIG_FIELDS)('should have a valid structure for field "$key"', (field: ConfigField) => {
            expect(field).toHaveProperty('key');
            expect(field).toHaveProperty('label');
            expect(field).toHaveProperty('type');
            if (field.type === 'action') {
                // Action rows trigger handlers and never render a value, so they carry no default.
                expect(field).toHaveProperty('actionLabel');
            } else {
                expect(field).toHaveProperty('default');
            }

            expect(field).toHaveProperty('group');
            expect(typeof field.group).toBe('string');
            expect(Object.keys(GROUPS)).toContain(field.group);

            if (field.type === 'select') {
                expect(field).toHaveProperty('options');
                expect(Array.isArray(field.options)).toBe(true);

                // Handle readonly options by casting
                (field.options as Array<string | [string, string]>).forEach((option: string | [string, string]) => {
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
            let field: ConfigField;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key) as ConfigField;
            });

            it('should accept valid key when provider is selected', () => {
                expect(field.validate!('valid-key', { apiClient: provider })).toBeUndefined();
            });

            it('should reject empty key when provider is selected', () => {
                expect(typeof field.validate?.('', { apiClient: provider })).toBe('string');
            });

            it('should accept empty key when provider is not selected', () => {
                expect(field.validate!('', { apiClient: 'agregarr' })).toBeUndefined();
            });
        });

        describe('fadeRatingThreshold validation', () => {
            let field: ConfigField;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === 'fadeRatingThreshold') as ConfigField;
            });

            it.each(['5.0', '10.0', '0.0'])('should accept valid threshold %s', val => {
                expect(field.validate!(val)).toBeUndefined();
            });

            it.each(['-1.0', '11.0', 'not-a-number'])('should reject invalid threshold %s', val => {
                expect(typeof field.validate?.(val)).toBe('string');
                expect(field.validate?.(val)).toBe('Fade threshold must be a number between 0 and 10');
            });
        });

        describe.each(['cacheTtlRatedOldYear', 'cacheTtlRatedNewYear', 'cacheTtlNoRating'])('%s validation', key => {
            let field: ConfigField;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key) as ConfigField;
            });

            it.each(['0', '30', '-1'])('should accept valid TTL value %s', val => {
                expect(field.validate!(val)).toBeUndefined();
            });

            it.each(['-2', 'not-a-number', '5.5', ' '])('should reject invalid TTL value %s', val => {
                expect(typeof field.validate?.(val)).toBe('string');
                expect(field.validate?.(val)).toBe('Cache duration must be -1 or a positive integer');
            });
        });
    });

    it('should not have duplicate keys', () => {
        const keys = CONFIG_FIELDS.map(f => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    describe('field defaults alignment with types', () => {
        it.each(CONFIG_FIELDS)('should have default value matching type for field "$key"', (field: ConfigField) => {
            if (field.type === 'checkbox') {
                expect(typeof field.default).toBe('boolean');
            } else if (field.type === 'text' || field.type === 'select') {
                expect(typeof field.default).toBe('string');
            }
        });
    });

    describe('settings metadata', () => {
        it('should have GROUPS with consistent structure', () => {
            Object.entries(GROUPS).forEach(([, value]) => {
                expect(value).toHaveProperty('label');
                expect(value).toHaveProperty('icon');
                expect(typeof value.label).toBe('string');
                expect(typeof value.icon).toBe('string');
            });
        });

        it('should have ROW_LABELS with label and optional title properties', () => {
            Object.entries(ROW_LABELS).forEach(([, value]) => {
                expect(value).toHaveProperty('label');
                expect(typeof value.label).toBe('string');
                if (value.title !== undefined) {
                    expect(typeof value.title).toBe('string');
                }
            });
        });
    });
});
