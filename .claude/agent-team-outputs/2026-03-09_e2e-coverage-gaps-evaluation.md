# 张权6项业务需求 E2E 测试覆盖完整性评估

> Agent Team 研究报告 | 2026-03-09

## 执行摘要

项目 E2E 测试覆盖率极低，6 项业务需求中仅报工（需求 4）有 happy-path 级 Maestro 脚本，其余 5 项为零覆盖。代码审计发现 2 个确认 P0 缺陷（outputQuantity 无正数校验、支付无幂等防护）和 5 个 P1 缺陷。整体测试基础设施存在但未系统性扩展到全部需求。

---

## 确认的缺陷清单

### P0 — 立即修复（2-3 小时）

| ID | 缺陷 | 文件 | 修复方案 |
|----|------|------|---------|
| P0-1 | `outputQuantity` 无正数校验（接受 0/负数） | `WorkReportSubmitRequest.java:36` | 添加 `@Positive` 或 `@DecimalMin("0.01")` |
| P0-2 | 收款无幂等/超额防护 | `ArApServiceImpl.recordArPayment()` | 添加 paymentReference 唯一约束 + balance >= amount 检查 |

### P1 — 短期修复（4-6 小时）

| ID | 缺陷 | 文件 | 说明 |
|----|------|------|------|
| P1-1 | batchId 不存在时报工静默成功 | `WorkReportingServiceImpl.java:307-322` | 有意容错设计，但应加日志告警 |
| P1-2 | 报工无重复提交防护 | `WorkReportingServiceImpl.submitReport()` | 同一工人+批次+日期可无限提交 |
| P1-3 | BI 字段名不匹配 | `EfficiencyAnalysis.vue:403` | 前端 `budgetCost` → 应改为 `estimatedLaborCost` |
| P1-4 | 生产计划 batchDate/processName 无必填校验 | `CreateProductionPlanRequest.java` | 添加 `@NotNull`/`@NotBlank` |
| P1-5 | 销售快捷出库 items 为空时 productTypeId 为空串 | `sales/orders/list.vue` handleQuickDelivery | 兜底逻辑需改进 |

### P2 — 条件修复

| ID | 缺陷 | 说明 |
|----|------|------|
| P2-1 | 商品编码并发竞态 | COUNT+1 模式，但有唯一性校验兜底，低并发下风险极低 |
| P2-2 | 出库后销售订单状态未联动更新 | 需触发 OrderStatus 更新事件 |
| P2-3 | 开票金额无上限校验 | 可开超过订单总额的发票 |

---

## Analyst vs Critic 关键纠正

| 议题 | Analyst 原判 | Critic 纠正 | 最终结论 |
|------|-------------|------------|----------|
| checkin 不验证 batchId/employeeId | P0（3个） | `CheckinRequest.java` 有 `@NotNull` + Controller 有 `@Valid` | **Critic 正确** — 此缺陷不存在 |
| 商品编码 SELECT MAX+1 无锁 | P0 | 实际是 COUNT+1 且有 `existsByFactoryIdAndCode` 唯一性校验兜底 | **Critic 正确** — 降至 P2 |
| batchId 不存在静默成功 | P0 | 代码有意容错设计注释 | **部分同意** — 降至 P1 |
| 5 个 P0 | 严重性膨胀 | 修正为 2 个 P0 | Analyst 过度悲观已纠正 |

---

## E2E 测试覆盖矩阵

| 需求 | 现有 E2E 文件 | 覆盖范围 | 缺口 |
|------|-------------|---------|------|
| 1. 签到/签退 | 无 | 0% | 完全缺失 |
| 2. 商品编码 | 无 | 0% | 完全缺失 |
| 3. 生产计划 | 无 | 0% | 完全缺失 |
| 4. 报工提交 | `test-e2e-data-flow.yaml` + `test-e2e-progress.yaml` | ~30% | 仅 happy path，无边界值/异常测试 |
| 5. 销售快捷操作 | 无 | 0% | 完全缺失 |
| 6. BI 效率对比 | 无 | 0% | 完全缺失 |

---

## 模式分析：共性根因

### 模式1：输入验证缺失（影响需求 4/6）
- `outputQuantity` 无 `@Positive`
- 收款金额无上限检查

### 模式2：幂等/防重缺失（影响需求 4/6）
- 报工可重复提交
- 收款无 paymentReference 唯一约束

### 模式3：前后端字段不一致（影响需求 6）
- `budgetCost` vs `estimatedLaborCost`

### 模式4：跨实体一致性未保障（影响需求 4/5）
- 报工时 batchId 不存在 → 报工保存但批次进度不更新
- 出库后订单状态未联动

---

## 建议的修复执行顺序

1. **立即**: P0-1 (outputQuantity @Positive) + P0-2 (收款防重) + P1-3 (BI字段映射)
2. **本周**: P1-1~P1-5
3. **补充 E2E**: 为每个需求至少创建 1 个 happy-path + 1 个异常路径测试
4. **条件性**: P2 缺陷在多用户阶段前修复

---

## 开放问题

1. batchId 不存在时的行为是 bug 还是 feature？需产品确认
2. 收款模块的具体 Controller 路径需定位确认
3. E2E 测试是否需要 CI 集成？
4. 张权原始需求验收标准文档？

---

### Process Note
- Mode: Full
- Researchers deployed: 2
- Total sources found: 20 (代码文件为主)
- Key disagreements: 3 raised, 3 resolved (Critic corrections adopted)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (claims primarily code-grounded)
- Healer: all checks passed ✅
