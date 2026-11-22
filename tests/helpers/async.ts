/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Flushes queued promise callbacks and runs timers already due at the current
 * instant, without advancing the fake clock.
 *
 * Requires fake timers to be active.
 *
 * @returns A promise that resolves after the queued work has run.
 */
export async function flushAsyncWork(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}
