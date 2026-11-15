/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Result of domain validation.
 */
export type DomainValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Response from the extension background fetch proxy.
 *
 * Tagged union: `ok` identifies the branch, so a successful body that itself
 * contains an `error` field is never mistaken for a transport failure. Error
 * bodies are capped at 200 characters when an HTTP response is available.
 */
export type FetchProxyResponse =
    { ok: true; data: unknown } | { ok: false; error: string; status?: number; body?: string | undefined };

/**
 * Actions available in the settings UI.
 */
export interface SettingsActions {
    onSave: () => void | Promise<void>;
    onClearCache: () => void | Promise<void>;
    onResetClients: () => void | Promise<void>;
}
