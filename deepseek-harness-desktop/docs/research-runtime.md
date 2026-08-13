# Runtime 调研：`@deepseek-ai/dsh`

调研日期：2026-08-13 · 验证版本：`0.1.0-rc.3`（npm latest 当时亦可见 `0.1.0-rc.6`）

## 包概览

| 项 | 值 |
|---|---|
| 包名 | `@deepseek-ai/dsh` |
| bin | `dsh` → `lib/bin.js` |
| 类型 | ESM（`"type": "module"`） |
| License | MIT |
| 仓库 | https://github.com/deepseek-ai/deepseek-harness（`apps/cli`） |
| 官网 | https://deepseek.com/harness |
| publishConfig.access | `restricted`（元数据如此，但 npm 公网可安装已验证版本） |

`dsh web` 是 `--profile web` 的硬编码别名，用于启动 Browser UI（非 VS Code 插件）。

## 启动与参数

```text
Usage: dsh --profile web [options]
  --host <host>                  bind host
  --port <port>                  listen port; 0 = OS 分配
  --trusted-host <authority...>  /api browser-trust 额外 authority
```

本地验证：

- `dsh web --host 127.0.0.1 --port 0` → 打印 `dsh web: http://127.0.0.1:<port>`
- `--host 0.0.0.0` → **立即失败**：`error: --host 0.0.0.0 is intentionally not supported yet for safety...`
- cwd 即为 workspace root
- `$DSH_HOME` 可覆盖默认 `~/.dsh`；凭据文件为 `$DSH_HOME/.credentials.yaml`
- 环境变量 `DEEPSEEK_API_KEY` 优先于文件

## Node 引擎硬依赖（桌面壳关键）

`@deepseek-ai/dsh-session-persistence-jsonl` 从 `node:zlib` 导入：

- `createZstdDecompress`
- `zstdCompress` / `zstdDecompress` / …

在 **Node 22.14** 上会直接 SyntaxError；在 **Node 24.18.0** 上 `dsh web` 可正常监听。

另有传递依赖 `@earendil-works/pi-ai` 声明 `engines.node: >=22.19.0`。

**结论：** 桌面端必须使用 **Node ≥22.19（推荐 24.18+）**。Electron **≥41** 内置 Node 24.18，可用 `ELECTRON_RUN_AS_NODE=1` + `process.execPath` 跑 `bin.js`，无需再捆绑独立 `node.exe`（除非未来 Electron Node 回退）。

### `--expose-internals`（HMR）

`dsh` 在 profile boot 末尾会尝试挂载 `@deepseek-ai/cordis-plugin-hmr`，而 HMR 依赖 `cordis-plugin-loader` 在 `process.execArgv` 含 `--expose-internals` 时提供的 `loader.internal`。

| 运行时 | 无 flag | 有 `--expose-internals` |
|---|---|---|
| 官方 Node 24 | 多数情况仍可服务（HMR 失败可能被吞） | 正常 |
| Electron `RUN_AS_NODE` | **进程退出**，UI 起不来 | **正常**（已验证 HTTP 200） |

桌面主进程 spawn 参数必须包含 `--expose-internals`。

## 依赖树与体积

- 生产依赖：大量 `@deepseek-ai/dsh-*` 插件 + Cordis 插件生态
- Linux x64 实测 `npm install --omit=dev` 后约 **~360MB** `node_modules`
- **不要裁剪**（本阶段）：先保证能跑

## Native / 平台相关

安装树中可见（随平台 optional/prebuild 变化）：

| 模块 | 用途 |
|---|---|
| `node-pty` | 终端 PTY（含 win32 prebuilds） |
| `node-addon-require-builtin-*` | 平台相关 addon 加载 |
| `sharp` / `@img/sharp-*` | 图像 |
| `@koromix/koffi-*` | FFI |

Windows 上 bash sandbox 可能 disabled，pwsh sandbox 启用（与上游终端插件策略一致）。**务必在目标 OS 上执行 `sync:runtime`**，以便拉到正确的 optional native 包。

## 桌面嵌入策略

1. `scripts/sync-harness-runtime.mjs` 在 `resources/harness` 安装固定版 dsh
2. electron-builder `extraResources` 拷到安装目录 `resources/harness`（**不进 asar**）
3. 主进程：

```js
spawn(process.execPath, [
  '--expose-internals', // cordis HMR / loader.internal
  dshBin,
  'web',
  '--host', '127.0.0.1',
  '--port', String(port),
], {
  env: { ...env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: dshHome },
  cwd: workspace,
})
```

4. 等待 HTTP 就绪后再 `BrowserWindow.loadURL`

## 风险与已知坑

1. 禁止 `0.0.0.0`
2. 依赖树巨大、sync 慢
3. `publishConfig.access: restricted` 若遇私有 registry，改回 registry.npmjs.org
4. Electron Node 版本不匹配时会在 splash 阶段失败——需升级 Electron 或改捆绑官方 Node
5. 未签名 Windows 包可能被 SmartScreen / 杀毒拦截

## 参考命令

```bash
npm view @deepseek-ai/dsh@0.1.0-rc.3 version bin
node path/to/bin.js web --help
node path/to/bin.js web --host 127.0.0.1 --port 0
```
