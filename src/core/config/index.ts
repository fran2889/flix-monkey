/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type {
    ActionConfigField,
    ActionKey,
    ConfigField,
    ConfigFieldKey,
    ConfigValueType,
    GroupKey,
    SelectOption,
    SettingConfigField,
    SettingKey,
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
