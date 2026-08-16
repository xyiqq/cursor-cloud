# 展厅能力规划（Showroom Roadmap）

面向展厅演示：看得见、听得懂、可上手、可控风险。  
关联已有能力：桌面端、图片理解（DSH-vison）、Home Assistant（原生 `ha_*` / MCP）、**展厅插件 `dsh-showroom`（v0.4）**。

详细用法见 [showroom.md](./showroom.md)。

---

## 语音要不要在 DSH 里做识别？

**结论：意图调用可以做；ASR（语音→文字）不必塞进 DSH 核心。当前版本明确暂缓。**

推荐链路：

```text
麦克风 → ASR（外置）→ 文本意图 → DSH（LLM + ha_* / showroom_*）→ HA 执行
                ↑
     可选：浏览器 Web Speech / Whisper 服务 / HA Assist / 手机端
```

| 层级 | 放哪 | 说明 |
|---|---|---|
| 语音识别 ASR | **外置（暂缓）** | 浏览器 Web Speech、本地 Whisper、云 ASR、HA Assist；DSH 只收文本 |
| 意图理解 | **DSH** | 自然语言 → 场景 / `showroom_*` / `ha_*` |
| 执行 | **HA** | 场景与实体；危险动作仍拦截 |

---

## 优先级与交付状态

### P0

| 功能 | 状态 |
|---|---|
| 拍照 / 指哪打哪控灯 | ✅ `showroom_vision_control` + 别名 |
| 数字孪生墙同步 | ✅ Hub + `twin.html`（轮询 HA + SSE 高亮） |
| 语音 → 意图（ASR） | ⏸ 暂缓 |

### P1

| 功能 | 状态 |
|---|---|
| Show Mode 四场景 | ✅ 工具 + `panel.html` |
| 工具调用可视化条 | ✅ `viz.html` |
| 多 Agent 角色切换 | ✅ `showroom_set_role` |
| 观众互动「许愿」 | ✅ `wish.html`（冷却；非桌面麦） |
| 桌面壳可选麦克风 | ⏸ 随 ASR 暂缓 |

### P2

| 功能 | 状态 |
|---|---|
| HA 报警 → 只读诊断 | ✅ `showroom_diagnose` |
| 讲解稿 / Skill 包 | ✅ `skills/showroom/` → `~/.dsh/skills/showroom` |
| 远程展厅模式 | ✅ 设置项 + 文档（密钥鉴权） |
| 差量 OTA / NSIS | ⏸ 仍用 ZIP OTA |

---

## 建议现场准备

1. HA 配好四场景 + 实体友好名/区域  
2. 桌面端设置别名与孪生布局 JSON  
3. 副屏打开孪生墙 / 可视化；展台平板打开许愿页  
4. 演示链路：拍照 → 控灯 → 大屏高亮  

---

## 非目标（展厅阶段明确不做）

- DSH 内置重量级离线 ASR 模型作为默认依赖  
- 7×24 全自动「发现 HA 问题就修」  
- 无白名单的锁 / 报警 / 车库门类自动控制  

---

## 状态总表

| 项 | 状态 |
|---|---|
| HA 原生工具 + MCP | ✅ v0.3.0 |
| 图片理解 | ✅ v0.2.1+ |
| ZIP OTA | ✅ v0.3.0 |
| 展厅 Showroom 插件 | ✅ **v0.4.0** |
| 语音 ASR | ⏸ 暂缓 |
