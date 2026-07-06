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

import crypto from 'crypto';
import { readFileSync } from 'fs';
import https from 'https';

const DESCRIPTION_FILE = 'docs/store-description.txt';

function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
}

function getEnv(name) {
    const value = process.env[name];
    if (!value) {
        logError(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

function generateJWT(issuer, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: issuer };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

    return `${signatureInput}.${signature}`;
}

function makeAMORequest(method, path, jwt, payload = null) {
    const options = {
        hostname: 'addons.mozilla.org',
        path: `/api/v5${path}`,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${jwt}`,
        },
    };

    if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`AMO API request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve(parsed);
                } catch (error) {
                    logError(`Failed to parse response: ${error.message}`);
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
    const maxLength = 10000; // AMO limit
    if (content.length > maxLength) {
        logError(`Description exceeds AMO maximum length (${maxLength}). Truncating.`);
        return content.substring(0, maxLength);
    }
    return content;
}

async function main() {
    try {
        // Dry-run mode
        const dryRun = process.env.DRY_RUN === 'true';
        if (dryRun) {
            logInfo('DRY RUN MODE - no changes will be made');
        }

        // Read description file
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

        if (dryRun) {
            logInfo('Dry run complete. Description would be:');
            logInfo(description.substring(0, 200) + '...');
            logInfo('To run for real, omit the DRY_RUN=true environment variable.');
            process.exit(0);
        }

        // Generate JWT
        const issuer = getEnv('AMO_JWT_ISSUER');
        const secret = getEnv('AMO_JWT_SECRET');
        const addonId = getEnv('AMO_ADDON_ID');

        logInfo('Generating JWT for AMO API...');
        const jwt = generateJWT(issuer, secret);
        logInfo('JWT generated successfully');

        // Update description
        logInfo(`Updating Firefox AMO description for add-on ${addonId}`);
        const payload = JSON.stringify({
            description: { 'en-US': description },
        });

        const result = await makeAMORequest('PATCH', `/addons/addon/${addonId}`, jwt, payload);
        logInfo('Firefox AMO description updated successfully');
        logInfo(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        logError(`Failed to update Firefox description: ${error.message}`);
        process.exit(1);
    }
}

main();
