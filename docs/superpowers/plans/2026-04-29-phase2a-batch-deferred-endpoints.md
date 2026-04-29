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

## §4 Original handoff candidates — needed work bigger than estimated

| Endpoint | Surveyed complexity |
|---|---|
| `GET /alerts` | 600+ LOC business logic in `RecommendationServiceImpl` (3 alert generators × ~200 LOC each + threshold config + per-salesperson loops). Empty-pass-through port would be a sham — would silently break for any factory with real data after T6 cutover. **Full port**: 1 generator at a time, 2-4 hours each, plus alert threshold config externalisation. |
| `GET /analysis/finance/budget-achievement` | Java is GET with query params (`year`, `metric`); Python `analysis.py:1513` already has a same-named POST route taking `BudgetAchievementByPeriodRequest`. NOT a thin proxy — the Python POST has its own business logic and request shape. Alias must do GET→POST bridging + reshape Python's response into Java's `ChartConfig` envelope. |
| `GET /analysis/finance/yoy-mom` | Same pattern as budget-achievement. |
| `GET /analysis/finance/category-comparison` | Same pattern as budget-achievement. |

Recommendation: pair each finance endpoint with a **Phase 2A** ADR
covering the bridge pattern (GET→POST adapter + response reshape) so all
3 share the same scaffolding. Treat alerts as a separate sub-project —
each generator deserves its own commit + contract test for "factory
with synthetic data" so empty/loaded branches are both covered.

**Estimate**: alerts ~1 week (3 generators + threshold config). Finance
endpoints ~1 day each (~3 days total) once the bridge pattern is
documented.

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

## Active batch (this Apr 29 chat) — for reference

1. `GET /query-templates` — list query templates from DB (success golden, real data)
2. `GET /smart-bi/datasource/list` — list datasources (success golden, real data)
3. `GET /smart-bi/analysis/procurement` — small dict shape (success golden)
4. `GET /smart-bi/analysis/region` — medium dict with heatmap/ranking (success golden)

Per the PoC pattern: 30-60 min wallclock each via subagent-driven-development.
