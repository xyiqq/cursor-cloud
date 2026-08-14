# DeepSeek Harness 桌面客户端

基于 Electron 的 Windows「打开即用」客户端。打包与运行时对齐参考实现 [ningbainb/deepseek-harness-desktop](https://github.com/ningbainb/deepseek-harness-desktop)：

- `@deepseek-ai/dsh` 作为应用直接依赖
- `asar` + `asarUnpack: node_modules/**`
- `ELECTRON_RUN_AS_NODE=1` + Electron `process.execPath` 拉起官方 CLI
- `~/.dsh/profiles/desktop` 官方 bundle profile
- Windows 原生模块强制打包 + 目录选择器 PowerShell 补丁
- **内置图片理解插件**（[DSH-vison](https://github.com/hisence999/DSH-vison)）：纯文本模型也可发图，自动调用多模态模型生成描述；设置页「图片理解」可配置

上游：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) · npm：[`@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh)

## 下载（v0.2.1）

发布页：https://github.com/xyiqq/cursor-cloud/releases/tag/v0.2.1

**Windows ZIP（推荐）：**

https://github.com/xyiqq/cursor-cloud/releases/download/v0.2.1/DeepSeek-Harness-0.2.1-win-x64.zip

1. 解压到短路径，例如 `C:\dsh-desktop\`
2. 运行 `DeepSeek Harness.exe`
3. 若被杀软隔离：到「保护历史记录」选择允许/还原

| 平台 | 文件 | 说明 |
|---|---|---|
| **Windows x64** | ZIP | **推荐**，解压即用 |
| Windows x64 | Portable `.exe` | 易被杀软拦截，不推荐 |

> 请不要继续使用 v0.1.x：旧版用独立 `extraResources` harness / 同步复制，会卡死或缺 koffi。

## 功能

- 双击启动，主进程以 `ELECTRON_RUN_AS_NODE` 拉起 `dsh --profile desktop`
- 窗口加载本机 `http://127.0.0.1:<port>`
- 单实例；关闭时清理 dsh 子进程
- OTA：`electron-updater` + GitHub Releases
- 目录选择：PowerShell `FolderBrowserDialog`（避免 koffi COM worker 断开）
- 图片理解：内置 `dsh-image-vision`（设置 → 图片理解；需已配置至少一个支持图片的模型）

## 系统要求

- **Windows 10/11 x64**
- 运行时自带 Electron 43（内含满足 dsh zstd 要求的 Node）
- 构建机：Node ≥22.19（推荐 24.x）；正式 Windows 包建议在 `windows-latest` CI 构建

## 开发

```bash
cd deepseek-harness-desktop
npm install          # postinstall: sync win natives + patch picker
npm run verify:runtime
npm start            # ELECTRON_DEV=1
```

可选环境变量：

| 变量 | 含义 |
|---|---|
| `DSH_BIN` | 直接指向外部 `lib/bin.js` |
| `DSH_HOME` | 覆盖默认 `~/.dsh` |
| `DEEPSEEK_API_KEY` | API 密钥 |
| `GH_PUBLISH_OWNER` / `GH_PUBLISH_REPO` | OTA / 发布仓库覆盖 |

## 配置 API Key

1. 环境变量 `DEEPSEEK_API_KEY`
2. `$DSH_HOME/.credentials.yaml`（如 `DEEPSEEK_API_KEY: sk-...`）
3. Web UI → Models / 设置页

默认 `DSH_HOME` 为用户主目录下的 `~/.dsh`（Windows：`%USERPROFILE%\.dsh`）。菜单「帮助 → 打开 DSH_HOME」可定位。

## 打包

```bash
npm run dist:zip     # Windows ZIP（可在 Linux 交叉打包；原生模块由 sync:natives 注入）
npm run dist         # zip + portable
```

GitHub Actions：推送 `v*` tag 时在 `windows-latest` 构建（见 `.github/workflows/desktop-release.yml`）。

## OTA

见 [docs/ota.md](docs/ota.md)。

## 文档

- [AGENTS_BRIEF.md](AGENTS_BRIEF.md)
- [docs/research-runtime.md](docs/research-runtime.md)
- [docs/packaging.md](docs/packaging.md)
- [docs/ota.md](docs/ota.md)

## 许可证

本桌面壳代码以 MIT 许可。DeepSeek Harness / `@deepseek-ai/dsh` 为其各自上游许可证（MIT）。
