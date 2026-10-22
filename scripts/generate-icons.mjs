import { copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'assets/branding/ledgerly-icon.png');
const master = path.join(root, 'assets/branding/ledgerly-icon-1024.png');

await sharp(source).resize(1024, 1024).ensureAlpha().png().toFile(master);
execFileSync(process.execPath, [
  path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
  'icon', master,
  '--output', path.join(root, 'src-tauri/icons'),
  '--ios-color', '#1A3C34',
], { cwd: root, stdio: 'inherit' });

for (const [destination, size] of [
  ['public/logo.png', 512],
  ['public/icon-32.png', 32],
  ['public/icon-64.png', 64],
  ['public/icon-128.png', 128],
  ['app/icon.png', 512],
  ['app/upload-icon/app-icon.png', 1024],
  ['src-tauri/icons/64x64.png', 64],
]) {
  const output = path.join(root, destination);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(master).resize(size, size).png().toFile(output);
}

for (const destination of ['public/favicon.ico', 'app/favicon.ico']) {
  await copyFile(path.join(root, 'src-tauri/icons/icon.ico'), path.join(root, destination));
}

console.log('Updated Ledgerly desktop, mobile, sidebar, and web icons.');
