/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from './constants.js';

export const RATE_LIMITS = Object.freeze({
    [ApiSource.XMDB]: 1500,
    [ApiSource.OMDB]: 250,
    [ApiSource.AGREGARR]: 250,
});
