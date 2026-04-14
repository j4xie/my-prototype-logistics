# Canvas E2E R4 ① 方案自审

**日期**: 2026-04-15
**前置**: `2026-04-14_canvas-e2e-r4-pre-investigation.md` (Explore agent sweep 发现 3 个 sibling latent bugs)
**Phase**: R4 步骤 ① (Self-audit by Manager)

---

## R4 目标 (基于 sweep 输入)

修 3 个 sibling latent bugs (`addRow` / `updateRow` / `deleteRow` 缺 `@Transactional`) + 加 3 个 deep round-trip test 配套 (J1-F / J1-G / J1-H), 让 sub-table CRUD 在 production 真的能写得进去/改得了/删得掉. R4-② 用独立 agent 扩面 sweep 找剩余 60+ controllers 中的第 4/5 个潜在 sibling.

**Threshold**: ≥98% PASS / ≤1 WARN (R4 标准). 已超 R5 标准 (100%/0/0) 不是问题, 但**这一轮的成败标志不是数字, 而是 "3 个 known bugs 的 fix + test 全部闭环 + sweep 扩面没漏掉新实例"**.

---

## 计划改动 (8 项)

### Backend P0 (3 项)

#### P0-1: `DynamicTableService.addRow` 加 `@Transactional`
- **文件**: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicTableService.java` (大约 line 133-148, 待精确定位)
- **改动**: 在方法签名上方加 `@org.springframework.transaction.annotation.Transactional`
- **风险**: LOW. 单方法事务, 无嵌套事务风险, 与 R3 P0-6 相同模式.
- **理由**: 与 R3 setCustomFields 相同根因 — `INSERT...RETURNING` via `queryForMap` 在 hikari auto-commit=false 下静默 rollback

#### P0-2: `DynamicTableService.updateRow` 加 `@Transactional`
- **文件**: 同上 (大约 line 149-165)
- **改动**: 同 P0-1
- **风险**: LOW
- **理由**: `UPDATE ... WHERE id = ? AND parent_id = ?` 静默丢失

#### P0-3: `DynamicTableService.deleteRow` 加 `@Transactional`
- **文件**: 同上 (大约 line 167-180)
- **改动**: 同 P0-1
- **风险**: LOW
- **理由**: `DELETE FROM ... WHERE id = ? AND parent_id = ?` 静默无效

**为什么这次加在 service 层而非 controller 层** (与 R3 P0-6 不同):
- R3 P0-6 加在 controller 是 surgical hot fix, 因为当时 R3 Phase E 测试只跑了 setCustomFields 一个调用方
- R4 这次同时改 3 个 service 方法, 加在 service 上更对称 + 后续 R5 要做的 "@Transactional 上移到 service" 架构清理 (R3 backlog #1) 已经一并完成了
- service 级 @Transactional 的好处: 任何调用方 (无论 controller-direct 还是 service-to-service) 都受保护
- 已确认: 现有 service-to-service callers (`MaterialBatchServiceImpl` 等) 已经有自己的 outer `@Transactional`, 内层 service `@Transactional` 默认 propagation = REQUIRED, 不冲突

**还有一个候选: 是否同时把 R3 P0-6 的 controller-level `@Transactional` 移到 service 层?**
- 倾向: **R4 不做**, 留 R5
- 原因: R4 scope 已经够大 (3 backend + 3 deep test + R4-② 扩面 sweep), 加 controller-to-service 的 @Transactional 移动 = 1 个文件 + 1 次 deploy + 1 次 79+ tests 验证, 不必要塞进 R4
- R5 任务: 把 `setCustomFields` 的 controller-level `@Transactional` 移到 `setDynamicFields`, 重跑套件确认没回归

### Test Round-trip (3 项 + 共享辅助)

#### P0-4: J1-F deep round-trip — addSubTableRow positive path
- **文件**: `tests/canvas-security-e2e/j1-lifecycle.mjs` (新增 phaseF 函数)
- **testIds**: `J1-F0` (locate parent record + sub-table fieldCode) → `J1-F1` (POST add a row) → `J1-F2` (GET parent + sub-table, assert new row visible with expected payload) → `J1-F3` (cleanup: DELETE the row, best-effort)
- **depth tag**: `[depth=deep]` on F2 (the readback assertion). F0/F1/F3 are `[depth=medium]`.
- **关键**: parent record 用 J1 已经创建的 F002 sales order; sub-table fieldCode 用 phaseA3 创建的 `prepay${SUFFIX}` (SUB_TABLE 类型字段). row payload 用 SUFFIX 嵌入唯一标识符避免 cross-run 污染.
- **会 FAIL 当**: backend addRow 没加 @Transactional → POST 200 + row data → GET parent 看不到 row (silent rollback)

#### P0-5: J1-G deep round-trip — updateSubTableRow positive path
- **文件**: 同上 (新增 phaseG)
- **testIds**: `J1-G0` (need a row first — use the row left by F1, or create fresh) → `J1-G1` (PUT update with new payload) → `J1-G2` (GET parent, assert row's column matches new payload) → `J1-G3` (cleanup)
- **depth tag**: `[depth=deep]` on G2
- **关键**: G 必须依赖 F 已经创建过 row, 或者 G 自己先 POST 一行. 倾向后者 (each phase self-contained, easier to debug)

#### P0-6: J1-H deep round-trip — deleteSubTableRow positive path
- **文件**: 同上 (新增 phaseH)
- **testIds**: `J1-H0` (need a row first) → `J1-H1` (DELETE) → `J1-H2` (GET parent, assert row NOT in response — exact-not-just-different)
- **depth tag**: `[depth=deep]` on H2
- **关键**: assert "row absent" 比 assert "row mutated" 更难做对 — 必须按 row id 严格筛, 不是按行数

**共享 helper**: 三个 phase 都需要"discover parent record + parent's sub-table fieldCode + an existing sub-table API path". 抽一个 `_phaseF_G_H_setup(token)` helper 做发现, 减少重复.

### R4-② Critic 强制扩面 sweep (Rule 9)
- **不是代码改动**, 而是 R4-② 的 audit phase 必须 dispatch 独立 Explore agent
- 任务: 扫描 `com.cretas.aims.controller/` 下 60+ controllers, grep 模式 `jdbcTemplate.update\|jdbcTemplate.execute\|jdbcTemplate.queryForMap.*INSERT\|jdbcTemplate.queryForMap.*UPDATE\|jdbcTemplate.queryForMap.*DELETE`, 对每个匹配验证 `@Transactional` 在调用链上的存在
- 输出: 一份 R4-② audit doc 含独立 agent 的 verbatim 输出 + agent ID
- 如果发现新 sibling instance: 加入 R4 backlog (不 deferr 到 R5), R4-④ 一并修 + 加 deep test
- 如果 sweep 干净: R4-④ 只跑 3 个已知 bug 的 fix + test

---

## 配套规则检查 (Rules 1-9 验证)

| Rule | R4 计划是否符合 | 备注 |
|---|---|---|
| **Rule 1**: every test has depth label | ✅ 新 testIds 全部 `[depth=deep]` 或 `[depth=medium]` 标记, 写在 evidence 字符串里 (与 R3 phaseE 同模式) |
| **Rule 2**: ≥1 deep test per round | ✅ 3 个新 deep test (F2 / G2 / H2), 远超 ≥1 |
| **Rule 3**: audit asks bug-discovery capability | ✅ R4-⑤ audit doc 必须答 "如果 backend addRow 仍然没 @Transactional, J1-F2 会 FAIL 吗?" 答案: **会** (这正是测试设计目标) |
| **Rule 4**: no "next round" phrases | ✅ R4 backlog 全部当前轮处理, R5 留的事项 (上移 @Transactional, setClauses 语义) 都有具体技术原因 |
| **Rule 5**: Critic scrutinizes depth | ✅ R4-② Critic 必须问 3 个 deep test 真的是 deep 还是包装 medium (回答: phaseF/G/H 都做 readback assertion, 不是 fire-and-forget) |
| **Rule 6**: §1.3 hard rules > §8.2 numbers | n/a (canvas-security-e2e 不用 §1.3/§8.2 数字 spec) |
| **Rule 7**: depth breakdown in summary | ✅ R4-⑤ audit doc 必须包含 depth breakdown 表 |
| **Rule 8**: same-cause sweep | ✅ **本次 R4 的核心** — pre-investigation doc 已经做了一次 sweep (3 个 sibling 发现), R4-② 还要做一次扩面 sweep |
| **Rule 9**: independent Critic | ✅ R4-② 和 R4-⑤ 都必须用独立 agent (Explore 或 code-reviewer subagent), 不能 self-impersonate |

---

## R4-② 必须问 Critic 的问题列表

(R4-② Manager prompt 的 mandatory section)

```
你现在是 Critic agent for canvas-security-e2e R4. 你必须独立验证以下 5 点:

1. R4 计划修 3 个 sibling latent bugs (DynamicTableService addRow/updateRow/deleteRow 缺 @Transactional). pre-investigation 已经发现这 3 个. 但 sweep 只覆盖了 DynamicFieldController + SchedulingOptimizationController 两个 controller 文件. 整个 com.cretas.aims.controller 包还有 60+ 个 controller 文件未扫. **你必须 grep 整个包**, 找出所有满足以下两个条件的 controller method:
   - method body 调用了某个 service method 名字 like `*update*`/`*save*`/`*delete*`/`*add*`/`*create*`
   - 该 service method 没有 @Transactional, 或者 service method 用了 raw `jdbcTemplate.update/execute/queryForMap` (INSERT/UPDATE/DELETE)
   - 列出每个发现, 标记 vulnerable / safe / needs-verification

2. R4 计划在 service 层 (DynamicTableService) 加 @Transactional. R3 是在 controller 层 (DynamicFieldController) 加. 这两个不一致是有意还是无意? 如果 R5 计划要把 R3 的 controller-level @Transactional 移到 service 层, 现在 R4 service-level 是不是已经覆盖了 R3 那个 endpoint? — **回答**: **没有**. R3 修的是 setCustomFields → setDynamicFields 这条调用链, 与 R4 修的 addRow/updateRow/deleteRow 是不同的 service. 所以 R4 service-level fix 不会自动涵盖 R3. R5 仍然需要做 R3 的 @Transactional 上移. 验证我说的是否正确.

3. J1-F/G/H 的 readback assertion (Rule 1 deep) 是否真的 deep? 具体: 测试设计 "POST row → GET parent → assert row visible". 如果 backend 的 GET endpoint 用了 in-memory cache 而不是真查 DB, GET 可能返回 stale 数据 — 这种情况下 even with hikari rollback, GET 可能 (a) 返回 row (cache 还没失效) (b) 返回 nothing (cache miss → query DB → no row). 哪种行为下测试是真有效的? 检查 `DynamicFieldService.getDynamicFields` 是否有 cache 层.

4. cleanup phase (F3/G3/H3) 是 best-effort. 如果 cleanup 自己 silent fail (因为 deleteRow 也是 vulnerable 的), 后续 run 会有脏数据. 这是不是会让第二次 run 因为脏数据出 FAIL? 设计 cleanup 时如何隔离这个风险?

5. 同 controller 还有 R4 没列入 scope 的 endpoints: `createField`, `updateField`, `addField`, `applyTemplate`, `publishDynamicField` 等. 它们用 JpaRepository 看似 safe, 但 sweep 时是否真的逐个验证过? 还是只是"看起来用 JPA 就放过"?

对每个问题 **必须用 Read/Grep 验证**, 不要凭印象答. 任何"我认为"必须配 file:line 引用.

你的答案会作为 R4-② audit doc 的核心内容, 不能 paraphrase, 必须 verbatim 引用.
```

---

## R4 执行顺序 (R4-④)

1. **改 backend** — 加 3 个 `@Transactional` (用 `mvnw compile` 验证)
2. **写 phaseF/G/H** — 在 j1-lifecycle.mjs 加 3 个新函数 + main() 调用
3. **本地 dry-run** — 跑 j1-lifecycle.mjs 一次, 看新 phase 是否会**因为 backend 还没 deploy 而 FAIL** — 这是 red phase (TDD), 期望 J1-F2/G2/H2 全 FAIL
4. **deploy backend to test 10011** (`./scripts/deploy/deploy-backend.sh --env test`)
5. **等 health check** (`curl localhost:10011/api/mobile/health`)
6. **跑 full suite × 2 independent runs** (RUN_ID=R4-run1 / R4-run2), 期望 79 + 9 = 88 testIds (或视合并情况)
7. **R4-⑤ audit** — 用独立 agent
8. **R4-⑥** — 处理 R4-② sweep 如果发现新 instance, 同一轮内修
9. **R4-⑦** — verification + commit

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Service-level @Transactional 与现有 caller 的 @Transactional 嵌套出 propagation 问题 | LOW | MED | 默认 propagation = REQUIRED, Spring 自动 join 外层 tx, 一般无问题. 跑完 79 个 R3 测试做 regression check. |
| R4-② 扩面 sweep 发现 5+ 个新 sibling, R4 scope 爆炸 | LOW | HIGH | 阈值: ≤3 新发现就同轮修, ≥4 个就先 commit R4 known fix + 单独 R5 处理 sweep 余下 |
| J1-F/G/H 三个 phase 互相依赖 (G 依赖 F 留下的 row) | MED | LOW | 设计上 G/H 自己 POST 一行, 不依赖 F. 每个 phase self-contained. |
| Cleanup phase 脏数据污染 R4-run2 | MED | LOW | row 用 SUFFIX 嵌入 timestamp, 同 SUFFIX 不会两次 run 重叠. 如果 cleanup 失败, 留下的脏数据有独立 timestamp, 不影响下次 run. |
| Backend deploy 健康检查 false negative (与 R3 一样需要 180s+) | HIGH | LOW | 手动 curl localhost:10011/health 验证, deploy script 健康检查超时不影响进程实际可用 |

---

## R5 backlog (有具体技术原因, 不是 deferral)

1. **上移 R3 P0-6 的 controller-level `@Transactional` 到 `DynamicFieldService.setDynamicFields`** — R4 不做是因为 scope 已大. 上移本身改动很小 (1 行删, 1 行加), 但需要重跑 79+ 套件确认无回归. 适合 R5 单独处理.
2. **`DynamicFieldService.setDynamicFields setClauses.isEmpty() return` 早返回的语义决策** — 是否应该在 fields 非空但 defMap 全无匹配时抛 "字段不存在" exception? 需要审查所有 caller (`MaterialBatchServiceImpl.createMaterialBatch` 等) 的期望行为. R5 用 ADR + caller audit 处理.
3. **如果 R4-② Critic sweep 发现 5+ 个新 sibling 实例**, 多余的会进 R5. 但根据 Pre-investigation 估计 0-5, 概率 R5 没新增工作.

---

**Status**: R4-① 完成. 进入 R4-② (Rule 9 强制独立 agent 跑 Critic).
