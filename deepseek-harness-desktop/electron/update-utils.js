'use strict';

function parseVersion(tagOrVersion) {
  const m = String(tagOrVersion || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare two semver-ish versions.
 * @returns {-1|0|1|null} null when either side cannot be parsed
 */
function cmpVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
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

/**
 * Among GitHub release objects, pick the highest non-draft version that has a ZIP.
 * Prefers non-prerelease when versions tie or when comparing across channels.
 * @param {Array<object>} releases
 * @param {{ platform?: NodeJS.Platform, arch?: string, allowPrerelease?: boolean }} [opts]
 */
function pickNewestRelease(releases, opts = {}) {
  const allowPrerelease = opts.allowPrerelease === true;
  const list = Array.isArray(releases) ? releases : [];
  let best = null;
  let bestVer = null;
  for (const release of list) {
    if (!release || release.draft) continue;
    if (release.prerelease && !allowPrerelease) continue;
    const ver = String(release.tag_name || release.name || '').replace(/^v/i, '');
    if (!parseVersion(ver)) continue;
    if (!pickZipAsset(release, opts)) continue;
    if (!best || cmpVersion(bestVer, ver) === -1) {
      best = release;
      bestVer = ver;
    }
  }
  return best;
}

module.exports = { parseVersion, cmpVersion, pickZipAsset, pickNewestRelease };
