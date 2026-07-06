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

async function getAccessToken() {
    const clientId = getEnv('CHROME_CLIENT_ID');
    const clientSecret = getEnv('CHROME_CLIENT_SECRET');
    const refreshToken = getEnv('CHROME_REFRESH_TOKEN');

    const postData = new URLSearchParams();
    postData.append('client_id', clientId);
    postData.append('client_secret', clientSecret);
    postData.append('refresh_token', refreshToken);
    postData.append('grant_type', 'refresh_token');

    const options = {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`OAuth2 token request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.access_token);
                } catch (error) {
                    reject(new Error(`Failed to parse token response: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData.toString());
        req.end();
    });
}

async function updateChromeDescription(accessToken, extensionId, description) {
    const payload = JSON.stringify({
        item: {
            description: description,
        },
    });

    const options = {
        hostname: 'chromewebstore.googleapis.com',
        path: `/v2/items/${extensionId}`,
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`API request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (error) {
                    logError(`Failed to parse response: ${error.message}`);
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function validateDescription(content) {
    const maxLength = 132072; // Chrome Web Store limit
    if (content.length > maxLength) {
        logError(`Description exceeds maximum length (${maxLength}). Truncating.`);
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

        // Authenticate
        logInfo('Authenticating with Chrome Web Store API...');
        const accessToken = await getAccessToken();
        logInfo('Authentication successful');

        // Update description
        const extensionId = getEnv('CHROME_EXTENSION_ID');
        logInfo(`Updating Chrome Web Store description for extension ${extensionId}`);
        const result = await updateChromeDescription(accessToken, extensionId, description);
        logInfo('Chrome Web Store description updated successfully');
        logInfo(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        logError(`Failed to update Chrome description: ${error.message}`);
        process.exit(1);
    }
}

main();
