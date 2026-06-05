import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { name, homepage, version, description, author, license } = pkg;

const USERSCRIPT_BANNER = `// ==UserScript==
// @name         ${name}
// @namespace    ${homepage}
// @version      ${version}
// @description  ${description}
// @author       ${author}
// @license      ${license}
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @connect      www.omdbapi.com
// @connect      xmdbapi.com
// @connect      api.imdbapi.dev
// @run-at       document-idle
// ==/UserScript==`;

const sharedPlugins = () => [resolve(), commonjs()];

function copyStatic(files) {
    return {
        name: 'copy-static',
        generateBundle() {
            files.forEach(([src, dest]) => {
                mkdirSync(path.dirname(dest), { recursive: true });
                copyFileSync(src, dest);
            });
        },
    };
}

function injectManifestMetadata(srcPath, destPath) {
    return {
        name: 'inject-manifest-metadata',
        generateBundle() {
            mkdirSync(path.dirname(destPath), { recursive: true });
            const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
            manifest.name = name;
            manifest.version = version;
            manifest.description = description;
            writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
        },
    };
}

const target = process.env.TARGET;

const VALID_TARGETS = ['userscript', 'firefox', 'chrome'];
if (target && !VALID_TARGETS.includes(target)) {
    throw new Error(`Unknown TARGET "${target}". Valid values: ${VALID_TARGETS.join(', ')}`);
}

const configsByTarget = {
    userscript: [
        {
            input: 'src/targets/userscript/entry.js',
            output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: USERSCRIPT_BANNER },
            plugins: [
                ...sharedPlugins(),
                {
                    name: 'strip-license-header',
                    transform(code) {
                        return code.replace(
                            /\/\*\*(?:(?!\*\/)[\s\S])*?GNU General Public License(?:(?!\*\/)[\s\S])*?\*\/\n?/g,
                            ''
                        );
                    },
                },
            ],
        },
    ],
    firefox: [
        {
            input: 'src/targets/extension/content.js',
            output: { file: 'dist/firefox/content.js', format: 'iife', sourcemap: true },
            plugins: [
                ...sharedPlugins(),
                copyStatic([['src/targets/extension/options.html', 'dist/firefox/options.html']]),
                injectManifestMetadata('src/targets/firefox/manifest.json', 'dist/firefox/manifest.json'),
            ],
        },
        {
            input: 'src/targets/extension/options.js',
            output: { file: 'dist/firefox/options.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
        {
            input: 'src/targets/firefox/background.js',
            output: { file: 'dist/firefox/background.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
    ],
    chrome: [
        {
            input: 'src/targets/extension/content.js',
            output: { file: 'dist/chrome/content.js', format: 'iife', sourcemap: true },
            plugins: [
                ...sharedPlugins(),
                copyStatic([['src/targets/extension/options.html', 'dist/chrome/options.html']]),
                injectManifestMetadata('src/targets/chrome/manifest.json', 'dist/chrome/manifest.json'),
            ],
        },
        {
            input: 'src/targets/extension/options.js',
            output: { file: 'dist/chrome/options.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
        {
            input: 'src/targets/chrome/service-worker.js',
            output: { file: 'dist/chrome/service-worker.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
    ],
};

const targets = target ? [target] : Object.keys(configsByTarget);
export default targets.flatMap(t => configsByTarget[t]);
