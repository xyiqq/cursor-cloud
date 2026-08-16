#!/usr/bin/env node
/**
 * Verify packaged-style resolution of @deepseek-ai/dsh, natives, plugins, OTA helpers.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire as nodeCreateRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

function fail(msg) {
  console.error(`[verify] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[verify] OK: ${msg}`);
}

const zlib = nodeCreateRequire(import.meta.url)('node:zlib');
if (typeof zlib.createZstdDecompress !== 'function') {
  fail(`Node ${process.version} missing zstd`);
}
ok(`Node ${process.version} zstd ok`);

let pkgJson;
try {
  pkgJson = require.resolve('@deepseek-ai/dsh/package.json');
} catch (err) {
  fail(`@deepseek-ai/dsh missing: ${err.message}`);
}
const bin = join(dirname(pkgJson), 'lib', 'bin.js');
if (!existsSync(bin)) fail(`missing ${bin}`);
ok(`dsh bin → ${bin}`);

const ver = spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
if (ver.status !== 0) fail(`dsh --version failed`);
ok(`dsh --version → ${ver.stdout.trim()}`);

try {
  require.resolve('@deepseek-ai/dsh-mcp-client/package.json');
  ok('@deepseek-ai/dsh-mcp-client present');
} catch (err) {
  fail(`dsh-mcp-client missing: ${err.message}`);
}

for (const rel of [
  '@koromix/koffi-win32-x64',
  '@img/sharp-win32-x64',
  '@koromix/koffi-darwin-arm64',
  '@img/sharp-darwin-arm64',
]) {
  const p = join(root, 'node_modules', ...rel.split('/'));
  if (!existsSync(p)) fail(`missing platform native ${rel}`);
}
ok('platform natives present (win32 + darwin-arm64)');

const worker = join(
  root,
  'node_modules',
  '@deepseek-ai',
  'dsh-host-directory-picker-native',
  'lib',
  'worker.cjs',
);
if (!existsSync(worker)) fail('directory-picker worker missing');
const workerSrc = readFileSync(worker, 'utf8');
if (!workerSrc.includes('DSH_DESKTOP_PICKER_PATCH')) {
  fail('directory-picker worker not patched (run patch:picker)');
}
ok('directory-picker worker patched (PowerShell)');

for (const plugin of ['dsh-image-vision', 'dsh-homeassistant', 'dsh-showroom', 'dsh-plugin-liang-calibrator']) {
  const visionPkg = join(root, 'plugins', plugin, 'package.json');
  const visionClient = join(root, 'plugins', plugin, 'client.js');
  const visionClientLib = join(root, 'plugins', plugin, 'lib', 'client.js');
  const visionIndexJs = join(root, 'plugins', plugin, 'index.js');
  const visionIndexMjs = join(root, 'plugins', plugin, 'index.mjs');
  const visionIndexLib = join(root, 'plugins', plugin, 'lib', 'index.js');
  const hasEntry = existsSync(visionIndexJs) || existsSync(visionIndexMjs) || existsSync(visionIndexLib);
  const hasClient = existsSync(visionClient) || existsSync(visionClientLib);
  if (!existsSync(visionPkg) || !hasEntry || !hasClient) {
    fail(`bundled plugins/${plugin} incomplete`);
  }
  const meta = JSON.parse(readFileSync(visionPkg, 'utf8'));
  if (meta.name !== plugin) fail(`unexpected package name for ${plugin}`);
  ok(`bundled ${plugin} ${meta.version}`);
}

if (!existsSync(join(root, 'plugins', 'dsh-plugin-liang-calibrator', 'lib', 'assets', 'frames', 'frame-00.webp'))) {
  fail('liang calibrator missing portrait frames');
}
ok('liang calibrator frames present');

if (existsSync(join(root, 'plugins', 'dsh-showroom', 'hub.mjs')) === false) {
  fail('dsh-showroom missing hub.mjs');
}
for (const page of ['twin.html', 'panel.html', 'wish.html', 'viz.html']) {
  if (!existsSync(join(root, 'plugins', 'dsh-showroom', 'web', page))) {
    fail(`dsh-showroom missing web/${page}`);
  }
}
ok('dsh-showroom hub + web pages present');

let apiproxy;
try {
  apiproxy = require.resolve('@deepseek-ai/dsh-host-apiproxy/lib/index.js');
} catch {
  apiproxy = join(root, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js');
}
if (!existsSync(apiproxy)) fail('dsh-host-apiproxy missing');
const apiSrc = readFileSync(apiproxy, 'utf8');
for (const ns of ['dsh-image-vision', 'dsh-homeassistant', 'dsh-showroom', 'dsh-liang-calibrator']) {
  if (!apiSrc.includes(`"${ns}"`) && !apiSrc.includes(`'${ns}'`)) {
    fail(`apiproxy allowlist missing ${ns} (run patch:apiproxy)`);
  }
}
ok('apiproxy allowlist exposes image-vision + homeassistant + showroom + liang');

// OTA helper unit checks (no network)
const { cmpVersion, pickZipAsset, pickNewestRelease, tagFromLatestLocation, buildDesktopRelease } = require(join(root, 'electron', 'update-utils.js'));
if (cmpVersion('0.2.1', '0.3.0') !== -1) fail('cmpVersion ordering');
if (cmpVersion('0.3.0', '0.3.0') !== 0) fail('cmpVersion equal');
if (cmpVersion('0.4.4', '0.4.5') !== -1) fail('cmpVersion 0.4.4 < 0.4.5');
if (cmpVersion('0.44', '0.4.5') !== null) fail('cmpVersion invalid should be null');
const asset = pickZipAsset({
  assets: [
    { name: 'notes.txt' },
    { name: 'DeepSeek-Harness-0.3.0-win-x64.zip', browser_download_url: 'https://example/x.zip' },
  ],
});
if (!asset || !/0\.3\.0/.test(asset.name)) fail('pickZipAsset win');
const macAsset = pickZipAsset(
  {
    assets: [
      { name: 'DeepSeek-Harness-0.4.2-win-x64.zip' },
      { name: 'DeepSeek-Harness-0.4.2-mac-arm64.zip', browser_download_url: 'https://example/m.zip' },
      { name: 'DeepSeek-Harness-0.4.2-mac-x64.zip' },
    ],
  },
  { platform: 'darwin', arch: 'arm64' },
);
if (!macAsset || !/mac-arm64/.test(macAsset.name)) fail('pickZipAsset mac-arm64');
const newest = pickNewestRelease([
  { tag_name: 'v0.4.4', draft: false, prerelease: false, assets: [{ name: 'DeepSeek-Harness-0.4.4-win-x64.zip', browser_download_url: 'https://ex/a' }] },
  { tag_name: 'v0.4.6', draft: false, prerelease: false, assets: [{ name: 'DeepSeek-Harness-0.4.6-win-x64.zip', browser_download_url: 'https://ex/b' }] },
  { tag_name: 'v0.1.5', draft: false, prerelease: true, assets: [{ name: 'DeepSeek-Harness-0.1.5-win-x64.zip', browser_download_url: 'https://ex/c' }] },
]);
if (!newest || newest.tag_name !== 'v0.4.6') fail('pickNewestRelease');
if (tagFromLatestLocation('https://github.com/xyiqq/cursor-cloud/releases/tag/v0.4.7') !== 'v0.4.7') {
  fail('tagFromLatestLocation');
}
const built = buildDesktopRelease('v0.4.7', { owner: 'xyiqq', repo: 'cursor-cloud' });
if (!built || built.tag_name !== 'v0.4.7') fail('buildDesktopRelease tag');
const winBuilt = pickZipAsset(built, { platform: 'win32', arch: 'x64' });
if (!winBuilt || !/0\.4\.7-win-x64\.zip$/.test(winBuilt.name)) fail('buildDesktopRelease win asset');
if (!/^https:\/\/github\.com\/xyiqq\/cursor-cloud\/releases\/download\/v0\.4\.7\//.test(winBuilt.browser_download_url)) {
  fail('buildDesktopRelease url');
}
ok('OTA helpers (cmpVersion/pickZipAsset/pickNewestRelease/web-fallback)');

console.log('[verify] all checks passed');
