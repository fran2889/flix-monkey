/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import type { SettingConfigField } from '../../../../src/core/config/index';
import {
    CONFIG_DEFAULTS,
    CONFIG_FIELDS,
    isActionField,
    isCompleteSettingsMap,
    isSettingField,
} from '../../../../src/core/config/index';

function findSettingField(key: string): SettingConfigField {
    const field = CONFIG_FIELDS.find(f => f.key === key);
    if (!field || !isSettingField(field)) throw new Error(`Missing setting field: ${key}`);
    return field;
}

describe('core/config-fields', () => {
    describe('CONFIG_DEFAULTS', () => {
        // Action fields carry no stored value. If they leaked into CONFIG_DEFAULTS,
        // ConfigManager.get would accept them as keys and stringify the missing value.
        it('excludes action fields', () => {
            const actionKeys = CONFIG_FIELDS.filter(isActionField).map(f => f.key);
            expect(actionKeys.length).toBeGreaterThan(0);
            expect(actionKeys.every(key => !(key in CONFIG_DEFAULTS))).toBe(true);
        });

        it('holds a concrete value for every settings key', () => {
            const settingKeys = CONFIG_FIELDS.filter(isSettingField).map(f => f.key);
            expect(Object.keys(CONFIG_DEFAULTS).sort()).toEqual([...settingKeys].sort());
            for (const value of Object.values(CONFIG_DEFAULTS)) {
                expect(['string', 'boolean']).toContain(typeof value);
            }
        });
    });

    describe('isCompleteSettingsMap', () => {
        it('accepts the built defaults and rejects a missing setting', () => {
            expect(isCompleteSettingsMap(CONFIG_DEFAULTS)).toBe(true);

            const { debug: _debug, ...withoutDebug } = CONFIG_DEFAULTS;
            expect(isCompleteSettingsMap(withoutDebug)).toBe(false);
        });
    });

    describe('validate functions', () => {
        describe.each([
            ['xmdbApiKey', 'xmdb'],
            ['omdbApiKey', 'omdb'],
        ])('%s validation', (key, provider) => {
            let field: SettingConfigField;
            beforeEach(() => {
                field = findSettingField(key);
            });

            it('accepts a valid key when the provider is selected', () => {
                expect(field.validate!('valid-key', { apiClient: provider })).toBeUndefined();
            });

            it('rejects an empty key when the provider is selected', () => {
                expect(typeof field.validate?.('', { apiClient: provider })).toBe('string');
            });

            it('rejects a missing key when the provider is selected', () => {
                expect(typeof field.validate?.(undefined, { apiClient: provider })).toBe('string');
            });

            it('accepts an empty key when the provider is not selected', () => {
                expect(field.validate!('', { apiClient: 'agregarr' })).toBeUndefined();
            });
        });

        describe('fadeRatingThreshold validation', () => {
            let field: SettingConfigField;
            beforeEach(() => {
                field = findSettingField('fadeRatingThreshold');
            });

            it.each(['5.0', '10.0', '0.0'])('accepts the valid threshold %s', val => {
                expect(field.validate!(val)).toBeUndefined();
            });

            it.each(['-1.0', '11.0', 'not-a-number'])('rejects the invalid threshold %s', val => {
                expect(typeof field.validate?.(val)).toBe('string');
                expect(field.validate?.(val)).toBe('Fade threshold must be a number between 0 and 10');
            });
        });

        describe.each(['cacheTtlRatedOldYear', 'cacheTtlRatedNewYear', 'cacheTtlNoRating'])('%s validation', key => {
            let field: SettingConfigField;
            beforeEach(() => {
                field = findSettingField(key);
            });

            it.each(['0', '30', '-1'])('accepts the valid TTL value %s', val => {
                expect(field.validate!(val)).toBeUndefined();
            });

            it.each(['-2', 'not-a-number', '5.5', ' '])('rejects the invalid TTL value %s', val => {
                expect(typeof field.validate?.(val)).toBe('string');
                expect(field.validate?.(val)).toBe('Cache duration must be -1 or a positive integer');
            });
        });
    });

    it('does not contain duplicate keys', () => {
        const keys = CONFIG_FIELDS.map(f => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });
});
