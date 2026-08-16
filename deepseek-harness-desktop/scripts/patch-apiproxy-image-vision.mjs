#!/usr/bin/env node
/**
 * Patch dsh-host-apiproxy WEB_SETTINGS_NAMESPACES for bundled plugin settings.
 * Idempotent — safe to run repeatedly.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const NAMESPACES = ['dsh-image-vision', 'dsh-homeassistant', 'dsh-showroom', 'dsh-liang-calibrator'];
const ANCHOR = 'web-search-deepseek';

function resolveApiProxyIndex() {
  try {
    const pkg = require.resolve('@deepseek-ai/dsh-host-apiproxy/package.json');
    return join(dirname(pkg), 'lib', 'index.js');
  } catch {
    return join(root, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js');
  }
}

function ensureNamespace(src, marker) {
  if (src.includes(`"${marker}"`) || src.includes(`'${marker}'`)) {
    return { src, changed: false };
  }
  let next = src.replace(
    new RegExp(`("${ANCHOR}"(?:\\s*,\\s*\\n\\s*//[^\\n]*\\n\\s*"[^"]+")*)(\\s*\\n\\s*\\];)`),
    `$1,\n\t// ${marker}: bundled desktop plugin settings\n\t"${marker}"$2`,
  );
  if (next === src) {
    // Append after last quoted entry before closing ];
    next = src.replace(
      /("web-search-deepseek"|"dsh-image-vision"|"dsh-homeassistant"|"dsh-showroom"|"dsh-liang-calibrator")(\s*\n\s*\];)/,
      (match, last, close) => {
        if (src.includes(`"${marker}"`)) return match;
        return `${last},\n\t// ${marker}: bundled desktop plugin settings\n\t"${marker}"${close}`;
      },
    );
  }
  if (next === src) {
    next = src.replace(
      /('web-search-deepseek')(\s*,?\s*\])/,
      `$1, '${marker}'$2`,
    );
  }
  if (next === src) {
    throw new Error(`failed to insert ${marker}`);
  }
  return { src: next, changed: true };
}

function patchFile(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[apiproxy] skip — missing ${filePath}`);
    return false;
  }
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes(`"${ANCHOR}"`) && !src.includes(`'${ANCHOR}'`)) {
    throw new Error(`allowlist anchor "${ANCHOR}" not found in ${filePath}`);
  }
  let changedAny = false;
  for (const ns of NAMESPACES) {
    const result = ensureNamespace(src, ns);
    src = result.src;
    changedAny = changedAny || result.changed;
    if (!result.changed) console.log(`[apiproxy] already has ${ns}`);
    else console.log(`[apiproxy] added ${ns}`);
  }
  if (changedAny) writeFileSync(filePath, src);
  console.log(`[apiproxy] ok: ${filePath}`);
  return true;
}

const primary = resolveApiProxyIndex();
patchFile(primary);
const twin = join(dirname(primary), 'types', 'api-proxy.js');
if (existsSync(twin)) {
  try {
    patchFile(twin);
  } catch (err) {
    console.warn(`[apiproxy] twin patch skipped: ${err.message || err}`);
  }
}
console.log('[apiproxy] settings allowlist ready:', NAMESPACES.join(', '));
