/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

// Re-export from the TypeScript files
export type {
    ActionConfigField,
    ActionKey,
    CheckboxConfigField,
    ConfigField,
    ConfigFieldKey,
    ConfigFieldType,
    ConfigValueType,
    GroupKey,
    SelectConfigField,
    SelectOption,
    SettingConfigField,
    SettingKey,
    TextConfigField,
} from './config-fields';
export {
    CONFIG_DEFAULTS,
    CONFIG_FIELDS,
    CONFIG_SELECT_ALLOWED,
    GROUPS,
    isActionField,
    isSettingField,
    ROW_LABELS,
} from './config-fields';
export type { ConfigKey } from './config-manager';
export { ConfigManager } from './config-manager';
