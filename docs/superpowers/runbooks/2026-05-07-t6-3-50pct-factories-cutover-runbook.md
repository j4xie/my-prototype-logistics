# T6.3 Test-Factories Cutover Runbook

**Phase**: T6.3 (Phase 2A SmartBI Java→Python cutover)
**Status**: Doc-only readiness — execution awaits separate marching order
**Author**: chat 2 (T6.3 readiness writer)
**Date**: 2026-05-07
**Predecessor**: T6.2 F001 canary live (2026-05-07 04:01 CST, 24h soak in flight)
**Sister chat**: chat 1 (uvicorn N=2 PR-3 prod cutover, separate work)

---

## 1. Cutover scope — Strategy B (test-factories first, ~81%)

**61 factories** routed to Python (cretas_python upstream, 47:8083). 14 real customer factories deferred to T6.4 final wave.

> **Naming note**: marching order called this "T6.3 50% factories." Discovery showed factory IDs are heterogeneous (not all `F0XX`), so a pure alphabetical 50/50 would mix real customer factories (F002-F006) into the first wave. Strategy B selects all test/canary factories first regardless of % count → effectively 81% (61/75), leaves all 14 real customers for T6.4. Phase identifier "T6.3" preserved.

### 1.1 IN-scope (61 → Python)

| Group | Count | IDs |
|---|---|---|
| Canary (already on T6.2) | 1 | `F001` |
| Canvas test factories | 48 | `FOOD_3101_001` through `FOOD_3101_048` |
| E2E test factories | 2 | `MEAT_3101_001`, `MEAT_3101_002` |
| Other test | 1 | `OTHER_3101_001` |
| QHJ DEMO/V2 (Restaurant V2 test) | 8 | `RES_3101_001` through `RES_3101_008` |
| Dryrun synthetic | 1 | `TEST_0000_001` |

### 1.2 EXCLUDED (14 → stay on Java, deferred to T6.4)

| Group | Count | IDs | Notes |
|---|---|---|---|
| F-numeric real customers | 4 | `F002`, `F003`, `F004`, `F006` | 张记餐饮 / 绿源食品 / 鲜味零售 / 六膳门 (real customer factories) |
| 白垩纪示范餐厅 | 1 | `R001` | Demo but real |
| Real restaurant chains (R_*) | 7 | `R_GML_DEMO`, `R_XMX_CHAIN`, `R_XMX_FRESH`, `R_XMX_FRESH2`, `R_XMX_FRESH3`, `R_YHDJ_DEMO`, `R_YJJ_DEMO` | 桂满陇/唏嘛香/永和豆浆/御九井 — name suffix "_DEMO/_FRESH" but real customer pilots, names confirm real chains |
| QHJ_PROD | 1 | `RES_3101_009` | QHJ_PROD = production tenant |
| 桂满陇 | 1 | `RES_GML_001` | Real customer |

**Why excluded**: T6.4 wave handles real-customer cutover after T6.3 24h soak passes. If any test-factory issue manifests in T6.3, it doesn't impact a paying customer.

---

## 2. Pre-flight checks (gate before triggering cutover)

All must be PASS:

- [ ] T6.2 canary (F001) **24h+ healthy**: error <0.5%, p99 <2000ms, 0 Java fallback (verify via prod monitoring)
- [ ] chat 1 PR-3 N=2 prod cutover **done + 24h+ soak pass** (no NRestarts, no OOM, PG conn under cap)
- [ ] Java baseline metrics still being collected (PID 116595 from T6 plan or successor)
- [ ] T6.1 dryrun completed (24h, 02:58 May 7 → 02:58 May 8) with **100% match report**
- [ ] prod cretas-python current state verified: N=2 workers, leader gate active, supervisord healthy
- [ ] Today's daily backup ✓ at 03:00 CST (`smartbi_prod_db_YYYYMMDD_*.sql.gz` ≥ 400MB)
- [ ] Server 139 nginx config valid: `nginx -t` PASS
- [ ] No active P1 incident on prod
- [ ] Monitoring dashboards open: Python error rate, Java fallback rate, p99 latency

---

## 3. Nginx vhost diff plan

### 3.1 Current state (post-T6.2)

Vhost path: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (宝塔 panel path, NOT `/www/server/nginx/conf/vhost/`).

T6.2 added 3 regex blocks at line 38-58 of vhost (per diff against `bak.t6_2_pre.20260507_035911`):

```nginx
# ============================================================
# T6.2 canary (2026-05-07): F001 SmartBI traffic to Python (port 8083)
# ============================================================
location ~ ^/api/mobile/(F001)/smart-bi/(alerts|recommendations|data-date-range)$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/(F001)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/(F001)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
```

### 3.2 T6.3 expansion — replace `(F001)` capture group

The 3 blocks share the same factory-ID alternation. Build it once and reuse:

```
(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```

**Verification of regex coverage** (61 IDs):
- `F001` → 1
- `FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])` → 9 + 30 + 9 = 48 (covers 001-009, 010-039, 040-048)
- `MEAT_3101_00[12]` → 2 (001, 002)
- `OTHER_3101_001` → 1
- `RES_3101_00[1-8]` → 8 (001-008; **excludes 009 = QHJ_PROD**)
- `TEST_0000_001` → 1
- **Total: 1+48+2+1+8+1 = 61** ✓

### 3.3 Final T6.3 vhost diff (3 blocks expanded)

```nginx
# ============================================================
# T6.3 cutover (YYYY-MM-DD): test-factories SmartBI traffic to Python (port 8083)
# Expanded from T6.2 F001-only to 61 test factories (Strategy B test-first).
# Real customer factories (14 IDs) still on Java — T6.4 handles those.
# Backup: api.cretaceousfuture.com.conf.bak.t6_3_pre.YYYYMMDD_HHMMSS
# Rollback: cp <backup> api.cretaceousfuture.com.conf && nginx -s reload
# ============================================================
location ~ ^/api/mobile/(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)/smart-bi/(alerts|recommendations|data-date-range)$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
location ~ ^/api/mobile/(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
    include /www/server/panel/vhost/nginx/include/cretas-python-proxy-defaults.conf;
}
```

The previous T6.2 3 blocks are **replaced** by these 3 blocks (don't add — replace). Backup the current vhost first.

### 3.4 Apply procedure (executor reads, NOT triggered by this doc)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  # 1. Backup current
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_3_pre.\$(date +%Y%m%d_%H%M%S)
  # 2. Edit vhost (replace 3 T6.2 regex blocks per §3.3 above)
  vi api.cretaceousfuture.com.conf  # OR: sed -i with carefully crafted pattern
  # 3. Validate
  nginx -t
  # 4. Reload (graceful, no downtime)
  nginx -s reload
"
```

**Critical**: do NOT delete the T6.2 backup `api.cretaceousfuture.com.conf.bak.t6_2_pre.20260507_035911` — it remains the canonical pre-T6.2 fallback if T6.3 + T6.4 must fully revert.

---

## 4. Smoke test (post-cutover, before declaring "GO")

### 4.1 Scope

61 factories × 19 SmartBI endpoints = **1159 HTTP calls**. (Marching order said 38 × 19 = 722; updated for Strategy B's 61 factories.)

19 endpoints per factory (per T6 in-scope endpoints list `scripts/phase2a/t6-in-scope-endpoints.txt`):

```
GET /api/mobile/{factoryId}/smart-bi/alerts
GET /api/mobile/{factoryId}/smart-bi/recommendations
GET /api/mobile/{factoryId}/smart-bi/data-date-range
GET /api/mobile/{factoryId}/smart-bi/query-templates
GET /api/mobile/{factoryId}/smart-bi/datasource/list
GET /api/mobile/{factoryId}/smart-bi/incentive-plan/...
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=...&endDate=...
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?...&analysisType=profit
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?...&analysisType=cost
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?...&analysisType=receivable
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?...&analysisType=budget
GET /api/mobile/{factoryId}/smart-bi/analysis/finance?...&analysisType=payable
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement?...
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom?...
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?...
GET /api/mobile/{factoryId}/smart-bi/analysis/sales?startDate=...&endDate=...
GET /api/mobile/{factoryId}/smart-bi/analysis/department?...
GET /api/mobile/{factoryId}/smart-bi/analysis/region?...
GET /api/mobile/{factoryId}/smart-bi/analysis/inventory?...
```

(Refer to actual server file for canonical 19 — list above is illustrative.)

### 4.2 Approach (executor implements, NOT in this doc)

1. Generate factory-scoped JWT for each of 61 IDs (signing with prod `JWT_SECRET`, role=`factory_super_admin`).
2. For each (factory, endpoint), curl through 139 nginx `https://api.cretaceousfuture.com/...` with `Authorization: Bearer <token>`.
3. Verify `HTTP 200` AND response body parses as JSON AND `success` field present.
4. Log per-factory pass/fail count.
5. Estimated wall-clock: ~5-10 min serial; can parallelize per factory (6-way → ~1-2 min).

### 4.3 Failure threshold

- **Any 5xx** → STOP cutover, jump to §5 rollback, investigate before re-attempting.
- **>5 4xx across factories** → suspect token issue, NOT cutover. Investigate before §5.
- **Single 4xx (e.g. 404 for unsupported endpoint per factory data state)** → log, continue, evaluate at §6.

---

## 5. Rollback procedure (<2 min target)

### 5.1 Trigger conditions

- Smoke (§4) any 5xx
- Post-cutover monitoring shows GO criteria (§6) violated within first 24h
- P1 user report
- Python prod 8083 down / unhealthy / OOM
- T6 dryrun-compare divergence rate >0.5%

### 5.2 Procedure

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  # Find the T6.3-pre backup
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_3_pre.* | head -1)
  echo \"Restoring from: \$BACKUP\"
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

After rollback: T6.2 state restored (only F001 → Python; 60 other test factories revert to Java). T6.2 canary remains intact.

### 5.3 Full revert to pre-T6.2 (rare — only if T6.2 itself broken)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  cp api.cretaceousfuture.com.conf.bak.t6_2_pre.20260507_035911 api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

This drops F001 canary too. All factories back on Java.

---

## 6. GO criteria (24h soak after T6.3 cutover)

All must hold for 24 consecutive hours post-cutover before declaring GO and unlocking T6.4 marching order:

- **Python error rate** <0.5% across the 61 cutover factories combined (per access log + Prometheus)
- **p99 latency** <2000ms for sales / dashboard heavy endpoints
- **0 Java fallback** for any of the 61 cutover factories (Java logs should NOT see `/api/mobile/{F001|FOOD_*|...}/smart-bi/...` traffic)
- **0 P1 user reports** affecting cutover factories
- **prod cretas-python.service `NRestarts` unchanged** (no crashes in 24h)
- **PG conn count peak <95** (cap 100, headroom for spikes)
- **Memory <4GB** total cretas-python process tree (per N=2 prod baseline)
- **Java baseline metrics** still being collected for 14 deferred real customer factories (sanity check that legacy still works for them)

If any criterion fails → rollback per §5, investigate, retry once issue resolved.

---

## 7. Post-cutover monitoring

### 7.1 Continuous parity check

T6 dryrun-compare should run continuously against any of the 61 factories that have meaningful data. F001 already covered by T6.2 dryrun. Pick 1-2 representative test factories (e.g. `RES_3101_009` if it had data — but that's excluded; pick `FOOD_3101_001` instead) and compare Java vs Python output for top 5 endpoints.

### 7.2 Traffic ratio verification

```bash
# On 47:
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/python-prod.log | \
    grep -oE '/api/mobile/[^/]+/smart-bi' | \
    awk -F/ '{print \$4}' | sort | uniq -c | sort -rn | head -20
"
```

Expected: 61 factory IDs visible in top results (F001 highest if it has real traffic, FOOD_* mostly low / zero unless tests are running).

### 7.3 Java fallback check

```bash
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/cretas-prod.log | \
    grep -E 'getFinanceOverview|getSalesOverview' | \
    grep -E '(F001|FOOD_3101|MEAT_3101|OTHER_3101|RES_3101_(001|002|003|004|005|006|007|008)|TEST_0000_001)'
"
```

Expected: **empty** (no Java traffic for the 61 cutover factories). Any matches = cutover incomplete or nginx misconfig.

---

## 8. T6.4 100% factories trigger conditions

Once T6.3 24h soak GO criteria (§6) all met:

1. T6.3 24h soak GO ✓
2. 0 P1 reports for 24h
3. Real-customer-segment Java baseline metrics OK (no surprise issues in the 14 deferred)
4. T6 dryrun-compare for any active test factory shows ≥99% match rate

Then organizer issues **separate** T6.4 marching order to expand regex to remaining 14 real-customer factories. T6.4 likely needs:
- More careful pre-flight (real customer data shape verification)
- Customer comms / coordination with sales team for any potential blip
- Potentially staggered (e.g. 3-4 customers per day) rather than big bang

T6.4 design is **out of scope** for this runbook.

---

## 9. ⛔ HOLD blocks (this runbook does NOT execute cutover)

- This is a doc-only readiness runbook. Reading + reviewing it doesn't trigger any prod state change.
- Cutover execution is separate marching order, separate chat, separate worktree.
- Smoke test scripts referenced in §4 are NOT included here — executor implements them at cutover time.
- Rollback shell scripts referenced in §5 are NOT pre-installed — executor invokes inline at trigger time.

---

## 10. Discovery findings baked into this runbook

Captured during readiness phase:

| Finding | Implication |
|---|---|
| Vhost lives at `/www/server/panel/vhost/nginx/` (宝塔 panel), NOT `/www/server/nginx/conf/vhost/` | All ssh commands in this runbook use the panel path |
| Factory IDs are heterogeneous (F-numeric + FOOD_NNNN_NNN + MEAT/OTHER/RES/R_*/TEST_*) | Pure alphabetical 50% would mix real customers in T6.3. Strategy B selected by organizer |
| F005 missing from F-numeric series | Not a bug — historical sequence has the gap |
| 75 factories total, all `deleted_at IS NULL` | Matches memory baseline |
| T6.2 vhost backup `bak.t6_2_pre.20260507_035911` exists ✓ | Backup-then-edit chain stays intact |
| T6.2 added exactly 3 regex blocks (alerts/recommendations/data-date-range, analysis/*, query-templates/datasource/incentive-plan) | T6.3 expands the same 3 blocks via factory-ID alternation |

---

## 11. Resumption checklist (executor reads at cutover time)

- [ ] Read this runbook in full
- [ ] Confirm pre-flight §2 all PASS (8 items)
- [ ] On 139, backup current vhost (§3.4 step 1)
- [ ] Edit vhost per §3.3 (replace 3 T6.2 regex blocks with 3 expanded blocks)
- [ ] `nginx -t` validates (§3.4 step 3)
- [ ] `nginx -s reload` (§3.4 step 4)
- [ ] Run smoke test §4 (61 × 19 = 1159 calls)
- [ ] If any 5xx → §5 rollback immediately
- [ ] If smoke clean → start 24h GO criteria monitoring §6
- [ ] After 24h soak PASS → ping organizer, request T6.4 marching order

---

## 12. Coordination notes

- Independent of chat 1 (uvicorn workers PR-3). chat 1 modifies `cretas-python.service` systemd unit. This runbook only describes nginx vhost on 139. Zero file overlap.
- Independent of any open PR. PR for this runbook is doc-only.
- Did not modify any prod state during readiness phase. SSH calls were all read-only (`ls`, `diff`, `psql -tAc SELECT`).
