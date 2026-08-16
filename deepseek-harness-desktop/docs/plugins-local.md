# 本地安装社区插件（不必发版）

桌面端每次启动会重写 `~/.dsh/profiles/desktop/cordis.patch.yml`，**不要**只改这个文件。  
请用 `$DSH_HOME/desktop-extra-plugins.json` 登记本地插件（Windows 默认 `C:\Users\<你>\.dsh\`）。

## 例：Liang-Saint-Slider（滑动变祖器）

仓库：https://github.com/BruzWJ/Liang-Saint-Slider  
包名：`dsh-plugin-liang-calibrator`

### 1. 下载插件

**PowerShell：**

```powershell
$dsh = "$env:USERPROFILE\.dsh"
New-Item -ItemType Directory -Force -Path "$dsh\extra-plugins" | Out-Null
if (Test-Path "$dsh\extra-plugins\dsh-plugin-liang-calibrator") {
  git -C "$dsh\extra-plugins\dsh-plugin-liang-calibrator" pull
} else {
  git clone https://github.com/BruzWJ/Liang-Saint-Slider.git "$dsh\extra-plugins\dsh-plugin-liang-calibrator"
}
```

**macOS / Linux：**

```bash
mkdir -p ~/.dsh/extra-plugins
git clone https://github.com/BruzWJ/Liang-Saint-Slider.git ~/.dsh/extra-plugins/dsh-plugin-liang-calibrator
# 或已有目录则 git -C ... pull
```

### 2. 登记额外插件

写入（或合并）`%USERPROFILE%\.dsh\desktop-extra-plugins.json`：

```json
[
  {
    "id": "liang-calibrator",
    "name": "dsh-plugin-liang-calibrator",
    "path": "extra-plugins/dsh-plugin-liang-calibrator"
  }
]
```

`path` 也可写成绝对路径。

### 3. 重启桌面端

完全退出后重新打开。启动时会：

- 把插件 `link` 进 `profiles/desktop/node_modules/`
- 把 `liang-calibrator` 写进自动生成的 `cordis.patch.yml`

点输入框旁的模型位，应打开滑动变祖器。

> **v0.4.5+ 内置开关：** 菜单 **插件 → 滑动变祖器** 可开关内置版（写入 `$DSH_HOME/desktop-liang-calibrator.json`，重启生效）。关闭后恢复官方默认模型选择器。若你仍用 `desktop-extra-plugins.json` 挂本地克隆，关闭内置开关后仍可单独用 extras 加载。

### 卸载

1. 从 `desktop-extra-plugins.json` 删掉对应项（或清空为 `[]`）
2. 可选：删除 `extra-plugins/dsh-plugin-liang-calibrator`
3. 重启桌面端

## 注意

| 项 | 说明 |
|---|---|
| 需要哪版客户端 | **v0.4.3+** 已内置；**v0.4.4+** 滑条只调当前模型强度；**v0.4.5+** 菜单可开关。亦可用 `desktop-extra-plugins.json` 挂其它本地插件。 |
| 开关状态文件 | `$DSH_HOME/desktop-liang-calibrator.json`（默认 `enabled: true`） |
| 官方 README | 上游写的是 `--profile web`；桌面端固定用 **`desktop`** profile，按本文即可。上游原设计是模型×强度一条轴；桌面内置版改为先选模型再滑强度。 |
| 未上 npm | 该插件目前需从 GitHub clone，不能 `npm i dsh-plugin-liang-calibrator`。 |
| 肖像素材 | 肖像版权归原作者，见上游 README。 |

若你仍在用已发布的 v0.4.2 ZIP：要么自己用本仓库再打一次包，要么等下次正式包；需要的话可以说一声，我可以帮你打一包**不升版本号**的补丁 ZIP。
