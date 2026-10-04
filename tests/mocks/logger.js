/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { Logger } from '../../src/core/logger.js';
import { buildMockAdapter } from './adapter.js';

function buildLogger() {
    const logger = new Logger(buildMockAdapter().build());
    const builder = {
        withDebugEnabled() {
            vi.spyOn(logger, 'debug').mockImplementation(() => {});
            vi.spyOn(logger, 'info').mockImplementation(() => {});
            vi.spyOn(logger, 'warn').mockImplementation(() => {});
            vi.spyOn(logger, 'error').mockImplementation(() => {});
            return this;
        },
        withDebugDisabled() {
            vi.spyOn(logger, 'debug').mockImplementation(() => {});
            vi.spyOn(logger, 'info').mockImplementation(() => {});
            vi.spyOn(logger, 'warn').mockImplementation(() => {});
            vi.spyOn(logger, 'error').mockImplementation(() => {});
            return this;
        },
        build() {
            return logger;
        },
    };
    // Default: all methods spy on no-op
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    return builder;
}

// Static presets
buildLogger.silent = () => {
    const logger = new Logger(buildMockAdapter().build());
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    return logger;
};

buildLogger.verbose = () => {
    const logger = new Logger(buildMockAdapter().build());
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    return logger;
};

// Backward compatibility
export function createMockLogger() {
    return buildLogger().build();
}

export { buildLogger };
