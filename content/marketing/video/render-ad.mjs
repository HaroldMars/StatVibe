/**
 * Renders content/marketing/video/statvibe-ad.html to MP4 via Playwright.
 * Usage: node render-ad.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'statvibe-ad.html');
const outDir = path.join(__dirname, 'out');
const artifactsDir = '/opt/cursor/artifacts';

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(artifactsDir, { recursive: true });

const fileUrl = 'file://' + htmlPath;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(cmd + ' exited ' + code))));
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-web-security', '--allow-file-access-from-files'],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1920, height: 1080 },
  },
});

const page = await context.newPage();
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__STATVIBE_AD__ && window.__STATVIBE_AD__.ready);
await page.evaluate(() => window.__STATVIBE_AD__.start());
// Full ad length + small buffer for last scene
await page.waitForTimeout(30500);

const video = page.video();
await page.close();
const webmPath = await video.path();
await context.close();
await browser.close();

const mp4Path = path.join(outDir, 'statvibe-ad.mp4');
const artifactMp4 = path.join(artifactsDir, 'statvibe-ad.mp4');

// Transcode WebM → H.264 MP4 for broad playback
await run('ffmpeg', [
  '-y', '-i', webmPath,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  mp4Path,
]);

const published = path.join(__dirname, 'statvibe-ad.mp4');
fs.copyFileSync(mp4Path, artifactMp4);
fs.copyFileSync(mp4Path, published);
console.log('Wrote', mp4Path);
console.log('Published', published);
console.log('Artifact', artifactMp4);
