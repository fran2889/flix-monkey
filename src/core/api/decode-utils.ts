/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Result of decoding one field from an untrusted response.
 *
 * `ok: false` means the field has the wrong type, or was required and is empty
 * or absent. Optional readers treat absent and null fields as `ok: true` with
 * an undefined value.
 */
export type Decoded<T> = { ok: true; value: T } | { ok: false };

/**
 * Reports whether a value is a non-null, non-array object.
 *
 * @param value - Untrusted value.
 * @returns True when the value is a plain record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a required, non-empty string field.
 *
 * @param record - Decoded object.
 * @param key - Field name.
 * @returns The field value, or a failed result when it is absent, empty, or not a string.
 */
export function readRequiredString(record: Record<string, unknown>, key: string): Decoded<string> {
    const value = record[key];
    return typeof value === 'string' && value.trim() !== '' ? { ok: true, value } : { ok: false };
}

/**
 * Reads an optional string field. A null value is treated as absent.
 *
 * @param record - Decoded object.
 * @param key - Field name.
 * @returns The field value or undefined, or a failed result when it is another type.
 */
export function readOptionalString(record: Record<string, unknown>, key: string): Decoded<string | undefined> {
    const value = record[key];
    if (value === undefined || value === null) return { ok: true, value: undefined };
    return typeof value === 'string' ? { ok: true, value } : { ok: false };
}

/**
 * Reads an optional number field. A null value is treated as absent.
 *
 * @param record - Decoded object.
 * @param key - Field name.
 * @returns The field value or undefined, or a failed result when it is another type.
 */
export function readOptionalNumber(record: Record<string, unknown>, key: string): Decoded<number | undefined> {
    const value = record[key];
    if (value === undefined || value === null) return { ok: true, value: undefined };
    return typeof value === 'number' ? { ok: true, value } : { ok: false };
}

/**
 * Reads an optional array field. A null value is treated as absent.
 *
 * @param record - Decoded object.
 * @param key - Field name.
 * @returns The array or undefined, or a failed result when it is another type.
 */
export function readOptionalArray(record: Record<string, unknown>, key: string): Decoded<unknown[] | undefined> {
    const value = record[key];
    if (value === undefined || value === null) return { ok: true, value: undefined };
    return Array.isArray(value) ? { ok: true, value } : { ok: false };
}

/**
 * Decodes the valid items of an array and drops invalid ones.
 *
 * @param values - Untrusted array items.
 * @param decode - Item decoder that returns undefined for an invalid item.
 * @returns The decoded items in source order, with invalid items omitted.
 */
export function decodeValidItems<T>(values: unknown[], decode: (_value: unknown) => T | undefined): T[] {
    const decoded: T[] = [];
    for (const value of values) {
        const item = decode(value);
        if (item !== undefined) decoded.push(item);
    }
    return decoded;
}

/**
 * Decodes every item of an array, failing when any item is invalid.
 *
 * @param values - Untrusted array items.
 * @param decode - Item decoder that returns undefined for an invalid item.
 * @returns The decoded array, or undefined when any item fails to decode.
 */
export function decodeArray<T>(values: unknown[], decode: (_value: unknown) => T | undefined): T[] | undefined {
    const decoded: T[] = [];
    for (const value of values) {
        const item = decode(value);
        if (item === undefined) return undefined;
        decoded.push(item);
    }
    return decoded;
}
