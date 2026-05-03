import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const { version } = pkg;

function zipDirectory(sourceDir, outPath) {
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => console.log(`Created ${outPath} (${archive.pointer()} total bytes)`));
  archive.pipe(output);
  archive.directory(sourceDir, false);
  archive.finalize();
}

const chromeDir = path.join('dist', 'chrome');
const firefoxDir = path.join('dist', 'firefox');

if (fs.existsSync(chromeDir)) {
  zipDirectory(chromeDir, path.join('dist', `FlixMonkey-v${version}-chrome.zip`));
} else {
  console.error('Chrome dist directory missing');
}

if (fs.existsSync(firefoxDir)) {
  zipDirectory(firefoxDir, path.join('dist', `FlixMonkey-v${version}-firefox.xpi`));
} else {
  console.error('Firefox dist directory missing');
}
