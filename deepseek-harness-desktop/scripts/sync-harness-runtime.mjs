#!/usr/bin/env node
/**
 * Sync @deepseek-ai/dsh production dependency tree into resources/harness.
 *
 * Desktop releases are Windows-first. Linux CI cannot `npm install` packages
 * with `"os":["win32"]` (EBADPLATFORM), so we `npm pack` + extract the needed
 * Windows native addons after the main install.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const harnessDir = join(root, 'resources', 'harness');
const DSH_VERSION = process.env.DSH_VERSION || '0.1.0-rc.3';
const RUNTIME_TARGET = process.env.DSH_RUNTIME_TARGET || 'win32';

/** Explicit Windows natives that optionalDependencies would skip on Linux CI. */
const WIN32_NATIVE_PACKAGES = [
  '@koromix/koffi-win32-x64@3.1.4',
  '@img/sharp-win32-x64@0.35.3',
  'node-addon-require-builtin-win32-x64-msvc@0.1.4',
];

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: opts.stdio ?? 'inherit',
    shell: process.platform === 'win32',
    encoding: opts.encoding,
    ...opts,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
  return result;
}

function scopedPackageDir(spec) {
  // "@koromix/koffi-win32-x64@3.1.4" -> ["@koromix", "koffi-win32-x64"]
  const at = spec.lastIndexOf('@');
  const name = at > 0 ? spec.slice(0, at) : spec;
  if (name.startsWith('@')) {
    const [scope, pkg] = name.split('/');
    return { name, rel: join(scope, pkg) };
  }
  return { name, rel: name };
}

function forcePackInstall(spec, nm) {
  const { name, rel } = scopedPackageDir(spec);
  const dest = join(nm, rel);
  const tmp = join(harnessDir, '.pack-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  console.log(`[sync] pack+extract ${spec} → ${dest}`);
  run('npm', ['pack', spec, '--pack-destination', tmp], { cwd: tmp });
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error(`npm pack produced no tgz for ${spec}`);

  run('tar', ['-xzf', join(tmp, tgz), '-C', tmp]);
  const extracted = join(tmp, 'package');
  if (!existsSync(extracted)) throw new Error(`extract missing package/ for ${spec}`);

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(extracted, dest);
  rmSync(tmp, { recursive: true, force: true });

  // Ensure parent package can resolve the optional dep name via node_modules layout.
  // For scoped packages npm expects node_modules/@scope/pkg — already handled by `rel`.
  console.log(`[sync] installed ${name}`);
}

function assertWin32Natives(nm) {
  const required = [
    join(nm, '@koromix', 'koffi-win32-x64'),
    join(nm, '@img', 'sharp-win32-x64'),
    join(nm, 'node-addon-require-builtin-win32-x64-msvc'),
  ];
  const missing = required.filter((p) => !existsSync(p));
  if (missing.length) {
    throw new Error(
      `Windows native modules missing after sync:\n${missing.map((m) => ` - ${m}`).join('\n')}`,
    );
  }
  // Sanity: koffi win32 package should contain a .node binary somewhere
  const koffiDir = join(nm, '@koromix', 'koffi-win32-x64');
  const hasNode = spawnSync('find', [koffiDir, '-name', '*.node'], { encoding: 'utf8' });
  if (!String(hasNode.stdout || '').trim()) {
    console.warn('[sync] warn: no .node file found under koffi-win32-x64');
  } else {
    console.log('[sync] koffi-win32-x64 contains native binary');
  }
  console.log('[sync] Windows native modules present');
}

function main() {
  mkdirSync(harnessDir, { recursive: true });

  const pkg = {
    name: 'deepseek-harness-embedded-runtime',
    version: '0.0.0',
    private: true,
    description: 'Embedded production dependency tree for DeepSeek Harness desktop',
    dependencies: {
      '@deepseek-ai/dsh': DSH_VERSION,
    },
  };
  writeFileSync(join(harnessDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  const nm = join(harnessDir, 'node_modules');
  if (existsSync(nm) && process.env.DSH_SYNC_KEEP_MODULES !== '1') {
    console.log('Removing previous node_modules…');
    rmSync(nm, { recursive: true, force: true });
  }

  run('npm', ['install', '--omit=dev', '--no-fund', '--no-audit', '--ignore-scripts=false'], {
    cwd: harnessDir,
    env: {
      ...process.env,
      npm_config_ignore_scripts: 'false',
    },
  });

  if (RUNTIME_TARGET === 'win32') {
    // Prefer matching the resolved koffi version when present.
    let natives = [...WIN32_NATIVE_PACKAGES];
    try {
      const koffiVer = JSON.parse(
        readFileSync(join(nm, 'koffi', 'package.json'), 'utf8'),
      ).version;
      natives = natives.map((spec) =>
        spec.startsWith('@koromix/koffi-win32-x64@')
          ? `@koromix/koffi-win32-x64@${koffiVer}`
          : spec,
      );
    } catch {
      /* keep defaults */
    }
    for (const spec of natives) {
      forcePackInstall(spec, nm);
    }
    assertWin32Natives(nm);
  }

  for (const name of ['node-pty']) {
    if (existsSync(join(nm, name))) {
      try {
        run('npm', ['rebuild', name], { cwd: harnessDir });
      } catch (err) {
        console.warn(`[sync] warn: npm rebuild ${name} failed:`, err.message || err);
      }
    }
  }

  if (RUNTIME_TARGET === 'win32') {
    const ptyWin = join(nm, 'node-pty', 'prebuilds', 'win32-x64');
    if (!existsSync(ptyWin)) {
      console.warn(`[sync] warn: missing ${ptyWin}`);
    } else {
      console.log('[sync] node-pty win32-x64 prebuilds present');
    }
  }

  const ensureSpawn = join(
    nm,
    '@deepseek-ai',
    'dsh-subprocess-local',
    'scripts',
    'ensure-spawn-helper.mjs',
  );
  if (existsSync(ensureSpawn)) {
    try {
      run(process.execPath, [ensureSpawn], { cwd: dirname(ensureSpawn) });
    } catch (err) {
      console.warn('[sync] warn: ensure-spawn-helper failed:', err.message || err);
    }
  }

  const dshPkgPath = join(nm, '@deepseek-ai', 'dsh', 'package.json');
  if (!existsSync(dshPkgPath)) {
    throw new Error(`dsh package missing after install: ${dshPkgPath}`);
  }
  const dshPkg = JSON.parse(readFileSync(dshPkgPath, 'utf8'));

  const meta = {
    dshVersionRequested: DSH_VERSION,
    dshVersionResolved: dshPkg.version,
    runtimeTarget: RUNTIME_TARGET,
    syncedAt: new Date().toISOString(),
    hostPlatform: process.platform,
    hostArch: process.arch,
    node: process.version,
    npm: spawnSync('npm', ['-v'], { encoding: 'utf8' }).stdout?.trim() || null,
    win32Natives: RUNTIME_TARGET === 'win32' ? WIN32_NATIVE_PACKAGES : [],
    note: 'Generated by scripts/sync-harness-runtime.mjs — do not hand-edit.',
  };
  writeFileSync(join(harnessDir, 'RUNTIME_VERSION.json'), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(harnessDir, '.gitkeep'), '');

  console.log('Runtime synced:');
  console.log(JSON.stringify(meta, null, 2));
}

main();
