# ⏳ QUEUED — T6.4 Stage 1 cutover (F002 + F003) — wait for trigger

**From**: organizer chat (Phase 2A T6.4 5-stage cutover)
**Date drafted**: 2026-05-08
**Target execution**: 2026-05-10 03:00-05:00 CST (Day 1 of Strategy B 5-day stagger)
**Phase**: cutover execution — modifies prod nginx vhost on 139, smoke-tests Python prod 8083

---

## 你的任务

执行 T6.4 Strategy B Stage 1: 把 **F002 + F003** 两个 F-numeric 真客户工厂从 Java (10010) 切换到 Python (8083), 通过修改 server 139 nginx vhost regex location 加这 2 个 factory ID.

**新增工厂 (this stage)**: 2
**Cumulative coverage after Stage 1**: 61 (T6.3) + 2 = 63 factories on Python.
**Remaining after Stage 1**: 12 of 14 T6.4 customers still on Java (待 Stage 2-5).

---

## ⛔ HOLD until trigger

**DO NOT execute** until **all** prereqs met. organizer will explicitly派 marching order with `⚡ IMMEDIATE` label when ready.

### Prereqs gate (all must PASS)

- [ ] T6.3 24h soak GO declared (ETA 2026-05-09 12:05 CST per memory `project_2026_05_08_t6_3_cutover_live.md`)
- [ ] Pattern B PR #135 prod-deployed via `./scripts/deploy/deploy-smartbi-python.sh --env prod` (verify: grep `state_a\|state_b\|state_c` in `/www/wwwroot/cretas/code/backend/python/smartbi_compat/api/analysis_finance.py` shows 3-state branching present)
- [ ] PR #141 customer comms plan templates available (`docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md`)
- [ ] Sales team T-24h pre-notice (§3.1 of comms plan) sent to F002 + F003 customers via preferred channel (typically 邮件 + 微信 for F-numeric tier)
- [ ] §3.5 cutover runbook baseline metrics captured for F002 + F003 (24h Java baseline: 接口调用量 / dashboard 加载次数 / 关键报表使用频次)
- [ ] On-call 销售对接人 confirmed available T-24h to T+24h of stage window
- [ ] Today's smartbi_prod_db daily backup ✓ (≥ 400MB, see `/www/wwwroot/cretas/backups/`)
- [ ] No active P1 incident on prod

---

## Step 0 — Worktree (强制 isolation)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-4-stage-1-exec -b ops-t6-4-stage-1-exec origin/main
cd .worktrees/t6-4-stage-1-exec
pwd && git branch --show-current
```

---

## Step 1 — CRITICAL backup creation (per PR #142 finding)

⚠️ **PR #142 rollback rehearsal critical finding**: 每个 T6.4 stage **必须** 创建独立 `bak.t6_4_<stage>_pre.<ts>` backup. **不能** 直接 rollback 到 T6.3 backup `bak.t6_3_pre.20260508_032339` — 那个是 pre-T6.4 fallback, rollback 到它会还原所有 T6.4 prior stages.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  TS=\$(date +%Y%m%d_%H%M%S)
  cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_4_s1_pre.\$TS
  echo 'Stage 1 backup created: api.cretaceousfuture.com.conf.bak.t6_4_s1_pre.'\$TS
  ls -lt api.cretaceousfuture.com.conf.bak.t6_4_s1_pre.* | head -1
"
```

**Record the backup filename in this MO's execution log** — Stage 2 rollback target depends on this.

---

## Step 2 — Nginx vhost regex update

Vhost path: `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`

T6.3 current regex (3 location blocks per PR #110 §3.3):
```
(F001|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```

Stage 1 new regex (T6.3 + F002 + F003 → `F001` becomes `F00[1-3]`):
```
(F00[1-3]|FOOD_3101_(00[1-9]|0[1-3][0-9]|04[0-8])|MEAT_3101_00[12]|OTHER_3101_001|RES_3101_00[1-8]|TEST_0000_001)
```

Apply via vi (replace **all 3** location blocks in vhost — they each have the regex, all 3 must update):

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  vi api.cretaceousfuture.com.conf
  # In vi: search /F001|FOOD_3101 → replace with F00[1-3]|FOOD_3101 (3 occurrences)
  # OR use sed for atomicity:
  # sed -i 's/(F001|FOOD_3101_/(F00[1-3]|FOOD_3101_/g' api.cretaceousfuture.com.conf
  # Verify: grep -c 'F00\[1-3\]' should be 3
"
```

Coverage after Stage 1: **63 factories** (61 T6.3 + F002 + F003).

---

## Step 3 — nginx -t + reload

```bash
ssh root@139.196.165.140 "
  nginx -t 2>&1
  # Expected: 'nginx: configuration file ... test is successful'
  if [ \$? -eq 0 ]; then
    nginx -s reload
    echo 'nginx reload OK at '\$(date +%H:%M:%S)
  else
    echo 'NGINX TEST FAIL — DO NOT RELOAD, investigate'
    exit 1
  fi
"
```

**If `nginx -t` fails** → STOP, ping organizer, **do NOT proceed to smoke**. Restore from Step 1 backup if needed.

---

## Step 4 — Smoke test (F002 + F003 × 19 endpoints = 38 calls)

Endpoints list: `scripts/phase2a/t6-in-scope-endpoints.txt` (19 endpoints same as T6.3).

```bash
# Generate factory-scoped JWT for F002 (per T6.3 §4.2 pattern):
TOKEN_F002=$(python scripts/phase2a/gen-factory-jwt.py F002 factory_super_admin)
TOKEN_F003=$(python scripts/phase2a/gen-factory-jwt.py F003 factory_super_admin)

# Smoke loop (parallelize 6-way per T6.3 method):
bash scripts/phase2a/t6-smoke-stage.sh \
  --factory F002 --token "$TOKEN_F002" \
  --factory F003 --token "$TOKEN_F003" \
  --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
  --gateway https://api.cretaceousfuture.com \
  --parallel 6 \
  --output logs/t6-4-stage-1-smoke.log
```

Expected wall-clock: <1 min for 38 calls.

### Smoke pass criteria

- **0 5xx** across 38 calls
- **0 4xx** for these specific factories (T6.4 stricter than T6.3 — 4xx for real customer = investigate)
- All responses parse as JSON with `success` field
- Per PR #143 baseline finding: `/dashboard` 404 from Python is **normal** — 那个 endpoint 不在 19-list, 不影响 smoke pass

### If smoke fails

- **5xx** → STOP, jump to Step 7 rollback immediately
- **4xx** → investigate (token misconfig vs real customer data shape) — do NOT declare GO until resolved or rolled back
- **Pattern B State divergence** suspected → ping organizer + chat 4 (PR #135 author)

---

## Step 5 — Customer comms post-confirm (T+15min)

Per PR #141 §3.4 template, sales team sends within 15 min of smoke pass:

```
【白垩纪 SmartBI 升级完成】
尊敬的 <customer_alias_f002> / <customer_alias_f003>,
SmartBI 后端升级已于 <HH:MM> 平稳完成,服务运行正常。
如使用中发现任何异常,请立即联系 <销售对接人>。技术团队 5 分钟内响应。
接下来 24 小时为重点观察期。
白垩纪技术团队
```

Sales fills in `<customer_alias>` from CRM (not in repo per non-leak policy).

---

## Step 6 — 24h soak GO criteria (after Stage 1, before Stage 2 trigger)

Stage 1 GO declared **only when all** met over 24h post-cutover:

- **0 P1 customer reports** from F002 + F003 ← critical blocker
- **Python error rate** <0.5% across 63 factories (61 T6.3 + 2 new)
- **p99 latency** <2000ms for sales / dashboard heavy endpoints
- **0 Java fallback** for F002 / F003 (Java prod log grep `/api/mobile/(F002|F003)/smart-bi/` = 0 matches)
- **prod cretas-python.service NRestarts unchanged** (no crashes in 24h)
- **PG conn count peak <85** (cap 100, headroom)
- **Real revenue / order metrics ±20% of baseline** for F002 + F003
- **Pattern B 3-state distribution stable** per PR #135 monitoring matrix

If any criterion fails → Step 7 rollback, ping organizer.

---

## Step 7 — Per-stage rollback procedure (<2 min target)

⚠️ **Stage 1 rollback target**: backup created in Step 1 (`bak.t6_4_s1_pre.<ts>`), **NOT** T6.3 backup. Stage 1 rollback reverts F002 + F003 to Java only; T6.3 61 factories stay on Python.

```bash
ssh root@139.196.165.140 "
  cd /www/server/panel/vhost/nginx
  BACKUP=\$(ls -t api.cretaceousfuture.com.conf.bak.t6_4_s1_pre.* | head -1)
  echo 'Restoring Stage 1 from:' \$BACKUP
  cp \"\$BACKUP\" api.cretaceousfuture.com.conf
  nginx -t && nginx -s reload
  echo 'Stage 1 rollback complete at '\$(date +%H:%M:%S)
"
```

After rollback: send PR #141 §3.6 rollback notice to F002 + F003 within 5 min via 电话 (preferred for P1).

---

## Step 8 — Resumption checklist for Stage 2

Before Stage 2 trigger (Day 2):

- [ ] Stage 1 24h soak GO declared (Step 6 all PASS)
- [ ] Stage 1 backup filename recorded for rollback chain reference
- [ ] No outstanding P1/P2 from F002/F003
- [ ] Stage 2 customer pre-notices (F004 + F006 + R001) sent T-24h
- [ ] Sales rotation confirmed for Stage 2 day

Then organizer派 Stage 2 marching order (`2026-05-11-t6-4-stage-2-marching-order.md`).

---

## ⛔ HOLD blocks summary

- ⛔ DO NOT execute until prereqs gate all PASS
- ⛔ DO NOT skip Step 1 (CRITICAL backup) — PR #142 rehearsal showed this is the only valid rollback target
- ⛔ DO NOT use T6.3 backup `bak.t6_3_pre.20260508_032339` for Stage 1 rollback (would revert all T6.4 progress)
- ⛔ DO NOT proceed to Step 4 if `nginx -t` fails in Step 3
- ⛔ DO NOT declare GO if any Step 6 criterion fails — rollback first
- ⛔ Coordinate with chat 1 (uvicorn N=2) + chat 4 (Pattern B) — co-monitor cretas-python health during this stage

---

## Coordination

- **Predecessor**: T6.3 cutover live since 2026-05-08 11:34 CST, 24h soak ETA 2026-05-09 12:05 CST
- **Sister docs**:
  - Cutover runbook §4.2 Stage B1: `2026-05-08-t6-4-real-customers-cutover-runbook.md`
  - Comms plan: `2026-05-08-t6-4-customer-comms-plan.md`
- **Next stage**: `2026-05-11-t6-4-stage-2-marching-order.md` (Day 2: F004 + F006 + R001)
