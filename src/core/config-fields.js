/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { CACHE_TTL_INFINITE } from './constants.js';

function validateCacheTtl(val) {
    if (typeof val === 'string' && val.trim() === '') return 'Cache duration must be -1 or a positive integer';
    const n = Number(val);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Cache duration must be -1 or a positive integer';
}

export const CONFIG_FIELDS = [
    {
        key: 'enableNetflix',
        label: 'Netflix',
        type: 'checkbox',
        default: true,
        title: 'Enable FlixMonkey on Netflix',
        row: 'services',
    },
    {
        key: 'overlayCorner',
        label: 'Badge Position',
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
        key: 'apiClient',
        label: 'Rating Provider',
        type: 'select',
        options: [
            ['agregarr', 'FM-DB + Agregarr'],
            ['omdb', 'OMDb'],
            ['xmdb', 'XMDb'],
        ],
        default: 'agregarr',
        title: 'Rating data source',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDb API Key',
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
        type: 'checkbox',
        default: false,
        title: 'Show Metacritic score',
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Rotten Tomatoes',
        type: 'checkbox',
        default: false,
        title: 'Show Rotten Tomatoes score',
        row: 'ratings-display',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade Below Rating',
        type: 'checkbox',
        default: false,
        title: 'Fade thumbnails rated below threshold',
        row: 'fade-settings',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Fade threshold',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating threshold (0-10)',
        row: 'fade-settings',
        labelHidden: true,
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Fade threshold must be a number between 0 and 10';
            const n = Number(val);
            return !isNaN(n) && n >= 0.0 && n <= 10.0 ? null : 'Fade threshold must be a number between 0 and 10';
        },
    },
    {
        key: 'enableFadeToggle',
        label: 'Allow Override',
        type: 'checkbox',
        default: false,
        title: 'Allow manual override of fade state in hover preview',
        row: 'fade-settings',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Older Titles',
        type: 'text',
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration (days) for older titles. -1 = forever',
        section: 'Cache Settings',
        row: 'cache-fields',
        validate: validateCacheTtl,
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Recent Titles',
        type: 'text',
        default: '30',
        title: 'Cache duration (days) for recent titles',
        row: 'cache-fields',
        validate: validateCacheTtl,
    },
    {
        key: 'cacheTtlNoRating',
        label: 'No Rating',
        type: 'text',
        default: '1',
        title: 'Cache duration (days) for titles without ratings',
        row: 'cache-fields',
        validate: validateCacheTtl,
    },
    {
        key: 'debug',
        label: 'Enable debug logging',
        type: 'checkbox',
        default: true,
        title: 'Enable debug logging in console',
        row: 'debug-settings',
    },
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));

export const CONFIG_SELECT_ALLOWED = Object.fromEntries(
    CONFIG_FIELDS.filter(f => f.type === 'select').map(f => [f.key, f.options.map(o => (Array.isArray(o) ? o[0] : o))])
);
