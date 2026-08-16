# 任务总结：v0.1.1 杀软 / 缺少 Runtime 修复

## 现象

1. 本机：下载 portable 后被杀软误报并隔离  
2. 朋友：启动报「缺少 Runtime」，路径在 `%TEMP%\...\bin.js`（Portable 解压目录）

## 原因

NSIS Portable 每次运行解压到临时目录；Defender 等常隔离其中的 harness/`node_modules`，导致找不到 `dsh/lib/bin.js`。

## 处理

1. **发布 ZIP 为推荐下载**：解压到固定短路径再运行  
2. 启动时将 runtime **同步到 `%APPDATA%\...\runtime\harness`**，减少对 Temp 依赖  
3. 打包态错误文案改为提示杀软隔离与 ZIP 用法  
4. Portable `unpackDirName: dsh-desktop`

## 下载

https://github.com/xyiqq/cursor-cloud/releases/tag/v0.1.1

- ZIP：https://github.com/xyiqq/cursor-cloud/releases/download/v0.1.1/DeepSeek-Harness-0.1.1-win-x64.zip
