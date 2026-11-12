/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import fs from 'node:fs';
import path from 'node:path';

import { ZipArchive } from 'archiver';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const { version } = pkg;

const OUTPUTS = {
    chrome: `FlixMonkey-v${version}-chrome.zip`,
    firefox: `FlixMonkey-v${version}-firefox.xpi`,
};

function verifyDistFiles(dir, target) {
    const required = [
        'manifest.json',
        'content.js',
        'options.html',
        'options.js',
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png',
    ];
    const bgFile = target === 'firefox' ? 'background.js' : 'service-worker.js';
    for (const file of [...required, bgFile]) {
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required dist file: ${filePath}`);
        }
    }
}

async function zipDirectory(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', () => {
            console.info(`Created ${outPath} (${archive.pointer()} total bytes)`);
            resolve();
        });

        output.on('error', err => {
            reject(err);
        });

        archive.on('error', err => {
            reject(err);
        });

        archive.on('warning', err => {
            console.warn(`Archive warning: ${err.message}`);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false, entry => (entry.name.endsWith('.map') ? false : entry));
        void archive.finalize();
    });
}

async function main() {
    const requested = process.argv[2] ?? 'all';
    if (requested !== 'all' && !Object.hasOwn(OUTPUTS, requested)) {
        throw new Error(`Unknown package target: ${requested}`);
    }

    const targets = requested === 'all' ? Object.keys(OUTPUTS) : [requested];
    for (const target of targets) {
        const dir = path.join('dist', target);
        if (!fs.existsSync(dir)) {
            throw new Error(`Missing extension directory: ${dir}`);
        }
        verifyDistFiles(dir, target);
    }

    for (const target of targets) {
        await zipDirectory(path.join('dist', target), path.join('dist', OUTPUTS[target]));
    }
}

main().catch(error => {
    console.error('Packaging failed:', error.message || String(error));
    process.exit(1);
});
