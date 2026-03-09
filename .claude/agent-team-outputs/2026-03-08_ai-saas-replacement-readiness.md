# AI替代SaaS手操 — 系统完善度评估报告

**日期**: 2026-03-08
**综合评分**: 65/100
**目标**: 非常高效的AI替代SaaS手操
**模式**: Full | 3 Researchers + Analyst + Critic + Integrator

---

## Executive Summary

系统拥有~301个Tool、17个域、~400意图的庞大AI意图识别引擎，查询能力成熟(92分)，安全防护完善(90分)。但距离"AI替代SaaS手操"仍有明显差距：采购/调拨/退货无写操作，翻页/续接是空壳，前端仅纯文本+按钮，Slot Filling依赖LLM隐式推断而非结构化收集。**当前定位为"AI辅助查询+部分写操作工具"，非"SaaS替代"。**

---

## 评分矩阵

| 维度 | 得分 | 说明 |
|------|------|------|
| 意图识别引擎 | 88/100 | 17域、400意图、4528短语、E2E 379组测试 |
| 查询覆盖 | 92/100 | 31个领域均有查询Tool |
| 写操作覆盖 | 55/100 | 生产/物料/质检/CRM有，采购/调拨/退货/财务/排班缺失 |
| Slot Filling | 50/100 | LLM parametersSchema全覆盖但缺交互式多轮收集 |
| 上下文连续性 | 20/100 | 5轮对话+指代消解有，但翻页/续接空壳 |
| 前端交互 | 35/100 | 纯文本+suggestedActions+REDIRECT，无表格/卡片/图表 |
| 安全防护 | 90/100 | TCC令牌+权限+OOD双层+6层行为校准 |
| 多轮对话 | 82/100 | ConversationService成熟但续接不工作 |
| 反馈闭环 | 75/100 | FeedbackWidget+ActiveLearning已有 |
| **综合** | **65/100** | 置信度80% |

---

## 全员共识（代码验证通过）

| 结论 | 证据 |
|------|------|
| ContextContinueTool和PaginationNextTool是空壳 | doExecute()仅返回固定提示文字 |
| 采购/调拨/退货仅有查询Tool(各3个)，无写操作 | purchase/transfer/returnorder目录验证 |
| 财务模块全部只读 | finance/目录6个Tool全为分析类 |
| Tool-only架构迁移完成 | service/handler/已不存在 |
| 前端无富组件展示 | AIChatScreen仅Text+按钮 |
| Wave-11已正确部署 | RESTAURANT域+DOMAIN_TOOL_PREFIXES+OOD修复 |

## 分歧与修正

| 议题 | Analyst | Critic | 最终 |
|------|---------|--------|------|
| 写Tool数量 | 59 | ~85 | 采用~85，stub比例未知 |
| Slot Filling评分 | 35 | 48 | 50 (LLM parametersSchema算半覆盖) |
| 综合评分 | 61 | 67 | 65 |

---

## 确认的架构问题

### P0 — 致命缺陷（不修则无法"替代SaaS"）

1. **翻页/续接空壳** — ContextContinueTool.java:49-55, PaginationNextTool.java:49-55
   - 用户说"继续"/"下一页"得到无用提示
   - 修复: 注入ConversationMemoryService，读取lastToolName+lastParams
   - 工期: ~1周

2. **采购/调拨/退货写操作缺失** — purchase/transfer/returnorder各仅3个查询Tool
   - 修复: 每个域新增Create/Update/Delete Tool
   - 工期: ~2周

3. **写Tool真实性审计** — 85个写Tool中stub比例未知
   - 修复: 逐一检查doExecute()是否调用Repository/Service
   - 工期: ~2天

### P1 — 显著影响体验

4. **前端富组件缺失** — AIChatScreen.tsx仅纯文本
   - 修复: 添加表格/卡片/图表渲染组件
   - 工期: ~3周

5. **意图准确率95%→98%** — PURCHASE_ORDER_QUERY孤立, CATEGORY_ALIAS_MAP缺失
   - 修复: 补短语+添加别名映射
   - 工期: ~1周

6. **Slot Filling交互增强** — 缺少必填参数时报错而非追问
   - 修复: AbstractBusinessTool层添加clarification逻辑
   - 工期: ~2周

### P2 — 打磨优化

7. 语音集成到主AI聊天 (讯飞SDK已有，AIChatScreen缺麦克风按钮)
8. SmartBI与AI聊天统一入口 (后端已路由，前端分离)
9. dataop与业务Tool去重
10. Skill层6个残留文件清理
11. 310个Tool的LLM选择准确率监控

---

## 提升路径

| 里程碑 | 目标分 | 关键交付 | 预估 |
|--------|--------|----------|------|
| M1: 止血 | 72 | 翻页/续接修复 + 写Tool审计 + ALIAS_MAP修复 | 2周 |
| M2: 补能力 | 78 | 采购/调拨/退货写操作 + Slot交互增强 | +4周 |
| M3: 体验对齐 | 85 | 前端富组件 + 语音集成 + SmartBI统一入口 | +4周 |
| M4: 全面替代 | 90+ | 财务/排班写操作 + Tool去重 + 向量预计算 | +4周 |

---

## 开放问题

1. 写Tool stub比例 — 直接影响"写操作覆盖"评分
2. GUARD/EXCLUDE机制仅7处引用 — 是否足以防危险操作？
3. 310 Tool规模下LLM选择准确率 — 有无生产数据？
4. "AI替代SaaS"量化标准 — 80%操作可AI？还是100%？
5. 排班模块SchedulingExecuteTool — 是否为stub？

---

## Process Note

- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: 60+ files, 161 tool uses
- Key disagreements: 3 resolved (写Tool数量、Slot评分、综合分), 1 unresolved (stub比例)
- Phases: Research (parallel×3) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (核心声明由Critic代码验证覆盖)
- Healer: All 4 checks passed ✅
- Competitor profiles: N/A
