'use strict';

/**
 * Minimal desktop profile bootstrap (aligned with ningbainb/deepseek-harness-desktop).
 * Links official boot packages into ~/.dsh/profiles/desktop so `dsh --profile desktop`
 * resolves hermetically from the packaged app.asar.unpacked tree.
 */

const { createRequire } = require('node:module');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const BUILTIN_BUNDLES = Object.freeze([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
]);

/** @type {readonly string[]} */
const MANAGED_PACKAGES = Object.freeze([
  '@deepseek-ai/cordis-plugin-group',
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-anonymous-user-id',
  '@deepseek-ai/dsh-atomic-write',
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-bash-local',
  '@deepseek-ai/dsh-code-runtime',
  '@deepseek-ai/dsh-compaction',
  '@deepseek-ai/dsh-fs',
  '@deepseek-ai/dsh-output-retention',
  '@deepseek-ai/dsh-sandbox',
  '@deepseek-ai/dsh-scope',
  '@deepseek-ai/dsh-session-telemetry',
  '@deepseek-ai/dsh-session-title-llm',
  '@deepseek-ai/dsh-shell',
  '@deepseek-ai/dsh-spill',
  '@deepseek-ai/dsh-subagent-in-process-driver',
  '@deepseek-ai/dsh-subprocess',
  '@deepseek-ai/dsh-timeout',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-workflow',
].toSorted());

const ROOT_CONFIG = '[]\n';
const WORKSPACE_CONFIG = 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n';

function materializeFilesystemPath(filePath) {
  return String(filePath).replace(/([\\/])app\.asar([\\/])/g, '$1app.asar.unpacked$2');
}

function packagePathSegments(packageName) {
  return packageName.split('/');
}

function readJsonSync(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return undefined;
    throw err;
  }
}

async function pathExists(filePath) {
  try {
    await fsp.lstat(filePath);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

async function atomicWrite(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, content, { encoding: 'utf8' });
  await fsp.rename(temporary, filePath);
}

async function writeIfChanged(filePath, content) {
  try {
    if ((await fsp.readFile(filePath, 'utf8')) === content) return false;
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
  await atomicWrite(filePath, content);
  return true;
}

function resolvePackageRoot(packageName, anchors) {
  for (const anchor of anchors) {
    const req = createRequire(anchor);
    try {
      return materializeFilesystemPath(path.dirname(req.resolve(`${packageName}/package.json`)));
    } catch {
      /* try walk */
    }
    try {
      let cursor = path.dirname(req.resolve(packageName));
      for (;;) {
        const manifest = readJsonSync(path.join(cursor, 'package.json'));
        if (manifest?.name === packageName) {
          return materializeFilesystemPath(cursor);
        }
        const parent = path.dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
    } catch {
      /* next anchor */
    }
  }
  return undefined;
}

function resolveManagedPackages(initialAnchor = path.join(__dirname, 'main.js')) {
  const pending = new Set(MANAGED_PACKAGES);
  const anchors = [initialAnchor];
  const resolved = new Map();

  while (pending.size > 0) {
    let progressed = false;
    for (const packageName of [...pending]) {
      const root = resolvePackageRoot(packageName, anchors);
      if (!root) continue;
      resolved.set(packageName, root);
      anchors.push(path.join(root, 'package.json'));
      pending.delete(packageName);
      progressed = true;
    }
    if (!progressed) {
      throw new Error(`desktop runtime packages missing: ${[...pending].join(', ')}`);
    }
  }
  return resolved;
}

async function linkManagedPackage({ packageName, profileDir, sourceDir, previous }) {
  const target = path.join(profileDir, 'node_modules', ...packagePathSegments(packageName));
  await fsp.mkdir(path.dirname(target), { recursive: true });
  if (await pathExists(target)) {
    try {
      if ((await fsp.realpath(target)) === (await fsp.realpath(sourceDir))) {
        return { changed: false, record: { mode: 'link', source: sourceDir } };
      }
    } catch {
      /* compare copy below */
    }
    const installed = await readJsonIfPresent(path.join(target, 'package.json'));
    if (previous?.mode === 'copy' && previous.source === sourceDir && installed?.name === packageName) {
      return { changed: false, record: previous };
    }
    // Replace stale links from older desktop builds.
    await fsp.rm(target, { recursive: true, force: true });
  }

  try {
    await fsp.symlink(sourceDir, target, process.platform === 'win32' ? 'junction' : 'dir');
    return { changed: true, record: { mode: 'link', source: sourceDir } };
  } catch (err) {
    if (!['EACCES', 'EPERM', 'UNKNOWN'].includes(err?.code)) throw err;
    await fsp.cp(sourceDir, target, { recursive: true, force: true });
    return { changed: true, record: { mode: 'copy', source: sourceDir } };
  }
}

function createDesktopProfileManifest(existing = {}) {
  const existingBundles = existing.dsh?.profile?.bundles;
  const communityBundles = Array.isArray(existingBundles)
    ? existingBundles.filter((name) => !BUILTIN_BUNDLES.includes(name))
    : [];
  return {
    name: 'dsh-profile-desktop',
    private: true,
    dependencies: { ...(existing.dependencies ?? {}) },
    dsh: {
      profile: {
        bundles: [...BUILTIN_BUNDLES, ...communityBundles],
      },
    },
  };
}

/**
 * @param {{ dshHome: string, profileName?: string }} opts
 */
async function ensureDesktopProfile({ dshHome, profileName = 'desktop' } = {}) {
  if (!dshHome) throw new TypeError('dshHome is required');
  const packageRoots = resolveManagedPackages();
  const profileDir = path.join(dshHome, 'profiles', profileName);
  await fsp.mkdir(profileDir, { recursive: true });

  const manifestPath = path.join(profileDir, 'package.json');
  const existing = await readJsonIfPresent(manifestPath);
  const manifest = createDesktopProfileManifest(existing);

  for (const [packageName, sourceDir] of packageRoots) {
    manifest.dependencies[packageName] = `link:${sourceDir.replaceAll('\\', '/')}`;
  }
  manifest.dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies).toSorted(([a], [b]) => a.localeCompare(b)),
  );

  let changed = false;
  changed = (await writeIfChanged(path.join(profileDir, 'cordis.yml'), ROOT_CONFIG)) || changed;
  changed = (await writeIfChanged(path.join(profileDir, 'cordis.patch.yml'), ROOT_CONFIG)) || changed;
  changed = (await writeIfChanged(path.join(profileDir, 'pnpm-workspace.yaml'), WORKSPACE_CONFIG)) || changed;
  changed = (await writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)) || changed;

  const recordPath = path.join(profileDir, '.dsh-desktop-links.json');
  const previousRecords = (await readJsonIfPresent(recordPath)) ?? {};
  const nextRecords = {};
  for (const [packageName, sourceDir] of [...packageRoots].toSorted(([a], [b]) => a.localeCompare(b))) {
    const result = await linkManagedPackage({
      packageName,
      profileDir,
      sourceDir,
      previous: previousRecords[packageName],
    });
    nextRecords[packageName] = result.record;
    changed = result.changed || changed;
  }
  changed = (await writeIfChanged(recordPath, `${JSON.stringify(nextRecords, null, 2)}\n`)) || changed;

  return { changed, manifest, profileDir };
}

function resolveDshCliPath() {
  const root = resolvePackageRoot('@deepseek-ai/dsh', [path.join(__dirname, 'main.js')]);
  if (!root) throw new Error('未找到 @deepseek-ai/dsh runtime');
  return path.join(root, 'lib', 'bin.js');
}

module.exports = {
  BUILTIN_BUNDLES,
  MANAGED_PACKAGES,
  materializeFilesystemPath,
  ensureDesktopProfile,
  resolveDshCliPath,
};
