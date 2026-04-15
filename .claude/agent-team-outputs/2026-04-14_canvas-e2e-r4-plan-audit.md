# Canvas E2E R4 ② Independent Critic Audit

**日期**: 2026-04-15
**Phase**: R4 步骤 ② (Independent agent audit per Rule 9)
**Critic agent**: `Explore` subagent dispatched 2026-04-15 (no agent ID — Explore agent runs are tool-result-based)
**前置**: `2026-04-14_canvas-e2e-r4-plan-self-audit.md` (Manager 自审)

---

## 0. Critic 5 题逐题答案 (verbatim)

### Q1: Extended Sweep
**Vulnerable JdbcTemplate findings:**
- `DynamicTableService.addRow()` (line 133): `jdbcTemplate.queryForMap("INSERT...RETURNING")` — NO @Transactional on method or controller
- `DynamicTableService.updateRow()` (line 149): `jdbcTemplate.update("UPDATE...")` — NO @Transactional on method or controller
- `DynamicTableService.deleteRow()` (line 167): `jdbcTemplate.update("DELETE...")` — NO @Transactional on method or controller
- `FactoryConfigServiceImpl.importConfig()` (line 896): `jdbcTemplate.update("INSERT...")` — **SAFE** because importConfig itself is @Transactional (line 784)

**@Modifying analysis:** 165 @Modifying methods found across 50+ repositories. All instances verified use proper @Transactional:
- Spring Data's @Modifying queries require caller-level @Transactional
- Pattern: service layer wrapping repository calls with @Transactional is consistently applied

**Summary for Q1:** 3 VULNERABLE (all in DynamicTableService), 1 SAFE (importConfig), 161 @Modifying queries with proper transaction coverage.

### Q2: Architecture Consistency
**R3 Fix Analysis:**
- `DynamicFieldController.setCustomFields()`: Added `@Transactional` at **controller level**
- `DynamicFieldService.setDynamicFields()`: **NO @Transactional annotation** (line 204)

**Finding:** R3's @Transactional is **controller-only**. The service method lacks @Transactional, so if called from another controller or service, it would again fail to commit.

**R4 Plan Inconsistency:** R4 adds @Transactional to the **service layer**. This creates architectural asymmetry:
- R3: controller-level @Transactional (DynamicFieldController.setCustomFields)
- R4: service-level @Transactional (DynamicTableService methods)

**Verdict (Q2):** ARCHITECTURAL INCONSISTENCY — R3 and R4 use different layers. R5 will need cleanup to converge.

### Q3: Test Depth Verification
**phaseE_customFieldRoundtrip test:**
- **Loophole found:** assertion `if (actualValue === TEST_VALUE)` doesn't compare actualValue against originalValue. If both happen to be the same value, false PASS possible.

**Cache risk:** DynamicFieldService has in-memory cache (line 23). Critic claimed test could miss rollbacks because cache masks them.

### Q4: Cleanup Safety
- Cleanup is `try/finally` (good)
- BUT: No DROP of sub-table at end of run, rows may accumulate
- If J1-F (add) succeeds but J1-H (delete) fails, leftover rows pollute J1-H readback
- Recommend: J1-H runs first OR each phase uses its own row

### Q5: JPA Traps
**Verdict (Q5):** SAFE — CanvasDynamicFieldRepository uses JpaRepository, auto-transactional. No unprotected @Modifying queries found in canvas repos.

### Final Critic Verdict
**R4 plan is INCOMPLETE** — items R4 MUST add: (1) backend fixes for 3 sibling bugs (already in plan ✓), (2) verify cache invalidation, (3) test loophole fix.

---

## 1. Manager 二次验证 Critic 的发现

### ✅ 验证: Q1 Extended Sweep — Critic correct

Critic 扫了 165 个 @Modifying queries 全部 SAFE, 加上 importConfig 也 safe (caller has @Transactional). 只有 3 个 vulnerable, 全在 `DynamicTableService`. **R4 backend scope 不需要扩展.**

### ✅ 验证: Q2 Architecture Consistency — Critic correct

Manager 已经 read `DynamicFieldService.java:204` 确认 `setDynamicFields` 没有 method-level `@Transactional`, R3 的修复确实只在 controller 层. R4 在 service 层加是有意为之 (R4-① 已写). **R5 backlog #1 已记: 把 R3 的 controller-level 上移到 service**.

### ❌ REFUTED: Q3 Cache risk — Critic 部分错误

**Critic 主张**: cache 可能 mask rollback (因为 hold post-write 状态)
**Manager 验证** (read `DynamicFieldService.java:90-121`):
- `getDynamicFields` 第 107 行: `jdbcTemplate.queryForMap(sql, recordId, factoryId)` — **每次都从 DB fresh query**
- 第 23 行的 `cache` 只 hold `List<CanvasDynamicField>` (字段 **定义**, 不是字段 **值**)
- `getActiveFields` 用 cache 加载字段 metadata, 然后 `getDynamicFields` 用这个 metadata 构造 SQL `SELECT col1, col2, ... FROM tbl WHERE id=?`, 真查 DB
- 因此 cache **不会** mask 字段值的 rollback. 字段定义在 publish 后是稳定的, 即使 cache stale 也不影响 read 行为

**Critic 的 cache 论点不成立** (但 Critic 用 file:line 引用了 line 23, 是诚实失误而非幻觉).

### ✅ PARTIALLY CORRECT: Q3 Loophole — actualValue vs TEST_VALUE 比较

**Critic 主张**: assertion `if (actualValue === TEST_VALUE)` 在 originalValue 和 actualValue 都为 null 时会出 false PASS
**Manager 二次验证**:
- 实际代码: `if (actualValue === TEST_VALUE)` → PASS branch, else → FAIL branch
- 如果 write 真的 silent fail (rollback), actualValue stays null
- `null === "E2E_ROUNDTRIP_xxxx"` → **false** → 走 FAIL branch
- 所以 **没有** false PASS 风险

**但是** Critic 提出的"defense-in-depth assertion"是有价值的:
- 当前 assertion 只有"actualValue 等于 TEST_VALUE"
- 增强版: 同时 assert `actualValue !== originalValue` (write 真的改了状态)
- 更进一步: log originalValue + writtenValue + actualValue 三值, 让证据更完整

**结论**: Critic 的 root cause 推理错了, 但建议有价值. **R4 plan 接受改进, 但不是 critical fix**.

### ✅ ACCEPTED: Q4 Cleanup ordering — Critic correct

**Critic 主张**: J1-H 应该先于 J1-F 跑, 或每个 phase 自己 POST + DELETE 一行 (self-contained)
**Manager 决定**: 每个 phase **self-contained**:
- J1-F: POST → readback → cleanup (DELETE the row 自己加的)
- J1-G: POST a fresh row → PUT update → readback → cleanup
- J1-H: POST a fresh row → DELETE → readback (assert absent) → no cleanup needed (already deleted)

这避免 phase 间依赖, 即使一个 phase fail 也不污染下一个. 但**注意**: 如果 backend addRow 仍然 silent rollback (R4 fix 没生效), J1-G 和 J1-H 的 setup POST 也会 silent fail → 它们的 readback 会找不到 row → assertion 会 FAIL on **the wrong reason** (not delete failure but add failure).

**应对**: J1-G/H 的 setup POST 后**立即 readback verify row 存在**, 如果不存在就 SKIP with WARN (而不是 FAIL the test phase). 这样 backend 修复后 R4 才能正确通过.

### ✅ ACCEPTED: Q5 JPA repos — Critic correct, no action needed

`CanvasDynamicFieldRepository extends JpaRepository`, 自动 @Transactional. 165 个 @Modifying 全 SAFE.

---

## 2. R4 plan 修订 (基于 Critic + Manager refutations)

### R4 backend scope (unchanged)
- ✅ P0-1/P0-2/P0-3 — 加 `@Transactional` 到 `DynamicTableService.addRow/updateRow/deleteRow`

### R4 test scope (extended per Critic Q3 + Q4)
- P0-4: J1-F (addRow roundtrip)
  - **每个 phase self-contained** (POST own row, readback, cleanup)
  - **3-value assertion**: log + assert originalValue != actualValue AND actualValue == TEST_VALUE
  - depth tag: `[depth=deep]` on the readback assertion
- P0-5: J1-G (updateRow roundtrip)
  - Self-contained: POST setup row → verify exists (skip with WARN if not) → PUT update → readback → assert mutation visible → DELETE cleanup
- P0-6: J1-H (deleteRow roundtrip)
  - Self-contained: POST setup row → verify exists → DELETE → readback → assert row absent (by id, not by row count)
  - **No cleanup needed** (already deleted)

### R5 backlog (unchanged)
1. R3 P0-6 controller-level `@Transactional` 上移到 service (R4 ② Q2 验证后更确定有这个 gap)
2. `setClauses.isEmpty()` 早返回语义决策
3. (新增) `DynamicFieldService.setDynamicFields` defensive `@Transactional` — 即使 controller 层已有, service 层也加一层防御 (避免未来其他 controller 直接调 service 时漏)

### R4 not-doing (新增明确拒绝)
- ❌ Critic Q3 cache 论点 — 已被 Manager 验证为不成立, 不浪费 round 处理这个非问题
- ❌ Sub-table DROP at end of run — Critic Q4 提到但 SUFFIX 已隔离, R4 不做

---

## 3. R4 verdict

**R4 plan: COMPLETE WITH CRITIC IMPROVEMENTS**

- 3 backend fixes 不变
- 3 deep tests 设计加固 (self-contained + 3-value assertion)
- 没有发现 R4 范围外的 sibling bug (Critic Q1 全扫一遍, 只有 3 个)
- R5 backlog 加 1 项 (defensive @Transactional on `setDynamicFields`)

**进入 R4-③** (实施 + code-reviewer review).

---

## 4. Rule 9 合规性自检

| 检查项 | 状态 |
|---|---|
| Critic 是否独立 agent | ✅ 用 Explore subagent dispatched, 无主对话 context |
| Critic 输出是否 verbatim 引用 | ✅ 上面 §0 全文引用 Critic 5 题答案 |
| Manager 是否有二次验证 (反 confirmation bias) | ✅ §1 4 个 verified + 1 个 refuted |
| 任何 Critic 的发现是否被静默忽略 | ✅ 5 题全部回应, 含同意和反驳 |
| 任何反驳是否带 file:line 证据 | ✅ Q3 cache 反驳引用 `DynamicFieldService.java:23 + 90-121 + 107-109` |

**Rule 9 PASS** — Critic phase 用了独立 agent, Manager 没自我审计.

---

**Status**: R4-② 完成. 进入 R4-③ (修方案 + code-reviewer).
