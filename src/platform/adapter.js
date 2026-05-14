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
 * Base class for platform adapters.
 * All methods must be implemented by subclasses.
 */
export class PlatformAdapter {
    /** @abstract */
    async storageGet(_key) {
        throw new Error('PlatformAdapter: storageGet() must be implemented by subclass');
    }

    /** @abstract */
    async storageSet(_key, _value) {
        throw new Error('PlatformAdapter: storageSet() must be implemented by subclass');
    }

    /** @abstract */
    async httpFetch(_url, _options) {
        throw new Error('PlatformAdapter: httpFetch() must be implemented by subclass');
    }

    /** @abstract */
    registerMenuCommand(_label, _fn) {
        throw new Error('PlatformAdapter: registerMenuCommand() must be implemented by subclass');
    }

    /** @abstract */
    get configGet() {
        return null;
    }
}
