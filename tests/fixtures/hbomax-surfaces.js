/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @type {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean, overlayOffset?: string}}>} */
export default [
  {
    name: "HBO Max TILE surface",
    html: `<div class="hbo-card">
      <a data-testid="movie_tile" data-sonic-type="movie" aria-label="The Last of Us. 1 of 5.">
        <img src="https://example.com/img.jpg" alt="">
      </a>
    </div>`,
    expected: {
      title: "The Last of Us",
      fadeable: true,
      showFadeToggle: true
    }
  },
  {
    name: "HBO Max TOP_10_TILE surface",
    html: `<div class="hbo-card">
      <a data-testid="ranked_tile" data-sonic-type="show" aria-label="\u2066\u2068Number 1: House of the Dragon. 1 of 10.">
        <img src="https://example.com/img.jpg" alt="">
      </a>
    </div>`,
    expected: {
      title: "House of the Dragon",
      fadeable: true,
      showFadeToggle: true,
      overlayOffset: '30%'
    }
  }
];
