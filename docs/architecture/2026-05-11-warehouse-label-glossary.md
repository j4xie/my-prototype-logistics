# Warehouse Label Glossary — Customer Transcript Alignment

**Date**: 2026-05-11
**Driver**: D1 UI label drift audit (PR #346)
**Status**: Shipped — UI labels aligned with customer 原话, internal code unchanged

---

## Background

Audit of PR #346 surfaced a label drift between customer terminology and
Web-Admin UI strings for the dual-warehouse model:

| Source | Term used |
|---|---|
| Customer transcript line 39 / 41 (3 occurrences of 线边仓; 总仓 mentioned twice) | 线边仓 / 总仓 |
| Internal DB column `factory_warehouses.code` | `WH-WKS` / `WH-LOG` |
| Java constants | `WH-WKS` / `WH-LOG` |
| Web-Admin UI (pre-PR) | mixed: `workshop` / `工位` / `鲜棉仓` / `物流仓` / `总仓` |
| RN App | partial alignment |

Business semantics are 100% identical between customer terminology and the
internal model — the divergence is purely in **display labels**. This doc
records the policy decision that UI labels must mirror the customer 原话
while internal code (DB / Java) remains stable.

---

## Canonical Label Mapping

| Internal code | Customer 原话 | Semantics | Legacy aliases (deprecated for UI) |
|---|---|---|---|
| `WH-WKS` | **线边仓** | Factory-side warehouse, clears daily after production close-out. Receives material via transfer from 总仓 on production-plan dispatch, returns leftover at close. | 工位仓 / 工位库存 / 鲜棉仓 / workshop warehouse |
| `WH-LOG` | **总仓** | Persistent inventory / logistics hub. Source of truth for stock; sales-order fulfillment originates here. | 物流仓 / 物流总仓 / logistics warehouse |

Customer transcript references:
- Line 41 (3 occurrences): 线边仓
- Lines 39 + 41 (2 occurrences): 总仓

The two-warehouse model is the **双仓制 / 物流双仓制** pattern: material is
held in 总仓, transferred to 线边仓 just-in-time for production, and the
unconsumed remainder is returned at close-out (`returned = issued -
consumed`).

---

## Policy

### What must use customer-aligned labels

Any UI surface visible to the customer or factory-floor user:

- Web-Admin Vue templates (`web-admin/src/views/**/*.vue`)
- Web-Admin computed display strings
- RN App screens / formatters (future scope — this PR scopes only Web-Admin)
- Notification / toast / alert text
- Error messages mentioning warehouse roles

Helper: `web-admin/src/utils/warehouse.ts`
- `warehouseDisplayLabel(code)` — pure code → label mapping (fallback: raw code)
- `warehouseDisplayName(name, code)` — prefers canonical label for known
  codes, falls back to server-provided name for unknown codes

### What must NOT change

Internal infrastructure stays on `WH-WKS` / `WH-LOG`:

- Database: `factory_warehouses.code` column values
- Java entity constants
- API request / response field values (Backend continues to emit
  `warehouseCode: "WH-WKS"` etc.)
- Backend logs, audit trail, integration messages
- AI Tool / Skill internal references

Reason: changing the code value would force a schema migration + Java
constants rewrite + RN App API contract update, all of which carry
deployment risk for a purely cosmetic change. The display-only layer
maps codes → labels at render time.

### Forward compatibility

`warehouseDisplayLabel` surfaces unknown codes verbatim (e.g. a future
`WH-FROZEN` would display as `WH-FROZEN` until a customer-aligned label
is decided). This prevents silent label loss when new warehouse types are
added — the raw code is always visible, prompting deliberate translation
rather than accidental drift.

---

## Cover Sites Touched in this PR

| File | Change |
|---|---|
| `web-admin/src/utils/warehouse.ts` | NEW — helper functions |
| `web-admin/src/utils/__tests__/warehouse.spec.ts` | NEW — vitest cases |
| `web-admin/src/views/inventory/by-warehouse/index.vue` | Use `warehouseDisplayName` in dropdown, summary card, materials table, overview |
| `web-admin/src/views/factory/material-requisitions/list.vue` | Alert description 鲜棉仓 → 线边仓; 物流仓 → 总仓 |

Other sites already use customer-aligned terminology and were left
unchanged (e.g. `web-admin/src/views/transfer/list.vue` placeholders
"本厂总仓不填" and "余料退总仓").

---

## How to Add a New Cover Site

When a new Vue view displays warehouse code / name:

```typescript
import { warehouseDisplayName } from '@/utils/warehouse';

// Prefer this over inline server-name fallback:
const label = warehouseDisplayName(row.warehouseName, row.warehouseCode);
```

Avoid inline ternaries like
`code === 'WH-WKS' ? '工位仓' : code === 'WH-LOG' ? '物流仓' : code` — that
hardcodes the wrong labels and bypasses the central policy.

---

## Audit / Rollback

If a future customer interview reveals different terminology (e.g. a new
factory uses "前仓" instead of "线边仓"), update `warehouseDisplayLabel`
in one place — all UI sites pick up the change.

To roll back the entire D1 policy: revert this PR. The helper file goes
away; views that used `warehouseDisplayName(name, code)` fall back to
`name (code)` rendering. No DB / Java change involved.

---

## References

- PR #346 audit thread — label drift finding
- PR #295 — initial workshop warehouse UI
- PR #322 / #323 — by-warehouse query view + transfer detail
- PR #329 — sales order 总仓 inventory label
- Customer transcript: lines 39 + 41 (线边仓 ×3, 总仓 ×2)
