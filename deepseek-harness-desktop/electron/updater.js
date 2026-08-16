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
const { cmpVersion, pickZipAsset, pickNewestRelease, tagFromLatestLocation, buildDesktopRelease } = require('./update-utils');

const OWNER = () => process.env.GH_PUBLISH_OWNER || process.env.DSH_DESKTOP_GH_OWNER || 'xyiqq';
const REPO = () => process.env.GH_PUBLISH_REPO || process.env.DSH_DESKTOP_GH_REPO || 'cursor-cloud';
const RELEASES_PAGE = () => `https://github.com/${OWNER()}/${REPO()}/releases`;

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
          'X-GitHub-Api-Version': '2022-11-28',
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

/**
 * Resolve latest release tag via github.com HTML redirect — avoids api.github.com
 * rate limits (common on shared / cloud egress IPs).
 */
function resolveLatestTagFromWeb() {
  const url = `https://github.com/${OWNER()}/${REPO()}/releases/latest`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'DeepSeek-Harness-Desktop-OTA',
        },
        timeout: 30_000,
      },
      (res) => {
        res.resume();
        const loc = res.headers.location || '';
        const fromLoc = tagFromLatestLocation(loc);
        if (fromLoc) {
          resolve(fromLoc);
          return;
        }
        // Some environments follow redirects internally; fall back to final URL if present.
        const tag = tagFromLatestLocation(res.responseUrl || url);
        if (tag) {
          resolve(tag);
          return;
        }
        reject(
          new Error(
            `无法从 GitHub 网页解析最新版本（HTTP ${res.statusCode || '?'}）。可手动打开 ${RELEASES_PAGE()}`,
          ),
        );
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
  });
}

async function fetchNewestReleaseFromWeb() {
  const tag = await resolveLatestTagFromWeb();
  const release = buildDesktopRelease(tag, { owner: OWNER(), repo: REPO() });
  if (!release || !pickZipAsset(release)) {
    throw new Error(`无法构造 ${tag} 的桌面 ZIP 下载地址`);
  }
  return release;
}

async function fetchNewestReleaseFromApi() {
  const base = `https://api.github.com/repos/${OWNER()}/${REPO()}`;
  try {
    const latest = await httpGetJson(`${base}/releases/latest`);
    if (latest && !latest.draft && pickZipAsset(latest)) return latest;
  } catch (err) {
    console.warn('[updater] api releases/latest failed:', err?.message || err);
  }
  const list = await httpGetJson(`${base}/releases?per_page=20`);
  const picked = pickNewestRelease(list);
  if (!picked) throw new Error('GitHub Releases 中未找到可用的桌面 ZIP');
  return picked;
}

async function fetchNewestRelease() {
  // Prefer github.com redirect — no API quota. Fall back to API when needed.
  try {
    return await fetchNewestReleaseFromWeb();
  } catch (webErr) {
    console.warn('[updater] web latest failed, trying API:', webErr?.message || webErr);
    try {
      return await fetchNewestReleaseFromApi();
    } catch (apiErr) {
      const webMsg = String(webErr?.message || webErr);
      const apiMsg = String(apiErr?.message || apiErr);
      const rateLimited = /rate limit|HTTP 403/i.test(apiMsg);
      throw new Error(
        rateLimited
          ? `GitHub API 限流，且网页探测失败。请稍后重试或手动下载：\n${RELEASES_PAGE()}\n\n网页：${webMsg}\nAPI：${apiMsg}`
          : `检查更新失败。\n网页：${webMsg}\nAPI：${apiMsg}\n\n可手动下载：${RELEASES_PAGE()}`,
      );
    }
  }
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
  const macApp = 'DeepSeek Harness.app';
  if (fs.existsSync(path.join(extractRoot, exeName))) return extractRoot;
  if (fs.existsSync(path.join(extractRoot, macApp))) return path.join(extractRoot, macApp);
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const candidate = path.join(extractRoot, ent.name);
    if (fs.existsSync(path.join(candidate, exeName))) return candidate;
    if (fs.existsSync(path.join(candidate, macApp))) return path.join(candidate, macApp);
    if (ent.name.endsWith('.app')) return candidate;
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

function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
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

  async function check({ download = true, interactive = true } = {}) {
    if (checking) return { ok: false, reason: 'busy' };
    checking = true;
    broadcast('update:status', { state: 'checking' });
    try {
      const release = await fetchNewestRelease();
      const remoteVersion = String(release.tag_name || release.name || '').replace(/^v/i, '');
      const localVersion = app.getVersion();
      const cmp = cmpVersion(localVersion, remoteVersion);
      if (!remoteVersion || cmp === null) {
        throw new Error(`无法解析版本号（本地 ${localVersion} / 远程 ${remoteVersion || '未知'}）`);
      }
      if (cmp >= 0) {
        broadcast('update:status', { state: 'not-available', info: { version: localVersion } });
        return { ok: true, update: false, localVersion, remoteVersion };
      }
      const asset = pickZipAsset(release);
      if (!asset?.browser_download_url) {
        throw new Error('最新 Release 未找到当前平台的 ZIP 资源');
      }
      broadcast('update:status', {
        state: 'available',
        info: { version: remoteVersion, name: asset.name },
      });
      if (!download) {
        return { ok: true, update: true, localVersion, remoteVersion, asset };
      }

      if (interactive) {
        const win = BrowserWindow.getFocusedWindow();
        const sizeHint = asset.size ? `约 ${formatBytes(asset.size)}` : '完整安装包';
        const ask = await dialog.showMessageBox(win || undefined, {
          type: 'info',
          title: '发现新版本',
          message: `发现新版本 ${remoteVersion}（当前 ${localVersion}）`,
          detail: `将下载 ${asset.name}（${sizeHint}）。下载过程可能需要几分钟，请保持网络畅通。\n\n若 GitHub 访问较慢，也可手动打开：\n${RELEASES_PAGE()}`,
          buttons: ['下载并安装', '取消'],
          defaultId: 0,
          cancelId: 1,
        });
        if (ask.response !== 0) {
          return { ok: true, update: true, localVersion, remoteVersion, cancelled: true };
        }
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
        message: `新版本 ${remoteVersion} 已下载完成（当前 ${localVersion}）`,
        detail: '点击「立即重启安装」将覆盖当前安装目录中的文件并重新启动。',
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
      const message = String(err?.message || err);
      broadcast('update:status', { state: 'error', message });
      return { ok: false, error: message, releasesUrl: RELEASES_PAGE() };
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

  // Background check: do not auto-download (avoids silent multi-minute hangs).
  setTimeout(() => {
    check({ download: false, interactive: false })
      .then((result) => {
        if (!result?.ok || !result.update) return;
        const win = BrowserWindow.getFocusedWindow();
        dialog
          .showMessageBox(win || undefined, {
            type: 'info',
            title: '发现新版本',
            message: `发现新版本 ${result.remoteVersion}（当前 ${result.localVersion}）`,
            detail: '可在菜单「DeepSeek Harness → 检查更新」下载安装。',
            buttons: ['立即检查更新', '稍后'],
            defaultId: 0,
            cancelId: 1,
          })
          .then(({ response }) => {
            if (response === 0) void check({ download: true, interactive: true });
          })
          .catch(() => {});
      })
      .catch((err) => log.warn('[updater] initial check failed', err));
  }, 8000);

  return {
    check: async () => check({ download: true, interactive: true }),
    install: async () => installPending(),
    getPending: () => pending,
  };
}

module.exports = { initUpdater };
