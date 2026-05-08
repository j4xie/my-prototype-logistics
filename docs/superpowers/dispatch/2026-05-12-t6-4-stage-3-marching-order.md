# ⏳ QUEUED — T6.4 Stage 3 cutover (RES_GML_001 + RES_3101_009) — wait for Stage 2 GO

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-12 03:00-05:00 CST (Day 3 — **HIGH-VOLUME real customer day**)
**Phase**: cutover execution — modifies prod nginx vhost on 139

---

## 你的任务

执行 T6.4 Strategy B Stage 3: 切换 **RES_GML_001 (桂满陇 production)** + **RES_3101_009 (QHJ_PROD production tenant)** 两个 high-volume real customer factories 到 Python.

**⚠️ Stage 3 is the highest-stakes pre-restaurant-chain stage**: 桂满陇是已上线生产环境的连锁餐饮 chain, QHJ_PROD 是 production tenant — 这两个客户对数据准确度和性能最敏感. 切换失败客户可见性 100%.

**新增工厂 (this stage)**: 2
**Cumulative coverage after Stage 3**: 66 (Stage 2) + 2 = **68 factories** on Python.
**Remaining after Stage 3**: 7 of 14 T6.4 customers (all R_* restaurant chain pilots, Stages 4-5).

---

## ⛔ HOLD until trigger

- [ ] **Stage 2 24h soak GO declared**
- [ ] No outstanding P1/P2 from Stages 1+2 (5 customers stable)
- [ ] Sales team T-24h pre-notice sent to 桂满陇 + QHJ_PROD contacts via **multiple channels** (邮件 + 微信 + 钉钉 + 电话, given high stakes)
- [ ] §3.5 baseline metrics captured for RES_GML_001 + RES_3101_009 (especially: peak transaction times, dashboard call patterns, Pattern B State distribution baseline)
- [ ] **Extended on-call**: 销售对接人 + 技术值班 + organizer **all** confirmed available T-24h to T+48h (this stage warrants 48h soak instead of 24h before declaring GO)
- [ ] Pattern B PR #135 prod-deployed verified (this is the stage where real-customer Gold data divergence risk peaks)
- [ ] Stage 2 backup filename recorded
- [ ] No active P1 incident on prod
- [ ] **Stage 3-specific check**: 桂满陇 + QHJ_PROD 没有 scheduled batch jobs / nightly reports in 03:00-05:00 window — confirm with customer ops

---

## Step 0 — Worktree

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-4-stage-3-exec -b ops-t6-4-stage-3-exec origin/main
cd .worktrees/t6-4-stage-3-exec
```

---

## Step 1 — CRITICAL backup (per PR #142)

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s3_pre.\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_4_s3_pre.* | head -1
"
```

---

## Step 2 — Nginx vhost regex update

Stage 2 current regex:
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|R001|TEST_0000_001)
```

Stage 3 new regex (add RES_GML_001 + 把 `RES_3101_00[1-8]` → `RES_3101_00[1-9]` 来含 RES_3101_009 = QHJ_PROD):
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|TEST_0000_001)
```

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  sed -i 's/RES_3101_00\[1-8\]/RES_3101_00[1-9]/g; s/|R001|TEST_0000_001/|RES_GML_001|R001|TEST_0000_001/g' api.cretaceousfuture.com.conf
  grep -c 'RES_3101_00\[1-9\]' api.cretaceousfuture.com.conf  # Expected: 3
  grep -c 'RES_GML_001|R001' api.cretaceousfuture.com.conf  # Expected: 3
"
```

Coverage after Stage 3: **68 factories**.

---

## Step 3 — nginx -t + reload

```bash
ssh root@139.196.165.140 "
  nginx -t && nginx -s reload && echo 'reload OK at '\$(date +%H:%M:%S) || echo 'NGINX TEST FAIL'
"
```

---

## Step 4 — Smoke test (2 factories × 19 endpoints = 38 calls + extended Pattern B verify)

```bash
TOKEN_GML=$(python scripts/phase2a/gen-factory-jwt.py RES_GML_001 factory_super_admin)
TOKEN_QHJ=$(python scripts/phase2a/gen-factory-jwt.py RES_3101_009 factory_super_admin)

bash scripts/phase2a/t6-smoke-stage.sh \
  --factory RES_GML_001 --token "$TOKEN_GML" \
  --factory RES_3101_009 --token "$TOKEN_QHJ" \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 4 \
  --output logs/t6-4-stage-3-smoke.log

# EXTRA — Pattern B 3-state verify for both factories' finance overview:
for FID in RES_GML_001 RES_3101_009; do
  TOKEN=$(python scripts/phase2a/gen-factory-jwt.py $FID factory_super_admin)
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cretaceousfuture.com/api/mobile/$FID/smart-bi/analysis/finance/overview" \
    | jq '. | {hasGoldData: .data.hasGoldData, fallbackUsed: .data.fallbackUsed, totalRevenue: .data.totalRevenue}'
done
```

### Smoke pass criteria

- 0 5xx; 0 4xx
- Pattern B State distribution **explicitly logged** for both factories — compare to baseline
- 桂满陇 high-volume → check p99 latency on top 5 endpoints (sales / dashboard / finance overview / inventory / quality)

---

## Step 5 — Customer comms post-confirm (T+15min)

⚠️ Stage 3 customers warrant **personalized phone confirm** in addition to PR #141 §3.4 template — 销售对接人 直接电话客户 ops 联络人 verify 服务正常.

---

## Step 6 — **48h** soak GO criteria (extended for high-stakes stage)

Stage 3 uses **48h soak** instead of 24h (consensus from organizer per high real-customer impact):

- 0 P1 customer reports from 桂满陇 + QHJ_PROD ← critical, **48h**
- Python error rate <0.3% (tighter than 0.5% standard) for these 2 factories
- p99 <1500ms (tighter than 2000ms) — 桂满陇 SLA 敏感
- 0 Java fallback for RES_GML_001 / RES_3101_009
- prod cretas-python NRestarts unchanged in 48h
- PG conn peak <80 (tighter)
- Real metrics ±10% of baseline (tighter than 20%)
- Pattern B State distribution **identical** to baseline (any State A→B unexpected transition = P1)
- 桂满陇 ops team confirms "数据正常" via channel (no silent issue accumulation)

If any criterion fails → Step 7 rollback, ping organizer + chat 4 (Pattern B owner).

---

## Step 7 — Rollback procedure

⚠️ Stage 3 rollback target: `bak.t6_4_s3_pre.<ts>` (Step 1 backup). Restores Stage 2 state — F002/F003/F004/F006/R001 stay on Python, RES_GML_001+RES_3101_009 revert to Java.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_s3_pre.* | head -1)
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

P1 rollback for these customers requires:
- 5 min: 销售 直接电话客户 ops, 致歉 + ETA
- 10 min: 内部 P1 ticket + post-mortem 触发
- Next-day retry decision after RCA

---

## Step 8 — Resumption checklist for Stage 4

- [ ] Stage 3 **48h** soak GO declared (not 24h)
- [ ] Stage 3 backup filename recorded
- [ ] No outstanding P1/P2 from Stages 1+2+3 (7 customers stable)
- [ ] Stage 4 customer pre-notices (R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH) sent T-24h
- [ ] **Stage 4 specific**: R_* chain pilots — confirm with sales which actual chain (桂满陇 demo / 唏嘛香) maps to which factory ID

Then organizer派 Stage 4 marching order.

---

## ⛔ HOLD blocks summary

- ⛔ DO NOT execute until Stage 2 24h soak GO + extended prereqs gate (high-stakes stage)
- ⛔ DO NOT use 24h soak — use **48h** before declaring GO
- ⛔ DO NOT skip Pattern B 3-state verify in Step 4 — real-customer Gold data divergence risk peaks here
- ⛔ DO NOT delay rollback if Step 6 tighter criteria fail — 桂满陇/QHJ_PROD are SLA-sensitive
- ⛔ Coordinate tightly with chat 4 (Pattern B owner) during 48h soak

---

## Coordination

- **Predecessor**: Stage 2 (`2026-05-11-t6-4-stage-2-marching-order.md`)
- **Sister docs**: cutover runbook §4.2 Stage B3, comms plan §3 + §5 P1 escalation
- **Next stage**: `2026-05-13-t6-4-stage-4-marching-order.md` (Day 4: 3 R_* chain pilots — note rebalanced from runbook §4.2 B4a per organizer revision)
