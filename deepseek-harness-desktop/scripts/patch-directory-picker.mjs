#!/usr/bin/env node
/**
 * Patch @deepseek-ai/dsh-host-directory-picker-native for Electron desktop.
 *
 * Upstream worker disconnects the IPC channel after EVERY message, including
 * `showing`. That races with the modal Show() and often yields:
 *   "win32 folder dialog worker exited before reporting a result"
 *
 * Also force windowsHide=false so the COM folder dialog can surface.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgRoot = join(
  root,
  'resources',
  'harness',
  'node_modules',
  '@deepseek-ai',
  'dsh-host-directory-picker-native',
);
const workerPath = join(pkgRoot, 'lib', 'worker.cjs');
const indexPath = join(pkgRoot, 'lib', 'index.js');

function mustExist(p) {
  if (!existsSync(p)) throw new Error(`missing ${p}; run sync:runtime first`);
}

function patchWorker() {
  mustExist(workerPath);
  let src = readFileSync(workerPath, 'utf8');
  if (src.includes('DSH_DESKTOP_PICKER_PATCH')) {
    console.log('[patch] worker.cjs already patched');
    return;
  }

  const needle = `const post = (message) => {
	/* v8 ignore next 3 -- disconnect needs a live IPC channel the unit lane must not sever (built-worker.e2e.ts owns the real close path). */
	send(message, () => {
		if (process.connected) process.disconnect();
	});
};`;

  const replacement = `const post = (message) => {
	/* DSH_DESKTOP_PICKER_PATCH: only disconnect after terminal messages.
	   Disconnecting after "showing" races the modal Show() and kills the worker. */
	const terminal = message && (message.kind === "done" || message.kind === "error");
	send(message, () => {
		if (terminal && process.connected) process.disconnect();
	});
};`;

  if (!src.includes(needle)) {
    // Fallback: looser replace
    const loose = /const post = \(message\) => \{[\s\S]*?process\.disconnect\(\);\s*\}\);?\s*\};/;
    if (!loose.test(src)) {
      throw new Error('worker.cjs post() block not found — upstream changed');
    }
    src = src.replace(
      loose,
      `const post = (message) => {
	/* DSH_DESKTOP_PICKER_PATCH */
	const terminal = message && (message.kind === "done" || message.kind === "error");
	send(message, () => {
		if (terminal && process.connected) process.disconnect();
	});
};`,
    );
  } else {
    src = src.replace(needle, replacement);
  }

  writeFileSync(workerPath, src);
  console.log('[patch] patched worker.cjs');
}

function patchIndex() {
  mustExist(indexPath);
  let src = readFileSync(indexPath, 'utf8');
  if (src.includes('DSH_DESKTOP_PICKER_PATCH')) {
    console.log('[patch] index.js already patched');
    return;
  }

  // Prefer visible dialog; keep IPC; pipe stdio so Electron-piped parents don't confuse inherit.
  const oldSpawn = `if (!import.meta.url.endsWith(".ts")) return spawn(process.execPath, [fileURLToPath(new URL("./worker.cjs", import.meta.url))], {
		env,
		stdio,
		windowsHide: true
	});`;

  const newSpawn = `if (!import.meta.url.endsWith(".ts")) return spawn(process.execPath, [fileURLToPath(new URL("./worker.cjs", import.meta.url))], {
		/* DSH_DESKTOP_PICKER_PATCH */
		env,
		stdio: ["ignore", "pipe", "pipe", "ipc"],
		windowsHide: false
	});`;

  if (src.includes(oldSpawn)) {
    src = src.replace(oldSpawn, newSpawn);
  } else if (src.includes('windowsHide: true')) {
    src = src.replace(
      /return spawn\(process\.execPath, \[fileURLToPath\(new URL\("\.\/worker\.cjs", import\.meta\.url\)\)\], \{\s*env,\s*stdio,\s*windowsHide: true\s*\}\);/,
      `return spawn(process.execPath, [fileURLToPath(new URL("./worker.cjs", import.meta.url))], {
		/* DSH_DESKTOP_PICKER_PATCH */
		env,
		stdio: ["ignore", "pipe", "pipe", "ipc"],
		windowsHide: false
	});`,
    );
  } else {
    throw new Error('index.js spawnDialogWorker block not found — upstream changed');
  }

  writeFileSync(indexPath, src);
  console.log('[patch] patched index.js spawnDialogWorker');
}

patchWorker();
patchIndex();
console.log('[patch] directory picker native patches applied');
