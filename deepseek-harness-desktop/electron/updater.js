'use strict';

/**
 * OTA wrapper around electron-updater.
 * No-op when unpackaged (dev). Packaged builds check GitHub Releases.
 */

const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');

let initialized = false;

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function configurePublisherFromEnv() {
  const owner = process.env.GH_PUBLISH_OWNER || process.env.DSH_DESKTOP_GH_OWNER;
  const repo = process.env.GH_PUBLISH_REPO || process.env.DSH_DESKTOP_GH_REPO;
  if (owner && repo) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner,
      repo,
    });
  }
}

/**
 * @param {import('electron').App} app
 * @param {{ logger?: Console }} [opts]
 */
function initUpdater(app, opts = {}) {
  const log = opts.logger || console;
  if (!app.isPackaged) {
    log.info('[updater] unpackaged — OTA disabled');
    return {
      check: async () => ({ ok: false, reason: 'dev-mode' }),
      install: async () => ({ ok: false, reason: 'dev-mode' }),
    };
  }

  if (initialized) {
    return api();
  }
  initialized = true;

  configurePublisherFromEnv();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking…');
    broadcast('update:status', { state: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    log.info('[updater] available', info?.version);
    broadcast('update:status', { state: 'available', info });
  });
  autoUpdater.on('update-not-available', (info) => {
    log.info('[updater] up to date', info?.version);
    broadcast('update:status', { state: 'not-available', info });
  });
  autoUpdater.on('download-progress', (progress) => {
    broadcast('update:status', { state: 'downloading', progress });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[updater] downloaded', info?.version);
    broadcast('update:status', { state: 'downloaded', info });
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showMessageBox(win || undefined, {
      type: 'info',
      title: '更新已就绪',
      message: `DeepSeek Harness ${info?.version || ''} 已下载完成。`,
      detail: '重启后将安装更新。未签名安装包可能触发 Windows SmartScreen 提示。',
      buttons: ['立即重启安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
  autoUpdater.on('error', (err) => {
    log.error('[updater] error', err);
    broadcast('update:status', { state: 'error', message: String(err?.message || err) });
  });

  // Kick off a quiet check shortly after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => log.warn('[updater] initial check failed', err));
  }, 5000);

  function api() {
    return {
      check: async () => {
        const result = await autoUpdater.checkForUpdates();
        return { ok: true, result: result?.updateInfo || null };
      },
      install: async () => {
        autoUpdater.quitAndInstall(false, true);
        return { ok: true };
      },
    };
  }

  return api();
}

module.exports = { initUpdater };
