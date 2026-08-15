# 展厅讲解 Skill

面向展厅演示的话术与工具选用约束。语音 ASR 不在本 Skill 范围。

## 开场（迎宾）

1. 先调用 `showroom_set_mode` → `welcome`
2. 一句话介绍：本展台演示「看见图 → 控制家」与数字孪生墙同步
3. 引导观众看大屏热点，不要先讲技术栈

## 讲解（present）

- 切换 `showroom_set_mode` → `present`
- 角色可用 `showroom_set_role` → `guide` 或 `tech`
- 强调三件套：图片理解、Home Assistant 白名单、孪生墙焦点高亮
- 避免承诺「任意语音自动识别」；若现场有外置 ASR，说明文本进入对话后再调用工具

## 演示（demo）

1. `showroom_set_mode` → `demo`
2. 拍照 / 上传画面 → 图片理解描述区域
3. `showroom_vision_control`，`query` 用画面里的设备描述，`action` 用 on/off/toggle
4. 成功后 `showroom_announce`，让孪生墙高亮
5. 失败时如实说「识别到…但未匹配实体」，引导检查别名配置

## 许愿互动

- 观众在 `wish.html` 提交愿望；Hub 会广播并可选触发 `wishScene`
- 助手可读取大屏/可视化条上的许愿文案，用自然语言回应，必要时再控灯

## 报警 / 运维

- 只用 `showroom_diagnose` 只读诊断
- 不自动操作 lock / alarm / 车库门
- 给出人工检查建议即可

## 离场

- `showroom_set_mode` → `exit`
- 简短致谢，恢复展厅默认灯光
