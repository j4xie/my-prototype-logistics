# Canvas E2E R4 Pre-Investigation — Same-Cause Sweep

**日期**: 2026-04-15 (R4 启动前)
**Trigger**: 用户对 R3 完成后的"是否还有 R4/R5 内容"挑战 + 新加的 depth-first-e2e Rule 8 (same-cause sweep)
**目的**: R3 修了 1 个 endpoint 的 `@Transactional` 缺失. Rule 8 要求 Manager 在 commit 前必须 sweep 同根因的 sibling 实例. 因为 R3 commit 时 Rule 8 还没存在 (我们正是因为这次事件才加的 Rule 8), 这份文档作为补做的 sweep, 也作为 R4 的范围依据.

---

## Sweep 范围

**根因模式**: `JdbcTemplate.update(...)` / `JdbcTemplate.execute(...)` / `JdbcTemplate.queryForMap("INSERT/UPDATE/DELETE ...")` 调用, 在没有 `@Transactional` 的方法链上.

**搜索范围**: `backend/java/cretas-api/src/main/java/com/cretas/aims/` (重点 `controller/`, `engine/`, `service/`)

**Grep 命令** (Explore agent 实际跑过):
```bash
# Pattern 1: raw JdbcTemplate writes
Grep -r "jdbcTemplate.update\|jdbcTemplate.execute\|jdbcTemplate.queryForMap.*INSERT\|jdbcTemplate.queryForMap.*UPDATE" backend/.../com/cretas/aims/

# Pattern 2: @Transactional presence check on candidate files
Grep -B 5 "jdbcTemplate.update" backend/.../engine/Dynamic*.java
```

---

## Findings

| # | Endpoint | Service Method | Raw JdbcTemplate write? | @Transactional? | Verdict |
|---|---|---|---|---|---|
| 1 | `DynamicFieldController.setCustomFields` (PUT) | `DynamicFieldService.setDynamicFields` | ✓ | **✓ (R3 fix added)** | **SAFE — fixed in R3** |
| 2 | `DynamicFieldController.getCustomFields` (GET) | `DynamicFieldService.getDynamicFields` | ✗ (read-only) | n/a | SAFE (reads不受 hikari auto-commit 影响) |
| 3 | `DynamicFieldController.addSubTableRow` (POST) | `DynamicTableService.addRow` | ✓ Line 146 (`INSERT...RETURNING` via `queryForMap`) | **✗ NEITHER** | **VULNERABLE** |
| 4 | `DynamicFieldController.updateSubTableRow` (PUT) | `DynamicTableService.updateRow` | ✓ Line 164 (`UPDATE...`) | **✗ NEITHER** | **VULNERABLE** |
| 5 | `DynamicFieldController.deleteSubTableRow` (DELETE) | `DynamicTableService.deleteRow` | ✓ Line 170 (`DELETE FROM...`) | **✗ NEITHER** | **VULNERABLE** |
| 6 | `DynamicFieldController.createField` (POST) | `fieldRepo.save(...)` (JPA) | ✗ (uses JpaRepository) | n/a | SAFE (JPA 走 Spring tx 管理) |
| 7 | `DynamicFieldController.updateField` (PUT) | `fieldRepo.save(...)` (JPA) | ✗ | n/a | SAFE |
| 8 | `DynamicFieldService.changeFieldType` | raw `jdbcTemplate.execute` (ALTER TABLE) | ✓ Line 151 | ✓ (called from controller path with @Transactional) | SAFE |
| 9 | `DDLExecutor.executePendingDDL` | raw `jdbcTemplate.execute` | ✓ Line 96 | ✓ `@Transactional(REQUIRES_NEW)` Line 60 | SAFE (本身有 @Transactional) |
| 10 | `SchedulingOptimizationController.setSkuComplexity` (PUT) | `SkuComplexityService.setSkuComplexity` | ✓ Line 89 | ✓ Service has @Transactional Line 77 | SAFE |
| 11 | `SchedulingOptimizationController.updateConfig` (PUT) | `FactorySchedulingConfigService.updateConfig` | ✗ (uses JPA repo.save) | n/a | SAFE |
| 12 | `SchedulingOptimizationController.performAdaptiveLearning` (POST) | `FactorySchedulingConfigService.performAdaptiveLearning` | ✓ Line 316 (logAdaptation only, in try-catch) | ✓ Service has @Transactional Line 73 | SAFE |

---

## Critical findings

### 3 个 sibling latent bugs (R4 P0)

**Bug 1**: `addSubTableRow` — silent INSERT loss
- **HTTP**: `POST /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}`
- **Controller**: `DynamicFieldController.java:225-238`
- **Service**: `DynamicTableService.addRow(subTableName, recordId, row)` line ~133
- **SQL site**: `jdbcTemplate.queryForMap("INSERT INTO " + subTableName + " (...) VALUES (...) RETURNING *", values)` line 146
- **Symptom**: API returns HTTP 200 + new row data; row visible briefly, then disappears on next read (silent rollback at connection return)
- **User impact**: Factory operator adds prepayment record, sees confirmation, refreshes page, row gone

**Bug 2**: `updateSubTableRow` — silent UPDATE loss
- **HTTP**: `PUT /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}`
- **Controller**: `DynamicFieldController.java:240-255`
- **Service**: `DynamicTableService.updateRow(subTableName, recordId, rowId, row)` line ~149
- **SQL site**: `jdbcTemplate.update("UPDATE " + subTableName + " SET ... WHERE id = ? AND parent_id = ?", params)` line 164
- **Symptom**: Identical to R3's `setCustomFields` bug — HTTP 200 success, value never persisted
- **User impact**: Factory operator edits sub-table row, sees save success, value reverts on next load

**Bug 3**: `deleteSubTableRow` — silent DELETE loss
- **HTTP**: `DELETE /api/mobile/{factoryId}/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}`
- **Controller**: `DynamicFieldController.java:257-271`
- **Service**: `DynamicTableService.deleteRow(subTableName, recordId, rowId)` line ~167
- **SQL site**: `jdbcTemplate.update("DELETE FROM " + subTableName + " WHERE id = ? AND parent_id = ?", rowId, parentId)` line 170
- **Symptom**: API returns HTTP 204 No Content; row remains in DB
- **User impact**: Factory operator deletes sub-table row, sees success, row reappears on refresh — confusing UX, data inconsistency

### Affected user-facing flows
The 3 vulnerable endpoints are sub-table CRUD for Canvas V3 dynamic sub-tables. In production, this maps to:
- `prepay_*` sub-tables (prepayment records on sales orders)
- `bom_*` sub-tables (recipe ingredients)
- Any other sub-table created via Canvas V3 dynamic field definition

These are core business workflow features. **Production users have been silently losing sub-table data for an unknown duration.**

---

## Sweep 完整性 vs 范围

**已扫描** (完成):
- ✅ `controller/DynamicFieldController.java` — 8 endpoints, 3 vulnerable + 5 safe
- ✅ `controller/SchedulingOptimizationController.java` — 3 endpoints, 0 vulnerable
- ✅ `engine/DynamicFieldService.java` — 2 raw-SQL methods, both protected by enclosing tx context
- ✅ `engine/DynamicTableService.java` — 3 unprotected methods (the 3 bugs above)
- ✅ `engine/DDLExecutor.java` — 1 raw-SQL method, has explicit @Transactional(REQUIRES_NEW)

**未扫描** (R4-② Rule 9 独立 agent 应该补):
- ❌ 其他 controllers in `com.cretas.aims.controller/` (60+ files): SalesOrderController, MaterialBatchController, ProductionPlanController, BusinessRuleController, ConfigController, TriggerChainController, ConfigChangeSetController...
- ❌ Service-layer raw JdbcTemplate callers — Explore agent 没扫 service/impl/ 包
- ❌ Repository custom @Query 方法 (JPA 但可能用 native SQL with @Modifying without proper @Transactional)

**估计未扫范围内可能还有的实例数**: 0-5 个 (低概率但非零)

---

## R4 计划输入

基于本次 sweep, R4 的范围已经具体化:

### R4 必修 (P0 from sweep)
1. **修 backend** — 为 3 个 sub-table CRUD service 方法 (addRow / updateRow / deleteRow) 加 `@Transactional` (或在 controller 加, 与 R3 P0-1 setCustomFields 模式对齐)
2. **加 3 个 deep test** — J1-F (addRow roundtrip), J1-G (updateRow roundtrip), J1-H (deleteRow roundtrip), 每个都遵守 phaseE 模式 (操作前 GET → 操作 → 操作后 GET → assert state visible/changed/removed)
3. **R4-② 必须扩面 sweep** — 用 independent agent 扫剩余 60+ controllers, 找第 4/5 个 vulnerable 实例

### R4 metrics 目标
- Total assertions: 79 → 82 (新加 J1-F0/F1/F2 + J1-G0/G1/G2 + J1-H0/H1/H2 ≈ 9 个 testIds, 但视情况可能合并)
- PASS rate: 100%
- FAIL: 0
- WARN: 0
- Independent runs: ≥2
- Bug 发现: 3 个 known + 0~N 个由 R4-② sweep 发现

### R4 not-doing (本轮明确不做)
- ❌ 移 `@Transactional` 上移到 service 层架构清理 (R3 backlog #1) — 不在 R4 scope, R5 处理
- ❌ `setClauses.isEmpty()` 早返回语义决策 (R3 backlog #3) — 不在 R4 scope, R5 处理
- ❌ 加新的安全攻击向量 — R4 是修 latent bugs round, 不是新威胁建模 round

---

## 执行 trace (供后续 audit doc 验证 sweep 合规)

- **2026-04-14 ~22:00 local**: 用户提出"先证明 R4 没值得做的事再跳过"
- **22:00-22:15**: Manager 派 Explore agent (subagent_type=Explore) 调查 sibling endpoints
- **22:15**: Explore agent 返回报告 (在主对话中作为 tool result), 列出 12 个候选 endpoint, 标记 3 个 vulnerable
- **22:30**: 对话中识别这是一个 skill gap, 提议升级 depth-first-e2e
- **23:00-23:30**: 加 Rule 8 + Rule 9 + case study + commit `2620e0801`
- **23:30+**: 写本份文档作为 R4-① 输入

**Critic agent ID** (Explore phase): tool result block in conversation, no separate agent ID stored. R4-② will dispatch a fresh independent agent and store its ID per Rule 9.

---

**结论**: R4 必有, 修 3 个 known sibling bugs + 1 次 R4-② 扩面 sweep 是底线 scope. R4-① 方案自审接续此文档.
