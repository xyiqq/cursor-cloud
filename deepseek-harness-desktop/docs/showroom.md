# 展厅 Showroom（v0.4）

语音 ASR **暂不做**（见 [showroom-roadmap.md](./showroom-roadmap.md)）。本版交付 P0–P2 其余能力。

## 能力一览

| 优先级 | 能力 | 用法 |
|---|---|---|
| P0 | 拍照控灯 | 图片理解后调用 `showroom_vision_control` |
| P0 | 数字孪生墙 | 菜单「展厅 → 孪生墙」或 `http://127.0.0.1:18765/twin.html` |
| P1 | Show Mode | `showroom_set_mode` 或控制台四按钮 |
| P1 | 工具可视化 | `viz.html` SSE 实时条 |
| P1 | 多角色 | `showroom_set_role`：guide / butler / tech |
| P1 | 观众许愿 | `wish.html`（冷却 + 可选安全 scene） |
| P2 | 只读诊断 | `showroom_diagnose` |
| P2 | 讲解 Skill | `~/.dsh/skills/showroom/*.md` |
| P2 | 远程模式 | 设置开启 + accessKey；Hub 监听 `0.0.0.0` |

## 配置

1. **设置 → Home Assistant**：URL + Token（孪生墙 / 控灯依赖）
2. **设置 → 展厅 Showroom**：
   - 四个 scene entity_id（welcome / present / demo / exit）
   - 拍照别名：`射灯: light.xxx`
   - 布局 JSON：`{"nodes":[{"id":"light.xxx","label":"射灯","x":20,"y":30}]}`
   - 可选远程：`remoteEnabled` + `accessKey`（改完重启桌面端）

## 页面

- `/twin.html` — 状态同步 + 焦点高亮
- `/panel.html` — Show Mode 大按钮
- `/wish.html` — 观众许愿 kiosk
- `/viz.html` — 工具调用可视化

健康检查：`GET /api/health`

## 远程展厅模式（注意）

- 仅建议**展厅局域网**或受控隧道；不要裸奔公网
- 开启后请求需带 `X-Showroom-Key` 或 `?key=`
- Hub 启动时读取绑定地址；改远程开关后需**完全重启**桌面端
- HA Token 仍只存在于本机 DSH settings；Hub 代理 `/api/ha/states` 只读状态

## 非目标

- 内置 ASR / 桌面麦克风（后续可选壳层能力）
- 自动修复危险设备
- NSIS 差量 OTA（与展厅弱相关，仍用 ZIP OTA）
