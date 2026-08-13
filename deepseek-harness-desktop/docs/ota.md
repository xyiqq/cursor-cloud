# OTA（electron-updater + GitHub Releases）

## 行为

| 场景 | 行为 |
|---|---|
| 开发 / `!app.isPackaged` | no-op，日志 `[updater] unpackaged — OTA disabled` |
| 已打包 | 启动约 5s 后 `autoUpdater.checkForUpdates()` |
| 有更新 | 自动下载；完成后对话框「立即重启安装 / 稍后」 |
| 菜单 | 「DeepSeek Harness → 检查更新」手动触发 |

IPC：`update:check`、`update:install`；状态事件 `update:status`。

实现：`electron/updater.js`。

## 发布仓库

默认（`electron-builder.yml`）：

```yaml
publish:
  provider: github
  owner: dazhazhang
  repo: deepseek-harness-desktop
```

运行时可用环境变量覆盖 feed（见 `configurePublisherFromEnv`）：

- `GH_PUBLISH_OWNER` / `DSH_DESKTOP_GH_OWNER`
- `GH_PUBLISH_REPO` / `DSH_DESKTOP_GH_REPO`

发布构建时也可改 yml 或使用 electron-builder 的 publish CLI。

## 发布流程

1.  bump `package.json` version（如 `0.1.1`）
2. 在 **Windows** 执行 `npm run dist`
3. 在 GitHub 创建 Release，**tag = `v0.1.1`**（与 version 对应）
4. 上传 `dist/` 中的：
   - NSIS / portable 安装包
   - `latest.yml`
   - 对应 `.blockmap`（若有）
5. 客户端下次启动会对照 `latest.yml` 检查

使用 `electron-builder --publish always`（需 `GH_TOKEN`）可自动创建 Release。

## latest.yml

由 electron-builder 生成，示例字段含 `version`、`path`、`sha512`、`releaseDate`。`electron-updater` 用其校验下载完整性。

## 未签名限制

- 未购买/配置代码签名证书时，Windows **SmartScreen** 可能提示「未知发布者」
- 企业环境或杀毒软件可能拦截 portable / 更新替换
- 用户需选择「更多信息 → 仍要运行」，或由发布者后续配置 `win.certificateFile` / Azure Trusted Signing

## 测试 OTA（建议）

1. 安装 `0.1.0`
2. 发布 `0.1.1` Release（含 `latest.yml`）
3. 打开旧客户端 → 应提示更新 → 重启后版本变为 `0.1.1`
4. 开发态 `npm start` 点「检查更新」应提示 OTA 未启用
