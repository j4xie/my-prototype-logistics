# Phase 2C Tier 4 — `SmartBIPublicDemoController` Sunset Decision Audit

**Date**: 2026-05-09
**Author**: Chat L (organizer-dispatched audit)
**Trigger**: PR #152 scoping spec recommended Tier 4 SUNSET; this doc verifies that recommendation with caller analysis + prod log evidence.
**Status**: Audit doc only — no code, no execution. Operator decision required at §6.

---

## §0 TL;DR

**Verdict**: ✅ **SUNSET — high confidence**

- **10 endpoints** under `/api/public/smart-bi/*` (not 4 — marching-order projection drift noted in §1).
- **0 prod hits** in Java app log (current 1.84 GB + 12 rotated `.gz` files spanning 2026-04-28 → 2026-05-09).
- **0 hits** in 139 nginx access logs `api.cretaceousfuture.com.log` (API gateway) and `www.cretaceousfuture.com.log` (showcase site) over 5 months (Dec 2025 → May 2026).
- **8 hits** in `web-admin.log` — all from a **single dev IP** on a **single day** (2026-02-28) testing one share token; mixed browser/curl pattern indicates manual QA, not customer traffic. Subsequent 5+ months: 0 hits.
- **F_DEMO factory has empty data** — live probe (`localhost:10010 → /dashboard?period=month`) returns 200 with empty `kpiCards: []`, `data: []`. Nothing for customers to see anyway.
- **Frontend impact**: `SharedView.vue` (web-admin) calls `/api/public/smart-bi/share/{token}`, but **that endpoint does not exist** in any current Java controller (live probe → 404). This is a pre-existing broken caller; **not a Tier 4 endpoint**, not a sunset blocker.
- **Showcase site** (`platform/`, served from 139): only one mention of "smart-bi" in `ralph-loop-guide/index.html`, and it's documentation text (web-admin URL), **not an API call**.

**Recommendation**: SUNSET via static JSON snapshots in `platform/` (per PR #152 §4 sketch). Estimated effort: ~1-2 days FE + ~0.5 day BE delete + ~0.5 day deploy/verify. Operator sign-off needed because removing public demo path is a **business-visible** change (even if traffic is 0).

---

## §1 Methodology

### Inputs
- **Source of truth**: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIPublicDemoController.java` (HEAD = `45bb318d72`).
- **Spec context**: PR #152 (`8b88dbb9bd`) — Phase 2B port pipeline scoping, Tier 4 = PublicDemoController, sunset recommended.
- **Cross-reference**: PR #150 (`cf8cc48e8d`) T6.5 deprecation spec, PR #178 (`bd8e8afa79`) T6.5 Phase A deletion candidates, PR #155 (`34d4d4d605`) frontend impact verification.

### Steps executed
1. Read controller — enumerate `@*Mapping` count and verbs (§2).
2. `grep` web-admin / mobile RN frontend / `platform/` showcase for `/api/public/smart-bi` callers (§3).
3. `grep` security config (`JwtAuthInterceptor.java`) to confirm public-access posture (§3).
4. SSH 47 → search Java app log + 12 rotated `.gz` for hits (§4).
5. SSH 139 → search 16 nginx access logs for hits (§4).
6. Live probe via `ssh root@47 → curl localhost:10010` to verify current state (§4).

### Marching-order discrepancy noted
Marching order says "4 endpoints"; PR #152 says **10**; live source confirms **10**. Per `feedback_organizer_projection_bug.md`, I verified count from source rather than relying on the dispatch text. Audit proceeds with the actual 10.

---

## §2 10 endpoints inventory

All under `@RequestMapping("/api/public/smart-bi")`, no JWT, `@CrossOrigin` for `cretaceousfuture.com` + `139.196.165.140:8086` + `localhost:5173`. Demo factory hardcoded as `F_DEMO`.

| # | Verb | Path | Java line | Purpose |
|---|------|------|----------:|---------|
| 1 | POST | `/query` | 43 | Natural-language query (intent recognition + execution; falls back to LLM via `SmartBIService` facade) |
| 2 | POST | `/intent-test` | 86 | Test intent classifier — returns recognized intent + supported intent list |
| 3 | GET  | `/dashboard/executive` | 116 | Executive dashboard via `SalesAnalysisService.getSalesOverview` |
| 4 | GET  | `/dashboard` | 126 | Unified dashboard aggregating sales / finance / department / region / alerts / recommendations |
| 5 | GET  | `/analysis/sales` | 167 | Sales analysis with `dimension` switch (overview / salesperson / product / trend) |
| 6 | GET  | `/analysis/department` | 191 | Department ranking |
| 7 | GET  | `/analysis/region` | 207 | Region ranking + heatmap |
| 8 | GET  | `/recommendations` | 224 | Recommendation list |
| 9 | GET  | `/incentive-plan/{targetType}/{targetId}` | 233 | Incentive plan for salesperson/department |
| 10 | POST | `/drill-down` | 261 | Drill-down by region / department |

**Total**: 7 GET + 3 POST = 10 endpoints, 386 LOC. Matches PR #152 inventory.

**Service dependencies** (impact scope if controller deleted):
- `SalesAnalysisService`, `DepartmentAnalysisService`, `RegionAnalysisService`, `FinanceAnalysisService` — already retained for authenticated paths post-T6.5 (per PR #150 / PR #178). Tier 4 sunset does **not** delete these services.
- `SmartBIIntentService`, `RecommendationService`, `ForecastService` — same; retained for authenticated paths.
- `SmartBIService` (facade, optional via `@Autowired(required = false)`) — caching/quota wrapper; retained.

→ **Sunset deletes only the controller class + DTOs unique to the public demo (none — all DTOs are shared with authenticated controllers).**

---

## §3 Frontend usage map

### 3.1 Authenticated frontends (RN mobile, web-admin) — Tier 4 callers
- **`frontend/CretasFoodTrace/`** (RN mobile app): `grep /api/public/smart-bi` → **0 matches**.
- **`web-admin/src/`** (Vue admin): exactly **1 file** with the prefix:

| File | Line | Calls | Status |
|------|-----:|-------|--------|
| `web-admin/src/views/smart-bi/SharedView.vue` | 94 | `GET /api/public/smart-bi/share/${token}` | ⚠️ **Broken caller — endpoint does not exist in any current Java controller** |

`SharedView.vue` is wired in `web-admin/src/router/index.ts:36-38` (`/smart-bi/share/:token` → `SmartBISharedView`). The route exists in the SPA, but the API path it targets returns **404** today (verified in §4 live probe). This is a pre-existing broken-link issue and is **NOT** one of the 10 Tier 4 endpoints — sunset of the 10 endpoints does not affect SharedView.vue's broken state.

The other `share`-related caller is **out of Tier 4 scope**:
- `web-admin/src/views/smart-bi/analysis/ShareDialog.vue:86` calls `POST /api/mobile/{factoryId}/smart-bi/share` (authenticated, different controller — `SmartBIController` family or descendant). This is what the admin actually uses to create a share token. It is **not** a Tier 4 caller.

### 3.2 Showcase site (`platform/`, served from 139)
- `grep /api/public/smart-bi` → **0 matches**.
- `grep "smart-bi"` → 1 match in `platform/ralph-loop-guide/index.html` — the line is a `<td>` documentation text mentioning the web-admin SPA URL (`http://139.196.165.140:8086/#/smart-bi/dashboard`), **not** an API call.

→ Showcase site does **not** call any Tier 4 endpoint.

### 3.3 Security posture
`JwtAuthInterceptor.java:229` whitelists `/api/public/` prefix — no JWT required. Audit doc `agent-team-outputs/2026-03-05_smartbi-backend-deep-quality-audit.md:88` flagged this in March: "无需任何认证". Combined with empty F_DEMO data, the attack-surface concern is low **today** but rises as soon as someone populates `F_DEMO`.

---

## §4 Prod log evidence

### 4.1 Java app log (server 47)
| Source | Span | Hits |
|--------|------|------:|
| `cretas-prod.log` (current, 1.84 GB) | 2026-05-07 ~ 2026-05-09 (live) | **0** |
| `cretas-prod.log-{20260430,20260501,20260502,20260505,20260506,20260507,20260509}.gz` | 7 daily rotations | **0** |
| `cretas-prod.log.archived.20260428.gz` | 2026-04-28 archive | **0** |
| `cretas-prod-green.log*` (BG green slot) | 2026-04-29 ~ 2026-05-05 | **0** |

**Total**: 0 hits in **at least 12 days** of Java app log history. Earlier history not retained.

### 4.2 Nginx access logs (server 139, 5-month range Dec 27 2025 → May 9 2026)
| Log file | Hits |
|----------|------:|
| `api.cretaceousfuture.com.log` (API gateway) | **0** |
| `www.cretaceousfuture.com.log` (showcase site) | **0** |
| `cretaceousfuture.log` (other vhost) | **0** |
| `web-admin.log` (admin SPA static + reverse-proxy) | **8** |

### 4.3 Characterizing the 8 web-admin.log hits
All 8 hits are from a **single source IP** (`52.124.34.249`) on a **single day** (2026-02-28), all targeting **one share token**:

```
[28/Feb/2026:10:24:22] GET /api/mobile/api/public/smart-bi/share/e363efce... → 401  ← broken concat
[28/Feb/2026:10:43:34] GET /api/public/smart-bi/share/bb17a08...           → 200  (browser)
[28/Feb/2026:10:43:55] GET /api/public/smart-bi/share/bb17a08...           → 200  (curl/8.6.0)
[28/Feb/2026:10:46:56] GET /api/public/smart-bi/share/bb17a08...           → 200  (curl)
[28/Feb/2026:10:47:01] GET /api/public/smart-bi/share/bb17a08...           → 200  (browser)
[28/Feb/2026:10:47:02] GET /api/public/smart-bi/share/bb17a08.../data     → 200  (browser)
[28/Feb/2026:12:30:37] GET /api/public/smart-bi/share/bb17a08...           → 200  (browser)
[28/Feb/2026:12:30:37] GET /api/public/smart-bi/share/bb17a08.../data     → 200  (browser)
```

Mixed `Mozilla/Chrome` + `curl/8.6.0` user-agents and 4-character HTTP-status mix (401 from a broken double-prefix) is the signature of **manual QA testing**, not a customer demo session. The same single token is hit 6 times in 2 minutes — almost certainly someone debugging the share feature.

**Note**: those hits returned 200 in Feb but my live probe (§4.4) returns 404. The endpoint must have either been (a) served by a since-deleted controller (commit `a9d98f4f14` Feb 19 deleted "SmartBIController.java empty shell @Deprecated" — possibly contained `/share`), or (b) at a different path mapping and removed since. Either way, **today's state is 404**, and the 8 hits do not represent recurring customer traffic.

### 4.4 Live probe (2026-05-09 22:35 CST, server 47 localhost:10010)
| Path | Status | Response |
|------|-------:|----------|
| `GET /api/public/smart-bi/dashboard?period=month` | **200** | `{"code":200, "data":{"dashboard":{"kpiCards":[], "charts":{"department_trend":{...,"data":[],...}}, "aiInsights":[{"level":"YELLOW","message":"当前时间范围内暂无销售数据"}]...}}}` — endpoint works, F_DEMO is empty |
| `GET /api/public/smart-bi/share/dummy` | **404** | `{"code":404, "message":"请求的资源不存在", "success":false}` — confirms `/share/` is not a Tier 4 endpoint |

### 4.5 Conclusion
Across **5 months of nginx logs** + **12 days of Java app logs**:
- **0 hits** from any external IP / customer / showcase site.
- **8 hits** total, all attributable to one dev/QA testing session on one day.
- The Tier 4 controller is functionally **dark** — running, listening, but receiving no traffic.

---

## §5 Sunset feasibility

### 5.1 Replacement strategy (per PR #152 §4)
Static JSON snapshots in `platform/` (139 server, served by nginx as static files):

```
platform/showcase-data/
  ├── dashboard-month.json          # GET /api/public/smart-bi/dashboard?period=month
  ├── dashboard-week.json           # &period=week
  ├── dashboard-quarter.json        # &period=quarter
  ├── analysis-sales-overview.json  # /analysis/sales?dimension=overview
  ├── analysis-sales-trend.json     # &dimension=trend
  ├── ... (one snapshot per common query)
```

Snapshots can be recorded **once** from a populated factory (e.g. F001) with sensitive fields redacted, then served with `Cache-Control: max-age=86400`. No backend, no DB, no LLM cost. Showcase site would need a small JS shim to map the old API path to static URLs **only if the showcase ever starts using these endpoints** — currently it doesn't (per §3.2).

### 5.2 Frontend impact (FE work required for sunset)
**NONE for Tier 4 callers** — there are zero non-broken Tier 4 callers anywhere in the codebase.

The only mention in `web-admin` is `SharedView.vue` calling `/share/{token}`, which is a different (non-Tier-4, currently broken) endpoint. Sunsetting the 10 Tier 4 endpoints does not change SharedView.vue's broken state — that's a separate cleanup item (file ticket: either implement `/share/` endpoint properly OR delete SharedView.vue + the router entry; out of scope for this audit).

### 5.3 Backend deletion plan (sunset commit)
Single commit, ~390 LOC removed:
1. Delete `controller/SmartBIPublicDemoController.java` (386 LOC).
2. Delete unique imports / unused references (likely 0 — services are all shared with authenticated controllers).
3. No DB schema changes (controller has no `@Entity` / `@Repository`).
4. No `application.properties` / `nginx` config changes (path simply 404s after deletion, which matches current `/share/` behavior anyway).

### 5.4 Risk register
| Risk | Severity | Likelihood | Mitigation |
|------|---|---|---|
| R-1: Showcase site silently relies on these endpoints (false-negative grep) | HIGH | LOW | Re-grep `platform/` HTML/JS post-merge; double-check on 139 directly: `grep -r "/api/public/smart-bi" /www/wwwroot/showcase/`. Done in §3.2 (HEAD). Recommend re-confirming on the **deployed** 139 copy before sunset. |
| R-2: External integration / partner site we don't know about | LOW | LOW | 0 hits in `api.cretaceousfuture.com.log` (the only public-facing API access path) over 5 months. CORS allowlist names `cretaceousfuture.com` + `139:8086` + `localhost:5173` → only known origins. |
| R-3: Sales/marketing team has a deck/demo URL pointing to a hosted live demo | MED | LOW | Operator should ping sales/marketing to confirm before sunset. Not blocking — even if found, snapshot replacement is trivial. |
| R-4: F_DEMO factory becomes populated (someone uploads test data) and demo becomes functional, sunset would regress | LOW | LOW | F_DEMO is empty today (live probe). Sunset before populating is fine; if business decides to populate later, snapshot-replacement keeps the same UX. |
| R-5: Auth-bypass concern (the `/api/public/` prefix is JWT-whitelisted) actively exploitable today | MED | LOW | Sunset eliminates the attack surface entirely. **Sunset reduces risk vs. KEEP.** |
| R-6: Removing controller breaks Spring component scan / startup | NONE | NONE | `@RestController` is auto-scanned, removal is clean. No `@Bean` references elsewhere. |

### 5.5 Rollback
Trivial: `git revert <sunset-commit>` + redeploy via `deploy-backend.sh`. JAR restart ~80s. No DB rollback needed.

---

## §6 Recommendation

### **SUNSET** — confidence HIGH

**Operator decision needed for**: business sign-off (the only external-facing surface area being removed). Technical risk is near-zero.

### Rationale ranked
1. **Zero traffic**: 0 hits over 5 months + 12 rotated Java log days. The controller is dead.
2. **Empty data**: F_DEMO factory has no data; even if traffic existed, response would be empty `kpiCards: []` — no business value delivered.
3. **No callers**: 0 callers in mobile RN, 0 in showcase static site. Web-admin's only "caller" targets a different (broken, non-Tier-4) endpoint.
4. **Reduces attack surface**: The `/api/public/` prefix is JWT-whitelisted. Removing 10 unauthenticated endpoints reduces attack surface.
5. **Aligns with PR #152 + PR #150**: scoping spec already recommends sunset; T6.5 deprecation spec keeps PublicDemo for now but flags it as scope-out (different prefix). Sunset closes that footnote permanently.
6. **Trivial replacement**: 1-2 days of static snapshots covers any future demo-site use case at zero ongoing infra cost.

### Alternative considered: **DEFER**
If business wants to keep the option of activating live demo later (e.g. at a trade show), DEFER to Phase 2C+. Cost of DEFER:
- Continued LOC maintenance (~390 LOC + service dependencies kept "demo-grade" alive in T6.5 final cut)
- Continued attack-surface (unauthenticated `/api/public/` prefix exposed)
- Continued spec/audit overhead (every Phase 2B/3 pass re-evaluates Tier 4 KEEP/SUNSET)

→ **DEFER is strictly worse than SUNSET unless business explicitly intends to use the live demo within ~6 months.** Sunset + static snapshot is reversible if priorities change.

### Alternative considered: **PORT to Python**
PR #152 already eliminated this option (Tier 4 SUNSET recommend, not Tier 4 PORT). Porting would mean: ~2-3 weeks of port work + ~1 week of dryrun parity for **0 customer benefit** (data is empty). Not justified.

---

## §7 If SUNSET — implementation plan

### Phase 1 — Operator sign-off (gate)
- [ ] **Operator pings sales / marketing**: confirm no deck/demo URL relies on `/api/public/smart-bi/*`. If yes → request the URL list and decide static-replacement vs. KEEP.
- [ ] **Operator pings business stakeholder**: F_DEMO factory population intent. If "we'll populate Q3" → DEFER not SUNSET.
- [ ] If both green → proceed to Phase 2.

### Phase 2 — FE prep (parallel to Phase 1, optional pre-work)
- [ ] If showcase site `platform/` ever needs demo data → record snapshots from F001 (sensitive fields redacted), commit to `platform/showcase-data/*.json`. **Skip if showcase has no demo dashboard intent.**
- [ ] Filed separately: triage `web-admin/src/views/smart-bi/SharedView.vue` (broken `/share/{token}` caller). Not blocking sunset.

### Phase 3 — BE delete
- [ ] Single PR: delete `SmartBIPublicDemoController.java`.
- [ ] Verify no stray imports / unused beans (likely 0 cleanup).
- [ ] Verify Spring Boot starts clean (`mvn spring-boot:run` locally).
- [ ] Update `JwtAuthInterceptor.java:229` comment? Optional — the `/api/public/` whitelist pattern is shared with `AIPublicDemoController` (out of Tier 4 scope), so keep the line.

### Phase 4 — Deploy + verify
- [ ] `./scripts/deploy/deploy-backend.sh --env test` → smoke verify `/api/public/smart-bi/dashboard` returns 404.
- [ ] `./scripts/deploy/deploy-backend.sh --env prod` (Blue-Green per `feedback_pause_before_deploy_or_push.md` — pause before deploy, organizer GO).
- [ ] T+1h smoke: tail Java prod log for any error patterns referencing the deleted path.
- [ ] T+24h soak: re-grep nginx access logs to confirm 0 hits (no surprise integrations exist).

### Phase 5 — Documentation
- [ ] Update PR #152 scoping spec: change Tier 4 status from "SUNSET recommended" → "SUNSET shipped, snapshot at commit <SHA>".
- [ ] Update PR #150 T6.5 spec: remove the Tier 4 footnote (no longer scope-out, just gone).
- [ ] Memory update: add to `MEMORY.md` if any non-obvious learning emerges (e.g. unexpected showcase dependency).

### Estimated effort
| Phase | Effort | Owner |
|-------|--------|-------|
| 1 — Sign-off | 0.5d (mostly waiting on responses) | Operator |
| 2 — FE prep (if applied) | 0-2d | FE chat |
| 3 — BE delete | 0.5d | BE chat |
| 4 — Deploy + verify | 0.5d (T+24h gated) | BE chat |
| 5 — Doc updates | 0.5d | Organizer |
| **Total** | **~2-4 days wall-clock** (≤1 day FTE if no FE work) | |

### Out of scope for this sunset (file separately)
- `SharedView.vue` broken caller — needs router/view fix or implement the `/share/` endpoint properly. Tracking ticket recommended.
- `AIPublicDemoController.java` (`/api/public/ai-demo/*`) — different prefix, **not** Tier 4. May warrant its own audit but not part of this decision.

---

## Open questions for reviewer

1. **Q-1**: Is there a sales/marketing URL we don't know about that relies on `/api/public/smart-bi/*`? (Operator due diligence, blocks Phase 1.)
2. **Q-2**: Does the business intend to populate `F_DEMO` for a live demo within 6 months? If yes → DEFER instead of SUNSET.
3. **Q-3**: Should `SharedView.vue` cleanup be bundled with this PR or a separate ticket? (Recommend separate — different scope, different owner.)
4. **Q-4**: Should we audit `AIPublicDemoController` similarly? (Recommend yes, but as Phase 2C-Tier-5 follow-up.)

---

## References

- PR #152 (`8b88dbb9bd`) — Phase 2B port pipeline scoping (Tier 4 SUNSET recommend)
- PR #150 (`cf8cc48e8d`) — T6.5 Java SmartBI deprecation spec
- PR #178 (`bd8e8afa79`) — T6.5 Phase A deletion candidates audit
- PR #155 (`34d4d4d605`) — frontend impact verification (dict-eq gate empirical)
- Java source: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIPublicDemoController.java`
- Frontend caller (broken): `web-admin/src/views/smart-bi/SharedView.vue:94`
- Security config: `backend/java/cretas-api/src/main/java/com/cretas/aims/config/JwtAuthInterceptor.java:229`
- Audit doc v1 (Mar 2026): `tests/smartbi-vue-audit-report-v1.md` (B4/B5 entries — note: those entries reference `/share/{token}` as if implemented in this controller, but **source verification shows it never was**; v1 doc reflects intended-not-shipped scope)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
