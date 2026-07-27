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
import { interpolateColor } from './color-utils.js';
import {
    RATING_COLOR_GREEN,
    RATING_COLOR_HIGH_THRESHOLD,
    RATING_COLOR_LOW_THRESHOLD,
    RATING_COLOR_RED,
} from './constants.js';

export const FADE_STATE_LABELS = {
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
};

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #serviceConstants;

    /**
     * @param {ConfigManager} config - Application configuration
     * @param {Object} [serviceConstants={}] - Service-specific constants (e.g., TOP_10_BADGE)
     */
    constructor(config, serviceConstants = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

    injectStyles() {
        const existing = document.getElementById('fm-overlay-styles');
        const cornerStyles = {
            'top-left': 'top:6px;left:6px;',
            'top-right': 'top:6px;right:6px;',
            'bottom-left': 'bottom:6px;left:6px;',
            'bottom-right': 'bottom:6px;right:6px;',
        };
        const corner = this.#config.get('overlayCorner');
        const positionCss = cornerStyles[corner] ?? cornerStyles['top-left'];
        const flexDirection = corner.includes('bottom') ? 'column-reverse' : 'column';
        const TOP_10_BADGE = this.#serviceConstants.TOP_10_BADGE ?? 'title-card-top-10';
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
            .${this.#OVERLAY_CLASS} a {
                cursor: pointer;
            }
            .${this.#OVERLAY_CLASS} > *:hover { background: rgba(0,0,0,0.92); }
            .${this.#OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; }
            .${this.#OVERLAY_CLASS} .fm-imdb { color: #f5c518; }
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
            .${this.#OVERLAY_CLASS} .fm-fade-toggle { cursor: pointer; }
            .${this.#OVERLAY_CLASS} .fm-fade-toggle .fm-label { color: #aaa; }
            .${this.#OVERLAY_CLASS} .fm-fade-toggle--faded { opacity: 0.35; }
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

    clearAllOverlays() {
        document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => {
            el.parentElement?.removeAttribute(this.#OVERLAY_ATTR);
            el.remove();
        });
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
        const el = this.#createBadgeElement(label, value, className, 'fm-value');

        // Apply gradient color to rating values
        const numericValue = Number(value.replace('%', ''));
        const isPercentage = value.includes('%');
        const color = this.#calculateRatingColor(numericValue, isPercentage);
        if (color && el.lastChild) {
            el.lastChild.style.color = color;
        }

        return el;
    }

    #createMissingRatingElement(label, className = '') {
        return this.#createBadgeElement(label, 'N/A', className, 'fm-na');
    }

    #createSearchRatingElement(label, className = '') {
        return this.#createBadgeElement(label, '🔍', className, 'fm-search');
    }

    #createFadeToggle(state, onClick) {
        const el = document.createElement('div');
        el.className = 'fm-fade-toggle';
        el.dataset.state = state ?? 'auto';
        el.title = `Fade: ${FADE_STATE_LABELS[state ?? 'auto']}`;
        const label = document.createElement('span');
        label.className = 'fm-label';
        label.textContent = 'Fade ';
        const icon = document.createElement('span');
        icon.className = 'fm-fade-toggle-icon';
        icon.textContent = state === null ? '⭐' : '👁️';
        if (state === 'always') icon.classList.add('fm-fade-toggle--faded');
        el.appendChild(label);
        el.appendChild(icon);
        el.addEventListener('click', e => {
            e.stopPropagation();
            onClick(el);
        });
        return el;
    }

    #calculateRatingColor(rating, isPercentage = false) {
        if (rating === null || rating === undefined) return null;

        // Apply thresholds based on rating type
        const low = isPercentage ? RATING_COLOR_LOW_THRESHOLD * 10 : RATING_COLOR_LOW_THRESHOLD;
        const high = isPercentage ? RATING_COLOR_HIGH_THRESHOLD * 10 : RATING_COLOR_HIGH_THRESHOLD;

        if (rating <= low) return RATING_COLOR_RED;
        if (rating >= high) return RATING_COLOR_GREEN;

        const progress = (rating - low) / (high - low);
        return interpolateColor(progress, RATING_COLOR_RED, RATING_COLOR_GREEN);
    }

    #formatImdbRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return rating.toFixed(1);
    }

    #formatPercentRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return `${rating}%`;
    }

    #formatVoteCount(count) {
        if (count === null || count === undefined) return '';
        const num = Number(count);
        if (Number.isNaN(num) || num < 0) return '';
        if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
        if (num >= 1000) return `${Math.round(num / 1000)}k`;
        return String(Math.round(num));
    }

    #buildTooltip(titleParts, imdbId, apiTitle, year) {
        const tooltipContent = titleParts.length
            ? `${titleParts.join(' · ')} · Open IMDb`
            : imdbId
              ? 'IMDb: No rating · Open IMDb'
              : 'IMDb: Not found · Search IMDb';

        if (apiTitle) {
            const titleLine = year ? `${apiTitle} (${year})` : apiTitle;
            return `${titleLine}\n${tooltipContent}`;
        }
        return tooltipContent;
    }

    #createOverlay(titleObj) {
        const container = document.createElement('div');
        container.className = this.#OVERLAY_CLASS;

        const { rating, imdbId, rtRating, mcRating, imdbVotes, apiTitle, year } = titleObj;

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
            const votesStr = this.#formatVoteCount(imdbVotes);
            const voteText = votesStr ? ` (${votesStr} votes)` : '';
            imdbLink.appendChild(this.#createRatingElement('IMDb', formatted, 'fm-imdb'));
            titleParts.push(`IMDb: ${formatted}${voteText}`);
        } else if (imdbId) {
            imdbLink.appendChild(this.#createMissingRatingElement('IMDb', 'fm-imdb'));
        } else {
            imdbLink.appendChild(this.#createSearchRatingElement('IMDb', 'fm-imdb'));
        }
        container.appendChild(imdbLink);

        // RT
        // eslint-disable-next-line eqeqeq
        if (this.#config.getBool('showRtRating') && rtRating != null) {
            const formatted = this.#formatPercentRating(rtRating);
            container.appendChild(addStopPropagation(this.#createRatingElement('RT', formatted, 'fm-rt')));
        }

        // MC
        // eslint-disable-next-line eqeqeq
        if (this.#config.getBool('showMcRating') && mcRating != null) {
            const formatted = this.#formatPercentRating(mcRating);
            container.appendChild(addStopPropagation(this.#createRatingElement('MC', formatted, 'fm-mc')));
        }

        imdbLink.title = this.#buildTooltip(titleParts, imdbId, apiTitle, year);
        return container;
    }

    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    #createLoadingOverlay() {
        const container = document.createElement('div');
        container.className = `${this.#OVERLAY_CLASS} ${this.#LOADING_CLASS}`;
        container.appendChild(this.#createBadgeElement('IMDb', '⏳', 'fm-imdb', 'fm-search'));
        container.title = 'IMDb: Fetching ratings... * Search IMDb';
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

    injectOverlay(container, titleObj, fadeToggleState = null, onFadeToggleClick = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        const overlay = this.#createOverlay(titleObj);
        if (onFadeToggleClick && this.#config.getBool('enableFadeToggle')) {
            overlay.appendChild(this.#createFadeToggle(fadeToggleState, onFadeToggleClick));
        }
        container.appendChild(overlay);
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }
}
