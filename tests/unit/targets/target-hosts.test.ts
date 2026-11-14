/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ServiceRegistry } from '../../../src/core/services/index';

interface TargetManifest {
    content_scripts: { matches: string[] }[];
    host_permissions: string[];
}

const CHROME_MANIFEST = 'src/targets/chrome/manifest.json';
const FIREFOX_MANIFEST = 'src/targets/firefox/manifest.json';
const USERSCRIPT_METADATA = 'src/targets/userscript/metadata.ts';

function readManifest(file: string): TargetManifest {
    return JSON.parse(readFileSync(file, 'utf8')) as TargetManifest;
}

function hostsOf(matchers: readonly string[]): string[] {
    return matchers.map(matcher => new URL(matcher).hostname).sort();
}

function matchedHosts(manifest: TargetManifest): string[] {
    return hostsOf(manifest.content_scripts.flatMap(script => script.matches));
}

function permittedHosts(manifest: TargetManifest): string[] {
    return hostsOf(manifest.host_permissions);
}

function userscriptHosts(): string[] {
    const matches = Array.from(
        readFileSync(USERSCRIPT_METADATA, 'utf8').matchAll(/^\/\/ @match\s+(\S+)$/gmu),
        match => match[1] ?? ''
    );
    return hostsOf(matches);
}

describe('target host coverage', () => {
    const chrome = readManifest(CHROME_MANIFEST);
    const firefox = readManifest(FIREFOX_MANIFEST);
    const userscript = userscriptHosts();

    it('keeps Chrome and Firefox covering the same hosts', () => {
        expect(matchedHosts(chrome)).toEqual(matchedHosts(firefox));
        expect(permittedHosts(chrome)).toEqual(permittedHosts(firefox));
    });

    it('keeps the userscript covering the same hosts as the extensions', () => {
        expect(userscript).toEqual(matchedHosts(chrome));
    });

    it.each([
        ['Chrome', chrome],
        ['Firefox', firefox],
    ])('grants %s host permissions for every matched host', (_name: string, manifest: TargetManifest) => {
        expect(permittedHosts(manifest)).toEqual(expect.arrayContaining(matchedHosts(manifest)));
    });

    it('resolves every matched host to a registered service', () => {
        for (const host of matchedHosts(chrome)) {
            expect(ServiceRegistry.detect(host), host).toBeDefined();
        }
    });
});
