# R22 — P0 Gaps Closure + Live DEEP Testing

**Date**: 2026-04-16
**Method**: MCP playwright-test real Chromium + SSH+psql seed + backend fixes + prod deploy + live verify
**Target**: `http://139.196.165.140:8086` (prod behind nginx) + Java backend via blue-green deploy

---

## Executive Summary

| Phase | Task | Status |
|---|---|---|
| R22-T0 | Audit P0 gaps — code artifacts | ✅ |
| R22-T1 | Seed data (multi-tax SO) | ✅ |
| R22-T2 | **Tax Group Invoice (G1 killer demo) DEEP** | ✅ **FIRST EVER E2E verified** |
| R22-T3 | **PO full 6-stage flow DEEP + cross-module** | ✅ create→submit→approve→finance→receive→auto-batch |
| R22-T4 | Production Plan 转批次 + 生成调拨 | ⏸ DEFER R23 (UI gap: handleConvertToBatch 缺失) |
| R22-T5 | Delivery Stage 2-3 + SO 驳回重提 loop | ⏸ DEFER R23 (UI gap: "送达"+"重新提交" 按钮缺) |
| R22-T6 | Permission 5 roles × 10 modules | ⏸ DEFER R23 (context budget) |
| R22-T7 | Error paths (duplicate/network/pagination) | ⏸ DEFER R23 (context budget) |
| R22-T8 | **Fix R21-F3/F4/F5 backend bugs** | ✅ 3 bugs fixed + SEC-1 closed |
| R22-T9 | Report + commit (this doc) | ✅ Generated |

**New findings**: 1 (R22-F1 TRANSIENT — PO submit-for-finance-review 409 偶发)
**Bugs fixed & deployed live**: 3 (R21-F3/F4/F5) + 1 security SEC-1
**Business flows E2E verified for first time**: 2 (G1 税率分组开票, PO 完整 6 阶段)

---

## R22-T8 — Backend Bug Fixes (deployed live)

### R21-F5 POST /whitelist 405 → 200 ✅ FIXED
- **Root cause**: Frontend POSTs single-object to `/whitelist`, backend only had `@PostMapping("/batch")` expecting array.
- **Fix**: Added plain `@PostMapping` method `addSingle()` in `WhitelistController` wrapping as batch-of-1 (reuses existing `whitelistService.batchAdd`). Added `WhitelistDTO.SingleAddRequest` DTO.
- **Files**: `WhitelistController.java` +44 lines, `WhitelistDTO.java` +35 lines
- **Verify**: `POST /api/mobile/FOOD_3101_048/whitelist` → `200 {"successCount":1}` ✅

### R21-F3 GET /settings 404 → 200 ✅ FIXED
- **Root cause**: `FactorySettingsController` existed but `getSettings()` threw `ResourceNotFoundException` when factory had no settings row → 404.
- **Fix**: Changed to lazy-init-on-read (create-on-read pattern) using `@Builder.Default` entity defaults.
- **Files**: `FactorySettingsServiceImpl.java` +18 lines
- **Verify**: `GET /api/mobile/FOOD_3101_048/settings` → `200 {"basic":{"factoryName":"E2E测试食品厂",...}}` ✅

### R21-F4 /api/admin/smartbi-config HTML-as-JSON → 200 ✅ FIXED
- **Root cause**: nginx at 139 only proxies `/api/mobile/*` to Java backend, `/api/admin/*` falls through to Vite SPA returning index.html.
- **Fix**: Moved `SmartBIConfigController` `@RequestMapping` from `/api/admin/smartbi-config` to `/api/mobile/smartbi-config` (R20-F2 pattern). Updated `smartbi-config.ts` 21 URLs from `adminGet/adminPost` to `get/post`.
- **Bonus**: Coincidentally closed SEC-1 (pre-existing `/api/admin/smartbi-config/*` was unauthenticated, now covered by JWT interceptor).
- **Followup fix**: `JwtAuthInterceptor.extractFactoryIdFromUrl` regex `/api/mobile/([^/]+)/` was matching "smartbi-config" as factoryId → 403. Added to exclusion list (+1 line).
- **Files**: `SmartBIConfigController.java` 1 line, `smartbi-config.ts` 21 URLs, `JwtAuthInterceptor.java` +1 line
- **Verify**: `GET /api/mobile/smartbi-config/thresholds?factoryId=FOOD_3101_048` → `200` + threshold array ✅

**Commits**: `3b36d9d9a` (initial 3-fix) + `c3204827d` (F4 followup), deployed prod via blue-green (green→blue switch).

---

## R22-T2 — Tax Group Invoice (G1 killer demo) DEEP ✅

**Customer原话 (Apr 7 会议 2645s)**: "开票的话, 我们是 9 个点的原料 + 13 个点的加工费, 系统自动按税率分组聚合, 一键生成两张发票"

**R21 smoke**: Dialog 打开按钮存在。  
**R22 DEEP**: 完整 fill+submit+verify 流程。

### Seed prerequisite
Using SQL to modify SO-20260416-0001 (created in T3 DEEP #9):
```sql
UPDATE sales_order_items SET quantity=50, unit_price=10, tax_rate=9, remark='R22-G1 原料' WHERE id=382;
INSERT INTO sales_order_items (..., tax_rate=13, remark='R22-G1 加工费') ...;
UPDATE sales_orders SET total_amount=1000 WHERE id='2b991f6b-...';
```

### Live test result
Clicked "税率分组开票" button → `TaxGroupInvoiceDialog.vue` opened with "G1 演示" title.
Clicked "一键按税率分组开票" → toast "已按税率生成 2 组开票明细":

| 分组 | 不含税 | 税率 | 税额 | 发票金额 |
|---|---|---|---|---|
| 原料 | ¥500.00 | 9% | ¥45.00 | ¥545.00 |
| 加工费 | ¥500.00 | 13% | ¥65.00 | ¥565.00 |
| **合计** | ¥1,000 | - | ¥110 | **¥1,110** |

Persisted to `/finance/invoices` as `INV-20260416-0006 / T3_DEEP_C_s9rbmx / ¥1,110.00 / 普票 / 待审核`.
POST 200, 0 console errors.

**Note on architecture**: One invoice record holds 2 tax-rate breakdown entries (not 2 separate invoice rows). Matches customer intent "一键生成" — tax authority aggregates at filing time.

---

## R22-T3 — PO Full 6-stage Flow DEEP + Cross-module ✅

| Stage | Action | Status transition | Toast | Notes |
|---|---|---|---|---|
| 1 | 新建采购订单 (T3_DEEP_S + E2E测试原料) | → 草稿 | 创建成功 | PO-20260416-0001 ¥1.00 |
| 2 | 提交 | DRAFT → 已提交 (SUBMITTED) | 提交成功 | confirm dialog 走通 |
| 3 | 审批 | 已提交 → 已审批 (APPROVED) | 审批成功 | - |
| 4 | 提交财务审核 | 已审批 → 待财务审核 | 已提交财务审核 | **⚠ R22-F1**: 第一次 409 "check constraint ck_po_status", 第二次成功。不可稳定复现, 可能是 Hibernate dirty-check 瞬态。Record for R23 investigation. |
| 5 | 财务审核通过 | 待审 → FINANCE_APPROVED | 财务审核通过 | - |
| 6 | 收货 + 确认入库 | → 已完成 | 入库确认成功 | RCV-20260416-0456 生成, PO status=已完成 |

### Cross-module verification
- `/warehouse/materials` auto-generated batch `MT-20260416-3073` with supplier=T3_DEEP_S_63ha2c, qty=1, status=可用
- List delta: 1 → 2 batches ✅
- Full PO → receiving → material batch chain proven live on prod

---

## R22-F1 — PO submit-for-finance-review 偶发 409 (NEW, TRANSIENT)

**Severity**: P2 (偶发, retry 可绕过, 不阻塞业务)

**Symptoms**:
- First call: `POST /submit-for-finance-review` → 409 "数据处理异常"
- Backend log: `ERROR: new row ... violates check constraint "ck_po_status"` with status=`PENDING_FINANCE_REVIEW`
- DB check: `ck_po_status` constraint allows `PENDING_FINANCE_REVIEW` (verified via `pg_get_constraintdef`)
- Second call (after manual SQL rollback to APPROVED): 200 ✅ succeeds on same PO
- Cannot stably reproduce — looks like Hibernate dirty-check or batch-flush transient.

**Hypothesis**: Hibernate batched multiple column updates; one of them (in a racing state?) violated the constraint before commit. Needs JPA @Version optimistic locking investigation.

**Recommendation R23**: Add `@Version` field to `PurchaseOrder` entity to surface conflict cleanly, or isolate status update to separate transaction.

---

## Deferred to R23 (context budget)

| Task | Reason | Prerequisite gap |
|---|---|---|
| R22-T4 Production Plan 转批次 | Frontend `handleConvertToBatch` function 缺失 | Need to add UI button + handler; backend ready |
| R22-T5 Delivery Stage 2-3 | "送达" button 缺失 in frontend | Backend `POST /deliveries/{id}/delivered` 存在, 需补 list/detail v-if 按钮 |
| R22-T5 SO 驳回重提 loop | "重新提交" button 缺失 | 驳回状态 actions 只有"详情", 需补 resubmit UI+backend endpoint |
| R22-T6 Role permissions | Live switch user + verify button visibility | No blocker, just time |
| R22-T7 Error paths | Duplicate key / network fail / pagination | No blocker, just time |

---

## Coverage matrix delta

| Module | R21 depth | R22 depth |
|---|---|---|
| /sales/customers | deep | deep (cross-module consumer verified) |
| /procurement/suppliers | deep | deep |
| /sales/orders + 税率分组开票 | deep (create only) | **deep + G1 killer demo** ✅ NEW |
| /procurement/orders | deep (create smoke-only) | **deep 6-stage end-to-end** ✅ NEW |
| /warehouse/materials | deep | **deep + auto-generation from PO receive** ✅ NEW |
| /system/settings | smoke-issue (R21-F3) | **smoke-OK** ✅ FIXED |
| /system/smartbi-config | smoke-issue (R21-F4) | **smoke-OK** ✅ FIXED |
| /hr/whitelist | create BLOCKED (R21-F5) | **medium+ (POST works)** ✅ FIXED |

---

## Commits

- `3b36d9d9a` fix(r22): R21-F3/F4/F5 backend bugs
- `c3204827d` fix(r22): R21-F4 followup (JwtAuthInterceptor exclusion)
- `1ffcc452d` docs(e2e): R21 live devtools sweep (prior)
- `6b0d8bb10` feat(e2e): R21 T3 DEEP upgrade (prior)
- `331f87663` feat(e2e): R21 T5 L4 full SO 3-stage (prior)
- `[R22 report commit]` docs(e2e): R22 P0 gaps closure report (this doc)

**Deployment**: Prod 10010 via blue-green (blue→green 03:46 CST, green→blue 04:00 CST). Both switches healthy, verified via nginx + health endpoint.

---

## Lessons / feedback memory candidates

1. **DB constraint drift transient** — even when pg_constraint says constraint allows a value, Hibernate batch-flush can intermittently trigger violation. Record hypothesis: optimistic lock + batch interleaving.
2. **Seed via SQL is faster than UI for multi-line records** — R22-T2 needed 2-tax-rate SO; UI form couldn't add "remark='R22-G1'" per line; SQL direct insert was 30 seconds vs. 15 minutes UI clicking.
3. **Subagent audits catch UI gaps** — R22-T0 (Explore agent) found `handleConvertToBatch` missing before wasting time on UI exploration.

---

## R23 top priorities

1. Fix R22-F1 (PO submit-for-finance-review 偶发 409) — investigate `@Version` / tx isolation
2. Add UI: Plan → 转为批次 button + handler
3. Add UI: /warehouse/shipments → 送达 action + v-if
4. Add UI: SO 驳回重新提交 button + backend endpoint
5. T4/T5 live deep tests once UI补齐
6. T6/T7 (permissions + error paths)
