/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE } from '../constants';

function validateCacheTtl(val: ConfigValueType): string | undefined {
    const raw = String(val);
    if (raw.trim() === '') return 'Cache duration must be -1 or a positive integer';
    const n = Number(raw);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? undefined : 'Cache duration must be -1 or a positive integer';
}

/** Settings field groups for UI organization. */
export const GROUPS = {
    services: { label: 'Streaming Services', icon: '📺' },
    display: { label: 'Display Settings', icon: '🎨' },
    providers: { label: 'Rating Providers', icon: '📊' },
    fade: { label: 'Fade Settings', icon: '🌑' },
    cache: { label: 'Cache Settings', icon: '💾' },
    debug: { label: 'Debug', icon: '🐛' },
} as const;

/** Row label configurations for settings UI. */
export const ROW_LABELS = {
    services: { label: 'Show on', title: 'Enable ratings on these streaming services' },
    'ratings-display': { label: 'Show', title: 'Show these ratings on thumbnails' },
} as const;

export type GroupKey = keyof typeof GROUPS;
export type RowLabelKey = keyof typeof ROW_LABELS;

// Type for row label keys - includes all possible row values used in config
export type AllRowKeys = RowLabelKey | 'debug-settings';

/** Select option as a named tuple with value and label */
export type SelectOption = readonly [value: string, label: string];

/** Display metadata shared by every config field. */
interface ConfigFieldBase {
    key: string;
    label: string;
    group: GroupKey;
    title?: string;
    short?: boolean;
    disabled?: boolean;
    labelUrl?: string;
    suffix?: string;
}

/** Metadata shared by fields that store a user-configurable value. */
interface SettingFieldBase extends ConfigFieldBase {
    validate?: (val: ConfigValueType, allValues?: Record<string, unknown>) => string | undefined;
}

/** Checkbox field storing a boolean. */
interface CheckboxConfigField extends SettingFieldBase {
    type: 'checkbox';
    default: boolean;
    /** Optional shared row id that groups sibling checkboxes under one label. */
    row?: AllRowKeys;
}

/** Free-text field storing a string. */
interface TextConfigField extends SettingFieldBase {
    type: 'text';
    default: string;
}

/** Select field storing one of its required options. */
interface SelectConfigField extends SettingFieldBase {
    type: 'select';
    default: string;
    options: readonly (string | SelectOption)[];
}

/** Button field that triggers a handler and stores no value. */
export interface ActionConfigField extends ConfigFieldBase {
    type: 'action';
    actionLabel: string;
}

/** Union of fields that store a user-configurable value. */
export type SettingConfigField = CheckboxConfigField | TextConfigField | SelectConfigField;

/** Discriminated union of every config field shape. */
export type ConfigField = SettingConfigField | ActionConfigField;

/** Type for config values based on their field type */
export type ConfigValueType = string | boolean;

/**
 * Narrows a field to an action field.
 *
 * @param field - Field to inspect.
 * @returns True when the field renders an action button.
 */
export function isActionField(field: ConfigField): field is ActionConfigField {
    return field.type === 'action';
}

/**
 * Narrows a field to one that stores a value.
 *
 * @param field - Field to inspect.
 * @returns True when the field is not an action field.
 */
export function isSettingField(field: ConfigField): field is SettingConfigField {
    return !isActionField(field);
}

/** All configurable field definitions. */
export const CONFIG_FIELDS = [
    {
        key: 'enableNetflix',
        label: 'Netflix',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'enableHboMax',
        label: 'HBO Max',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'enableDisneyPlus',
        label: 'Disney+',
        group: 'services',
        type: 'checkbox',
        default: true,
        row: 'services',
    },
    {
        key: 'overlayCorner',
        label: 'Badge Position',
        group: 'display',
        type: 'select',
        options: [
            ['top-left', 'Top Left'],
            ['top-right', 'Top Right'],
            ['bottom-left', 'Bottom Left'],
            ['bottom-right', 'Bottom Right'],
        ],
        default: 'top-left',
        title: 'Position of the rating badge on thumbnails',
    },
    {
        key: 'showImdbRating',
        label: 'IMDb',
        group: 'display',
        type: 'checkbox',
        default: true,
        row: 'ratings-display',
        disabled: true,
    },
    {
        key: 'apiClient',
        label: 'Rating Provider',
        group: 'providers',
        type: 'select',
        options: [
            ['agregarr', 'Agregarr'],
            ['omdb', 'OMDb'],
            ['xmdb', 'XMDb'],
        ],
        default: 'agregarr',
        title: 'Active rating provider. Agregarr requires no API key',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDb API Key',
        group: 'providers',
        labelUrl: 'https://www.omdbapi.com/apikey.aspx',
        type: 'text',
        default: '',
        title: 'Required for OMDb ratings',
        validate: (val: ConfigValueType, allValues?: Record<string, unknown>): string | undefined => {
            if (allValues?.apiClient !== 'omdb') return undefined;
            return String(val).length > 0 ? undefined : 'OMDb API Key is required';
        },
    },
    {
        key: 'xmdbApiKey',
        label: 'XMDb API Key',
        group: 'providers',
        labelUrl: 'https://xmdbapi.com/api-key',
        type: 'text',
        default: '',
        title: 'Required for XMDb ratings',
        validate: (val: ConfigValueType, allValues?: Record<string, unknown>): string | undefined => {
            if (allValues?.apiClient !== 'xmdb') return undefined;
            return String(val).length > 0 ? undefined : 'XMDb API Key is required';
        },
    },
    {
        key: 'showMcRating',
        label: 'Metacritic',
        group: 'display',
        type: 'checkbox',
        default: false,
        row: 'ratings-display',
    },
    {
        key: 'showRtRating',
        label: 'Rotten Tomatoes',
        group: 'display',
        type: 'checkbox',
        default: false,
        row: 'ratings-display',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade below rating',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Fade thumbnails with IMDb rating below the threshold',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Threshold',
        group: 'fade',
        type: 'text',
        default: '6.0',
        title: 'IMDb rating threshold (0.0-10.0)',
        short: true,
        validate: (val: ConfigValueType): string | undefined => {
            const raw = String(val);
            if (raw.trim() === '') return 'Fade threshold must be a number between 0 and 10';
            const n = Number(raw);
            return !Number.isNaN(n) && n >= 0.0 && n <= 10.0
                ? undefined
                : 'Fade threshold must be a number between 0 and 10';
        },
    },
    {
        key: 'enableFadeToggle',
        label: 'Allow override',
        group: 'fade',
        type: 'checkbox',
        default: false,
        title: 'Enable manual title fade toggle',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Older Titles',
        group: 'cache',
        type: 'text',
        default: String(CACHE_TTL_INFINITE),
        title: 'Cache duration for titles released over a year ago. -1 = forever',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Recent Titles',
        group: 'cache',
        type: 'text',
        default: '30',
        title: 'Cache duration for titles released within the last year',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'cacheTtlNoRating',
        label: 'No Rating',
        group: 'cache',
        type: 'text',
        default: '1',
        title: 'Cache duration for titles without a rating',
        validate: validateCacheTtl,
        suffix: 'days',
        short: true,
    },
    {
        key: 'debug',
        label: 'Debug logging',
        group: 'debug',
        type: 'checkbox',
        default: true,
        title: 'Show detailed logs in browser console',
        row: 'debug-settings',
    },
    {
        key: 'clearCache',
        type: 'action',
        group: 'debug',
        label: '',
        actionLabel: 'Clear Cache',
    },
    {
        key: 'resetClients',
        type: 'action',
        group: 'debug',
        label: '',
        actionLabel: 'Reset Providers',
    },
] as const satisfies readonly ConfigField[];

// Type for config field keys
export type ConfigFieldKey = (typeof CONFIG_FIELDS)[number]['key'];

/**
 * Key of an action-type field. Action fields carry no stored value, so they
 * have no default and are excluded from {@link CONFIG_DEFAULTS}.
 */
export type ActionKey = Extract<(typeof CONFIG_FIELDS)[number], { type: 'action' }>['key'];

/** Key of a field that stores a user-configurable value. */
export type SettingKey = Exclude<ConfigFieldKey, ActionKey>;

const configDefaults: Partial<Record<ConfigFieldKey, ConfigValueType>> = {};
for (const field of CONFIG_FIELDS) {
    if (!isSettingField(field)) continue;
    configDefaults[field.key] = field.default;
}

/** Default values for all settings-bearing config fields. */
export const CONFIG_DEFAULTS = configDefaults as Record<SettingKey, string | boolean>;

const configSelectAllowed: Partial<Record<ConfigFieldKey, readonly string[]>> = {};
for (const field of CONFIG_FIELDS) {
    if (field.type !== 'select') continue;
    configSelectAllowed[field.key] = field.options.map(o => (typeof o === 'string' ? o : o[0]));
}

/** Allowed values for select-type config fields. */
export const CONFIG_SELECT_ALLOWED: Partial<Record<SettingKey, readonly string[]>> = configSelectAllowed;
