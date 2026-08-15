'use strict';

/**
 * Portable ZIP OTA for DeepSeek Harness Desktop.
 *
 * electron-updater works best with NSIS; our primary artifact is a Windows ZIP.
 * This module checks GitHub Releases, downloads the newer ZIP, stages it, then
 * applies on quit via a helper script (Windows) or prompts the user (other OS).
 */

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const https = require('node:https');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { dialog, BrowserWindow, app: electronApp } = require('electron');
const { cmpVersion, parseVersion, pickZipAsset } = require('./update-utils');

const OWNER = () => process.env.GH_PUBLISH_OWNER || process.env.DSH_DESKTOP_GH_OWNER || 'xyiqq';
const REPO = () => process.env.GH_PUBLISH_REPO || process.env.DSH_DESKTOP_GH_REPO || 'cursor-cloud';

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DeepSeek-Harness-Desktop-OTA',
          ...headers,
        },
        timeout: 30_000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          httpGetJson(res.headers.location, headers).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
  });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const follow = (current, redirectsLeft) => {
      const lib = current.startsWith('https') ? https : http;
      const req = lib.get(
        current,
        {
          headers: { 'User-Agent': 'DeepSeek-Harness-Desktop-OTA', Accept: '*/*' },
          timeout: 120_000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new Error('too many redirects'));
              return;
            }
            follow(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`download HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          const total = Number(res.headers['content-length'] || 0);
          let received = 0;
          const out = fs.createWriteStream(dest);
          res.on('data', (chunk) => {
            received += chunk.length;
            if (onProgress && total) {
              onProgress({
                percent: (received / total) * 100,
                transferred: received,
                total,
              });
            }
          });
          res.pipe(out);
          out.on('finish', () => out.close(() => resolve(dest)));
          out.on('error', reject);
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('download timeout'));
      });
    };
    follow(url, 8);
  });
}

async function extractZip(zipPath, destDir) {
  await fsp.rm(destDir, { recursive: true, force: true });
  await fsp.mkdir(destDir, { recursive: true });
  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      const ps = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ],
        { windowsHide: true, stdio: 'ignore' },
      );
      ps.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Expand-Archive exit ${code}`))));
      ps.on('error', reject);
    });
    return;
  }
  await new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'ignore' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))));
    child.on('error', reject);
  });
}

function findStagedAppRoot(extractRoot) {
  const entries = fs.readdirSync(extractRoot, { withFileTypes: true });
  const exeName = 'DeepSeek Harness.exe';
  if (fs.existsSync(path.join(extractRoot, exeName))) return extractRoot;
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const candidate = path.join(extractRoot, ent.name);
    if (fs.existsSync(path.join(candidate, exeName)) || fs.existsSync(path.join(candidate, 'DeepSeek Harness'))) {
      return candidate;
    }
  }
  return extractRoot;
}

function writeWindowsApplyScript({ installDir, stagedDir, exePath, logPath }) {
  const scriptPath = path.join(path.dirname(stagedDir), 'apply-update.cmd');
  const content = `@echo off
setlocal
set INSTALL=${installDir}
set STAGED=${stagedDir}
set EXE=${exePath}
set LOG=${logPath}
echo [%date% %time%] applying update >> "%LOG%"
timeout /t 2 /nobreak >nul
robocopy "%STAGED%" "%INSTALL%" /E /IS /IT /R:2 /W:1 >> "%LOG%" 2>&1
set RC=%ERRORLEVEL%
echo robocopy_rc=%RC% >> "%LOG%"
start "" "%EXE%"
exit /b 0
`;
  fs.writeFileSync(scriptPath, content, 'utf8');
  return scriptPath;
}

/**
 * @param {import('electron').App} app
 * @param {{ logger?: Console }} [opts]
 */
function initUpdater(app, opts = {}) {
  const log = opts.logger || console;
  /** @type {{ version: string, stagedDir: string, zipPath: string } | null} */
  let pending = null;
  let checking = false;

  if (!app.isPackaged) {
    log.info('[updater] unpackaged — OTA disabled');
    return {
      check: async () => ({ ok: false, reason: 'dev-mode' }),
      install: async () => ({ ok: false, reason: 'dev-mode' }),
      getPending: () => null,
    };
  }

  const updatesRoot = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(updatesRoot, { recursive: true });

  async function check({ download = true } = {}) {
    if (checking) return { ok: false, reason: 'busy' };
    checking = true;
    broadcast('update:status', { state: 'checking' });
    try {
      const release = await httpGetJson(
        `https://api.github.com/repos/${OWNER()}/${REPO()}/releases/latest`,
      );
      const remoteVersion = String(release.tag_name || release.name || '').replace(/^v/i, '');
      const localVersion = app.getVersion();
      if (!remoteVersion || cmpVersion(localVersion, remoteVersion) >= 0) {
        broadcast('update:status', { state: 'not-available', info: { version: localVersion } });
        return { ok: true, update: false, localVersion, remoteVersion };
      }
      const asset = pickZipAsset(release);
      if (!asset?.browser_download_url) {
        throw new Error('最新 Release 未找到 win-x64 ZIP 资源');
      }
      broadcast('update:status', {
        state: 'available',
        info: { version: remoteVersion, name: asset.name },
      });
      if (!download) {
        return { ok: true, update: true, localVersion, remoteVersion, asset };
      }

      const zipPath = path.join(updatesRoot, asset.name);
      await downloadFile(asset.browser_download_url, zipPath, (progress) => {
        broadcast('update:status', { state: 'downloading', progress, info: { version: remoteVersion } });
      });
      const extractDir = path.join(updatesRoot, `extract-${remoteVersion}`);
      await extractZip(zipPath, extractDir);
      const stagedDir = findStagedAppRoot(extractDir);
      pending = { version: remoteVersion, stagedDir, zipPath };
      broadcast('update:status', { state: 'downloaded', info: { version: remoteVersion } });

      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showMessageBox(win || undefined, {
        type: 'info',
        title: '更新已就绪',
        message: `发现新版本 ${remoteVersion}（当前 ${localVersion}）`,
        detail: '点击「立即重启安装」将覆盖当前安装目录中的文件并重新启动。ZIP 分发暂不支持增量差量包，需下载完整安装包，但之后无需手动去网页下载。',
        buttons: ['立即重启安装', '稍后'],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) {
        await installPending();
      }
      return { ok: true, update: true, localVersion, remoteVersion, downloaded: true };
    } catch (err) {
      log.error('[updater] check failed', err);
      broadcast('update:status', { state: 'error', message: String(err?.message || err) });
      return { ok: false, error: String(err?.message || err) };
    } finally {
      checking = false;
    }
  }

  async function installPending() {
    if (!pending) return { ok: false, reason: 'no-pending' };
    const installDir = path.dirname(process.execPath);
    const logPath = path.join(updatesRoot, 'apply.log');
    if (process.platform === 'win32') {
      const script = writeWindowsApplyScript({
        installDir,
        stagedDir: pending.stagedDir,
        exePath: process.execPath,
        logPath,
      });
      const child = spawn('cmd.exe', ['/c', script], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      setTimeout(() => {
        electronApp.quit();
      }, 300);
      return { ok: true };
    }
    await dialog.showMessageBox({
      type: 'info',
      message: `更新已下载到：${pending.stagedDir}`,
      detail: '请手动用新版本替换当前安装目录后重启。',
    });
    return { ok: true, manual: true, stagedDir: pending.stagedDir };
  }

  setTimeout(() => {
    check({ download: true }).catch((err) => log.warn('[updater] initial check failed', err));
  }, 8000);

  return {
    check: async () => check({ download: true }),
    install: async () => installPending(),
    getPending: () => pending,
  };
}

module.exports = { initUpdater };
