/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** Health status of an API client. */
export type ClientStatus = { healthy: true } | { healthy: false; reason: string };
