/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export const SETTINGS_STYLES = `/* =============================================
   CSS CUSTOM PROPERTIES
   ============================================= */
:root {
    /* Colors - Background */
    --color-bg-primary: #141414;
    --color-bg-secondary: #1e1e1e;
    --color-bg-card: #252526;
    --color-bg-input: #333333;

    /* Colors - Text */
    --color-text-primary: #ffffff;
    --color-text-secondary: #b0b0b0;
    --color-text-muted: #808080;

    /* Colors - Accent & Feedback */
    --color-accent: #e50914;
    --color-accent-hover: #f40612;
    --color-accent-text: #ffffff;
    --color-link: #79f;
    --color-link-hover: #9cf;
    --color-success: #4caf50;
    --color-error: #e05252;

    /* Colors - Borders */
    --color-border: #333333;
    --color-border-input: #555555;

    /* Typography */
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.8125rem;
    --font-size-base: 0.875rem;
    --font-size-lg: 1.25rem;
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;

    /* Spacing */
    --space-xs: 0.25rem;
    --space-sm: 0.375rem;
    --space-md: 0.5rem;
    --space-lg: 0.75rem;
    --space-xl: 1.125rem;
    --space-2xl: 1.25rem;

    /* Borders */
    --border-width-thin: 1px;
    --border-radius-sm: 0.25rem;
    --border-radius-md: 0.375rem;

    /* Focus */
    --focus-ring: 0.125rem;
    --focus-outline-width: 2px;

    /* Layout */
    --label-min-width: clamp(6rem, 20%, 10rem);
    --label-max-width: clamp(8rem, 25%, 12rem);
    --container-max-width: min(100%, 60rem);

    /* Form Controls */
    --input-padding-inline: var(--space-lg);
    --input-padding-block: var(--space-md);
    --input-short-width: 4.5rem;
    --btn-action-width: 8rem;
    --select-padding-end: 1.875rem;
    --checkbox-size: var(--space-xl);

    /* Touch targets for mobile */
    --touch-target-min: 2.25rem;
}

/* =============================================
   BASE STYLES
   ============================================= */
.fm-settings-container {
    font-family: var(--font-family);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    min-block-size: 100vh;
    padding: var(--space-sm);
}

.fm-settings-container * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

.fm-settings-container button {
    font-family: inherit;
    background: none;
    border: none;
    cursor: pointer;
}

/* =============================================
   LAYOUT COMPONENTS
   ============================================= */
.fm-settings-container .settings-layout {
    display: flex;
    flex-direction: column;
}

/* =============================================
   SETTINGS GROUPS
   ============================================= */
.fm-settings-container .settings-group {
    background: var(--color-bg-card);
    border: var(--border-width-thin) solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: var(--space-md);
    margin-block-end: var(--space-md);
}

.fm-settings-container .settings-group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-block-end: var(--space-md);
    padding-block-end: var(--space-sm);
    border-block-end: var(--border-width-thin) solid var(--color-border);
    flex-wrap: wrap;
}

.fm-settings-container .settings-group-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.fm-settings-container .settings-group-icon {
    color: var(--color-accent);
}

/* =============================================
   FIELD SYSTEM
   ============================================= */
.fm-settings-container .field {
    display: grid;
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) minmax(0, 1fr);
    gap: var(--space-md);
    align-items: center;
    margin-block-end: var(--space-sm);
}

.fm-settings-container .field:last-child {
    margin-block-end: 0;
}

/* Field modifiers */
.fm-settings-container .field--checkbox {
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) auto;
}

.fm-settings-container .field--actions {
    grid-template-columns: minmax(var(--label-min-width), var(--label-max-width)) auto;
}

.fm-settings-container .field--actions .field-label {
    visibility: hidden;
}

/* =============================================
   FIELD LABELS
   ============================================= */
.fm-settings-container .field-label {
    text-align: right;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-end: var(--space-sm);
}

.fm-settings-container .field-label a {
    color: var(--color-link);
    text-decoration: none;
}

.fm-settings-container .field-label a:hover {
    color: var(--color-link-hover);
    text-decoration: underline;
}

/* Service item labels (checkbox labels) */
.fm-settings-container .service-item .field-label {
    cursor: pointer;
    text-align: left;
    white-space: normal;
}

/* =============================================
   FIELD VALUES & INPUTS
   ============================================= */
.fm-settings-container .field-value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
}

/* Checkbox inputs */
.fm-settings-container .field input[type='checkbox'] {
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    cursor: pointer;
    accent-color: var(--color-accent);
    grid-column: 2;
    justify-self: start;
}

.fm-settings-container .field input[type='checkbox']:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: 2px;
}

/* Disabled input styling */
.fm-settings-container .field-input:disabled,
.fm-settings-container .service-item input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.fm-settings-container .field-input:disabled:focus,
.fm-settings-container .service-item input[type='checkbox']:disabled:focus {
    border-color: var(--color-border-input);
    outline: none;
}

/* Text inputs */
.fm-settings-container .field-input {
    padding: var(--input-padding-block) var(--input-padding-inline);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    border: var(--border-width-thin) solid var(--color-border-input);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-base);
    font-family: inherit;
}

.fm-settings-container .field-input:focus {
    outline: none;
    border-color: var(--color-accent);
}

.fm-settings-container .field-input:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: -1px;
}

/* Placeholder styling */
.fm-settings-container .field-input::placeholder {
    color: var(--color-text-muted);
    opacity: 1;
}

/* Select inputs */
.fm-settings-container select.field-input {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.625rem center;
    padding-inline-end: var(--select-padding-end);
}

/* Short input fields */
.fm-settings-container .field-input.short {
    width: var(--input-short-width);
    min-inline-size: var(--input-short-width);
    max-inline-size: var(--input-short-width);
    flex: none;
}

/* Input with suffix container */
.fm-settings-container .input-with-suffix {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    white-space: nowrap;
}

/* Suffix text */
.fm-settings-container .field-suffix {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
}

/* =============================================
   CHECKBOX GROUPS & SERVICE ITEMS
   ============================================= */
.fm-settings-container .service-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.fm-settings-container .checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
    align-items: center;
}

/* =============================================
   ACTION BUTTONS
   ============================================= */
.fm-settings-container .action-btn {
    padding: var(--space-xs) var(--space-md);
    background: transparent;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    border: var(--border-width-thin) solid var(--color-border-input);
    border-radius: var(--border-radius-sm);
    display: inline-block;
    white-space: nowrap;
    transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
}

.fm-settings-container .action-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-input);
    border-color: var(--color-accent);
}

.fm-settings-container .action-btn:active {
    color: var(--color-accent);
    background: var(--color-border);
}

.fm-settings-container .action-btn:focus-visible {
    outline: var(--focus-outline-width) solid var(--color-accent);
    outline-offset: 2px;
}

.fm-settings-container .field--actions .action-btn {
    grid-column: 2;
    justify-self: start;
    width: var(--btn-action-width);
}

/* =============================================
   RESPONSIVE LAYOUT
   ============================================= */
@media (max-inline-size: 40rem) {
    .fm-settings-container .field {
        align-items: start;
    }

    .fm-settings-container .field-label {
        text-align: left;
        white-space: normal;
        padding-inline-end: var(--space-md);
        margin-top: 0;
    }

    /* Text input rows: align label with input text baseline */
    .fm-settings-container .field:not(.field--checkbox):not(.field--actions) .field-label {
        margin-top: 0;
    }

    .fm-settings-container .field:not(.field--checkbox):not(.field--actions) {
        align-items: baseline;
    }

    .fm-settings-container .field-value,
    .fm-settings-container .checkboxes {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-sm);
        width: 100%;
    }

    .fm-settings-container .field-input {
        width: 100%;
        min-block-size: var(--touch-target-min);
    }

    .fm-settings-container .input-with-suffix {
        width: 100%;
    }

    .fm-settings-container .field input[type='checkbox'],
    .fm-settings-container .service-item input[type='checkbox'] {
        margin-top: 0;
    }

    .fm-settings-container .service-item {
        justify-content: flex-start;
        align-items: flex-start;
        width: 100%;
    }

    .fm-settings-container .field--actions .action-btn {
        grid-column: 2;
        justify-self: start;
        width: var(--btn-action-width);
        min-block-size: var(--touch-target-min);
    }
}

/* =============================================
   STATUS & NOTIFICATIONS
   ============================================= */
.fm-settings-container .status {
    text-align: center;
    margin-block-start: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    min-block-size: var(--space-xl);
}

.fm-settings-container .status--success {
    color: var(--color-success);
}

.fm-settings-container .status--error {
    color: var(--color-error);
}

/* =============================================
   UTILITY: Visually Hidden
   ============================================= */
.fm-settings-container .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
    padding: 0;
}
`;
