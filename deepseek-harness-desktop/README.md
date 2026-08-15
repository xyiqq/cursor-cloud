# DeepSeek Harness 桌面客户端

基于 Electron 的 Windows「打开即用」客户端。打包与运行时对齐 [ningbainb/deepseek-harness-desktop](https://github.com/ningbainb/deepseek-harness-desktop)。

内置：

- 图片理解（[DSH-vison](https://github.com/hisence999/DSH-vison)）
- **Home Assistant**（原生 `ha_*` 工具 + 可选 MCP 桥接）
- **ZIP OTA**：启动自动检测 GitHub Releases 新版本并下载安装

## 下载（v0.3.0）

https://github.com/xyiqq/cursor-cloud/releases/tag/v0.3.0

**Windows ZIP：** https://github.com/xyiqq/cursor-cloud/releases/download/v0.3.0/DeepSeek-Harness-0.3.0-win-x64.zip

1. 解压到短路径，例如 `C:\dsh-desktop\`
2. 运行 `DeepSeek Harness.exe`
3. 之后版本更新由客户端自动检测（菜单也可「检查更新」）

## Home Assistant

见 [docs/homeassistant.md](docs/homeassistant.md)。设置页 → **Home Assistant**：

- 原生 REST：填 URL + Token，启用后即可用 `ha_*` 工具
- MCP：填 ha-mcp 的 streamable-http URL，保存后**重启**生效

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
- [docs/showroom-roadmap.md](docs/showroom-roadmap.md) — **展厅能力与后续开发计划**（拍照控灯、孪生墙、语音意图等）
- [docs/ota.md](docs/ota.md) — OTA
- [AGENTS_BRIEF.md](AGENTS_BRIEF.md) — 代理协作摘要

## 许可证

壳代码 MIT。`@deepseek-ai/dsh` 与第三方插件遵循各自许可。
