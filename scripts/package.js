import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const { version } = pkg;

function verifyDistFiles(dir, target) {
    const required = ['manifest.json', 'content.js', 'options.html', 'options.js'];
    const bgFile = target === 'firefox' ? 'background.js' : 'service-worker.js';
    for (const file of [...required, bgFile]) {
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required dist file: ${filePath}`);
        }
    }
}

function zipDirectory(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

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

        archive.pipe(output);
        archive.directory(sourceDir, false, entry => (entry.name.endsWith('.map') ? false : entry));
        archive.finalize();
    });
}

async function main() {
    try {
        const chromeDir = path.join('dist', 'chrome');
        const firefoxDir = path.join('dist', 'firefox');
        let packaged = false;

        if (fs.existsSync(chromeDir)) {
            verifyDistFiles(chromeDir, 'chrome');
            await zipDirectory(chromeDir, path.join('dist', `FlixMonkey-v${version}-chrome.zip`));
            packaged = true;
        }

        if (fs.existsSync(firefoxDir)) {
            verifyDistFiles(firefoxDir, 'firefox');
            await zipDirectory(firefoxDir, path.join('dist', `FlixMonkey-v${version}-firefox.xpi`));
            packaged = true;
        }

        if (!packaged) {
            console.warn('No extension directories found to package.');
        }
    } catch (error) {
        console.error('Packaging failed:', error);
        process.exit(1);
    }
}

main();
