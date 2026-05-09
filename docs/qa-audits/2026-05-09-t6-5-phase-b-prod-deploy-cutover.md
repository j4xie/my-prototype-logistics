# T6.5 Phase B Prod Deploy Cutover Record (2026-05-09)

**Cutover date**: 2026-05-09 23:33:10 CST (Asia/Shanghai)
**Author**: T6.5 Phase B execute chat (organizer-dispatched per PR #181 marching order)
**PR shipped**: [#205](https://github.com/j4xie/my-prototype-logistics/pull/205) — `feat(t6-5-phase-b): stub 23 SmartBI Analysis endpoint methods to 410 Gone`
**Main commit**: `be5959c504` (PR #205 squash-merge)
**Status**: ✅ Cutover successful, dual-port Blue-Green with Phase B JAR active, 24h soak in progress

---

## §1. Deploy Timeline

| Time (CST) | Event | Evidence |
|------------|-------|----------|
| 23:30:10 | First `deploy-backend.sh --env prod` blocked by stale lock from earlier test deploy | `[ERROR] 另一个 deploy 进程正在跑 (PID 64131, /tmp/cretas-backend-deploy.lock)` |
| 23:30:30 | Lock cleared (no active deploy/upload processes confirmed) | `rm /tmp/cretas-backend-deploy.lock` |
| 23:32:04 | mvn clean package SUCCESS — `cretas-backend-system-1.0.0.jar` (150 MB, MD5 `b2e6698…7e996`) | Local Windows build via wrapper Maven 3.9.6 |
| ~23:32:30 | R2 upload + server pull (Cloudflare, 39s, 3.85 MB/s) | Deploy script Stage 2 fallback |
| 23:32:53 | Backup `aims-0.0.1-SNAPSHOT.jar.bak.20260509_233255` created | `ls /www/wwwroot/cretas/*.bak*` |
| 23:32:53 | Old blue (10010) stopped (pre-deploy graceful stop) | `journalctl -u cretas-backend` |
| 23:33:10 | New blue (10010) started with Phase B JAR | `systemctl status cretas-backend → ActiveEnterTimestamp=Sat 2026-05-09 23:33:10 CST` |
| 23:34:33 | Blue health 200 (warmup ~83s, 5/5 nginx upstream switch verifications passed) | Deploy log `✓ blue 健康 (83s, 远端计数: 80s)` + `[BG 3/4] 切换 139 nginx upstream: 10020 → 10010` |
| 23:38:55 | **Accidental 2nd `deploy-backend.sh --env prod` invocation** by chat — TaskStop fired but partial steps executed | Backup `aims-0.0.1-SNAPSHOT.jar.bak.20260509_233855` evidence |
| 23:39:08 | Green (10020) auto-restarted (systemd `Restart=on-failure` policy fired after BG-stopped state) | `systemctl status cretas-backend-green → ActiveEnterTimestamp=Sat 2026-05-09 23:39:08 CST` |
| ~23:40 | Aborted 2nd deploy replaced JAR file on disk (md5 → `367d7c…3b92ce`, same source code, build-timestamp drift only) | `unzip -p ...class | strings | grep SMARTBI_MIGRATED` confirms Phase B stubs in new JAR too |
| 23:41:57 | Aborted 2nd deploy SIGTERM'd blue (10010) — never restarted because TaskStop fired before BG step completed | `systemctl: Active: inactive (dead) since Sat 2026-05-09 23:41:57; code=exited, status=143` |
| 23:48:06 | **Manual `systemctl start cretas-backend`** restored blue (10010) with on-disk JAR (md5 `367d7c…`) | `Active: active (running) since Sat 2026-05-09 23:48:06 CST` |
| 23:49:21 | Blue health 200 (warmup 75s) | T+75s curl `localhost:10010/api/mobile/health` → HTTP 200 |
| 23:49:30 | **Final dual-port verification PASS** — both 10010 + 10020 return 410+marker for F999 sales | §3 evidence |

**Net state post-cutover**:
- `cretas-backend.service` (port 10010 blue): active since 23:48:06 with JAR md5 `367d7c…` (Phase B verified)
- `cretas-backend-green.service` (port 10020 green): active since 23:39:08 with JAR loaded into JVM at 23:39:08 from then-on-disk md5 `b2e6698…` (also Phase B from PR #205)
- JAR file on disk: md5 `367d7c…` (Phase B, from aborted 2nd deploy upload)
- Both ports serve same Phase B 410 stubs ✓

---

## §2. F999 T-72h Notification — WAIVED

Steve organizer-level decision 2026-05-09 23:30 CST.

**Rationale** per HARD rule `feedback_active_e2e_replaces_passive_soak.md`:

1. **0-customer state**: 75 customer factories on Python via 139 nginx since T6.4 5-stage cascade completed 2026-05-09 06:34 CST. Java SmartBI traffic from real customers = 0.
2. **F999 internal-only**: F999 = internal Cretas test factory, not in nginx cohort regex, falls through to Java directly. F999 traffic = internal Cretas team scripts/tools only.
3. **Customer-visible impact = ZERO**: 410 stub fires only for F999 (and any future direct-IP-bypass clients hitting Java). 75 cohort factories unaffected.
4. **F999 internal team can adapt at-will**: standard waiver process applies — no 72h dead-time clock needed when 0 customers in critical path.
5. **HARD rule precedent**: Same rule that allowed T6.4 5-stage cascade to compress from spec-prescribed 5 days into 40 minutes (per memory `project_2026_05_09_phase_2a_complete.md`).

**Recipients** (informational, post-cutover): F999 internal users will encounter 410 + `SMARTBI_MIGRATED` marker + structured `newPath` pointing to `/api/smartbi/analysis/*` Python endpoints. Self-explanatory error message guides migration.

---

## §3. Spot-check Evidence (6/6 PASS)

All requests sent post-cutover via `https://api.cretaceousfuture.com` (139 nginx) with valid JWT (factory-scoped role `factory_super_admin`).

### §3.1 Stub paths — 410 + SMARTBI_MIGRATED expected

```
[F999-via-nginx-Sales] HTTP=410 marker=True
  body[:120]={"code":410,"message":"SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/sales (since 2026-05-09)","data"

[F999-via-nginx-Finance] HTTP=410 marker=True
  body[:120]={"code":410,"message":"SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/finance (since 2026-05-09)","dat

[F999-via-nginx-DDR] HTTP=410 marker=True
  body[:120]={"code":410,"message":"SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/data-date-range (since 2026-05-09)","data
```

### §3.2 Cohort routing — Python expected (NOT 410)

```
[F002-via-nginx-Sales] HTTP=200 marker=False
  body[:120]={"code":200,"message":"操作成功","data":{"overview":{"period":null,"startDate":null,"endDate":null,"kpiCards":[],"metricCard
```

F002 cohort match via 139 nginx `/api/mobile/{factory}/smart-bi/*` regex → routes to Python upstream (47:8083) → empty Python response (no Silver/Gold POS data populated for F002). **No 410, no marker** confirms Java was bypassed.

### §3.3 NOT_SAFE_FALLTHROUGH — alive Java for both F002 + F999

```
[F002-via-nginx-Production] HTTP=200 marker=False
  body[:120]={"code":200,"message":"操作成功","data":{"overview":{"period":"CUSTOM","startDate":"2026-01-01","endDate":"2026-05-09","kpiC

[F999-via-nginx-Production] HTTP=200 marker=False
  body[:120]={"code":200,"message":"操作成功","data":{"overview":{"period":"CUSTOM","startDate":"2026-01-01","endDate":"2026-05-09","kpiC
```

`/analysis/production` (NOT_SAFE per audit §3.1.a — no Python equivalent yet) returns 200 + Java mock OEE data for both factories. NOT_SAFE preservation verified ✓.

### §3.4 Test env smoke results (pre-prod gate, ran on 47:10011)

| Cohort | Total | PASS | FAIL |
|--------|-------|------|------|
| Stub (76 factories × 23 endpoints) | 1748 | **1748** | 0 |
| NOT_SAFE regression (F001 + F002 × 4 endpoints) | 8 | **8 alive** | 0 |

Wall-clock: 13s for 1756 calls (135 req/s). Smoke script `scripts/t6-5-phase-b-smoke.py`. Initial run had 152 false-FAILs on `/datasource/upload` (HTTP 415, multipart required) and `/datasource/apply` (HTTP 400, `@Valid SchemaApplyRequest` rejected empty body) — **Spring framework rejection BEFORE method body** (not stub bugs). Smoke script v2 added proper request-shape building (multipart for upload, valid JSON body for apply); re-run was 1748/1748 clean.

---

## §4. Blue-Green Observations (Non-blocking)

### §4.1 Both ports active post-deploy with same JAR

- Blue (10010): originally deployed 23:33:10 with md5 `b2e6698…`, stopped 23:41:57 by aborted 2nd deploy, manually restarted 23:48:06 with md5 `367d7c…`
- Green (10020): originally stopped 23:34 by BG flip, auto-restarted 23:39:08 by systemd `Restart=on-failure` policy, JVM has md5 `b2e6698…` loaded
- Both `b2e6698…` and `367d7c…` JAR files contain identical Phase B source (PR #205 main HEAD), differ only in mvn build-timestamp embedded in manifest. Verified via `unzip -p .../SmartBIAnalysisController.class | strings | grep SMARTBI_MIGRATED` — both contain stub strings.

**Net effect**: regardless of which JAR a port loaded into JVM, all 23 stubbed endpoints return 410+marker. Both ports verified directly:
```
port 10010: HTTP=410 marker=True
port 10020: HTTP=410 marker=True
```

### §4.2 Nginx upstream config drift (cosmetic, non-blocking)

`/www/server/panel/vhost/nginx/_upstream_cretas.conf` on server 139:
```
upstream cretas_backend {
    server 47.100.235.168:10020;  # ACTIVE=10010 (switched 2026-04-15)
    keepalive 32;
}
```

Comment claims `ACTIVE=10010 (switched 2026-04-15)`; `server` directive shows `:10020`. Today's deploy script log emitted "切换 139 nginx upstream: 10020 → 10010" + 5/5 verification passes — yet config file still shows `:10020`.

**Functional impact**: NONE. Both ports run Phase B JAR; all routes serve correct response regardless of which port nginx hits. Health 200 via nginx confirmed.

**Tracking**: filed as [issue #209](https://github.com/j4xie/my-prototype-logistics/issues/209) — `tooling: deploy-backend.sh nginx _upstream_cretas.conf comment update on Blue-Green switch`.

### §4.3 Aborted 2nd deploy — process lesson

Chat accidentally invoked `./scripts/deploy/deploy-backend.sh --env prod` a second time (intended only `tail -10` of completed first run's output). TaskStop aborted partway, leaving:
- Blue stopped (deliberately, by 2nd deploy's BG-stop step)
- JAR file replaced with new build (md5 drift, same source)
- nginx upstream config unchanged (whatever 1st deploy set)

**Recovery**: manual `systemctl start cretas-backend` brought blue back online. Issue #209 captures the upstream-comment drift discovered during recovery investigation.

**Lesson**: when piping deploy-script output through `tail`, do NOT re-invoke the full `deploy-backend.sh` command. Use `tail -10 /tmp/cretas-backend-deploy.log` or similar log-tailing instead.

---

## §5. 24h Monitor Plan

### §5.1 Background watchers

```bash
ssh root@47.100.235.168 "journalctl -u cretas-backend cretas-backend-green -f \
  | grep -E 'SMARTBI_MIGRATED|ERROR|5xx'" &  # tail SMARTBI_MIGRATED hit log + errors

ssh root@47.100.235.168 "tail -f /www/wwwroot/cretas/cretas-prod.log \
  | grep -iE 'error|exception|5..'" &  # tail prod log for unhandled errors
```

### §5.2 Checkpoint pings

| Time (CST) | Wall-clock from cutover | Check |
|------------|------------------------|-------|
| 2026-05-10 00:33 | T+1h | 5xx rate <0.5%, SMARTBI_MIGRATED hit count by factory + endpoint, no NOT_SAFE regression |
| 2026-05-10 05:33 | T+6h | Same metrics, customer support inbox check |
| 2026-05-10 23:33 | T+24h | Final tally — Phase C trigger ready (per §6) |

### §5.3 Rollback trigger conditions (per spec §B.3)

If during 24h monitor:
- 5xx rate spikes >1% on Java prod → investigate before considering rollback
- Customer (cohort) factory reports 410 from Java path → nginx miss-route (fix nginx, NOT Java rollback)
- F999 internal team reports business-critical impact → consider F999-only nginx route to Python (per Phase 2A spec future scope)

**Java rollback path** (last resort):
```bash
ssh root@47.100.235.168 "cp /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.bak.20260509_233255 /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar && systemctl restart cretas-backend cretas-backend-green"
```

---

## §6. GO Criteria → Phase C Trigger

Per spec [`docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`](../superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md) §B.4 + audit [`2026-05-09-t6-5-phase-a-deletion-candidates.md`](2026-05-09-t6-5-phase-a-deletion-candidates.md) §6.2:

- [ ] 30 days continuous: 0 410 hits in Java prod log from non-F999 factories
- [ ] No P1 customer reports of "missing endpoint" / "service moved" errors
- [ ] No scheduled jobs / CI / automation hits 410 paths (operator confirmation)
- [ ] Test environment Phase C dry-run successful

**HARD rule application**: Per `feedback_active_e2e_replaces_passive_soak.md` (graduated 2026-05-09), the 30-day passive soak window may be **compressed via active E2E verification** if 0-customer-traffic state holds. Active Playwright E2E on web-admin (139:8086 → real prod 47:10010 chain) replaces passive dead-time wait. **Decision deferred to organizer** at T+24h checkpoint.

---

## §7. Cross-references

| Resource | Location |
|----------|----------|
| Audit doc (Phase A deletion candidates) | [`docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md`](2026-05-09-t6-5-phase-a-deletion-candidates.md) |
| Marching order (PR #181) | [`docs/superpowers/dispatch/2026-05-09-t6-5-phase-b-stub-marching-order.md`](../superpowers/dispatch/2026-05-09-t6-5-phase-b-stub-marching-order.md) |
| Spec (Decision 4B) | [`docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`](../superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md) |
| Stub PR | [#205](https://github.com/j4xie/my-prototype-logistics/pull/205) |
| Pre-flight verify doc | [`docs/qa-audits/2026-05-09-t6-5-phase-b-prereq-verify.md`](2026-05-09-t6-5-phase-b-prereq-verify.md) |
| Dry-run audit (PR #197) | [`docs/qa-audits/2026-05-09-pr181-marching-order-dry-run-audit.md`](2026-05-09-pr181-marching-order-dry-run-audit.md) |
| Decision 2A (F999 unconditional 410) | Steve organizer 2026-05-09 |
| Decision (F999 T-72h waiver) | Steve organizer 2026-05-09 23:30 CST — see §2 above |
| Issue #209 (nginx config comment drift) | [#209](https://github.com/j4xie/my-prototype-logistics/issues/209) |
| Memory: active-E2E replaces passive-soak | `feedback_active_e2e_replaces_passive_soak.md` |
| Memory: pause-before-deploy | `feedback_pause_before_deploy_or_push.md` |
| Memory: concurrent-edit Rule 5b | `feedback_concurrent_edit_safety.md` |

---

**End of T6.5 Phase B prod deploy cutover record.**
