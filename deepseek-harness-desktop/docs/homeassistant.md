# Home Assistant 接入（桌面端内置）

桌面端同时提供 **原生 REST 插件** 与 **MCP 桥接**，可在「设置 → Home Assistant」配置。

## 方案 A：原生工具（推荐先开）

1. 在 HA 创建 **长期访问令牌**（个人资料页）
2. 桌面端打开 **设置 → Home Assistant**
3. 填写 URL（如 `http://homeassistant.local:8123`）与 Token
4. 勾选「启用 REST 工具」并保存

可用工具：

| 工具 | 作用 |
|---|---|
| `ha_list_entities` | 按域名/关键词列实体 |
| `ha_get_state` | 查单个实体状态 |
| `ha_get_states_summary` | 域名数量概览 |
| `ha_call_service` | 调用服务（如 `light.turn_on`） |

默认白名单：`light,switch,scene,script,input_boolean,climate,fan,media_player,cover,sensor,binary_sensor,weather`  
默认拦截危险域名：`lock` / `alarm_control_panel` 等（可在设置关闭）。

## 方案 B：MCP（ha-mcp）

适合已部署 [ha-mcp](https://github.com/homeassistant-ai/ha-mcp)（推荐 HA 自定义组件 / streamable-http）。

1. 在 HA 侧拿到 MCP URL（例如 `http://homeassistant.local:9584/mcp`）
2. 设置页勾选「启用 MCP 桥接」，填写 URL（及可选 Header）
3. **完全退出并重启桌面端**（MCP 挂在 cordis 启动层）

启动后模型会看到 `mcp__homeassistant__*` 工具（由 `@deepseek-ai/dsh-mcp-client` 发现）。

配置会写入 `$DSH_HOME/desktop-ha-mcp.json`，供下次启动写入 `cordis.patch.yml`。

> 不建议对同一 HA **同时**用原生写工具 + MCP 写工具，以免重复控制；可读可并存。

## 安全建议

- 最小白名单；门锁/报警默认拦截
- Token 只放在本机 DSH settings，勿提交仓库
- 远程 HA 请用 HTTPS / VPN / Nabu Casa，勿裸奔公网

## 参考

- 插件代码：`plugins/dsh-homeassistant/`
- 上游 MCP：https://github.com/homeassistant-ai/ha-mcp
- DSH MCP 客户端：`@deepseek-ai/dsh-mcp-client`
