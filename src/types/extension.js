/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Result of domain validation.
 * @typedef {{valid: true}|{valid: false, error: string}} DomainValidationResult
 */

/**
 * Response from the extension background fetch proxy.
 * @typedef {{data: unknown}|{error: string, status?: number, body?: string|null}} FetchProxyResponse
 * Response returned by the extension background relay. Error bodies are capped
 * at 200 characters when an HTTP response is available.
 */

/**
 * Actions available in the settings UI.
 * @typedef {Object} SettingsActions
 * @property {() => void | Promise<void>} onSave
 * @property {() => void | Promise<void>} onClearCache
 * @property {() => void | Promise<void>} onResetClients
 */

export {};
