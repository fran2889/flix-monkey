/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, expect, it } from 'vitest';

import {
    extractHboMaxTitle,
    HboMaxSurfaceManager,
    NETFLIX_SURFACES,
    NetflixSurfaceManager,
    SurfaceManager,
} from '../../../src/core/surfaces.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('SurfaceManager', () => {
    function discover(html) {
        const sm = new SurfaceManager(NETFLIX_SURFACES, createMockLogger());
        document.body.innerHTML = html;
        return sm.discover(document.body);
    }

    it('should return empty array when no matching elements exist', () => {
        expect(discover('<div>nothing</div>')).toEqual([]);
    });

    it('should not discover preview modal surfaces without the scoped wrapper', () => {
        expect(
            discover(`
            <div class="previewModal--player_container">
                <img class="previewModal--boxart" alt="No wrapper">
            </div>
        `)
        ).toHaveLength(0);
    });

    it('should skip element with empty title', () => {
        expect(discover('<div class="title-card"><a aria-label="   "></a></div>')).toHaveLength(0);
    });

    it('should skip element with null title', () => {
        const mockEl = {
            closest: () => document.body,
            parentElement: document.body,
            getAttribute: () => null,
        };
        const sm = new SurfaceManager(NETFLIX_SURFACES, createMockLogger());
        expect(sm.discover({ querySelectorAll: () => [mockEl] })).toHaveLength(0);
    });

    it('should deduplicate when multiple title elements share the same container', () => {
        const results = discover(`
            <div class="title-card">
                <a aria-label="First"></a>
                <a aria-label="Second"></a>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('First');
    });

    it('should fall back to parentElement when containerSel does not match', () => {
        const logger = createMockLogger();
        const sm = new SurfaceManager(NETFLIX_SURFACES, logger);
        const fakeParent = document.createElement('div');
        fakeParent.className = 'orphan-parent';
        const mockTitleEl = {
            closest: () => null,
            parentElement: fakeParent,
            getAttribute: () => 'Orphan',
        };
        const results = sm.discover({ querySelectorAll: () => [mockTitleEl] });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan');
        expect(results[0].container).toBe(fakeParent);
        expect(logger.warn).toHaveBeenCalledWith('Surface container selector failed, falling back to parentElement', {
            selector: '.title-card',
        });
    });

    it('should return empty array when querySelectorAll throws', () => {
        const sm = new SurfaceManager(NETFLIX_SURFACES, createMockLogger());
        expect(
            sm.discover({
                querySelectorAll: () => {
                    throw new Error('fail');
                },
            })
        ).toEqual([]);
    });

    it('uses a surface getTitle callback', () => {
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    containerSelector: '[data-title]',
                    getTitle: el => el.dataset.title,
                },
            },
            createMockLogger()
        );
        document.body.innerHTML = '<div data-title="Callback Title"></div>';
        expect(sm.discover(document.body)[0].title).toBe('Callback Title');
    });

    it('uses a surface getContainer callback before the container selector', () => {
        const resolvedContainer = document.createElement('div');
        resolvedContainer.innerHTML = '<span data-title="Resolver Title"></span>';
        const selectorContainer = document.createElement('section');
        selectorContainer.dataset.selectorContainer = '';
        selectorContainer.appendChild(resolvedContainer);
        document.body.replaceChildren(selectorContainer);
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    containerSelector: '[data-selector-container]',
                    titleAttribute: 'data-title',
                    getContainer: element => element.parentElement,
                },
            },
            createMockLogger()
        );

        expect(sm.discover(document.body)[0].container).toBe(resolvedContainer);
    });

    it('uses the container selector when a surface getContainer callback returns null', () => {
        document.body.innerHTML = `
            <div data-container>
                <span data-title="Fallback Title"></span>
            </div>
        `;
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    containerSelector: '[data-container]',
                    titleAttribute: 'data-title',
                    getContainer: () => null,
                },
            },
            createMockLogger()
        );

        expect(sm.discover(document.body)[0].container).toBe(document.querySelector('[data-container]'));
    });

    it('should set showFadeToggle to false for title-card surfaces', () => {
        const results = discover(`
            <div class="title-card"><a aria-label="Movie"></a></div>
        `);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('should set showFadeToggle to false for search card surfaces', () => {
        const results = discover(`
            <div data-uia="standard-card" aria-label="Movie"></div>
        `);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('should set showFadeToggle to true for the mini-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Movie Title">
                </div>
            </div>
        `);
        expect(results[0].showFadeToggle).toBe(true);
    });

    it('should set showFadeToggle to false for the detail-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper detail-modal">
                <div class="previewModal--player_container">
                    <img alt="Movie Title">
                </div>
            </div>
        `);
        expect(results[0].showFadeToggle).toBe(false);
    });
});

describe('HBO Max surfaces', () => {
    it.each([
        ['\u2066\u2068Peacemaker\u2069\u2069. \u20682 of 20\u2069\u2069', 'Peacemaker'],
        ['Mr. & Mrs. Smith. 1 of 20.', 'Mr. & Mrs. Smith'],
    ])('extracts %s', (ariaLabel, expected) => {
        const tile = document.createElement('a');
        tile.dataset.sonicType = 'show';
        tile.setAttribute('aria-label', ariaLabel);
        expect(extractHboMaxTitle(tile)).toBe(expected);
    });

    it.each(['video', 'sport', 'topical'])('skips %s tiles', type => {
        document.body.innerHTML = `<a data-testid="id_tile" data-sonic-type="${type}" aria-label="Title. 1 of 20."></a>`;
        expect(new HboMaxSurfaceManager(createMockLogger()).discover(document.body)).toEqual([]);
    });

    it.each([
        ['a missing aria-label', undefined],
        ['a label without card-position metadata', 'Title'],
        ['incomplete card-position metadata', 'Title. 1 of'],
    ])('skips supported tiles with %s', (_description, ariaLabel) => {
        const tile = document.createElement('a');
        tile.dataset.testid = 'id_tile';
        tile.dataset.sonicType = 'movie';
        if (ariaLabel !== undefined) tile.setAttribute('aria-label', ariaLabel);
        document.body.replaceChildren(tile);

        expect(extractHboMaxTitle(tile)).toBeNull();
        expect(new HboMaxSurfaceManager(createMockLogger()).discover(document.body)).toEqual([]);
    });
});

describe('NetflixSurfaceManager', () => {
    function discoverNetflix(html) {
        const sm = new NetflixSurfaceManager(createMockLogger());
        document.body.innerHTML = html;
        return sm.discover(document.body);
    }

    it('should be a subclass of SurfaceManager', () => {
        const sm = new NetflixSurfaceManager(createMockLogger());
        expect(sm).toBeInstanceOf(SurfaceManager);
    });

    it('should use Netflix surface definitions', () => {
        const results = discoverNetflix(`
            <div class="title-card"><a aria-label="Test Movie"></a></div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Test Movie');
    });

    it('should discover title-card surfaces', () => {
        const results = discoverNetflix(`
            <div class="title-card"><a aria-label="Movie Title"></a></div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Movie Title');
        expect(results[0].fadeable).toBe(true);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('should discover search card surfaces', () => {
        const results = discoverNetflix(`
            <div data-uia="standard-card" aria-label="Search Result"></div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Search Result');
        expect(results[0].fadeable).toBe(true);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('should discover mini-modal surfaces', () => {
        const results = discoverNetflix(`
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Preview Title">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Preview Title');
        expect(results[0].fadeable).toBe(false);
        expect(results[0].showFadeToggle).toBe(true);
    });

    it('should discover detail-modal surfaces', () => {
        const results = discoverNetflix(`
            <div class="previewModal--wrapper detail-modal">
                <div class="previewModal--player_container">
                    <img alt="Detail Title">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Detail Title');
        expect(results[0].fadeable).toBe(false);
        expect(results[0].showFadeToggle).toBe(false);
    });
});
