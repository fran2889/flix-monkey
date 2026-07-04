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

/**
 * Error thrown when an element is not found within expected timeout.
 */
export class ElementNotFoundError extends Error {
    /**
     * @param {string} selector - CSS selector that wasn't found
     * @param {string} pageUrl - URL of the page when error occurred
     * @param {Object} [context={}] - Additional context for debugging
     */
    constructor(selector, pageUrl, context = {}) {
        super(`Element "${selector}" not found on ${pageUrl}`);
        this.name = 'ElementNotFoundError';
        this.selector = selector;
        this.pageUrl = pageUrl;
        this.context = context;
    }
}

/**
 * Error thrown when a timeout occurs waiting for an expected state.
 */
export class TestTimeoutError extends Error {
    /**
     * @param {string} message - Description of what timed out
     * @param {Object} [context={}] - Additional context for debugging
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'TestTimeoutError';
        this.context = context;
    }
}

/**
 * Error thrown when Netflix is not in an expected state.
 */
export class NetflixStateError extends Error {
    /**
     * @param {string} message - Description of state issue
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'NetflixStateError';
        this.context = context;
    }
}
