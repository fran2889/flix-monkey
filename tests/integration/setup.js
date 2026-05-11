import { config } from 'dotenv';
import { vi } from 'vitest';

// Load local .env for integration tests
config();

// Helper to check if credentials are provided
export const hasCredentials = keys => {
    return keys.every(key => process.env[key]);
};
