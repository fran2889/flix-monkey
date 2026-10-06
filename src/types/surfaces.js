/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Definition for discovering and processing surfaces on a streaming service.
 * @typedef {object} SurfaceDefinition
 * @property {readonly string} titleSelector - CSS selector for title elements.
 * @property {readonly (element: Element) => string|null|undefined} getTitle - Returns the title text.
 * @property {readonly (element: Element) => Element|null|undefined} getContainer - Returns the container element.
 * @property {readonly (container: Element, element: Element) => void} [decorateContainer] - Optional container decorator.
 * @property {readonly boolean} [fadeable=false] - Whether this surface supports fading.
 * @property {readonly boolean} [showFadeToggle=false] - Whether to show fade toggle button.
 */

/**
 * A surface discovered on the page.
 * @typedef {object} DiscoveredSurface
 * @property {readonly Element} container
 * @property {readonly string} title
 * @property {readonly boolean} fadeable
 * @property {readonly boolean} showFadeToggle
 */

export {};
