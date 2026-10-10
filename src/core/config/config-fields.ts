/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE } from '../constants';

function validateCacheTtl(val: string): string | null {
    if (typeof val === 'string' && val.trim() === '') return 'Cache duration must be -1 or a positive integer';
    const n = Number(val);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Cache duration must be -1 or a positive integer';
}

/** Settings field groups for UI organization. */
export const GROUPS = {
    services: { label: 'Streaming Services', icon: '📺' },
    display: { label: 'Display Settings', icon: '🎨' },
    providers: { label: 'Rating Providers', icon: '📊' },
    fade: { label: 'Fade Settings', icon: '🌑' },
    cache: { label: 'Cache Settings', icon: '💾' },
    debug: { label: 'Debug', icon: '🐛' },
} as const;

/** Row label configurations for settings UI. */
export const ROW_LABELS = {
    services: { label: 'Show on', title: 'Enable ratings on these streaming services' },
    'ratings-display': { label: 'Show', title: 'Show these ratings on thumbnails' },
} as const;

export type GroupKey = keyof typeof GROUPS;
export type RowLabelKey = keyof typeof ROW_LABELS;

/** All configurable field definitions. */
export const CONFIG_FIELDS = [
    {
        key: 'enableNetflix',
        label: 'Netflix',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'enableHboMax',
        label: 'HBO Max',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'enableDisneyPlus',
        label: 'Disney+',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'overlayCorner',
        label: 'Badge Position',
        group: 'display',
        type: 'select',
        options: [
            ['top-left', 'Top Left'] as const,
            ['top-right', 'Top Right'] as const,
            ['bottom-left', 'Bottom Left'] as const,
            ['bottom-right', 'Bottom Right'] as const,
        ],
        default: 'top-left',
        title: 'Position of the rating badge on thumbnails',
    },
    {
        key: 'showImdbRating',
        label: 'IMDb',
        group: 'display',
        type: 'checkbox',
        default: true,
        row: 'ratings-display',
        disabled: true,
    },
    {
        key: 'apiClient',
        label: 'Rating Provider',
        group: 'providers',
        type: 'select',
        options: [['agregarr', 'Agregarr'] as const, ['omdb', 'OMDb'] as const, ['xmdb', 'XMDb'] as const],
        default: 'agregarr',
        title: 'Active rating provider. Agregarr requires no API key',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDb API Key',
        group: 'providers',
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text',
        default: '',
        title: 'Required for OMDb ratings',
        validate: (val: string, allValues?: Record<string, unknown>): string | null => {
            if (allValues?.apiClient !== 'omdb') return null;
            return val && val.length > 0 ? null : 'OMDb API Key is required';
        },
    },
    {
        key: 'xmdbApiKey',
        label: 'XMDb API Key',
        group: 'providers',
        labelUrl: 'https://xmdbapi.com/api-key',
        type: 'text',
        default: '',
        title: 'Required for XMDb ratings',
        validate: (val: string, allValues?: Record<string, unknown>): string | null => {
            if (allValues?.apiClient !== 'xmdb') return null;
            return val && val.length > 0 ? null : 'XMDb API Key is required';
        },
    },
    {
        key: 'showMcRating',
        label: 'Metacritic',
        group: 'display',
        type: 'checkbox',
        default: false,
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Rotten Tomatoes',
        group: 'display',
        type: 'checkbox',
        default: false,
        row: 'ratings-display',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade below rating',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Fade thumbnails with IMDb rating below the threshold',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Threshold',
        group: 'fade',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating threshold (0.0-10.0)',
        short: true,
        validate: (val: string): string | null => {
            if (typeof val === 'string' && val.trim() === '') return 'Fade threshold must be a number between 0 and 10';
            const n = Number(val);
            return !Number.isNaN(n) && n >= 0.0 && n <= 10.0
                ? null
                : 'Fade threshold must be a number between 0 and 10';
        },
    },
    {
        key: 'enableFadeToggle',
        label: 'Allow override',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Enable manual title fade toggle',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Older Titles',
        group: 'cache',
        type: 'text',
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration for titles released over a year ago. -1 = forever',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Recent Titles',
        group: 'cache',
        type: 'text',
        default: '30',
        title: 'Cache duration for titles released within the last year',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlNoRating',
        label: 'No Rating',
        group: 'cache',
        type: 'text',
        default: '1',
        title: 'Cache duration for titles without a rating',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'debug',
        label: 'Debug logging',
        group: 'debug',
        type: 'checkbox',
        default: true,
        title: 'Show detailed logs in browser console',
        row: 'debug-settings',
    },
    {
        key: 'clearCache',
        type: 'action',
        group: 'debug',
        row: 'action-clearCache',
        label: '',
        actionLabel: 'Clear Cache',
        default: null,
    },
    {
        key: 'resetClients',
        type: 'action',
        group: 'debug',
        row: 'action-resetClients',
        label: '',
        actionLabel: 'Reset Providers',
        default: null,
    },
] satisfies readonly ConfigField[];

/** Default values for all config fields. */
export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default])) as Record<
    ConfigFieldKey,
    string | boolean
>;

/** Allowed values for select-type config fields. */
export const CONFIG_SELECT_ALLOWED = Object.fromEntries(
    CONFIG_FIELDS.filter(f => f.type === 'select').map(f => [f.key, f.options.map(o => (Array.isArray(o) ? o[0] : o))])
) as Record<ConfigFieldKey, string[]>;

// Type for row label keys - includes all possible row values used in config
export type AllRowKeys = RowLabelKey | 'debug-settings' | 'action-clearCache' | 'action-resetClients';

// Type for a single config field
export interface ConfigField {
    key: string;
    label: string;
    group: GroupKey;
    type: ConfigFieldType;
    default: ConfigValueType;
    row?: AllRowKeys;
    title?: string;
    short?: boolean;
    disabled?: boolean;
    labelUrl?: string;
    suffix?: string;
    actionLabel?: string;
    options?: readonly (string | readonly [string, string])[];
    validate?: (_val: string, _allValues?: Record<string, unknown>) => string | null;
}

// Type for config field keys
export type ConfigFieldKey = (typeof CONFIG_FIELDS)[number]['key'];

// Type for config field types
export type ConfigFieldType = 'checkbox' | 'select' | 'text' | 'action';

// Type for config values based on their field type
export type ConfigValueType = string | boolean | null;
