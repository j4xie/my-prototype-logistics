# ⏳ QUEUED — T6.4 Stage 2 cutover (F004 + F006 + R001) — wait for Stage 1 GO

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-11 14:00-15:00 CST (Day 2; T6.4 cutover window override per PR #141 §2.2)
**Phase**: cutover execution — modifies prod nginx vhost on 139

---

## 你的任务

执行 T6.4 Strategy B Stage 2: 把 **F004 + F006 + R001** 三个工厂(2 F-numeric medium-volume + 1 demo→real pilot)从 Java 切换到 Python.

**新增工厂 (this stage)**: 3
**Cumulative coverage after Stage 2**: 63 (Stage 1) + 3 = **66 factories** on Python.
**Remaining after Stage 2**: 9 of 14 T6.4 customers.

---

## ⛔ HOLD until trigger

- [ ] **Stage 1 24h soak GO declared** (`2026-05-10-t6-4-stage-1-marching-order.md` Step 6 all PASS)
- [ ] No outstanding P1/P2 from F002/F003 (Stage 1 customers)
- [ ] Sales team T-24h pre-notice (PR #141 §3.1) sent to F004 + F006 + R001 customers
- [ ] §3.5 baseline metrics captured for F004 + F006 + R001
- [ ] On-call 销售对接人 confirmed for these 3 customers
- [ ] Stage 1 backup filename `bak.t6_4_s1_pre.<ts>` recorded (rollback chain reference)
- [ ] No active P1 incident on prod

---

## Step 0 — Worktree

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-4-stage-2-exec -b ops-t6-4-stage-2-exec origin/main
cd .worktrees/t6-4-stage-2-exec
```

---

## Step 1 — CRITICAL backup (per PR #142)

⚠️ Each stage creates **its own** `bak.t6_4_s2_pre.<ts>`. Stage 2 rollback restores Stage-1 state (still 63 factories on Python), NOT T6.3 state.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s2_pre.\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_4_s2_pre.* | head -1
"
```

Record backup filename — Stage 3 chain reference.

---

## Step 2 — Nginx vhost regex update

Stage 1 current regex:
```
(F00[1-3]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```

Stage 2 new regex (add F004, F006, R001 → `F00[1-3]` becomes `F00[1-46]` + 加 `R001`):
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|R001|TEST_0000_001)
```

Note: `F00[1-46]` covers F001/F002/F003/F004/F006 (F005 historically gap per PR #110 §1.2). Apply via vi/sed to **all 3** location blocks.

```bash
# sed example for atomicity:
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  sed -i 's/(F00\[1-3\]|FOOD_3101_/(F00[1-46]|FOOD_3101_/g; s/|TEST_0000_001)/|R001|TEST_0000_001)/g' api.cretaceousfuture.com.conf
  grep -c 'F00\[1-46\]' api.cretaceousfuture.com.conf  # Expected: 3
  grep -c '|R001|TEST_0000_001' api.cretaceousfuture.com.conf  # Expected: 3
"
```

Coverage after Stage 2: **66 factories**.

---

## Step 3 — nginx -t + reload

```bash
ssh root@139.196.165.140 "
  nginx -t && nginx -s reload && echo 'reload OK at '\$(date +%H:%M:%S) || echo 'NGINX TEST FAIL'
"
```

If `nginx -t` fails → STOP, restore from Step 1 backup, ping organizer.

---

## Step 4 — Smoke test (3 factories × 19 endpoints = 57 calls)

```bash
TOKEN_F004=$(python scripts/phase2a/gen-factory-jwt.py F004 factory_super_admin)
TOKEN_F006=$(python scripts/phase2a/gen-factory-jwt.py F006 factory_super_admin)
TOKEN_R001=$(python scripts/phase2a/gen-factory-jwt.py R001 factory_super_admin)

bash scripts/phase2a/t6-smoke-stage.sh \
  --factory F004 --token "$TOKEN_F004" \
  --factory F006 --token "$TOKEN_F006" \
  --factory R001 --token "$TOKEN_R001" \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 6 \
  --output logs/t6-4-stage-2-smoke.log
```

Expected wall-clock: <90s for 57 calls.

### Smoke pass criteria

- 0 5xx; 0 4xx for these 3 factories
- All responses parse as JSON with `success` field
- R001 is "demo→real pilot" — extra attention on real-customer-style traffic patterns (not pure test data)

If fail → Step 7 rollback.

---

## Step 5 — Customer comms post-confirm (T+15min)

PR #141 §3.4 template, sales sends to F004 / F006 / R001 customers. Note R001 may need slightly different tone (pilot status — "感谢您作为我们的合作伙伴..." 等).

---

## Step 6 — 24h soak GO criteria

- 0 P1 customer reports from F004 / F006 / R001 ← critical
- Python error rate <0.5% across 66 factories
- p99 <2000ms for heavy endpoints
- 0 Java fallback for F004/F006/R001 (Java prod log grep)
- prod cretas-python NRestarts unchanged
- PG conn peak <85
- Real metrics ±20% of baseline
- Pattern B State distribution stable

---

## Step 7 — Rollback procedure

⚠️ Stage 2 rollback target: `bak.t6_4_s2_pre.<ts>` (created in Step 1). Restores Stage 1 state — F002+F003 stay on Python, F004+F006+R001 revert to Java.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_s2_pre.* | head -1)
  echo 'Restoring Stage 2 from:' \$BACKUP
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

PR #141 §3.6 rollback notice within 5 min via 电话 to affected customers.

---

## Step 8 — Resumption checklist for Stage 3

- [ ] Stage 2 24h soak GO declared
- [ ] Stage 2 backup filename recorded
- [ ] No outstanding P1/P2 from Stage-1+Stage-2 customers (F002/F003/F004/F006/R001)
- [ ] Stage 3 customer pre-notices (RES_GML_001 + RES_3101_009) sent T-24h
- [ ] **Special prep for Stage 3**: RES_GML_001 (桂满陇) is high-volume real customer, RES_3101_009 (QHJ_PROD) is production tenant — review their baseline metrics for sensitivity before Day 3

Then organizer派 Stage 3 marching order.

---

## ⛔ HOLD blocks summary

- ⛔ DO NOT execute until Stage 1 24h soak GO + prereqs gate
- ⛔ DO NOT skip Step 1 backup
- ⛔ DO NOT use T6.3 backup or Stage-1 backup for Stage-2 rollback (would over-revert)
- ⛔ Coordinate with chat 1 / chat 4 for Python health monitoring

---

## Coordination

- **Predecessor**: Stage 1 (`2026-05-10-t6-4-stage-1-marching-order.md`)
- **Sister docs**: cutover runbook §4.2 Stage B2, comms plan §3
- **Next stage**: `2026-05-12-t6-4-stage-3-marching-order.md` (Day 3: high-volume RES_GML_001 + RES_3101_009)
