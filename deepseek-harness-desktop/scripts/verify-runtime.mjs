#!/usr/bin/env node
/**
 * Verify packaged-style resolution of @deepseek-ai/dsh and Windows natives.
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

console.log('[verify] all checks passed');
