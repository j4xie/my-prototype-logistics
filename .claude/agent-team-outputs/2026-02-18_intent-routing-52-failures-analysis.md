# 意图路由 311 用例 E2E 测试 — 52 失败案例深度分析

**日期**: 2026-02-18
**测试结果**: 259/311 (83%), 52 failures

---

## Executive Summary

在52个失败用例分类中，**配置缺失(B类)和架构限制(A类)共占62%**。关键发现：
- **B类规模被高估5-6例**：LEAVE_APPROVAL等intent在代码库不存在，应归C类(测试期望不合理)
- **A类核心是matchPhrase覆盖写入意图**：v22.0 pre-check已部分缓解，纯架构限制仅6-8例
- **建议优先扩展现有v22.0机制**而非重构matchPhrase，避免引入第三套动词检测
- **时间估算严重低估**：实际需8-16小时(含intent存在性审计、两套映射合并)
- **高置信度方案**：B类新增phrase(2-4h) + A类扩展VERB_NOUN_MAPPINGS(1-2h) + C类改测试(1-2h)

---

## 修正后的分类统计

| 根因类别 | Analyst原始 | Critic修正 | 最终 | 占比 |
|---------|------------|-----------|------|------|
| **A-架构限制** (matchPhrase短路) | 14例 (27%) | 6-8例纯架构 + 8-10例归B | **6-8例** | 12-15% |
| **B-配置缺失** (缺phrase/CORE_NOUNS) | 18例 (35%) | 12-14例 + A类溢出 | **20-24例** | 38-46% |
| **C-测试期望不合理** (intent不存在/极模糊) | 9例 (17%) | 12-15例 | **12-15例** | 23-29% |
| **D-分类器训练不足** | 11例 (21%) | 部分归B | **5-8例** | 10-15% |

**关键修正**: B类是最大类别(包括CORE_NOUNS不完整的溢出)，但其中约1/3是"缺handler"而非仅"缺phrase"。

---

## Consensus & Disagreements

| 议题 | Researcher | Analyst | Critic | Final Verdict |
|------|-----------|---------|--------|--------------|
| B类真实规模 | 18例确认 | 18例推荐添加 | 12-14例 | **12-14例**(23-27%)，LEAVE_APPROVAL等不存在 |
| A类严重程度 | matchPhrase覆盖最严重 | 全量分类14例 | v22.0已部分覆盖 | **混合问题**：纯架构6-8例 + CORE_NOUNS不完整 |
| matchPhrase重构必要性 | 长流程短phrase覆盖低 | 可选优化 | **不必要** | **否**。优先扩展v22.0 pre-check |
| 两套并行映射维护 | 未深入 | 未提及 | **高风险** | 需要合并审计(后续) |
| C类范围 | 未评估 | 9例 | 9例+更多藏匿 | **确认9例 + 额外3-5例等价** |
| 时间估算 | 未估算 | 4-6h | **严重低估** | **修正为8-16h** |

---

## 52 个失败的详细分类

| # | 输入 | 期望intent | 实际结果 | 根因 | 修复建议 |
|---|------|-----------|---------|------|---------|
| 1 | 新建猪肉入库记录 | MATERIAL_BATCH_CREATE | MATERIAL_BATCH_QUERY | **A** | 扩展VERB_NOUN_MAPPINGS |
| 2 | 批次MB001的来源 | TRACE_BATCH | UNMATCHED | **A** | 字母数字打断子串匹配,需正则 |
| 3 | 原料成本趋势 | COST_TREND_ANALYSIS | REPORT_TRENDS | **B** | 添加"成本趋势"→COST_TREND |
| 4 | 利润趋势分析 | PROFIT_TREND_ANALYSIS | REPORT_TRENDS | **B** | 添加"利润趋势"→PROFIT_TREND |
| 5 | 资产收益率 | QUERY_FINANCE_ROA | UNMATCHED | **B** | 添加phrase映射 |
| 6 | 净资产回报率 | QUERY_FINANCE_ROE | UNMATCHED | **B** | 添加phrase映射 |
| 7 | 经营效益概览 | REPORT_BENEFIT_OVERVIEW | UNMATCHED | **B** | 添加phrase映射 |
| 8 | 在线员工数量 | QUERY_ONLINE_STAFF_COUNT | UNMATCHED | **B** | 添加phrase映射 |
| 9 | 查看员工资料 | QUERY_EMPLOYEE_PROFILE | REPORT_DASHBOARD_OVERVIEW | **B** | 添加"员工资料"phrase |
| 10 | 张三工资 | SALARY_QUERY | UNMATCHED | **B** | 添加"工资"phrase |
| 11 | 异常考勤列表 | ATTENDANCE_ANOMALY | ALERT_LIST | **A** | "异常"→ALERT覆盖考勤上下文 |
| 12 | 帮我请假 | LEAVE_APPROVAL | UNMATCHED | **C** | LEAVE_APPROVAL不存在于代码库 |
| 13 | 批准请假 | LEAVE_APPROVAL | CLOCK_IN | **C** | LEAVE_APPROVAL不存在 |
| 14 | 删除员工 | HR_DELETE_EMPLOYEE | UNMATCHED | **B** | 添加phrase映射 |
| 15 | 分配任务给张三 | TASK_ASSIGN_WORKER | UNMATCHED | **B** | 添加phrase映射 |
| 16 | 释放预留牛肉 | MATERIAL_BATCH_RELEASE | UNMATCHED | **B** | 已有phrase("释放原料"),需检查 |
| 17 | 预留100kg鸡肉 | MATERIAL_BATCH_RESERVE | UNMATCHED | **B** | 添加"预留"phrase |
| 18 | 调整猪肉库存数量 | MATERIAL_BATCH_CONSUME | MATERIAL_BATCH_QUERY | **A** | 查询phrase覆盖写入 |
| 19 | 出库100kg牛肉 | INVENTORY_OUTBOUND | UNMATCHED | **B** | 添加"出库"phrase |
| 20 | 这个批次谁在操作 | PROCESSING_BATCH_WORKERS | UNMATCHED | **B** | 添加phrase映射 |
| 21 | 当前工序是哪一步 | QUERY_PROCESSING_CURRENT_STEP | UNMATCHED | **B** | 添加phrase映射 |
| 22 | 车间日报 | REPORT_WORKSHOP_DAILY | UNMATCHED | **B** | 添加phrase映射 |
| 23 | 工人下线 | PROCESSING_WORKER_CHECKOUT | UNMATCHED | **B** | 添加phrase映射 |
| 24 | 恢复暂停的批次 | PROCESSING_BATCH_RESUME | PROCESSING_BATCH_PAUSE | **D** | 语义路由反义错误 |
| 25 | 更新生产计划 | PLAN_UPDATE | UNMATCHED | **B** | 添加phrase映射 |
| 26 | 设备健康诊断 | EQUIPMENT_HEALTH_DIAGNOSIS | EQUIPMENT_STATUS_QUERY | **D** | 训练样本不足 |
| 27 | 设备故障报告 | EQUIPMENT_BREAKDOWN_REPORT | EQUIPMENT_STATUS_QUERY | **C** | 功能等价,可接受 |
| 28 | CCP监控数据 | CCP_MONITOR_DATA_DETECTION | UNMATCHED | **B** | 添加phrase映射 |
| 29 | 添加一台电子秤 | SCALE_ADD_DEVICE | SCALE_DEVICE_DETAIL | **A→B** | 扩展CORE_NOUNS+"电子秤" |
| 30 | 删除电子秤设备 | SCALE_DELETE_DEVICE | SCALE_DEVICE_DETAIL | **A→B** | 同上 |
| 31 | 更新电子秤配置 | SCALE_UPDATE_DEVICE | SCALE_DEVICE_DETAIL | **A→B** | 同上 |
| 32 | 设备维护完成 | EQUIPMENT_STATUS_UPDATE | EQUIPMENT_MAINTENANCE | **A** | 查询phrase覆盖写入 |
| 33 | 设备故障率趋势 | EQUIPMENT_TREND_ANALYSIS | EQUIPMENT_STATUS_QUERY | **D** | 分类器粒度不足 |
| 34 | 订单量增长趋势 | ORDER_TREND_ANALYSIS | UNMATCHED | **B** | 添加phrase映射 |
| 35 | 超长句-供应商 | SUPPLIER_RANKING | SUPPLIER_LIST | **A** | 超长句短phrase覆盖 |
| 36 | 超长句-考勤 | ATTENDANCE_STATS | 误路由 | **A** | HashMap迭代不确定 |
| 37 | 有什么问题吗 | ALERT_LIST | UNMATCHED | **C** | 极度模糊,UNMATCHED合理 |
| 38 | 帮我处理一下 | ALERT_ACKNOWLEDGE | QUALITY_DISPOSITION | **C** | 无具体对象 |
| 39 | 最新的情况 | REPORT_DASHBOARD_OVERVIEW | UNMATCHED | **C** | 极度模糊 |
| 40 | 还有什么要做的 | USER_TODO_LIST | UNMATCHED | **C** | 极度模糊 |
| 41 | 审批采购订单 | ORDER_APPROVAL | ORDER_LIST | **B** | 添加"审批"phrase |
| 42 | 提交审批 | APPROVAL_SUBMIT | UNMATCHED | **C** | APPROVAL_SUBMIT不存在 |
| 43 | 查看审批记录 | APPROVAL_HISTORY | REPORT_DASHBOARD_OVERVIEW | **C** | APPROVAL_HISTORY不存在 |
| 44 | 执行明天排班 | SCHEDULING_RUN_TOMORROW | SCHEDULING_LIST | **A→B** | 扩展CORE_NOUNS+"排班" |
| 45 | 生成排班计划 | SCHEDULING_EXECUTE_FOR_DATE | SCHEDULING_LIST | **A→B** | 同上 |
| 46 | 设置自动排班 | SCHEDULING_SET_AUTO | SCHEDULING_LIST | **A→B** | 同上 |
| 47 | 创建质检单 | QUALITY_CHECK_CREATE | QUALITY_CHECK_QUERY | **A→B** | 扩展VERB_NOUN |
| 48 | 新增供应商 | SUPPLIER_CREATE | SUPPLIER_LIST | **B** | SUPPLIER_CREATE无handler |
| 49 | 删除供应商 | SUPPLIER_DELETE | SUPPLIER_LIST | **B** | 添加VERB_NOUN映射 |
| 50 | 评价供应商 | SUPPLIER_EVALUATE | SUPPLIER_LIST | **B** | 添加phrase映射 |
| 51 | GB 2760标准 | FOOD_KNOWLEDGE_QUERY | UNMATCHED | **B** | 添加食品标准phrase |
| 52 | ISO 22000认证 | FOOD_KNOWLEDGE_QUERY | UNMATCHED | **B** | 添加食品标准phrase |

---

## Actionable Recommendations

### Immediate (今日)

1. **Intent存在性审计** (2h)
   - grep确认测试中所有期望intent是否在代码库中存在
   - 分离"不存在"(改测试) vs "缺phrase"(添加配置)

2. **C类测试用例修正** (1h)
   - 移除或修正LEAVE_APPROVAL、APPROVAL_SUBMIT等不存在intent的测试
   - 标记J4模糊输入为skip或改期望为UNMATCHED

### Short-term (本周)

3. **B类批量添加phrase** (2-4h)
   - 在IntentKnowledgeBase.java添加12-14条新phrase映射
   - 重点: QUERY_FINANCE_ROA/ROE, SALARY_QUERY, PLAN_UPDATE, CCP_MONITOR等

4. **扩展CORE_NOUNS** (1-2h)
   - 添加"电子秤"、"排班"到CORE_NOUNS_FOR_DISAMBIGUATION
   - 对应添加VERB_NOUN_INTENT_MAPPINGS

5. **审计第二次matchPhrase调用** (1h)
   - 检查doRecognizeIntentWithConfidence() line 958
   - 确认是否干扰v22.0 pre-check结果

### Conditional

6. **[如B类修复后仍有遗漏]** 调低v22.0 confidence阈值 (0.80→0.75)
7. **[如两套映射冲突]** 合并ACTION_INTENT_MAPPINGS到IntentKnowledgeBase
8. **[如D类需修复]** 补充小众intent训练样本 (每类至少20条)

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| B类真实规模12-14例 | ★★★★★ | grep验证+3 agents共识 |
| A类纯架构限制6-8例 | ★★★★☆ | v22.0代码验证+推理 |
| matchPhrase重构不必要 | ★★★★☆ | Critic否决+维护成本分析 |
| C类应扩大到12-15例 | ★★★★★ | intent不存在grep验证 |
| 时间估算8-16h | ★★★☆☆ | 保守估计,含隐藏工作 |

---

## Open Questions

1. 哪些测试期望intent在数据库ai_intent_configs中不存在？
2. 第二次matchPhrase调用(line 958)是否需要条件化？
3. CORE_NOUNS覆盖率阈值0.4是否过高？
4. ACTION_INTENT_MAPPINGS在生产中是否被激活？
5. D类小众intent需要多少新训练样本？
6. 等价intent(ALERT_LIST≈ALERT_BY_EQUIPMENT)是否接受为PASS？

---

## Process Note

- **Mode**: Full (5 agents)
- **Researchers deployed**: 3 (架构分析 + 配置覆盖 + 测试合理性)
- **Total sources found**: 12+ codebase files analyzed
- **Key disagreements**: 3 resolved (B类规模, matchPhrase重构, 时间估算), 2 unresolved (语义路由反义, 等价intent策略)
- **Phases completed**: Research → Analysis → Critique → Integration
