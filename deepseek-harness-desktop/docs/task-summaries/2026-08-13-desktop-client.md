# 任务总结：DeepSeek Harness 桌面客户端

日期：2026-08-13  
仓库路径：`deepseek-harness-desktop/`  
分支：`cursor/deepseek-harness-desktop-e36f`

## 交付内容

| 项 | 状态 |
|---|---|
| Electron 壳（单实例、splash、子进程生命周期、loopback only） | 完成 |
| `ELECTRON_RUN_AS_NODE` + `--expose-internals` 启动内置 `dsh web` | 完成并冒烟 |
| `sync:runtime` / `verify:runtime` | 完成；Linux 上 verify 通过 |
| OTA（`electron-updater`，开发态 no-op） | 完成 |
| 中文 README + packaging / ota / research 文档 | 完成 |
| Windows NSIS + portable 实机打包 | **未在本 Linux runner 执行**（见限制） |

## 本地验证（Linux 云端）

1. Node **24.18.0** 下 `npm run sync:runtime` → 解析 `@deepseek-ai/dsh@0.1.0-rc.3`，约 530 packages
2. `npm run verify:runtime` 全部通过（含拒绝 `0.0.0.0`）
3. `xvfb-run electron .`：dsh 监听端口，对 `http://127.0.0.1:<port>/` 返回 **HTTP 200**，HTML 标题为 DeepSeek Harness 前端

## 关键实现决策

- Electron **41.10.5**（内置 Node 24.18），避免 dsh 对 `node:zlib` zstd 的要求
- 不捆绑独立 `node.exe`；用 `ELECTRON_RUN_AS_NODE=1`
- 必须传 `--expose-internals`，否则 Electron 下 HMR 导致 dsh 退出
- `DSH_HOME` → `userData/dsh-home`；workspace → `userData/workspace`
- Runtime 经 `extraResources` 放到 `resources/harness`（不进 asar）
- **打包坑**：electron-builder 默认丢掉名为 `node_modules` 的目录；需把 `resources/harness/node_modules` 单独列为 `extraResources.from`（已在 Linux `--dir` 验证 `bin.js` 存在）

## 如何构建

```bash
cd deepseek-harness-desktop
npm install          # 建议 Node ≥22.19 / 24.x
npm run sync:runtime
npm run verify:runtime
npm start            # 开发
npm run dist         # 需 Windows：产出 NSIS + portable + latest.yml
```

产物路径：`deepseek-harness-desktop/dist/`

## 如何测 OTA

见 `docs/ota.md`：打两个版本 Release，旧客户端应检测到 `latest.yml` 并提示重启安装。开发态菜单「检查更新」应提示未启用。

## 未完成 / 限制

1. **Windows 安装包**：当前环境为 Linux；请在 Windows 本机或 Windows CI 跑 `npm run dist`
2. **目标平台 sync**：完整 Windows native optional deps 建议在 Windows 上再跑一次 `sync:runtime`（当前 Linux sync 已含部分 win32 prebuilds，如 `node-pty`）
3. **代码签名**：未配置；SmartScreen 警告见文档
4. macOS / Linux 正式发行：架构已预留（`dist:linux`），非本阶段验收重点
5. Linux 上 sharp 对 Electron 二进制有兼容性警告（Windows 主路径需实机确认）

## 文件清单

- `electron/main.js` / `preload.js` / `splash.html` / `updater.js`
- `scripts/sync-harness-runtime.mjs` / `verify-runtime.mjs` / `ensure-runtime.mjs`
- `electron-builder.yml` / `package.json`
- `docs/research-runtime.md` / `packaging.md` / `ota.md` / `cloud-agent-handoff-prompt.md`
