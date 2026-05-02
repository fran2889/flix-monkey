import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import '@testing-library/jest-dom/vitest';

export const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
