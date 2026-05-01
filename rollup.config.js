import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { version } = pkg;

const USERSCRIPT_BANNER = `// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      ${version}
// @description  Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners
// @author       fran
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
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
        plugins: sharedPlugins(),
    },
    // Firefox and Chrome configs added in Task 16
];

export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
