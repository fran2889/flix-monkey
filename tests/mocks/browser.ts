/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { Mock } from 'vitest';
// eslint-disable-next-line no-duplicate-imports
import { vi } from 'vitest';

/**
 * Type for the mocked browser object used in tests.
 * This provides type-safe access to the mocked webextension-polyfill APIs.
 *
 * Use this type when casting the imported browser from 'webextension-polyfill'
 * after setting up vi.mock('webextension-polyfill', ...).
 */
export type MockedBrowser = {
    storage: {
        local: {
            get: Mock<(_keys?: null | string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>>;
            set: Mock<(_items: Record<string, unknown>) => Promise<void>>;
            remove: Mock<(_keys: string | string[]) => Promise<void>>;
        };
    };
    runtime: {
        sendMessage: Mock<(_message: unknown) => Promise<unknown>>;
        id: string;
    };
};

/**
 * Create a mock webextension-polyfill module with basic browser APIs.
 * This is useful for tests that need to mock the browser extension APIs.
 *
 * @returns A mock object that can be used as the default export of webextension-polyfill
 *
 * @example
 * ```typescript
 * vi.mock('webextension-polyfill', () => ({
 *   default: createMockBrowser(),
 * }));
 * ```
 */
export function createMockBrowser(): MockedBrowser {
    return {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
                remove: vi.fn(),
            },
        },
        runtime: {
            sendMessage: vi.fn(),
            id: 'test-extension-id',
        },
    };
}

/**
 * Setup webextension-polyfill mock in a test file.
 *
 * Note: This must be called at the module level (not in beforeEach)
 * because vi.mock is hoisted and needs to run before any imports that use webextension-polyfill.
 *
 * @returns The mocked browser object that will be used by imports of webextension-polyfill
 *
 * @example
 * ```typescript
 * const mockedBrowser = setupBrowserMock();
 * // Now import browser from 'webextension-polyfill' will return the mocked object
 * import browser from 'webextension-polyfill';
 * const mocked = browser as unknown as MockedBrowser;
 * ```
 */
export function setupBrowserMock(): MockedBrowser {
    const mockBrowser = createMockBrowser();
    vi.mock('webextension-polyfill', () => ({
        default: mockBrowser,
    }));
    return mockBrowser;
}
