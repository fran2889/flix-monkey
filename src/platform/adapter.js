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
import { FlixMonkeyError } from '../core/utils.js';

/**
 * Base class for platform adapters.
 * All methods must be implemented by subclasses.
 */
export class PlatformAdapter {
    /** @abstract */
    async storageGet(_key) {
        throw new FlixMonkeyError('PlatformAdapter: storageGet() must be implemented by subclass');
    }

    /** @abstract */
    async storageGetAll() {
        throw new FlixMonkeyError('PlatformAdapter: storageGetAll() must be implemented by subclass');
    }

    /** @abstract */
    async storageSet(_key, _value) {
        throw new FlixMonkeyError('PlatformAdapter: storageSet() must be implemented by subclass');
    }

    /** @abstract */
    async storageSetMany(_values) {
        throw new FlixMonkeyError('PlatformAdapter: storageSetMany() must be implemented by subclass');
    }

    /** @abstract */
    async storageDelete(_key) {
        throw new FlixMonkeyError('PlatformAdapter: storageDelete() must be implemented by subclass');
    }

    /** @abstract */
    async storageGetKeys(_prefix) {
        throw new FlixMonkeyError('PlatformAdapter: storageGetKeys() must be implemented by subclass');
    }

    /** @abstract */
    async httpFetch(_url, _options) {
        throw new FlixMonkeyError('PlatformAdapter: httpFetch() must be implemented by subclass');
    }

    /**
     * Synchronously gets a configuration value.
     * @abstract
     */
    configGet(_key) {
        throw new FlixMonkeyError('PlatformAdapter: configGet() must be implemented by subclass');
    }

    /**
     * Registers a menu command in the platform (if supported).
     * Defaults to no-op.
     */
    registerMenuCommand(_label, _fn) {
        // No-op by default
    }
}
