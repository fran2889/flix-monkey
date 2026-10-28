import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import sharp from 'sharp';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { displayName, homepage, version, description, author, license } = pkg;

const ICON_SIZES = [16, 32, 48, 128];
const LICENSE_BLOCK_RE = /^\/\*\*[\s\S]*?SPDX-License-Identifier:[\s\S]*?\*\/(?:\r?\n)*/u;
const VALID_TARGETS = ['userscript', 'firefox', 'chrome'];

/**
 * Generates the userscript metadata banner with embedded icon.
 * Handles icon processing and template replacement from package.json.
 * Strips the license header from the template as it will be in the banner only.
 */
async function userscriptBanner() {
    try {
        const iconBuffer = await sharp('src/assets/icons/icon.png').resize(48, 48).png().toBuffer();
        const iconBase64 = iconBuffer.toString('base64');
        let template = readFileSync('src/targets/userscript/metadata.ts', 'utf8');
        template = template.replace(LICENSE_BLOCK_RE, '');
        return template
            .replace('__NAME__', displayName)
            .replaceAll('__HOMEPAGE__', homepage)
            .replace('__VERSION__', version)
            .replace('__DESCRIPTION__', description)
            .replace('__AUTHOR__', author)
            .replace('__LICENSE__', license)
            .replace('__ICON__', `data:image/png;base64,${iconBase64}`)
            .trimEnd();
    } catch (err) {
        throw new Error(`Failed to generate userscript banner: ${err.message}`, { cause: err });
    }
}

/**
 * Returns the shared Rollup plugins used across all targets.
 */
function sharedPlugins() {
    return [resolve(), commonjs(), typescript()];
}

/**
 * Escapes non-ASCII characters to Unicode escape sequences.
 * Handles surrogate pairs for characters outside the Basic Multilingual Plane (BMP, U+10000+).
 */
function asciiEscape() {
    return {
        name: 'ascii-escape',
        renderChunk(code) {
            return {
                code: code.replace(/\P{ASCII}/gu, ch => {
                    const cp = ch.codePointAt(0);
                    if (cp <= 0xffff) {
                        return String.raw`\u${cp.toString(16).padStart(4, '0')}`;
                    }
                    // Handle surrogate pairs for characters > U+FFFF
                    const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
                    const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
                    return String.raw`\u${hi.toString(16).padStart(4, '0')}\u${lo.toString(16).padStart(4, '0')}`;
                }),
            };
        },
    };
}

/**
 * Copies static files during the build process.
 * Uses synchronous file operations for simplicity in the generateBundle hook.
 */
function copyStatic(files) {
    return {
        name: 'copy-static',
        generateBundle() {
            files.forEach(([src, dest]) => {
                try {
                    mkdirSync(path.dirname(dest), { recursive: true });
                    copyFileSync(src, dest);
                } catch (err) {
                    this.error(`copy-static: failed to copy ${src} to ${dest}: ${err.message}`);
                }
            });
        },
    };
}

/**
 * Resizes the source icon to multiple sizes and saves to the destination directory.
 * Creates icons at 16, 32, 48, and 128 pixels.
 */
function resizeIcons(srcPath, destDir) {
    return {
        name: 'resize-icons',
        async writeBundle() {
            try {
                const iconsDir = path.join(destDir, 'icons');
                mkdirSync(iconsDir, { recursive: true });
                await Promise.all(
                    ICON_SIZES.map(async size => {
                        try {
                            await sharp(srcPath)
                                .resize(size, size)
                                .png()
                                .toFile(path.join(iconsDir, `icon-${size}.png`));
                        } catch (err) {
                            this.error(`resize-icons: failed to process icon at ${size}px: ${err.message}`);
                        }
                    })
                );
            } catch (err) {
                this.error(`resize-icons: failed to create icons directory: ${err.message}`);
            }
        },
    };
}

/**
 * Injects metadata from package.json into the manifest file.
 * Replaces placeholder values with actual values and adds icon references.
 */
function injectManifestMetadata(srcPath, destPath) {
    return {
        name: 'inject-manifest-metadata',
        generateBundle() {
            try {
                mkdirSync(path.dirname(destPath), { recursive: true });
                const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
                manifest.name = displayName;
                manifest.version = version;
                manifest.description = description;
                manifest.homepage_url = homepage;
                const iconsBlock = Object.fromEntries(ICON_SIZES.map(size => [String(size), `icons/icon-${size}.png`]));
                manifest.icons = iconsBlock;
                manifest.action = { ...manifest.action, default_icon: iconsBlock };
                writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
            } catch (err) {
                this.error(`inject-manifest-metadata: ${err.message}`);
            }
        },
    };
}

/**
 * Creates a plugin that strips the GPL license header from code.
 */
function stripLicenseHeader() {
    return {
        name: 'strip-license-header',
        transform(code) {
            try {
                return code.replace(LICENSE_BLOCK_RE, '');
            } catch (err) {
                this.error(`strip-license-header: ${err.message}`);
                return code;
            }
        },
    };
}

/**
 * Generates Rollup configuration for extension targets (Firefox/Chrome).
 * Extracts shared configuration to reduce duplication.
 */
function extensionConfigs(browserName, backgroundEntry, manifestPath) {
    const destDir = `dist/${browserName}`;
    return [
        {
            input: 'src/targets/extension/content.ts',
            output: { file: `${destDir}/content.js`, format: 'iife', sourcemap: true },
            plugins: [
                ...sharedPlugins(),
                copyStatic([['src/targets/extension/options.html', `${destDir}/options.html`]]),
                injectManifestMetadata(manifestPath, `${destDir}/manifest.json`),
                resizeIcons('src/assets/icons/icon.png', destDir),
            ],
        },
        {
            input: 'src/targets/extension/options.ts',
            output: { file: `${destDir}/options.js`, format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
        {
            input: backgroundEntry,
            output: {
                file: `${destDir}/${path.basename(backgroundEntry, '.ts')}.js`,
                format: 'iife',
                sourcemap: true,
            },
            plugins: sharedPlugins(),
        },
    ];
}

const target = process.env.TARGET;

if (target && !VALID_TARGETS.includes(target)) {
    throw new Error(`Unknown TARGET "${target}". Valid values: ${VALID_TARGETS.join(', ')}`);
}

/**
 * Main configuration export as async function to handle async banner generation.
 */
export default async function () {
    // Pre-generate userscript banner if needed
    const userscriptBannerText =
        target === 'userscript' || !target
            ? await userscriptBanner().catch(err => {
                  throw new Error(`Failed to generate userscript banner: ${err.message}`, { cause: err });
              })
            : undefined;

    const configsByTarget = {
        userscript: [
            {
                input: 'src/targets/userscript/entry.ts',
                output: {
                    file: 'dist/FlixMonkey.user.js',
                    format: 'iife',
                    banner: userscriptBannerText,
                },
                plugins: [...sharedPlugins(), stripLicenseHeader(), asciiEscape()],
            },
        ],
        firefox: extensionConfigs('firefox', 'src/targets/firefox/background.ts', 'src/targets/firefox/manifest.json'),
        chrome: extensionConfigs('chrome', 'src/targets/chrome/service-worker.ts', 'src/targets/chrome/manifest.json'),
    };

    const targets = target ? [target] : Object.keys(configsByTarget);
    return targets.flatMap(t => configsByTarget[t]);
}
