# Canvas E2E R3 Plan Audit — Agent-team 4 阶段审计

**日期**: 2026-04-14
**范围**: R3 执行方案 (消除 R2 遗留的 J4-4 WARN)
**前置**: R2 audit doc 中的 R3 backlog (P0 + P1a + P1b + P2)

---

## 0. 核心决策: **GO 🟢**

R3 是一个小而精确的 round:
- **P0 backend fix**: `DynamicFieldController.setCustomFields/getCustomFields` 各加 1 行 `dynamicTableService.verifyParentOwnership(...)` → 消除 J4-4 silent-success 路径
- **P1a 质量护栏**: `run-all.sh` RUN_ID 产物后缀 — 永久封堵 "cp 假 R2" 反模式
- **P1b 质量护栏**: `webLogin()` WEB_URL drift 自检 — 早期发现环境漂移
- **P2 规则固化**: feedback memory 写入 "两次独立 run 的定义"

预期结果: **74/74 PASS / 0 FAIL / 0 WARN** × 2 independent runs.

---

## Phase 1: Research (2 Researchers, 并行)

### Researcher A — 后端代码 ground truth
目的: 精确定位修复点, 不凭假设操作

**发现**:
- **Controller**: `backend/.../controller/DynamicFieldController.java:282-290` (注意: 无 `dynamictable` 子目录)
  ```java
  @PutMapping("/{moduleCode}/{recordId}/custom-fields")
  public ResponseEntity<Void> setCustomFields(
          @PathVariable String factoryId,
          @PathVariable String moduleCode,
          @PathVariable String recordId,
          @RequestBody Map<String, Object> fields) {
      dynamicFieldService.setDynamicFields(factoryId, moduleCode, recordId, fields);
      return ResponseEntity.ok().build();
  }
  ```
- **Service impl**: `backend/.../engine/DynamicFieldService.java:204-249` — **关键 bug 位置**:
  ```java
  if (setClauses.isEmpty()) return;  // L237 — silent success, 在 WHERE factory_id=? 之前
  ```
- **verifyParentOwnership**: `engine/DynamicTableService.java:43-76`, 签名 `(String moduleCode, String parentId, String factoryId)`, 抛 `BusinessException`
- **已注入**: `dynamicTableService` 已作为 `private final` 字段在 DynamicFieldController.java:33, 被 4 个 sub-table endpoint 使用 (lines 210, 234, 250, 266)
- **BusinessException → HTTP 400** via `GlobalExceptionHandler:125-132`

**结论**: 修复只需 1-2 行代码, 无新增依赖, 无新增异常类.

### Researcher B — 风险与副作用分析
目的: 评估 "加 verifyParentOwnership" 会否破坏其他路径

**发现**:
1. **`dynamicTableService` bean 已在线**: 无需 @Autowired, 无 import 新增
2. **发现 GET 端点 (`getCustomFields` line 274-280) 同样缺 verifyParentOwnership** — 一并修复 (零 E2E 覆盖但是纯防御加固)
3. **service 层 callers 全部同租户**: MaterialBatchServiceImpl / ProductionPlanServiceImpl / QualityInspectionServiceImpl 都是从自己的 entry 传入 factoryId → 不会被新检查影响
4. **J1 lifecycle + J3 consumer 测试不调用 `/custom-fields`** (已 grep 验证): J1 只操作 config, J3 consumer 自述 "current scope does NOT cover setDynamicFields flows"
5. **测试 predicate 已就位**: J4-4 `apiBlockedSoft = (status >= 400 && status !== 403) || !result.success` 会正确接受 HTTP 400 作为 PASS

**结论**: **零回归风险**, P0 可以上.

---

## Phase 2-3: Critic 挑战 (代码验证)

三个关键假设全部被读码验证:

### Challenge A — silent-success 根因
**Verdict**: SUPPORTED

证据 `DynamicFieldService.java:204-249`:
```java
for (Map.Entry<String, Object> entry : fields.entrySet()) {
    CanvasDynamicField def = defMap.get(entry.getKey());  // 按 F_B 的 defMap 过滤
    if (def != null && ...) { setClauses.add(...); }
}
if (setClauses.isEmpty()) return;  // L237 silent exit — 从未到 WHERE factory_id=?
```

攻击者 F_B 调用 F_B URL 写 F_A 记录的 `customer_level` (F_B 没这个字段) → defMap 无匹配 → setClauses 空 → L237 return → controller 返回 HTTP 200. WHERE 子句**形同虚设**. 修复必须在 Controller 层.

### Challenge B — J1 lifecycle 不被打断
**Verdict**: SUPPORTED

Grep 全部 j1-lifecycle.mjs (802 行) `custom-fields` 匹配: **0 条**.  
J1 只调用: `POST /config/v2/dynamic-fields`, `PUT /config/v2/dynamic-fields/{code}`, `POST /config/publish`, `PATCH /config/modules/{code}/toggle` 等 config-level 端点. 不触碰 `/{moduleCode}/{recordId}/custom-fields`.

J3 consumer 自述 (`EVIDENCE.md:23`, `j3-consumer.mjs:20`) 不覆盖 setDynamicFields 流程. 目前 setDynamicFields 的**唯一 E2E 测试路径就是 J4-4 的跨租户攻击场景**.

加 verifyParentOwnership **零回归**.

### Challenge C — J4-4 apiBlockedSoft 接受 400
**Verdict**: SUPPORTED

`j4-cross-tenant.mjs:310`:
```js
const apiBlockedHard = result.status === 403;
const apiBlockedSoft = (result.status >= 400 && result.status !== 403) || !result.success;
```

+ `canvas-test-helpers.mjs` `apiCall` 不抛 4xx, 返回 `{status: 400, success: false}`.
→ 两个条件都成立 → 落入 `apiBlockedSoft` → **PASS**.

R2-⑥ 的断言收紧已为 R3 修复预留了 landing pad.

---

## Phase 4: Integrator — 最终 R3 执行计划

### R3 Action List (按顺序)

| # | Action | 文件:行 | 变更 | 风险 |
|---|---|---|---|---|
| **P0-1** | `setCustomFields` 加 verify | `backend/.../controller/DynamicFieldController.java:282-290` | 加 1 行 `dynamicTableService.verifyParentOwnership(moduleCode, recordId, factoryId);` 在 `setDynamicFields()` 调用之前 | LOW |
| **P0-2** | `getCustomFields` 加 verify | `DynamicFieldController.java:274-280` | 同样加 1 行 `verifyParentOwnership` 在 `getDynamicFields()` 调用之前 | LOW |
| **P0-3** (补) | 对齐 sub-table 的 validateModuleCode/validateIdentifier | `DynamicFieldController.java:274-280 + 282-290` | 加 `validateModuleCode(moduleCode)` + `validateIdentifier("recordId", recordId)` 与 sub-table 端点 (L208/232/248/264) 一致 | LOW |
| **P1a** | `RUN_ID` 环境变量产物后缀 | `tests/canvas-security-e2e/run-all.sh` + `canvas-test-helpers.mjs` (`createResultCollector`) | helpers `save()` 用 `RUN_ID` fallback 默认; run-all.sh 聚合改 glob | LOW |
| **P1b** | `WEB_URL drift check` | `canvas-test-helpers.mjs webLogin()` | 登录成功后 origin 不匹配立即 throw | LOW |
| **P2** | feedback memory 规则 | `C:\Users\Steve\.claude\projects\...\memory\feedback_*.md` | 新增 "independent runs" 规则 | ZERO |

### R3 执行步骤

1. **Implement P0-1, P0-2, P0-3** (backend 改动 ~4 行代码)
2. **Implement P1a, P1b, P2** (test + doc 改动)
3. **code-reviewer review** 所有改动 (step ③ 一并完成)
4. **Deploy backend to test env 10011**: `./scripts/deploy/deploy-backend.sh --env test`
5. **Run E2E suite × 2 times** with distinct RUN_IDs
6. **Agent-team audit R3 results** (step ⑤)
7. **Fix any regression + code-review** (step ⑥)
8. **verification-before-completion + commit** (step ⑦)

### R3 Exit Criteria

| 指标 | 目标 | R3 阈值 (framework) |
|---|---|---|
| Total | 74 | — |
| PASS | 74 (100%) | ≥95% |
| FAIL | 0 | 0 (强制) |
| WARN | 0 | ≤3 |
| 独立 run 次数 | 2+ | 2+ |

**成功状态**: 两次独立 run 均 74/74 PASS / 0 FAIL / 0 WARN.

### R4 Carryover (非 R3 scope)

1. **(MED) setCustomFields 正向路径 0% E2E 覆盖** — R3 修复 verifyParentOwnership 后, 若 J1/J3 未来调用 setCustomFields 传错 recordId 会静默 break. **R4 任务**: J3 加 1 个 `restaurant_admin1 PUT /F002/sales_order/{ownRecordId}/custom-fields` PASS case 做对照.
2. **(LOW) service 层 `setClauses.isEmpty() return` 依旧 silent** — 同租户攻击者猜字段名但字段不存在仍静默返回 200. R3 不改 (会破坏合法"部分字段更新"语义). **R4 评估**: 是否在 `fields 非空但 defMap 全无匹配` 时抛 `BusinessException("所有字段均未在当前工厂定义")`.
3. **(LOW) `getCustomFields` 修复无 E2E 覆盖** — P0-2 是纯防御加固. **R4 任务**: j4-cross-tenant.mjs 加 `J4-4b apiGet(FACTORY_B/.../custom-fields, tokenB)` 验证 HTTP 400.

---

**Go/No-Go**: **GO 🟢**. 3 个 Critic 挑战全部 SUPPORTED 无翻盘, P0 修复 3 行代码最小变更最大收益, R3 完成后消除 J4-4 唯一 WARN, R4 carryover 清单清晰非阻塞.

**最后更新**: 2026-04-14 18:30Z
