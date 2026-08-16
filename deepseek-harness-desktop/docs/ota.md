# OTA（ZIP 便携版自动更新）

## 行为（v0.4.6+）

| 场景 | 行为 |
|---|---|
| 开发 / `!app.isPackaged` | 弹窗提示开发模式未启用 OTA |
| 已打包（ZIP 解压运行） | 启动约 8s 后检查 GitHub Releases；**仅提示有新版本**，不自动静默下载 |
| 菜单「检查更新」 | 有新版本 → 先确认再下载；已是最新 / 失败都会弹窗说明 |
| 发现更高版本并确认 | 下载 `DeepSeek-Harness-*-{win\|mac}-*.zip`，解压到 `%APPDATA%\DeepSeek Harness\updates\`（macOS 类似） |
| 下载完成 | 对话框「立即重启安装 / 稍后」 |
| 立即安装 | Windows：写 `apply-update.cmd`，退出后 `robocopy` 覆盖安装目录并重启；macOS：提示手动替换 |
| GitHub 不可达 | 错误弹窗 +「打开下载页」 |

实现：`electron/updater.js`（GitHub Releases API + ZIP，不依赖 NSIS/`latest.yml`）。

## 说明

- **不用每次去网页下包**：客户端会自己检测并下载（需能访问 `api.github.com` / `github.com`）。
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

1. bump `package.json` version（如 `0.4.6`）
2. `npm run dist:all`（或 `dist:zip`）
3. 创建 GitHub Release，**tag = `v0.4.6`**
4. 上传连字符命名的 ZIP

客户端对照 Releases 中最新可用 tag 与本地 `app.getVersion()`。

## 未签名限制

未配置代码签名时，SmartScreen / 杀软可能提示；属预期。更新覆盖时若杀软锁定文件，查看 `%APPDATA%\DeepSeek Harness\updates\apply.log`。
