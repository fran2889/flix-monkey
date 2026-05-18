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
        key: 'xmdbApiKey',
        label: 'XMDB API Key',
        type: 'text',
        default: 'YOUR_XMDB_API_KEY',
        title: 'Free movie and TV data API. Get API key at https://xmdbapi.com/api-key',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDB API Key',
        type: 'text',
        default: 'YOUR_OMDB_API_KEY',
        title: 'Open Movie Database API key. Get API key at https://www.omdbapi.com/apikey.aspx',
    },
    {
        key: 'apiClient',
        label: 'API Provider',
        type: 'select',
        options: [
            { label: 'IMDb API', value: 'imdbapi' },
            { label: 'OMDB', value: 'omdb' },
            { label: 'XMDB', value: 'xmdb' },
        ],
        default: 'imdbapi',
        title: 'Choose the primary API provider for ratings.',
    },
    {
        key: 'overlayCorner',
        label: 'Overlay Position',
        type: 'select',
        options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'top-left',
        title: 'Choose where the rating badge appears on Netflix thumbnails and banners.',
    },
    {
        key: 'showRtRating',
        label: 'Show Rotten Tomatoes',
        type: 'checkbox',
        default: true,
        title: 'Display Rotten Tomatoes score when available.',
    },
    {
        key: 'showMcRating',
        label: 'Show Metacritic',
        type: 'checkbox',
        default: true,
        title: 'Display Metacritic score when available.',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Cache Rated > 1 year (days)',
        type: 'text',
        default: '-1',
        title: 'Cache duration for titles older than 1 year with ratings. -1 = forever.',
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Cache Rated < 1 year (days)',
        type: 'text',
        default: '30',
        title: 'Cache duration for titles released within the last year with ratings.',
    },
    {
        key: 'cacheTtlNoRating',
        label: 'Cache Unrated (days)',
        type: 'text',
        default: '1',
        title: 'Cache duration for titles not found or without ratings. Use small values to retry.',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade Low-Rated Titles',
        type: 'checkbox',
        default: false,
        title: 'Reduce opacity of titles with IMDb rating below the threshold.',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Fade Threshold (IMDb)',
        type: 'text',
        default: '6.0',
        title: 'Titles with IMDb rating below this value will be faded.',
    },
    {
        key: 'debug',
        label: 'Enable debug logging',
        type: 'checkbox',
        default: false,
        title: 'Output debug logs to console.',
    },
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));
