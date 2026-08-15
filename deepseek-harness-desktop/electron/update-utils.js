'use strict';

function parseVersion(tagOrVersion) {
  const m = String(tagOrVersion || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Pick the ZIP asset matching the current (or given) platform/arch.
 * @param {{ assets?: Array<{ name: string, browser_download_url?: string }> }} release
 * @param {{ platform?: NodeJS.Platform, arch?: string }} [opts]
 */
function pickZipAsset(release, opts = {}) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const platform = opts.platform || process.platform;
  const arch = opts.arch || process.arch;

  if (platform === 'darwin') {
    const archTag = arch === 'arm64' ? 'arm64' : 'x64';
    const preferred = assets.find((a) =>
      new RegExp(`DeepSeek-Harness-.*-mac-${archTag}\\.zip$`, 'i').test(a.name),
    );
    if (preferred) return preferred;
    return assets.find((a) => /DeepSeek-Harness-.*-mac-(arm64|x64)\.zip$/i.test(a.name));
  }

  if (platform === 'linux') {
    const preferred = assets.find((a) => /DeepSeek-Harness-.*-linux-.*\.(zip|AppImage)$/i.test(a.name));
    if (preferred) return preferred;
  }

  const preferred = assets.find((a) => /DeepSeek-Harness-.*-win-x64\.zip$/i.test(a.name));
  if (preferred) return preferred;
  return assets.find(
    (a) => /DeepSeek.*Harness.*win.*x64.*\.zip$/i.test(a.name) || /win-x64\.zip$/i.test(a.name),
  );
}

module.exports = { parseVersion, cmpVersion, pickZipAsset };
