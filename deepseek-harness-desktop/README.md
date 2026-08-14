# DeepSeek Harness 桌面客户端

基于 Electron 的 Windows「打开即用」客户端：内嵌 `@deepseek-ai/dsh` 的 Browser UI（`dsh web`），无需本机安装 Node / 手动 `npm i`。

上游：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）· npm：[`@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh)

## 下载（已发布）

发布页：https://github.com/xyiqq/cursor-cloud/releases

### 推荐：Windows ZIP（v0.1.2+）

请使用最新 ZIP（不要用会卡死的旧版同步逻辑 / portable）：

https://github.com/xyiqq/cursor-cloud/releases/download/v0.1.2/DeepSeek-Harness-0.1.2-win-x64.zip

1. 解压到短路径，例如 `C:\dsh-desktop\`
2. 运行 `DeepSeek Harness.exe`
3. 若被杀软隔离：到「保护历史记录」选择允许/还原（可不加排除项）

| 平台 | 文件 | 说明 |
|---|---|---|
| **Windows x64** | ZIP | **推荐**，解压即用 |
| Windows x64 | Portable `.exe` | 易被杀软拦截，不推荐 |
| Linux x64 | AppImage | 赋予执行权限后运行 |

## 功能

- 双击启动，主进程拉起内置 `dsh web`，窗口加载 `http://127.0.0.1:<port>`
- 首次无 API Key 时提示设置入口
- 单实例；关闭时清理 dsh 子进程
- OTA：`electron-updater` + GitHub Releases（打包后生效）
- 发行物：portable（当前 Release）+ NSIS（需 Windows 本机构建）

## 系统要求

- **Windows 10/11 x64**（本阶段主交付）
- 运行时自带 Electron（内含 Node ≥24.18，满足 dsh 对 `node:zlib` zstd 的依赖）
- 构建机：Node ≥22.19（推荐 24.x）

## 开发

```bash
cd deepseek-harness-desktop
npm install
npm run sync:runtime    # 安装 @deepseek-ai/dsh@0.1.0-rc.3 到 resources/harness
npm run verify:runtime
npm start               # ELECTRON_DEV=1
```

可选环境变量：

| 变量 | 含义 |
|---|---|
| `DSH_VERSION` | sync 时的 dsh 版本（默认 `0.1.0-rc.3`） |
| `DSH_BIN` | 开发态直接指向外部 `lib/bin.js` |
| `DEEPSEEK_API_KEY` | API 密钥 |
| `GH_PUBLISH_OWNER` / `GH_PUBLISH_REPO` | OTA / 发布仓库覆盖 |

## 配置 API Key

优先级（与上游一致）：

1. 环境变量 `DEEPSEEK_API_KEY`
2. `$DSH_HOME/.credentials.yaml`（YAML mapping，如 `DEEPSEEK_API_KEY: sk-...`）
3. Web UI → Models / 设置页

**桌面版默认 `DSH_HOME`** 为应用 `userData/dsh-home`（例如 Windows：`%APPDATA%\DeepSeek Harness\dsh-home`），**不是** `~/.dsh`。工作区目录为 `userData/workspace`。菜单「帮助 → 打开 DSH_HOME 目录」可快速定位。

切勿把密钥提交到仓库。

## 打包（Windows）

在 **Windows** 上：

```bash
npm run dist
```

产物在 `dist/`：

- `DeepSeek Harness Setup <version>.exe`（NSIS）
- `DeepSeek Harness-<version>-portable.exe`
- `latest.yml`（供 electron-updater）

### Linux 云端 Runner 限制

本仓库可在 Linux 上完成代码、`sync:runtime`、`verify:runtime`。用 electron-builder **交叉打 Windows 包**可能缺少 Wine/代码签名工具；请在 Windows CI 或本机执行 `npm run dist`。可用 `npm run dist:linux` 在 Linux 上打 AppImage 做冒烟。

未配置代码签名时，Windows SmartScreen 可能警告——属预期，见 [docs/ota.md](docs/ota.md)。

## OTA 简述

1. `npm run dist` 并创建 GitHub Release（tag `v0.1.0`），上传 builder 产物与 `latest.yml`
2. 已安装客户端启动后自动 `checkForUpdates`
3. 下载完成提示重启安装

详情：[docs/ota.md](docs/ota.md)

## 文档

- [AGENTS_BRIEF.md](AGENTS_BRIEF.md) — 代理协作摘要
- [docs/research-runtime.md](docs/research-runtime.md) — dsh runtime 调研
- [docs/packaging.md](docs/packaging.md) — 打包说明
- [docs/ota.md](docs/ota.md) — 更新发布
- [docs/task-summaries/](docs/task-summaries/) — 任务总结

## 许可证

本桌面壳代码以 MIT 许可。DeepSeek Harness / `@deepseek-ai/dsh` 为其各自上游许可证（MIT）。
