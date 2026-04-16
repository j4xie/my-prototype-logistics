# 30. AI 意图配置 + Skill/Tool 治理 + 校准中心

**路由**: `/system/ai-intents` + `/system/skill-tools` + `/calibration`
**涉及角色**: admin (需平台级权限)
**耗时**: 20 min

---

## 30.1 模块总览

| 模块 | URL |
|------|-----|
| AI 意图配置 | `/system/ai-intents` |
| Skill/Tool 治理 | `/system/skill-tools` |
| 行为校准管理 | `/calibration` |
| 动态模块配置 | `/modules/:moduleCode` |

---

## 30.2 AI 意图配置 (`/system/ai-intents`)

### 背景
系统有 337+ Tool + 16 Skill, **意图**是自然语言触发的入口 (用户说"查询库存" → 匹配 INVENTORY_QUERY 意图)

### 30.2.1 意图列表
- 列表显示所有意图
- 字段: intentCode / intentName / category / tool_name 绑定 / 关键词 / 是否激活

### 30.2.2 新建意图
1. 点 "新建"
2. 字段:
   - 意图编码 (唯一): `MY_NEW_INTENT`
   - 意图名: `新功能`
   - 分类 category
   - 绑定 tool (下拉 337+): 选
   - 关键词 (JSON array): `["关键词1", "关键词2"]`
   - 短语映射 (可选)
   - 示例语句 (多行)
   - 敏感级别: LOW/MEDIUM/HIGH
   - 是否激活

### 30.2.3 编辑 / 禁用
- 禁用后 AI 不再匹配

### 30.2.4 意图测试
- 输自然语言问题
- 系统返回识别到的意图 + 置信度

---

## 30.3 Skill/Tool 治理 (`/system/skill-tools`)

### 30.3.1 Tool 列表
- 337+ tool 分页显示
- 按领域筛选 (camera/crm/dataop/finance/...)
- 字段: tool_name / description / parametersSchema / 状态

### 30.3.2 Tool 详情
- 点查看参数 schema
- 测试执行 (沙盒)

### 30.3.3 Skill 列表
- 16 内置 + 数据库 SmartBiSkill
- 字段: skillName / tools[] / 配置

### 30.3.4 Skill 执行追踪
- 每次 Skill 调用日志
- Tool 执行成功率 / 平均耗时

---

## 30.4 校准中心 (`/calibration`)

### 30.4.1 Tool 调用追踪
- 列表显示 AI 推荐的 tool + 用户反馈
- 筛选: 时间 / Tool / 正确/错误

### 30.4.2 反馈采样
- 每次 AI 调用 tool, 用户点 👍👎 反馈
- 校准中心查看 tool 可靠性

### 30.4.3 意图分类器调优
- 查看分类器 (BERT) 置信度分布
- 低置信度样本 → 人工打标签 → 重训

### 30.4.4 统计
- Tool 成功率 trend
- 意图 top mismatches

### 30.4.5 历史
- 校准 session 记录

---

## 30.5 动态模块配置 (`/modules/:moduleCode`)

### 30.5.1 Canvas V3 动态模块
- 17 节测过 Canvas 编辑器, 这里是**具体运行时**
- 访问: `/modules/sales_order` / `/modules/custom_module_1`

### 30.5.2 动态字段渲染
- 显示 Canvas 配置的字段
- 必填/校验/联动全按配置

### 30.5.3 动态表单提交
- 验证配置生效

---

## 30.6 本节 Checklist (15 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | 30.2.1 意图列表加载 | ☐ |
| 2 | 30.2.2 新建意图 | ☐ |
| 3 | 30.2.3 编辑/禁用 | ☐ |
| 4 | 30.2.4 意图测试 | ☐ |
| 5 | 30.3.1 Tool 列表 337+ | ☐ |
| 6 | 30.3.2 Tool 参数 schema | ☐ |
| 7 | 30.3.3 Skill 列表 16+ | ☐ |
| 8 | 30.3.4 Skill 执行日志 | ☐ |
| 9 | 30.4.1 调用追踪 | ☐ |
| 10 | 30.4.2 反馈采样 | ☐ |
| 11 | 30.4.3 分类器调优 | ☐ |
| 12 | 30.4.4 统计报表 | ☐ |
| 13 | 30.5.1 动态模块访问 | ☐ |
| 14 | 30.5.2 字段渲染正确 | ☐ |
| 15 | 30.5.3 表单提交 | ☐ |
