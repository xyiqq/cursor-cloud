# 打包说明

## 产物

| 脚本 | 说明 |
|---|---|
| `npm run sync:runtime` | 安装 `@deepseek-ai/dsh` 到 `resources/harness` |
| `npm run verify:runtime` | 校验 bin / `--help` / 拒绝 `0.0.0.0` / Node zstd |
| `npm run dist` | sync + verify + `electron-builder --win` |
| `npm run dist:dir` | 仅生成解压目录（更快冒烟） |
| `npm run dist:linux` | Linux AppImage（云端冒烟用） |

Windows 主产物（`dist/`）：

- NSIS：`DeepSeek Harness Setup <ver>.exe`
- Portable：`DeepSeek Harness-<ver>-portable.exe`
- 更新元数据：`latest.yml`、`.blockmap`

## extraResources

`electron-builder.yml` 将 harness 拆条拷贝（**重要**）：

electron-builder 默认排除名为 `node_modules` 的目录。若只写：

```yaml
extraResources:
  - from: resources/harness
    to: harness
```

则安装包里会缺少 runtime。正确写法是把 `node_modules` 单独作为 `from`：

```yaml
extraResources:
  - from: resources/harness/package.json
    to: harness/package.json
  - from: resources/harness/RUNTIME_VERSION.json
    to: harness/RUNTIME_VERSION.json
  - from: resources/harness/node_modules
    to: harness/node_modules
    filter:
      - "**/*"
```

安装后路径：`process.resourcesPath/harness/node_modules/@deepseek-ai/dsh/lib/bin.js`。

**禁止**把整个 harness `node_modules` 打进 asar（native addon、动态 require 会坏）。

## 主进程定位

见 `electron/main.js` 的 `resolveBundledHarnessRoot()` / `locateDshEntry()`（打包后会把 runtime 同步到 `userData/runtime/harness`，避免 Portable 落在 `%TEMP%` 被杀软隔离）。

启动方式：`ELECTRON_RUN_AS_NODE=1` + Electron `process.execPath`。要求 Electron ≥41（Node 24.18+）。

## 平台注意

1. **在目标 OS 上 sync**：Windows 发行版应在 Windows（或至少能解析 win32 optional deps 的环境）执行 sync，否则 `node-pty` 等可能缺 win32 prebuild。
2. **Linux CI**：可完成代码与 Linux runtime 校验；交叉编译 Windows 安装包依赖 Wine 等，不保证。文档与验收以 Windows runner / 本机为准。
3. **体积**：runtime ~数百 MB，安装包会很大——本阶段不裁剪。
4. **签名**：未配置 `certificateFile`；SmartScreen 警告见 `docs/ota.md`。

## 覆盖 dsh 版本

```bash
DSH_VERSION=0.1.0-rc.6 npm run sync:runtime
```

同步后检查 `resources/harness/RUNTIME_VERSION.json`。

## 本地目录结构（打包相关）

```text
resources/harness/
  package.json           # 仅依赖 @deepseek-ai/dsh
  RUNTIME_VERSION.json   # sync 元数据
  node_modules/          # gitignore
electron-builder.yml
```
