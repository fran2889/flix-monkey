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
} from '../constants';
import type { Title } from '../title';
import { buildImdbUrl, interpolateColor } from '../utils/index';

/**
 * Options for creating overlay elements.
 */
export interface OverlayOptions {
    overlayClass: string;
    showRtRating: boolean;
    showMcRating: boolean;
    showFadeToggle: boolean;
    fadeToggleState: 'auto' | 'always' | 'never' | null;
    onFadeToggleClick: ((_element: HTMLElement) => void) | null;
    corner: string;
    onEditClick: (_displayTitle: string) => void;
    onRefreshClick: (_displayTitle: string) => void;
    displayTitle: string;
}

export const FADE_STATE_LABELS = Object.freeze({
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
} as const);

function createBadgeElement(label: string, value: string, labelClassName: string, valueClassName: string): HTMLElement {
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

function createRatingElement(label: string, value: string, className: string): HTMLElement {
    const el = createBadgeElement(label, value, className, 'fm-value');

    // Apply gradient color to rating values
    const numericValue = Number(value.replace('%', ''));
    const isPercentage = value.includes('%');
    (el.lastChild as HTMLElement).style.color = calculateRatingColor(numericValue, isPercentage);

    return el;
}

function createMissingRatingElement(label: string, className: string): HTMLElement {
    return createBadgeElement(label, 'N/A', className, 'fm-na');
}

function createSearchRatingElement(label: string, className: string): HTMLElement {
    return createBadgeElement(label, '🔍', className, 'fm-search');
}

function createFadeToggle(
    state: 'auto' | 'always' | 'never' | null | undefined,
    onClick: (_el: HTMLElement) => void
): HTMLElement {
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
    el.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        onClick(el);
    });
    return el;
}

function calculateRatingColor(rating: number, isPercentage: boolean): string {
    const low = isPercentage ? RATING_COLOR_LOW_THRESHOLD * 10 : RATING_COLOR_LOW_THRESHOLD;
    const high = isPercentage ? RATING_COLOR_HIGH_THRESHOLD * 10 : RATING_COLOR_HIGH_THRESHOLD;

    if (rating <= low) return RATING_COLOR_RED;
    if (rating >= high) return RATING_COLOR_GREEN;

    const progress = (rating - low) / (high - low);
    return interpolateColor(progress, RATING_COLOR_RED, RATING_COLOR_GREEN);
}

function formatImdbRating(rating: number | string | null): string {
    if (typeof rating !== 'number') return String(rating);
    return rating.toFixed(1);
}

function formatPercentRating(rating: number | string | null): string {
    if (typeof rating !== 'number') return String(rating);
    return `${rating}%`;
}

function formatVoteCount(count: number | null | undefined): string {
    if (count === null || count === undefined) return '';
    const num = Number(count);
    if (Number.isNaN(num) || num < 0) return '';
    if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(Math.round(num));
}

function buildTooltip(
    titleParts: string[],
    imdbId: string | null,
    apiTitle: string | null,
    year: number | null
): string {
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

function appendImdbRating(imdbLink: HTMLAnchorElement, title: Title): string[] {
    const { imdbRating, imdbId, imdbVotes } = title;
    const titleParts: string[] = [];
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

function createOptionalRatingBadge(
    label: string,
    rating: number | null | undefined,
    className: string,
    showRating: boolean
): HTMLElement | null {
    if (!showRating || rating === null || rating === undefined) return null;
    const formatted = formatPercentRating(rating);
    const badge = createRatingElement(label, formatted, className);
    badge.classList.add('fm-rating-badge');
    badge.addEventListener('click', (e: Event) => e.stopPropagation());
    return badge;
}

function setupHoverActions(ratingsWrapper: HTMLElement, actionsContainer: HTMLElement): void {
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    const clearHover = (): void => {
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

function appendFadeToggle(
    container: HTMLElement,
    showFadeToggle: boolean,
    fadeToggleState: 'auto' | 'always' | 'never' | null,
    onFadeToggleClick: ((_element: HTMLElement) => void) | null
): void {
    if (showFadeToggle && onFadeToggleClick) {
        container.appendChild(createFadeToggle(fadeToggleState, onFadeToggleClick));
    }
}

/**
 * Builds the full rating overlay DOM element with ratings, fade controls, and action buttons.
 *
 * @param title - Title and rating data to display.
 * @param options - Overlay presentation options.
 * @returns Completed overlay element with all configured ratings and controls.
 */
export function createOverlayElement(
    title: Title,
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
    }: OverlayOptions
): HTMLElement {
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

    const editIcon = createIconButton('✏️', 'Override IMDb ID', () => onEditClick(displayTitle));
    const refreshIcon = createIconButton('🔄', 'Refresh ratings (clears cache)', () => onRefreshClick(displayTitle));
    actionsContainer.appendChild(editIcon);
    actionsContainer.appendChild(refreshIcon);
    imdbRow.appendChild(actionsContainer);
    setupHoverActions(ratingsWrapper, actionsContainer);

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

function createImdbLink(href: string): HTMLAnchorElement {
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = href;
    link.classList.add('fm-rating-badge', 'fm-imdb');
    link.addEventListener('click', (e: Event) => e.stopPropagation());
    return link;
}

function createIconButton(emoji: string, titleText: string, onClick: () => void): HTMLSpanElement {
    const btn = document.createElement('span');
    btn.className = 'fm-icon-btn';
    btn.textContent = emoji;
    btn.title = titleText;
    btn.addEventListener('click', (e: Event) => {
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
 * @param overlayClass - Base CSS class assigned to all overlays.
 * @param loadingClass - Additional CSS class identifying loading state overlays.
 * @param displayTitle - Title as shown by the streaming service, used as the IMDb search term.
 * @returns Loading overlay element with spinning indicator.
 */
export function createLoadingOverlayElement(
    overlayClass: string,
    loadingClass: string,
    displayTitle: string
): HTMLElement {
    const container = document.createElement('div');
    container.className = `${overlayClass} ${loadingClass}`;
    const link = createImdbLink(buildImdbUrl({ displayTitle }));
    link.appendChild(createBadgeElement('IMDb', '⏳', 'fm-imdb', 'fm-search'));
    container.appendChild(link);
    container.title = 'IMDb: Fetching ratings... · Search IMDb';
    return container;
}
