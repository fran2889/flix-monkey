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
export const CONFIG_FIELDS = [
    {
        key: 'overlayCorner',
        label: 'Overlay Position',
        type: 'select',
        options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'top-left',
        title: 'Where the rating badge appears on thumbnails.',
    },
    {
        key: 'apiClient',
        label: 'API Provider',
        type: 'select',
        options: [
            ['agregarr', 'Agregarr'],
            ['imdbapi', 'IMDb API'],
            ['omdb', 'OMDB'],
            ['xmdb', 'XMDB'],
        ],
        default: 'agregarr',
        title: 'Which service to fetch ratings from.',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDB API Key',
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text',
        default: '',
        title: 'Required when using OMDB as API provider.',
        validate: (val, allValues) => {
            if (allValues?.apiClient !== 'omdb') return null;
            return val && val.length > 0 ? null : 'OMDB API Key is required';
        },
    },
    {
        key: 'xmdbApiKey',
        label: 'XMDB API Key',
        labelUrl: 'https://xmdbapi.com/api-key',
        type: 'text',
        default: '',
        title: 'Required when using XMDB as API provider.',
        validate: (val, allValues) => {
            if (allValues?.apiClient !== 'xmdb') return null;
            return val && val.length > 0 ? null : 'XMDB API Key is required';
        },
    },
    {
        key: 'showMcRating',
        label: 'Show Metacritic',
        type: 'checkbox',
        default: true,
        title: 'Show Metacritic score on thumbnails.',
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Show Rotten Tomatoes',
        type: 'checkbox',
        default: true,
        title: 'Show Rotten Tomatoes score on thumbnails.',
        row: 'ratings-display',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade titles rated below',
        type: 'checkbox',
        default: false,
        title: 'Fade titles with IMDb rating below this value.',
        row: 'fade-settings',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Fade threshold',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating cutoff for fading (0–10).',
        row: 'fade-settings',
        labelHidden: true,
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Must be a number between 0 and 10';
            const n = Number(val);
            return !isNaN(n) && n >= 0.0 && n <= 10.0 ? null : 'Must be a number between 0 and 10';
        },
    },
    {
        key: 'enableFadeToggle',
        label: 'Show fade toggle',
        type: 'checkbox',
        default: true,
        title: 'Show per-title fade override toggle on hover.',
        row: 'fade-toggle-settings',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Rated > 1yr',
        type: 'text',
        default: '-1',
        title: 'How long to cache ratings for older titles. -1 = forever.',
        section: 'Cache Duration (days)',
        row: 'cache-fields',
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Must be -1 or a positive integer';
            const n = Number(val);
            return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Must be -1 or a positive integer';
        },
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Rated < 1yr',
        type: 'text',
        default: '30',
        title: 'How long to cache ratings for recent titles.',
        row: 'cache-fields',
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Must be -1 or a positive integer';
            const n = Number(val);
            return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Must be -1 or a positive integer';
        },
    },
    {
        key: 'cacheTtlNoRating',
        label: 'Unrated',
        type: 'text',
        default: '1',
        title: 'How long to cache titles with no rating. Use small value to retry sooner.',
        row: 'cache-fields',
        validate: val => {
            if (typeof val === 'string' && val.trim() === '') return 'Must be -1 or a positive integer';
            const n = Number(val);
            return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Must be -1 or a positive integer';
        },
    },
    {
        key: 'debug',
        label: 'Enable debug logging',
        type: 'checkbox',
        default: true,
        title: 'Log debug info to the browser console.',
        row: 'debug-settings',
    },
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));
