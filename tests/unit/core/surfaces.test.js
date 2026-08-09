/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import {
    DisneyPlusSurfaceManager,
    extractDisneyPlusTitle,
    extractHboMaxTitle,
    HboMaxSurfaceManager,
    NETFLIX_SURFACES,
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

    it('should fall back to parentElement when the container resolver returns null', () => {
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
        expect(logger.warn).toHaveBeenCalledWith('Surface container resolver failed, falling back to parentElement');
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

    it('discovers the title returned by a surface definition', () => {
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    getTitle: el => el.dataset.title,
                    getContainer: element => element,
                },
            },
            createMockLogger()
        );
        document.body.innerHTML = '<div data-title="Callback Title"></div>';
        expect(sm.discover(document.body)[0].title).toBe('Callback Title');
    });

    it('defaults optional surface display flags to false', () => {
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    getTitle: element => element.dataset.title,
                    getContainer: element => element,
                },
            },
            createMockLogger()
        );
        document.body.innerHTML = '<div data-title="Default Flags"></div>';

        expect(sm.discover(document.body)[0]).toMatchObject({ fadeable: false, showFadeToggle: false });
    });

    it('returns the container resolved by a surface definition', () => {
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
                    getTitle: element => element.dataset.title,
                    getContainer: element => element.parentElement,
                },
            },
            createMockLogger()
        );

        expect(sm.discover(document.body)[0].container).toBe(resolvedContainer);
    });

    it('decorates a resolved container through the optional surface hook', () => {
        document.body.innerHTML = '<div data-container><span data-title="Decorated Title"></span></div>';
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    getTitle: element => element.dataset.title,
                    getContainer: element => element.parentElement,
                    decorateContainer: container => container.classList.add('decorated'),
                },
            },
            createMockLogger()
        );

        const [surface] = sm.discover(document.body);
        expect(surface.container).toHaveClass('decorated');
    });

    it('falls back to parentElement when a surface getContainer callback returns null', () => {
        document.body.innerHTML = `
            <div data-container>
                <span data-title="Fallback Title"></span>
            </div>
        `;
        const sm = new SurfaceManager(
            {
                card: {
                    titleSelector: '[data-title]',
                    getTitle: element => element.dataset.title,
                    getContainer: () => null,
                },
            },
            createMockLogger()
        );

        expect(sm.discover(document.body)[0].container).toBe(document.querySelector('[data-container]'));
    });

    it('does not expose a fade toggle for title cards', () => {
        const results = discover(`
            <div class="title-card"><a aria-label="Movie"></a></div>
        `);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('does not expose a fade toggle for search cards', () => {
        const results = discover(`
            <div data-uia="standard-card" aria-label="Movie"></div>
        `);
        expect(results[0].showFadeToggle).toBe(false);
    });

    it('exposes a fade toggle for mini-modal surfaces', () => {
        const results = discover(`
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Movie Title">
                </div>
            </div>
        `);
        expect(results[0].showFadeToggle).toBe(true);
    });

    it('does not expose a fade toggle for detail-modal surfaces', () => {
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
    it('marks show tiles as fadeable toggle surfaces', () => {
        document.body.innerHTML = `
            <div class="hbo-card">
                <a data-testid="movie_tile" data-sonic-type="show" aria-label="Movie. 1 of 20."></a>
            </div>
        `;

        const [surface] = new HboMaxSurfaceManager(createMockLogger()).discover(document.body);
        expect(surface).toMatchObject({ title: 'Movie', fadeable: true, showFadeToggle: true });
    });

    it.each([
        ['\u2066\u2068Peacemaker\u2069\u2069. \u20682 of 20\u2069\u2069', 'Peacemaker'],
        ['Mr. & Mrs. Smith. 1 of 20.', 'Mr. & Mrs. Smith'],
        ['Rooster. Row 1 of 8, Column 1 of 4', 'Rooster'],
        ['Watch Peacemaker. Season 1, Episode 2: Best Friends for Never. 1 of 2.', 'Peacemaker'],
        ['Watch Mel Brooks: The 99 Year Old Man!, Episode 2. 2 of 2.', 'Mel Brooks: The 99 Year Old Man!'],
        ['Number 1: House of the Dragon. 1 of 10.', 'House of the Dragon'],
    ])('extracts a title from a supported HBO Max label: %s', (ariaLabel, expected) => {
        const tile = document.createElement('a');
        tile.dataset.sonicType = ariaLabel.startsWith('Watch ') ? 'video' : 'show';
        tile.setAttribute('aria-label', ariaLabel);
        expect(extractHboMaxTitle(tile)).toBe(expected);
    });

    it('applies the HBO Top 10 positioning class to a ranked tile container', () => {
        document.body.innerHTML = `
            <div class="hbo-card">
                <a data-testid="ranked_tile" data-sonic-type="show" aria-label="Number 1: House of the Dragon. 1 of 10."></a>
            </div>
        `;

        const [surface] = new HboMaxSurfaceManager(createMockLogger()).discover(document.body);
        expect(surface.title).toBe('House of the Dragon');
        expect(surface.container.classList.contains('fm-hbo-top-10')).toBe(true);
    });

    it.each(['video', 'sport', 'topical'])('ignores unsupported HBO Max tile types: %s', type => {
        document.body.innerHTML = `<a data-testid="id_tile" data-sonic-type="${type}" aria-label="Title. 1 of 20."></a>`;
        expect(new HboMaxSurfaceManager(createMockLogger()).discover(document.body)).toEqual([]);
    });

    it.each([
        ['a missing aria-label', undefined],
        ['a label without card-position metadata', 'Title'],
        ['incomplete card-position metadata', 'Title. 1 of'],
        ['a malformed Continue Watching season label', 'Watch Promo. Season 1st Look. 1 of 2.'],
        ['a decimal Continue Watching season label', 'Watch Promo. Season 1.5. 1 of 2.'],
        ['a malformed Continue Watching episode label', 'Watch Promo. Episode 2nd Look. 1 of 2.'],
        ['a time-like Continue Watching episode label', 'Watch Promo. Episode 2:30. 1 of 2.'],
    ])('does not discover HBO Max tiles with unparseable labels: %s', (_description, ariaLabel) => {
        const tile = document.createElement('a');
        tile.dataset.testid = 'id_tile';
        tile.dataset.sonicType = ariaLabel?.startsWith('Watch ') ? 'video' : 'movie';
        if (ariaLabel !== undefined) tile.setAttribute('aria-label', ariaLabel);
        document.body.replaceChildren(tile);

        expect(extractHboMaxTitle(tile)).toBeNull();
        expect(new HboMaxSurfaceManager(createMockLogger()).discover(document.body)).toEqual([]);
    });
});

describe('Disney+ surfaces', () => {
    it.each([
        ['A Marvel Television Special Presentation \u2014 The Punisher: One Last Kill', 'The Punisher: One Last Kill'],
        ["Marvel Studios' The Avengers", 'The Avengers'],
        ['Star Wars: The Phantom Menace (Episode I)', 'Star Wars: Episode I - The Phantom Menace'],
        ['Star Wars: Attack of the Clones (Episode II)', 'Star Wars: Episode II - Attack of the Clones'],
    ])('canonicalizes the Disney+ title %s', (input, expected) => {
        const tile = document.createElement('a');
        tile.innerHTML = `<img alt="${input}">`;

        expect(extractDisneyPlusTitle(tile)).toBe(expected);
    });

    it.each([
        ['The Avengers', "New Movie Badge Marvel Studios' The Avengers Rated 12+"],
        ['The Devil Wears Prada 2', 'New Movie Badge The Devil Wears Prada 2 Rated 12+'],
        ['Furious', 'Hulu Original Series New Episode Badge Furious Rated 18+'],
        ['BLEACH: Thousand-Year Blood War', 'New Episode Badge BLEACH: Thousand-Year Blood War Rated 16+'],
        ['The Bear', 'Hulu Original Series Subtitles Available Badge The Bear'],
    ])('extracts the clean Disney+ title for %s', (title, ariaLabel) => {
        const tile = document.createElement('a');
        tile.setAttribute('aria-label', ariaLabel);
        tile.innerHTML = `<img alt=""><img alt="${title}">`;

        expect(extractDisneyPlusTitle(tile)).toBe(title);
    });

    it.each([
        [
            'Subtitles Available Badge Avatar: Fire and Ash Rated 12+ Released 2025. Action and Adventure Select for details on this title.',
            'Avatar: Fire and Ash',
        ],
        ['New Movie Badge The Devil Wears Prada 2 Select for details on this title.', 'The Devil Wears Prada 2'],
        ['New Episode Badge Furious Hulu Original Series Select for details on this title.', 'Furious'],
        ['New Season Peppa Pig Select for details on this title.', 'Peppa Pig'],
        [
            "New Badge Mickey Mouse Clubhouse+: Mickey's Country Farm Select for details on this title.",
            "Mickey Mouse Clubhouse+: Mickey's Country Farm",
        ],
        [
            'Disney+ Original Subtitles Available Badge Moon Knight Rated 16+ Released 2022. Super Heroes, Action and Adventure Select for details on this title.',
            'Moon Knight',
        ],
        ['The Doomies Disney+ Original Select for details on this title.', 'The Doomies'],
        ['Adults Hulu Original Series Select for details on this title.', 'Adults'],
        ['Moana Action and Adventure Select for details on this title.', 'Moana'],
        ['Lilo & Stitch Kids and Family Select for details on this title.', 'Lilo & Stitch'],
    ])('parses a Disney+ title from an accessible-name fallback: %s', (ariaLabel, expected) => {
        const tile = document.createElement('a');
        tile.setAttribute('aria-label', ariaLabel);
        tile.innerHTML = '<img alt="">';

        expect(extractDisneyPlusTitle(tile)).toBe(expected);
    });

    it.each([
        undefined,
        'LIVE Started 47 minutes ago Senior League Baseball Choose Feed Entry',
        'Upcoming 09/08 | 8:00pm New York XIST vs. Michigan Hybrid',
        'Avatar: Fire and Ash',
        'Select for details on this title.',
    ])('rejects unsupported Disney+ accessible-name fallbacks: %s', ariaLabel => {
        const tile = document.createElement('a');
        if (ariaLabel !== undefined) tile.setAttribute('aria-label', ariaLabel);
        tile.innerHTML = '<img alt="">';

        expect(extractDisneyPlusTitle(tile)).toBeNull();
    });

    it('uses the shelf-card parent as the fadeable Disney+ overlay container', () => {
        document.body.innerHTML = `
            <div data-testid="set-shelf-item">
                <a data-testid="set-item" data-item-id="id" href="//en-gb/browse/entity-id"
                   aria-label="Loki Disney+ Original Select for details on this title.">
                    <img alt="Loki">
                </a>
            </div>
        `;

        const [surface] = new DisneyPlusSurfaceManager(createMockLogger()).discover(document.body);
        expect(surface).toMatchObject({ title: 'Loki', fadeable: true, showFadeToggle: true });
        expect(surface.container).toBe(document.querySelector('[data-testid="set-shelf-item"]'));
    });

    it('discovers a Continue Watching title from its metadata', () => {
        document.body.innerHTML = `
            <section data-testid="set-section" data-set-style="continue_watching">
                <div data-testid="set-shelf-item">
                    <span data-testid="cw-set-item-wrapper">
                        <a data-testid="set-item" href="/play/title-id"><img alt=""></a>
                        <a data-testid="cw-set-item-metadata" href="/browse/entity-title-id">
                            <div>9m remaining</div><div>How I Met Your Mother</div>
                        </a>
                    </span>
                </div>
            </section>
        `;

        const [surface] = new DisneyPlusSurfaceManager(createMockLogger()).discover(document.body);
        expect(surface).toMatchObject({ title: 'How I Met Your Mother', fadeable: true, showFadeToggle: true });
        expect(surface.container).toBe(document.querySelector('[data-testid="set-shelf-item"]'));
    });
});
