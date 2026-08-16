# DeepSeek Harness 桌面客户端

基于 Electron 的 Windows「打开即用」客户端。打包与运行时对齐 [ningbainb/deepseek-harness-desktop](https://github.com/ningbainb/deepseek-harness-desktop)。

内置：

- 图片理解（[DSH-vison](https://github.com/hisence999/DSH-vison)）
- **Home Assistant**（原生 `ha_*` 工具 + 可选 MCP 桥接）
- **展厅 Showroom**（孪生墙 / Show Mode / 拍照控灯 / 许愿；不含 ASR）
- **滑动变祖器**（[Liang-Saint-Slider](https://github.com/BruzWJ/Liang-Saint-Slider)：先选模型，滑条只调思考强度；菜单 **插件 → 滑动变祖器** 可开关）
- **ZIP OTA**：启动自动检测 GitHub Releases 新版本并下载安装

## 下载（v0.4.8）

https://github.com/xyiqq/cursor-cloud/releases/tag/v0.4.8

- **Windows x64 ZIP：** https://github.com/xyiqq/cursor-cloud/releases/download/v0.4.8/DeepSeek-Harness-0.4.8-win-x64.zip
- **macOS Apple Silicon (arm64)：** https://github.com/xyiqq/cursor-cloud/releases/download/v0.4.8/DeepSeek-Harness-0.4.8-mac-arm64.zip
- **macOS Intel (x64)：** https://github.com/xyiqq/cursor-cloud/releases/download/v0.4.8/DeepSeek-Harness-0.4.8-mac-x64.zip

1. 解压到短路径（Windows 如 `C:\dsh-desktop\`；macOS 可将 `.app` 拖到「应用程序」）
2. 运行 `DeepSeek Harness`（macOS 未签名时需在「系统设置 → 隐私与安全性」允许打开）
3. 之后版本更新由客户端自动检测（菜单也可「检查更新」）

内置含 **滑动变祖器**（默认开启）：点输入框旁模型位 → **模型**行选模型 → 滑条只调当前模型思考强度。开关在应用内 **设置 → 滑动变祖器**（保存后即时生效）。

> **小版本测试 v0.4.8：** 把滑动变祖器开关做到设置页列表里；并保留顶部菜单「插件」提示入口。

## Home Assistant

见 [docs/homeassistant.md](docs/homeassistant.md)。设置页 → **Home Assistant**：

- 原生 REST：填 URL + Token，启用后即可用 `ha_*` 工具
- MCP：填 ha-mcp 的 streamable-http URL，保存后**重启**生效

## 展厅 Showroom

见 [docs/showroom.md](docs/showroom.md)。菜单 **展厅** 可打开孪生墙 / 控制台 / 许愿页；语音 ASR 暂缓。

## OTA

见 [docs/ota.md](docs/ota.md)。打包版启动后会查 GitHub `releases/latest`，有新版本则自动下载 ZIP 并提示重启覆盖安装。

## 开发

```bash
cd deepseek-harness-desktop
npm install
npm run verify:runtime
npm start
npm run dist:zip
```

## 文档

- [docs/homeassistant.md](docs/homeassistant.md) — Home Assistant 接入
- [docs/showroom.md](docs/showroom.md) — 展厅插件用法
- [docs/plugins-local.md](docs/plugins-local.md) — 本地安装社区插件（如滑动变祖器）
- [docs/showroom-roadmap.md](docs/showroom-roadmap.md) — 展厅能力规划（含 ASR 暂缓说明）
- [docs/ota.md](docs/ota.md) — OTA
- [AGENTS_BRIEF.md](AGENTS_BRIEF.md) — 代理协作摘要

## 许可证

壳代码 MIT。`@deepseek-ai/dsh` 与第三方插件遵循各自许可。
