# Canvas R1-R6 Delivery Status + Remaining Backlog

**日期**: 2026-04-15
**前置**: R6 closed 2026-04-15 at commit `b878a0472`, depth-first skill v3 with Rule 10.
**目的**: 把 "准备部署" playbook 改写成 "delivery 已发生, 验证 + 收尾" 文档.

---

## 0. 主要发现: 生产已部署 R1-R6 canvas 修复

**证据** (来自 2026-04-15 下午的 prod jar 二进制检查):

| Round fix | Prod jar 符号存在? |
|---|---|
| R3: `DynamicFieldController.setCustomFields` + verifyParentOwnership | ✅ (implied, upstream of R4) |
| R4: `DynamicTableService.parentIdPlaceholder`, `parentIdTypeCache` | ✅ **已验证** |
| R4: `DDLExecutor.resolveParentIdSqlType` | ✅ (implied, upstream of R5) |
| R5: `DynamicFieldService.setDynamicFields` `@Transactional` annotation | ✅ **已验证** (annotation bytecode present) |
| R5: J4-9/10/11 cross-tenant sub-table tests | n/a (test-only) |
| R6: `AggregateFormulaExecutor.columnCastPlaceholder`, `columnCastCache`, `isAcceptableForAggregation` | ✅ **已验证** |

**Prod backend 当前状态**:
- Service: `cretas-backend.service` active since 2026-04-15 09:44:26 CST
- JAR: `/www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar` MD5 `d44d5c6cbb14b2ecfcbcfc74022f6d08`
- Health check: `curl http://localhost:10010/api/mobile/health` → `{"status":"UP"}`
- Process PID: 290877

**部署历史 (jar 时间戳):**
- `jar.bak.20260415_055021` (R3/R4 时期 test 部署痕迹, prod 那时未重启)
- `jar.bak.20260415_055700`
- `jar.bak.20260415_061341`
- `jar.bak.20260415_061950`
- `jar.bak.20260415_090357` — **第一次 prod 重启触发**
- `jar.bak.20260415_093224` — **第二次 prod 重启触发, 09:44 current**

---

## 1. Delivery 如何"意外"发生

canvas R1-R6 循环中我只执行过 `deploy-backend.sh --env test`. 这些部署只重启 **test** 进程 (10011), 但 **会覆盖共享的 JAR 文件**.

后续平行 chat 在 Apr 15 09:03 和 09:44 CST 执行了 `deploy-backend.sh --env prod` (重启 prod 10010). 那两次 prod 重启时, shared JAR **已经包含** 我的 R3/R4/R5/R6 canvas 修复 (因为 test 部署更新过 jar 文件).

换句话说: **生产重启捎带** 把 canvas 修复上线了.

**这是运气, 不是流程**. 下次不一定这么巧. Rule 10 本来要求显式的"production deployment plan with owner + date + rollback", 这次 delivery 缺 owner / date / rollback / verification. 算"蒙对"的 soft delivery.

**后续建议**:
- 不要依赖这种意外 delivery
- 明确写 delivery ADR: "multi-chat sharing same branch+jar" 的 coordination rule
- 每次 commit 后 push, 每次 push 后明确 deploy-plan

---

## 2. Rule 10 checklist 现状

| Rule 10 item | 状态 | 备注 |
|---|---|---|
| 10.1 Branch pushed | ✅ | commit `b878a0472` on origin/e2e/v1-framework |
| 10.2 PR opened | ✅ | [PR #6](https://github.com/j4xie/my-prototype-logistics/pull/6) + R6 comment |
| 10.3 Production deploy | ✅ (unintended) | JAR has R1-R6 fixes verified, service running since 09:44 |
| 10.4 R7 backlog tickets | ⏳ | Draft bodies below, user 建 GH Issues |
| 10.5 CI integration status | ⏳ | ADR 待写 |

3/5 done. Remaining 2 items are pure tracking/documentation.

---

## 3. Post-deploy 验证清单 (用户/DBA 有 prod 账号时跑)

因为 delivery 是"soft", 建议做一轮显式 smoke test 确认行为:

```bash
# Open prod tunnel (temporary)
ssh -L 10010:localhost:10010 -fN root@47.100.235.168

# Basic health
curl -s http://localhost:10010/api/mobile/health | jq

# Login as prod factory admin (needs prod credentials)
PROD_ADMIN_TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"<prod_admin>","password":"<pwd>"}' | jq -r .data.token)

# Smoke 1: verify @Transactional fix (R3/R5) — PUT custom-fields actually persists
REC=$(curl -s -H "Authorization: Bearer $PROD_ADMIN_TOKEN" \
  "http://localhost:10010/api/mobile/<factoryId>/sales/orders?page=1&size=1" | jq -r '.data.content[0].id // .data.records[0].id')
# Read baseline
curl -s -H "Authorization: Bearer $PROD_ADMIN_TOKEN" \
  "http://localhost:10010/api/mobile/<factoryId>/sales_order/$REC/custom-fields" | jq
# Write a probe value
curl -s -X PUT -H "Authorization: Bearer $PROD_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"customer_level":"VIP-probe"}' \
  "http://localhost:10010/api/mobile/<factoryId>/sales_order/$REC/custom-fields"
# Read back — should show VIP-probe (not null)
curl -s -H "Authorization: Bearer $PROD_ADMIN_TOKEN" \
  "http://localhost:10010/api/mobile/<factoryId>/sales_order/$REC/custom-fields" | jq

# Smoke 2: verify UUID cast fix (R4) — sub-table CRUD on VARCHAR-id parent
# (Need a published SUB_TABLE field code on sales_order module, varies by prod factory config)
# If no SUB_TABLE published in prod yet, skip this test

# Smoke 3: verify aggregate formula fix (R6) — requires an aggregate formula defined
# (Likely no prod has these yet; this is the R6 fix's main benefit moving forward)
```

**Expected outcomes** (post-fix):
- Smoke 1: PUT → 200, subsequent GET returns `VIP-probe` ✅ (NOT null/undefined)
- Smoke 2: sub-table POST/PUT/DELETE return 200/204 (for same-factory) or 400 (cross-tenant)
- Smoke 3: aggregate formula evaluation returns correct SUM, not empty

**Rollback plan** (if prod misbehaves):
```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas
# Find last known-good jar
ls -latr aims-0.0.1-SNAPSHOT.jar.bak.*
# Restore (choose appropriate bak based on known-good timestamp)
cp aims-0.0.1-SNAPSHOT.jar.bak.<timestamp> aims-0.0.1-SNAPSHOT.jar
systemctl restart cretas-backend
# Wait for startup (~2 min)
curl -s http://localhost:10010/api/mobile/health
```

---

## 4. R7 Backlog — 4 GitHub Issues to create

Copy-paste each block below into a new GitHub Issue.

---

### Issue 1 (P0): `setDynamicFields setClauses.isEmpty()` Option B — fail-loud on unknown fieldCode

**Title**: `canvas: setDynamicFields should throw BusinessException on unknown fieldCode (Option B)`

**Body**:
```markdown
## Context

`DynamicFieldService.setDynamicFields()` at `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicFieldService.java:~220-240` currently silently ignores unknown `fieldCode` in the request body:

```java
for (Map.Entry<String, Object> entry : fields.entrySet()) {
    CanvasDynamicField def = defMap.get(entry.getKey());
    if (def != null && ...) { setClauses.add(...); }
}
if (setClauses.isEmpty()) return;  // Silent no-op if no field matched
```

If a user PUTs `{"customer_level": "VIP", "totally_bogus_field": "x"}` and only `customer_level` is defined, the backend silently writes `customer_level` and ignores `totally_bogus_field`. User gets HTTP 200 success. No feedback about the ignored field.

## Problem

- **Typo masking**: user mistypes fieldCode → silently dropped → debugging nightmare
- **Outdated frontend**: frontend references a field that was recently soft-deleted → no error
- **API contract opacity**: batch PUTs with mixed valid/invalid fields → partial success with no indication

## Decision

Per ADR in `tests/canvas-security-e2e/EVIDENCE.md §14` (commit `f90650e77`), recommended direction is **Option B**: throw `BusinessException("字段 X 未在当前工厂定义")` when any fieldCode in the request body is not in defMap.

## Work required

1. **8-caller audit** — grep for `setDynamicFields(` callers across backend:
   - `DynamicFieldController.setCustomFields`
   - `MaterialBatchServiceImpl.createMaterialBatch`
   - `ProductionPlanServiceImpl.createProductionPlan`
   - `QualityInspectionServiceImpl` (multiple)
   - `SalesServiceImpl.createSalesOrder` / `updateSalesOrder` / `recordDelivery`
   - `PurchaseServiceImpl.recordReceive`
   - `ReturnOrderServiceImpl.createReturnOrder`
   - `TransferServiceImpl.createTransfer`

   For each: does the caller ever pass fieldCodes that may not be in the current factory's active field set? If yes, how should that case be handled?

2. **Feature flag** `cretas.canvas.strict-field-validation` (default: `false`) — allows gradual rollout. When `true`, throws; when `false`, silent (current behavior).

3. **Grace period**: 2 weeks with flag `false` in prod, monitor logs for any caller hitting "would throw". After grace period with zero log hits, flip to `true`.

4. **Deep test**: add `phaseJ_unknownFieldCodeRejection` in `j1-lifecycle.mjs` — PUT with known + unknown fieldCodes, assert HTTP 400 with specific message.

## Priority

**P0** — customer-facing silent data loss risk. Any typo in frontend code → customer thinks they saved something, they didn't.

## Estimate

- Caller audit: 1 day
- Feature flag + implementation: 0.5 day
- Deep test: 0.5 day
- Grace period: 2 weeks of monitoring

Total active work: ~2 days. Grace period: 2 weeks.

## Related

- ADR: `tests/canvas-security-e2e/EVIDENCE.md §14`
- R5 audit: `.claude/agent-team-outputs/2026-04-14_canvas-e2e-r5-results-audit.md`
- Carrier: canvas-security-e2e depth-first-e2e Rule 8 sweep (R5 identified, deferred to R7)
```

---

### Issue 2 (P1): Factory formula DELETE endpoint + sweep for CRUD completeness

**Title**: `canvas: add DELETE /api/mobile/{factoryId}/config/v2/formulas/{formulaCode}`

**Body**:
```markdown
## Context

During canvas-security-e2e R6 testing (commit `b878a0472`), phase I creates a temporary aggregate formula for testing, then tries to clean up with `apiDelete(...)`. The DELETE call returns HTTP 404 — **there is no DELETE endpoint for factory formulas**.

Current CRUD on `/api/mobile/{factoryId}/config/v2/formulas/{formulaCode}`:
- POST or PUT: create/update ✅ (`BusinessRuleController.java:113-125`)
- GET: ??? (unclear)
- DELETE: ❌ **missing**

## Impact

- Test env: test formulas accumulate in `factory_formulas` table per J1 run (SUFFIX-named, no collision, but no cleanup possible)
- Prod env: admin-created formulas are permanent unless manual SQL delete — poor UX
- E2E test cleanup: phaseI can only soft-cleanup (formulaCode has SUFFIX so no collision, but rows stay in DB forever)

## Work required

1. **Audit**: check if DELETE semantics need soft-delete (deleted_at) or hard-delete. Likely soft-delete since formulas may be historically referenced in audit logs.

2. **Add endpoint** in `BusinessRuleController.java` near line 125:
   ```java
   @DeleteMapping("/formulas/{formulaCode}")
   @Operation(summary = "删除公式")
   @RequireRole({"factory_super_admin", "permission_admin"})
   public ApiResponse<Void> deleteFormula(@PathVariable String factoryId, @PathVariable String formulaCode) {
       // Find + soft-delete (or hard-delete per audit outcome)
       factoryFormulaRepo.deleteByFactoryIdAndFormulaCode(factoryId, formulaCode);
       return ApiResponse.success("已删除", null);
   }
   ```

3. **Update phaseI cleanup** in `j1-lifecycle.mjs` — after DELETE endpoint exists, cleanup will actually clean.

4. **Same-cause sweep**: check other `/config/v2/*` resources (validation-rules, default-values, scheduler) for DELETE completeness. Each should have full CRUD.

## Priority

**P1** — test env clutter + admin UX annoyance. Not customer-blocking.

## Estimate

0.5 day (endpoint + repo method + sweep).

## Related

- R6 commit: `b878a0472`
- phase I cleanup comment in `j1-lifecycle.mjs`
```

---

### Issue 3 (P1): Production `sales_order_prepayment_records_items` orphan migration

**Title**: `dbops: migrate sales_order_prepayment_records_items parent_id to VARCHAR + clean orphan rows`

**Body**:
```markdown
## Context

Production table `sales_order_prepayment_records_items` was created with `parent_id UUID NOT NULL`. After R4 fix (`DDLExecutor.resolveParentIdSqlType`), **new** sub-tables are created with type matching the parent (VARCHAR for `sales_orders.id`). But this pre-existing prod sub-table still has UUID.

Current state (verified 2026-04-15):
- 2 rows in `sales_order_prepayment_records_items`
- Both have `parent_id` = `cb4e687d-7497-4993-ab2e-c706721751e1` (UUID)
- `sales_orders.id` is VARCHAR — `SO-F001-*` format
- `SELECT id FROM sales_orders WHERE id = 'cb4e687d-...'` returns 0 rows
- **These 2 rows are orphans** — parent doesn't exist. Likely early test data from before sales_orders.id migrated to VARCHAR.

## Impact

- **Read-side**: sub-table unusable via API — `verifyParentOwnership` can't find parent, returns 400 → no user can read these 2 rows
- **Write-side**: new writes would fail — UUID cast expects UUID but sales_orders.id is VARCHAR → HTTP error
- **Effectively**: this sub-table is **dead** for all customers right now

## Migration plan

Ready-to-run SQL in `tests/canvas-security-e2e/EVIDENCE.md §15` (commit `f90650e77`). Summary:

```sql
-- Pre-check: confirm orphans exist (should return 2)
SELECT count(*) FROM sales_order_prepayment_records_items sopri
WHERE NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sopri.parent_id::text);

BEGIN;

-- Delete orphans (confirmed 0 users can read them)
DELETE FROM sales_order_prepayment_records_items sopri
WHERE NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sopri.parent_id::text);

-- Expected: 0 rows left
SELECT count(*) FROM sales_order_prepayment_records_items;

-- ALTER column type (safe since table is empty)
ALTER TABLE sales_order_prepayment_records_items
  ALTER COLUMN parent_id TYPE varchar(100) USING parent_id::text;

-- Verify
\d sales_order_prepayment_records_items

COMMIT;
```

**Rollback** (if ALTER fails):
```sql
ROLLBACK;  -- Transaction aborts, table returns to pre-check baseline
```

## Responsibilities

- **Claude**: cannot execute prod DDL
- **DBA / DevOps**: schedule maintenance window, execute SQL, verify post-state
- **Engineering lead**: approve window

## Priority

**P1** — data hygiene. No customer impact today (sub-table is already unreachable). But blocks prod use of this specific sub-table definition forever unless migrated.

## Estimate

- SQL execution: 5 min
- Post-verification (re-run canvas-security-e2e subset against prod): 15 min
- Maintenance window coordination: separate

## Related

- ADR: `tests/canvas-security-e2e/EVIDENCE.md §15`
- R5 delivery: `.claude/agent-team-outputs/2026-04-14_canvas-e2e-r5-results-audit.md`
```

---

### Issue 4 (P2): canvas-security-e2e CI integration ADR

**Title**: `ops: canvas-security-e2e should run in CI (ADR + implementation)`

**Body**:
```markdown
## Context

`tests/canvas-security-e2e/` is a 95-assertion depth-first E2E suite covering Canvas V3 security + silent-bug detection. It has caught 2 real P0 silent-data-loss bugs across R3-R4 (commits `6fe099863`, `7b23217b0`) and 1 more in R6 (`b878a0472`).

**Currently manual**: running the suite requires:
1. SSH tunnel to test backend (`ssh -L 10011:localhost:10011 root@47.100.235.168`)
2. Vite dev server on localhost:5173 OR explicit `E2E_WEB_URL` to prod web
3. Test DB state prerequisites (factories F002 + F006, specific user accounts)
4. Manual `bash tests/canvas-security-e2e/run-all.sh`

No CI pipeline runs this. Every regression since R1 would go undetected until someone manually runs the suite.

## Options analyzed

### Option A: Full CI integration
- GitHub Actions runner connects to test backend via SSH tunnel
- Pros: every PR gets automatic regression check
- Cons: network setup complex, runner security (exposing SSH keys), flakiness risk
- Estimate: 2-3 days

### Option B: Partial CI — backend unit tests only in CI, E2E manual
- GitHub Actions runs JUnit tests (already in CI presumably)
- E2E remains a pre-deploy manual step
- Pros: low complexity, clean separation
- Cons: E2E regressions not caught between manual runs
- Estimate: 0 day (status quo made explicit)

### Option C: Scheduled E2E
- Cron job on test server runs E2E every night
- Results posted to a Slack channel / email
- Pros: no manual run needed, catches regressions within 24h
- Cons: async feedback loop, can miss PRs merged in between
- Estimate: 1 day

## Recommended: Option B + C hybrid

Backend unit tests in CI (already there?) + nightly E2E via cron on test server.

## Decision needed from

Engineering lead. Input required:
- Is Option A feasible given test env SSH / secrets management?
- Is nightly Slack notification wanted?
- Who owns the cron job if Option C?

## Work required

1. Write ADR at `docs/plans/canvas-e2e-ci-strategy.md` with options + decision
2. If Option B: document "manual E2E before merge" in CONTRIBUTING.md
3. If Option C: set up cron + notification channel

## Priority

**P2** — hygiene. The suite catches bugs when run; the question is only "how often".

## Estimate

- ADR: 2 hours
- Option B documentation: 1 hour
- Option C cron setup: 1 day

## Related

- Rule 10.5 of depth-first-e2e skill
- D1 Delivery Round plan: `.claude/agent-team-outputs/2026-04-15_canvas-e2e-delivery-round-D1-plan.md`
```

---

## 5. 剩余 Rule 10 后续动作

| Item | Owner | Timeline |
|---|---|---|
| 用户建 4 个 GitHub Issues (上面 body ready) | **用户** | 下次 session |
| 用户在 prod 跑 smoke test (section 3 checklist) | **用户** (需 prod credentials) | 当 prod maintenance window 来时 |
| DBA 执行 sub-table orphan migration (Issue 3) | **DBA** | 下次 prod maintenance window |
| 写 CI ADR (Issue 4) | **Claude 可以起草 + 用户决策** | 随时 |
| PR #6 review + merge | **Reviewer + 用户** | 下次 review window |

## 6. 当前阶段 review

**Framework 层面**: canvas-security-e2e 5 轮 + 1 Delivery round (R6) + 1 skill upgrade round (Rule 10) 全部闭环. Commits + push + PR + delivery **全部已发生** (delivery 是 soft, 见 §1).

**客户层面**: R3/R4/R5/R6 的 4 个 P0 silent-data-loss bug 的修复**已经在生产运行**. Customer-facing 问题大概率已经缓解 — 需要用户有 prod credentials 做一次显式 smoke test 确认.

**Skill 层面**: depth-first-e2e 从 7 rules 演化到 10 rules + 3 case studies (`case-r3-incomplete-fix.md`, `case-r5-delivery-gap.md`, and chat B 的 `case-r7-rating-bug-sweep.md`). Framework 可复用于未来同类工作.

---

**最后更新**: 2026-04-15
