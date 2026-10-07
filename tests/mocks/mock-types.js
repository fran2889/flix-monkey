/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Maps a class to a test-double shape: every method becomes a vitest Mock, every
 * other member keeps its type, and every member becomes optional and writable so
 * a partial object literal can stand in for the real class.
 *
 * @template T
 * @typedef {{ -readonly [K in keyof T]?: T[K] extends (...args: never[]) => unknown ? import('vitest').Mock : T[K] }} MockOf
 */

export {};
