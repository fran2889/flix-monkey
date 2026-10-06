/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Definition for discovering and processing surfaces on a streaming service.
 * @typedef {Object} SurfaceDefinition
 * @property {string} titleSelector - CSS selector for title elements.
 * @property {(element: Element) => string|null|undefined} getTitle - Returns the title text.
 * @property {(element: Element) => Element|null|undefined} getContainer - Returns the container element.
 * @property {(container: Element, element: Element) => void} [decorateContainer] - Optional container decorator.
 * @property {boolean} [fadeable=false] - Whether this surface supports fading.
 * @property {boolean} [showFadeToggle=false] - Whether to show fade toggle button.
 */

/**
 * A surface discovered on the page.
 * @typedef {Object} DiscoveredSurface
 * @property {Element} container
 * @property {string} title
 * @property {boolean} fadeable
 * @property {boolean} showFadeToggle
 */

export {};
