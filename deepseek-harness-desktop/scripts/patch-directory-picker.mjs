#!/usr/bin/env node
/**
 * Replace the fragile koffi COM folder-dialog worker with a PowerShell
 * FolderBrowserDialog that speaks the same IPC protocol.
 *
 * Also patch spawnDialogWorker to keep the dialog visible.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgRoot = join(
  root,
  'node_modules',
  '@deepseek-ai',
  'dsh-host-directory-picker-native',
);
const workerPath = join(pkgRoot, 'lib', 'worker.cjs');
const indexPath = join(pkgRoot, 'lib', 'index.js');

const POWERSHELL_WORKER = `'use strict';
/* DSH_DESKTOP_PICKER_PATCH: PowerShell FolderBrowserDialog worker */
const { spawnSync } = require('node:child_process');

const title = process.env.DSH_DIALOG_TITLE || 'Select Workspace Directory';
if (process.send === undefined) {
  throw new Error('win32-dialog-worker must run as a child process with an IPC channel');
}
const send = process.send.bind(process);
const post = (message) => {
  const terminal = message && (message.kind === 'done' || message.kind === 'error');
  send(message, () => {
    if (terminal && process.connected) process.disconnect();
  });
};
process.on('disconnect', () => process.exit(0));

function pickWithPowerShell() {
  const escaped = String(title).replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$d.Description = '" + escaped + "'",
    "$d.ShowNewFolderButton = $true",
    "$r = $d.ShowDialog()",
    "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }",
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: false,
      timeout: 10 * 60 * 1000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && !(result.stdout || '').trim()) {
    const err = (result.stderr || '').trim() || ('powershell exit ' + result.status);
    throw new Error(err);
  }
  const selected = String(result.stdout || '').replace(/\\r?\\n$/, '').trim();
  return selected === '' ? null : selected;
}

try {
  // threadId is unused by PowerShell path; parent only needs the protocol.
  post({ kind: 'showing', threadId: 0 });
  post({ kind: 'done', path: pickWithPowerShell() });
} catch (error) {
  post({
    kind: 'error',
    message: error instanceof Error ? error.stack || error.message : String(error),
  });
}
`;

function patchWorker() {
  if (!existsSync(workerPath)) {
    console.warn('[patch] directory-picker-native not installed; skip worker');
    return;
  }
  writeFileSync(workerPath, POWERSHELL_WORKER);
  console.log('[patch] replaced worker.cjs with PowerShell FolderBrowserDialog');
}

function patchIndex() {
  if (!existsSync(indexPath)) {
    console.warn('[patch] directory-picker-native not installed; skip index');
    return;
  }
  let src = readFileSync(indexPath, 'utf8');
  if (src.includes('DSH_DESKTOP_PICKER_PATCH')) {
    console.log('[patch] index.js already patched');
    return;
  }
  const replaced = src.replace(
    /return spawn\(process\.execPath, \[fileURLToPath\(new URL\("\.\/worker\.cjs", import\.meta\.url\)\)\], \{\s*env,\s*stdio,\s*windowsHide: true\s*\}\);/,
    `return spawn(process.execPath, [fileURLToPath(new URL("./worker.cjs", import.meta.url))], {
		/* DSH_DESKTOP_PICKER_PATCH */
		env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
		stdio: ["ignore", "pipe", "pipe", "ipc"],
		windowsHide: false
	});`,
  );
  if (replaced === src) {
    throw new Error('index.js spawnDialogWorker pattern not found');
  }
  writeFileSync(indexPath, replaced);
  console.log('[patch] patched index.js spawnDialogWorker');
}

patchWorker();
patchIndex();
console.log('[patch] directory picker patches applied');
