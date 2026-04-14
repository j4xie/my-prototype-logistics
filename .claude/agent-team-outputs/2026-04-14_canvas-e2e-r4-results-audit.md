# Canvas E2E R4 Results Audit

**日期**: 2026-04-15
**Phase**: R4 步骤 ⑤ Independent agent audit (Rule 9)
**前置**: pre-investigation + plan-self-audit + plan-audit (Critic)

---

## 0. 核心结论

**R4 最终结果**: **88/88 PASS / 0 FAIL / 0 WARN × 多次独立 runs** (run3 / run4 / final).

R4 的价值显著高于 R3:
- **R3**: 1 个 @Transactional latent bug 发现 + 修复
- **R4**: 3 个 @Transactional sibling bugs (Rule 8 sweep) + **额外发现** 1 个 P0 UUID cast bug (depth test 现场抓到) + 全部修复
- R4 总共修了 4 个 P0 生产缺陷, 其中 3 个是 R3 埋的 carryover, 1 个是 R4 深度测试**现场发现**的

本轮验证了两个新 skill rules 的价值:
- **Rule 8 (same-cause sweep)**: R4-① pre-investigation 就通过 sweep 锁定 3 个 sibling bugs, 避免了"下一轮再做" 反模式
- **Rule 9 (independent Critic)**: R4-② 独立 agent 扩面扫描 + 5 题深度 Critic, 1 题 partially refuted (cache masking 论点不成立, Manager file:line 反驳), 其余全 validated

---

## 1. R4 metrics (honest)

| 指标 | R3 final | R4 final | R4 阈值 | 达标 |
|---|---|---|---|---|
| Total assertions | 79 | **88** | — | ✅ |
| PASS | 79 (100%) | **88 (100%)** | ≥98% | ✅ |
| FAIL | 0 | **0** | 0 | ✅ |
| WARN | 0 | **0** | ≤1 | ✅ |
| Independent runs | 2 | **3 (run3/run4/final)** | ≥2 | ✅ |
| Deep tests | 1 (J1-E3) | **10** (E3 + F0/F1/F2 + G0/G1/G2 + H0/H1/H2 + attack4b) | ≥1 | ✅ |
| Medium tests | 5 | **4** | — | ~ |
| Bug 发现 (本轮新) | 1 | **1** (UUID cast, P0 discovery) | — | ✅ |
| Bug 修复 (本轮) | 1 | **4** (3 @Transactional + 1 UUID cast) | — | ✅ |

**R4 通过所有阈值**, 且已达 R5 标准 (100%/0/0).

---

## 2. R4 实际做了什么

### Backend fixes

#### P0-1/P0-2/P0-3 (R3 backlog → R4 闭环): `@Transactional` sweep
- `DynamicTableService.addRow` (line ~191) — 加 `@Transactional`
- `DynamicTableService.updateRow` (line ~209) — 加 `@Transactional`
- `DynamicTableService.deleteRow` (line ~229) — 加 `@Transactional`
- 根因: 和 R3 `setCustomFields` 一样 — hikari.auto-commit=false + 无 @Transactional → JdbcTemplate.update 静默 rollback
- 选择 service layer 而非 controller: 覆盖所有调用方 (R3 backlog #1 要求的架构统一), R5 会顺便移动 R3 的 controller-level 版本

#### P0-7 (R4-④ phase F 现场发现 → R4-⑥ 闭环): UUID cast hardcoded
- **发现时机**: R4 第一次跑 phaseF, POST 返回 HTTP 400 "数据完整性异常", log 显示 `ERROR: invalid input syntax for type uuid: "F002-SO-T10"` — sales_orders.id 是 VARCHAR, sub-table parent_id 硬编码 UUID
- **影响范围**: 所有 VARCHAR-id 或 BIGINT-id 模块的 sub-table CRUD. 生产环境 `sales_order_prepayment_records_items` 因此只有 2 条孤儿行 (parent_id UUID 无匹配 sales_orders.id)
- **修复**:
  - `DynamicTableService`: 加 `parentIdTypeCache` + `getParentIdColumnType(subTableName)` + `parentIdPlaceholder(subTableName, forInsert)` 辅助方法
  - 应用到 `getRows`/`addRow`/`updateRow`/`deleteRow` 4 个方法
  - `DDLExecutor`: 加 `resolveParentIdSqlType(parentTable)` → 新 sub-table 创建时使用匹配的 parent_id 类型 (UUID/BIGINT/INTEGER/VARCHAR(100))
  - **存量处理**: 不 migrate 现有 29 个测试环境空 sub-tables (它们是 empty), 也不 migrate 生产 2 个孤儿行 (它们已经是 broken data). R5 做 ADR 决定 back-migration 策略

### Test additions

- **J1-E phaseE** (R3 carryover, 已在 R3 部署)
- **J1-F phaseF**: subTableAddRoundtrip — testIds J1-F0/F1/F2, depth=deep
- **J1-G phaseG**: subTableUpdateRoundtrip — testIds J1-G0/G1/G2, depth=deep
- **J1-H phaseH**: subTableDeleteRoundtrip — testIds J1-H0/H1/H2, depth=deep
- 每个 phase **self-contained** (Critic Q4 要求): 自己 POST setup → readback → 自己 cleanup
- 每个 phase 的 readback assertion 用 `cf_remark` 读取 (backend safeColumnName auto-prefix cf_)

### 新 skill rules 验证
- **Rule 8 触发**: R3 @Transactional 修复后, pre-investigation sweep 找到 3 siblings (正确识别)
- **Rule 8 二次触发**: R4-④ Phase F 发现 UUID cast bug 后, 再 sweep 找到 9 个 instance, 分类到 R4 scope vs R5 backlog (AggregateFormulaExecutor)
- **Rule 9 触发**: R4-②/⑤ 都用独立 Explore agent, 不 self-impersonate

---

## 3. Rule 8 sweep 完整性报告 (Critic audited)

**剩余 `?::uuid` / `CAST(? AS uuid)` hits**:

| file:line | context | verdict |
|---|---|---|
| `DynamicTableService.java:84` | `parentIdPlaceholder()` 内部返回 `"?::uuid"` / `"CAST(? AS uuid)"` | **SAFE** — helper 本身 type-aware, UUID cast 只在 parent id 真是 UUID 时返回 |
| `DynamicFieldService.java:85` | `idWhereClause()` 的 uuid 分支 | **SAFE** — 主值表 id 查询 helper, 所有 Canvas V3 主表 id 是 UUID (不是 parent_id) |
| `AggregateFormulaExecutor.java:87-91, 142-146` | aggregate formula parent_id/order_id hardcoded `?::uuid` | **R5 backlog** — 显式 out-of-R4-scope, aggregate formula 不在当前 deep test 覆盖范围 |

**Critic 判定**: R4 sweep 在 "DynamicTableService + DDLExecutor" scope 内完整, AggregateFormulaExecutor 明确 document 延期到 R5.

---

## 4. R5 backlog (明确技术原因, 非 next-round-syndrome)

1. **AggregateFormulaExecutor UUID cast 修复** — 同 parentIdPlaceholder 模式, 但 aggregate formula 不在当前 deep test 范围, 需要先在 R5-① 补 aggregate deep test 再修
2. **R3 P0-6 的 controller-level `@Transactional` 上移到 `DynamicFieldService.setDynamicFields`** — 架构统一 (与 R4 service-level 保持一致). 需要重跑 R3 所有 79 assertions 验证无回归
3. **`DynamicFieldService.setDynamicFields setClauses.isEmpty() return` 语义决策** — 同租户写 unknown field 是 throw 还是 silent no-op? 需要 caller audit + ADR
4. **Back-migration 策略 ADR** — 生产 2 个孤儿 sub-table rows (parent_id UUID 无匹配) 怎么处理? 清理? 保留? 文档化?

---

## 5. Critic 验证结论 (verbatim)

> **R4 is READY TO COMMIT.**
> 
> **Reasons:**
> 1. ✅ True 88/88 PASS × 2 independent runs with proper timestamp spacing.
> 2. ✅ Deep tests (F/G/H) exercise real backend POST/PUT/DELETE + readback with correct cf_ column lookups.
> 3. ✅ Rule 8 sweep complete: DynamicTableService + DDLExecutor fixed for type-aware parent_id casts; AggregateFormulaExecutor explicitly deferred to R5 backlog.
> 4. ✅ @Transactional annotations (R3 + R4 combined) intact on all 4 sibling CRUD endpoints.
> 5. ✅ Depth distribution 10 deep/4 medium is meaningful improvement; new tests directly target the discovered @Transactional + UUID cast bugs.
> 6. ✅ No hidden issues in diff: clean, scoped changes; correct SQL; proper null handling.

---

## 6. R4 的 meta 意义

本轮 canvas-security-e2e 证明了 depth-first-e2e skill Rule 8 + Rule 9 的价值:
- R3 surgical fix (1 endpoint) → Rule 8 sweep 发现 3 个 sibling → R4 全部修掉
- R4 deep tests 现场抓到 **R4 原本没预期发现** 的 UUID cast bug (1 个 phase F 测试第一次跑就暴露)
- R4 在同轮内完成 4 个 P0 修复 + 10 个 deep tests 回归锁定
- 如果按老 framework 跑 (没 Rule 8/9), 这 4 个 bug 可能在 5 round 全过后都还潜伏 — Rule 8/9 价值的经典案例

R5 backlog 有 4 项明确技术原因, 不是 "下一轮做" 的 punt.

---

**Status**: R4-⑤/⑥ 完成, 进入 R4-⑦ verification + commit.
