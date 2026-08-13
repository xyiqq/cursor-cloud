# DeepSeek Harness Desktop — Agent Brief

## 目标

把 `@deepseek-ai/dsh` 的 Browser UI（`dsh web`）封装成 Windows「打开即用」Electron 桌面客户端，并支持 GitHub Releases OTA。

## 固定选型

| 项 | 选择 |
|---|---|
| 壳 | Electron（推荐 ≥41，内置 Node ≥24.18，满足 dsh 对 `node:zlib` zstd 的要求） |
| 打包 | electron-builder：`nsis` + `portable` |
| Runtime | `extraResources` → `resources/harness`（勿打进 asar） |
| 启动 | `ELECTRON_RUN_AS_NODE=1` + `process.execPath` 跑 `lib/bin.js web` |
| 绑定 | 仅 `127.0.0.1`；禁止 `0.0.0.0` |
| OTA | electron-updater → GitHub Releases |

## 目录职责

- `electron/` — 主进程、preload、splash、OTA
- `resources/harness/` — 由 `npm run sync:runtime` 生成的完整 dsh 依赖树（勿手改后提交 node_modules）
- `scripts/` — sync / verify
- `docs/` — 调研、打包、OTA、任务总结

## 关键路径

```js
const harnessRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'harness')
  : path.join(__dirname, '..', 'resources', 'harness');
const dshBin = path.join(harnessRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
```

## 环境变量

- `DSH_HOME` → `app.getPath('userData')/dsh-home`
- 工作区 cwd → `app.getPath('userData')/workspace`
- `DEEPSEEK_API_KEY` 或 `$DSH_HOME/.credentials.yaml`
- 开发：`ELECTRON_DEV=1`；可用外部 dsh / 已 sync 的 `resources/harness`

## 验收脚本

```bash
npm run sync:runtime
npm run verify:runtime
npm start          # 开发
npm run dist       # Windows 安装包（需 Windows 或说明交叉限制）
```

## 禁止

- 提交 API Key / `.credentials.yaml` / `.env`
- 修改 upstream deepseek-harness（除非记录 patch）
- 往用户 home 乱装依赖
