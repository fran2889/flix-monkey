/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @type {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} */
export default [
  {
    name: "Disney+ SHELF_CARD surface",
    html: `<div data-testid="set-shelf-item" role="group">
      <a data-testid="set-item" data-item-id="movie-id" href="//en-gb/browse/entity-movie-id" aria-label="Subtitles Available Badge Avatar: Fire and Ash Rated 12+ Released 2025. Action and Adventure Select for details on this title.">
        <img alt="Avatar: Fire and Ash" />
      </a>
    </div>`,
    expected: {
      title: "Avatar: Fire and Ash",
      fadeable: true,
      showFadeToggle: true
    }
  },
  {
    name: "Disney+ CONTINUE_WATCHING surface",
    html: `<section data-testid="set-section" data-set-style="continue_watching">
      <div data-testid="set-shelf-item" role="group">
        <span data-testid="cw-set-item-wrapper">
          <a data-testid="set-item" data-item-id="continue-id" href="/play/continue-id" aria-label="How I Met Your Mother Season 1 Episode 1 Pilot 9 minutes remaining"><img alt="" /></a>
          <a data-testid="cw-set-item-metadata" href="/browse/entity-continue-id">
            <div>9m remaining</div>
            <div>How I Met Your Mother</div>
          </a>
        </span>
      </div>
    </section>`,
    expected: {
      title: "How I Met Your Mother",
      fadeable: true,
      showFadeToggle: true
    }
  }
];
