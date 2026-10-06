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

export const FADE_STATE_LABELS = Object.freeze({
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
});

/**
 * Creates a badge element with label and value spans.
 *
 * @param {string} label - Badge label text.
 * @param {string} value - Badge value text.
 * @param {string} labelClassName - CSS class for label span.
 * @param {string} valueClassName - CSS class for value span.
 * @returns {HTMLElement} Badge container element.
 */
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

/**
 * Creates a rating badge with color based on the rating value.
 *
 * @param {string} label - Rating label text.
 * @param {string} value - Rating value text.
 * @param {string} className - CSS class for the label span.
 * @returns {HTMLElement} Rating badge element with gradient color.
 */
function createRatingElement(label, value, className) {
    const el = createBadgeElement(label, value, className, 'fm-value');

    // Apply gradient color to rating values
    const numericValue = Number(value.replace('%', ''));
    const isPercentage = value.includes('%');
    el.lastChild.style.color = calculateRatingColor(numericValue, isPercentage);

    return el;
}

/**
 * Creates a badge indicating a rating is not available.
 *
 * @param {string} label - Rating label text.
 * @param {string} className - CSS class for the label span.
 * @returns {HTMLElement} Badge element displaying 'N/A'.
 */
function createMissingRatingElement(label, className) {
    return createBadgeElement(label, 'N/A', className, 'fm-na');
}

/**
 * Creates a badge with search icon for titles needing IMDb lookup.
 *
 * @param {string} label - Rating label text.
 * @param {string} className - CSS class for the label span.
 * @returns {HTMLElement} Badge element with search icon.
 */
function createSearchRatingElement(label, className) {
    return createBadgeElement(label, '🔍', className, 'fm-search');
}

/**
 * Creates a toggle button for controlling overlay fade behavior.
 *
 * @param {string|null} state - Current fade state ('auto', 'always', 'never') or null for default.
 * @param {(element: HTMLElement) => void} onClick - Click handler for the toggle.
 * @returns {HTMLElement} Fade toggle button element.
 */
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

/**
 * @param {number} rating - Rating, already normalised to a number by `Title` or `Number()`.
 * @param {boolean} isPercentage - True when `rating` is a 0-100 percentage rather than a 0-10 score.
 * @returns {string} CSS colour for the rating.
 */
function calculateRatingColor(rating, isPercentage) {
    const low = isPercentage ? RATING_COLOR_LOW_THRESHOLD * 10 : RATING_COLOR_LOW_THRESHOLD;
    const high = isPercentage ? RATING_COLOR_HIGH_THRESHOLD * 10 : RATING_COLOR_HIGH_THRESHOLD;

    if (rating <= low) return RATING_COLOR_RED;
    if (rating >= high) return RATING_COLOR_GREEN;

    const progress = (rating - low) / (high - low);
    return interpolateColor(progress, RATING_COLOR_RED, RATING_COLOR_GREEN);
}

/**
 * Formats an IMDb rating for display, rounding to one decimal place.
 *
 * @param {number|string} rating - The rating to format.
 * @returns {string} Formatted rating string.
 */
function formatImdbRating(rating) {
    if (typeof rating !== 'number') return String(rating);
    return rating.toFixed(1);
}

/**
 * Formats a rating as a percentage string.
 *
 * @param {number|string} rating - The rating to format.
 * @returns {string} Percentage-formatted rating string.
 */
function formatPercentRating(rating) {
    if (typeof rating !== 'number') return String(rating);
    return `${rating}%`;
}

/**
 * Formats a vote count with abbreviations for large numbers (k, M).
 *
 * @param {number|null|undefined} count - The vote count to format.
 * @returns {string} Formatted vote count string, empty for invalid values.
 */
function formatVoteCount(count) {
    if (count === null || count === undefined) return '';
    const num = Number(count);
    if (Number.isNaN(num) || num < 0) return '';
    if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(Math.round(num));
}

/**
 * Builds tooltip text combining title info and rating source details.
 *
 * @param {string[]} titleParts - Array of tooltip segments for ratings.
 * @param {string|null} imdbId - IMDb ID for the title.
 * @param {string|null} apiTitle - Title from the API.
 * @param {string|null} year - Release year of the title.
 * @returns {string} Complete tooltip text.
 */
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

/**
 * Appends the IMDb rating badge to the link and builds tooltip parts.
 *
 * @param {HTMLElement} imdbLink - The IMDb link element to append to.
 * @param {import('../title.js').Title} title - Title with rating data.
 * @returns {string[]} Array of tooltip segments for ratings.
 */
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

/**
 * Creates a rating badge only if rating should be shown and exists.
 *
 * @param {string} label - Rating label text.
 * @param {number|null} rating - Rating value to display.
 * @param {string} className - CSS class for the label span.
 * @param {boolean} showRating - Whether the rating should be displayed.
 * @returns {HTMLElement|null} Rating badge element or null.
 */
function createOptionalRatingBadge(label, rating, className, showRating) {
    if (!showRating || rating === null || rating === undefined) return null;
    const formatted = formatPercentRating(rating);
    const badge = createRatingElement(label, formatted, className);
    badge.classList.add('fm-rating-badge');
    badge.addEventListener('click', e => e.stopPropagation());
    return badge;
}

/**
 * Sets up delayed hover actions to show/hide the actions container.
 *
 * @param {HTMLElement} ratingsWrapper - Container that triggers hover.
 * @param {HTMLElement} actionsContainer - Container to show on hover.
 */
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

/**
 * Appends fade toggle button to container if fade toggle is enabled.
 *
 * @param {HTMLElement} container - Container to append the toggle to.
 * @param {boolean} showFadeToggle - Whether to show the fade toggle.
 * @param {string|null} fadeToggleState - Current fade state.
 * @param {(element: HTMLElement) => void|null} onFadeToggleClick - Click handler for fade toggle.
 */
function appendFadeToggle(container, showFadeToggle, fadeToggleState, onFadeToggleClick) {
    if (showFadeToggle && onFadeToggleClick) {
        container.appendChild(createFadeToggle(fadeToggleState, onFadeToggleClick));
    }
}

/**
 * Builds the full rating overlay DOM element with ratings, fade controls, and action buttons.
 *
 * @param {import('../title.js').Title} title - Title and rating data to display.
 * @param {object} options - Overlay presentation options.
 * @param {string} options.overlayClass - CSS class assigned to the overlay.
 * @param {boolean} options.showRtRating - Whether to display Rotten Tomatoes ratings.
 * @param {boolean} options.showMcRating - Whether to display Metacritic ratings.
 * @param {boolean} options.showFadeToggle - Whether fade toggles are enabled.
 * @param {'auto'|'always'|'never'|null} options.fadeToggleState - Current fade override state.
 * @param {((element: HTMLElement) => void)|null} options.onFadeToggleClick - Fade-toggle click handler.
 * @param {string} options.corner - The overlay corner position (e.g., 'top-left', 'top-right').
 * @param {((displayTitle: string) => void)|null} options.onEditClick - Edit icon click handler.
 * @param {((displayTitle: string) => void)|null} options.onRefreshClick - Refresh icon click handler.
 * @param {string} options.displayTitle - The display title for this overlay.
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

    if (onEditClick) {
        const editIcon = createIconButton('✏️', 'Override IMDb ID', () => onEditClick(displayTitle, imdbId ?? null));
        const refreshIcon = createIconButton('🔄', 'Refresh ratings (clears cache)', () =>
            onRefreshClick(displayTitle)
        );
        actionsContainer.appendChild(editIcon);
        actionsContainer.appendChild(refreshIcon);
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

/**
 * Creates an IMDb link element with appropriate styling and behavior.
 *
 * @param {string} href - The IMDb URL for the link.
 * @returns {HTMLAnchorElement} IMDb link element.
 */
function createImdbLink(href) {
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = href;
    link.classList.add('fm-rating-badge', 'fm-imdb');
    link.addEventListener('click', e => e.stopPropagation());
    return link;
}

/**
 * Creates an icon button with emoji and click handler.
 *
 * @param {string} emoji - The emoji character to display.
 * @param {string} titleText - Tooltip text for the button.
 * @param {() => void} onClick - Click handler for the button.
 * @returns {HTMLElement} Icon button element.
 */
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
 * @param {string} overlayClass - CSS class assigned to all overlays.
 * @param {string} loadingClass - CSS class identifying loading overlays.
 * @param {string} displayTitle - Title as shown by the streaming service, used as the IMDb search term.
 * @returns {HTMLElement} Loading overlay element.
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
