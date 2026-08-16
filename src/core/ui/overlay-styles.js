/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Builds the CSS used to render rating overlays.
 *
 * @param {object} options - Overlay style options.
 * @param {string} options.overlayClass - Rating overlay class name.
 * @param {string} options.corner - Configured overlay corner.
 * @param {string[]} [options.top10Selectors=[]] - Ranked-card selectors requiring an offset.
 * @param {string} [options.top10Offset='50%'] - Horizontal offset for ranked cards.
 * @returns {string} CSS for the rating overlay.
 */
export function buildOverlayStyles({ overlayClass, corner, top10Selectors = [], top10Offset = '50%' }) {
    const cornerStyles = {
        'top-left': 'top:6px;left:6px;',
        'top-right': 'top:6px;right:6px;',
        'bottom-left': 'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };
    const resolvedCorner = Object.hasOwn(cornerStyles, corner) ? corner : 'top-left';
    const positionCss = cornerStyles[resolvedCorner];
    const flexDirection = resolvedCorner.includes('bottom') ? 'column-reverse' : 'column';
    let cssText = `
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
                background: rgba(0,0,0,0.72);
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
            .${overlayClass} a {
                cursor: pointer;
            }
            .${overlayClass} > *:hover { background: rgba(0,0,0,0.92); }
            .${overlayClass} .fm-label { font-size: 10px; letter-spacing: 0.03em; }
            .${overlayClass} .fm-imdb { color: #f5c518; }
            .${overlayClass} .fm-rt { color: #fa320a; }
            .${overlayClass} .fm-mc { color: #6ac; }
            .${overlayClass} .fm-value { color: #fff; }
            .${overlayClass} .fm-na { color: #aaa; }
            .${overlayClass} .fm-search { font-size: 11px; color: #ccc; }
        `;
    if (resolvedCorner.includes('left') && top10Selectors.length) {
        const selectors = top10Selectors.map(selector => `${selector} .${overlayClass}`);
        cssText += `\n            ${selectors.join(',\n            ')} { left: calc(${top10Offset} + 6px); }`;
    }
    cssText += `
            .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
            .fm-faded:hover { opacity: 1; }
        `;
    cssText += `
            .${overlayClass} .fm-fade-toggle {
                cursor: pointer;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s;
            }
            :hover > .${overlayClass} .fm-fade-toggle {
                opacity: 1;
                pointer-events: auto;
            }
            .${overlayClass} .fm-fade-toggle .fm-label { color: #aaa; }
            .${overlayClass} .fm-fade-toggle--faded { opacity: 0.35; }
        `;
    return cssText;
}
