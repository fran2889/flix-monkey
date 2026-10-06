/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

const CSS_VARS = `
    :root {
        --fm-bg-badge: rgba(0, 0, 0, 0.72);
        --fm-bg-badge-hover: rgba(0, 0, 0, 0.92);
        --fm-bg-icon-btn: rgba(40, 40, 40, 0.95);
        --fm-bg-icon-btn-hover: rgba(60, 60, 60, 0.95);
        --fm-bg-icon-btn-active: rgba(20, 20, 20, 0.95);
        --fm-font-badge: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        --fm-color-imdb: #f5c518;
        --fm-color-rt: #fa320a;
        --fm-color-mc: #6ac;
        --fm-color-value: #fff;
        --fm-color-na: #aaa;
        --fm-color-search: #ccc;
    }
`;

/**
 * Builds base CSS styles for the overlay container.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @param {string} positionCss - Position CSS properties.
 * @param {string} flexDirection - Flex direction value.
 * @returns {string} Base CSS styles string.
 */
function buildBaseStyles(overlayClass, positionCss, flexDirection) {
    return `
            ${CSS_VARS}
            .${overlayClass} {
                position: absolute;
                ${positionCss}
                z-index: 9999;
                display: flex;
                flex-direction: ${flexDirection};
                gap: 4px;
                pointer-events: none;
            }
            .${overlayClass} > * {
                pointer-events: auto;
            }
            .${overlayClass} a {
                cursor: pointer;
            }
            .${overlayClass} .fm-label { font-size: 10px; letter-spacing: 0.03em; }
            .${overlayClass} .fm-imdb { color: var(--fm-color-imdb); }
            .${overlayClass} .fm-rt { color: var(--fm-color-rt); }
            .${overlayClass} .fm-mc { color: var(--fm-color-mc); }
            .${overlayClass} .fm-value { color: var(--fm-color-value); }
            .${overlayClass} .fm-na { color: var(--fm-color-na); }
            .${overlayClass} .fm-search { font-size: 11px; color: var(--fm-color-search); }
        `;
}

/**
 * Builds CSS styles for Top 10 badge offset adjustments.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @param {string} corner - Badge corner position.
 * @param {string[]} top10Selectors - Selectors for Top 10 elements.
 * @param {string} top10Offset - Offset value for Top 10 badges.
 * @returns {string} Top 10 offset CSS styles string.
 */
function buildTop10OffsetStyles(overlayClass, corner, top10Selectors, top10Offset) {
    if (!corner.includes('left') || !top10Selectors?.length) return '';

    const selectors = top10Selectors.map(selector => `${selector} .${overlayClass}`);
    const offset = top10Offset ?? '50%';
    return `\n            ${selectors.join(',\n            ')} { left: calc(${offset} + 6px); }`;
}

/**
 * Builds CSS styles for fade animation.
 *
 * @returns {string} Fade CSS styles string.
 */
function buildFadeStyles() {
    return `
            .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
            .fm-faded:hover { opacity: 1; }
        `;
}

/**
 * Builds CSS styles for the fade toggle button.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Fade toggle CSS styles string.
 */
function buildFadeToggleStyles(overlayClass) {
    return `
            .${overlayClass} .fm-fade-toggle {
                background: var(--fm-bg-badge);
                font-family: var(--fm-font-badge);
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: pointer;
                pointer-events: none;
                transition: opacity 0.15s;
                display: flex;
                align-items: center;
                gap: 4px;
                opacity: 0;
            }
            .${overlayClass}:hover .fm-fade-toggle {
                opacity: 1;
                pointer-events: auto;
            }
            .${overlayClass} .fm-fade-toggle .fm-label { color: var(--fm-color-na); }
            .${overlayClass} .fm-fade-toggle--faded { opacity: 0.35; }
        `;
}

/**
 * Builds CSS styles for the ratings wrapper container.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Ratings wrapper CSS styles string.
 */
function buildRatingsWrapperStyles(overlayClass) {
    return `
            .${overlayClass} .fm-ratings-wrapper {
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: flex-start;
            }
        `;
}

/**
 * Builds CSS styles for the IMDb row layout.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} IMDb row CSS styles string.
 */
function buildImdbRowStyles(overlayClass) {
    return `
            .${overlayClass} .fm-imdb-row {
                display: flex;
                align-items: center;
                gap: 2px;
            }
            .${overlayClass} .fm-imdb-row .fm-imdb {
                order: 0;
            }
            .${overlayClass} .fm-imdb-row .fm-actions {
                order: 1;
            }
            .${overlayClass}.fm-top-right .fm-imdb-row .fm-imdb,
            .${overlayClass}.fm-bottom-right .fm-imdb-row .fm-imdb {
                order: 1;
            }
            .${overlayClass}.fm-top-right .fm-imdb-row .fm-actions,
            .${overlayClass}.fm-bottom-right .fm-imdb-row .fm-actions {
                order: 0;
            }
        `;
}

/**
 * Builds CSS styles for the action buttons container.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Actions CSS styles string.
 */
function buildActionsStyles(overlayClass) {
    return `
            .${overlayClass} .fm-actions {
                display: flex;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .${overlayClass} .fm-actions-visible {
                opacity: 1;
            }
        `;
}

/**
 * Builds CSS styles for icon buttons.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Icon button CSS styles string.
 */
function buildIconButtonStyles(overlayClass) {
    return `
            .${overlayClass} .fm-icon-btn {
                background: var(--fm-bg-icon-btn);
                color: var(--fm-color-value);
                cursor: pointer;
                font-size: 0.8em;
                opacity: 0.9;
                pointer-events: auto;
                padding: 2px 4px;
                border-radius: 3px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, opacity 0.15s;
            }
            .${overlayClass} .fm-icon-btn:hover {
                background: var(--fm-bg-icon-btn-hover);
                opacity: 1;
            }
            .${overlayClass} .fm-icon-btn:active {
                background: var(--fm-bg-icon-btn-active);
            }
        `;
}

/**
 * Builds CSS styles for icon badges.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Icon badge CSS styles string.
 */
function buildIconBadgeStyles(overlayClass) {
    return `
            .${overlayClass} .fm-icon-badge {
                display: none;
                cursor: pointer;
                font-size: 0.8em;
                opacity: 0.8;
                pointer-events: auto;
                margin-left: 2px;
            }
            .${overlayClass} .fm-icon-badge:hover {
                opacity: 1;
            }
            .${overlayClass} a.fm-icons-visible .fm-icon-badge {
                display: inline;
            }
            .${overlayClass}.fm-top-right a .fm-icon-badge,
            .${overlayClass}.fm-bottom-right a .fm-icon-badge {
                order: -1;
            }
        `;
}

/**
 * Builds CSS styles for rating badges.
 *
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @returns {string} Rating badge CSS styles string.
 */
function buildRatingBadgeStyles(overlayClass) {
    return `
            .${overlayClass} .fm-rating-badge {
                background: var(--fm-bg-badge);
                font-family: var(--fm-font-badge);
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: default;
                text-decoration: none;
                white-space: nowrap;
                pointer-events: auto;
                transition: background 0.15s;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .${overlayClass} .fm-rating-badge:hover {
                background: var(--fm-bg-badge-hover);
            }
        `;
}

/**
 * @param {string} overlayClass - CSS class assigned to the overlay.
 * @param {'top-left'|'top-right'|'bottom-left'|'bottom-right'} corner - Badge corner,
 *   validated against `CONFIG_SELECT_ALLOWED.overlayCorner` by ConfigManager.
 */
export function buildOverlayStyles({ overlayClass, corner, top10Selectors = [], top10Offset = '50%' }) {
    const cornerStyles = {
        'top-left': 'top:6px;left:6px;',
        'top-right': 'top:6px;right:6px;',
        'bottom-left': 'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };
    const positionCss = cornerStyles[corner];
    const flexDirection = corner.includes('bottom') ? 'column-reverse' : 'column';
    return [
        buildBaseStyles(overlayClass, positionCss, flexDirection),
        buildTop10OffsetStyles(overlayClass, corner, top10Selectors, top10Offset),
        buildFadeStyles(),
        buildFadeToggleStyles(overlayClass),
        buildRatingsWrapperStyles(overlayClass),
        buildImdbRowStyles(overlayClass),
        buildRatingBadgeStyles(overlayClass),
        buildActionsStyles(overlayClass),
        buildIconButtonStyles(overlayClass),
        buildIconBadgeStyles(overlayClass),
    ].join('');
}
