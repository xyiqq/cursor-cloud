'use strict';

const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { initUpdater } = require('./updater');

const isDev = process.env.ELECTRON_DEV === '1' || !app.isPackaged;
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 400;

/** @type {import('node:child_process').ChildProcess | null} */
let dshProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
let harnessPort = 0;
let shuttingDown = false;
/** @type {ReturnType<typeof initUpdater> | null} */
let updaterApi = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow || splashWindow;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function userDataPaths() {
  const userData = app.getPath('userData');
  return {
    userData,
    dshHome: path.join(userData, 'dsh-home'),
    workspace: path.join(userData, 'workspace'),
  };
}

function ensureDirs() {
  const { dshHome, workspace } = userDataPaths();
  fs.mkdirSync(dshHome, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });
  return { dshHome, workspace };
}

function resolveBundledHarnessRoot() {
  if (app.isPackaged) {
    // Packaged: extraResources → resources/harness
    // Also try next to execPath (zip / some portable layouts)
    const candidates = [
      path.join(process.resourcesPath, 'harness'),
      path.join(path.dirname(process.execPath), 'resources', 'harness'),
    ];
    for (const root of candidates) {
      if (fs.existsSync(resolveDshBin(root))) return root;
    }
    return candidates[0];
  }
  return path.join(__dirname, '..', 'resources', 'harness');
}

function resolveDshBin(harnessRoot) {
  return path.join(
    harnessRoot,
    'node_modules',
    '@deepseek-ai',
    'dsh',
    'lib',
    'bin.js',
  );
}

function readRuntimeVersion(harnessRoot) {
  try {
    const p = path.join(harnessRoot, 'RUNTIME_VERSION.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Portable NSIS extracts under %TEMP%; AV often quarantines files there.
 * Stage a stable copy under userData so subsequent launches survive Temp wipes.
 */
function stagedHarnessRoot() {
  return path.join(app.getPath('userData'), 'runtime', 'harness');
}

function syncHarnessToStableLocation(bundledRoot) {
  const stagedRoot = stagedHarnessRoot();
  const bundledBin = resolveDshBin(bundledRoot);
  if (!fs.existsSync(bundledBin)) {
    return null;
  }

  const stagedBin = resolveDshBin(stagedRoot);
  const bundledMeta = readRuntimeVersion(bundledRoot);
  const stagedMeta = readRuntimeVersion(stagedRoot);
  const sameVersion =
    bundledMeta &&
    stagedMeta &&
    bundledMeta.dshVersionResolved === stagedMeta.dshVersionResolved &&
    bundledMeta.syncedAt === stagedMeta.syncedAt;

  if (fs.existsSync(stagedBin) && sameVersion) {
    return { bin: stagedBin, harnessRoot: stagedRoot, source: 'staged-cache' };
  }

  sendSplash({
    phase: 'starting',
    message: '正在准备本地 Runtime（避开临时目录被杀软隔离）…',
  });

  fs.mkdirSync(path.dirname(stagedRoot), { recursive: true });
  fs.rmSync(stagedRoot, { recursive: true, force: true });
  fs.cpSync(bundledRoot, stagedRoot, { recursive: true });

  if (!fs.existsSync(resolveDshBin(stagedRoot))) {
    return { bin: bundledBin, harnessRoot: bundledRoot, source: 'bundled-fallback' };
  }
  return { bin: resolveDshBin(stagedRoot), harnessRoot: stagedRoot, source: 'staged-fresh' };
}

function missingRuntimeMessage(triedRoots) {
  if (!app.isPackaged) {
    return [
      '未找到内置 Harness runtime。',
      `期望路径：${resolveDshBin(triedRoots[0] || resolveBundledHarnessRoot())}`,
      '',
      '开发态请先运行：npm run sync:runtime',
      '或设置 DSH_BIN 指向已安装的 dsh/lib/bin.js',
    ].join('\n');
  }
  return [
    '未找到内置 Harness runtime。',
    '',
    '常见原因：杀毒软件（Windows Defender 等）隔离了安装包或解压后的文件。',
    '',
    '请按下列步骤处理：',
    '1. 到「Windows 安全中心 → 病毒和威胁防护 → 保护历史记录」恢复被隔离项',
    '2. 推荐下载 ZIP 版，解压到短路径（如 C:\\dsh-desktop\\）再运行',
    '3. 把解压目录加入 Defender「排除项」后再启动',
    '4. 不要只运行 Temp 里的 Portable 临时目录',
    '',
    `已检查：${triedRoots.map((r) => resolveDshBin(r)).join('\n         ')}`,
    '',
    '下载页：https://github.com/xyiqq/cursor-cloud/releases',
  ].join('\n');
}

/**
 * Prefer bundled harness; stage away from %TEMP% when packaged.
 * ELECTRON_DEV may use DSH_BIN override.
 */
function locateDshEntry() {
  const envBin = process.env.DSH_BIN;
  if (envBin && fs.existsSync(envBin)) {
    return {
      bin: envBin,
      harnessRoot: path.dirname(path.dirname(path.dirname(envBin))),
      source: 'env',
      tried: [],
    };
  }

  const bundledRoot = resolveBundledHarnessRoot();
  const stagedRoot = stagedHarnessRoot();
  const tried = [bundledRoot, stagedRoot];

  if (app.isPackaged) {
    // Prefer existing healthy stage even if current extract was stripped by AV
    if (fs.existsSync(resolveDshBin(stagedRoot)) && !fs.existsSync(resolveDshBin(bundledRoot))) {
      return {
        bin: resolveDshBin(stagedRoot),
        harnessRoot: stagedRoot,
        source: 'staged-orphan',
        tried,
      };
    }
    if (fs.existsSync(resolveDshBin(bundledRoot))) {
      const synced = syncHarnessToStableLocation(bundledRoot);
      if (synced?.bin) {
        return { ...synced, tried };
      }
    }
    if (fs.existsSync(resolveDshBin(stagedRoot))) {
      return {
        bin: resolveDshBin(stagedRoot),
        harnessRoot: stagedRoot,
        source: 'staged-reuse',
        tried,
      };
    }
    return { bin: null, harnessRoot: bundledRoot, tried };
  }

  const bin = resolveDshBin(bundledRoot);
  if (fs.existsSync(bin)) {
    return { bin, harnessRoot: bundledRoot, source: 'dev-bundled', tried };
  }
  return { bin: null, harnessRoot: bundledRoot, tried };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('无法分配空闲端口'));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

function waitForHttpOk(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (shuttingDown) {
        reject(new Error('应用正在退出'));
        return;
      }
      const req = http.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(res.statusCode);
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`等待 Harness UI 就绪超时（${timeoutMs}ms）：${url}`));
        return;
      }
      setTimeout(attempt, READY_POLL_MS);
    };
    attempt();
  });
}

function hasApiKey(dshHome) {
  if (process.env.DEEPSEEK_API_KEY && String(process.env.DEEPSEEK_API_KEY).trim()) {
    return true;
  }
  const credPath = path.join(dshHome, '.credentials.yaml');
  if (!fs.existsSync(credPath)) return false;
  try {
    const text = fs.readFileSync(credPath, 'utf8');
    return /DEEPSEEK_API_KEY\s*:\s*\S+/.test(text);
  } catch {
    return false;
  }
}

function killDshTree() {
  if (!dshProcess || dshProcess.killed) {
    dshProcess = null;
    return;
  }
  const child = dshProcess;
  dshProcess = null;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }, 2000).unref?.();
    }
  } catch (err) {
    console.warn('[main] kill dsh failed', err);
  }
}

function spawnDsh({ bin, port, dshHome, workspace }) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: dshHome,
    // Avoid Electron-specific vars confusing child tooling
    ELECTRON_NO_ATTACH_CONSOLE: '1',
  };
  delete env.ELECTRON_DEV;

  // cordis-plugin-hmr / loader.internal 需要 --expose-internals。
  // 官方 Node 上 HMR 失败可能被吞掉；Electron RUN_AS_NODE 下会直接退出。
  const args = [
    '--expose-internals',
    bin,
    'web',
    '--host',
    HOST,
    '--port',
    String(port),
  ];
  console.log('[main] spawn dsh', process.execPath, args.join(' '));
  console.log('[main] DSH_HOME=', dshHome, 'cwd=', workspace);

  const child = spawn(process.execPath, args, {
    cwd: workspace,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  dshProcess = child;

  const prefix = `[dsh:${child.pid}]`;
  child.stdout?.on('data', (buf) => {
    process.stdout.write(`${prefix} ${buf}`);
  });
  child.stderr?.on('data', (buf) => {
    process.stderr.write(`${prefix} ${buf}`);
  });
  child.on('exit', (code, signal) => {
    console.log(`[main] dsh exited code=${code} signal=${signal}`);
    if (dshProcess === child) dshProcess = null;
    if (!shuttingDown && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'DeepSeek Harness 已退出',
        `内置 dsh 进程意外退出（code=${code}, signal=${signal}）。请重启应用。`,
      );
    }
  });
  return child;
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 280,
    frame: false,
    resizable: false,
    show: true,
    center: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
  return splashWindow;
}

function sendSplash(payload) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:status', payload);
  }
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'DeepSeek Harness',
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Only allow navigation to loopback harness / splash file
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      const u = new URL(target);
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
        return { action: 'allow' };
      }
    } catch {
      /* ignore */
    }
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.loadURL(url);
  return mainWindow;
}

function buildMenu() {
  const template = [
    {
      label: 'DeepSeek Harness',
      submenu: [
        {
          label: '检查更新',
          click: async () => {
            if (!updaterApi) return;
            const result = await updaterApi.check();
            if (result.reason === 'dev-mode') {
              dialog.showMessageBox({
                type: 'info',
                title: '检查更新',
                message: '开发模式未启用 OTA。打包后的安装版才会检查 GitHub Releases。',
              });
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '配置 API Key',
          click: () => {
            const { dshHome } = userDataPaths();
            dialog.showMessageBox({
              type: 'info',
              title: '配置 API Key',
              message: '请在 Harness 设置页写入密钥，或使用环境变量 / 凭据文件。',
              detail: [
                '1. 打开应用内 Models / 设置，填写 DEEPSEEK_API_KEY',
                '2. 或设置环境变量 DEEPSEEK_API_KEY',
                `3. 或编辑 ${path.join(dshHome, '.credentials.yaml')}`,
                '   示例：',
                '   DEEPSEEK_API_KEY: sk-...',
                '',
                '桌面版默认 DSH_HOME 位于应用 userData，与 ~/.dsh 不同。',
              ].join('\n'),
            });
          },
        },
        {
          label: '打开 DSH_HOME 目录',
          click: () => {
            const { dshHome } = userDataPaths();
            shell.openPath(dshHome);
          },
        },
        {
          label: '上游项目',
          click: () => shell.openExternal('https://github.com/deepseek-ai/deepseek-harness'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.handle('app:get-status', () => {
    const { dshHome, workspace } = userDataPaths();
    return {
      isDev,
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      port: harnessPort,
      dshHome,
      workspace,
      hasApiKey: hasApiKey(dshHome),
    };
  });

  ipcMain.handle('app:open-settings-hint', async () => {
    const { dshHome } = userDataPaths();
    await dialog.showMessageBox({
      type: 'info',
      title: '首次引导',
      message: '尚未检测到 DeepSeek API Key',
      detail: [
        '请在加载完成后打开 Harness 的 Models / 设置页面填写密钥。',
        `也可编辑：${path.join(dshHome, '.credentials.yaml')}`,
      ].join('\n'),
    });
    return { ok: true };
  });

  ipcMain.handle('update:check', async () => {
    if (!updaterApi) return { ok: false, reason: 'not-ready' };
    return updaterApi.check();
  });

  ipcMain.handle('update:install', async () => {
    if (!updaterApi) return { ok: false, reason: 'not-ready' };
    return updaterApi.install();
  });
}

async function bootstrap() {
  ensureDirs();
  buildMenu();
  registerIpc();
  updaterApi = initUpdater(app);
  createSplash();
  sendSplash({ phase: 'starting', message: '正在启动 DeepSeek Harness…' });

  const located = locateDshEntry();
  if (!located.bin) {
    const message = missingRuntimeMessage(located.tried || [located.harnessRoot]);
    sendSplash({ phase: 'error', message });
    await dialog.showErrorBox('缺少 Runtime', message);
    app.quit();
    return;
  }
  console.log('[main] runtime source=', located.source, 'root=', located.harnessRoot);

  const { dshHome, workspace } = ensureDirs();
  let port;
  try {
    port = await getFreePort();
  } catch (err) {
    const message = `无法获取空闲端口：${err.message || err}`;
    sendSplash({ phase: 'error', message });
    await dialog.showErrorBox('启动失败', message);
    app.quit();
    return;
  }
  harnessPort = port;

  sendSplash({ phase: 'spawning', message: `正在拉起 dsh web（端口 ${port}）…` });
  const child = spawnDsh({
    bin: located.bin,
    port,
    dshHome,
    workspace,
  });

  const url = `http://${HOST}:${port}/`;
  try {
    // Fail fast if process dies before ready
    await Promise.race([
      waitForHttpOk(url, READY_TIMEOUT_MS),
      new Promise((_, reject) => {
        child.once('exit', (code, signal) => {
          reject(
            new Error(
              `dsh 在就绪前退出（code=${code}, signal=${signal}）。请确认 Electron/Node 版本 ≥24.18（需 node:zlib zstd）。`,
            ),
          );
        });
      }),
    ]);
  } catch (err) {
    const message = String(err.message || err);
    sendSplash({ phase: 'error', message });
    killDshTree();
    await dialog.showErrorBox('启动失败', message);
    app.quit();
    return;
  }

  sendSplash({ phase: 'ready', message: '即将打开界面…' });
  createMainWindow(url);

  if (!hasApiKey(dshHome)) {
    setTimeout(() => {
      dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: '欢迎使用 DeepSeek Harness',
        message: '尚未检测到 API Key',
        detail:
          '打开应用内 Models / 设置页即可写入密钥。密钥不会写入本仓库或安装包。',
        buttons: ['知道了'],
      });
    }, 1200);
  }
}

app.whenReady().then(() => {
  if (!gotLock) return;
  bootstrap().catch(async (err) => {
    console.error(err);
    await dialog.showErrorBox('启动失败', String(err?.stack || err));
    app.quit();
  });
});

app.on('before-quit', () => {
  shuttingDown = true;
  killDshTree();
});

app.on('window-all-closed', () => {
  shuttingDown = true;
  killDshTree();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && gotLock) {
    bootstrap().catch(console.error);
  }
});

process.on('exit', () => {
  killDshTree();
});
