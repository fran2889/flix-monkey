/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @type {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} */
export default [
  {
    name: "Netflix TITLE_CARD surface",
    html: `<div class="slider-item slider-item-0">
      <div class="title-card-container" data-uia="title-card-container">
        <div id="title-card-1-0" class="title-card">
          <div class="ptrack-content">
            <a href="/watch/80239866" role="link" aria-label="Sweet Magnolias" tabindex="0" class="slider-refocus">
              <div class="boxart-container boxart-rounded boxart-size-16x9">
                <img class="boxart-image boxart-image-in-padded-container" src="https://example.com/img.jpg" alt="">
              </div>
            </a>
          </div>
          <div class="bob-container"></div>
        </div>
      </div>
    </div>`,
    expected: {
      title: "Sweet Magnolias",
      fadeable: true,
      showFadeToggle: false
    }
  },
  {
    name: "Netflix SEARCH_CARD surface",
    html: `<div class="slider-item">
      <div data-uia="standard-card" aria-label="The Witcher" role="link" tabindex="0">
        <div class="boxart-container">
          <img class="boxart-image" src="https://example.com/img.jpg" alt="">
        </div>
      </div>
    </div>`,
    expected: {
      title: "The Witcher",
      fadeable: true,
      showFadeToggle: false
    }
  },
  {
    name: "Netflix PROGRESS_CARD surface",
    html: `<div class="ptrack-container">
      <div data-uia="progress-card" aria-label="Office Romance" class="profile-link">
        <div class="boxart-container">
          <img class="boxart-image" src="https://example.com/img.jpg" alt="">
        </div>
      </div>
    </div>`,
    expected: {
      title: "Office Romance",
      fadeable: true,
      showFadeToggle: false
    }
  },
  {
    name: "Netflix RANKED_CARD surface",
    html: `<div class="ranked-card-container">
      <div data-uia="ranked-card" aria-label="Stranger Things" class="ranked-card">
        <div class="boxart-container">
          <img class="boxart-image" src="https://example.com/img.jpg" alt="">
        </div>
        <div class="ranked-card-badge"></div>
      </div>
    </div>`,
    expected: {
      title: "Stranger Things",
      fadeable: true,
      showFadeToggle: false
    }
  },
  {
    name: "Netflix PREVIEW_MINI surface",
    html: `<div class="previewModal--wrapper mini-modal" data-uia="previewModal">
      <div class="previewModal--player_container">
        <img alt="It's Complicated" src="https://example.com/img.jpg">
      </div>
    </div>`,
    expected: {
      title: "It's Complicated",
      fadeable: false,
      showFadeToggle: true
    }
  },
  {
    name: "Netflix PREVIEW_DETAIL surface",
    html: `<div class="previewModal--wrapper detail-modal" data-uia="previewModal">
      <div class="previewModal--player_container">
        <img alt="The Crown" src="https://example.com/img.jpg">
      </div>
    </div>`,
    expected: {
      title: "The Crown",
      fadeable: false,
      showFadeToggle: false
    }
  }
];
