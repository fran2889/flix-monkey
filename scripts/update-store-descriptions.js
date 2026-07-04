/*!
 * FlixMonkey - Browser extension for Netflix ratings
 * Copyright (C) 2024  fran
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'fs';
import { SignJWT } from 'jose';
import path from 'path';

const pkgPath = path.resolve(process.cwd(), 'package.json');

async function updateChromeDescription(description, extensionId, clientId, clientSecret, refreshToken) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Chrome OAuth failed: ${tokenResponse.status} ${tokenResponse.statusText}\n${errorText}`);
    }

    const { access_token: accessToken } = await tokenResponse.json();

    const updateResponse = await fetch(`https://chromewebstore.googleapis.com/v1.1/items/${extensionId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            itemListings: [{ description }],
        }),
    });

    if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(
            `Chrome description update failed: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`
        );
    }

    console.log('Chrome Web Store description updated successfully');
}

async function updateFirefoxDescription(description, addonId, jwtIssuer, jwtSecret) {
    const now = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode(jwtSecret);

    const jwt = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setIssuer(jwtIssuer)
        .setExpirationTime(now + 60)
        .sign(secret);

    const response = await fetch(`https://addons.mozilla.org/api/v4/addons/${addonId}/`, {
        method: 'PATCH',
        headers: {
            Authorization: `JWT ${jwt}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firefox description update failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    console.log('Firefox Add-ons description updated successfully');
}

async function main() {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    if (!pkg.descriptionFull) {
        throw new Error('Missing descriptionFull field in package.json');
    }

    if (typeof pkg.descriptionFull !== 'string' || pkg.descriptionFull.trim() === '') {
        throw new Error('descriptionFull must be a non-empty string');
    }

    const description = pkg.descriptionFull;

    const extensionId = process.env.CHROME_EXTENSION_ID;
    const clientId = process.env.CHROME_CLIENT_ID;
    const clientSecret = process.env.CHROME_CLIENT_SECRET;
    const refreshToken = process.env.CHROME_REFRESH_TOKEN;
    const jwtIssuer = process.env.AMO_JWT_ISSUER;
    const jwtSecret = process.env.AMO_JWT_SECRET;
    const addonId = 'flixmonkey@fran';

    if (!extensionId || !clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing Chrome Web Store credentials');
    }

    if (!jwtIssuer || !jwtSecret) {
        throw new Error('Missing Firefox Add-ons credentials');
    }

    console.log('Updating Chrome Web Store description...');
    await updateChromeDescription(description, extensionId, clientId, clientSecret, refreshToken);

    console.log('Updating Firefox Add-ons description...');
    await updateFirefoxDescription(description, addonId, jwtIssuer, jwtSecret);

    console.log('All store descriptions updated successfully');
}

main().catch(error => {
    console.error('Error updating store descriptions:', error);
    process.exit(1);
});
