/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Error thrown when an untrusted API response fails to parse.
 *
 * Parsers throw this instead of returning a result object. Callers catch it
 * to drop invalid items, while any other error type signals a bug and must
 * propagate.
 */
export class ParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ParseError';
    }
}

/**
 * Asserts that a value is a non-null, non-array object.
 *
 * @param value - Untrusted value.
 * @throws ParseError when the value is null, an array, or not an object.
 */
export function assertRecord(value: unknown): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ParseError('expected an object');
    }
}

/**
 * Reads a required, non-empty string field.
 *
 * @param record - Parsed object.
 * @param key - Field name.
 * @returns The field value.
 * @throws ParseError when the field is absent, empty, whitespace, or not a string.
 */
export function requiredString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ParseError(`expected string at "${key}"`);
    }
    return value;
}

/**
 * Reads an optional string field. An absent or null field is treated as
 * undefined and does not throw; only a value of the wrong type does.
 *
 * @param record - Parsed object.
 * @param key - Field name.
 * @returns The field value or undefined.
 * @throws ParseError when the field is present but not a string.
 */
export function optionalString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') throw new ParseError(`expected string at "${key}"`);
    return value;
}

/**
 * Reads an optional number field. An absent or null field is treated as
 * undefined and does not throw; only a value of the wrong type does.
 *
 * @param record - Parsed object.
 * @param key - Field name.
 * @returns The field value or undefined.
 * @throws ParseError when the field is present but not a number.
 */
export function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number') throw new ParseError(`expected number at "${key}"`);
    return value;
}

/**
 * Reads an optional array field. An absent or null field is treated as
 * undefined and does not throw; only a value of the wrong type does.
 *
 * @param record - Parsed object.
 * @param key - Field name.
 * @returns The array or undefined.
 * @throws ParseError when the field is present but not an array.
 */
export function optionalArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) throw new ParseError(`expected array at "${key}"`);
    return value;
}

/**
 * Parses the valid items of an array and drops the invalid ones.
 *
 * Only `ParseError` from the item parser is caught. Any other error type
 * propagates so bugs are not silently swallowed. When every item is invalid,
 * the result is an empty array; callers that require at least one valid item
 * should use `parseRequiredItems`.
 *
 * @param values - Untrusted array items.
 * @param parseItem - Item parser that throws `ParseError` for an invalid item.
 * @returns The parsed items in source order, with invalid items omitted.
 */
export function parseValidItems<T>(values: unknown[], parseItem: (_value: unknown) => T): T[] {
    const parsed: T[] = [];
    for (const value of values) {
        try {
            parsed.push(parseItem(value));
        } catch (error: unknown) {
            if (!(error instanceof ParseError)) throw error;
        }
    }
    return parsed;
}

/**
 * Parses array items and requires at least one valid item.
 *
 * An empty input array is valid and returns an empty array. A non-empty input
 * where every item is invalid throws, because returning an empty array would
 * hide a provider shape change.
 *
 * @param values - Untrusted array items.
 * @param parseItem - Item parser that throws `ParseError` for an invalid item.
 * @param label - Human-readable array source for the error message.
 * @returns The parsed items in source order, with invalid items omitted.
 * @throws ParseError when the input is non-empty and every item is invalid.
 */
export function parseRequiredItems<T>(values: unknown[], parseItem: (_value: unknown) => T, label: string): T[] {
    const parsed = parseValidItems(values, parseItem);
    if (values.length > 0 && parsed.length === 0) {
        throw new ParseError(`no valid items in ${label}`);
    }
    return parsed;
}
