/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Definition for discovering and processing surfaces on a streaming service.
 */
export interface SurfaceDefinition {
    /** CSS selector for title elements. */
    titleSelector: string;
    /** Returns the title text. */
    getTitle: (_element: Element) => string | null;
    /** Returns the container element. */
    getContainer: (_element: Element) => Element | null;
    /** Optional container decorator. */
    decorateContainer?: (_container: Element, _element: Element) => void;
    /** Whether this surface supports fading. Default: false */
    fadeable?: boolean;
    /** Whether to show fade toggle button. Default: false */
    showFadeToggle?: boolean;
}

/**
 * A surface discovered on the page.
 */
export interface DiscoveredSurface {
    container: Element;
    title: string;
    fadeable: boolean;
    showFadeToggle: boolean;
}
