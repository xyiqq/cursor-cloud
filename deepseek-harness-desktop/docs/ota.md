# OTA（ZIP 便携版自动更新）

## 行为（v0.3.0+）

| 场景 | 行为 |
|---|---|
| 开发 / `!app.isPackaged` | no-op |
| 已打包（ZIP 解压运行） | 启动约 8s 后检查 GitHub Releases `latest` |
| 发现更高版本 | 自动下载 `DeepSeek-Harness-*-win-x64.zip`，解压到 `%APPDATA%\DeepSeek Harness\updates\` |
| 下载完成 | 对话框「立即重启安装 / 稍后」 |
| 立即安装 | 写 `apply-update.cmd`，退出后 `robocopy` 覆盖安装目录并重启 |
| 菜单 | 「DeepSeek Harness → 检查更新」手动触发 |

实现：`electron/updater.js`（GitHub Releases API + ZIP，不依赖 NSIS/`latest.yml`）。

## 说明

- **不用每次去网页下包**：客户端会自己检测并下载。
- **仍是完整 ZIP**：便携版暂无差量 blockmap；体积与发版包相当，但流程全自动。
- 发布时请上传命名规范资产：
  - Windows：`DeepSeek-Harness-<version>-win-x64.zip`
  - macOS：`DeepSeek-Harness-<version>-mac-arm64.zip` / `...-mac-x64.zip`
  （electron-builder 产物名可能带空格，发布前复制为连字符名。）

## 发布仓库

默认：`xyiqq/cursor-cloud`。可用环境变量覆盖：

- `GH_PUBLISH_OWNER` / `DSH_DESKTOP_GH_OWNER`
- `GH_PUBLISH_REPO` / `DSH_DESKTOP_GH_REPO`

## 发布流程

1. bump `package.json` version（如 `0.3.0`）
2. `npm run dist:zip`
3. 创建 GitHub Release，**tag = `v0.3.0`**
4. 上传 `DeepSeek-Harness-0.3.0-win-x64.zip`

客户端下次启动对照 `releases/latest` 的 tag 与本地 `app.getVersion()`。

## 未签名限制

未配置代码签名时，SmartScreen / 杀软可能提示；属预期。更新覆盖时若杀软锁定文件，查看 `%APPDATA%\DeepSeek Harness\updates\apply.log`。
