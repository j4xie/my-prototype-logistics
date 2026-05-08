# ⏳ QUEUED — T6.4 Stage 5 cutover (FINAL: R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO) — wait for Stage 4 GO

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-14 14:00-15:00 CST (Day 5 — **FINAL stage, T6.4 completion = Phase 2A done**; T6.4 cutover window override per PR #141 §2.2)
**Phase**: cutover execution — modifies prod nginx vhost on 139, **completes Phase 2A migration**

---

## 你的任务

执行 T6.4 Strategy B Stage 5 (FINAL): 切换 **R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO** 四个最后的 restaurant chain pilot factories 到 Python.

🎯 **Stage 5 GO = T6.4 done = Phase 2A 100% complete** (75/75 factories on Python). All Java SmartBI traffic ceases. Java service stays running for Tool/Skill (still Java) but no SmartBI analysis traffic hits it.

**新增工厂 (this stage)**: 4
**Cumulative coverage after Stage 5**: 71 (Stage 4) + 4 = **75 factories** on Python (FULL).
**Remaining after Stage 5**: 0. 🎉

---

## ⛔ HOLD until trigger

- [ ] **Stage 4 24h soak GO declared**
- [ ] No outstanding P1/P2 from Stages 1+2+3+4 (10 customers stable)
- [ ] Sales team T-24h pre-notice sent to **all 4** Stage-5 chain pilot contacts (highest comms load day, sales 加倍 staffing)
- [ ] §3.5 baseline metrics captured for all 4 factories
- [ ] On-call **doubled**: 2× 销售对接人 + 2× 技术值班 for Day 5 (final stage warrants extra coverage)
- [ ] Stage 4 backup filename recorded
- [ ] **Stage 5 specific**: R_XMX_FRESH2/FRESH3 on Java currently — verify Stage 4 regex still routes them to Java (regression check before regex change)
- [ ] **Phase 2A completion artifacts ready**: retrospective doc draft, T6.4 done memory entry template, Java SmartBI deprecation notice draft (separate ticket trigger)
- [ ] No active P1 incident on prod
- [ ] Pattern B PR #135 verified active

---

## Step 0 — Worktree

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-4-stage-5-exec -b ops-t6-4-stage-5-exec origin/main
cd .worktrees/t6-4-stage-5-exec
```

---

## Step 1 — CRITICAL backup (FINAL stage, label clearly)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s5_pre.\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_4_s5_pre.* | head -1
  echo 'FINAL STAGE backup created. Phase 2A completion imminent.'
"
```

⚠️ **Do NOT delete** any prior T6.4 backup (`bak.t6_4_s1_pre.*` through `s4_pre.*`) or T6.3 backup — keep full rollback chain accessible during 24h post-Stage-5 soak.

---

## Step 2 — Nginx vhost regex update (FINAL coverage = 75 factories)

Stage 4 current regex:
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH))|TEST_0000_001)
```

Stage 5 FINAL regex (add R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO → `FRESH` → `FRESH[123]?` covers FRESH/FRESH1/FRESH2/FRESH3 + add `YHDJ_DEMO|YJJ_DEMO` to R_*):
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|TEST_0000_001)
```

Note: `FRESH[123]?` matches FRESH (no digit), FRESH1 (gap, never used), FRESH2, FRESH3. Backwards-compatible with FRESH (no digit) added in Stage 4.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  sed -i 's|R_(GML_DEMO|XMX_(CHAIN|FRESH))|R_(GML_DEMO|XMX_(CHAIN|FRESH[123]?)|YHDJ_DEMO|YJJ_DEMO)|g' api.cretaceousfuture.com.conf
  grep -c 'YHDJ_DEMO|YJJ_DEMO' api.cretaceousfuture.com.conf  # Expected: 3
  grep -c 'FRESH\[123\]?' api.cretaceousfuture.com.conf  # Expected: 3
"
```

⚠️ The sed pattern uses `|` inside `s|...|...|g` delimiter — escape carefully. Alternative: use vi manual replace if sed fragile.

Coverage after Stage 5: **75 factories** (Phase 2A 100%).

---

## Step 3 — nginx -t + reload

```bash
ssh root@139.196.165.140 "
  nginx -t && nginx -s reload && echo 'reload OK at '\$(date +%H:%M:%S) || echo 'NGINX TEST FAIL'
"
```

If `nginx -t` fails on this final stage → STOP, rollback from Step 1 backup, this is **the most important** stage to not push broken regex.

---

## Step 4 — Smoke test (4 factories × 19 endpoints = 76 calls + FULL 75-factory verify)

```bash
TOKEN_F2=$(python scripts/phase2a/gen-factory-jwt.py R_XMX_FRESH2 factory_super_admin)
TOKEN_F3=$(python scripts/phase2a/gen-factory-jwt.py R_XMX_FRESH3 factory_super_admin)
TOKEN_YHDJ=$(python scripts/phase2a/gen-factory-jwt.py R_YHDJ_DEMO factory_super_admin)
TOKEN_YJJ=$(python scripts/phase2a/gen-factory-jwt.py R_YJJ_DEMO factory_super_admin)

bash scripts/phase2a/t6-smoke-stage.sh \
  --factory R_XMX_FRESH2 --token "$TOKEN_F2" \
  --factory R_XMX_FRESH3 --token "$TOKEN_F3" \
  --factory R_YHDJ_DEMO --token "$TOKEN_YHDJ" \
  --factory R_YJJ_DEMO --token "$TOKEN_YJJ" \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 8 \
  --output logs/t6-4-stage-5-smoke.log

# OPTIONAL but recommended — full 75-factory cumulative verify (~1425 calls):
bash scripts/phase2a/t6-smoke-full.sh \
  --factory-list scripts/phase2a/t6-4-all-75-factories.txt \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 12 \
  --output logs/t6-4-final-full-smoke.log
# Expected wall-clock: ~10 min for 1425 calls
```

### Smoke pass criteria

- 0 5xx across all 76 (or 1425) calls
- 0 4xx for these 4 factories (and existing 71)
- Java prod log `/api/mobile/.../smart-bi/...` traffic = **0** for all 75 factories (final cutover verification — Java SmartBI traffic ceases)
- Pattern B State distribution stable for all 4 chain pilots

If 5xx anywhere → Step 7 rollback to Stage 4 state, investigate.

---

## Step 5 — Customer comms post-confirm (T+15min)

PR #141 §3.4 template to all 4 chain pilot customers. Plus:
- **§3.5 24h GO confirm template** prepared for D+1 dispatch (T6.4 final 24h GO confirms all 14 customers)

---

## Step 6 — 24h soak GO criteria (T6.4 FINAL gate)

After Stage 5 24h soak (= T6.4 done = Phase 2A complete):

### Standard criteria (all 75 factories)

- 0 P1 customer reports across **all 14** T6.4 customers in 24h ← critical blocker
- Python error rate <0.5% across all 75 factories
- p99 <2000ms for sales / dashboard heavy endpoints
- **0 Java fallback** for any of 75 factories (Java SmartBI traffic = 0 in 24h log)
- prod cretas-python.service NRestarts unchanged in 24h
- PG conn count peak <95 (cap 100, headroom for full-load spikes)
- Memory <4GB total cretas-python tree

### Phase 2A completion criteria

- Real revenue / order metrics ±20% of baseline for **all 14** real customers
- Pattern B State distribution stable for all 14 (especially 桂满陇 / QHJ_PROD high-volume)
- T6 dryrun-compare ≥99% match rate sustained across all 75 factories
- Sales team confirms 0 customer-facing UI accuracy reports ("数据不对") in 24h

If all PASS → 🎉 **T6.4 GO declared = Phase 2A 100% complete**.

---

## Step 7 — Rollback procedure (Stage 5 → Stage 4 state)

⚠️ Stage 5 rollback target: `bak.t6_4_s5_pre.<ts>` (Step 1 backup). Reverts FRESH2/FRESH3/YHDJ/YJJ to Java; Stages 1-4 customers stay on Python.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_s5_pre.* | head -1)
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

P1 rollback comms per PR #141 §3.6 to 4 affected chain pilots within 5 min.

---

## Step 8 — Phase 2A completion artifacts (after T6.4 GO)

After Stage 5 24h soak GO declared:

- [ ] **Memory entry**: save `project_2026_05_15_t6_4_done_phase2a_complete.md` capturing all 5 stages timeline, GO criteria results, lessons learned
- [ ] **Phase 2A retrospective doc**: `docs/superpowers/retrospectives/2026-05-15-phase2a-complete.md` — 50 endpoints ported, 75 factories migrated, Rule 1-12 graduated, T6.1-T6.4 timeline
- [ ] **§3.5 24h GO confirm template** sent to all 14 T6.4 customers + optionally broader 75-factory 升级公告 to all factory contacts (low-key, coordinate with marketing)
- [ ] **Java SmartBI deprecation ticket** filed (separate scope post-T6.4, T6.5 phase trigger condition met)
- [ ] **Backup retention review**: keep all 6 T6.4 backups (s1-s5 + T6.3) for 30 days minimum, then archive

---

## ⛔ HOLD blocks summary

- ⛔ DO NOT execute until Stage 4 24h soak GO + extended prereqs gate (FINAL stage warrants doubled on-call)
- ⛔ DO NOT skip Step 1 backup
- ⛔ DO NOT use prior stage backup for Stage-5 rollback (would over-revert)
- ⛔ DO NOT delete prior T6.4 stage backups during Stage 5 24h soak — keep full rollback chain
- ⛔ DO NOT trigger Java SmartBI deprecation (T6.5) until T6.4 24h GO + 7-day stability soak

---

## Coordination

- **Predecessor**: Stage 4 (`2026-05-13-t6-4-stage-4-marching-order.md`)
- **Sister docs**: cutover runbook §4.2 Stage B4b (note rebalance — 4 customers here, not 3 as in original B4b), comms plan §3.5 + §13
- **Successor**: T6.4 done → Phase 2A complete → T6.5 Java SmartBI deprecation (separate scope, separate ticket, NOT part of Phase 2A)

---

## Phase 2A completion summary (post-Stage-5 24h GO)

| Metric | Value |
|---|---|
| Endpoints ported (Java→Python) | 50 SmartBI analysis endpoints |
| Factories migrated | 75 / 75 (100%) |
| Real customers in T6.4 | 14 |
| Test factories in T6.3 | 61 |
| Total T6 stages | 4 (T6.1 dryrun + T6.2 F001 canary + T6.3 50% + T6.4 final 14) |
| T6.4 stages | 5 (Stage 1-5 staggered, 5 days) |
| Rules graduated | 12 (Rule 1-12 in `python-java-port.md`) |
| Pattern B 3-state branching | PR #135 |
| Phase 2A target dict-eq parity | 99.945% (T6.1 dryrun rate) |

🎉 **Phase 2A SmartBI Java→Python port complete.**
