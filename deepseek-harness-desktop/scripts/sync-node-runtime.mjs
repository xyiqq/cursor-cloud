#!/usr/bin/env node
/**
 * Download official Node.js binary for embedding (Windows desktop preferred).
 * Avoids ELECTRON_RUN_AS_NODE incompatibilities with dsh (HMR / native addons).
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  chmodSync,
  copyFileSync,
  createWriteStream,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const NODE_VERSION = process.env.DSH_NODE_VERSION || '24.18.0';
// Desktop release targets Windows x64 even when building on Linux CI.
const TARGET = process.env.DSH_NODE_TARGET || 'win-x64';

const SPECS = {
  'win-x64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`,
    archive: 'zip',
    binaryRel: `node-v${NODE_VERSION}-win-x64/node.exe`,
    outRel: join('win-x64', 'node.exe'),
  },
  'linux-x64': {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz`,
    archive: 'tar.gz',
    binaryRel: `node-v${NODE_VERSION}-linux-x64/bin/node`,
    outRel: join('linux-x64', 'node'),
  },
};

async function download(url, dest) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  let result = spawnSync('unzip', ['-qo', zipPath, '-d', destDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    result = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'`,
      ],
      { stdio: 'inherit' },
    );
  }
  if (result.status !== 0) {
    throw new Error('failed to extract zip (need unzip or powershell)');
  }
}

function extractTarGz(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', destDir], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('failed to extract tar.gz');
}

function writeMeta(nodeRoot, target, outPath) {
  writeFileSync(
    join(nodeRoot, 'NODE_VERSION.json'),
    `${JSON.stringify(
      {
        version: NODE_VERSION,
        target,
        path: outPath,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const spec = SPECS[TARGET];
  if (!spec) throw new Error(`unsupported DSH_NODE_TARGET=${TARGET}`);

  const nodeRoot = join(root, 'resources', 'node');
  const outPath = join(nodeRoot, spec.outRel);
  mkdirSync(dirname(outPath), { recursive: true });

  if (existsSync(outPath) && process.env.DSH_NODE_FORCE !== '1') {
    console.log(`Already present: ${outPath} (set DSH_NODE_FORCE=1 to refresh)`);
    writeMeta(nodeRoot, TARGET, outPath);
    return;
  }

  const tmp = join(nodeRoot, '.tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const archivePath = join(tmp, TARGET === 'win-x64' ? 'node.zip' : 'node.tar.gz');
  await download(spec.url, archivePath);

  if (spec.archive === 'zip') extractZip(archivePath, tmp);
  else extractTarGz(archivePath, tmp);

  const extracted = join(tmp, spec.binaryRel);
  if (!existsSync(extracted)) throw new Error(`binary missing after extract: ${extracted}`);
  rmSync(outPath, { force: true });
  copyFileSync(extracted, outPath);
  if (TARGET !== 'win-x64') chmodSync(outPath, 0o755);
  rmSync(tmp, { recursive: true, force: true });
  writeMeta(nodeRoot, TARGET, outPath);
  console.log(`Node runtime ready: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
