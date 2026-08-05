/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */

import '@testing-library/jest-dom/vitest';

import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
