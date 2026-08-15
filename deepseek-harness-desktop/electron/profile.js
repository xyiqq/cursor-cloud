'use strict';

/**
 * Desktop profile bootstrap (ningbainb-aligned) + bundled plugins:
 * - dsh-image-vision (图片理解)
 * - dsh-homeassistant (HA REST + optional MCP bridge state)
 * - dsh-showroom (展厅编排 / 孪生墙 Hub；不含 ASR)
 * - dsh-plugin-liang-calibrator (滑动变祖器 / 先选模型，滑条只调思考强度)
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
  '@deepseek-ai/dsh-mcp-client',
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
const PLUGIN_FILES = Object.freeze([
  'index.js',
  'index.mjs',
  'client.js',
  'package.json',
  'hub.mjs',
  'ORIGIN.txt',
]);
const PLUGIN_DIRS = Object.freeze(['web', 'skills', 'lib']);
const BUNDLED_PLUGINS = Object.freeze([
  'dsh-image-vision',
  'dsh-homeassistant',
  'dsh-showroom',
  'dsh-plugin-liang-calibrator',
]);

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

function isInsideAsarArchive(filePath) {
  // Real disk twin is app.asar.unpacked; plain app.asar cannot fs.cp directories.
  return /(?:^|[/\\])app\.asar(?!\.unpacked)(?:[/\\]|$)/.test(String(filePath));
}

function pluginHasEntry(dir) {
  return (
    fs.existsSync(path.join(dir, 'index.js')) ||
    fs.existsSync(path.join(dir, 'index.mjs')) ||
    fs.existsSync(path.join(dir, 'lib', 'index.js'))
  );
}

function resolveBundledPluginDir(pluginName) {
  /** @type {string[]} */
  const candidates = [];
  const push = (dir) => {
    if (!dir) return;
    const physical = materializeFilesystemPath(dir);
    for (const d of [physical, dir]) {
      if (d && !candidates.includes(d)) candidates.push(d);
    }
  };
  // Prefer unpacked / real filesystem paths first (packaged Electron).
  if (process.resourcesPath) {
    push(path.join(process.resourcesPath, 'app.asar.unpacked', 'plugins', pluginName));
    push(path.join(process.resourcesPath, 'plugins', pluginName));
  }
  push(path.join(__dirname, '..', 'plugins', pluginName));

  let asarFallback = null;
  for (const dir of candidates) {
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'));
    if (!hasPkg || !pluginHasEntry(dir)) continue;
    if (isInsideAsarArchive(dir)) {
      asarFallback = asarFallback || dir;
      continue;
    }
    return dir;
  }
  return asarFallback;
}

async function copyPluginTree(fromDir, toDir) {
  const physical = materializeFilesystemPath(fromDir);
  const src = fs.existsSync(physical) ? physical : fromDir;
  if (isInsideAsarArchive(src)) {
    throw new Error(
      `cannot copy plugin directory from asar (${src}); expected app.asar.unpacked twin`,
    );
  }
  await fsp.cp(src, toDir, { recursive: true, force: true });
}

async function installBundledPlugin({ dshHome, profileDir, pluginName }) {
  const sourceDir = resolveBundledPluginDir(pluginName);
  if (!sourceDir) {
    throw new Error(`bundled plugins/${pluginName} is missing from the app package`);
  }
  const targets = [
    path.join(profileDir, 'node_modules', pluginName),
    path.join(dshHome, 'profiles', 'node_modules', pluginName),
  ];
  const files = PLUGIN_FILES.filter((file) => fs.existsSync(path.join(sourceDir, file)));
  if (!files.includes('package.json') || !pluginHasEntry(sourceDir)) {
    throw new Error(`plugins/${pluginName} missing package.json or entry`);
  }
  let changed = false;
  for (const dest of targets) {
    await fsp.mkdir(dest, { recursive: true });
    // Drop stale alternate entry so require/import resolve cleanly.
    for (const stale of ['index.js', 'index.mjs']) {
      if (!files.includes(stale)) {
        await fsp.rm(path.join(dest, stale), { force: true });
      }
    }
    for (const file of files) {
      const from = path.join(sourceDir, file);
      const to = path.join(dest, file);
      const content = await fsp.readFile(from);
      let same = false;
      try {
        const existing = await fsp.readFile(to);
        same = Buffer.compare(existing, content) === 0;
      } catch {
        same = false;
      }
      if (!same) {
        await fsp.writeFile(to, content);
        changed = true;
      }
    }
    for (const dirName of PLUGIN_DIRS) {
      const fromDir = path.join(sourceDir, dirName);
      const physicalDir = materializeFilesystemPath(fromDir);
      const srcDir = fs.existsSync(physicalDir)
        ? physicalDir
        : fs.existsSync(fromDir)
          ? fromDir
          : null;
      if (!srcDir) continue;
      const toDir = path.join(dest, dirName);
      await copyPluginTree(srcDir, toDir);
      changed = true;
    }
  }

  // Mirror narration skills into DSH_HOME/skills for optional host pickup.
  const skillsSrcRaw = path.join(sourceDir, 'skills');
  const skillsPhysical = materializeFilesystemPath(skillsSrcRaw);
  const skillsSrc = fs.existsSync(skillsPhysical)
    ? skillsPhysical
    : fs.existsSync(skillsSrcRaw)
      ? skillsSrcRaw
      : null;
  if (skillsSrc && !isInsideAsarArchive(skillsSrc)) {
    const skillsDest = path.join(dshHome, 'skills', 'showroom');
    await fsp.mkdir(skillsDest, { recursive: true });
    await copyPluginTree(skillsSrc, skillsDest);
  }

  return { changed, sourceDir, targets };
}

function readHaMcpState(dshHome) {
  return readJsonSync(path.join(dshHome, 'desktop-ha-mcp.json'));
}

/**
 * User-managed local plugins that survive profile rewrites.
 * File: `$DSH_HOME/desktop-extra-plugins.json`
 *
 * ```json
 * [
 *   {
 *     "id": "liang-calibrator",
 *     "name": "dsh-plugin-liang-calibrator",
 *     "path": "C:/path/to/Liang-Saint-Slider"
 *   }
 * ]
 * ```
 *
 * `path` may be absolute, or relative to `$DSH_HOME`. If omitted, defaults to
 * `$DSH_HOME/extra-plugins/<name>`.
 *
 * @returns {Array<{ id: string, name: string, path?: string, config?: object }>}
 */
function readExtraPlugins(dshHome) {
  const raw = readJsonSync(path.join(dshHome, 'desktop-extra-plugins.json'));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.plugins) ? raw.plugins : [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim();
      if (!name) return null;
      const id = String(item.id || name.replace(/^@/, '').replace(/[/\\]/g, '-')).trim();
      return {
        id,
        name,
        path: item.path ? String(item.path) : undefined,
        config: item.config && typeof item.config === 'object' ? item.config : undefined,
      };
    })
    .filter(Boolean);
}

function resolveExtraPluginDir(dshHome, plugin) {
  const candidates = [];
  if (plugin.path) {
    candidates.push(
      path.isAbsolute(plugin.path) ? plugin.path : path.join(dshHome, plugin.path),
    );
  }
  candidates.push(path.join(dshHome, 'extra-plugins', plugin.name));
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json')) && pluginHasEntry(dir)) return dir;
  }
  return null;
}

function formatCordisConfig(config, indent = '        ') {
  if (!config || typeof config !== 'object' || !Object.keys(config).length) return '';
  const lines = ['      config:'];
  for (const [key, value] of Object.entries(config)) {
    lines.push(`${indent}${key}: ${JSON.stringify(value)}`);
  }
  return `${lines.join('\n')}\n`;
}

function buildCordisPatchYaml(dshHome) {
  const parts = [
    `# Managed by DeepSeek Harness Desktop — bundled plugins.
# Local extras: edit $DSH_HOME/desktop-extra-plugins.json (do not hand-edit this file).
- insert:
    - id: image-vision
      name: dsh-image-vision
      config:
        enabled: true
        patchAdmission: true
    - id: homeassistant
      name: dsh-homeassistant
      config:
        enabled: false
    - id: showroom
      name: dsh-showroom
      config:
        enabled: true
    - id: liang-calibrator
      name: dsh-plugin-liang-calibrator
`,
  ];

  for (const plugin of readExtraPlugins(dshHome)) {
    parts.push(`    - id: ${plugin.id}
      name: ${JSON.stringify(plugin.name)}
${formatCordisConfig(plugin.config)}`);
  }

  const mcp = readHaMcpState(dshHome);
  if (mcp?.enabled && mcp.url) {
    const headers = mcp.headers && typeof mcp.headers === 'object' ? mcp.headers : {};
    const headerLines = Object.entries(headers)
      .map(([k, v]) => `          ${JSON.stringify(k)}: ${JSON.stringify(String(v))}`)
      .join('\n');
    parts.push(`    - id: mcp-homeassistant
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        transport: streamable-http
        serverName: homeassistant
        url: ${JSON.stringify(String(mcp.url))}
        failOnStartupError: false
${headerLines ? `        headers:\n${headerLines}\n` : ''}`);
  }

  return `${parts.join('')}`;
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
  for (const pluginName of BUNDLED_PLUGINS) {
    const dir = resolveBundledPluginDir(pluginName);
    if (dir) {
      manifest.dependencies[pluginName] = `link:${dir.replaceAll('\\', '/')}`;
    }
  }
  const extraPlugins = readExtraPlugins(dshHome);
  for (const plugin of extraPlugins) {
    const dir = resolveExtraPluginDir(dshHome, plugin);
    if (dir) {
      manifest.dependencies[plugin.name] = `link:${dir.replaceAll('\\', '/')}`;
    }
  }
  manifest.dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies).toSorted(([a], [b]) => a.localeCompare(b)),
  );

  let changed = false;
  changed = (await writeIfChanged(path.join(profileDir, 'cordis.yml'), ROOT_CONFIG)) || changed;
  changed =
    (await writeIfChanged(path.join(profileDir, 'cordis.patch.yml'), buildCordisPatchYaml(dshHome))) ||
    changed;
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
  for (const plugin of extraPlugins) {
    const sourceDir = resolveExtraPluginDir(dshHome, plugin);
    if (!sourceDir) {
      console.warn(`[profile] extra plugin missing on disk: ${plugin.name}`);
      continue;
    }
    const result = await linkManagedPackage({
      packageName: plugin.name,
      profileDir,
      sourceDir,
      previous: previousRecords[plugin.name],
    });
    nextRecords[plugin.name] = result.record;
    changed = result.changed || changed;
  }
  changed = (await writeIfChanged(recordPath, `${JSON.stringify(nextRecords, null, 2)}\n`)) || changed;

  const installedPlugins = {};
  for (const pluginName of BUNDLED_PLUGINS) {
    const result = await installBundledPlugin({ dshHome, profileDir, pluginName });
    installedPlugins[pluginName] = result;
    changed = result.changed || changed;
  }

  return {
    changed,
    manifest,
    profileDir,
    plugins: installedPlugins,
    mcpEnabled: !!readHaMcpState(dshHome)?.enabled,
  };
}

function resolveDshCliPath() {
  const root = resolvePackageRoot('@deepseek-ai/dsh', [path.join(__dirname, 'main.js')]);
  if (!root) throw new Error('未找到 @deepseek-ai/dsh runtime');
  return path.join(root, 'lib', 'bin.js');
}

module.exports = {
  BUILTIN_BUNDLES,
  MANAGED_PACKAGES,
  BUNDLED_PLUGINS,
  materializeFilesystemPath,
  ensureDesktopProfile,
  resolveBundledPluginDir,
  resolveBundledImageVisionDir: () => resolveBundledPluginDir('dsh-image-vision'),
  resolveDshCliPath,
  buildCordisPatchYaml,
  readExtraPlugins,
  resolveExtraPluginDir,
};
