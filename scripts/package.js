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
      console.error(`Created ${outPath} (${archive.pointer()} total bytes)`);
      resolve();
    });

    output.on('error', (err) => {
      reject(err);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  try {
    const chromeDir = path.join('dist', 'chrome');
    const firefoxDir = path.join('dist', 'firefox');

    if (fs.existsSync(chromeDir)) {
      await zipDirectory(chromeDir, path.join('dist', `FlixMonkey-v${version}-chrome.zip`));
    } else {
      throw new Error('Chrome dist directory missing');
    }

    if (fs.existsSync(firefoxDir)) {
      await zipDirectory(firefoxDir, path.join('dist', `FlixMonkey-v${version}-firefox.xpi`));
    } else {
      throw new Error('Firefox dist directory missing');
    }
  } catch (error) {
    console.error('Packaging failed:', error);
    process.exit(1);
  }
}

main();
