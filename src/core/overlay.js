/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { interpolateColor } from './color-utils.js';
import {
    RATING_COLOR_GREEN,
    RATING_COLOR_HIGH_THRESHOLD,
    RATING_COLOR_LOW_THRESHOLD,
    RATING_COLOR_RED,
} from './constants.js';
import { buildOverlayStyles } from './ui/overlay-styles.js';

/**
 * @typedef {Object} ServicePresentation
 * @property {string[]} [TOP_10_SELECTORS]
 * @property {string} [TOP_10_OFFSET]
 */

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
     * @param {import('./config-manager.js').ConfigManager} config - Application configuration
     * @param {ServicePresentation} [serviceConstants={}] - Service-specific presentation constants.
     */
    constructor(config, serviceConstants = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

    injectStyles() {
        const existing = document.getElementById('fm-overlay-styles');
        const cssText = buildOverlayStyles({
            overlayClass: this.#OVERLAY_CLASS,
            corner: this.#config.get('overlayCorner'),
            top10Selectors: this.#serviceConstants.TOP_10_SELECTORS,
            top10Offset: this.#serviceConstants.TOP_10_OFFSET,
        });
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
        let tooltipContent = 'IMDb: Not found · Search IMDb';
        if (titleParts.length) {
            tooltipContent = `${titleParts.join(' · ')} · Open IMDb`;
        } else if (imdbId) {
            tooltipContent = 'IMDb: No rating · Open IMDb';
        }

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
        if (rating !== null && rating !== undefined) {
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
        if (this.#config.getBool('showRtRating') && rtRating !== null && rtRating !== undefined) {
            const formatted = this.#formatPercentRating(rtRating);
            container.appendChild(addStopPropagation(this.#createRatingElement('RT', formatted, 'fm-rt')));
        }

        // MC
        if (this.#config.getBool('showMcRating') && mcRating !== null && mcRating !== undefined) {
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
