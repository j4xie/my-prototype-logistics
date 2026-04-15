# R25 — Pagination Audit + Deploy Script Clean Fix

**Date**: 2026-04-16
**Method**: API probe each paginated endpoint with page=0 vs page=1; cross-check against frontend `pagination = ref({ page: X })` defaults.

---

## Pagination Classification (44 endpoints probed)

### 0-indexed backends (4) — accept page=0, page=1 returns empty content

| Endpoint | Frontend file | Default | Adjustment | Verdict |
|---|---|---|---|---|
| `/shipments` | `warehouse/shipments/list.vue` | `page:1` | `- 1` (F1 fix) | ✅ 1-1=0 |
| `/finance/invoices` | `finance/invoices/list.vue` | `page:0` | none (F5 revert) | ✅ 0=0 |
| `/rd/samples` | `rd/samples/list.vue` | `page:0` | none (F5 revert) | ✅ 0=0 |
| `/scheduling/alerts` | `scheduling/alerts/index.vue` | `page:1` | `- 1` (pre-existing) | ✅ 1-1=0 |

### 1-indexed backends (13) — reject page=0 with 400

- `/sales/orders`, `/customers`, `/suppliers`, `/material-batches`, `/production-plans`, `/equipment`, `/departments`, `/price-lists`, `/transfers`, `/users`, and all other 42 `page:1` default files.

All correctly pair raw `pagination.value.page` (sends 1) with 1-indexed backend.

### Ignores page param (2)

- `/whitelist` — returns same rows for page=0, page=1 (effectively no pagination)
- `/work-processes` — same

Not a bug per se, but the UI pagination controls have no effect. Fix deferred — verify via actual pagination UI vs API.

### Empty-inconclusive (6)

- `/finance/payments`, `/material-requisitions`, `/rd/requests`, `/rd/quotations`, `/scheduling/plans`, `/calibration`

No data to determine indexing convention. Safe either way until data exists.

---

## Verdict

**No new pagination fixes required**. R23-F1 + R23-F5 landed the correct state. Frontend defaults match backend conventions 1:1 across all endpoints where we can verify.

**Latent gotchas to watch**:
1. Any NEW list view should check backend indexing empirically before picking `page:0` or `page:1` default
2. `/whitelist` and `/work-processes` are technically broken pagination — would not respect UI "next page" clicks with large dataset. File for P2 R26.
3. Empty-inconclusive endpoints untested — add test seed in R26 to verify

---

## R25 Deliverable: Deploy script clean build default (P1 prevention)

`scripts/deploy/deploy-backend.sh` line 297-318 — default maven goal changed from `package` to `clean package`. Added `SKIP_CLEAN=1` env var to opt out if needed. Prevents R24-style incremental-build cache issues.

Before (R24 bug):
```bash
./mvnw package -Dmaven.test.skip=true -q   # incremental, can miss Controller.class changes
```

After:
```bash
MVN_GOALS="clean package"
[ -n "$SKIP_CLEAN" ] && MVN_GOALS="package"
./mvnw $MVN_GOALS -Dmaven.test.skip=true -q   # clean by default, ~90s vs previous ~40s
```

**Trade-off**: build time +50s. Worth it — R24 wasted 30 min on a stale-Controller deploy that looked healthy.

---

## R26 backlog

1. **R22-F1 PO 409 transient** — needs SQL trace configuration
2. **R22-T4 Part 2 BOM seed** — test generate-transfer happy path
3. **R25 whitelist/work-processes pagination** — ignores page param, UI pagination broken
4. **R25 empty-inconclusive seed** — add test data to verify 6 untested endpoints
5. **Consider backend pagination normalization** — mixed 0/1-indexed across 20+ controllers is error-prone; standardize to Spring PageRequest default (0-indexed) and have frontend always subtract 1. Large refactor, P3.
