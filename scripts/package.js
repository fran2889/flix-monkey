import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const { version } = pkg;

function zipDirectory(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`Created ${outPath} (${archive.pointer()} total bytes)`);
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
            await zipDirectory(chromeDir, path.join('dist', `FlixMonkey-v${version}-chrome.zip`));
            packaged = true;
        }

        if (fs.existsSync(firefoxDir)) {
            await zipDirectory(firefoxDir, path.join('dist', `FlixMonkey-v${version}-firefox.xpi`));
            packaged = true;
        }

        if (!packaged) {
            console.log('No extension directories found to package.');
        }
    } catch (error) {
        console.error('Packaging failed:', error);
        process.exit(1);
    }
}

main();
