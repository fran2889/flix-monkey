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
    const { imdbRating, imdbId, imdbVotes } = title;
    const titleParts = [];
    if (imdbRating !== null && imdbRating !== undefined) {
        const formatted = formatImdbRating(imdbRating);
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

function createOptionalRatingBadge(label, rating, className, showRating) {
    if (!showRating || rating === null || rating === undefined) return null;
    const formatted = formatPercentRating(rating);
    const badge = createRatingElement(label, formatted, className);
    badge.classList.add('fm-rating-badge');
    badge.addEventListener('click', e => e.stopPropagation());
    return badge;
}

function setupHoverActions(ratingsWrapper, actionsContainer, delayMs = 1000) {
    let hoverTimeout = null;
    ratingsWrapper.addEventListener('mouseenter', () => {
        hoverTimeout = setTimeout(() => {
            actionsContainer.classList.add('fm-actions-visible');
        }, delayMs);
    });
    ratingsWrapper.addEventListener('mouseleave', () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        actionsContainer.classList.remove('fm-actions-visible');
    });
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
 * @param {((displayTitle: string) => void)|null} options.onEditClick - Edit icon click handler.
 * @param {((displayTitle: string) => void)|null} options.onRefreshClick - Refresh icon click handler.
 * @param {string} [options.displayTitle=''] - The display title for this overlay.
 * @param {string} [options.corner=''] - The overlay corner position (e.g., 'top-left', 'top-right').
 * @returns {HTMLElement} Completed overlay element.
 */
export function createOverlayElement(
    title,
    {
        overlayClass,
        showRtRating,
        showMcRating,
        showFadeToggle,
        fadeToggleState,
        onFadeToggleClick,
        onEditClick = null,
        onRefreshClick = null,
        displayTitle = '',
        corner = '',
    }
) {
    const container = document.createElement('div');
    container.className = overlayClass;
    if (corner) {
        container.classList.add(`fm-${corner}`);
    }

    const { imdbId, rtRating, mcRating, apiTitle, year } = title;

    // Ratings wrapper: hover target for all badges
    const ratingsWrapper = document.createElement('div');
    ratingsWrapper.className = 'fm-ratings-wrapper';

    // IMDb row: contains IMDb badge + actions
    const imdbRow = document.createElement('div');
    imdbRow.className = 'fm-imdb-row';

    // IMDb (Interactive Link)
    const imdbLink = document.createElement('a');
    imdbLink.target = '_blank';
    imdbLink.rel = 'noopener noreferrer';
    imdbLink.href = title.imdbUrl;
    imdbLink.addEventListener('click', e => e.stopPropagation());
    imdbLink.classList.add('fm-rating-badge', 'fm-imdb');

    const titleParts = appendImdbRating(imdbLink, title);

    // Actions container: separate from IMDb badge with own background
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'fm-actions';

    if (onEditClick && displayTitle) {
        const editIcon = createIconButton('✏️', 'Edit IMDb ID', () => onEditClick(displayTitle, imdbId));
        const refreshIcon = createIconButton('🔄', 'Refresh ratings', () => onRefreshClick(displayTitle));
        actionsContainer.appendChild(editIcon);
        actionsContainer.appendChild(refreshIcon);
        imdbRow.appendChild(actionsContainer);
        setupHoverActions(ratingsWrapper, actionsContainer, 1000);
    }

    imdbRow.appendChild(imdbLink);
    ratingsWrapper.appendChild(imdbRow);

    // RT
    const rtBadge = createOptionalRatingBadge('RT', rtRating, 'fm-rt', showRtRating);
    if (rtBadge) ratingsWrapper.appendChild(rtBadge);

    // MC
    const mcBadge = createOptionalRatingBadge('MC', mcRating, 'fm-mc', showMcRating);
    if (mcBadge) ratingsWrapper.appendChild(mcBadge);

    container.appendChild(ratingsWrapper);

    imdbLink.title = buildTooltip(titleParts, imdbId, apiTitle, year);
    appendFadeToggle(ratingsWrapper, showFadeToggle, fadeToggleState, onFadeToggleClick);

    return container;
}

function createIconButton(emoji, titleText, onClick) {
    const btn = document.createElement('span');
    btn.className = 'fm-icon-btn';
    btn.textContent = emoji;
    btn.title = titleText;
    btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function createIconBadge(emoji, titleText, onClick) {
    return createIconButton(emoji, titleText, onClick);
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
