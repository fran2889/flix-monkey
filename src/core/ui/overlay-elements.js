/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import {
    HOVER_ACTION_DELAY_MS,
    RATING_COLOR_GREEN,
    RATING_COLOR_HIGH_THRESHOLD,
    RATING_COLOR_LOW_THRESHOLD,
    RATING_COLOR_RED,
} from '../constants.js';
import { buildImdbUrl, interpolateColor } from '../utils/index.js';

/**
 * @typedef {object} OverlayOptions
 * @property {string} overlayClass - CSS class assigned to the overlay.
 * @property {boolean} showRtRating - Whether to display Rotten Tomatoes ratings.
 * @property {boolean} showMcRating - Whether to display Metacritic ratings.
 * @property {boolean} showFadeToggle - Whether fade toggles are enabled.
 * @property {'auto'|'always'|'never'|null} fadeToggleState - Current fade override state.
 * @property {((element: HTMLElement) => void)|null} onFadeToggleClick - Fade-toggle click handler.
 * @property {string} corner - The overlay corner position (e.g., 'top-left', 'top-right').
 * @property {((displayTitle: string) => void)|null} onEditClick - Edit icon click handler.
 * @property {((displayTitle: string) => void)|null} onRefreshClick - Refresh icon click handler.
 * @property {string} displayTitle - The display title for this overlay.
 */

export const FADE_STATE_LABELS = Object.freeze({
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
});

function createBadgeElement(label, value, labelClassName, valueClassName) {
    const el = document.createElement('div');
    const spanLabel = document.createElement('span');
    spanLabel.className = `fm-label ${labelClassName}`;
    spanLabel.textContent = `${label} `;
    const spanValue = document.createElement('span');
    spanValue.className = valueClassName;
    spanValue.textContent = value;
    el.appendChild(spanLabel);
    el.appendChild(spanValue);
    return el;
}

function createRatingElement(label, value, className) {
    const el = createBadgeElement(label, value, className, 'fm-value');

    // Apply gradient color to rating values
    const numericValue = Number(value.replace('%', ''));
    const isPercentage = value.includes('%');
    el.lastChild.style.color = calculateRatingColor(numericValue, isPercentage);

    return el;
}

function createMissingRatingElement(label, className) {
    return createBadgeElement(label, 'N/A', className, 'fm-na');
}

function createSearchRatingElement(label, className) {
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

function calculateRatingColor(rating, isPercentage) {
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

function setupHoverActions(ratingsWrapper, actionsContainer) {
    let hoverTimeout = null;
    const clearHover = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        actionsContainer.classList.remove('fm-actions-visible');
    };
    ratingsWrapper.addEventListener('mouseenter', () => {
        clearHover();
        hoverTimeout = setTimeout(() => {
            actionsContainer.classList.add('fm-actions-visible');
        }, HOVER_ACTION_DELAY_MS);
    });
    ratingsWrapper.addEventListener('mouseleave', clearHover);
}

function appendFadeToggle(container, showFadeToggle, fadeToggleState, onFadeToggleClick) {
    if (showFadeToggle && onFadeToggleClick) {
        container.appendChild(createFadeToggle(fadeToggleState, onFadeToggleClick));
    }
}

/**
 * Builds the full rating overlay DOM element with ratings, fade controls, and action buttons.
 *
 * @param {import('../title.js').Title} title - Title and rating data to display.
 * @param {OverlayOptions} options - Overlay presentation options.
 * @returns {HTMLElement} Completed overlay element with all configured ratings and controls.
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
        corner,
        onEditClick,
        onRefreshClick,
        displayTitle,
    }
) {
    const container = document.createElement('div');
    container.className = overlayClass;
    container.classList.add(`fm-${corner}`);

    const { imdbId, rtRating, mcRating, apiTitle, year } = title;

    const ratingsWrapper = document.createElement('div');
    ratingsWrapper.className = 'fm-ratings-wrapper';

    const imdbRow = document.createElement('div');
    imdbRow.className = 'fm-imdb-row';

    const imdbLink = createImdbLink(title.imdbUrl);

    const titleParts = appendImdbRating(imdbLink, title);

    // Actions container: separate from IMDb badge with own background
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'fm-actions';

    if (onEditClick || onRefreshClick) {
        if (onEditClick) {
            actionsContainer.appendChild(createIconButton('✏️', 'Override IMDb ID', () => onEditClick(displayTitle)));
        }
        if (onRefreshClick) {
            actionsContainer.appendChild(
                createIconButton('🔄', 'Refresh ratings (clears cache)', () => onRefreshClick(displayTitle))
            );
        }
        imdbRow.appendChild(actionsContainer);
        setupHoverActions(ratingsWrapper, actionsContainer);
    }

    imdbRow.appendChild(imdbLink);
    ratingsWrapper.appendChild(imdbRow);

    const rtBadge = createOptionalRatingBadge('RT', rtRating, 'fm-rt', showRtRating);
    if (rtBadge) ratingsWrapper.appendChild(rtBadge);

    const mcBadge = createOptionalRatingBadge('MC', mcRating, 'fm-mc', showMcRating);
    if (mcBadge) ratingsWrapper.appendChild(mcBadge);

    container.appendChild(ratingsWrapper);

    imdbLink.title = buildTooltip(titleParts, imdbId, apiTitle, year);
    appendFadeToggle(ratingsWrapper, showFadeToggle, fadeToggleState, onFadeToggleClick);

    return container;
}

function createImdbLink(href) {
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = href;
    link.classList.add('fm-rating-badge', 'fm-imdb');
    link.addEventListener('click', e => e.stopPropagation());
    return link;
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

/**
 * Creates an overlay element displayed while rating data is loading. The badge
 * links to an IMDb search for the title, matching the completed badge of a
 * title with no rating, so it stays usable during a slow lookup.
 *
 * @param {string} overlayClass - Base CSS class assigned to all overlays.
 * @param {string} loadingClass - Additional CSS class identifying loading state overlays.
 * @param {string} displayTitle - Title as shown by the streaming service, used as the IMDb search term.
 * @returns {HTMLElement} Loading overlay element with spinning indicator.
 */
export function createLoadingOverlayElement(overlayClass, loadingClass, displayTitle) {
    const container = document.createElement('div');
    container.className = `${overlayClass} ${loadingClass}`;
    const link = createImdbLink(buildImdbUrl({ displayTitle }));
    link.appendChild(createBadgeElement('IMDb', '⏳', 'fm-imdb', 'fm-search'));
    container.appendChild(link);
    container.title = 'IMDb: Fetching ratings... · Search IMDb';
    return container;
}
