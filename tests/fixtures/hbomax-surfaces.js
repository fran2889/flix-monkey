/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @type {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} */
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
  }
];
