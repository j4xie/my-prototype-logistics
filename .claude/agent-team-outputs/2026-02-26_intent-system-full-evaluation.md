# 意图识别系统全面评估：端到端链路 + 执行质量 + 覆盖范围

> 生成时间: 2026-02-26 | Agent Team: Full Mode | 4 阶段完整流水线
> 基于 3次E2E测试（1181用例×3轮 = 3543次执行）

---

## Executive Summary

- **总体评估**: 意图识别系统已达生产级水准，3轮E2E测试显示准确率98.4-99.3%、通过率99.6-100%，核心链路稳定可靠
- **关键风险**: 分析师报告中2项核心建议（PHRASE扩充、OUT_OF_DOMAIN兜底）被Critic以代码证据证伪，实际瓶颈在路由分类层而非Handler缺失或短语库不足
- **真正瓶颈**: (1) DashScope无重试机制是唯一经全员确认的生产风险 (2) 194-195条稳定UNMATCHED需逐条分类以区分预期N/A与真实缺陷 (3) 边缘输入（方言、极短、否定句）脆弱性需针对性加固
- **投入估算**: 高优先级修复约2-3人天（DashScope重试+路由排查+UNMATCHED分类），低风险可渐进推进
- **置信度**: 高（3位研究员代码级验证一致，Critic修正后结论更可靠）

---

## Consensus & Disagreements

| 主题 | 研究员发现 | 分析师建议 | Critic挑战 | 最终裁定 |
|------|-----------|-----------|-----------|---------|
| PHRASE_MATCH覆盖率 | 3636条短语映射265意图，置信度0.98快速通道 | 称覆盖率<30%需3-5天扩充 | **代码证伪**: 3636/3653=99.5%，分析师混淆了"短语库覆盖率"与"PHRASE命中率" | **Critic正确**。短语库本身覆盖充分，问题在于精确匹配无法覆盖自然语言变体，不应盲目扩充短语库 |
| OUT_OF_DOMAIN兜底 | "帮我写邮件"未路由到OUT_OF_DOMAIN | 建议0.5天添加兜底Handler | **代码证伪**: SystemIntentHandler已有完整OUT_OF_DOMAIN处理逻辑 | **Critic正确**。Handler已存在，真正问题在路由层未将该输入分类到OUT_OF_DOMAIN，应排查分类逻辑 |
| DashScope无重试 | 研究员B确认IOException直接返回errorResponse | P2优先级1天添加重试 | **代码确认**: 无重试机制属实 | **全员共识**。唯一经三方一致确认的生产级风险 |
| CachedThreadPool OOM | SSE使用120s硬编码+无界线程池 | 列为中风险 | 单工厂单租户+有限用户，风险被高估 | **Critic合理**。当前规模下实际风险低，作为扩展性备忘 |
| 可观测性 | E2E测试仅记录matchMethod，不采集分层延迟 | P0最高优先级2-3天 | 系统已有15+ AtomicLong计数器，只是E2E测试未采集 | **部分共识**。需补充采集而非从零搭建，实际约0.5-1天 |
| 194-195条UNMATCHED | 跨3轮稳定，6大模式 | 需全面回归 | 部分测试用例expected含N/A，不全是缺陷 | **需逐条分类**。区分"预期不支持"与"意外未匹配" |

---

## Detailed Analysis

### 1. 端到端链路架构

**4层串行识别链路**:
```
用户输入 → Layer0(detectQuestionType, 4级判断+操作指示词保护)
        → PHRASE_MATCH(3636条精确匹配, 置信度0.98, <1ms)
        → CLASSIFIER(ONNX via Python 8083, ~0.85, 依赖在线)
        → SEMANTIC(gRPC 9090, 当前已禁用, 降级到LLM)
        → LLM_DISAMBIGUATION(DashScope, 500-1500ms, ~0.008元/请求)
```

**9关卡串行执行流水线**:
```
会话延续 → Layer0 → 语义缓存(命中可跳过全部后续)
        → 意图识别 → 二次确认 → 权限检查
        → 审批检查 → Drools规则 → SlotFilling → Handler执行
```

**2处LLM延迟热点**: ①CONVERSATIONAL直接调用LLM ②LLM_DISAMBIGUATION fallback

**关键代码文件**:
- `IntentKnowledgeBase.java:5681-5728` — Layer0判断逻辑
- `AIIntentServiceImpl.java:662-714` — PHRASE_MATCH通道
- `SemanticRouterServiceImpl.java:63-84` — 三级阈值路由
- `IntentExecutorServiceImpl.java:270-770` — 9关卡执行流水线

### 2. 执行质量

| 指标 | Run 1 | Run 2 | Run 3 | 评估 |
|------|-------|-------|-------|------|
| 意图识别 | 1172/1181 (99.2%) | 1173/1181 (99.3%) | 1162/1181 (98.4%) | 稳定，波动<1% |
| Phase 2 curated | 93/94, 94/94 acc | 93/94, 94/94 acc | 93/94, 94/94 acc | 完全一致 |
| Phase 2b PASS | 1176/1181 (99.6%) | 1176/1181 (99.6%) | 1181/1181 (100%) | 极稳定 |
| Phase 2b acceptable | 1177/1181 (99.7%) | 1181/1181 (100%) | 1181/1181 (100%) | 极稳定 |

**execute三级路由**: Tool架构 → 动态工具选择 → Handler fallback
**ResultFormatter**: 纯规则引擎+三级formattedText兜底（无LLM调用，零延迟风险）
**Handler模式**: 统一catch(Exception)+ErrorSanitizer脱敏，无子方法级超时

**Phase 2b FAIL集中模式**:
- AA11: 方言表达（"搞得定不"、"今个儿"）
- AA4: 质检员视角无对应意图（"留样记录"、"理化指标"）
- AA6: 复合写入type分类错误（"停掉设备然后提交故障报告"）

### 3. 覆盖范围（13大业务领域）

| 领域 | 意图数 | 代表意图 |
|------|--------|---------|
| 发货/物流 | ~12 | SHIPMENT_QUERY, SHIPMENT_CREATE, SHIPMENT_EXPEDITE |
| 仓库/原料 | ~15 | MATERIAL_BATCH_QUERY, REPORT_INVENTORY, MATERIAL_LOW_STOCK_ALERT |
| 生产/加工 | ~14 | PROCESSING_BATCH_CREATE, PRODUCTION_STATUS_QUERY, REPORT_PRODUCTION |
| 质检 | ~10 | QUALITY_CHECK_QUERY, QUALITY_DISPOSITION_EXECUTE |
| 告警 | ~10 | ALERT_LIST, EQUIPMENT_ALERT_LIST |
| 设备 | ~12 | EQUIPMENT_STATUS_QUERY, EQUIPMENT_MAINTENANCE |
| 电子秤/IoT | 6 | SCALE_READ, SCALE_TARE |
| HR/考勤 | ~12 | ATTENDANCE_TODAY, ATTENDANCE_STATS, CLOCK_IN |
| 报表/统计 | ~14 | REPORT_DASHBOARD_OVERVIEW, REPORT_TRENDS, REPORT_KPI |
| 供应商 | 6 | SUPPLIER_QUERY, SUPPLIER_CREATE |
| 客户/CRM | 6 | CUSTOMER_STATS, CUSTOMER_QUERY |
| 订单 | ~10 | ORDER_LIST, ORDER_NEW, ORDER_FILTER |
| 溯源 | 3 | TRACE_QUERY, TRACE_PUBLIC |
| 财务 | ~8 | REPORT_FINANCE, COST_QUERY |
| 食品知识 | 1 | FOOD_KNOWLEDGE_QUERY（承载全部咨询） |
| 系统配置 | ~6 | SCHEDULING_SET_AUTO, FACTORY_FEATURE_TOGGLE |

### 4. UNMATCHED分析（194-195条，跨3轮稳定）

| 类别 | 数量 | 示例 | 性质 | 建议 |
|------|------|------|------|------|
| 系统导航/UI操作 | ~8 | 密码重置、布局配置、权限管理 | 超出AI意图系统范围 | 标记为"超范围" |
| 餐饮/门店BI | ~9 | 菜品查询、营业额、时段客流 | 整个领域空白 | 产品决策，非技术债 |
| ISAPI高级操作 | ~6 | 流媒体、订阅推送、网络诊断 | 功能尚未实现 | 列入后续规划 |
| 质检处置+排班写操作 | ~10 | 挂起/特批/报废/条件放行 | **应修复** — 有业务价值 | 补充意图+短语映射 |
| 多轮对话/上下文 | ~6 | 意图转折、垃圾输入、重复词 | 架构限制 | 中长期改进 |
| 采购写操作+员工删除 | ~8 | 有意图码但短语映射空 | **应修复** — 已有意图码 | 补充短语映射 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 系统整体已达生产级（>98%准确率, >99.6%通过率） | ★★★★★ | 3轮数据一致，全员认可 |
| DashScopeClient需添加重试机制 | ★★★★★ | 代码确认无重试 |
| PHRASE短语库覆盖充分（99.5%） | ★★★★★ | 3636/3653代码证据 |
| OUT_OF_DOMAIN Handler已存在 | ★★★★★ | SystemIntentHandler代码验证 |
| 194-195 UNMATCHED需逐条分类 | ★★★★☆ | 部分expected含N/A |
| 边缘输入是主要薄弱点 | ★★★★☆ | Phase 2b FAIL数据支持 |
| CachedThreadPool OOM当前可忽略 | ★★★★☆ | 单租户规模分析 |
| 语义缓存可能影响E2E一致性 | ★★★☆☆ | 合理假设，未验证 |

---

## Actionable Recommendations

### Immediate（本周内，~2天）

1. **DashScope重试机制** — 在`DashScopeClient.java`中为chatCompletion添加指数退避重试（最多3次，1s/2s/4s），对IOException和5xx重试。预计0.5-1天。
   - 文件: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/client/DashScopeClient.java`

2. **排查"帮我写邮件"路由问题** — 追踪该输入在识别链路中被分类到了哪里（Layer0拦截？CLASSIFIER误分类？），修复使其路由到已存在的OUT_OF_DOMAIN handler。预计0.5天。
   - 文件: `IntentExecutorServiceImpl.java`, `AIIntentServiceImpl.java`

3. **UNMATCHED逐条分类** — 对194-195条逐条标注"超范围/领域规划中/应修复"，建立基线。预计0.5天。
   - 输入: `/tmp/e2e-v26k-run2.txt`, `/tmp/e2e-v26k-run3.txt`

### Short-term（1-2周内，~3天）

4. **E2E测试采集分层延迟** — 利用系统已有的AtomicLong计数器（SemanticRouter/EmbeddingCache/SemanticCache共15+个），在E2E测试中通过管理端点采集。预计0.5-1天。

5. **边缘输入加固** — 针对Phase 2b FAIL的3类模式（方言AA11、质检无意图AA4、复合写入AA6），在PHRASE_MATCH或CLASSIFIER层添加针对性处理。预计1-2天。

6. **补充"应修复"类意图映射** — 对有意图码但短语映射空的类别（采购写操作、质检处置等）补充映射。预计1-2天。

### Conditional（触发条件）

| 触发条件 | 动作 |
|----------|------|
| 用户规模扩展到多租户 | CachedThreadPool→有界线程池，SSE超时配置化 |
| CLASSIFIER层频繁降级 | 保障Python ONNX高可用，考虑本地化推理 |
| 决定覆盖餐饮/门店BI | 新建~9个意图码+短语映射+Handler |
| 生产日志显示边缘输入>20% | 引入错别字纠正层（编辑距离/拼音匹配） |

---

## Open Questions

1. 194-195条UNMATCHED中，"应修复"类别具体有多少条？
2. 语义缓存是否影响了E2E测试准确率？（建议清缓存跑第4轮验证）
3. 1181条测试用例与生产真实输入的分布差异有多大？
4. CLASSIFIER ONNX服务（Python 8083）的实际可用率是多少？
5. "帮我写邮件"未路由到OUT_OF_DOMAIN的根因是什么？

---

## Process Note

- **Mode**: Full
- **Researchers deployed**: 3（端到端链路、执行质量、覆盖范围）
- **Total sources**: 16+ 核心Java/Python文件 + 3轮E2E测试数据 + E2E测试脚本
- **Key disagreements**: 2 resolved（PHRASE覆盖率争议 — Critic代码证伪；OUT_OF_DOMAIN争议 — Critic代码证伪）, 1 unresolved（CachedThreadPool风险等级）
- **Phases completed**: Research (parallel ×3) → Analysis → Critique → Integration → Heal
- **Fact-check**: disabled（内部代码分析）
- **Healer**: All structural checks passed ✅
- **Critical corrections**: Critic发现分析师2个事实性错误（PHRASE覆盖率<30%→实际99.5%，OUT_OF_DOMAIN无兜底→实际已有Handler），显著改变了建议方向
