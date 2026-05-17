import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { version } = pkg;

const USERSCRIPT_BANNER = `// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      ${version}
// @description  Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners
// @author       fran
// @license      GPL-3.0-or-later
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
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

function injectManifestVersion(srcPath, destPath) {
    return {
        name: 'inject-manifest-version',
        generateBundle() {
            mkdirSync(path.dirname(destPath), { recursive: true });
            const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
            manifest.version = version;
            writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
        },
    };
}

const target = process.env.TARGET;

const allConfigs = [
    {
        _target: 'userscript',
        input: 'src/targets/userscript/entry.js',
        output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: USERSCRIPT_BANNER },
        plugins: [
            ...sharedPlugins(),
            {
                name: 'strip-license-header',
                transform(code) {
                    return code.replace(/\/\*\*[\s\S]*?Copyright \(C\) 2026 Fran[\s\S]*?\*\/\n/g, '');
                },
            },
        ],
    },
    {
        _target: 'firefox',
        input: 'src/targets/extension/content.js',
        output: { file: 'dist/firefox/content.js', format: 'iife', sourcemap: true },
        plugins: [
            ...sharedPlugins(),
            copyStatic([
                ['src/targets/firefox/background.js', 'dist/firefox/background.js'],
                ['src/targets/extension/options.html', 'dist/firefox/options.html'],
            ]),
            injectManifestVersion('src/targets/firefox/manifest.json', 'dist/firefox/manifest.json'),
        ],
    },
    {
        _target: 'firefox',
        input: 'src/targets/extension/options.js',
        output: { file: 'dist/firefox/options.js', format: 'iife', sourcemap: true },
        plugins: sharedPlugins(),
    },
    {
        _target: 'chrome',
        input: 'src/targets/extension/content.js',
        output: { file: 'dist/chrome/content.js', format: 'iife', sourcemap: true },
        plugins: [
            ...sharedPlugins(),
            copyStatic([
                ['src/targets/chrome/service-worker.js', 'dist/chrome/service-worker.js'],
                ['src/targets/extension/options.html', 'dist/chrome/options.html'],
            ]),
            injectManifestVersion('src/targets/chrome/manifest.json', 'dist/chrome/manifest.json'),
        ],
    },
    {
        _target: 'chrome',
        input: 'src/targets/extension/options.js',
        output: { file: 'dist/chrome/options.js', format: 'iife', sourcemap: true },
        plugins: sharedPlugins(),
    },
];

export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
