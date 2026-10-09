/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE } from '../constants.js';

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
        key: 'enableNetflix' as const,
        label: 'Netflix',
        group: 'services' as const,
        type: 'checkbox' as const,
        default: true,
        row: 'services' as const,
    },
    {
        key: 'enableHboMax' as const,
        label: 'HBO Max',
        group: 'services' as const,
        type: 'checkbox' as const,
        default: true,
        row: 'services' as const,
    },
    {
        key: 'enableDisneyPlus' as const,
        label: 'Disney+',
        group: 'services' as const,
        type: 'checkbox' as const,
        default: true,
        row: 'services' as const,
    },
    {
        key: 'overlayCorner' as const,
        label: 'Badge Position',
        group: 'display' as const,
        type: 'select' as const,
        options: [
            ['top-left', 'Top Left'],
            ['top-right', 'Top Right'],
            ['bottom-left', 'Bottom Left'],
            ['bottom-right', 'Bottom Right'],
        ],
        default: 'top-left',
        title: 'Position of the rating badge on thumbnails',
    },
    {
        key: 'showImdbRating' as const,
        label: 'IMDb',
        group: 'display' as const,
        type: 'checkbox' as const,
        default: true,
        row: 'ratings-display' as const,
        disabled: true,
    },
    {
        key: 'apiClient' as const,
        label: 'Rating Provider',
        group: 'providers' as const,
        type: 'select' as const,
        options: [
            ['agregarr', 'Agregarr'],
            ['omdb', 'OMDb'],
            ['xmdb', 'XMDb'],
        ],
        default: 'agregarr',
        title: 'Active rating provider. Agregarr requires no API key',
    },
    {
        key: 'omdbApiKey' as const,
        label: 'OMDb API Key',
        group: 'providers' as const,
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text' as const,
        default: '',
        title: 'Required for OMDb ratings',
        validate: (val: string, allValues?: Record<string, unknown>): string | null => {
            if (allValues?.apiClient !== 'omdb') return null;
            return val && val.length > 0 ? null : 'OMDb API Key is required';
        },
    },
    {
        key: 'xmdbApiKey' as const,
        label: 'XMDb API Key',
        group: 'providers' as const,
        labelUrl: 'https://xmdbapi.com/api-key',
        type: 'text' as const,
        default: '',
        title: 'Required for XMDb ratings',
        validate: (val: string, allValues?: Record<string, unknown>): string | null => {
            if (allValues?.apiClient !== 'xmdb') return null;
            return val && val.length > 0 ? null : 'XMDb API Key is required';
        },
    },
    {
        key: 'showMcRating' as const,
        label: 'Metacritic',
        group: 'display' as const,
        type: 'checkbox' as const,
        default: false,
        row: 'ratings-display' as const,
    },
    {
        key: 'showRtRating' as const,
        label: 'Rotten Tomatoes',
        group: 'display' as const,
        type: 'checkbox' as const,
        default: false,
        row: 'ratings-display' as const,
    },
    {
        key: 'enableFadeUnderRating' as const,
        label: 'Fade below rating',
        group: 'fade' as const,
        type: 'checkbox' as const,
        default: false,
        title: 'Fade thumbnails with IMDb rating below the threshold',
    },
    {
        key: 'fadeRatingThreshold' as const,
        label: 'Threshold',
        group: 'fade' as const,
        type: 'text' as const,
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
        key: 'enableFadeToggle' as const,
        label: 'Allow override',
        group: 'fade' as const,
        type: 'checkbox' as const,
        default: false,
        title: 'Enable manual title fade toggle',
    },
    {
        key: 'cacheTtlRatedOldYear' as const,
        label: 'Older Titles',
        group: 'cache' as const,
        type: 'text' as const,
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration for titles released over a year ago. -1 = forever',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlRatedNewYear' as const,
        label: 'Recent Titles',
        group: 'cache' as const,
        type: 'text' as const,
        default: '30',
        title: 'Cache duration for titles released within the last year',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlNoRating' as const,
        label: 'No Rating',
        group: 'cache' as const,
        type: 'text' as const,
        default: '1',
        title: 'Cache duration for titles without a rating',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'debug' as const,
        label: 'Debug logging',
        group: 'debug' as const,
        type: 'checkbox' as const,
        default: true,
        title: 'Show detailed logs in browser console',
        row: 'debug-settings' as const,
    },
    {
        key: 'clearCache' as const,
        type: 'action' as const,
        group: 'debug' as const,
        row: 'action-clearCache' as const,
        label: '',
        actionLabel: 'Clear Cache',
        default: null,
    },
    {
        key: 'resetClients' as const,
        type: 'action' as const,
        group: 'debug' as const,
        row: 'action-resetClients' as const,
        label: '',
        actionLabel: 'Reset Providers',
        default: null,
    },
] as const;

/** Default values for all config fields. */
export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default])) as Record<ConfigFieldKey, string | boolean>;

/** Allowed values for select-type config fields. */
export const CONFIG_SELECT_ALLOWED = Object.fromEntries(
    CONFIG_FIELDS.filter(f => f.type === 'select').map(f => [f.key, f.options.map(o => (Array.isArray(o) ? o[0] : o))])
) as Record<ConfigFieldKey, string[]>;

// Type for config field keys
export type ConfigFieldKey = (typeof CONFIG_FIELDS)[number]['key'];

// Type for config field types
export type ConfigFieldType = 'checkbox' | 'select' | 'text' | 'action';

// Type for config values based on their field type
export type ConfigValueType = string | boolean | null;
