# T6.4 Real Customers Cutover Runbook

**Phase**: T6.4 (Phase 2A SmartBI Java→Python cutover, final wave)
**Status**: Doc-only readiness — execution awaits separate marching order after T6.3 24h soak GO
**Author**: chat 3 (T6.4 readiness writer)
**Date**: 2026-05-08
**Predecessor**: T6.3 cutover live 2026-05-08 11:34 CST, 24h soak ETA 2026-05-09 12:05 CST
**Sister chats**:
- chat 1 — uvicorn N=2 PR-3 prod cutover (live 2026-05-07 11:36 CST, 24h soak GO 2026-05-08 11:36)
- chat 2 — T6.3 readiness writer + executor (PR #110, runbook at `2026-05-07-t6-3-50pct-factories-cutover-runbook.md`)
- chat 4 — Pattern B PR #135 (`_get_finance_overview` 3-state branching, currently merged main, prod deploy prereq)

---

## 1. Cutover scope — 14 real customer factories (Strategy B opposite of T6.3)

**14 factories** routed to Python (`cretas_python` upstream, `47:8083`). T6.4 completes Phase 2A — after this all 75 factories on Python.

### 1.1 IN-scope (14 → Python, all currently still on Java per T6.3 IN/OUT split)

| Group | Count | Factory IDs | Notes |
|---|---|---|---|
| F-numeric real customers | 4 | `F002`, `F003`, `F004`, `F006` | 张记餐饮 / 绿源食品 / 鲜味零售 / 六膳门 |
| 白垩纪示范餐厅 | 1 | `R001` | Demo but real customer |
| 桂满陇 | 1 | `RES_GML_001` | Real customer |
| QHJ_PROD | 1 | `RES_3101_009` | QHJ_PROD = production tenant (sequence 009 next after T6.3 008) |
| Real restaurant chains R_* | 7 | `R_GML_DEMO`, `R_XMX_CHAIN`, `R_XMX_FRESH`, `R_XMX_FRESH2`, `R_XMX_FRESH3`, `R_YHDJ_DEMO`, `R_YJJ_DEMO` | 桂满陇/唏嘛香/永和豆浆/御九井 — `_DEMO`/`_FRESH` suffix misleading,实际 real customer pilots |

**Total: 14** ✓ (matches T6.3 OUT-of-scope §1.2 count)

### 1.2 Critical naming traps (per PR #110 readiness)

- `R_GML_DEMO` etc. with `_DEMO` suffix is **NOT a test factory** — names confirm real chain pilots (桂满陇)
- `RES_3101_009` is **QHJ_PROD** production tenant (sequence 009 lives next to test 001-008 but production-tier)
- F005 still gap (per PR #110 finding, historical sequence)

### 1.3 Why this scope

After T6.3 24h soak GO declares the test-factory base stable, the remaining 14 are all customer-facing tenants. T6.4 completes Phase 2A goal of 100% factories on Python (75/75).

---

## 2. Strategy decision — A (big bang) / B (staggered) / C (custom waves)

### 2.1 Option A — Big bang (all 14 in single nginx update)

**How**: Replace T6.3 regex with T6.3 + 14 union, single `nginx -s reload`.

```nginx
# Hypothetical Option A regex (T6.3 + T6.4 union, 75 factories):
^/api/mobile/(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)/smart-bi/...
```

**Pros**: Single transition window, T6.4 done in one step.
**Cons**: All 14 customers exposed simultaneously; if any one factory hits a Pattern B / Pattern A2 issue, blast radius is all 14 customers concurrently.

### 2.2 Option B — Staggered 3-4 customers per day (RECOMMENDED, per PR #110 §8)

**How**: 4 stages over 4-5 days, each stage extends the regex.

| Stage | Day | Customers added | Reasoning |
|---|---|---|---|
| **B1** | Day 1 | `F002` + `F003` (2) | Smallest risk: 2 F-numeric customers, similar shape to T6.3 |
| **B2** | Day 2 | `F004` + `F006` + `R001` (3) | Add F-numeric + 白垩纪示范 |
| **B3** | Day 3 | `RES_GML_001` + `RES_3101_009` (2) | 桂满陇 + QHJ_PROD (production tenant) |
| **B4** | Day 4-5 | `R_GML_DEMO`, `R_XMX_CHAIN`, `R_XMX_FRESH`, `R_XMX_FRESH2`, `R_XMX_FRESH3`, `R_YHDJ_DEMO`, `R_YJJ_DEMO` (7 across 2 days) | Restaurant chains last — split 4+3 across 2 days |

Between stages: 4-12h soak each before next stage. If issue at stage N, rollback only stage N (pre-T6.4 state if N=1, prior stage if N≥2).

**Pros**:
- Limit blast radius per stage
- 4-12h between stages allows real customer transaction patterns to surface issues
- Sales team comms manageable per stage (notify only ~3 customers/day, not all 14 at once)
- If Pattern B 3-state distribution shows surprise on real-customer Gold data, isolate to 1-3 customers

**Cons**:
- Total cutover spans 4-5 days vs 1 day big bang
- More nginx reloads (4 vs 1) — each is graceful but accumulates ops surface

**Recommendation**: **Option B**. Per PR #110 §8 explicit guidance. Customer-facing risk profile justifies staggered approach.

### 2.3 Option C — Custom 2-wave (front-loaded vs end-loaded)

**How**: Split into 2 waves of 7 each (or 5+9 / 3+11 ratios).

**Pros**: Compromise between A and B (less reload churn than B, less concentrated risk than A).
**Cons**: Loses the per-customer-segment isolation benefit of B; restaurant chains R_* would still be grouped together.

Use C only if Sales team comms capacity supports daily but B's 4-stage timing too long.

### 2.4 Strategy decision matrix

| Factor | Option A (big bang) | Option B (staggered) | Option C (2-wave) |
|---|---|---|---|
| Blast radius risk | High (14 customers) | Low (2-7 per stage) | Medium (7) |
| Customer comms load | Single batch (14) | 2-3/day × 4-5 days | 2 batches × 7 |
| Cutover total time | <1h | 4-5 days | 1-2 days |
| Rollback granularity | All-or-nothing | Per-stage | Per-wave |
| Pattern B risk surfacing | Concentrated | Distributed | Mid |
| **Recommended for T6.4** | ❌ unless executor has high confidence | ✅ default | ⚠️ alternative if comms tight |

---

## 3. Pre-flight checks (gate before triggering cutover)

All must be PASS before Stage B1 (or Option A/C kick-off):

### 3.1 T6.3 dependencies

- [ ] T6.3 24h soak GO criteria all met (12:05 May 9 CST)
- [ ] T6.3 0 P1 reports in 24h window
- [ ] T6.3 `nginx -t` valid + cretas_python upstream healthy
- [ ] T6 dryrun-compare continuous parity ≥99% (chat 4 dryrun ETA 12:01 May 9 CST 数据)

### 3.2 Pattern B PR #135 production deploy prereq

- [ ] PR #135 `2e90a2016` `_get_finance_overview` Pattern B 3-state branching merged main ✓ (verified)
- [ ] **PR #135 prod deploy** — Python prod jar/code update via `./scripts/deploy/deploy-smartbi-python.sh --env prod` Blue-Green (independent of Java)
- [ ] PR #135 test env smoke (chat 1/4 verified post-merge)
- [ ] Pattern B 4-branch matrix monitoring active (per PR #135 spec) — when real customers get Gold data populated, the 3 states (HOT/COLD/empty) and their byte-shape match Java legacy fallback

⚠️ **Blocker**: T6.4 cannot trigger until PR #135 prod deployed — real customer Gold-populated data could trigger State A/B/C divergence vs Java legacy fallback. Test factories had no Gold data (per memory `reference_smartbi_gold_layer_architecture.md`); real customers may.

### 3.3 chat 1 PR-3 dependencies

- [ ] chat 1 PR-3 N=2 prod cutover 24h soak GO ✓ (live 2026-05-07 11:36 CST → GO 2026-05-08 11:36 CST)
- [ ] prod cretas-python.service NRestarts unchanged in last 48h (across T6.3 + T6.4 prep window)
- [ ] PG conn count peak <85 over T6.3 24h window (cap 100, 15 headroom)
- [ ] Memory <4GB total cretas-python tree

### 3.4 Customer comms coordination (T6.4-specific)

- [ ] **销售团队通知** 14 customers potential blip during their cutover stage's window
- [ ] Per-customer comms timing aligned to chosen Option B stages (2-3 customers/day notification)
- [ ] Rollback contact list confirmed per customer (sales rep × support ticket channel)
- [ ] After-hours window selected for each stage if real customer transaction sensitivity matters (e.g. 餐饮 customers low-traffic at 03:00-05:00 CST)

### 3.5 Real-customer baseline metrics

- [ ] Sample 24h Java baseline metrics for each of 14 customers (sales count, order revenue, dashboard call volume) — captured BEFORE cutover window
- [ ] Anomaly detection thresholds set: ±20% deviation from baseline triggers investigation post-cutover
- [ ] Pattern B State distribution baseline: which customers have populated Silver/Gold POS data?
  - Customer with Gold data → Pattern B State A path (Python real port)
  - Customer no Gold data → Pattern B State C path (empty + Java fallback parity)

### 3.6 Operational

- [ ] Today's daily backup ✓ (smartbi_prod_db_YYYYMMDD_*.sql.gz ≥ 400MB)
- [ ] Server 139 nginx config valid: `nginx -t` PASS
- [ ] No active P1 incident on prod
- [ ] Monitoring dashboards open: per-customer error rate, p99, Java fallback rate, Python error rate

---

## 4. Nginx vhost diff plan

### 4.1 Current state (post-T6.3)

Vhost path: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf` (宝塔 panel path).

T6.3 has 3 regex blocks at line 38-58 (per PR #110 §3.3) covering 61 test factories.

### 4.2 T6.4 expansion — Option B staggered regex extensions

#### Stage B1 (Day 1) — add F002, F003

T6.3 regex: `(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)`

Stage B1 regex (T6.3 + 2):
```
(F00[1-3]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```

Coverage: 61 + 2 = 63 factories.

#### Stage B2 (Day 2) — add F004, F006, R001

```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|R001|TEST_0000_001)
```

Coverage: 63 + 3 = 66 factories.

#### Stage B3 (Day 3) — add RES_GML_001, RES_3101_009

```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|TEST_0000_001)
```

Coverage: 66 + 2 = 68 factories. Note `RES_3101_00[1-8]` → `RES_3101_00[1-9]` to include RES_3101_009 (QHJ_PROD).

#### Stage B4a (Day 4) — add R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH, R_XMX_FRESH2

```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[12]?))|TEST_0000_001)
```

Coverage: 68 + 4 = 72 factories.

#### Stage B4b (Day 5) — add R_XMX_FRESH3, R_YHDJ_DEMO, R_YJJ_DEMO (final)

```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)
```

Coverage: 72 + 3 = **75 factories** ✓ (T6.4 fully done, all 75 factories on Python)

### 4.3 Apply procedure (executor reads, NOT triggered by this doc)

```bash
# Per stage:
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  # 1. Backup current
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_<stage>_pre.\$(date +%Y%m%d_%H%M%S)
  # 2. Edit vhost (replace 3 regex blocks per §4.2 stage chosen)
  vi api.cretaceousfuture.com.conf
  # 3. Validate
  nginx -t
  # 4. Reload (graceful, no downtime)
  nginx -s reload
"
```

**Critical**: Each stage's backup uses suffix `t6_4_b1_pre`, `t6_4_b2_pre` etc. for granular rollback. Do NOT delete T6.3 backup `bak.t6_3_pre.20260508_032339` — remains canonical pre-T6.4 fallback.

---

## 5. Smoke test (post-cutover, before declaring stage GO)

### 5.1 Scope per stage

| Stage | New customers | Smoke calls (new × 19 endpoints) | Cumulative factories smoke (incremental verify) |
|---|---|---|---|
| B1 | 2 (F002, F003) | 38 calls | Sample 5 from T6.3 (F001 + 4 random) + 38 = ~133 |
| B2 | 3 (F004, F006, R001) | 57 | ~150 |
| B3 | 2 (RES_GML_001, RES_3101_009) | 38 | ~133 |
| B4a | 4 (R_GML_DEMO, R_XMX_CHAIN, R_XMX_FRESH, R_XMX_FRESH2) | 76 | ~190 |
| B4b | 3 (R_XMX_FRESH3, R_YHDJ_DEMO, R_YJJ_DEMO) | 57 | ~170 |
| **Final B4b post** | All 75 | (optional full smoke) 75 × 19 = 1425 calls | T6.4 done |

19 endpoints per factory same as T6.3 §4.1 (refer to `scripts/phase2a/t6-in-scope-endpoints.txt`).

### 5.2 Approach (executor implements)

Same JWT-based pattern as T6.3 §4.2:
1. Generate factory-scoped JWT for each new customer (signing with prod `JWT_SECRET`, role=`factory_super_admin`)
2. For each (factory, endpoint), curl through 139 nginx with `Authorization: Bearer <token>`
3. Verify `HTTP 200` AND response body parses as JSON AND `success` field present
4. **Real customer**: log per-customer pass/fail count + flag any Pattern B State divergence (compare to baseline if possible)
5. Estimated wall-clock per stage: <1 min serial; can parallelize 6-way

### 5.3 Failure threshold (T6.4 stricter than T6.3)

- **Any 5xx** → STOP cutover, rollback to previous stage state, investigate
- **Any 4xx for real customer factory** → suspect token misconfig OR real customer data shape issue, NOT cutover. Investigate before declaring stage GO. (T6.3 tolerated single 4xx as "factory data state" — T6.4 should treat 4xx more cautiously since real customers see those errors.)
- **Pattern B State divergence detected** (per chat 4 PR #135 4-branch matrix monitoring) → STOP, ping organizer

---

## 6. Rollback procedure (<2 min target, <1h customer impact target)

### 6.1 Trigger conditions (T6.4-specific)

- Smoke (§5) any 5xx
- **P1 customer report** ← T6.4 critical (real users)
- Customer-facing UI / data accuracy reports (sales team monitor "数据不对" feedback)
- Pattern B State distribution divergence vs baseline (per PR #135 monitoring)
- Real revenue / order metrics anomaly (±20% deviation from §3.5 baseline)
- Post-cutover monitoring shows GO criteria (§7) violated within first 24h
- Python prod 8083 down / unhealthy / OOM (chat 1 PR-3 territory but co-monitored)
- T6 dryrun-compare divergence rate >0.5%

### 6.2 Procedure (per stage rollback)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  # Find the most recent T6.4 stage backup (e.g. bak.t6_4_b3_pre.* if rolling back stage B3)
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_*_pre.* | head -1)
  echo \"Restoring from: \$BACKUP (rollback to previous stage state)\"
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

After rollback to stage N-1: only the customers added in stage N revert to Java; previous stages' customers stay on Python.

### 6.3 Full revert to T6.3 state (rare — only if all 14 broken)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  cp api.cretaceousfuture.com.conf.bak.t6_3_pre.20260508_032339 api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

This drops all T6.4 stages. All 14 real customers back on Java; T6.3 61 test factories stay on Python.

### 6.4 Customer comms during rollback

⛔ Real customer rollback **affects真 user** (vs T6.3 test factories had no user impact). Coordinate with sales team:
- Notify affected customer rep within 5 min of rollback decision
- Provide ETA for re-attempt (typically next-day after root cause investigation)
- Customer-visible blip should be <2 min (graceful nginx reload + traffic re-route to Java instantly)

---

## 7. GO criteria (24h soak after final stage)

T6.4 is **fully done** when Stage B4b (or Option A/C completion) holds 24h with all criteria:

### 7.1 Standard criteria (跟 T6.3 §6 mirror)

- **Python error rate** <0.5% across all 75 factories (61 test + 14 real)
- **p99 latency** <2000ms for sales / dashboard heavy endpoints
- **0 Java fallback** for any of the 14 real customer factories (Java logs should NOT see `/api/mobile/(F002|F003|F004|F006|R001|RES_GML_001|RES_3101_009|R_*)/smart-bi/...` traffic)
- **prod cretas-python.service `NRestarts` unchanged** (no crashes in 24h)
- **PG conn count peak <95** (cap 100, headroom for spikes)
- **Memory <4GB** total cretas-python process tree

### 7.2 T6.4-specific criteria (real customer critical)

- **0 P1 customer reports** affecting any of the 14 real customers ← **critical blocker**
- **Real revenue / order metrics within ±20% of §3.5 baseline** (no anomaly)
- **Customer-facing UI accuracy reports** clean (sales team monitor "数据不对" feedback channel)
- **Pattern B 3-state distribution stable** (per PR #135 4-branch matrix; State A/B/C distribution matches Java legacy fallback for each customer's Gold data state)
- **Real customer transaction rate normal** (跟 cutover 前 baseline comparison, no drop indicating user friction)

If any criterion fails → rollback per §6, investigate, retry once issue resolved.

---

## 8. Post-cutover monitoring (T6.4 unique)

### 8.1 Per-customer dashboard (T6.4 unique vs T6.3)

T6.3 had 61 anonymous test factories — aggregate monitoring sufficient.

T6.4 has 14 named real customers — per-customer monitoring required:
- Per-customer error rate (rolling 1h window)
- Per-customer p99 latency
- Per-customer transaction rate (daily orders, daily revenue) vs baseline
- Per-customer Pattern B State distribution (chat 4 PR #135 monitoring matrix)

### 8.2 Pattern B 3-state distribution monitoring

Per chat 4 PR #135 (`2e90a2016`) `_get_finance_overview` 3-state branching:

| State | Trigger | Expected behavior |
|---|---|---|
| State A (HOT) | Gold data populated + primary path | Python real port emits, byte-shape parity with Java |
| State B (COLD) | Gold data missing OR primary path unavailable | Python falls back to legacy path (mirror Java fallback) |
| State C (empty) | Both Silver and Gold empty | Both Java + Python emit empty overview, dict-eq match |

**Monitoring target**: For each of 14 real customers, measure State distribution over 24h post-cutover. Compare to Java baseline distribution (from §3.5 pre-cutover capture). Any State A → B unexpected transition or new State B with byte-shape divergence → P1.

### 8.3 Continuous parity check (similar to T6.3 §7.1)

T6 dryrun-compare should run continuously against any of the 14 customers that have meaningful data. Pick 1-2 representative real customers (e.g. F002 张记餐饮 if has data) and compare Java vs Python output for top 5 endpoints.

### 8.4 Traffic ratio verification

```bash
# On 47, after each stage:
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/python-prod.log | \
    grep -oE '/api/mobile/[^/]+/smart-bi' | \
    awk -F/ '{print \$4}' | sort | uniq -c | sort -rn | head -30
"
```

Expected after Stage B4b: 75 factory IDs visible. Real customers (14) ranked by transaction volume (likely high-rank).

### 8.5 Java fallback check (T6.4 final state)

```bash
ssh root@47.100.235.168 "
  tail -100000 /www/wwwroot/cretas/cretas-prod.log | \
    grep -E 'getFinanceOverview|getSalesOverview' | \
    grep -E '(F00[1-46]|FOOD_3101|MEAT_3101|OTHER_3101|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)'
"
```

Expected after Stage B4b: **empty** (no Java traffic for any of 75 factories). Any matches = cutover incomplete or nginx misconfig.

---

## 9. Customer comms plan (T6.4 unique)

### 9.1 Pre-cutover notification (per stage, 24h before)

Template:

> **【白垩纪 SmartBI 服务升级通知】**
> 尊敬的 {customer_name},
>
> 我们将在 {date} {time_window_start}-{time_window_end} 进行 SmartBI 后端服务升级。升级期间您的服务可能出现 <2 分钟的瞬时延迟。升级完成后, 数据分析与图表性能将有提升。
>
> 如有任何异常, 请联系 {sales_rep_contact}。
>
> 白垩纪技术团队

### 9.2 During-cutover comms

- Sales team monitor 客户反馈 channel (微信群 / 钉钉 / 工单)
- Engineer on-call ready to acknowledge customer reports within 5 min
- Live status: each stage "Pre-cutover" → "Cutover in progress" → "Cutover complete, monitoring" → "Stage GO"

### 9.3 Post-cutover comms

After Stage B4b 24h soak GO:

> **【白垩纪 SmartBI 升级完成通知】**
> 尊敬的 {customer_name},
>
> SmartBI 后端服务升级已完成并稳定运行 24 小时。如有任何使用问题, 请联系 {sales_rep_contact}。
>
> 白垩纪技术团队

### 9.4 P1 escalation chain

If P1 customer report during T6.4:
1. Sales rep → technical on-call (within 5 min)
2. Technical on-call → trigger §6 rollback (within 10 min if confirmed)
3. Customer comms: acknowledge + ETA for re-attempt (typically next-day post root cause)
4. Internal post-mortem doc within 24h

---

## 10. Pattern B production deploy prerequisite (BLOCKER for T6.4)

### 10.1 Status

Per memory `project_2026_05_07_t6_1_dryrun_in_flight.md` + chat 4 PR #135:
- **PR #135 `2e90a2016`**: `_get_finance_overview` 3-state branching impl, merged main
- **Prod jar/code**: not yet deployed (verify with `ls -lt /www/wwwroot/cretas/code` mtime + Python service grep on 3-state code path presence)

### 10.2 Deploy procedure (BEFORE T6.4 Stage B1)

```bash
# Pre-flight
cd /c/Users/Steve/my-prototype-logistics
git fetch origin
git pull origin main

# Test env first (per memory feedback_test_before_prod_smartbi.md)
./scripts/deploy/deploy-smartbi-python.sh --env test
# Verify Pattern B 3-state branching active in test env (smoke F999 with finance overview endpoint)

# Then prod (Blue-Green, independent of Java)
./scripts/deploy/deploy-smartbi-python.sh --env prod
# Verify NRestarts incremented by 1, no error spike post-restart
```

### 10.3 Why this is blocker

Real customer factories (14) may have populated Silver/Gold POS data (test factories did NOT). Without PR #135 prod deployed:
- Real customer hits `/finance` overview endpoint
- Old Python emits empty overview (only branch implemented before #135)
- Java legacy fallback returns full structural response with revenue/cost data
- **byte-shape divergence** ~4531B (per PR #124 chat 2 investigation Pattern B finding)
- T6.4 cutover would expose real customers to incorrect data emit

PR #135 prod deploy MUST complete before T6.4 to ensure 3-state matrix coverage.

### 10.4 Verification before T6.4 Stage B1

```bash
# Confirm 3-state branching code in prod Python:
ssh root@47.100.235.168 "
  grep -n '_get_finance_overview\|state_a\|state_b\|state_c' \
    /www/wwwroot/cretas/code/backend/python/smartbi_compat/api/analysis_finance.py | head -10
"
# Expected: matches indicating 3-state branching impl present
```

---

## 11. Resumption checklist (executor reads at cutover time)

### 11.1 Pre-Stage B1 setup

- [ ] Read this runbook in full
- [ ] Confirm pre-flight §3 all PASS (3.1-3.6 sections)
- [ ] Pattern B PR #135 prod deployed + verified §10.4
- [ ] Customer comms §9.1 pre-cutover notifications sent for Stage B1 customers (F002, F003) 24h prior
- [ ] On 47, capture pre-cutover baseline metrics §3.5 for 14 customers (revenue, order, dashboard call rate)

### 11.2 Per-stage execution (loop B1 → B4b)

- [ ] On 139, backup current vhost: `bak.t6_4_<stage>_pre.<timestamp>`
- [ ] Edit vhost per §4.2 stage chosen (replace 3 regex blocks)
- [ ] `nginx -t` validates
- [ ] `nginx -s reload` (graceful)
- [ ] Run smoke test §5 (per stage 38-76 calls)
- [ ] If any 5xx → §6 rollback immediately
- [ ] If smoke clean → start 4-12h inter-stage soak before next stage
- [ ] Per stage: monitor §8 for inter-stage soak window (per-customer error rate, Pattern B State, transaction rate)

### 11.3 Post-Stage B4b final 24h soak

- [ ] All 75 factories on Python (verify §8.4 traffic + §8.5 Java fallback empty)
- [ ] 24h GO criteria §7 monitor
- [ ] T6 dryrun-compare ≥99% match for sample real customers
- [ ] Sales team confirms 0 P1 customer reports
- [ ] §9.3 post-cutover comms sent to all 14 customers

### 11.4 T6.4 declared DONE

- [ ] Phase 2A 100% factories on Python ✓
- [ ] Java SmartBI service can be deprecated (post-T6.4 phase, separate ticket)
- [ ] Memory entry saved: `project_2026_05_DD_t6_4_done.md`
- [ ] T6.5 (Java SmartBI removal) trigger condition met if applicable

---

## 12. ⛔ HOLD blocks (this runbook does NOT execute cutover)

- This is a **doc-only readiness runbook**. Reading + reviewing it doesn't trigger any prod state change.
- Cutover execution is separate marching order, separate chat, separate worktree.
- Smoke test scripts referenced in §5 are NOT included here — executor implements them at cutover time.
- Rollback shell scripts referenced in §6 are NOT pre-installed — executor invokes inline at trigger time.
- Customer comms templates §9 are guidance — actual customer comms may need legal/marketing review per company policy.

---

## 13. Discovery findings baked into this runbook

| Finding | Implication |
|---|---|
| 14 real customer factory list per PR #110 §1.2 OUT-of-scope | Authoritative scope source, no re-discovery |
| `_DEMO`/`_FRESH` suffix misleading on R_* factories | Names confirm real chain pilots, treat as production |
| RES_3101_009 = QHJ_PROD production tenant | Sequence 009 next after T6.3 008 — regex extension `RES_3101_00[1-9]` |
| Strategy B staggered recommended per PR #110 §8 | T6.4 risk profile justifies vs big bang |
| Pattern B PR #135 prod deploy is blocker | Real customer Gold data could trigger 3-state divergence without it |
| F005 missing from F-numeric series | Historical gap, regex `F00[1-46]` covers 1/2/3/4/6 |

---

## 14. Coordination notes

### 14.1 chat dependencies

- **chat 1**: PR-3 N=2 prod cutover GO 2026-05-08 11:36 CST. Independent of this runbook (chat 1 modifies systemd, this modifies nginx vhost). Co-monitor cretas-python health during T6.4.
- **chat 2**: T6.3 readiness writer + executor. T6.4 trigger condition = chat 2 T6.3 24h soak GO declared. Chat 2 may hand off T6.4 execution to chat 3 or remain executor.
- **chat 4**: Pattern B PR #135 author. Prod deploy of #135 is T6.4 prereq §10. Chat 4 typically owns Python prod deploys.
- **chat 3 (this chat)**: T6.4 readiness writer (this doc). May or may not execute T6.4 depending on organizer marching order.

### 14.2 Independence

- Independent of any open PR. PR for this runbook is doc-only.
- Did not modify any prod state during readiness phase (worktree off origin/main `2e90a2016`, no SSH writes).
- Customer comms templates are **guidance**, not commitments — sales team owns final comms language.

### 14.3 Phase 2A completion definition

T6.4 24h soak GO = Phase 2A SmartBI Java→Python port DONE. All 75 factories on Python. Java SmartBI service can deprecate (T6.5 separate scope).
