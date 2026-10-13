/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';

const DESCRIPTION_FILE = 'docs/store-description.txt';
const JWT_EXPIRY_SECONDS = 180; // AMO API v5 requires JWT to expire within 3 minutes

function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
}

function getEnv(name) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        logError(`Missing or empty required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

function generateJWT(issuer, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: issuer,
        iat: now,
        exp: now + JWT_EXPIRY_SECONDS,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

    const jwtToken = `${signatureInput}.${signature}`;
    return jwtToken;
}

/**
 * Makes an HTTP request to the AMO API.
 * @param {'PATCH' | 'GET' | 'POST' | 'PUT' | 'DELETE'} method - The HTTP method
 * @param {string} path - The API path (without base URL)
 * @param {string} jwt - The JWT token for authentication
 * @param {string | null} [payload] - The request body
 * @returns {Promise<Record<string, unknown>>} The parsed response body
 * @throws {Error} If the request fails
 */
async function makeAMORequest(method, path, jwt, payload = null) {
    const options = {
        hostname: 'addons.mozilla.org',
        path: `/api/v5${path}`,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${jwt}`,
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                logInfo(`AMO API response: ${res.statusCode} ${res.statusMessage}`);
                if (data) {
                    logInfo(`Response data: ${data.substring(0, 200)}...`);
                }

                if (res.statusCode >= 400) {
                    return reject(new Error(`AMO API request failed with status ${res.statusCode}: ${data}`));
                }

                try {
                    const parsed = data ? JSON.parse(data) : {};
                    // Check for API-level errors even with 2xx status
                    if (parsed.error || parsed.errors) {
                        return reject(new Error(`AMO API error: ${JSON.stringify(parsed.error || parsed.errors)}`));
                    }
                    resolve(parsed);
                } catch (parseError) {
                    logError(`Failed to parse response: ${parseError.message}`);
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function validateDescription(content) {
    const MAX_DESCRIPTION_LENGTH = 10000; // AMO limit
    if (content.length > MAX_DESCRIPTION_LENGTH) {
        logError(`Description exceeds AMO maximum length (${MAX_DESCRIPTION_LENGTH}). Truncating.`);
        return content.substring(0, MAX_DESCRIPTION_LENGTH);
    }
    return content;
}

async function main() {
    logInfo(`Reading description from ${DESCRIPTION_FILE}`);
    let content;
    try {
        content = readFileSync(DESCRIPTION_FILE, 'utf8');
    } catch (error) {
        logError(`Failed to read ${DESCRIPTION_FILE}: ${error.message}`);
        process.exit(1);
    }

    const description = validateDescription(content.trim());
    logInfo(`Description length: ${description.length} characters`);

    if (!description) {
        logError('Description is empty');
        process.exit(1);
    }

    const issuer = getEnv('AMO_JWT_ISSUER');
    const secret = getEnv('AMO_JWT_SECRET');
    const addonId = getEnv('AMO_ADDON_ID');

    logInfo(`Using AMO API issuer: ${issuer.length > 20 ? issuer.substring(0, 20) + '...' : issuer}`);
    logInfo(`Using AMO addon ID: ${addonId}`);
    logInfo('Generating JWT for AMO API...');
    const jwt = generateJWT(issuer, secret);

    logInfo(`Updating Firefox AMO description for add-on ${addonId}`);
    const payload = JSON.stringify({
        description: { 'en-US': description },
    });
    logInfo(`Request payload: ${payload.substring(0, 200)}...`);

    // URL-encode the addon ID to handle special characters like @
    const encodedAddonId = encodeURIComponent(addonId);
    logInfo(`Using encoded addon ID: ${encodedAddonId}`);
    const result = await makeAMORequest('PATCH', `/addons/addon/${encodedAddonId}/`, jwt, payload);
    logInfo('Firefox AMO description updated successfully');
    logInfo(JSON.stringify(result, null, 2));

    process.exit(0);
}

main().catch(error => {
    logError(`Failed to update Firefox description: ${error.message}`);
    process.exit(1);
});
