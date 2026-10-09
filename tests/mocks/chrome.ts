/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

export const chrome = {
    runtime: {
        id: 'test-ext',
        getManifest: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        openOptionsPage: vi.fn(),
    },
    action: {
        onClicked: { addListener: vi.fn() },
    },
};
