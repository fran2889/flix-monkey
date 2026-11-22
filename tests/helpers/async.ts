/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Flushes queued promise callbacks without moving the fake clock.
 *
 * Requires fake timers to be active.
 *
 * @returns A promise that resolves after pending async work has run.
 */
export async function flushAsyncWork(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}
