# Canvas E2E R5 ① 方案自审 (Final Round)

**日期**: 2026-04-15
**Phase**: R5 步骤 ① (Self-audit by Manager)
**前置**: R4 carryover 4 项 (见 2026-04-14_canvas-e2e-r4-results-audit.md §4)

---

## R5 定位 (最终轮)

R5 是 5-round framework 的**收官**. 核心使命是"生产就绪准备" — 不引入新威胁建模 / 不新增覆盖面大动作, 而是**闭环 R3/R4 遗留的架构清理 + 为未涉入的边界写明确 ADR**.

R5 阈值: **100% PASS / 0 FAIL / 0 WARN** (已达 R5 标准由 R4 继承, R5 必须保持)

---

## R4 carryover 4 项 — 哪些 R5 真做, 哪些 honest defer

### Item 1: AggregateFormulaExecutor UUID cast (R4 backlog)
**分析**:
- 与 R4 P0-7 同模式: 硬编码 `parent_id = ?::uuid` 在 GROUP_BY/RATIO aggregate SQL (line 87-91, 142-146)
- 修 backend 简单 (仿 R4 parentIdPlaceholder 模式)
- **问题**: 没有 aggregate formula deep test 基础设施. 写 aggregate formula deep test 需要:
  - Canvas V3 定义一个 aggregate 公式 (GROUP_BY 或 RATIO)
  - 挂到某个 validation rule 或 formula 字段上
  - 通过 API 触发公式评估
  - Assert 返回的聚合值 = 预期
- 以上工作量 ≥ R4 phaseF/G/H 总和
- **如果只修 backend 不加 test = 盲改**, 违反 Rule 2 + 违反 "fix 必须有 test 验证" 原则

**R5 决定**: **NOT 本轮**. 明确记录到 R5 ADR + R6 backlog, 有具体技术原因 (需先建 aggregate formula test 基建). **不是 next-round-syndrome** — 这不是"下一轮再说", 而是"下一轮的前置条件是 aggregate test harness, 本轮无法跳过这个前置".

### Item 2: R3 controller-level `@Transactional` 上移到 service layer (R4 backlog)
**分析**:
- R3 `DynamicFieldController.setCustomFields` 加 `@Transactional` — 当时是 surgical fix
- R4 `DynamicTableService.addRow/updateRow/deleteRow` 加 `@Transactional` 在 service 层 — architectural choice
- 两者不一致 = 后续 maintainer confusion
- **修复方式**: 把 `@Transactional` 从 controller 移到 `DynamicFieldService.setDynamicFields`
- **风险**: LOW. Service-level `@Transactional` + default propagation REQUIRED, 任何 caller (有无外层 tx) 都正确处理
- **测试**: 既有 J1-E phaseE roundtrip test 已覆盖 → R5 重跑不应 break

**R5 决定**: **DO 本轮**. 简单 surgical cleanup. 会触发 J1-E3 roundtrip 作为回归验证.

### Item 3: `DynamicFieldService.setDynamicFields setClauses.isEmpty() return` 语义 ADR (R4 backlog)
**分析**:
- 当前行为: 如果用户 PUT 了一些 fieldCode 但 defMap 全无匹配 → setClauses 空 → 早 return → HTTP 200 success, 但 0 字段被写入
- 问题: silent success on 无匹配字段 — 可能掩盖 typo / 过期 fieldCode
- 正确行为候选:
  - A. **Status quo** (silent no-op) — 向后兼容, 但违反 "fail loud" 原则
  - B. **抛 BusinessException** — "字段 ${x} 未在当前工厂定义", fail loud, 但可能 break caller (MaterialBatchServiceImpl, ProductionPlanServiceImpl 等)
  - C. **返回详细 response** 含被忽略字段列表 — 介于 A/B, 需改 controller response type
- 需要 caller audit 决定

**R5 决定**: **ADR 本轮**. 写一个 ADR 文档 (not code change), 列 3 个候选 + tradeoff + 推荐方向. 真正代码变更留 R6+.

### Item 4: 生产 sub-table orphan rows back-migration ADR (R4 backlog)
**分析**:
- 生产 `sales_order_prepayment_records_items` 有 2 条 orphan rows:
  - `parent_id` 是 UUID (e.g., `cb4e687d-...`), 但 sales_orders.id 是 VARCHAR (`SO-F001-*`)
  - 无任何真实 sales_order 匹配这个 UUID — 孤儿数据, 从未被真实流程访问
- R4 修复后, 新 sub-table 使用 VARCHAR parent_id, 但旧 sub-table 仍是 UUID
- 选项:
  - A. **DROP + recreate** — 生产 sub-table 不再接受新写入 (VARCHAR vs UUID 不兼容), drop 是 clean
  - B. **ALTER COLUMN TYPE** — 尝试 `parent_id uuid::text` 保留结构, 但 2 条 orphan 仍无 parent
  - C. **清理孤儿 + ALTER COLUMN** — DELETE 孤儿行, 然后 ALTER
  - D. **保留 + document** — 当前 orphan 不碍事, 文档化存在

**R5 决定**: **ADR 本轮**. 推荐 C (清理 + ALTER), 记录为 MigrationPlan 文档供后续 DBA 执行. 不在 R5 实际执行 (生产 DB 改动需专门 maintenance window).

---

## R5 实际 scope (最终)

### Code changes (2 项)

#### R5-P0-1: `@Transactional` 从 controller 移到 service
- **文件**: `backend/.../controller/DynamicFieldController.java:282-298`
- **改动**: 删除 `@Transactional` annotation + 移除 import (如果 import 没别的用途)
- **文件**: `backend/.../engine/DynamicFieldService.java:204`
- **改动**: 在 `public void setDynamicFields(...)` 上方加 `@Transactional` + 加 import `org.springframework.transaction.annotation.Transactional`
- **风险**: LOW
- **验证**: 既有 J1-E phaseE 通过 → 架构清理成功

#### R5-P0-2: 3 个新 cross-tenant sub-table deep tests (Rule 2 compliance)
- **文件**: `tests/canvas-security-e2e/j4-cross-tenant.mjs`
- **testIds**:
  - `J4-9`: F006 tries POST sub-table row to F002 sub-table path (expects HTTP 400 from verifyParentOwnership)
  - `J4-10`: F006 tries PUT sub-table row to F002 sub-table path (expects HTTP 400)
  - `J4-11`: F006 tries DELETE sub-table row on F002 parent's row (expects HTTP 400)
- **depth=deep on assertion**: **dual check** — assert HTTP 4xx **AND** assert row unaffected via F002 readback (similar to J4-4b for custom-fields)
- **Purpose**: 
  - Rule 2 compliance
  - Symmetric coverage with J4-4 (custom-fields write) and J4-4b (custom-fields read)
  - Indirectly verify R4 `verifyParentOwnership` 在 sub-table 路径也有效 (sub-table endpoints 已经有 verifyParentOwnership, 但从没被测试过)

### Documentation (2 ADRs)

#### R5-ADR-1: `setDynamicFields setClauses.isEmpty()` 语义决策
- **文件**: `tests/canvas-security-e2e/EVIDENCE.md` §14
- **内容**: 3 候选 + tradeoff + 推荐方向 (tentative: Option B throw BusinessException, 需 R6 做 caller audit)
- **不 code change**

#### R5-ADR-2: 生产 sub-table back-migration plan
- **文件**: `tests/canvas-security-e2e/EVIDENCE.md` §15
- **内容**: 生产数据现状 + 4 候选 + 推荐 C (清理 + ALTER) + DBA executable steps
- **不 code change**

### R6+ backlog (honest defer with reasons)

1. **AggregateFormulaExecutor UUID cast fix** — 需要先建 aggregate formula deep test harness (预估 1-2 天), 本 R5 无力承担此前置
2. **setCustomFields setClauses.isEmpty() 代码实施** — 取决于 R5-ADR-1 审 结论, caller audit 需要 1 天
3. **生产 sub-table back-migration 执行** — 取决于 R5-ADR-2, DBA maintenance window 需要单独 ops 协调

---

## Rules 1-9 合规自检

| Rule | R5 计划是否符合 | 备注 |
|---|---|---|
| Rule 1: depth label | ✅ J4-9/10/11 标 `[depth=deep]` |
| Rule 2: ≥1 new deep test | ✅ 3 个新 deep tests |
| Rule 3: audit questions bug-discovery | ✅ R5-② Critic 必问 "这 3 个 cross-tenant 测试能 catch backend regress 吗?" |
| Rule 4: no "next round" | ✅ R6 backlog 全部有具体技术原因 (aggregate test 基建 / caller audit / maintenance window) |
| Rule 5: Critic scrutinizes depth | ✅ R5-② 必问 3 题 |
| Rule 8: same-cause sweep | ✅ R5 会 sweep 剩余 UUID cast 确认仅 AggregateFormulaExecutor (已 document 为 R6) |
| Rule 9: independent Critic | ✅ R5-②/⑤ 都派独立 Explore agent |

---

## R5-② 必问 Critic 问题 (R5 Manager prompt)

```
你是 R5 独立 Critic. 用 Read/Grep 验证 3 件事:

1. R5-P0-1 @Transactional 上移: 确认 DynamicFieldService.setDynamicFields 移动 annotation 后, service-to-service callers (MaterialBatchServiceImpl 等) 仍然正确运行. 具体: grep 谁调 setDynamicFields, 检查每个 caller 是否已在 @Transactional 边界内. 如果有 caller 没 @Transactional, 加 R3 的 controller-level 是 pros, 移到 service 反而打破 caller 预期吗?

2. R5-P0-2 J4-9/10/11: 这 3 个 cross-tenant sub-table 测试真的 deep 吗? 或者只是 "发 HTTP, 看 status"? 查 j4-cross-tenant.mjs 中 J4-4b 的模式, R5 新 test 是否有 **dual-check** (HTTP 4xx AND 状态 不变)?

3. R5 scope decision: aggregate formula fix 真的应该延 R6 吗, 还是 R5 应该 include? 查 AggregateFormulaExecutor 有没有既有的测试, 是否存在 "可以用既有机制触发 GROUP_BY formula" 的 quick test 写法. 如果 5 分钟内可以让一个 aggregate 测试跑通, R5 就应该 include.

你的答案 verbatim 进 R5-②/⑤ audit doc.
```

---

## R5 执行顺序 (R5-④)

1. code-reviewer (R5-③): 在实施前 review 计划
2. Implement P0-1 (move @Transactional)
3. Implement P0-2 (J4-9/10/11 deep tests)
4. Write ADR-1 + ADR-2 into EVIDENCE.md §14/§15
5. Compile backend (mvn compile)
6. Deploy to test 10011
7. Run R5-final twice (CANVAS_E2E_RUN_ID=R5-run1 / R5-run2)
8. Expected: 88+3=91 assertions, 100% PASS, 0 FAIL/WARN
9. R5-⑤ independent Critic audit
10. R5-⑥ fix findings (if any)
11. R5-⑦ verification + commit

---

**Status**: R5-① 完成. 进入 R5-② (独立 Critic agent).
