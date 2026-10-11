/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

export const browser = {
    runtime: {
        id: undefined,
        getManifest: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        openOptionsPage: vi.fn(),
    },
    action: {
        onClicked: { addListener: vi.fn() },
    },
};
