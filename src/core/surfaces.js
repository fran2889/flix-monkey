export class SurfaceManager {
    #SURFACES = [
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
        },
        {
            titleSelectors: '[data-uia="search-gallery-video-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="search-gallery-video-card"]',
            fadeable: true,
        },
        {
            titleSelectors: '[data-uia="search-suggestion-item-link"]',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '[data-uia="search-suggestion-item"]',
            fadeable: true,
        },
        {
            titleSelectors: '.bob-title',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.bob-container',
            fadeable: false,
        },
        {
            titleSelectors: [
                '.previewModal--player-titleTreatmentWrapper img[alt]',
                '.previewModal--wrapper img[alt]',
                '.previewModal img[alt]',
                '[data-uia="previewModal-title"]',
                '.previewModal--boxarttitle',
                '.previewModal h3',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
            containerSel: '.previewModal',
            fadeable: false,
        },
        {
            titleSelectors: [
                '.jawBone img[alt]',
                '.jawBoneContainer img[alt]',
                '.previewModal--detailsMetadata img[alt]',
                '.jawBone .image-fallback-text',
                '.jawBoneContainer .image-fallback-text',
                '.previewModal--detailsMetadata h3',
                '.previewModal--detailsMetadata .title',
                '.previewModal--detailsMetadata [data-uia="previewModal-title"]',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
            containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
            fadeable: false,
        },
    ];

    discover(root) {
        const seen = new Set();
        const results = [];
        this.#SURFACES.forEach(surface => {
            let titleEls;
            try {
                titleEls = root.querySelectorAll(surface.titleSelectors);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = surface.getTitle(titleEl);
                if (!title) return;
                const container = titleEl.closest(surface.containerSel) ?? titleEl.parentElement;
                if (!container || seen.has(container)) return;
                seen.add(container);
                results.push({ container, title, fadeable: surface.fadeable ?? false });
            });
        });
        return results;
    }

    extractYear(el) {
        const yearEl = el.querySelector('.year, [data-year], .releaseYear');
        if (!yearEl) return null;
        const m = yearEl.textContent.match(/\d{4}/);
        return m?.[0] ?? null;
    }
}
