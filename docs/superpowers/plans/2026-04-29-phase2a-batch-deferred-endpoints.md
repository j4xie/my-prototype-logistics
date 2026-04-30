# Phase 2A — Deferred Endpoints (post-Apr 29 batch chat)

> **Created**: 2026-04-29 during the second Phase 2A batch chat after the
> active batch was re-scoped from the original handoff candidates.
> **Status**: roadmap doc, not a plan to execute now. Each section
> identifies the unblocking work + the "ready" trigger.

---

## Context

The Apr 29 batch chat planned to port 4 endpoints from the original
handoff candidates (alerts / budget-achievement / yoy-mom /
category-comparison). Investigation revealed each is far more complex
than the T0 size estimate, so the active batch was re-scoped to 4 truly
simple Z-class GETs. The work below is **scheduled for future chats**,
grouped by the prerequisite that unblocks each.

The phase 2A goal is unchanged: byte-shape Python aliases for **all** 50
SmartBI endpoints before T6 nginx cutover. Nothing here is dropped.

---

## §1 Java enum bug — fix Java first, then re-record golden

| Endpoint | Recorded message |
|---|---|
| `GET /uploads` | `Get upload history failed: No enum constant [内部错误]` |
| `GET /uploads-missing-fields` | `Diagnose failed: No enum constant [内部错误]` |

Java is throwing a `Enum.valueOf` failure on what looks like a Chinese
status string (`内部错误` = "internal error"). Likely a defensive enum
parse mishandling free-text input in the DB. **Fix path**: locate the
`Enum.valueOf(...)` call site in the Java upload service, switch to
`safeValueOf` or `EnumUtils.getEnum`, cover with a unit test. Then
re-record the goldens with the recorder + the now-shipped 5-key envelope
(I-6) and port the Python alias.

**Estimate**: 1-2 hours Java fix + re-record + 30 min Python alias each.

---

## §2 Need real test data — re-record after fixture seeded

| Endpoint | Reason |
|---|---|
| `POST /generate-adaptive-charts` | Java says "Upload not found: 1" |
| `POST /generate-chart` | Same |
| `POST /retry-sheet/{uploadId}` | "未找到上传记录: 1" |
| `POST /upload/confirm` | "参数体不能为空" — recorder sent an empty body |

These need a real `smart_bi_pg_excel_uploads` row in the test DB before
recording. The recorder script uses `uploadId: '1'` as a placeholder
(`record-java-golden.mjs:298,418,431,438,471,485`). Two paths:

1. **Seed step**: add a pre-record bootstrap that uploads a small Excel
   to F001 via the multipart endpoint, captures the returned uploadId,
   threads it through these 4 endpoints' definitions. Cleanup afterward.
2. **Per-endpoint upload fixture**: each contract test that exercises
   one of these endpoints monkey-patches the upload-loader seam to
   return a fixed in-memory record.

(2) is cheaper for unit-style contract tests. (1) is needed for true
e2e validation against a live Java backend.

**Estimate**: 2-3 hours seed scaffolding + 30-60 min Python alias each.

---

## §3 Multipart / SSE / write-op endpoints — separate test strategy

| Endpoint | Why skipped at golden record time |
|---|---|
| `POST /upload` (excel) | Multipart file upload — recorder sends JSON, no file |
| `POST /upload-and-analyze` | Multipart |
| `POST /sheets` | Multipart Apache POI |
| `POST /upload-batch` | Multipart batch |
| `POST /upload-batch-stream` | SSE streaming |
| `POST /datasource/upload` | Multipart schema-detection |
| `POST /backfill/fields/{uploadId}` | Write op skipped to avoid mutating fixtures |
| `POST /backfill/batch` | Write op |
| `POST /datasource/apply` | DDL write op |
| `POST /query-templates` | Creates persistent test data |
| `PUT /query-templates/{id}` | Mutates test data |
| `DELETE /query-templates/{id}` | Destructive |
| `GET /dashboard/executive/insights/custom/stream` | SSE |

Two clusters:

- **Multipart + SSE** need their own recorder mode that supports file
  payloads + streaming responses. The current recorder is JSON-request /
  JSON-response only.
- **Write-ops** need transactional fixture isolation: record golden
  inside a transaction that is rolled back, OR use a dedicated write-op
  test factory whose state can be reset between runs.

These deserve a dedicated planning chat. Don't try to fold them into the
read-path batch.

**Estimate**: 1-2 day infrastructure + 30 min Python alias each.

---

## §4 SmartBIAnalysisController GET endpoints — most are 1000+ LOC business services, NOT thin Z

T0 classified many `/analysis/*` endpoints as Z (thin) because the controller method body is short. The **service** behind each, however, is large:

| Endpoint | Surveyed complexity |
|---|---|
| `GET /alerts` | 600+ LOC business logic in `RecommendationServiceImpl` (3 alert generators × ~200 LOC each + threshold config + per-salesperson loops). Empty-pass-through port would be a sham — would silently break for any factory with real data after T6 cutover. **Full port**: 1 generator at a time, 2-4 hours each, plus alert threshold config externalisation. |
| `GET /recommendations` | Backed by `RecommendationServiceImpl` (998 LOC total). Golden has 1 entry × 13 fields but the generator chain is large. Same class as alerts. |
| `GET /analysis/procurement` | Backed by `ProcurementAnalysisServiceImpl` (1144 LOC). Default branch returns `DashboardResponse` with kpiCards / rankings / charts / aiInsights / suggestions etc. The `analysisType=cost\|supplier\|trend` query param branches into different sub-service calls — each is its own non-trivial port. |
| `GET /analysis/region` | Backed by `RegionAnalysisServiceImpl` (1209 LOC). Same shape pattern as procurement (heatmap / targetCompletion / opportunityScores / ranking). |
| `GET /analysis/department` `/analysis/sales` `/analysis/finance` `/analysis/production` `/analysis/quality` `/analysis/inventory` | Same class — each has a 1000+ LOC service generating `DashboardResponse`. |
| `GET /analysis/finance/budget-achievement` | Java is GET with query params (`year`, `metric`); Python `analysis.py:1513` already has a same-named POST route taking `BudgetAchievementByPeriodRequest`. NOT a thin proxy — the Python POST has its own business logic and request shape. Alias must do GET→POST bridging + reshape Python's response into Java's `ChartConfig` envelope. |
| `GET /analysis/finance/yoy-mom` | Same pattern as budget-achievement. |
| `GET /analysis/finance/category-comparison` | Same pattern as budget-achievement. |

**Scope reality** (discovered Apr 29 batch chat): of the 50 Phase 2A endpoints, only **2** turned out to be true "thin DB-list Z" suitable for the dashboard-py PoC pattern: `GET /query-templates` and `GET /smart-bi/datasource/list`. Both were ported in this batch. Every other read-path GET in `SmartBIAnalysisController` is backed by a service ≥ 600 LOC.

This means the original Phase 2A 256h estimate is likely **off by 2-3×** for the analysis subdomain. The "thin Z" assumption that made the time estimate small for many endpoints does not hold once the service implementation is read.

Recommendation: pair each finance endpoint with a **Phase 2A** ADR
covering the bridge pattern (GET→POST adapter + response reshape) so all
3 share the same scaffolding. Treat alerts as a separate sub-project —
each generator deserves its own commit + contract test for "factory
with synthetic data" so empty/loaded branches are both covered.

**Estimate**: alerts ~1 week (3 generators + threshold config). Finance
endpoints ~1 day each (~3 days total) once the bridge pattern is
documented.

### Calibration data (2026-04-29/30 — `/alerts` marathon close-out)

Actual time spent on the `/alerts` full port marathon, breakdown by phase:

| Phase | Scope | Wall-clock | Commits |
|---|---|---|---|
| Kickoff (prior chat) | brainstorm + spec + plan + handoff | ~1.5 h | 3 (`38f4c1ccf`/`41f41fe2e`/`8451d6407`) |
| Phase A foundation | F999 migration + Java sort fix + threshold bundle + Python loader + date_range + CI parity guard + test env deploy | ~1.5 h | 5 (`90208d24c`/`6ca93ff51`/`fb1fcafb2`/`40e079d65`/`517f4692a`) |
| Phase B sales | sales generator + route + contract test + 56 calibration goldens + ADR | ~1 h | 4 (`4a86d05f6`/`58af128e0`/`f84101d53`/`9c733c05e`) |
| Phase C+D+E (chat 3) | trip-rows migration + 15-key Alert dict fix + finance + dept + aggregator generators + 4-way route + 3 contract tests + golden re-record | ~1.5 h | 6 (`b169fb0f0`/`e6fcc1839`/`8aa9e953b`/`788d83e08`/`e01c2f4c7` + this writeback) |
| **Total** | full port | **~5.5 hours** | **18 commits** |

**T0 estimate**: 1 week (~40 hours). **Actual**: ~5.5 hours.
**Calibration factor**: 40 / 5.5 ≈ **7.3× faster than estimate**.

#### Why was T0 off

T0 estimated `/alerts` based on the worst-case "1 generator at a time, 2-4 hours each + threshold externalisation". Reality:
- **F999 fixture pattern unlocked 56 endpoints in one recorder run** — 1 hour of recorder time produces calibration data for the entire analysis subdomain
- **Plan provided full code snippets** (per `superpowers:writing-plans`) — implementation became mechanical, no design decisions per generator
- **Subagent-driven for B1 + inline for C1/D1/E1** — both modes effective; inline faster for spec'd-out tasks

#### Refined estimates for analysis subdomain (post-calibration)

Apply the **7.3× calibration factor** with subdomain-specific adjustments:

| Endpoint | T0 (1-week scaling) | Refined estimate | Notes |
|---|---|---|---|
| `/recommendations` | 1 week | **~6 hours** | Same `RecommendationServiceImpl` as alerts; reuses F999 + threshold bundle + Decimal helpers |
| `/analysis/procurement` (1144 LOC) | 1 week | **~8 hours** | Larger service, but DashboardResponse pattern reusable from §4 sister endpoints |
| `/analysis/region` (1209 LOC) | 1 week | **~8 hours** | Same DashboardResponse pattern |
| `/analysis/{department,sales,finance,production,quality,inventory}` | 6 weeks | **~30-40 hours** | 6 endpoints × ~5-7 h each (DashboardResponse port + heatmap/ranking shape) |
| `/analysis/finance/{budget-achievement,yoy-mom,category-comparison}` | 3 days | **~12 hours** | 3 endpoints × ~4 h each (GET→POST bridge pattern; needs ADR) |

**Total refined Phase 2A analysis subdomain**: ~60-70 hours (vs T0 ~10 weeks = 400 hours). **6× faster than T0 estimate.**

#### F999 fixture as calibration multiplier

The F999 synthetic test factory is the highest-leverage artifact of this marathon:
- 1 migration + 56 recorded goldens = **calibration data for ~56 endpoints** with no per-endpoint recording cost
- Each future endpoint just monkey-patches its seam(s) + strips volatile fields + deep-equal compares to existing golden
- Re-record only when underlying Java logic changes (not when adding new endpoints)

Without F999, each endpoint would need its own recording session + golden curation. Estimated savings: **~30 hours across remaining 9 analysis subdomain endpoints**.

#### Spring placeholder substitution gotcha (logged for future)

A real Spring property issue surfaced: `${VAR:DEFAULT}` substitution stored the literal `DISABLED` fallback instead of the `$2b$12$...` bcrypt env var value. Workaround: post-deploy manual UPDATE password_hash. See `docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md` Negative consequences. Future endpoints using same env-var-injection pattern should expect this workaround.

---

## §5 Suggested execution order (later chats)

1. **Java enum bug fix** (§1) — unblocks 2 endpoints fastest.
2. **Test data seed** (§2) — unblocks 4 endpoints with shared scaffolding.
3. **Finance bridge ADR + 3 endpoints** (§4 finance) — bridge pattern
   reusable for the rest of phase 2A's POST-vs-GET divergent endpoints.
4. **Alerts full port** (§4 alerts) — biggest single chunk; needs
   threshold config story before LOC count makes sense.
5. **Multipart / SSE / write-ops infrastructure** (§3) — last because
   it's the largest scaffolding cost and the affected endpoints are
   write-path (lower production risk if Java keeps serving them).

---

## Active batch (this Apr 29 chat) — actual outcome

1. `GET /query-templates` — **SHIPPED** (commits `29e0ee773` impl + `455f27501` test rigor + `a339b4de6` typing fix)
2. `GET /smart-bi/datasource/list` — **SHIPPED** (commit `86aff34ef`)
3. ~~`GET /smart-bi/analysis/procurement`~~ — **defer** (1144 LOC service; see §4)
4. ~~`GET /smart-bi/analysis/region`~~ — **defer** (1209 LOC service; see §4)

Per the PoC pattern: ~60-90 min wallclock per shipped endpoint via subagent-driven-development (impl + spec review + ≥1 fix loop + code review + ≥1 fix loop). Endpoint 1 had 6 subagent calls (impl + spec review → spec fix → spec re-review → code review → code-review fix). Endpoint 2 had 3 subagent calls (impl → spec review → code review, both reviews approved without fix loops because the implementer carried over endpoint 1's lessons).
