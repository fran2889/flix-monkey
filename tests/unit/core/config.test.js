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
import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, initConfig } from '../../../src/core/config';

describe('core/config', () => {
    beforeEach(() => {
        // Reset to default behavior or a predictable state if possible
        // Since config.js uses a module-level variable, we might need to be careful
        initConfig(key => null);
    });

    it('should use default values when no getter is provided or returns null', () => {
        expect(CONFIG.overlayCorner).toBe('top-left');
        expect(CONFIG.showRtRating).toBe(true);
        expect(CONFIG.showMcRating).toBe(true);
        expect(CONFIG.xmdbApiKey).toBe('YOUR_XMDB_API_KEY');
        expect(CONFIG.omdbApiKey).toBe('YOUR_OMDB_API_KEY');
        expect(CONFIG.apiClients).toBe('imdbapi,xmdb,omdb');
        expect(CONFIG.enableFadeUnderRating).toBe(false);
    });

    it('should use values from getter', () => {
        initConfig(key => {
            if (key === 'overlayCorner') return 'bottom-right';
            if (key === 'showRtRating') return false;
            if (key === 'showMcRating') return false;
            if (key === 'enableFadeUnderRating') return true;
            return null;
        });

        expect(CONFIG.overlayCorner).toBe('bottom-right');
        expect(CONFIG.showRtRating).toBe(false);
        expect(CONFIG.showMcRating).toBe(false);
        expect(CONFIG.enableFadeUnderRating).toBe(true);
    });

    it('should handle integer config correctly', () => {
        initConfig(key => {
            if (key === 'cacheTtlRatedNewYear') return '45';
            if (key === 'cacheTtlRatedOldYear') return '100';
            if (key === 'cacheTtlNoRating') return 'invalid';
            return null;
        });

        expect(CONFIG.cacheTtlRatedNewYear).toBe(45);
        expect(CONFIG.cacheTtlRatedOldYear).toBe(100);
        expect(CONFIG.cacheTtlNoRating).toBe(1); // Default
    });

    it('should handle float config correctly', () => {
        initConfig(key => {
            if (key === 'fadeRatingThreshold') return '7.5';
            return null;
        });
        expect(CONFIG.fadeRatingThreshold).toBe(7.5);

        initConfig(key => {
            if (key === 'fadeRatingThreshold') return 'invalid';
            return null;
        });
        expect(CONFIG.fadeRatingThreshold).toBe(6.0); // Default
    });

    it('should handle errors in getter by returning fallback', () => {
        initConfig(key => {
            throw new Error('Config Error');
        });

        expect(CONFIG.overlayCorner).toBe('top-left');
    });
});
