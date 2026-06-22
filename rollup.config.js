import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { name, homepage, supportSite, version, description, author, license } = pkg;

async function userscriptBanner() {
    const iconBuffer = await sharp('src/assets/icons/icon.png').resize(48, 48).png().toBuffer();
    const iconBase64 = iconBuffer.toString('base64');
    const template = readFileSync('src/targets/userscript/metadata.js', 'utf8');
    return template
        .replace('__NAME__', name)
        .replace(/__HOMEPAGE__/g, homepage)
        .replace('__VERSION__', version)
        .replace('__DESCRIPTION__', description)
        .replace('__AUTHOR__', author)
        .replace('__LICENSE__', license)
        .replace('__ICON__', `data:image/png;base64,${iconBase64}`)
        .trimEnd();
}

const sharedPlugins = () => [resolve(), commonjs()];

function asciiEscape() {
    return {
        name: 'ascii-escape',
        renderChunk(code) {
            return {
                code: code.replace(/\P{ASCII}/gu, ch => {
                    const cp = ch.codePointAt(0);
                    if (cp <= 0xffff) return `\\u${cp.toString(16).padStart(4, '0')}`;
                    const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
                    const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
                    return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
                }),
            };
        },
    };
}

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

const ICON_SIZES = [16, 32, 48, 128];

function resizeIcons(srcPath, destDir) {
    return {
        name: 'resize-icons',
        async writeBundle() {
            const iconsDir = path.join(destDir, 'icons');
            mkdirSync(iconsDir, { recursive: true });
            await Promise.all(
                ICON_SIZES.map(size =>
                    sharp(srcPath)
                        .resize(size, size)
                        .png()
                        .toFile(path.join(iconsDir, `icon-${size}.png`))
                )
            );
        },
    };
}

function injectManifestMetadata(srcPath, destPath, targetName) {
    return {
        name: 'inject-manifest-metadata',
        generateBundle() {
            mkdirSync(path.dirname(destPath), { recursive: true });
            const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
            manifest.name = name;
            manifest.version = version;
            manifest.description = description;
            manifest.homepage_url = targetName === 'firefox' ? supportSite : homepage;
            const iconsBlock = Object.fromEntries(ICON_SIZES.map(size => [String(size), `icons/icon-${size}.png`]));
            manifest.icons = iconsBlock;
            manifest.action = { ...manifest.action, default_icon: iconsBlock };
            writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
        },
    };
}

const LICENSE_BLOCK_RE = /^\/\*\*[\s\S]*?GNU General Public License[\s\S]*?\*\//;

const target = process.env.TARGET;

const VALID_TARGETS = ['userscript', 'firefox', 'chrome'];
if (target && !VALID_TARGETS.includes(target)) {
    throw new Error(`Unknown TARGET "${target}". Valid values: ${VALID_TARGETS.join(', ')}`);
}

const configsByTarget = {
    userscript: [
        {
            input: 'src/targets/userscript/entry.js',
            output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: userscriptBanner },
            plugins: [
                ...sharedPlugins(),
                {
                    name: 'strip-license-header',
                    transform(code) {
                        return code.replace(LICENSE_BLOCK_RE, '');
                    },
                },
                asciiEscape(),
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
                injectManifestMetadata('src/targets/firefox/manifest.json', 'dist/firefox/manifest.json', 'firefox'),
                resizeIcons('src/assets/icons/icon.png', 'dist/firefox'),
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
                injectManifestMetadata('src/targets/chrome/manifest.json', 'dist/chrome/manifest.json', 'chrome'),
                resizeIcons('src/assets/icons/icon.png', 'dist/chrome'),
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
