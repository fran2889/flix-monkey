/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { CONFIG_DEFAULTS } from '../../src/core/config/index.js';
import { Logger } from '../../src/core/logger.js';
import { buildMockAdapter } from './adapter.js';

function buildLogger() {
    let debugValue: string | boolean = CONFIG_DEFAULTS.debug;

    return {
        withDebug(enabled: boolean) {
            debugValue = enabled ? 'true' : 'false';
            return this;
        },

        build(): Logger {
            // Create adapter with configured debug value
            const adapter = buildMockAdapter()
                .withConfigGetReturning((key: string) =>
                    key === 'debug' ? debugValue : CONFIG_DEFAULTS[key as keyof typeof CONFIG_DEFAULTS]
                )
                .build();

            const logger = new Logger(adapter);

            // Spy on all methods to track calls in tests
            vi.spyOn(logger, 'debug');
            vi.spyOn(logger, 'info');
            vi.spyOn(logger, 'warn');
            vi.spyOn(logger, 'error');

            return logger;
        },
    };
}

// Static presets
buildLogger.debugEnabled = () => buildLogger().withDebug(true).build();

buildLogger.debugDisabled = () => buildLogger().withDebug(false).build();

export { buildLogger };
