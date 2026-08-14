#!/usr/bin/env node
/**
 * Patch dsh-host-apiproxy WEB_SETTINGS_NAMESPACES so the settings UI can
 * expose the `dsh-image-vision` namespace (required by DSH-vison / 图片理解).
 * Idempotent.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const MARKER = 'dsh-image-vision';
const ANCHOR = 'web-search-deepseek';

function resolveApiProxyIndex() {
  try {
    const pkg = require.resolve('@deepseek-ai/dsh-host-apiproxy/package.json');
    return join(dirname(pkg), 'lib', 'index.js');
  } catch {
    return join(root, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js');
  }
}

function patchFile(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[apiproxy] skip — missing ${filePath}`);
    return false;
  }
  const src = readFileSync(filePath, 'utf8');
  if (src.includes(`"${MARKER}"`) || src.includes(`'${MARKER}'`)) {
    console.log(`[apiproxy] already patched: ${filePath}`);
    return true;
  }
  if (!src.includes(`"${ANCHOR}"`) && !src.includes(`'${ANCHOR}'`)) {
    throw new Error(`allowlist anchor "${ANCHOR}" not found in ${filePath}`);
  }

  // Prefer the compiled commonjs form used at runtime (double-quoted).
  let next = src.replace(
    /("web-search-deepseek")(\s*\n\s*\];)/,
    `$1,\n\t// ${MARKER}: settings section for the bundled DSH-vison plugin\n\t"${MARKER}"$2`,
  );
  if (next === src) {
    next = src.replace(
      /('web-search-deepseek')(\s*\n\s*\];)/,
      `$1,\n    // ${MARKER}: settings section for the bundled DSH-vison plugin\n    '${MARKER}'$2`,
    );
  }
  if (next === src) {
    // Fallback: single-line / trailing-comma array form in types/api-proxy.js
    next = src.replace(
      /('web-search-deepseek')(\s*,?\s*\])/,
      `$1, '${MARKER}'$2`,
    );
  }
  if (next === src) {
    throw new Error(`failed to patch allowlist in ${filePath}`);
  }
  writeFileSync(filePath, next);
  console.log(`[apiproxy] patched: ${filePath}`);
  return true;
}

const primary = resolveApiProxyIndex();
patchFile(primary);

// Also patch the TypeScript-emitted twin if present (some resolve paths hit it).
const twin = join(dirname(primary), 'types', 'api-proxy.js');
if (existsSync(twin)) {
  try {
    patchFile(twin);
  } catch (err) {
    console.warn(`[apiproxy] twin patch skipped: ${err.message || err}`);
  }
}

console.log('[apiproxy] image-vision allowlist ready');
