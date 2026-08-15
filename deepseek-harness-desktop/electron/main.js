'use strict';

/**
 * Electron shell for DeepSeek Harness — packaging/runtime pattern aligned with
 * https://github.com/ningbainb/deepseek-harness-desktop
 * (ELECTRON_RUN_AS_NODE + asarUnpack node_modules + materialize asar paths).
 */

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
const { spawn } = require('node:child_process');
const os = require('node:os');
const { initUpdater } = require('./updater');
const {
  ensureDesktopProfile,
  materializeFilesystemPath,
  resolveDshCliPath,
} = require('./profile');

app.setName('DeepSeek Harness');

const isDev = process.env.ELECTRON_DEV === '1' || !app.isPackaged;
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 400;
const READY_LINE = /^dsh web:\s+(http:\/\/\S+)/u;

/** @type {import('node:child_process').ChildProcess | null} */
let dshProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
let shuttingDown = false;
/** @type {ReturnType<typeof initUpdater> | null} */
let updaterApi = null;
let dshLog = '';

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
    // Match reference: default DSH home under the real user profile.
    dshHome: process.env.DSH_HOME || path.join(app.getPath('home'), '.dsh'),
    // Packaged: use real home as cwd (same as ningbainb reference).
    workspace: app.isPackaged
      ? app.getPath('home')
      : path.join(userData, 'workspace'),
    logs: path.join(userData, 'logs'),
  };
}

function ensureDirs() {
  const { dshHome, workspace, logs } = userDataPaths();
  fs.mkdirSync(dshHome, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(logs, { recursive: true });
  return { dshHome, workspace, logs };
}

function resolveDshBin() {
  if (process.env.DSH_BIN && fs.existsSync(process.env.DSH_BIN)) {
    return process.env.DSH_BIN;
  }
  try {
    const bin = resolveDshCliPath();
    const physical = materializeFilesystemPath(bin);
    if (fs.existsSync(physical)) return physical;
    if (fs.existsSync(bin)) return bin;
  } catch (err) {
    console.warn('[main] resolveDshCliPath failed', err?.message || err);
  }
  return null;
}

function appendLog(chunk) {
  const text = String(chunk);
  dshLog = `${dshLog}${text}`.slice(-12_000);
  try {
    const { logs } = userDataPaths();
    fs.appendFileSync(path.join(logs, 'dsh.log'), text);
  } catch {
    /* ignore */
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

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`等待 Harness UI 就绪超时（${READY_TIMEOUT_MS}ms）`)));
    }, READY_TIMEOUT_MS);

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const onData = (buf) => {
      const text = buf.toString();
      appendLog(text);
      process.stdout.write(`[dsh] ${text}`);
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const match = READY_LINE.exec(line.trim());
        if (!match) continue;
        const url = match[1].endsWith('/') ? match[1] : `${match[1]}/`;
        probeHttp(url)
          .then(() => finish(() => resolve(url)))
          .catch((err) => finish(() => reject(err)));
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', (code, signal) => {
      finish(() => {
        const tail = dshLog.trim().split(/\r?\n/).slice(-25).join('\n');
        reject(
          new Error(
            [
              `dsh 在就绪前退出（code=${code}, signal=${signal}）。`,
              tail ? `\n--- dsh 日志 ---\n${tail}` : '',
              `\n日志文件：${path.join(userDataPaths().logs, 'dsh.log')}`,
            ].join('\n'),
          ),
        );
      });
    });
  });
}

function probeHttp(url) {
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
      if (Date.now() - started > 20_000) {
        reject(new Error(`HTTP 探测失败：${url}`));
        return;
      }
      setTimeout(attempt, READY_POLL_MS);
    };
    attempt();
  });
}

function spawnDsh({ bin, dshHome, workspace }) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: dshHome,
  };
  delete env.ELECTRON_DEV;

  // Match reference: ELECTRON_RUN_AS_NODE + --profile desktop + --port 0
  const args = [
    '--expose-internals',
    bin,
    '--profile',
    'desktop',
    '--host',
    HOST,
    '--port',
    '0',
  ];
  console.log('[main] spawn', process.execPath, args.join(' '));
  console.log('[main] DSH_HOME=', dshHome, 'cwd=', workspace, 'bin=', bin);

  const child = spawn(process.execPath, args, {
    cwd: workspace || os.homedir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  });
  dshProcess = child;
  child.on('exit', (code, signal) => {
    console.log(`[main] dsh exited code=${code} signal=${signal}`);
    if (dshProcess === child) dshProcess = null;
    if (!shuttingDown && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'DeepSeek Harness 已退出',
        `内置 dsh 进程退出（code=${code}, signal=${signal}）。请重启应用。`,
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
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
}

function openShowroomPage(page) {
  let port = 18765;
  try {
    const marker = path.join(userDataPaths().dshHome, 'showroom-hub.json');
    if (fs.existsSync(marker)) {
      const info = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (info.port) port = Number(info.port) || port;
    }
  } catch {
    /* default */
  }
  shell.openExternal(`http://127.0.0.1:${port}/${page}`);
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
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
                  message: '开发模式未启用 OTA。',
                });
              }
            },
          },
          { type: 'separator' },
          { role: 'quit', label: '退出' },
        ],
      },
      {
        label: '展厅',
        submenu: [
          {
            label: '打开孪生墙',
            click: () => openShowroomPage('twin.html'),
          },
          {
            label: '打开 Show Mode 控制台',
            click: () => openShowroomPage('panel.html'),
          },
          {
            label: '打开工具可视化',
            click: () => openShowroomPage('viz.html'),
          },
          {
            label: '打开观众许愿页',
            click: () => openShowroomPage('wish.html'),
          },
        ],
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
        ],
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '打开日志目录',
            click: () => shell.openPath(userDataPaths().logs),
          },
          {
            label: '打开 DSH_HOME',
            click: () => shell.openPath(userDataPaths().dshHome),
          },
          {
            label: '下载页',
            click: () =>
              shell.openExternal('https://github.com/xyiqq/cursor-cloud/releases'),
          },
        ],
      },
    ]),
  );
}

function registerIpc() {
  ipcMain.handle('app:get-status', () => {
    const { dshHome, workspace, logs } = userDataPaths();
    return {
      isDev,
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      dshHome,
      workspace,
      logs,
    };
  });
  ipcMain.handle('update:check', async () => updaterApi?.check() || { ok: false });
  ipcMain.handle('update:install', async () => updaterApi?.install() || { ok: false });
}

async function bootstrap() {
  const { dshHome, workspace } = ensureDirs();
  buildMenu();
  registerIpc();
  updaterApi = initUpdater(app);
  createSplash();
  sendSplash({ phase: 'starting', message: '正在启动 DeepSeek Harness…' });
  await new Promise((r) => setTimeout(r, 50));

  const bin = resolveDshBin();
  if (!bin) {
    const message = [
      '未找到 @deepseek-ai/dsh runtime。',
      '请重新安装/解压最新 ZIP：',
      'https://github.com/xyiqq/cursor-cloud/releases',
    ].join('\n');
    sendSplash({ phase: 'error', message });
    await dialog.showErrorBox('缺少 Runtime', message);
    app.quit();
    return;
  }

  sendSplash({ phase: 'profile', message: '正在准备 desktop profile（图片理解 / Home Assistant）…' });
  try {
    const profile = await ensureDesktopProfile({ dshHome });
    console.log(
      '[main] profile ready',
      profile.profileDir,
      'plugins=',
      Object.keys(profile.plugins || {}),
      'mcp=',
      profile.mcpEnabled,
    );
  } catch (err) {
    const message = `准备 desktop profile 失败：${err?.message || err}`;
    sendSplash({ phase: 'error', message });
    await dialog.showErrorBox('启动失败', message);
    app.quit();
    return;
  }

  sendSplash({ phase: 'spawning', message: '正在拉起官方 dsh（desktop profile）…' });
  const child = spawnDsh({ bin, dshHome, workspace });

  let url;
  try {
    url = await waitForReady(child);
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

process.on('exit', () => killDshTree());
