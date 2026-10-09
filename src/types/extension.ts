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
 * Response returned by the extension background relay. Error bodies are capped
 * at 200 characters when an HTTP response is available.
 */
export type FetchProxyResponse = { data: unknown } | { error: string; status?: number; body?: string | null };

/**
 * Actions available in the settings UI.
 */
export interface SettingsActions {
    onSave: () => void | Promise<void>;
    onClearCache: () => void | Promise<void>;
    onResetClients: () => void | Promise<void>;
}
