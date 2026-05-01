import { CONFIG } from './config.js';

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';

    injectStyles() {
        const cornerStyles = {
            'top-left': 'top:6px;left:6px;',
            'top-right': 'top:6px;right:6px;',
            'bottom-left': 'bottom:6px;left:6px;',
            'bottom-right': 'bottom:6px;right:6px;',
        };
        const positionCss = cornerStyles[CONFIG.overlayCorner] ?? cornerStyles['top-left'];
        const style = document.createElement('style');
        style.textContent = `
            .${this.#OVERLAY_CLASS} {
                position: absolute;
                ${positionCss}
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 3px;
                background: rgba(0,0,0,0.72);
                font-family: Arial, sans-serif;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                white-space: nowrap;
                pointer-events: all;
                transition: background 0.15s;
            }
            .${this.#OVERLAY_CLASS}:hover { background: rgba(0,0,0,0.92); }
            .${this.#OVERLAY_CLASS} .fm-row { display: flex; align-items: center; gap: 4px; }
            .${this.#OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
            .${this.#OVERLAY_CLASS} .fm-rt { color: #fa320a; }
            .${this.#OVERLAY_CLASS} .fm-mc { color: #6ac; }
            .${this.#OVERLAY_CLASS} .fm-value { color: #fff; }
            .${this.#OVERLAY_CLASS} .fm-na { color: #aaa; }
            .${this.#OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
        `;
        if (CONFIG.overlayCorner.includes('left')) {
            style.textContent += `\n            .title-card-top-10 .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
        }
        style.textContent += `
            .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
            .fm-faded:hover { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    #createRatingRow(label, value, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-value">${value}</span></div>`;
    }

    #formatImdbRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return rating.toFixed(1);
    }

    #formatPercentRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return `${rating}%`;
    }

    #createMissingRatingRow(label, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-na">N/A</span></div>`;
    }

    #createSearchRatingRow(label, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-search">🔍</span></div>`;
    }

    #buildTooltip(titleParts, imdbId) {
        if (titleParts.length) return `${titleParts.join(' · ')} – click to open IMDb`;
        if (imdbId) return 'No ratings available – click to open IMDb';
        return 'Not found on IMDb – click to search';
    }

    #createOverlay(titleObj) {
        const a = document.createElement('a');
        a.className = this.#OVERLAY_CLASS;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = titleObj.imdbUrl;

        const rows = [];
        const titleParts = [];
        const { rating, imdbId, rtRating, mcRating } = titleObj;

        if (rating) {
            const formattedRating = this.#formatImdbRating(rating);
            rows.push(this.#createRatingRow('IMDb', formattedRating));
            titleParts.push(`IMDb: ${formattedRating}`);
        } else if (imdbId) {
            rows.push(this.#createMissingRatingRow('IMDb'));
        } else {
            rows.push(this.#createSearchRatingRow('IMDb'));
        }

        if (CONFIG.showRtRating && rtRating) {
            const formattedRt = this.#formatPercentRating(rtRating);
            rows.push(this.#createRatingRow('RT', formattedRt, 'fm-rt'));
            titleParts.push(`RT: ${formattedRt}`);
        }

        if (CONFIG.showMcRating && mcRating) {
            const formattedMc = this.#formatPercentRating(mcRating);
            rows.push(this.#createRatingRow('MC', formattedMc, 'fm-mc'));
            titleParts.push(`MC: ${formattedMc}`);
        }

        a.innerHTML = rows.join('');
        a.title = this.#buildTooltip(titleParts, imdbId);
        a.addEventListener('click', e => e.stopPropagation());
        return a;
    }

    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    #createLoadingOverlay(displayTitle) {
        const a = document.createElement('a');
        a.className = `${this.#OVERLAY_CLASS} ${this.#LOADING_CLASS}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = `https://www.imdb.com/find/?q=${encodeURIComponent(displayTitle)}`;
        a.innerHTML = `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-search">⏳</span></div>`;
        a.title = 'Fetching ratings… click to search IMDb';
        a.addEventListener('click', e => e.stopPropagation());
        return a;
    }

    injectLoadingOverlay(container, displayTitle) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createLoadingOverlay(displayTitle));
    }

    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    injectOverlay(container, titleObj) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createOverlay(titleObj));
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    applyFade(container, titleObj, fadeable) {
        if (!fadeable || !CONFIG.enableFadeUnderRating) {
            container.classList.remove('fm-faded');
            return;
        }
        const { rating } = titleObj ?? {};
        if (typeof rating === 'number' && rating < CONFIG.fadeRatingThreshold) {
            container.classList.add('fm-faded');
        } else {
            container.classList.remove('fm-faded');
        }
    }
}
