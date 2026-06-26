/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { TOP_10_BADGE } from './constants.js';

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;

    constructor(config) {
        this.#config = config;
    }

    injectStyles() {
        const existing = document.getElementById('fm-overlay-styles');
        const cornerStyles = {
            'top-left': 'top:6px;left:6px;',
            'top-right': 'top:6px;right:6px;',
            'bottom-left': 'bottom:6px;left:6px;',
            'bottom-right': 'bottom:6px;right:6px;',
        };
        const corner = this.#config.get('overlayCorner', 'top-left');
        const positionCss = cornerStyles[corner] ?? cornerStyles['top-left'];
        const flexDirection = corner.includes('bottom') ? 'column-reverse' : 'column';
        let cssText = `
            .${this.#OVERLAY_CLASS} {
                position: absolute;
                ${positionCss}
                z-index: 9999;
                display: flex;
                flex-direction: ${flexDirection};
                gap: 4px;
                pointer-events: none;
            }
            .${this.#OVERLAY_CLASS} > * {
                background: rgba(0,0,0,0.72);
                font-family: Arial, sans-serif;
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
            .${this.#OVERLAY_CLASS} a {
                pointer-events: auto;
                cursor: pointer;
            }
            .${this.#OVERLAY_CLASS} > *:hover { background: rgba(0,0,0,0.92); }
            .${this.#OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
            .${this.#OVERLAY_CLASS} .fm-rt { color: #fa320a; }
            .${this.#OVERLAY_CLASS} .fm-mc { color: #6ac; }
            .${this.#OVERLAY_CLASS} .fm-value { color: #fff; }
            .${this.#OVERLAY_CLASS} .fm-na { color: #aaa; }
            .${this.#OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
        `;
        if (corner.includes('left')) {
            cssText += `\n            .${TOP_10_BADGE} .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
        }
        cssText += `
            .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
            .fm-faded:hover { opacity: 1; }
        `;
        cssText += `
    .fm-fade-toggle {
        cursor: pointer;
        padding: 0;
        background: transparent !important;
    }
    .fm-fade-toggle:hover {
        background: transparent !important;
    }
    .fm-toggle-track {
        width: 41px;
        height: 15px;
        border-radius: 8px;
        background: rgba(255,255,255,0.25);
        position: relative;
    }
    .fm-toggle-knob {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        position: absolute;
        top: 1.5px;
        left: 2px;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        line-height: 1;
    }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob { transform: translateX(0); }
    .fm-fade-toggle[data-state="auto"] .fm-toggle-knob { transform: translateX(12px); }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob { transform: translateX(25px); }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob::after {
        content: '✕';
        color: #e53935;
    }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob::after {
        content: '✓';
        color: #43a047;
    }
        `;
        if (existing) {
            existing.textContent = cssText;
        } else {
            const style = document.createElement('style');
            style.id = 'fm-overlay-styles';
            style.textContent = cssText;
            document.head.appendChild(style);
        }
    }

    #createBadgeElement(label, value, labelClassName = '', valueClassName = '') {
        const el = document.createElement('div');
        const spanLabel = document.createElement('span');
        spanLabel.className = labelClassName ? `fm-label ${labelClassName}` : 'fm-label';
        spanLabel.textContent = `${label} `;
        const spanValue = document.createElement('span');
        spanValue.className = valueClassName;
        spanValue.textContent = value;
        el.appendChild(spanLabel);
        el.appendChild(spanValue);
        return el;
    }

    #createRatingElement(label, value, className = '') {
        return this.#createBadgeElement(label, value, className, 'fm-value');
    }

    #createMissingRatingElement(label, className = '') {
        return this.#createBadgeElement(label, 'N/A', className, 'fm-na');
    }

    #createSearchRatingElement(label, className = '') {
        return this.#createBadgeElement(label, '🔍', className, 'fm-search');
    }

    #formatImdbRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return rating.toFixed(1);
    }

    #formatPercentRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return `${rating}%`;
    }

    #buildTooltip(titleParts, imdbId) {
        if (titleParts.length) return `${titleParts.join(' · ')} – click to open IMDb`;
        if (imdbId) return 'No ratings available – click to open IMDb';
        return 'Not found on IMDb – click to search';
    }

    #createFadeToggle(initialState, onClick) {
        const toggle = document.createElement('div');
        toggle.className = 'fm-fade-toggle';
        toggle.dataset.state = initialState;

        const track = document.createElement('div');
        track.className = 'fm-toggle-track';

        const knob = document.createElement('div');
        knob.className = 'fm-toggle-knob';

        track.appendChild(knob);
        toggle.appendChild(track);

        let clicking = false;
        toggle.addEventListener('click', async e => {
            e.stopPropagation();
            if (clicking) return;
            clicking = true;
            try {
                await onClick();
            } finally {
                clicking = false;
            }
        });

        return toggle;
    }

    #createOverlay(titleObj, toggleOptions = null) {
        const container = document.createElement('div');
        container.className = this.#OVERLAY_CLASS;

        const { rating, imdbId, rtRating, mcRating } = titleObj;

        // Helper to add click handler for propagation
        const addStopPropagation = el => {
            el.addEventListener('click', e => e.stopPropagation());
            return el;
        };

        // IMDb (Interactive Link)
        const imdbLink = document.createElement('a');
        imdbLink.target = '_blank';
        imdbLink.rel = 'noopener noreferrer';
        imdbLink.href = titleObj.imdbUrl;
        imdbLink.addEventListener('click', e => e.stopPropagation());

        const titleParts = [];
        // eslint-disable-next-line eqeqeq
        if (rating != null) {
            const formatted = this.#formatImdbRating(rating);
            imdbLink.appendChild(this.#createRatingElement('IMDb', formatted));
            titleParts.push(`IMDb: ${formatted}`);
        } else if (imdbId) {
            imdbLink.appendChild(this.#createMissingRatingElement('IMDb'));
        } else {
            imdbLink.appendChild(this.#createSearchRatingElement('IMDb'));
        }
        container.appendChild(imdbLink);

        // RT
        // eslint-disable-next-line eqeqeq
        if (this.#config.get('showRtRating', true) && rtRating != null) {
            const formatted = this.#formatPercentRating(rtRating);
            container.appendChild(addStopPropagation(this.#createRatingElement('RT', formatted, 'fm-rt')));
            titleParts.push(`RT: ${formatted}`);
        }

        // MC
        // eslint-disable-next-line eqeqeq
        if (this.#config.get('showMcRating', true) && mcRating != null) {
            const formatted = this.#formatPercentRating(mcRating);
            container.appendChild(addStopPropagation(this.#createRatingElement('MC', formatted, 'fm-mc')));
            titleParts.push(`MC: ${formatted}`);
        }

        container.title = this.#buildTooltip(titleParts, imdbId);
        if (toggleOptions) {
            container.appendChild(this.#createFadeToggle(toggleOptions.state, toggleOptions.onClick));
        }
        return container;
    }

    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    #createLoadingOverlay() {
        const container = document.createElement('div');
        container.className = `${this.#OVERLAY_CLASS} ${this.#LOADING_CLASS}`;
        container.appendChild(this.#createBadgeElement('IMDb', '⏳', '', 'fm-search'));
        container.title = 'Fetching ratings… click to search IMDb';
        return container;
    }

    injectLoadingOverlay(container) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createLoadingOverlay());
    }

    removeLoadingOverlay(container) {
        container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
    }

    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    injectOverlay(container, titleObj, toggleOptions = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createOverlay(titleObj, toggleOptions));
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }
}
