/**
 * dsh-plugin-liang-calibrator — host half.
 *
 * Serves portrait keyframes under `/liang-assets/` and registers a settings
 * namespace so the desktop Settings sidebar can enable/disable the calibrator.
 * UI lives in `./client` (see package.json `dsh.client`).
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import z from "@deepseek-ai/schemastery";

/** Stable Cordis plugin name. */
const name = "liang-calibrator";
/** Services required before the asset route / settings can be mounted. */
const inject = ["webServer", "settings"];

const SETTINGS_NS = "dsh-liang-calibrator";
const LIANG_STATE_FILE = "desktop-liang-calibrator.json";

const configSchema = z.object({
  enabled: z.boolean().default(true),
});

const MIME = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

/** The asset root this file owns: `<package>/lib/assets`. */
const assetsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "assets");

function dshHomeDir() {
  return process.env.DSH_HOME || join(os.homedir(), ".dsh");
}

function writeLiangState(cfg) {
  const home = dshHomeDir();
  fs.mkdirSync(home, { recursive: true });
  const file = join(home, LIANG_STATE_FILE);
  const payload = {
    enabled: cfg?.enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

/**
 * Mount the asset route and settings namespace.
 * @param ctx - host plugin context
 * @param config - cordis insert config (seeds settings defaults)
 */
function apply(ctx, config = {}) {
  const settings = ctx.settings;
  if (settings) {
    try {
      settings.register(SETTINGS_NS, configSchema);
    } catch (err) {
      console.error("[liang-calibrator] settings register failed:", err);
    }
  }

  function currentConfig() {
    if (settings) {
      try {
        const value = settings.get(SETTINGS_NS);
        if (value !== undefined) return value;
      } catch {
        /* ignore */
      }
    }
    return { enabled: config.enabled !== false };
  }

  let cfg = currentConfig();
  try {
    writeLiangState(cfg);
  } catch (err) {
    console.warn("[liang-calibrator] write state failed:", err?.message || err);
  }

  if (settings) {
    ctx.on("settings/updated", (ns) => {
      if (ns !== SETTINGS_NS) return;
      cfg = currentConfig();
      try {
        writeLiangState(cfg);
      } catch (err) {
        console.warn("[liang-calibrator] write state failed:", err?.message || err);
      }
    });
  }

  ctx.webServer.register({
    kind: "prefix",
    path: "/liang-assets",
    handler: async (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      /* v8 ignore next -- node:http always sets url on server requests. */
      const rawUrl = req.url ?? "/";
      if (rawUrl.includes("..")) {
        res.writeHead(403);
        res.end();
        return;
      }
      const rawPath = decodeURIComponent(new URL(rawUrl, "http://x").pathname);
      const rel = rawPath.slice("/liang-assets".length).replace(/^\/+/, "");
      const target = resolve(normalize(join(assetsRoot, rel)));
      if (target !== assetsRoot && !target.startsWith(assetsRoot + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const body = await readFile(target);
        res.writeHead(200, {
          "content-type": MIME[extname(target)] ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  });
}

export { apply, inject, name, SETTINGS_NS, configSchema };
