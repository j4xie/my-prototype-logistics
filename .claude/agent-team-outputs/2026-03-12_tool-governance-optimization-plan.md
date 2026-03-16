# 白垩纪 300+ Tools 治理架构评估与优化计划

**生成日期**: 2026-03-12
**Agent Team Mode**: Full (3 Researchers + Analyst + Critic + Integrator)
**总来源数**: 25+ (13 codebase evidence, 12+ external papers/docs)

---

## 一、执行摘要

白垩纪项目当前注册 **318 个 Tool**，分布在 **35 个域目录**中，采用 7 层意图路由 + D8v2 域前缀过滤架构。经代码验证，系统的运行时治理能力（域过滤将 LLM 可见工具限制在约 35 个以内）被初步分析低估，但架构层面存在可量化的冗余（alert 域 9 个 Tool 中至少 3 个调用相同 Service 方法仅预设不同参数）。综合成熟度评分：**6.25/10**。短期优先级应聚焦 DOMAIN_TOOL_PREFIXES 配置补全（10 行代码改动、零数据库迁移），而非大规模工具合并。

---

## 二、架构成熟度评分

| 维度 | 评分 | 评价 |
|------|------|------|
| 注册机制 | 7/10 | ConcurrentHashMap + 冲突检测 + isEnabled() + MCP 外部注册，功能完备 |
| 命名规范 | 8/10 | `{domain}_{action}` 全局一致，31 个领域包清晰 |
| 检索/过滤 | 7/10 | D8v2 域过滤 + 向量检索 + ArenaRL 歧义裁决，超出简单注册表水平 |
| 冗余控制 | 5/10 | alert/scheduling 存在可量化冗余，BehaviorCalibration 采集数据但无自动化 |
| 膨胀风险 | 6/10 | 7 层路由隔离了原始数量影响，但无新增 Tool 门控流程 |
| 生命周期 | 4/10 | isEnabled() + ToolReliabilityStats 覆盖原型阶段需求，缺 version/owner |
| Skill 编排 | 8/10 | 3 层优先级（DB > file > code）、DAG 分支、13 内置 Skill |
| 可观测性 | 5/10 | 有 BehaviorCalibration 和日志，缺可视化仪表板 |
| **综合** | **6.25/10** | |

---

## 三、共识结论（团队一致认同）

| 编号 | 结论 | 置信度 |
|------|------|--------|
| C1 | 7 层路由 + D8v2 域过滤是有效运行时缓解方案，LLM 实际仅见约 33-39 个工具 | 95% |
| C2 | alert 域存在冗余：`alert_list`/`alert_active`/`alert_by_level`/`alert_by_equipment` 调用同一 `getAlertList()` | 95% |
| C3 | `report_` 前缀下 33 个工具跨多域，但 FINANCE 域已有 `report_finance`/`report_cost` 精细前缀先例 | 90% |
| C4 | `progressiveDiscovery()` 仅执行向量预过滤截断，未实现 LLM 精选第二阶段 | 95% |
| C5 | ToolExecutor 接口缺少生命周期元数据 | 90% |
| C6 | Skill 编排层成熟度高，无需重建 | 95% |

---

## 四、分歧调和

### 分歧 1：Alert Tool 合并方案

| 观点 | 来源 | 结论 |
|------|------|------|
| P0, 合并 4→1 | Analyst | ❌ 过于激进 |
| P1, 合并 5→2 | Critic | ✅ 部分采纳 |

**最终方案**: P1 优先级。保留 `alert_list`（通用查询）和 `alert_active`（高频+urgencyAnalysis）；废弃 `alert_by_level` 和 `alert_by_equipment`，将富化逻辑合入 `alert_list`。9 个 alert Tool → 7 个。

### 分歧 2：318 工具是否面临 LLM 退化

| 观点 | 来源 | 结论 |
|------|------|------|
| 逼近退化阈值 | Analyst | ❌ 不适用 |
| <5% 风险，域过滤已解决 | Critic | ✅ 采纳 |

**最终判断**: D8v2 已将 LLM 可见工具限制在 ~35 个，远低于 OpenAI 的 100 工具安全线。318 个总量在当前架构下不构成风险。设置 **350 软上限告警**即可。

### 分歧 3：生命周期管理紧迫程度

| 观点 | 来源 | 结论 |
|------|------|------|
| SEVERE (2/10) | Analyst | ❌ 过度估计 |
| Medium (4/10) | Critic | ✅ 采纳 |

**最终判断**: 单团队原型阶段，isEnabled() + ToolReliabilityStats 够用。在 400+ 工具或多团队协作时再引入完整生命周期。

### 分歧 4：Report 前缀处理

| 观点 | 来源 | 结论 |
|------|------|------|
| P0, 重命名工具 | Analyst | ❌ 过重 |
| P0, 仅扩展 DOMAIN_TOOL_PREFIXES | Critic | ✅ 采纳 |

**最终方案**: 在 `LlmIntentFallbackClientImpl.java:198-215` 中添加 `report_quality`/`report_production`/`report_equipment` 到对应域。约 10 行代码，零工具重命名，零数据库迁移。

---

## 五、分级行动计划

### P0 — 立即执行（1 周）

#### P0-1: DOMAIN_TOOL_PREFIXES 精细前缀补全

| 项目 | 内容 |
|------|------|
| **文件** | `LlmIntentFallbackClientImpl.java` 第 198-215 行 |
| **改动量** | ~10 行代码 |
| **具体操作** | 为 QUALITY/PROCESSING/EQUIPMENT 域添加 `report_quality`/`report_production`/`report_equipment` 等精细前缀 |
| **风险** | 极低（仅影响 LLM Fallback 路径工具过滤范围） |
| **验证** | `tests/intent-routing-e2e-150.py --prod` 确认路由准确率不降 |
| **置信度** | 90% |

补全建议：
```java
// QUALITY 域追加
"report_quality", "report_ai_quality"

// PROCESSING 域追加
"report_production", "report_efficiency", "report_oee", "report_workshop"

// EQUIPMENT 域追加
"report_equipment"

// HR 域追加
"report_attendance", "report_online_staff", "report_task_assign"
```

---

### P1 — 短期优化（2-4 周）

#### P1-1: Alert 查询工具合并 (9 → 7)

| 项目 | 内容 |
|------|------|
| **操作** | 废弃 `AlertByLevelTool`/`AlertByEquipmentTool`，将富化逻辑迁入 `AlertListTool.doExecute()` |
| **改动文件** | `AlertListTool.java`（添加条件富化）、`AlertByLevelTool.java`/`AlertByEquipmentTool.java`（`isEnabled()→false`） |
| **数据库** | 更新 `ai_intent_config` 中绑定 `alert_by_level`/`alert_by_equipment` 的意图 → `alert_list` |
| **风险** | 中（需验证 LLM 选择不受影响） |
| **置信度** | 70% |

#### P1-2: tool_metadata 元数据表

| 项目 | 内容 |
|------|------|
| **目的** | 为工具审计奠定基础，不改 ToolExecutor 接口 |
| **方案** | 新建 `tool_metadata` 表（tool_name, domain, owner, created_at, deprecated_at, notes） |
| **改动** | 新建 entity + repository + `@PostConstruct` 初始化 |
| **风险** | 低（纯新增，不影响现有流程） |
| **置信度** | 85% |

#### P1-3: Scheduling 工具评估合并

| 项目 | 内容 |
|------|------|
| **现状** | `scheduling_set_auto`/`scheduling_set_manual`/`scheduling_set_disabled` 仅 mode 值不同 |
| **方案** | 合并为 `scheduling_set_mode`，添加 `mode` 枚举参数 |
| **预计减少** | -2 个工具 |

---

### P2 — 中期演进（4-8 周）

#### P2-1: progressiveDiscovery 第二阶段实现

| 项目 | 内容 |
|------|------|
| **前提** | 仅在监控数据表明 ToolRouter 误选率 > 5% 时启动 |
| **方案** | 向量预过滤 top-15 → LLM 精选 top-5 |
| **文件** | `ToolRouterService.java:178-189` |
| **置信度** | 60% |

#### P2-2: 工具使用仪表板

| 项目 | 内容 |
|------|------|
| **目的** | 可视化工具调用频次/成功率/延迟/最后调用时间 |
| **数据源** | `ToolReliabilityStats` + `BehaviorCalibrationService` |
| **方案** | 新增 `/api/admin/tool-metrics` API + web-admin 页面 |
| **置信度** | 75% |

---

### P3 — 长期演进（规模倍增时）

| 项目 | 触发条件 | 说明 |
|------|---------|------|
| 多 Agent 域隔离 | 工具 > 500 或多团队 | 将 Tool 按域分组到独立 Agent |
| 完整生命周期管理 | 工具 > 400 或多团队 | 4 阶段（Draft→Active→Deprecated→Archived）|
| 3 级 Schema 延迟加载 | MCP 外部工具 > 50 | name-only / name+desc / full schema |
| 工具发布审批流 | 多团队协作 | CI 检查 + 向量相似度去重 |

---

## 六、决策框架：何时合并 vs 何时保留独立工具

```
是否调用相同的 Service 方法？
├─ 是 → 差异是否仅在预设参数值（如 status="ACTIVE"）？
│       ├─ 是 → ✅ 合并：将预设值改为参数化
│       └─ 否 → 差异是否在后处理逻辑？
│               ├─ 是，且后处理 < 20 行 → ✅ 合并：用 flag 参数控制
│               └─ 否 → ❌ 保留独立
├─ 否 → 工具描述的向量余弦相似度 > 0.85？
│       ├─ 是 → ⚠️ 高碰撞风险：重写 description 使语义分离
│       └─ 否 → 检查 Temporal 拆分条件：
│               ├─ 不同 retry 策略 → ❌ 保留独立
│               ├─ 不同权限边界 → ❌ 保留独立
│               ├─ 不同事务边界 → ❌ 保留独立
│               └─ 以上均无 → ✅ 考虑合并为参数化工具
```

**关键原则**（来自 Anthropic Engineering Blog）：
> "Rather than creating a separate tool for every action, group them into a single tool with an action parameter."

**Temporal 补充原则**：
> "Split Activities only when retry boundaries, worker routing, or billing needs differ."

---

## 七、6 个月路线图

| 月份 | 里程碑 | 工具数 | 关键指标 |
|------|--------|--------|---------|
| M1 | DOMAIN_TOOL_PREFIXES 补全 + 监控基线 | 318 | LLM Fallback 域内工具 ≤ 15 |
| M2 | Alert 合并 + tool_metadata 表 | 316 | 告警意图准确率不降 |
| M3 | Scheduling 合并 + 冗余审计 | 314 | 审计覆盖全部 35 域 |
| M4 | progressiveDiscovery Phase 2（条件触发） | 314 | ToolRouter 误选率 < 3% |
| M5 | 工具使用仪表板上线 | 314 | 可视化覆盖全部注册工具 |
| M6 | 350 软上限告警 + 季度审计制度化 | < 350 | 无 zombie 工具（90天零调用） |

---

## 八、已验证的代码级事实

| 项目 | 验证结果 | 关键文件 |
|------|---------|---------|
| 工具总数 | 318 个 .java 文件在 `ai/tool/impl/` 下 | `ToolRegistry.java` |
| 域目录数 | 35 个子目录 | `ai/tool/impl/` |
| Alert 查询冗余 | 5 个工具调用 `getAlertList()`（非 Analyst 说的 4 个） | `alert/Alert*Tool.java` |
| D8v2 域过滤 | 14 个域映射 + 3 个元工具前缀 | `LlmIntentFallbackClientImpl.java:198-221` |
| FINANCE 已有精细前缀 | `"report_finance"`, `"report_cost"`, `"report_bom"`, `"conversion_"` | `LlmIntentFallbackClientImpl.java:213` |
| progressiveDiscovery 缺 LLM 精选 | default 实现仅 `subList(0, finalTopK)` | `ToolRouterService.java:178-189` |
| Scheduling 枚举膨胀 | 3 个 Tool 仅 mode 值不同 | `scheduling/SchedulingSet*.java` |
| Skill 3 层优先级 | DB > file > code | `SkillRegistryImpl.java:60-99` |
| ToolReliabilityStats | 按 (factory_id, tool_name, stat_date) 追踪成功率 | `ToolReliabilityStats.java` |
| BehaviorCalibration | ET-Agent 论文驱动，计算 conciseness/success/efficiency | `BehaviorCalibrationService.java` |

---

## 九、开放问题

1. **INVENTORY/MATERIAL 域前缀重叠**：两者均映射到 `"material_"` 前缀（第 204/209 行），需确认是否符合设计意图
2. **ToolReliabilityStats 自动化程度**：统计数据是否被用于自动降级或告警？
3. **Report 工具中的 Stub 实现**：33 个 report 工具中有多少是占位实现？
4. **LLM Fallback 实际触发比例**：需生产监控确认（预估 <5%）
5. **MCP 外部工具注册**：`registerExternal()` 是否有实际使用？

---

## 十、参考来源

### 学术论文
- ToolLLM: Facilitating LLMs to Master 16000+ APIs (ICLR 2024) — arXiv 2307.16789
- ToolScan: Characterizing Errors in Tool-Use LLMs — arXiv 2411.13547
- ToolRegistry: Protocol-Agnostic Tool Management — arXiv 2507.10593
- ET-Agent: Behavior Calibration — arXiv 2601.06860
- Tool-to-Agent Retrieval — arXiv 2511.01854

### 行业文档
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic: Writing Effective Tools for AI Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic MCP Platform Docs](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [LangGraph BigTool](https://github.com/langchain-ai/langgraph-bigtool)
- [Temporal: How Many Activities](https://temporal.io/blog/how-many-activities-should-i-use-in-my-temporal-workflow)
- [Microsoft Agent 365 Governance](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization)
- [AWS: Semantic Tool Selection](https://dev.to/aws/reduce-agent-errors-and-token-costs-with-semantic-tool-selection-7mf)

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (sonnet)
- Browser explorer: OFF
- Total sources found: 25+
- Key disagreements: 4 resolved (alert merge scope, tool count risk, lifecycle urgency, report prefix fix)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (claims primarily codebase-grounded)
- Healer: All checks passed ✅
- Competitor profiles: N/A
