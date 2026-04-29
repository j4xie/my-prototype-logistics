# R26 — Real-browser click + Console Monitor Sweep

**Date**: 2026-04-16
**Method**: MCP playwright-test real Chromium + menu-click navigation + `browser_console_messages(error)` + `browser_network_requests` capture per page

---

## Positive findings

### Whitelist pagination IS working (R25 audit correction)

**R25 verdict was WRONG**: "ignores page param" was based on 1-record data — couldn't distinguish pagination working from it not. R26 seeded 15 additional records (16 total) then clicked UI 下一页 button:

| Request | Result |
|---|---|
| `GET /whitelist?page=1&size=10` | content.length = 10 |
| `GET /whitelist?page=2&size=10` | content.length = 6 |

**Backend IS 1-indexed + paginates correctly.** R25-F6 (whitelist pagination broken) is retracted.

### production/batches timeout RESOLVED

R18/R19 flagged `/production/batches` as timeout after 45s `networkidle`. R26 sweep: **page loads cleanly in <4s, renders PB-PLAN-1776278927478-FF56EA85-38821, 0 console errors**. The R18/R19 regression is gone — resolved by intermediate rounds (canvas V3 refactor or data state).

---

## 10-module sweep result

All modules **0 console errors, all tables render correctly**:

| Module | Rows | Console errors | Notes |
|---|---|---|---|
| /sales/customers | 10 | 0 | CUS-* list |
| /procurement/orders | 2 | 0 | PO-20260416-0001 + PO-20260415-0001 |
| /procurement/suppliers | 2 | 0 | SUP-* list |
| /finance/invoices | 1 | 0 | INV-20260416-0006 ¥1,110 (R22 G1 killer demo) |
| /warehouse/materials | 2 | 0 | MT-20260416-3073 + MB-T3-zlmk |
| /system/users | 17 | 0 | Pagination works (page 2 available) |
| /production/batches | 1 | 0 | **Timeout resolved** — PB-PLAN-...-38821 |
| /system/settings | — | 0 | 4 tabs render, factoryName loads (R21-F3 holds) |
| /hr/employees | 17 | 0 | 员工 list with role/status |
| /system/smartbi-config | — | 0 | 活跃阈值 7/7 (R21-F4 holds) |

Plus /hr/whitelist: 16 rows + 2-page pagination works.

---

## Bonus findings (new R26 bugs)

### R26-F1: /production/bom first-load timeout (P2)

- Navigated to /production/bom
- `GET /product-types` and `GET /customers?size=200` both timed out at 30000ms
- 3 console errors: "加载产品类型失败" + 2× "timeout of 30000ms exceeded"
- Page eventually recovered (second calls succeeded); "E2E测试产品" appeared in dropdown
- User impact: cold-load shows error toasts for 30s, then recovers silently

Hypothesis: Spring Boot cold cache OR slow DB query on product-types table. Worth backend profiling.

### R26-F2: /bom/items POST returns 500 instead of 400 (P2)

- Tried to add a new BOM entry with minimal data
- Backend: `POST /bom/items` → 500 "数据服务暂时不可用 (追踪码: 0F877691)"
- Expected: 400 with specific validation message (matches other endpoints T7 behavior)
- Suggests unhandled exception wrapped by ErrorSanitizer — should be caught earlier as validation error

---

## Verdict

- **Zero regression** across 10 key modules
- R23/R24 fixes all persist live (R21-F3/F4 settings+smartbi / R23-F1/F4/F5 pagination+case / R24-F6/F7/F8 keyword+cancelled+RBAC)
- R25 audit whitelist verdict retracted (was false-positive)
- R18/R19 production/batches timeout gone
- 2 new bugs triaged (R26-F1/F2, both P2)

**R26 backlog remaining for R27**:
1. R22-F1 PO 409 transient (needs SQL trace setup)
2. R22-T4 Part 2 BOM happy path (needs R26-F1 fix + full BOM seed)
3. R26-F1 /production/bom product-types cold-load slowness
4. R26-F2 BOM add 500 instead of 400
5. backend pagination normalization (P3 refactor)
