/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export {
    DISNEY_PLUS_SURFACES,
    DisneyPlusSurfaceManager,
    extractDisneyPlusTitle,
} from './surface-definitions/disney-plus-surfaces.js';
export { HBO_MAX_SURFACES, HboMaxSurfaceManager } from './surface-definitions/hbo-max-surfaces.js';
export { NETFLIX_SURFACES, NetflixSurfaceManager } from './surface-definitions/netflix-surfaces.js';
export { containerFromClosest, containerFromParent, SurfaceManager, titleFromAttribute } from './surface-manager.js';
