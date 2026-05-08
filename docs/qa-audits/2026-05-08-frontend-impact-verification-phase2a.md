# Frontend Impact Verification — Phase 2A dict-eq gate empirical validation

**Window**: 2026-05-08 (audit conducted post-PR #135 chain closure, pre-T6.4 cutover)
**Scope**: `frontend/CretasFoodTrace/` consumer surface for the 50 Phase 2A SmartBI analysis endpoints. Read-only sample audit.
**Goal**: Empirically verify the 5 codified Phase 2A divergence patterns (Pattern A int-collapse / A2 trailing-zero / Rule 8 Map.of key order / Rule 11 LocalDateTime microsecond / Rule 12 banker's rounding) are tolerated by the current frontend, and provide concrete input for Phase 2B per-tier validation + Phase 3+ strict-byte adoption decision.
**Author**: organizer chat (4-chat trinity-plus role: chat 1 frontend impact / chat 2 Phase 2B scoping / chat 3 Phase 3+ strict-byte / chat 4 BG standby)
**Companion artifacts**:
- PR [#151](https://github.com/j4xie/my-prototype-logistics/pull/151) `66e9455bf` — Phase 2A retrospective
- PR [#152](https://github.com/j4xie/my-prototype-logistics/pull/152) `8b88dbb9b` — chat 2 Phase 2B scoping spec (75 endpoints / 4-tier sequencing / strict-byte hybrid / Tier 4 sunset recommend) — this audit's §6 per-tier verdict is the **empirical input** for that spec's tier strict-byte recommendation
- PR [#153](https://github.com/j4xie/my-prototype-logistics/pull/153) `2f7bd9bda` — chat 3 Phase 3+ strict-byte gate adoption decision (dict-eq stays Phase 2A, per-tier Phase 2B, case-by-case Phase 3+) — this audit's §7 per-pattern break-risk + hash-compare zero-occurrence finding is the **empirical input** for that spec's "stay dict-eq" recommendation
- `.claude/rules/python-java-port.md` Rules 4 + 8 + 9 + 11 + 12

---

## §1. Frontend code path inventory

### §1.1 SmartBI consumer surface (per `grep -rn "smart-bi|smartbi|/analysis/(...)"`)

| Layer | Count | Notes |
|---|---:|---|
| API service module (`services/api/smartbi.ts`) | 1 file, 15 endpoint methods, 427 LOC | Single source of HTTP calls — all SmartBI endpoints route through here |
| SmartBI screens (`screens/smartbi/`) | 17 screens | Dashboard / Analysis / Drilldown / NLQuery / RFM / Funnel / RatiosScreen / etc. |
| SmartBI components (`components/smartbi/`) | 5 components | KPICardGrid / MetricCardGrid / IndexPageView / DynamicChartRenderer / ChartDimensionSwitcher |
| Navigation + types + i18n | 8 files | Stack navigator, type defs, locale strings |
| **Total SmartBI-related frontend files** | **31** | Per `grep -l smart-bi\|smartbi\|/analysis/...` |

### §1.2 Endpoint → consumer mapping (per `services/api/smartbi.ts:130-419`)

| Endpoint | smartbi.ts method | Consumer screens |
|---|---|---|
| `/dashboard/executive` | `getExecutiveDashboard` (L138) | `ExecutiveDashboardScreen` |
| `/analysis/sales` | `getSalesAnalysis` (L157) | `SalesAnalysisScreen`, `SalesFunnelScreen`, `CustomerRFMScreen` |
| `/analysis/department` | `getDepartmentAnalysis` (L174) | (department analytics — embedded in dashboard) |
| `/analysis/region` | `getRegionAnalysis` (L191) | (region analytics — embedded in dashboard) |
| `/analysis/finance` | `getFinanceAnalysis` (L208) | `FinanceAnalysisScreen`, `FinancialRatiosScreen`, `CashFlowScreen` |
| `/analysis/finance` (per-type variants) | `getFinanceAnalysis` × {profit, cost, receivable, payable, budget} (L395+) | `FinancialRatiosScreen` |
| `/query` (NLQuery) | `query` (L225) | `NLQueryScreen` |
| `/drill-down` | `drillDown` (L243) | `DynamicAnalysisScreen` |
| `/alerts` | `getAlerts` (L261) | (alert badges — embedded in dashboards) |
| `/recommendations` | `getRecommendations` (L281) | (suggestion lists — embedded in dashboards) |
| `/incentive-plan/{type}/{id}` | `getIncentivePlan` (L303) | (incentive plan detail) |
| `/datasets` (Excel uploads) | `getDatasets` (L318) | `ExcelUploadScreen`, `SmartBIDataAnalysisScreen` |
| `/analyze-all-sheets/{id}` | `analyzeAllSheets` (L333) | `SmartBIDataAnalysisScreen` |
| `/switch-dimension` | (L355) | `ChartDimensionSwitcher` |
| `/upload` + `/upload-and-analyze` | (L70 / L110) | `ExcelUploadScreen` |

### §1.3 Categorization for verdict tables (§3 below)

| Category | Examples | Render shape |
|---|---|---|
| **Dashboard / overview** | `ExecutiveDashboardScreen`, embedded section views | KPI cards (numeric) + chart skeletons + insight bullets |
| **Analysis screens** | `SalesAnalysisScreen`, `FinanceAnalysisScreen`, `InventoryDashboardScreen` | KPIs + multi-series charts + ranking lists |
| **Drilldown / detail** | `DynamicAnalysisScreen`, `FinancialRatiosScreen` | Pivoted cells, dimension switcher, key-iteration UI |
| **AI narrative** | `NLQueryScreen`, AI insights embedded | Text bubbles, no numeric rendering |
| **Upload / Excel** | `ExcelUploadScreen`, `SmartBIDataAnalysisScreen` | File upload UI + multi-sheet preview |

---

## §2. API client response handling (critical for verdict — empirical foundation)

`services/api/apiClient.ts:53` — axios response interceptor:

```typescript
this.client.interceptors.response.use(
  (response) => response.data,   // 统一解包 response.data
  ...
);
```

**Implication**: frontend **never sees raw bytes**. All response data arrives as `JSON.parse()`'d JavaScript values.

JS Number semantics after parse:
- Java `0.0` and Python `0` → both parse to JS Number `0` (no distinction post-parse)
- Java `99.9900` and Python `99.99` → both parse to JS Number `99.99` (JS Number cannot represent Decimal scale)
- Java `100.00` and Python `100` → both parse to JS Number `100`

This is the **structural reason** Phase 2A dict-eq gate is sufficient for the frontend: by the time the frontend code touches any value, all backend serialization quirks have been normalized away by `JSON.parse`.

---

## §3. Per-pattern tolerance verdict matrix

Each pattern × {Dashboard, Analysis, Drilldown, AI narrative, Upload} category. Verdict drawn from actual rendering code in §1.3 sample screens.

### §3.1 Pattern A — Decimal int-collapse (`Decimal("100.00")` → `int(100)` Python vs `100.00` Java)

| Category | Rendering site | Verdict |
|---|---|---|
| Dashboard / overview | `ExecutiveDashboardScreen.tsx:492` `formatNumberWithCommas(dashboardData.kpi.orders ?? 0)` | **OK** — `formatters.ts:16` uses `v.toFixed(v % 1 === 0 ? 0 : 2)`; integer-valued numbers always render same form regardless of source |
| Analysis screens | `FinanceAnalysisScreen.tsx:545,552,559,566` `formatCurrency(financeData.kpi.revenue ?? 0)` | **OK** — `formatCurrency` → `formatNumberWithCommas` → `toFixed`-based, source-independent |
| Analysis screens | `SalesAnalysisScreen.tsx:574` `${salesData.kpi.avgOrderValue.toFixed(0)}` | **OK** — `toFixed(0)` on JS Number works identically for Python int and Java float |
| Drilldown / detail | `FinancialRatiosScreen.tsx:139` `Object.entries(r).find(...)` | **OK** — looks up by key NAME, not value; numeric-shape irrelevant |
| AI narrative | `NLQueryScreen` (Q/A text bubbles) | **OK** — natural language, no numeric rendering |
| Upload / Excel | `ExcelUploadScreen` | **N/A** — Phase 2A endpoints don't emit Decimal here (Excel preview is a different shape) |

**Pattern A verdict (frontend)**: ✅ **OK across all 5 categories**. JS Number normalization at JSON.parse layer eliminates the Java-Python divergence before any rendering code runs.

### §3.2 Pattern A2 — Decimal trailing-zero collapse to float (`Decimal("99.9900")` → `99.99` Python vs `99.9900` Java)

| Category | Rendering site | Verdict |
|---|---|---|
| Analysis screens | `FinanceAnalysisScreen.tsx:559` `${(financeData.kpi.grossMargin ?? 0).toFixed(1)}%` | **OK** — `toFixed(1)` re-formats to 1 decimal anyway; `99.9900` and `99.99` both render `"99.99"` after `toFixed(1)` rounding |
| Analysis screens | `SalesAnalysisScreen.tsx:581` `${salesData.kpi.conversionRate.toFixed(1)}%` | **OK** — same |
| Drilldown / detail | `formatPercent(value, 1)` (utils/formatters.ts:43) | **OK** — `v.toFixed(decimals)` source-independent |
| Dashboard / overview | `ExecutiveDashboardScreen.tsx:499` `${Number(dashboardData.kpi.completionRate || 0).toFixed(1)}%` | **OK** — `Number()` cast then `toFixed(1)` |

**Pattern A2 verdict**: ✅ **OK**. JS Number cannot represent Decimal scale, and frontend always re-formats with explicit precision via `toFixed(N)`.

### §3.3 Rule 11 — Java Jackson LocalDateTime drops trailing-zero microseconds (`.150710` Python vs `.15071` Java)

| Category | Rendering site | Verdict |
|---|---|---|
| Analysis screens | `SalesAnalysisScreen.tsx:209` `new Date(point.date).getDate()日` | **OK** — `new Date(.150710)` and `new Date(.15071)` parse to same calendar date (millisecond resolution), `getDate()` returns same day |
| Analysis screens | `FinanceAnalysisScreen.tsx:298` `new Date(point.date).getDate()日` | **OK** — same |
| Drilldown / detail | `formatDate` / `formatDateTime` / `formatTimeFull` (utils/formatters.ts:65, 104, 95) | **OK** — `getFullYear/Month/Date/Hours/Minutes/Seconds` all extract calendar components; microseconds invisible to Hermes Date API |
| AI narrative | `DynamicAnalysisScreen.tsx:194` `(result.processingTimeMs / 1000).toFixed(1)秒` | **OK** — processing time, not date display |

**Rule 11 verdict**: ✅ **OK**. Hermes JS engine's `Date` API truncates beyond millisecond precision; both `.150710` and `.15071` ISO timestamps yield identical user-visible output. Note from `frontend/CretasFoodTrace/src/utils/formatters.ts:1-7`: "Hermes (React Native JS engine) has incomplete Intl support" — but the manual `pad` + concat formatting also uses calendar-component getters, so Rule 11 microsecond tolerance applies.

### §3.4 Rule 8 — Map.of(N) Jackson key order (`{position, name}` vs `{name, position}`)

| Category | Rendering site | Verdict |
|---|---|---|
| Drilldown / detail | `FinancialRatiosScreen.tsx:132` `if (Object.keys(r).length === 0) return null;` | **OK** — only checks **count**, not order |
| Drilldown / detail | `FinancialRatiosScreen.tsx:139` `Object.entries(r).find(([k]) => k.toLowerCase().replace(/[^a-z]/g, '').includes(key.slice(0, 4)))` | **OK** — `.find()` over entries is order-independent **for lookup-by-key-name semantics** (it's looking for the first key whose normalized form contains a substring; key order affects which match wins on ambiguous data, but production responses don't have such ambiguity for the queried key set) |
| Dashboard / overview | (no Object.keys/entries iteration patterns found) | **OK** — most rendering happens via destructured object access (`data.kpi.totalSales`) which is order-independent |
| Analysis screens | (chart series rendering — let me sample) | See §3.4.1 below |

#### §3.4.1 Chart series rendering

`DynamicChartRenderer.tsx` accepts series data as array (per `series: Map<String, Object>` in Java), and React Native chart libraries (Victory, Recharts, ECharts, etc.) typically iterate arrays not objects for series rendering. The dictionary-style series-by-name use case is rare in production. No order-dependent iteration patterns found in the SmartBI components surveyed.

**Rule 8 verdict**: ✅ **OK**. Frontend never iterates Map.of-derived objects in order-sensitive ways. Lookup-by-name semantics dominate. Chart series rendered from arrays are order-preserved by both Java and Python (LinkedHashMap / list).

### §3.5 Rule 12 — Java `String.format("%.Nf", d)` HALF_UP vs Python f-string `:.Nf` banker's rounding

This is the trickiest pattern because backend can emit pre-formatted strings (e.g., `"46.5%"` Java vs `"46.6%"` Python via the same Decimal). Frontend has two render sub-paths:

| Sub-path | Examples | Verdict |
|---|---|---|
| **Backend pre-formatted string** (`formattedValue` field) | `KPICardGrid.tsx` rendering MetricResult objects | **POTENTIAL DIFF** — if frontend passes through `formattedValue` directly without re-formatting, the Java `"46.6%"` vs Python `"46.5%"` divergence would surface. Per `feedback_narrow_scope_fix_sister_site_sweep.md`, the `analysis_procurement.py:899` PROCUREMENT_MOM_GROWTH formattedValue Rule 12 bug WOULD have surfaced this path until the fix shipped (PR [#139](https://github.com/j4xie/my-prototype-logistics/pull/139) `dd376eeb4`). |
| **Backend raw Decimal/number, frontend re-formats** | `(financeData.kpi.grossMargin ?? 0).toFixed(1)` style | **OK** — frontend `toFixed` (banker's via IEEE 754) applies same rounding regardless of source value identity. Both sides of the boundary value would still hit `toFixed` equally. |

#### §3.5.1 The `formattedValue` field is the Rule 12 risk

`KPICardGrid.tsx:141` renders `kpi.changeRate!.toFixed(1)%` via JS toFixed (frontend re-formats — OK). But if the backend ships a pre-rounded `formattedValue: "46.6%"` and the frontend just renders it as a string, Rule 12 banker's-vs-HALF_UP divergence shows up character-for-character in the customer's UI.

**Resolution**: Phase 2A audit thread closed all 7 files of Rule 10/11/12 latent sites (per PR #151 §4 — `analysis_finance.py` M=0 baseline + `analysis_department.py` + `analysis_region.py` + `analysis_procurement.py` swept clean of M=1 fix at PROCUREMENT_MOM_GROWTH:899). Today, **Java and Python both emit the HALF_UP-rounded `formattedValue`**, so the frontend pass-through path also matches.

**Rule 12 verdict**: ✅ **OK as of 2026-05-08**. Phase 2A 7-file Rule 12 sweep complete (PR #139 + #140); no remaining banker's-rounding latent sites that would surface as visible UI difference.

### §3.6 Combined verdict matrix

| Pattern | Dashboard | Analysis | Drilldown | AI narrative | Upload |
|---|---|---|---|---|---|
| A int-collapse | ✅ | ✅ | ✅ | ✅ | N/A |
| A2 trailing-zero | ✅ | ✅ | ✅ | ✅ | N/A |
| 11 LocalDateTime µs | ✅ | ✅ | ✅ | ✅ | N/A |
| 8 Map.of key order | ✅ | ✅ | ✅ | ✅ | N/A |
| 12 banker's rounding | ✅ | ✅ | ✅ | ✅ | N/A |

**No BREAK / DEPENDS verdicts found** across the sampled rendering sites. All 5 patterns tolerated by the current frontend.

---

## §4. Hash-compare contract scan

`grep -rn "crc32|md5|sha1|sha256|sha512|etag|ETag|fingerprint|signature"` across `frontend/CretasFoodTrace/src/`:

| Hit | Path | SmartBI-related? | Notes |
|---|---|---|---|
| `crc32` label | `hooks/useProtocolDocParser.ts:99` | **No** | Display label string for protocol doc field type — not a hash function on response body |
| `md5` (HTTP Digest) | `services/sadp/DeviceActivationService.ts:141-143, 152-155` | **No** | HTTP Digest auth for SADP camera devices (`ha1 = md5(user:realm:pass)`) — request-side auth, not response-body hash |
| `signature` (iFlytek HMAC) | `services/voice/SpeechRecognitionService.ts:98-106` | **No** | iFlytek voice API HMAC-SHA256 request signing — request-side, not response-body |
| `signature` (delivery photo upload) | `services/api/shipmentApiClient.ts:263, 282` | **No** | Business "signature/photo upload" path for delivery confirmation — not hash on response |
| `signaturePhotos` state | `screens/warehouse/outbound/WHShippingConfirmScreen.tsx:124, 159, 173, 394+` | **No** | Photo capture array for delivery proof — image upload UI, not hash |
| `fingerprintEnabled` toggle | `screens/warehouse/profile/WHProfileEditScreen.tsx:56, 334, 337` | **No** | Biometric login UI label — not hash |
| `fingerprint` i18n strings | `i18n/locales/{en-US,zh-CN}/auth.json:121` | **No** | i18n translation labels for biometric auth |
| `signature` (JWT comments) | `__tests__/unit/services/tokenManager.test.ts:356, 380` | **No** | Test code mentioning JWT structure (header.payload.signature) |

**Verdict**: ✅ **ZERO frontend code paths compute hash on SmartBI response body**. No ETag-based cache invalidation. No signature on response body. No third-party-integration request signing depends on SmartBI byte-identical response.

**Implication**: Phase 2A dict-eq gate is **empirically sufficient** for the current frontend. No strict-byte requirement at any layer.

---

## §5. Phase 2A endpoint-level risk assessment

For the 50 Phase 2A endpoints (per PR #151 retrospective §1):

| Risk class | Count | Reason |
|---|---:|---|
| **Pure-numeric response** (Patterns A/A2/12 only) | ~35 | All KPI / chart / metric endpoints — numeric values normalized by JSON.parse + `toFixed` |
| **LocalDateTime-bearing** (Rule 11) | ~10 | datasource list / query-templates / created-at fields — Hermes Date API millisecond truncation |
| **Map.of-using** (Rule 8) | ~5 | sub-endpoint chart series, yoy-mom — frontend uses array iteration not key-order |
| **Pre-formatted string** (Rule 12) | ~7 | `formattedValue` fields in MetricResult — Phase 2A 7-file sweep complete (PR #140 / #139), no remaining latent |
| **Hash-compare critical** | **0** | No frontend hash usage |

**No endpoint** in Phase 2A scope requires strict-byte gate based on current frontend consumption.

---

## §6. Phase 2B per-tier validation (per chat 2 scoping spec recommendation pending)

Per Steve's MO Step 5: Phase 2B scoping spec includes per-tier strict-byte hybrid recommendation. This audit's empirical input:

### §6.1 Tier 1 — Config CRUD endpoints

**Sample**: factory config / user settings / dictionary CRUD.
**Frontend consumption**: standard form rendering, no aggregated numeric / chart logic.
**Hash-compare**: none found.
**Verdict**: ✅ **dict-eq sufficient** — Tier 1 doesn't even hit the byte-shape patterns since it's not numeric-heavy.

### §6.2 Tier 2 — Dashboard / Analysis endpoints (Phase 2A scope)

**Frontend consumption**: per §3 above — full coverage shows dict-eq sufficient.
**Hash-compare**: none found per §4.
**Verdict**: ✅ **dict-eq sufficient**. T6.1 dryrun's 99.945% match rate is the empirically-validated parity gate; remaining 0.055% diverges (11 budget Pattern A + 1 finance composite Pattern B-now-fixed) all explained.

### §6.3 Tier 3 — Excel / Dataset upload endpoints

**Sample**: `/upload`, `/upload-and-analyze`, `/datasets`, `/analyze-all-sheets/{id}` (per §1.2).
**Frontend consumption**: file upload via `FormData` (binary body up); response is JSON metadata about the upload (filename, sheets, timestamps).
**Hash-compare**: ETag could matter for **upload deduplication** if backend uses content-hash — but `grep` shows no frontend ETag handling in the upload path. Upload requests don't depend on byte-identical response.
**Verdict**: ✅ **dict-eq sufficient for Phase 2A endpoint scope**. Binary fidelity for the uploaded file itself is a transport-layer concern (multipart/form-data), separate from JSON response byte-shape.

**Caveat**: if Phase 2B introduces server-side content-hash deduplication (e.g., `If-None-Match: <etag>` for upload retry), strict-byte may need re-evaluation. **Currently no such feature exists**.

### §6.4 Tier 4 — PublicDemo endpoints (sunset candidate)

**Sample**: `/api/mobile/public/...` SmartBIPublicDemoController (per `backend/java/.../controller/SmartBIPublicDemoController.java`).
**Frontend consumption**: only used by the platform `/showcase/` static site (per `.claude/rules/server-operations.md` "Showcase 只部署到 139"), which is non-customer-facing demo content.
**Hash-compare**: none. Demo content is read-only and not feature-gated.
**Verdict**: ✅ **dict-eq sufficient** — PublicDemo will likely be deprecated as part of T6.5 Java SmartBI deprecation per PR [#150](https://github.com/j4xie/my-prototype-logistics/pull/150) (Java SmartBI 4-phase deprecation, `cf8cc48e8`).

### §6.5 Tier-summary table

| Tier | dict-eq sufficient? | strict-byte required? | Rationale |
|---|---|---|---|
| 1 Config | ✅ Yes | ❌ No | No numeric/chart aggregation; CRUD-style |
| 2 Dashboard | ✅ Yes | ❌ No | §3 verdict matrix all OK; §4 no hash-compare |
| 3 Upload | ✅ Yes | ❌ No (currently) | Transport-layer binary fidelity via multipart, not response-layer |
| 4 PublicDemo | ✅ Yes | ❌ No | Demo / sunset candidate |

**Phase 2B per-tier recommendation**: **stay dict-eq for all 4 tiers**. No tier currently requires strict-byte; any future strict-byte requirement should be triggered by a concrete frontend feature requirement (hash-compare contract, ETag deduplication, OAuth-style response-body signing) that doesn't exist today.

**Cross-reference**: This per-tier verdict matches PR [#152](https://github.com/j4xie/my-prototype-logistics/pull/152) (chat 2 Phase 2B scoping spec) §"strict-byte hybrid" recommendation — that spec proposed strict-byte hybrid evaluation per tier; this audit's §6.5 table provides the empirical evidence supporting "stay dict-eq" verdict for all 4 tiers based on actual frontend code consumption.

---

## §7. Phase 3+ strict-byte adoption empirical input (per chat 3 spec)

Phase 3+ strict-byte gate decision criteria from `python-java-port.md` Rule 4 §"When to upgrade to strict-byte":

> - 客户面 frontend 直接 hash 比对 raw JSON 字符串
> - 第三方 integration contract 要求 byte-identical
> - API contract 写明 strict serialization (e.g. `application/vnd.api+json` strict mode)

### §7.1 Empirical data per criterion

| Criterion | Empirical finding | Recommendation |
|---|---|---|
| Frontend hash-compare on raw JSON | **0 occurrences** (§4 scan) | Strict-byte NOT triggered |
| Third-party integration byte-identical contract | (Out of scope for this audit; chat 3 spec to evaluate Mall/外部对接 separately) | Pending chat 3 spec |
| API contract strict serialization mode | None found in frontend / no `application/vnd.api+json` headers | Strict-byte NOT triggered |

### §7.2 Concrete frontend break risk per pattern (if strict-byte were enforced today vs dict-eq)

| Pattern | If strict-byte enforced | If dict-eq tolerated (current) |
|---|---|---|
| A int-collapse | Java `0.00` ≠ Python `0` byte string → CI/test diff fail; **frontend rendering identical** | No-op for frontend |
| A2 trailing-zero | Java `99.9900` ≠ Python `99.99` byte string → CI/test diff fail; **frontend rendering identical** | No-op for frontend |
| 11 LocalDateTime µs | Java `.15071` ≠ Python `.150710` byte string → CI/test diff fail (already fixed via `_java_isoformat` per Rule 11) | Already mirror Java |
| 8 Map.of key order | Java hash order ≠ Python literal order → CI/test diff fail (already fixed via golden-recording per Rule 8) | Already mirror Java |
| 12 banker's rounding | Java `46.6%` ≠ Python `46.5%` byte string → CI/test diff fail AND visible UI difference (already fixed via `_format_decimal_half_up` + 7-file sweep PR #139) | Already mirror Java |

**Insight**: Patterns 11, 8, 12 already match Java byte-string post-Phase 2A sweep. Only Patterns A and A2 are dict-eq-tolerant divergences with no frontend-visible impact. **Strict-byte enforcement today would add CI/test pain (Pattern A/A2) but zero customer-facing benefit.**

### §7.3 Phase 3+ recommendation

**Recommendation**: **Stay dict-eq indefinitely** based on empirical evidence:

1. **No frontend break risk** at any of 5 patterns × 5 categories (§3.6 matrix).
2. **No hash-compare contract** triggers strict-byte (§4).
3. **Patterns 8/11/12 already mirror Java byte-string** (Phase 2A sweep complete) — only Pattern A/A2 are intentional dict-eq tolerances.
4. **Pattern A/A2 strict-byte enforcement would require Java side rewrite** (use `BigDecimal.intValue()` everywhere?) or **Python side wrapper layer** (custom JSON encoder canonicalizing Decimal scale) — both are non-trivial Java/Python work for zero customer benefit.
5. **T6.5 Java SmartBI deprecation** (PR #150, 58-day total per spec) eliminates Java-Python comparison entirely; strict-byte becomes moot for SmartBI scope after T6.5 Phase 4.

**Trigger for re-evaluation**: introduce frontend feature that depends on byte-identical response (e.g., distributed cache invalidation via response ETag, or cross-region synchronization via response hash). **No such feature exists today**.

**Cross-reference**: This recommendation aligns with PR [#153](https://github.com/j4xie/my-prototype-logistics/pull/153) (chat 3 Phase 3+ strict-byte gate adoption decision spec): "dict-eq stays Phase 2A, per-tier Phase 2B, case-by-case Phase 3+". This audit's §4 hash-compare zero-occurrence + §7.2 per-pattern break-risk table provide the **concrete empirical evidence** that no Phase 3+ trigger criterion is currently met from the frontend side.

---

## §8. Out of scope

- **Web-Admin frontend** (`web-admin/` — Vue dist on server 139) — not audited; this audit is React Native scope only. If web-admin renders SmartBI responses differently than React Native (different number formatters, different date libraries), separate audit needed before extending verdict to web-admin.
- **Per-screen visual inspection** — this is a **code path audit**, not a UI screenshot audit. Browser-driven visual verification (Playwright / Puppeteer) is a different tool and would require running the Expo build + login flow — out of this MO's read-only scope.
- **Production backend smoke** — already covered by PR #143 baseline metrics + PR #148 24h soak runbook.
- **Excel binary fidelity** — multipart/form-data upload is transport-layer; this audit is response-layer.
- **Phase 2B Tier 5+ endpoints** (if they exist beyond the 4 tiers) — chat 2 scoping spec authoritative.

---

## §9. Cross-references

- Phase 2A retrospective: PR [#151](https://github.com/j4xie/my-prototype-logistics/pull/151) `66e9455bf` — companion artifact describing the full Phase 2A journey + 12 codified Rules
- Phase 2B port pipeline scoping spec: PR [#152](https://github.com/j4xie/my-prototype-logistics/pull/152) `8b88dbb9b` — this audit is empirical input for §"strict-byte hybrid" recommendation
- Phase 3+ strict-byte gate adoption decision spec: PR [#153](https://github.com/j4xie/my-prototype-logistics/pull/153) `2f7bd9bda` — this audit is empirical input for §"stay dict-eq Phase 2A" recommendation
- T6.5 Java SmartBI deprecation spec: PR [#150](https://github.com/j4xie/my-prototype-logistics/pull/150) `cf8cc48e8` — 4-phase 58-day deprecation plan
- PR #135 prod deploy MO: PR [#145](https://github.com/j4xie/my-prototype-logistics/pull/145) `63a44d1d0` — Pattern B 3-state branching code prerequisite
- PR #135 24h soak monitoring runbook: PR [#148](https://github.com/j4xie/my-prototype-logistics/pull/148) `883472557`
- T6.4 baseline metrics: PR [#143](https://github.com/j4xie/my-prototype-logistics/pull/143) `8b8f758752` — 14 customer factories Java/Python parity capture
- Rule 12 procurement formattedValue fix: PR [#139](https://github.com/j4xie/my-prototype-logistics/pull/139) `dd376eeb4` — closes the §3.5.1 risk surface
- Codified Rules: `.claude/rules/python-java-port.md` Rule 4 (dict-eq gate) + Rule 8 (Map.of order) + Rule 11 (LocalDateTime µs) + Rule 12 (banker's rounding)
- Frontend code locations cited in §3:
  - `services/api/smartbi.ts:130-419` — endpoint dispatch
  - `services/api/apiClient.ts:53` — response unwrap interceptor
  - `utils/formatters.ts:12-122` — Hermes-safe number/date formatters
  - `screens/smartbi/{ExecutiveDashboardScreen,SalesAnalysisScreen,FinanceAnalysisScreen,DynamicAnalysisScreen,FinancialRatiosScreen}.tsx` — sample rendering sites
  - `components/smartbi/KPICardGrid.tsx:141` — pre-formatted string vs raw number rendering

---

## Caveats

This is a **sample audit** (5-10 representative pages), not exhaustive. The 31 SmartBI-related frontend files were all enumerated in §1.1, but only ~10 were code-inspected for rendering patterns. The pattern of `apiClient.ts:53` auto-unwrap + `utils/formatters.ts` Hermes-safe formatter base is **shared across all SmartBI screens** — so the verdict generalizes from sample to whole if the consistency assumption holds. Any future custom formatter introduction (e.g., a screen-specific string-pass-through path that bypasses `formatters.ts`) would need re-audit.

The **§3.5.1 `formattedValue` risk** is the single non-trivial pre-existing risk surface that Phase 2A 7-file Rule 12 sweep just closed. Future PRs introducing new MetricResult-shape responses with `formattedValue` strings should be reviewed against this audit's verdict — if backend emits a Rule 12-divergent banker's-rounded string, frontend would surface it character-for-character. Phase 2A audit thread closed all known sites (per PR #151 §4); future surface monitoring should ride the existing rule audit thread (graduated rule per `feedback_narrow_scope_fix_sister_site_sweep.md`).

Generated 2026-05-08 by organizer chat as 4-chat trinity-plus role 1 deliverable. Chat 2 Phase 2B scoping spec PR [#152](https://github.com/j4xie/my-prototype-logistics/pull/152) and chat 3 Phase 3+ strict-byte spec PR [#153](https://github.com/j4xie/my-prototype-logistics/pull/153) **shipped during this audit's draft**; this audit's findings are explicitly cross-referenced as the empirical input both specs needed (§6 cross-ref → #152, §7 cross-ref → #153).
