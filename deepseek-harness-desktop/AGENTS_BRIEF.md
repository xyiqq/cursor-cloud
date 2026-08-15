# DeepSeek Harness Desktop — Agent Brief

## 目标

把 `@deepseek-ai/dsh` 封装成 Windows「打开即用」Electron 桌面客户端，并支持 GitHub Releases OTA。

运行时模型对齐：https://github.com/ningbainb/deepseek-harness-desktop

## 固定选型（v0.2.0+）

| 项 | 选择 |
|---|---|
| 壳 | Electron 43.4.0 |
| 打包 | electron-builder：Windows `zip`/`portable` + macOS `zip`（arm64/x64）；`asar` + `asarUnpack: node_modules/**` + `plugins/**` |
| Runtime | `@deepseek-ai/dsh` 及 boot 包作为 **app dependencies**（不进 extraResources） |
| 启动 | `ELECTRON_RUN_AS_NODE=1` + `process.execPath --expose-internals lib/bin.js --profile desktop --port 0` |
| Profile | `~/.dsh/profiles/desktop`（`electron/profile.js` 链接官方 bundles） |
| 绑定 | 仅 `127.0.0.1` |
| OTA | electron-updater → GitHub Releases |
| Win 原生 | `scripts/ensure-win-natives.mjs`（Linux CI 用 `npm pack` 注入 koffi/sharp） |
| 目录选择 | `scripts/patch-directory-picker.mjs` → PowerShell FolderBrowserDialog |

## 目录职责

- `electron/` — 主进程、profile、preload、splash、OTA
- `scripts/` — natives / picker patch / verify
- `docs/` — 调研、打包、OTA

## 环境变量

- `DSH_HOME` → 默认 `~/.dsh`
- 工作区 cwd → 打包后为用户 home
- `DEEPSEEK_API_KEY` 或 `$DSH_HOME/.credentials.yaml`
- 开发：`ELECTRON_DEV=1`

## 验收脚本

```bash
npm install
npm run verify:runtime
npm start
npm run dist:zip
```

## 展厅

见 [docs/showroom.md](docs/showroom.md) / [docs/showroom-roadmap.md](docs/showroom-roadmap.md)。

- 插件：`plugins/dsh-showroom`（P0–P2；**ASR 暂缓**）
- Hub 默认 `127.0.0.1:18765`；菜单「展厅」打开页面

## 禁止

- 提交 API Key / `.credentials.yaml` / `.env`
- 修改 upstream deepseek-harness（除非记录 patch）
- 回到 v0.1.x 的 `extraResources/harness` + 独立 `node.exe` 方案
