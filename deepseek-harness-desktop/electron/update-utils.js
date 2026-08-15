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

function pickZipAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const preferred = assets.find((a) => /DeepSeek-Harness-.*-win-x64\.zip$/i.test(a.name));
  if (preferred) return preferred;
  return assets.find(
    (a) => /DeepSeek.*Harness.*win.*x64.*\.zip$/i.test(a.name) || /win-x64\.zip$/i.test(a.name),
  );
}

module.exports = { parseVersion, cmpVersion, pickZipAsset };
