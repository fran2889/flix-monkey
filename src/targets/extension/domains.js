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
export const ALLOWED_DOMAINS = ['www.omdbapi.com', 'xmdbapi.com', 'api.agregarr.org', 'imdb.iamidiotareyoutoo.com'];

export function validateDomain(url) {
    try {
        const urlObj = new URL(url);
        if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
            return { valid: false, error: 'Domain not allowed' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL' };
    }
}
