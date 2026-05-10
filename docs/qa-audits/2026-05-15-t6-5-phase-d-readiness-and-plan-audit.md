# T6.5 Phase D Readiness Audit + Plan Draft

**Audit type**: Phase-readiness (Phase A discovery + Phase B execute + Phase C method-level sweep ✅; Phase D scope finalization)
**Author**: organizer (Sub-P, dispatched May 9 2026 evening)
**Date**: 2026-05-15 (placeholder — actual write 2026-05-09 fresh worktree off `origin/main` SHA `e0a4a5c370`)
**Spec**: `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md`
**Predecessor PRs**: #150 spec / #178 v3.1 audit / #179 cross-verify / #182 amend / #205 Phase B execute / #210 prod cutover record / #213 active E2E / #236-#248 Phase C Round 1 (Sub-A..Sub-G)
**Status**: DRAFT — STOP-and-ping organizer before push

---

## §0 TL;DR

**Phase A/B/C close status (origin/main `e0a4a5c370`, 2026-05-09 evening)**:

| Phase | Status | Evidence |
|---|---|---|
| Phase A — discovery | ✅ SHIPPED | PR #178 v3.1 (484 LOC audit) + PR #179 cross-verify |
| Phase B — execute | ✅ SHIPPED | PR #205 (23 endpoint stubs to 410 Gone) + PR #210 prod cutover + PR #213 active E2E 12/12 PASS |
| Phase C — method-level audit + delete | 🟡 IN FLIGHT, EXPECTED CLOSE 24-48h | Round 1 Sub-A..Sub-G merged. Round 2 (Sub-H/I/K/L) + Round 3 (Sub-M/N/Q/O) **all locally committed in 6 chats but UNPUSHED at Sub-P audit time** — organizer pinged all chats to push 2026-05-09 evening (per organizer GO confirmation). See §3.5 below for resolution. |
| Phase D — DB-level audit | 📋 SCOPE-IN-SPEC, EXECUTION NOT STARTED | Spec §2.4 + §D.1-§D.4 define scope; Sub-P (this doc) drafts the readiness gate + execution plan. **Cannot start until Phase C 100% close.** |

**Phase D start condition**: Phase C **fully** complete (Round 2 + Round 3 all shipped). Per organizer GO 2026-05-09 evening: Round 2/3 work is **locally committed across 6 chats but UNPUSHED** — same /clear-without-push pattern hit by all 6. Organizer pinged each chat to push; Sub-H/I/K/L/M/N/Q/O expected on `origin/main` within 24-48h. Phase D Day 0 = last Phase C prod deploy + 7-day prod soak.

**Phase D scope decision (this audit's recommendation)**: **Option C** (per §4 below) — Phase D = post-Phase-C 30-day soak + final close-out audit + rollback contingency expire. Spec §2.4's existing D.1-D.4 (schema audit, JPA write audit, cross-DB connection audit, ongoing quarterly cadence) are the right ongoing tasks; **Sub-P does not propose changes to Phase D scope itself**. The new contribution is the **readiness gate** + a concrete execution plan for the close-out phase.

**Reject** Options A (full Java SmartBI deletion), B (permanent 410 stubs), D (build profile isolation) — rationale §5.

---

## §1 Phase A — discovery (PR #178 v3.1)

| Item | Value | Source |
|---|---|---|
| Audit doc | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` | shipped |
| Cross-verify | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates-cross-verify.md` | PR #179 |
| Headline finding | 22/26 SmartBIAnalysisController endpoints SAFE_NGINX_ROUTED | spec §0 TL;DR |
| Adjacent finding | 1 SmartBIDashboardController endpoint (`/data-date-range`) shares Phase B fate | spec §3.1.b |
| NOT_SAFE_FALLTHROUGH defer | 4 endpoints (`/analysis/production`, `/analysis/quality`, `POST /query`, `POST /drill-down`) → T6.6 | spec §1.2 + audit §3.1.a |
| Service class shared status | 10/10 analysis service classes SHARED with KEEP'd controllers → method-level audit, NOT wholesale deletion | audit §3.2.a → spec §C.1.2 amendment |
| Gold layer | NOT orphaned (Sales/FinanceAnalysisServiceImpl call GoldDashboardBuilder; Dashboard composite alive) | audit §4.3 |
| Repo orphan | only `SmartBiQueryTemplateRepository` (+ companion entity) | audit §3.5 |

Phase A close gate: ✅ all 4 PRs merged, 484-LOC audit + cross-verify both reviewed.

---

## §2 Phase B — execute (PR #205 + #210 + #213)

| Item | Value |
|---|---|
| Stub count | 23 (22 SmartBIAnalysisController + 1 SmartBIDashboardController `/data-date-range`) |
| Stub return | 410 Gone, body `{success: false, code: SMARTBI_MIGRATED, message, since, newPath}` |
| F999 fate | Option A (unconditional 410, organizer decision 2026-05-09); F999 migration to Python tracked as T6.6 follow-up |
| Spring Bean preservation | Controller class + `@Autowired` service refs intact; service Beans alive |
| Prod cutover | PR #210 record — Java JAR redeployed, nginx routing unchanged (139 → Python `cretas_python` upstream), F999 waiver double-recorded |
| Active E2E verify | PR #213 — 12/12 Playwright scenarios PASS against prod 47.100.235.168:10010 (410 stubs) + 139 nginx (Python responses) |
| Replaces passive soak | Per HARD rule `feedback_active_e2e_replaces_passive_soak` — 0 customers means active probe required, NOT 24h soak |

Phase B close gate: ✅ all 3 PRs merged, prod stubs in place, E2E green.

---

## §3 Phase C — method-level audit + delete

### §3.1 Marching order (PR #227)

8 sub-batches across Rounds 1-3:

| Sub | Round | Target | Owner (per MO) |
|---|---|---|---|
| Sub-A | 1 | Delete 23 stubbed method declarations + orphan repo + dead deps cleanup | core / chat 1 |
| Sub-B | 1 | SalesAnalysisServiceImpl method-level audit + delete | chat 2 |
| Sub-C | 1 | DepartmentAnalysisServiceImpl | chat 3 |
| Sub-D | 1 | RegionAnalysisServiceImpl | chat 4 |
| Sub-E | 1 | FinanceAnalysisServiceImpl | chat 5 |
| Sub-F | 1 | ProductionAnalysisServiceImpl | chat 6 |
| Sub-G | 1 | QualityAnalysisServiceImpl | chat 7 |
| Sub-H | 2 | InventoryHealthAnalysisServiceImpl (planned) | chat 8 |
| Sub-I | 2 | ProcurementAnalysisServiceImpl (planned) | TBD |
| Sub-K | 2 | DynamicAnalysisServiceImpl (drill-down/query — partial, NOT_SAFE_FALLTHROUGH constraints) | TBD |
| Sub-L | 2 | RegionAnalysisServiceImpl 3 dead-chain follow-up (deferred from Sub-D per PR #245) | TBD |
| Sub-M | 3 | TBD per organizer | TBD |
| Sub-N | 3 | TBD | TBD |
| Sub-O | 3 | TBD | TBD |
| Sub-P | 3 | **THIS DOC** — Phase D readiness audit + plan draft | organizer |

### §3.2 Round 1 — SHIPPED on `origin/main`

Verified by `git log --oneline origin/main`:

| PR | Sub | Commit | Title |
|---|---|---|---|
| #236 | Sub-A | `c8d509b8d1` | delete 23 stubbed method declarations + orphan repo + dead deps cleanup |
| #243 | Sub-B | `b99debcd6b` | SalesAnalysisServiceImpl method-level audit + dead code delete |
| #244 | Sub-C | `3ad55b6f8f` | DepartmentAnalysisServiceImpl dead method delete |
| #245 | Sub-D | `55d4470e70` | RegionAnalysisServiceImpl 5 dead methods delete (3 dead-chain deferred to Sub-L) |
| #248 | Sub-E | `571a0b4ddf` | FinanceAnalysisServiceImpl 10 dead methods delete |
| #246 | Sub-F | `25b2a4b353` | ProductionAnalysisServiceImpl dead method delete |
| #242 | Sub-G | `c322ece399` | QualityAnalysisServiceImpl method-level audit + 3 dead method delete |

**7/7 Round 1 sub-batches shipped.**

### §3.3 Residual Java SmartBI surface area (post-Round-1)

Live counts at `origin/main` SHA `e0a4a5c370`:

| Surface | Count | Notes |
|---|---|---|
| `SmartBIAnalysisController.java` `@*Mapping` count | **4** | The 4 NOT_SAFE_FALLTHROUGH endpoints (production / quality / query / drill-down) — alive Java for all 75 factories, deferred to T6.6 |
| `SmartBIDashboardController.java` `@*Mapping` count | **10** | 11 originally; `getDataDateRange` body removed Sub-A. `/dashboard*` + `/dashboard/executive*` + `/generate-*` + `/analysis/dynamic*` stay alive |
| `service/smartbi/impl/*AnalysisServiceImpl.java` files | **9** | Sales / Department / Region / Finance / Production / Quality / InventoryHealth / Procurement / Dynamic (RecommendationServiceImpl is separate package) |
| `repository/smartbi/` `.java` files | **26** | 27 originally; `SmartBiQueryTemplateRepository` deleted Sub-A |
| `entity/smartbi/` `.java` files | **46** | 47 originally; `SmartBiQueryTemplate.java` deleted Sub-A |
| `@Modifying` JPA writers in repos | **substantial** (≥10 hits across 6 repos) | See §6 — these are Phase D audit candidates |

### §3.4 Sub-D dead-chain deferral (PR #245 → Sub-L)

PR #245 description records 3 dead-chain methods on RegionAnalysisServiceImpl that were not safe to delete in Sub-D because their callers' status was uncertain. Deferred to Sub-L (Round 2). **If Round 2 is cancelled, these 3 methods stay in the codebase as dead code until a future cleanup pass.** Phase D audit must include "still-dead-after-Round-1" sweep (§7.4).

### §3.5 Round 2 + Round 3 status — RESOLVED 2026-05-09 EVENING (organizer GO)

**Sub-P marching order assertion**: "Round 2 Sub-H/I/K/L — in flight / shipped" + "Round 3 Sub-M/N/Q/O — in flight / shipped".

**Sub-P initial verification** (`gh pr list --state open --limit 30` at audit time): only 1 open PR (#252 memory hygiene). 0 Round 2/3 PRs visible.

**Resolution per organizer GO 2026-05-09 evening**: Round 2/3 work is **locally committed in 6 chats but UNPUSHED**. All 6 chats hit the same /clear-without-push pattern. Organizer pinged each to push immediately. Sub-H/I/K/L/M/N/Q/O expected on `origin/main` within 24-48h of this audit.

**Phase D readiness gate (Sub-P HARD position, post-resolution)**: Phase C 100% close = all Round 2/3 sub-batches landed on `origin/main` + Phase C test env 7-day soak + prod Blue-Green deploy + prod 7-day soak. Until that gate clears, Phase D Day 0 has not started.

**Sub-D dead-chain (PR #245 deferred 3 methods)**: per organizer GO q2, chat 6 Option A confirmed — 4 deletions total (3 Region methods + 1 SmartBIServiceImpl method) all in Sub-L scope; `getReceivableAgingChart` KEPT per chat 6 v3 catch. Accepted (§9 q2 closed).

---

## §4 Phase D scope — option analysis

The Sub-P marching order presented 4 options:

| Option | Description | Cost | Risk | Strategic fit |
|---|---|---|---|---|
| A | Java SmartBI **completely deleted** (controller + service + entity, 0 alive code) | HIGH — would require T6.6 to ship first (the 4 NOT_SAFE_FALLTHROUGH endpoints + Dashboard composite still need Java) | HIGH — deletes alive code; breaks Dashboard `/dashboard/executive*` for 75 factories | ❌ Conflicts with spec §1.2 OUT-OF-SCOPE which is by design |
| B | Java SmartBI **retains 410 stub permanent** (just dead but compilable) | LOW (do nothing further) | LOW (status quo) | ❌ Phase C already removed the stub method bodies in Round 1 Sub-A — this option describes Phase B end state, not a new phase |
| C | Phase D = **post-cutover 30-day soak + final close-out audit + rollback contingency expire** | LOW-MEDIUM — execution of spec §D.1-§D.4 + close-out doc | LOW | ✅ Matches spec §2.4 + §3.1 rollback table; preserves option to revert during contingency window |
| D | Phase D = **Java SmartBI build profile isolated** (compile but exclude from prod jar) | MEDIUM — Maven profile + CI changes | MEDIUM (build pipeline complexity, marginal benefit since Phase C already removed bodies) | ❌ Solves a problem Phase C already solved — dead bodies removed, remaining code is alive |

### §4.1 Recommendation: Option C

**Phase D scope (recommendation, mirrors spec §2.4 + adds close-out)**:

1. **30-day rollback contingency window** post-Phase-C-prod-deploy (matches spec §3.1: "Phase C is irreversible after 30 days post-deploy"). During this window:
   - Daily journalctl `cretas-backend.service` startup log inspection (Sub-P delivers automation script in execution plan §7.1).
   - Weekly Blue-Green deploy rehearsal (verify `aims-0.0.1-SNAPSHOT.jar` rollback to pre-Phase-C JAR works in test env).
   - On-call escalation path for any 5xx spike on `/api/mobile/*/smart-bi/*` paths.

2. **Schema-level audit** (spec §D.1) — quarterly `pg_stat_user_tables` snapshot showing recent_writes by writer process. Expect: Python = canonical writer; Java = readers only (modulo §6 KEEP'd `@Modifying` writes from Upload/Config controllers).

3. **JPA write-path audit** (spec §D.2) — grep `@Modifying|@Query.*INSERT|UPDATE|DELETE` in `repository/smartbi/`. For each hit, classify:
   - WHITE — caller is KEEP'd controller (Upload/Config) writing legitimately.
   - GREY — caller is alive Java path but write semantics unclear; investigate.
   - BLACK — caller chain dead post-Phase-C; method becomes orphan candidate for next cleanup pass.

4. **Cross-DB connection audit** (spec §D.3) — grep `smartbi_prod_db|smartbi.postgres` in `backend/java/cretas-api/src/main/java/`, exclude `GoldFinanceClient` (HTTP-only). Expect 0 lines other than DataSource config beans.

5. **Ongoing quarterly cadence** (spec §D.4) — recurring audit, no terminal close-out.

6. **Close-out artifact** (NEW, Sub-P contribution): a single `docs/qa-audits/2026-XX-XX-t6-5-phase-d-closeout.md` written ~Day 35 post-Phase-C-prod-deploy summarizing audit results + decision to expire rollback contingency.

### §4.2 Why not Option A

Spec §1.2 explicitly KEEPs:
- 4 NOT_SAFE_FALLTHROUGH endpoints (alive code, T6.6 scope)
- All 10 analysis service class files (SHARED with Dashboard/PublicDemo/Upload)
- GoldDashboardBuilder + GoldFinanceClient (Python downstream consumers, NOT orphaned)
- 4 OUT-OF-SCOPE controllers (Config / Dashboard / Upload / PublicDemo)

Option A would require deleting all of the above, which conflicts with the alive customer-facing surface. T6.6 is the correct phase for the 4 NOT_SAFE_FALLTHROUGH ports; subsequent Phase 2B+ ports may eventually retire more, but that is **out of scope for T6.5/Phase D**.

### §4.3 Why not Option B

Phase C Round 1 Sub-A (`PR #236 c8d509b8d1`) already deleted the 23 stubbed method declarations. The 410 stubs no longer exist on `origin/main`. Option B describes Phase B end state, which is now historical.

### §4.4 Why not Option D

Phase C method-level deletes (Round 1) removed dead method bodies. Remaining Java SmartBI code is **alive code** serving Dashboard composite + 4 NOT_SAFE_FALLTHROUGH endpoints + Config / Upload / PublicDemo. Build profile isolation would either:
- Exclude alive code → break prod jar → 5xx storm
- Exclude only dead-by-test-classification → Phase C already does this via deletion → no benefit

---

## §5 Decision matrix per option

| Option | Cost | Risk | Revertable? | Strategic | Sub-P verdict |
|---|---|---|---|---|---|
| A — full delete | HIGH | HIGH | NO (irreversible jar surgery) | conflicts with KEEP scope | ❌ |
| B — permanent stub | LOW | LOW | YES | redundant (Phase C already past this) | ❌ |
| **C — soak + close-out** | **LOW-MED** | **LOW** | **YES (within 30-day window)** | **matches spec §2.4 + §3.1** | **✅ recommended** |
| D — build profile | MED | MED | YES (revert build config) | redundant (Phase C already removed bodies) | ❌ |

---

## §6 Java JPA writers in `repository/smartbi/` — Phase D §D.2 inventory preview

Sub-P pre-grep (informational; full Phase D audit will exhaust):

```
SmartBiDynamicDataRepository.java:66/73   — DELETE by uploadId / factoryId+uploadId
SmartBiPgAnalysisResultRepository.java:54/61 — DELETE by uploadId / factoryId+createdAt
SmartBiPgExcelUploadRepository.java:75/85/106 — UPDATE status / status+error / DELETE by factoryId+createdAt
SmartBiPgFieldDefinitionRepository.java:69 — DELETE by uploadId
SmartBiAnalysisCacheRepository.java:50/58 — @Modifying (queries not inspected)
SmartBiAnalysisConfigRepository.java:112/139 — @Modifying (queries not inspected)
... (more, see full grep)
```

**Provisional Phase D classification** (not authoritative until full audit):

- `SmartBiDynamicDataRepository` / `SmartBiPgAnalysisResultRepository` / `SmartBiPgExcelUploadRepository` / `SmartBiPgFieldDefinitionRepository` — likely WHITE (Excel upload pipeline owned by `SmartBIUploadController` per spec §1.2 OUT-OF-SCOPE row 5).
- `SmartBiAnalysisCacheRepository` / `SmartBiAnalysisConfigRepository` — caller chain unverified; GREY pending Phase D audit.

Phase D execution will produce a per-row WHITE/GREY/BLACK table in the close-out doc.

---

## §7 Phase D execution plan

### §7.1 Day 0 — Phase C prod deploy GO

- Phase C prod deploy completes (per spec §C.4: test env 7-day soak → prod Blue-Green deploy → 7-day prod soak).
- Sub-P close-out script `scripts/audits/t6-5-phase-d-daily-check.sh` (NEW, to be authored) runs daily via cron on server 47:
  - `journalctl -u cretas-backend --since '24h ago' | grep -i 'error\|failed\|exception' | tail -50`
  - `tail -10000 /www/wwwroot/cretas/cretas-prod.log | grep -E 'NoResourceFound|GONE|410' | wc -l` (expected: 0)
  - `curl -s http://localhost:10010/api/mobile/health` (expected: 200)
- Output appended to `docs/qa-audits/2026-XX-XX-t6-5-phase-d-soak-log.md`.

### §7.2 Day 7 — first weekly Blue-Green rehearsal

Test env exercise: deploy pre-Phase-C JAR on test 10011, smoke-test 5 representative factories, verify rollback works mechanically. Document outcome.

### §7.3 Day 14 — schema audit (spec §D.1)

Run `pg_stat_user_tables` query per spec §D.1 against `smartbi_prod_db`. Capture writer process names. Expected: only `cretas_python` (uvicorn) shows recent_writes for analysis tables; `cretas-backend` shows recent_writes only for upload/config tables (per §6).

### §7.4 Day 21 — JPA write-path audit (spec §D.2) + still-dead sweep

Full grep + per-call-site classification per §6. **Plus** a "still-dead-after-Round-1" sweep:

```bash
# For each remaining method on the 9 analysis service impl files,
# grep callers in the entire main-source tree.
# Methods with 0 callers post-Round-1 are residual dead code.
for impl in backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/*AnalysisServiceImpl.java; do
    grep -nE "^\s*public" "$impl" | while read -r line; do
        # extract method name, grep callers, count
        ...
    done
done
```

If this sweep finds significant dead code (≥10 methods), file a follow-up ticket: "Phase C Round 2/3 cleanup or accept-as-residual" — Phase D itself does not delete code (irreversibility window already expired by Day 21).

### §7.5 Day 28 — cross-DB connection audit (spec §D.3)

Grep per spec §D.3. Expected: 0 hits other than DataSource config beans + `GoldFinanceClient` (HTTP-only).

### §7.6 Day 35 — close-out doc + rollback contingency expire

`docs/qa-audits/2026-XX-XX-t6-5-phase-d-closeout.md`:

- §1 Audit results (spec §D.1, §D.2, §D.3 per-row classification)
- §2 Soak log summary (NRestarts, 5xx counts, customer reports)
- §3 Still-dead inventory (§7.4 outcome) — acceptance or follow-up ticket
- §4 Rollback contingency expiration declaration
- §5 Quarterly cadence kickoff (§D.4) — owner = organizer per spec §10.3

After close-out: T6.5 declared **complete**. Quarterly cadence continues per §D.4.

### §7.7 Phase D effort estimate

| Activity | Effort |
|---|---|
| Daily script authoring | 2-3h (one-shot) |
| Day 7 Blue-Green rehearsal | 1-2h |
| Day 14 schema audit | 1h |
| Day 21 JPA write-path audit + still-dead sweep | 4-6h |
| Day 28 cross-DB connection audit | 30min |
| Day 35 close-out doc | 3-4h |
| **Total Phase D execution** | **~12-16h spread over 35 days** |

---

## §8 Dependencies — Phase C must close before Phase D start

**Phase C close criteria** (Sub-P HARD position):

- Round 1 (Sub-A..Sub-G) ✅ shipped — 7/7 PRs merged.
- Round 2 (Sub-H/I/K/L) — **status undetermined, see §3.5.**
- Round 3 (Sub-M/N/O/P) — **status undetermined, see §3.5; Sub-P is 1 of 4.**
- Test env 7-day soak after final Phase C deploy.
- Prod Blue-Green deploy (per spec §C.4 + memory `reference_blue_green_java_deploy.md`).
- Prod 7-day soak (NRestarts unchanged, no 5xx spike).

**Until Round 2/3 ambiguity resolved** (§9 q1), Phase D **cannot start**. The 30-day rollback window (spec §3.1) starts only after the **last** Phase C prod deploy — if Round 2/3 ships later, the window resets.

**Recommended decision tree**:

```
Round 2/3 status?
  ├─ "in flight, will ship in N days"
  │   └─ Wait for ship → 7-day test soak → prod deploy → 7-day prod soak → Phase D Day 0
  ├─ "cancelled / scoped down — Round 1 sufficient"
  │   └─ Organizer writes scope-down doc → Phase D Day 0 = today + 30 days from PR #236 prod deploy
  └─ "undecided"
      └─ Block. Sub-P recommends organizer make decision before any further T6.5 work.
```

---

## §9 Open questions — ALL RESOLVED 2026-05-09 evening (organizer GO)

1. **Round 2/3 status?** ✅ RESOLVED — In flight, all locally committed but UNPUSHED (6 chats hit same /clear-without-push pattern). Organizer pinged all to push. Phase D start still gated on Phase C 100% close (last prod deploy + 7-day soak). See §3.5.

2. **Sub-D dead-chain → Sub-L** ✅ ACCEPTED — chat 6 Option A confirmed: 4 deletions (3 Region + 1 SmartBIServiceImpl), `getReceivableAgingChart` KEPT per chat 6 v3 catch. All 3 Sub-D-deferred methods in Sub-L scope.

3. **Phase D scope** ✅ **Option C confirmed** (post-Phase-C 30-day soak + close-out audit + rollback contingency expire). Options A / B / D rejected per §4.

4. **Sub-P scope = draft only** ✅ Confirmed — daily script (§7.1) + close-out doc (§7.6) deferred to a future Phase D execute MO. Sub-P PR is **plan + readiness gate only**.

5. **Close-out doc placement** ✅ `docs/qa-audits/` confirmed (`docs/superpowers/retrospectives/` does not exist as a directory; `qa-audits/` is the cretas standard for Phase A/B/C/D audit trail).

6. **T6.6 timing relative to Phase D** ✅ T6.6 Phase B starts **after Phase D Day 30 close-out audit** OR via HARD rule active-E2E-replaces-passive-soak shortcut (compress 30d → 1d if customer-facing E2E shows 0 regression sustained). Phase D Day 14 is **not** a T6.6 trigger.

---

## §10 Cross-references

| Doc | Purpose |
|---|---|
| `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` | T6.5 master spec (§2.4 + §D.1-§D.4 = Phase D scope source) |
| `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` | PR #178 Phase A v3.1 audit |
| `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates-cross-verify.md` | PR #179 Phase A independent cross-verify |
| `docs/qa-audits/2026-05-09-t6-5-phase-b-prod-deploy-cutover.md` | PR #210 prod cutover record |
| `docs/qa-audits/2026-05-09-t6-5-phase-b-active-e2e-prod-verify.md` | PR #213 active E2E 12/12 PASS |
| `docs/qa-audits/2026-05-10-t6-5-phase-c-sub-{b..g}-*-audit.md` | Round 1 Sub-B..Sub-G per-domain audits |
| Memory `feedback_active_e2e_replaces_passive_soak` | HARD rule — active probe replaces 24h soak when 0 customers |
| Memory `reference_blue_green_java_deploy` | Phase D Day 7 rehearsal reference |
| Memory `feedback_pause_before_deploy_or_push` | Sub-P STOP-and-ping before push (Step 2 of MO) |
| Memory `feedback_concurrent_edit_safety` Rule 5b | Phase D close-out doc commit must use paths-only mode |
| `.claude/rules/server-operations.md` smartbi migration HARD RULE | Phase D §D.1 schema audit must respect tracker |

---

## §11 Organizer GO + ship status

Per organizer GO 2026-05-09 evening: all 6 §9 questions resolved (see §9 above). Sub-P proceeds to commit + push + PR.

Branch: `ops-t6-5-phase-d-readiness-and-plan` (off `origin/main` SHA `e0a4a5c370`)
File: `docs/qa-audits/2026-05-15-t6-5-phase-d-readiness-and-plan-audit.md`

**Phase D scope locked (Option C)**: post-Phase-C 30-day soak + close-out audit + rollback contingency expire. Spec §2.4 + §D.1-§D.4 = the right ongoing scope; Sub-P contributes only the readiness gate + 35-day execution plan.

**Phase D Day 0 = last Phase C prod deploy + 7-day prod soak**. Phase C close depends on Round 2/3 (Sub-H/I/K/L + Sub-M/N/Q/O) push from 6 chats — organizer pinged 2026-05-09 evening, expected on `origin/main` within 24-48h.

**Sub-P scope ends here** (plan + readiness gate). Daily check script (§7.1) and close-out doc (§7.6) deferred to future Phase D execute MO.

---

**End of T6.5 Phase D Readiness Audit + Plan Draft (Sub-P)**
