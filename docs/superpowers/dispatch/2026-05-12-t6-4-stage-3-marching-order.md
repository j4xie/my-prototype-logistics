# ⏳ QUEUED — T6.4 Stage 3 cutover (RES_GML_001 + RES_3101_009) — wait for Stage 2 GO

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-12 14:00-15:00 CST (Day 3 — **HIGH-VOLUME real customer day**; T6.4 cutover window override per PR #141 §2.2)
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
- [ ] **Stage 3-specific check**: 桂满陇 + QHJ_PROD 没有 scheduled jobs / dashboard 高峰使用 / business operations spike in 14:00-15:00 window — confirm with customer ops (note: window shifted from 03:00-05:00 to 14:00-15:00 per PR #141 §2.2 T6.4 override; collision check now scoped to afternoon ops not nightly batch)

---

## ⚠️ 48h High-Stakes Special Considerations (Stage 3 specific)

Stage 3 carries the highest pre-restaurant-chain stakes — 桂满陇 (RES_GML_001) is a live production chain restaurant + QHJ_PROD (RES_3101_009) is a production tenant. Customer-visible failure = 100%. The 9 considerations below MUST be honored in addition to the standard prereq gate above. Each item links to its enforcement step in the cutover sequence.

1. **48h soak (NOT 24h)** — high-volume real customer (桂满陇 chain + QHJ_PROD prod tenant) warrants doubled observation window before declaring Stage 3 GO. Enforced in Step 6 (this MO uses 48h soak gate, do NOT shortcut to 24h).

2. **Tighter quantitative thresholds** — error rate <**0.3%** (vs standard 0.5%) / p99 <**1500ms** (vs 2000ms) / PG conn peak <**80** (vs 85) / real metrics ±**10%** of baseline (vs ±20%). Enforced in Step 6 GO criteria. Any single threshold breach = STOP, do not declare GO until investigated or rolled back.

3. **Pattern B State distribution must be IDENTICAL to baseline** — any unexpected State A→B transition during 48h = **P1 trigger** (real-customer Gold data divergence risk peaks at this stage). Capture baseline State distribution in §3.5 prereq metrics; compare hourly during soak. Enforced in Step 6.

4. **Multi-channel T-24h pre-notice** (NOT email-only) — send pre-cutover notice via **邮件 + 微信 + 钉钉 + 电话** to 桂满陇 + QHJ_PROD ops contacts. Standard tier customers get 邮件 + 微信; Stage 3 escalates to all 4 channels because chain-restaurant ops teams operate 24/7 across mixed channels. Enforced in prereq gate above.

5. **Extended on-call T-24h to T+48h** — 销售对接人 + 技术值班 + organizer **all three** must confirm availability for the full 72h window. Standard stages need only 销售 on-call T-24h to T+24h. Stage 3 doubles both roster size and duration. Enforced in prereq gate above.

6. **Personalized phone confirm at T+15min** (NOT template-only) — after smoke pass, 销售对接人 must directly phone 桂满陇 + QHJ_PROD ops 联络人 to verify service is normal. Use PR #141 §3.4 template as the script base, but the phone call itself is mandatory — silent template-only confirm is insufficient at this tier. Enforced in Step 5.

7. **Confirm 14:00-15:00 cutover window has NO collision** — 桂满陇 + QHJ_PROD ops calendar must be reviewed pre-cutover with customer ops to confirm no scheduled jobs / dashboard 高峰使用 / business operations spike collide with the cutover window. If any collision found, reschedule cutover to next available no-collision window. Note: window shifted from 03:00-05:00 (default per PR #141 §2.1) to 14:00-15:00 (T6.4 override per §2.2) — collision-check scope shifts from nightly batch jobs to afternoon business ops. Enforced in prereq gate above (Stage 3-specific check).

8. **Coordinate with chat 4 (Pattern B owner) for FULL 48h** — chat 4 owns PR #135 Pattern B 3-state dispatcher. Real-customer Gold data divergence risk peaks at this stage (桂满陇 + QHJ_PROD may have populated Gold POS data that test factories lack). Daily sync at T+0 / T+12h / T+24h / T+36h / T+48h checkpoints; chat 4 must be on-call for emergency Pattern B State investigation if any divergence detected. Cross-ref Step 6 GO criterion 3 (Pattern B State identity).

9. **Tighter rollback trigger** — any P1 from RES_GML_001 OR RES_3101_009 → **immediate** `bak.t6_4_s3_pre.<TS>` restore + 销售直接电话致歉 within **5 min** (NOT 15 min standard). The phone-first rollback comms reflects chain-restaurant SLA sensitivity. Internal P1 ticket + post-mortem trigger within 10 min. Next-day retry decision blocked on RCA completion. Enforced in Step 7.

### Cross-reference table

| Consideration | Enforced in step | Default-stage value | Stage 3 value |
|---|---|---|---|
| 1. Soak duration | Step 6 | 24h | **48h** |
| 2a. Error rate gate | Step 6 | <0.5% | **<0.3%** |
| 2b. p99 latency gate | Step 6 | <2000ms | **<1500ms** |
| 2c. PG conn peak gate | Step 6 | <85 | **<80** |
| 2d. Real metrics deviation gate | Step 6 | ±20% | **±10%** |
| 3. Pattern B State drift = P1 | Step 6 | distribution stable | **identical to baseline** |
| 4. Pre-notice channel count | Prereq gate | 2 (邮件 + 微信) | **4 (+ 钉钉 + 电话)** |
| 5. On-call roster | Prereq gate | 1 sales | **3 (sales + tech + organizer)** |
| 5. On-call duration | Prereq gate | T-24h → T+24h | **T-24h → T+48h** |
| 6. Smoke pass confirm | Step 5 | template only | **template + phone call** |
| 7. Batch-job collision check | Prereq gate | not required | **required pre-cutover** |
| 8. Chat 4 sync cadence | Step 6 monitoring | end-of-soak only | **5 checkpoints across 48h** |
| 9. Rollback comms first-touch | Step 7 | T+15min template | **T+5min phone call** |

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
