# ⚡ IMMEDIATE — T6.3 50% factories cutover readiness doc (doc-only, no prod state mutation)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Phase**: doc-only readiness — chat 2 写 plan,organizer 审,未来某 chat 跑 cutover
**Block**: T6.3 GO unblock 之前必须有 readiness doc
**Parallel**: chat 1 在做 PR-3 prod cutover (cretas-python.service N=2),互不冲突

---

## 你的任务

写 T6.3 50% factories cutover plan/runbook doc。**不动任何 prod state**。

Deliverable: 1 PR with `docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md`,含:
1. T6.3 50% factories 列表 (alphabetical split — 现 prod 75 factories,前 ~38 个)
2. Nginx vhost config diff (在 T6.2 F001 regex location 基础上扩展)
3. Rollback procedure (<2min via cp backup + nginx -s reload)
4. Smoke test 流程 (~38 factories × 19 endpoints = 722 calls)
5. GO criteria (per Phase 2A standard)

---

## Step 0 — Worktree (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/t6-3-readiness -b ops-t6-3-readiness origin/main
cd .worktrees/t6-3-readiness
pwd
git branch --show-current
```

---

## Step 1 — Reference

**T6.2 canary state** (你的工作起点):
- Memory `project_2026_05_07_t6_2_canary_live.md` (用户最新 memory): server 139 nginx 加 3 个 F001 regex location → cretas_python upstream (47:8083). Vhost backup `api.cretaceousfuture.com.conf.bak.t6_2_pre.20260507_035911`.
- Smoke 7/7 200, Python prod log 确认 F001 SmartBI 流量 from 139 nginx
- Rollback <2min via `cp backup → nginx -s reload`

**Multi-worker enablement** (chat 1 在做):
- `docs/superpowers/plans/2026-05-07-cretas-python-multi-worker.md` PR-3 section
- chat 1 PR-3 cutover marching order: `docs/superpowers/dispatch/2026-05-07-uvicorn-pr-3-prod-cutover-marching-order.md`
- N=2 + Path X-lite spike 已 PASS all gates: PR #107 (`6d02ad42`)

**Server topology**:
- `.claude/rules/server-operations.md` "服务器架构" section
- 139 (旧服务器, nginx 网关): `/www/wwwroot/showcase/cretaceousfuture/` + nginx vhost
- 47 (新服务器): cretas-python prod 8083 + Java 10010

---

## Step 2 — Discovery (read-only)

### 2.1 SSH 139 看当前 nginx vhost

```bash
ssh root@139.196.165.140 "
echo '=== current vhost ==='
cat /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf 2>/dev/null \
  || find /www/server/nginx -name 'api.cretaceousfuture.com.conf' 2>/dev/null

echo
echo '=== backup vhost (T6.2 pre) ==='
ls -lh /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf.bak.* 2>/dev/null \
  || find /www/server -name 'api.cretaceousfuture.com.conf.bak*' 2>/dev/null
"
```

记录:
- 当前 vhost 实际路径 (宝塔 or 标准位置)
- 现有 F001 regex location pattern (T6.2 加的 3 个)
- backup 文件位置

### 2.2 Diff 当前 vs backup,看 T6.2 加了什么

```bash
ssh root@139.196.165.140 "
diff /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf.bak.t6_2_pre.20260507_035911 \
     /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf
"
```

应看到 T6.2 加的 F001 regex location (含 `cretas_python` upstream, 路径包含 `/api/mobile/F001/smart-bi/`)。

### 2.3 查 prod 75 factories list (alphabetical)

```bash
ssh root@47.100.235.168 "sudo -u postgres psql -d cretas_prod_db -tAc \"
  SELECT id, name, type, created_at::date
  FROM factories
  WHERE deleted_at IS NULL
  ORDER BY id
\"" > /tmp/prod-factories.txt
wc -l /tmp/prod-factories.txt
head -10 /tmp/prod-factories.txt
tail -10 /tmp/prod-factories.txt
```

记录 factory IDs,format 一般是 `F001` / `F002` / ...。

确认 alphabetical sort 跟 ID 顺序一致 (F001 < F002 < ... 字典序自然)。

### 2.4 决定 50% split

75 factories × 50% = 37.5 → round to 38 (前一半 + 1)。

策略选择 (写进 doc §1):
- **Strategy A**: 前 38 个 ID (F001-F0XX) 走 Python — alphabetical 简单
- **Strategy B**: 跳过 F999 (test factory) + 选 真实 active factories 前 38 — 业务相关
- **Strategy C**: 选 low-traffic factories (avoid critical customers) — 保守起步

我推荐 **Strategy A** (alphabetical) — 最简单,T6.4 加另 50% 时只需扩展 regex。如果某 factory 是 critical customer 在 T6.3 GO 之前临时排除即可。

---

## Step 3 — 写 T6.3 cutover runbook

文件: `docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md`

Section 必含:

```markdown
# T6.3 50% factories cutover runbook

## 1. Cutover scope
- 50% factories 列表 (前 38 个 alphabetical, F001-F0XX)
- 排除: F999 (test factory, 仍走 T6.2 canary) — 或 include 看你 strategy
- 剩余 50% 仍走 Java (T6.4 时再切)

## 2. Pre-flight checks
- T6.2 canary 24h+ healthy (error <0.5%, p99 <2000ms, 0 Java fallback)
- chat 1 PR-3 N=2 prod cutover 已 done + 24h soak pass
- Java baseline metrics 仍在收 (PID 116595)
- T6.1 dryrun completed + report shows 100% match
- prod cretas-python current state verified (N=2, leader gate active)
- prod backup status (今晨 03:00 daily backup ✓)

## 3. Nginx vhost diff plan
- Backup current vhost: `cp api.cretaceousfuture.com.conf api.cretaceousfuture.com.conf.bak.t6_3_pre.$(date +%Y%m%d_%H%M%S)`
- Edit vhost 加新 regex locations (扩展 T6.2 F001 pattern):
  ```
  # Before (T6.2):
  location ~ "^/api/mobile/(F001)/smart-bi/" {
      proxy_pass http://cretas_python;
      ...
  }

  # After (T6.3):
  location ~ "^/api/mobile/(F001|F002|F003|...|F0XX)/smart-bi/" {
      proxy_pass http://cretas_python;
      ...
  }
  ```
- Validate: `nginx -t` (server-side, server 139)
- Reload: `nginx -s reload` (graceful, no downtime)

## 4. Smoke test
- For each of 38 factories:
  - 19 endpoints × HTTP 200 verify
  - Total: 722 calls
- 工具: 用 PR-1 spike 的 wrk pattern 改成 single-call mode
  - 生成 38 个 token (每 factory super_admin)
  - For each (factory, endpoint): curl + verify 200
- 失败 threshold: any 5xx → STOP cutover + investigate (or rollback)
- 预期完成时间: ~5-10 分钟

## 5. Rollback procedure (<2min)
```bash
ssh root@139.196.165.140 "
cp /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf.bak.t6_3_pre.YYYYMMDD_HHMMSS \
   /www/server/nginx/conf/vhost/api.cretaceousfuture.com.conf
nginx -t && nginx -s reload
"
```
- 触发条件: smoke 5xx / cutover 后 24h soak metrics 不达 GO criteria

## 6. GO criteria (24h soak)
- Python error rate <0.5% across 38 factories
- p99 <2000ms (sales / dashboard heavy endpoints)
- 0 Java fallback for cutover factories
- 0 P1 user reports
- prod cretas-python.service NRestarts unchanged

## 7. Post-cutover monitoring
- T6 dryrun-compare 同时跑 (continuous parity verify)
- Python prod access log: 38 factories 实际 traffic ratio
- PG conn count peak < 95 (cap 100)
- Memory < 4GB (N=2 prod)

## 8. T6.4 100% factories trigger conditions
- T6.3 24h soak GO criteria met
- 0 P1 reports for 24h
- 后续在新 marching order 决定 T6.4 timing
```

---

## Step 4 — Commit + PR + ping

⛔ HOLD: 不写**任何**实施代码 (即不动 vhost / systemd / Python config)。Doc only。

```bash
git add docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md
git status --short  # ← 验证只 1 文件
git commit -- docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md \
  -m "docs(t6-3): 50% factories cutover runbook (readiness, no impl)"
git push -u origin ops-t6-3-readiness
gh pr create --title "T6.3 50% factories cutover readiness runbook" \
  --body "Doc-only readiness for T6.3. Includes: 38 factory split (alphabetical strategy), nginx vhost diff plan, rollback procedure, smoke test 38×19=722 calls, GO criteria. Cutover execution awaits separate marching order after chat 1 PR-3 24h soak."
```

Ping organizer:
> T6.3 readiness runbook done. PR <URL>. 38 factories selected (F001-F0XX alphabetical). Nginx diff ready, rollback <2min, smoke 722 calls. Awaiting your review.

---

## ⛔ HOLD blocks (per feedback_sister_chat_phase_skip_ping)

| Block | Trigger |
|---|---|
| ⛔ DO NOT touch nginx vhost on 139 | doc only — actual cutover 单独 marching order |
| ⛔ DO NOT touch cretas-python.service on 47 | chat 1 PR-3 在做,不冲突 |
| ⛔ DO NOT modify factories table or any DB state | read-only query 决定 split |
| ⛔ DO NOT write smoke-test or rollback shell scripts | 这些是 cutover execution 时的工作,doc 里描述 procedure 即可 |
| ⛔ DO NOT trigger any prod cutover step | 即使只是 "试一下 nginx -t" 都不要做 |
| ⛔ DO NOT chain to T6.4 plan | T6.3 GO criteria 满足后才考虑 T6.4 |

---

## Stop-and-ping 触发条件

立即 ping organizer:
- T6.2 vhost 跟 backup diff 不是 3 个 F001 regex location (说明 T6.2 改动跟 memory 描述不一致)
- factories table 数量不是 75 (memory 数据 stale)
- factory ID format 不是 F0XX (e.g. UUID-based,影响 regex 设计)
- 现有 T6 plan doc 已存在 (重复工作)
- chat 1 PR-3 此时 fail rollback (T6.3 plan 暂时 invalid)

---

## ⛔ 禁止事项

1. **不动 prod 任何 state** — 全 doc only
2. **不写 cutover execution 代码** — 这是 doc,不是 impl
3. **不并行 T6.4 plan** — T6.3 GO 之前不考虑 T6.4
4. **不在主 worktree** 工作 — 用 `.worktrees/t6-3-readiness/`

---

## Resumption checklist

- [ ] `cd .worktrees/t6-3-readiness && pwd` 确认路径
- [ ] Read 这 marching order
- [ ] Step 2.1 SSH 139 nginx vhost discovery
- [ ] Step 2.2 vhost diff (T6.2 改了什么)
- [ ] Step 2.3 prod 75 factories list
- [ ] Step 2.4 决定 50% split strategy
- [ ] Step 3 写完整 runbook
- [ ] Step 4 commit + push + PR + ping
- [ ] **STOP** 等 organizer 审 PR 后给 cutover execution marching order (那是另一个 chat 的工作)
