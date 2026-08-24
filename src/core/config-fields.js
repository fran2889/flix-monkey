/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE } from './constants.js';

function validateCacheTtl(val) {
    if (typeof val === 'string' && val.trim() === '') return 'Cache duration must be -1 or a positive integer';
    const n = Number(val);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Cache duration must be -1 or a positive integer';
}

export const GROUPS = {
    services: { label: 'Streaming Services', icon: '📺' },
    display: { label: 'Display Settings', icon: '🎨' },
    providers: { label: 'Rating Providers', icon: '📊' },
    fade: { label: 'Fade Settings', icon: '🌑' },
    cache: { label: 'Cache Settings', icon: '💾' },
    debug: { label: 'Debug', icon: '🐛' },
};

export const ROW_LABELS = {
    services: 'Show on',
    'ratings-display': 'Show',
};

export const CONFIG_FIELDS = [
    {
        key: 'enableNetflix',
        label: 'Netflix',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Netflix',
        row: 'services',
    },
    {
        key: 'enableHboMax',
        label: 'HBO Max',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on HBO Max',
        row: 'services',
    },
    {
        key: 'enableDisneyPlus',
        label: 'Disney+',
        group: 'services',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Disney+',
        row: 'services',
    },
    {
        key: 'overlayCorner',
        label: 'Badge Position',
        group: 'display',
        type: 'select',
        options: [
            ['top-left', 'Top Left'],
            ['top-right', 'Top Right'],
            ['bottom-left', 'Bottom Left'],
            ['bottom-right', 'Bottom Right'],
        ],
        default: 'top-left',
        title: 'Badge position on thumbnails',
    },
    {
        key: 'showImdbRating',
        label: 'IMDb',
        group: 'display',
        type: 'checkbox',
        default: true,
        title: 'IMDb score is always shown',
        row: 'ratings-display',
        disabled: true,
    },
    {
        key: 'apiClient',
        label: 'Rating Provider',
        group: 'providers',
        type: 'select',
        options: [
            ['agregarr', 'Agregarr'],
            ['omdb', 'OMDb'],
            ['xmdb', 'XMDb'],
        ],
        default: 'agregarr',
        title: 'Rating data source',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDb API Key',
        group: 'providers',
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text',
        default: '',
        title: 'OMDb key. Needed if OMDb is selected',
        validate: (val, allValues) => {
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
        title: 'XMDb key. Needed if XMDb is selected',
        validate: (val, allValues) => {
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
        title: 'Show Metacritic score',
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Rotten Tomatoes',
        group: 'display',
        type: 'checkbox',
        default: false,
        title: 'Show Rotten Tomatoes score',
        row: 'ratings-display',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade below rating',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Fade thumbnails rated below threshold',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Threshold',
        group: 'fade',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating threshold (0-10)',
        validate: val => {
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
        title: 'Allow manual override of fade state on supported title surfaces',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Older Titles',
        group: 'cache',
        type: 'text',
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration (days) for older titles. -1 = forever',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days',
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Recent Titles',
        group: 'cache',
        type: 'text',
        default: '30',
        title: 'Cache duration (days) for recent titles',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days',
    },
    {
        key: 'cacheTtlNoRating',
        label: 'No Rating',
        group: 'cache',
        type: 'text',
        default: '1',
        title: 'Cache duration (days) for titles without ratings',
        row: 'cache-fields',
        validate: validateCacheTtl,
        suffix: 'days',
    },
    {
        key: 'debug',
        label: 'Enable debug logging',
        group: 'debug',
        type: 'checkbox',
        default: true,
        title: 'Enable debug logging in console',
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
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));

export const CONFIG_SELECT_ALLOWED = Object.fromEntries(
    CONFIG_FIELDS.filter(f => f.type === 'select').map(f => [f.key, f.options.map(o => (Array.isArray(o) ? o[0] : o))])
);
