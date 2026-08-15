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
]) {
  const p = join(root, 'node_modules', ...rel.split('/'));
  if (!existsSync(p)) fail(`missing Windows native ${rel}`);
}
ok('Windows natives present (koffi/sharp)');

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

for (const plugin of ['dsh-image-vision', 'dsh-homeassistant']) {
  const visionPkg = join(root, 'plugins', plugin, 'package.json');
  const visionClient = join(root, 'plugins', plugin, 'client.js');
  const visionIndexJs = join(root, 'plugins', plugin, 'index.js');
  const visionIndexMjs = join(root, 'plugins', plugin, 'index.mjs');
  const hasEntry = existsSync(visionIndexJs) || existsSync(visionIndexMjs);
  if (!existsSync(visionPkg) || !hasEntry || !existsSync(visionClient)) {
    fail(`bundled plugins/${plugin} incomplete`);
  }
  const meta = JSON.parse(readFileSync(visionPkg, 'utf8'));
  if (meta.name !== plugin) fail(`unexpected package name for ${plugin}`);
  ok(`bundled ${plugin} ${meta.version}`);
}

let apiproxy;
try {
  apiproxy = require.resolve('@deepseek-ai/dsh-host-apiproxy/lib/index.js');
} catch {
  apiproxy = join(root, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js');
}
if (!existsSync(apiproxy)) fail('dsh-host-apiproxy missing');
const apiSrc = readFileSync(apiproxy, 'utf8');
for (const ns of ['dsh-image-vision', 'dsh-homeassistant']) {
  if (!apiSrc.includes(`"${ns}"`) && !apiSrc.includes(`'${ns}'`)) {
    fail(`apiproxy allowlist missing ${ns} (run patch:apiproxy)`);
  }
}
ok('apiproxy allowlist exposes image-vision + homeassistant');

// OTA helper unit checks (no network)
const { cmpVersion, pickZipAsset } = require(join(root, 'electron', 'update-utils.js'));
if (cmpVersion('0.2.1', '0.3.0') !== -1) fail('cmpVersion ordering');
if (cmpVersion('0.3.0', '0.3.0') !== 0) fail('cmpVersion equal');
const asset = pickZipAsset({
  assets: [
    { name: 'notes.txt' },
    { name: 'DeepSeek-Harness-0.3.0-win-x64.zip', browser_download_url: 'https://example/x.zip' },
  ],
});
if (!asset || !/0\.3\.0/.test(asset.name)) fail('pickZipAsset');
ok('OTA helpers (cmpVersion/pickZipAsset)');

console.log('[verify] all checks passed');
