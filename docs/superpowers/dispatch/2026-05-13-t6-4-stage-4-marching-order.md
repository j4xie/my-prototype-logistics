# ⏳ QUEUED — T6.4 Stage 4 cutover (R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH) — wait for Stage 3 GO

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-13 14:00-15:00 CST (Day 4 — restaurant chain pilots wave 1; T6.4 cutover window override per PR #141 §2.2)
**Phase**: cutover execution — modifies prod nginx vhost on 139

---

## 你的任务

执行 T6.4 Strategy B Stage 4: 切换 **R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH** 三个 restaurant chain pilot factories 到 Python.

⚠️ **Note: Stage 4 mapping rebalanced from cutover runbook §4.2 B4a** — 原 runbook 把 R_XMX_FRESH2 也放在 B4a (4 customers), 这版 marching order 把 R_XMX_FRESH2 推到 Stage 5 让 Stage 4 = 3 customers. 理由: Stage 4 是首个纯 R_* 阶段, 减少 customer 数让 chain pilot 数据 shape 风险更可控. Stage 5 再合并 4 个剩余.

**新增工厂 (this stage)**: 3
**Cumulative coverage after Stage 4**: 68 (Stage 3) + 3 = **71 factories** on Python.
**Remaining after Stage 4**: 4 of 14 T6.4 customers (Stage 5 final).

---

## ⛔ HOLD until trigger

- [ ] **Stage 3 48h soak GO declared** (note: Stage 3 used extended 48h, not 24h)
- [ ] No outstanding P1/P2 from Stages 1+2+3 (7 customers stable)
- [ ] Sales team T-24h pre-notice sent to 3 R_* chain pilot contacts
- [ ] §3.5 baseline metrics captured for R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH
- [ ] On-call 销售对接人 confirmed
- [ ] Stage 3 backup filename recorded
- [ ] **Stage 4 specific check**: Confirm with sales which actual chain brand (桂满陇 demo / 唏嘛香 chain / 唏嘛香 fresh) maps to which factory ID — may require ops calendar review (e.g. 唏嘛香 chain peak 高峰时段 if applicable)
- [ ] Pattern B PR #135 verified active in prod Python

---

## Step 0 — Worktree

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-4-stage-4-exec -b ops-t6-4-stage-4-exec origin/main
cd .worktrees/t6-4-stage-4-exec
```

---

## Step 1 — CRITICAL backup

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s4_pre.\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_4_s4_pre.* | head -1
"
```

---

## Step 2 — Nginx vhost regex update

Stage 3 current regex:
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|TEST_0000_001)
```

Stage 4 new regex (add R_GML_DEMO + R_XMX_CHAIN + R_XMX_FRESH 三个 — note `FRESH` 不带 digit, 由后续 `/smart-bi/` boundary 自动 disambiguate from FRESH2/FRESH3):
```
(F00[1-46]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-9]|RES_GML_001|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH))|TEST_0000_001)
```

**Regex disambiguation**: nginx location `~ ^/api/mobile/(...)/smart-bi/...` enforces `/smart-bi/` boundary after factory ID. `R_XMX_FRESH/smart-bi/` matches `R_XMX_FRESH`, `R_XMX_FRESH2/smart-bi/` does NOT (no digit allowed before `/`). Tested in nginx PCRE.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  sed -i 's/|R001|TEST_0000_001/|R001|R_(GML_DEMO|XMX_(CHAIN|FRESH))|TEST_0000_001/g' api.cretaceousfuture.com.conf
  grep -c 'R_(GML_DEMO|XMX_(CHAIN|FRESH))' api.cretaceousfuture.com.conf  # Expected: 3
"
```

Coverage after Stage 4: **71 factories**.

⚠️ **Verify R_XMX_FRESH2/FRESH3 still route to Java** post-reload:
```bash
TOKEN_FRESH2=$(python scripts/phase2a/gen-factory-jwt.py R_XMX_FRESH2 factory_super_admin)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN_FRESH2" \
  "https://api.cretaceousfuture.com/api/mobile/R_XMX_FRESH2/smart-bi/analysis/sales/overview"
# Should still hit Java 10010 (verify via Java prod log: tail | grep R_XMX_FRESH2)
```

---

## Step 3 — nginx -t + reload

```bash
ssh root@139.196.165.140 "
  nginx -t && nginx -s reload && echo 'reload OK at '\$(date +%H:%M:%S) || echo 'NGINX TEST FAIL'
"
```

---

## Step 4 — Smoke test (3 factories × 19 endpoints = 57 calls)

```bash
TOKEN_GMLD=$(python scripts/phase2a/gen-factory-jwt.py R_GML_DEMO factory_super_admin)
TOKEN_XMXC=$(python scripts/phase2a/gen-factory-jwt.py R_XMX_CHAIN factory_super_admin)
TOKEN_XMXF=$(python scripts/phase2a/gen-factory-jwt.py R_XMX_FRESH factory_super_admin)

bash scripts/phase2a/t6-smoke-stage.sh \
  --factory R_GML_DEMO --token "$TOKEN_GMLD" \
  --factory R_XMX_CHAIN --token "$TOKEN_XMXC" \
  --factory R_XMX_FRESH --token "$TOKEN_XMXF" \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 6 \
  --output logs/t6-4-stage-4-smoke.log
```

Expected wall-clock: <90s for 57 calls.

### Smoke pass criteria

- 0 5xx; 0 4xx for these 3 factories
- **Verify R_XMX_FRESH2 / FRESH3 still on Java** (regex disambiguation test): Java prod log should show traffic for FRESH2/FRESH3, Python prod log should NOT
- Pattern B State explicit log per chain pilot

If fail → Step 7 rollback.

---

## Step 5 — Customer comms post-confirm (T+15min)

PR #141 §3.4 template, sales 直接发 chain pilot 联络人. R_* customers tier = "Restaurant chain pilots" → 微信 + 钉钉 主推, 邮件 sec.

---

## Step 6 — 24h soak GO criteria

- 0 P1 customer reports from 3 chain pilots ← critical
- Python error rate <0.5% across 71 factories
- p99 <2000ms for chain endpoints (sales / inventory / waste / cost analysis 餐饮重点)
- 0 Java fallback for these 3 factories
- **R_XMX_FRESH2 / FRESH3 still on Java** verified throughout 24h (no regex disambiguation regression)
- prod cretas-python NRestarts unchanged
- PG conn peak <85
- Real metrics ±20% of baseline
- Pattern B State distribution stable

---

## Step 7 — Rollback procedure

⚠️ Stage 4 rollback target: `bak.t6_4_s4_pre.<ts>` (Step 1 backup). Restores Stage 3 state.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_s4_pre.* | head -1)
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
"
```

PR #141 §3.6 rollback notice within 5 min.

---

## Step 8 — Resumption checklist for Stage 5 (FINAL stage)

- [ ] Stage 4 24h soak GO declared
- [ ] Stage 4 backup filename recorded
- [ ] No outstanding P1/P2 from Stages 1+2+3+4 (10 customers stable)
- [ ] Stage 5 customer pre-notices (R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO) sent T-24h
- [ ] **Stage 5 prep**: 4 customers in single stage = highest comms load — sales team 加倍 staffing for Day 5
- [ ] **Phase 2A completion prep**: Stage 5 GO = T6.4 done = Phase 2A 100% complete (75/75 factories on Python). Prepare Phase 2A celebration / retrospective doc for post-Stage-5.

Then organizer派 Stage 5 marching order (the FINAL one).

---

## ⛔ HOLD blocks summary

- ⛔ DO NOT execute until Stage 3 48h soak GO
- ⛔ DO NOT skip Step 1 backup
- ⛔ DO NOT use Stage-3 backup for Stage-4 rollback (over-revert)
- ⛔ DO NOT skip R_XMX_FRESH2/FRESH3 Java-routing verify in Step 2 — regex disambiguation matters
- ⛔ Coordinate with chat 4 (Pattern B) — chain pilots may have populated Gold data

---

## Coordination

- **Predecessor**: Stage 3 (`2026-05-12-t6-4-stage-3-marching-order.md`)
- **Sister docs**: cutover runbook §4.2 Stage B4a (note rebalance), comms plan
- **Next stage**: `2026-05-14-t6-4-stage-5-marching-order.md` (Day 5 FINAL: R_XMX_FRESH2 + R_XMX_FRESH3 + R_YHDJ_DEMO + R_YJJ_DEMO → Phase 2A 100% complete)
