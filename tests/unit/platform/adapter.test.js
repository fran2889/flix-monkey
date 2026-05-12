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
import { describe, it, expect } from 'vitest';
import { PlatformAdapter } from '../../../src/platform/adapter.js';

describe('PlatformAdapter', () => {
    const adapter = new PlatformAdapter();

    it('should throw an error if storageGet is not implemented', async () => {
        await expect(adapter.storageGet('key')).rejects.toThrow(
            'PlatformAdapter: storageGet() must be implemented by subclass'
        );
    });

    it('should throw an error if storageSet is not implemented', async () => {
        await expect(adapter.storageSet('key', 'value')).rejects.toThrow(
            'PlatformAdapter: storageSet() must be implemented by subclass'
        );
    });

    it('should throw an error if httpFetch is not implemented', async () => {
        await expect(adapter.httpFetch('url', {})).rejects.toThrow(
            'PlatformAdapter: httpFetch() must be implemented by subclass'
        );
    });

    it('should throw an error if registerMenuCommand is not implemented', () => {
        expect(() => adapter.registerMenuCommand('label', () => {})).toThrow(
            'PlatformAdapter: registerMenuCommand() must be implemented by subclass'
        );
    });
});
