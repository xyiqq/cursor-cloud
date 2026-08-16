#!/usr/bin/env node
/**
 * Force-install Windows + macOS native optionalDependencies into node_modules.
 * Linux CI cannot `npm install` os-specific packages (EBADPLATFORM); use npm pack.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.stdio ?? 'inherit',
    cwd: opts.cwd ?? root,
    encoding: opts.encoding,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`failed: ${cmd} ${args.join(' ')}`);
  }
  return result;
}

function packInstall(spec) {
  const at = spec.lastIndexOf('@');
  const name = at > 0 ? spec.slice(0, at) : spec;
  const rel = name.startsWith('@') ? join(...name.split('/')) : name;
  const dest = join(nm, rel);
  const tmp = join(root, '.pack-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  console.log(`[natives] pack ${spec}`);
  run('npm', ['pack', spec, '--pack-destination', tmp], { cwd: tmp });
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error(`no tgz for ${spec}`);
  run('tar', ['-xzf', join(tmp, tgz), '-C', tmp]);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(join(tmp, 'package'), dest);
  rmSync(tmp, { recursive: true, force: true });
}

function koffiVersion() {
  try {
    return JSON.parse(readFileSync(join(nm, 'koffi', 'package.json'), 'utf8')).version;
  } catch {
    return '3.1.5';
  }
}

function sharpVersion() {
  try {
    return JSON.parse(readFileSync(join(nm, 'sharp', 'package.json'), 'utf8')).version;
  } catch {
    return '0.35.3';
  }
}

function main() {
  if (!existsSync(join(nm, '@deepseek-ai', 'dsh'))) {
    console.warn('[natives] @deepseek-ai/dsh not installed yet; skip');
    return;
  }
  const koffi = koffiVersion();
  const sharp = sharpVersion();
  const specs = [
    // Windows
    `@koromix/koffi-win32-x64@${koffi}`,
    `@img/sharp-win32-x64@${sharp}`,
    'node-addon-require-builtin-win32-x64-msvc@0.1.4',
    // macOS Apple Silicon + Intel
    `@koromix/koffi-darwin-arm64@${koffi}`,
    `@koromix/koffi-darwin-x64@${koffi}`,
    `@img/sharp-darwin-arm64@${sharp}`,
    `@img/sharp-darwin-x64@${sharp}`,
    `@img/sharp-libvips-darwin-arm64@1.3.2`,
    `@img/sharp-libvips-darwin-x64@1.3.2`,
    'node-addon-require-builtin-darwin-arm64@0.1.4',
    'node-addon-require-builtin-darwin-x64@0.1.4',
  ];
  for (const spec of specs) {
    try {
      packInstall(spec);
    } catch (err) {
      console.warn(`[natives] warn: ${spec}:`, err.message || err);
    }
  }
  const required = [
    join(nm, '@koromix', 'koffi-win32-x64'),
    join(nm, '@img', 'sharp-win32-x64'),
    join(nm, '@koromix', 'koffi-darwin-arm64'),
    join(nm, '@img', 'sharp-darwin-arm64'),
  ];
  for (const p of required) {
    if (!existsSync(p)) throw new Error(`missing platform native: ${p}`);
  }
  console.log('[natives] Windows + macOS native modules ready');
}

main();
