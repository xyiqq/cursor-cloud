# 云端大模型交接提示词：DeepSeek Harness 桌面客户端

> 把下面「======= 复制开始 =======」到「======= 复制结束 =======」整段发给云端 Agent / 多 Agent 系统执行。

======= 复制开始 =======

# 任务：把 DeepSeek Harness 打成「打开即用」的 Windows 桌面客户端（含 OTA）

你是资深全栈 / Electron 工程师。请**直接实现并交付可构建产物**，不要只写方案。若你支持子代理，请按下述角色并行分工后由编排者整合。

## 1. 背景与上游

- 上游仓库：https://github.com/deepseek-ai/deepseek-harness  
  - 描述：DeepSeek Harness: Everything is a Plugin  
  - 默认分支：`master`，语言 TypeScript，License MIT  
  - 官方应用目录目前主要是 `apps/cli`、`apps/web`（**没有官方桌面端**）  
  - 官网：https://deepseek.com/harness  
- npm 启动器包：`@deepseek-ai/dsh`（已验证版本：`0.1.0-rc.3`）  
- 本地验证过的用法：
  - `dsh web` 或 `dsh --profile web`
  - 会启动 **Browser UI**（不是 VS Code 插件）
  - 曾成功监听：`http://127.0.0.1:3080`，页面标题 `DeepSeek Harness`
  - Web 帮助：`dsh web --help` 支持 `--host`、`--port`、`--trusted-host`
  - **禁止** `--host 0.0.0.0`（上游 CLI 会拒绝）
- 凭据：
  - 环境变量：`DEEPSEEK_API_KEY`
  - 或文件：`%USERPROFILE%\.dsh\.credentials.yaml`（YAML mapping，如 `DEEPSEEK_API_KEY: sk-...`）
  - Web UI 的 Models/设置页也可写入凭据
- 注意：用户主目录若曾 `npm i @deepseek-ai/dsh`，那只是开发参考；**桌面发行版必须自带 runtime，用户机器上不能要求再 npm install**。

## 2. 产品目标（验收标准）

做出 Windows 桌面客户端，满足：

1. **打开即用**：安装/解压后双击即可；用户无需安装 Node、无需 `npm i`、无需手动起终端。
2. **内嵌 Harness UI**：Electron（或同等）主进程拉起内置 `dsh web`，BrowserWindow 加载 `http://127.0.0.1:<port>`。
3. **OTA**：使用 `electron-builder` + `electron-updater`，通过 GitHub Releases（或可配置的通用 HTTP）检查/下载/安装更新。
4. **首次引导**：若无 API Key，给出设置入口（应用内页或打开 Harness 设置）；不要把密钥写进仓库。
5. **单实例**：重复打开聚焦已有窗口。
6. **干净退出**：关窗口时杀掉 `dsh` 子进程，不残留端口占用。
7. **可构建**：提供 `npm start`（开发）与 `npm run dist`（打出 NSIS 安装包 + portable）。

非目标（本阶段不做）：
- macOS / Linux 发行（架构可预留，但先交付 Windows）
- 代码签名证书购买（文档写明未签名时 SmartScreen 警告即可）
- 修改 upstream deepseek-harness 源码（除非打包必须打 patch，需记录）

## 3. 建议仓库 / 工作目录结构

在独立仓库或目录中创建（名称建议 `deepseek-harness-desktop`）：

```text
deepseek-harness-desktop/
  package.json
  electron-builder.yml          # 或 package.json build 字段
  README.md                     # 中文为主
  AGENTS_BRIEF.md
  .gitignore
  electron/
    main.js                     # 主进程：端口、spawn dsh、窗口、单实例
    preload.js                  # contextIsolation
    updater.js                  # OTA 封装
    splash.html                 # 启动中（中文）
  resources/
    harness/                    # 【打进安装包】完整 dsh 生产依赖树
      package.json
      node_modules/
      RUNTIME_VERSION.json
  scripts/
    sync-harness-runtime.mjs    # 同步/安装 @deepseek-ai/dsh 到 resources/harness
    verify-runtime.mjs          # 校验 bin 与 --help
  docs/
    packaging.md
    ota.md
    research-runtime.md
    cloud-agent-handoff-prompt.md
    task-summaries/
```

本地用户侧曾建过目录（若云端可挂载则复用，否则按上面重建）：
- `C:\Users\dazhazhang\uoloproject\deepseek-harness-desktop`
- 参考已装包：`C:\Users\dazhazhang\node_modules\@deepseek-ai\dsh`

## 4. 已定技术选型（不要轻易改）

| 项 | 选择 |
|---|---|
| 壳 | Electron |
| 打包 | electron-builder（`win.target`: `nsis` + `portable`） |
| Harness 放置 | `extraResources` → 安装后 `process.resourcesPath/harness`（**不要塞进 asar**） |
| 启动 | 主进程 `spawn(process.execPath 或 捆绑 node / 用 electron 的 node)` 跑 `node_modules/@deepseek-ai/dsh/lib/bin.js web --host 127.0.0.1 --port <free>` |
| 开发态 | `ELECTRON_DEV=1` 可用外部已装 dsh / `npx`，方便调试 |
| OTA | `electron-updater`，`publish: provider=github`，repo 可配置（默认占位：`dazhazhang/deepseek-harness-desktop`，用 env 覆盖） |
| 安全 | `contextIsolation: true`，无 remote module，只加载 loopback URL |

**关键实现细节：**

- 用系统空闲端口（`server.listen(0)` 或等价），等待 HTTP 200 再 `loadURL`。
- splash 显示「正在启动 DeepSeek Harness…」，失败要有可读错误（缺 runtime、端口占用、dsh 退出码）。
- 工作目录：可用 `app.getPath('userData')/workspace` 或用户文档下目录；**cwd 对 dsh 是 workspace root**。
- `DSH_HOME` 可设为 `app.getPath('userData')/dsh-home`，避免权限问题；文档说明与默认 `~/.dsh` 的差异。
- OTA：未打包（`!app.isPackaged`）时 no-op + 日志；已打包才 `checkForUpdates`。
- IPC：`update:check`、`update:install`；进度可用 dialog 或简单自定义页。

## 5. 子代理分工（若平台支持多 Agent，请并行）

### Agent A — Runtime 调研（只读 + 写文档）
- 读 `@deepseek-ai/dsh` 的 README / package.json / `dsh web --help`
- 弄清生产依赖树、native addon、平台限制（Windows 上 bash sandbox 可能 disabled，pwsh sandbox 启用）
- 输出 `docs/research-runtime.md`

### Agent B — Electron 壳
- 实现 `electron/main.js`、`preload.js`、`splash.html`
- 单实例、子进程生命周期、就绪探测
- `npm start` 可在有 dsh 的环境打开窗口

### Agent C — 离线 Runtime 打包
- `scripts/sync-harness-runtime.mjs`：在 `resources/harness` 安装 `@deepseek-ai/dsh@0.1.0-rc.3` 完整生产依赖
- `scripts/verify-runtime.mjs`
- `electron-builder` 的 `extraResources` 配置
- `docs/packaging.md`
- **实际跑通 sync**（网络允许时）

### Agent D — OTA
- `electron/updater.js` + 与 main 集成
- `docs/ota.md`：如何打 Release、`latest.yml`、未签名限制
- `package.json` / `electron-builder.yml` 的 `publish` 字段

### Agent E — 整合与验收（最后串行）
- 合并冲突、统一 package.json scripts：
  - `npm run sync:runtime`
  - `npm run verify:runtime`
  - `npm start`
  - `npm run dist`
- 在 Windows 上尽量跑：`sync` → `verify` → `start`（开发）→ `dist`（若 CI 资源够）
- 写总验收报告到 `docs/task-summaries/YYYY-MM-DD-desktop-client.md`

## 6. package.json scripts 期望

```json
{
  "name": "deepseek-harness-desktop",
  "version": "0.1.0",
  "private": true,
  "main": "electron/main.js",
  "scripts": {
    "sync:runtime": "node scripts/sync-harness-runtime.mjs",
    "verify:runtime": "node scripts/verify-runtime.mjs",
    "start": "cross-env ELECTRON_DEV=1 electron .",
    "dist": "npm run sync:runtime && npm run verify:runtime && electron-builder --win",
    "dist:dir": "electron-builder --win --dir"
  }
}
```

（`cross-env` 可按需；Windows 也可用 `set ELECTRON_DEV=1&& electron .`）

## 7. 构建配置要点（electron-builder）

```yaml
appId: com.deepseek.harness.desktop
productName: DeepSeek Harness
directories:
  output: dist
files:
  - electron/**/*
  - package.json
extraResources:
  - from: resources/harness
    to: harness
win:
  target:
    - nsis
    - portable
publish:
  provider: github
  owner: dazhazhang
  repo: deepseek-harness-desktop
```

主进程定位生产 runtime：

```js
const harnessRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'harness')
  : path.join(__dirname, '..', 'resources', 'harness');
const dshBin = path.join(harnessRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
```

用 Electron 自带 Node 或显式 `process.execPath` 时注意：Electron 的 `process.execPath` 是电子本身；应 `spawn(process.execPath, [dshBin, 'web', ...], { env: { ELECTRON_RUN_AS_NODE: '1', ... } })`，或捆绑官方 Node 二进制。**优先采用 `ELECTRON_RUN_AS_NODE=1` 方案**，减少再塞一份 Node 的体积；若 dsh 与 Electron Node 版本不兼容，再改为 extraResources 捆绑 `node.exe`。

## 8. OTA 发布流程（写入 docs/ota.md）

1. `npm run dist` 产出 `DeepSeek Harness Setup x.y.z.exe`、`.portable.exe`、`latest.yml`
2. 创建 GitHub Release，tag = `vx.y.z`，上传 builder 产物
3. 客户端启动后 `autoUpdater.checkForUpdates()`
4. 下载完成后提示重启安装
5. 说明：无代码签名时 Windows SmartScreen 可能拦截

## 9. 安全与合规

- 禁止提交 API Key、`.credentials.yaml`、`.env`
- 只监听 `127.0.0.1`
- 第三方许可证：upstream MIT；在 README 声明基于 deepseek-harness / @deepseek-ai/dsh
- 不要把整份 upstream monorepo 无必要地 vendoring；发行靠 npm 包依赖树即可

## 10. 交付清单（必须全部有）

- [ ] 可 `npm start` 打开窗口并加载 Harness UI（开发态）
- [ ] `resources/harness` 可由脚本生成且 `verify` 通过
- [ ] `npm run dist` 能打出 Windows 安装包/portable（云端 runner 需 Windows 或文档标明交叉编译限制）
- [ ] OTA 模块在 packaged 模式下可配置 GitHub repo
- [ ] README（中文）：安装、配置 API Key、更新、故障排查
- [ ] `docs/packaging.md`、`docs/ota.md`、`docs/research-runtime.md`
- [ ] 任务总结：`docs/task-summaries/`

## 11. 已知坑（务必处理）

1. 上游 `dsh web` 拒绝绑定 `0.0.0.0`。
2. `@deepseek-ai/dsh` 依赖极多（大量 `@deepseek-ai/dsh-*` 插件）；sync 可能很慢、体积很大——**先保证能跑，再考虑裁剪**。
3. 某些包 `publishConfig.access: restricted` 曾出现在 package 元数据中，但 npm 上可安装 `0.1.0-rc.3`；若私有 registry 失败，记录错误并改用已验证 registry。
4. 用户曾把包装在 `%USERPROFILE%`，污染全局；桌面项目**禁止**再往用户 home 乱装。
5. 云端若是 Linux runner：可完成代码与 Linux 侧校验，但 **Windows 安装包需 Windows runner 或说明限制**。
6. 子进程编码：Windows 下注意 `stdio` 日志与路径空格。
7. 杀毒软件可能拦截 portable/未签名安装包。

## 12. 你的工作方式

1. 先建目录与 `AGENTS_BRIEF.md`，再并行子任务。  
2. 每完成一大块写 `docs/task-summaries/YYYY-MM-DD-*.md`。  
3. 最终回复给出：如何构建、产物路径、如何测 OTA、未完成项。  
4. 用简体中文写用户可见文档。  

现在开始实现。

======= 复制结束 =======
