#!/usr/bin/env node
/**
 * Verify embedded harness runtime: bin exists, --help / web --help work.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { constants as zlibConstants } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const harnessDir = join(root, 'resources', 'harness');
const dshBin = join(harnessDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');

function fail(msg) {
  console.error(`[verify:runtime] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify:runtime] OK: ${msg}`);
}

function main() {
  // zstd APIs required by @deepseek-ai/dsh-session-persistence-jsonl
  const zlib = createRequire(import.meta.url)('node:zlib');
  if (typeof zlib.createZstdDecompress !== 'function') {
    fail(
      `当前 Node ${process.version} 缺少 node:zlib.createZstdDecompress。请使用 Node ≥22.19 / 24.x（与 Electron ≥41 一致）。`,
    );
  }
  ok(`Node ${process.version} 支持 zstd（zlib constants=${Boolean(zlibConstants)})`);

  if (!existsSync(harnessDir)) {
    fail(`缺少 ${harnessDir}，请先 npm run sync:runtime`);
  }
  if (!existsSync(dshBin)) {
    fail(`缺少 dsh bin：${dshBin}`);
  }
  ok(`found ${dshBin}`);

  const metaPath = join(harnessDir, 'RUNTIME_VERSION.json');
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    ok(`RUNTIME_VERSION.json → dsh ${meta.dshVersionResolved} (synced ${meta.syncedAt})`);
  } else {
    console.warn('[verify:runtime] WARN: RUNTIME_VERSION.json missing');
  }

  const version = spawnSync(process.execPath, [dshBin, '--version'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (version.status !== 0) {
    fail(`dsh --version failed: ${version.stderr || version.stdout}`);
  }
  ok(`dsh --version → ${version.stdout.trim()}`);

  const help = spawnSync(process.execPath, [dshBin, 'web', '--help'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (help.status !== 0) {
    fail(`dsh web --help failed: ${help.stderr || help.stdout}`);
  }
  const text = `${help.stdout}\n${help.stderr}`;
  for (const flag of ['--host', '--port', '--trusted-host']) {
    if (!text.includes(flag)) {
      fail(`dsh web --help 未包含 ${flag}`);
    }
  }
  ok('dsh web --help 含 --host / --port / --trusted-host');

  // Desktop ships a Windows runtime; ensure win32 natives exist even when verifying on Linux.
  const winNatives = [
    join(harnessDir, 'node_modules', '@koromix', 'koffi-win32-x64'),
    join(harnessDir, 'node_modules', '@img', 'sharp-win32-x64'),
    join(harnessDir, 'node_modules', 'node-addon-require-builtin-win32-x64-msvc'),
  ];
  for (const p of winNatives) {
    if (!existsSync(p)) {
      fail(`缺少 Windows 原生模块：${p}（请用默认 DSH_RUNTIME_TARGET=win32 重新 sync:runtime）`);
    }
  }
  ok('Windows 原生模块就绪（koffi / sharp / node-addon-require-builtin）');

  // Sanity: refuse 0.0.0.0 still present in upstream
  const badHost = spawnSync(process.execPath, [dshBin, 'web', '--host', '0.0.0.0', '--port', '0'], {
    encoding: 'utf8',
    env: process.env,
    timeout: 15_000,
  });
  const errText = `${badHost.stdout}\n${badHost.stderr}`;
  if (badHost.status === 0) {
    fail('上游居然接受了 --host 0.0.0.0（桌面端仍应只绑 127.0.0.1）');
  }
  if (!/0\.0\.0\.0/.test(errText)) {
    console.warn('[verify:runtime] WARN: 拒绝 0.0.0.0 的报错文案可能已变化');
  } else {
    ok('上游拒绝 --host 0.0.0.0');
  }

  console.log('[verify:runtime] all checks passed');
}

main();
