/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export const chrome = {
    runtime: {
        getManifest: vi.fn(),
        onInstalled: { addListener: vi.fn() },
    },
};
