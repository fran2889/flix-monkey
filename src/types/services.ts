/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SurfaceManager } from '../core/surfaces/index';

/**
 * Constructor type for service surface managers.
 */
export type ServiceSurfaceManager = new (_logger: never) => SurfaceManager;
