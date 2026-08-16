/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { interpolateColor } from '../color-utils.js';
import {
    RATING_COLOR_GREEN,
    RATING_COLOR_HIGH_THRESHOLD,
    RATING_COLOR_LOW_THRESHOLD,
    RATING_COLOR_RED,
} from '../constants.js';

export const FADE_STATE_LABELS = Object.freeze({
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
});

function createBadgeElement(label, value, labelClassName = '', valueClassName = '') {
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

function createRatingElement(label, value, className = '') {
    const el = createBadgeElement(label, value, className, 'fm-value');

    // Apply gradient color to rating values
    const numericValue = Number(value.replace('%', ''));
    const isPercentage = value.includes('%');
    const color = calculateRatingColor(numericValue, isPercentage);
    if (color && el.lastChild) {
        el.lastChild.style.color = color;
    }

    return el;
}

function createMissingRatingElement(label, className = '') {
    return createBadgeElement(label, 'N/A', className, 'fm-na');
}

function createSearchRatingElement(label, className = '') {
    return createBadgeElement(label, '🔍', className, 'fm-search');
}

function createFadeToggle(state, onClick) {
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

function calculateRatingColor(rating, isPercentage = false) {
    if (rating === null || rating === undefined) return null;

    // Apply thresholds based on rating type
    const low = isPercentage ? RATING_COLOR_LOW_THRESHOLD * 10 : RATING_COLOR_LOW_THRESHOLD;
    const high = isPercentage ? RATING_COLOR_HIGH_THRESHOLD * 10 : RATING_COLOR_HIGH_THRESHOLD;

    if (rating <= low) return RATING_COLOR_RED;
    if (rating >= high) return RATING_COLOR_GREEN;

    const progress = (rating - low) / (high - low);
    return interpolateColor(progress, RATING_COLOR_RED, RATING_COLOR_GREEN);
}

function formatImdbRating(rating) {
    if (typeof rating !== 'number') return String(rating);
    return rating.toFixed(1);
}

function formatPercentRating(rating) {
    if (typeof rating !== 'number') return String(rating);
    return `${rating}%`;
}

function formatVoteCount(count) {
    if (count === null || count === undefined) return '';
    const num = Number(count);
    if (Number.isNaN(num) || num < 0) return '';
    if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(Math.round(num));
}

function buildTooltip(titleParts, imdbId, apiTitle, year) {
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

function appendImdbRating(imdbLink, title) {
    const { rating, imdbId, imdbVotes } = title;
    const titleParts = [];
    if (rating !== null && rating !== undefined) {
        const formatted = formatImdbRating(rating);
        const votesStr = formatVoteCount(imdbVotes);
        const voteText = votesStr ? ` (${votesStr} votes)` : '';
        imdbLink.appendChild(createRatingElement('IMDb', formatted, 'fm-imdb'));
        titleParts.push(`IMDb: ${formatted}${voteText}`);
    } else if (imdbId) {
        imdbLink.appendChild(createMissingRatingElement('IMDb', 'fm-imdb'));
    } else {
        imdbLink.appendChild(createSearchRatingElement('IMDb', 'fm-imdb'));
    }
    return titleParts;
}

function appendOptionalRating(container, shouldShow, label, rating, className) {
    if (shouldShow && rating !== null && rating !== undefined) {
        const formatted = formatPercentRating(rating);
        const badge = createRatingElement(label, formatted, className);
        badge.addEventListener('click', e => e.stopPropagation());
        container.appendChild(badge);
    }
}

function appendFadeToggle(container, showFadeToggle, fadeToggleState, onFadeToggleClick) {
    if (showFadeToggle && onFadeToggleClick) {
        container.appendChild(createFadeToggle(fadeToggleState, onFadeToggleClick));
    }
}

/**
 * Creates a completed rating overlay element.
 *
 * @param {import('../title.js').Title} title - Title and rating data to display.
 * @param {object} options - Overlay presentation options.
 * @param {string} options.overlayClass - CSS class assigned to the overlay.
 * @param {boolean} options.showRtRating - Whether to display Rotten Tomatoes ratings.
 * @param {boolean} options.showMcRating - Whether to display Metacritic ratings.
 * @param {boolean} options.showFadeToggle - Whether fade toggles are enabled.
 * @param {'auto'|'always'|'never'|null} options.fadeToggleState - Current fade override state.
 * @param {((element: HTMLElement) => void)|null} options.onFadeToggleClick - Fade-toggle click handler.
 * @returns {HTMLElement} Completed overlay element.
 */
export function createOverlayElement(
    title,
    { overlayClass, showRtRating, showMcRating, showFadeToggle, fadeToggleState, onFadeToggleClick }
) {
    const container = document.createElement('div');
    container.className = overlayClass;

    const { imdbId, rtRating, mcRating, apiTitle, year } = title;

    // IMDb (Interactive Link)
    const imdbLink = document.createElement('a');
    imdbLink.target = '_blank';
    imdbLink.rel = 'noopener noreferrer';
    imdbLink.href = title.imdbUrl;
    imdbLink.addEventListener('click', e => e.stopPropagation());

    const titleParts = appendImdbRating(imdbLink, title);
    container.appendChild(imdbLink);

    // RT
    appendOptionalRating(container, showRtRating, 'RT', rtRating, 'fm-rt');

    // MC
    appendOptionalRating(container, showMcRating, 'MC', mcRating, 'fm-mc');

    imdbLink.title = buildTooltip(titleParts, imdbId, apiTitle, year);
    appendFadeToggle(container, showFadeToggle, fadeToggleState, onFadeToggleClick);
    return container;
}

/**
 * Creates an overlay element displayed while rating data is loading.
 *
 * @param {string} overlayClass - CSS class assigned to all overlays.
 * @param {string} loadingClass - CSS class identifying loading overlays.
 * @returns {HTMLElement} Loading overlay element.
 */
export function createLoadingOverlayElement(overlayClass, loadingClass) {
    const container = document.createElement('div');
    container.className = `${overlayClass} ${loadingClass}`;
    container.appendChild(createBadgeElement('IMDb', '⏳', 'fm-imdb', 'fm-search'));
    container.title = 'IMDb: Fetching ratings... * Search IMDb';
    return container;
}
