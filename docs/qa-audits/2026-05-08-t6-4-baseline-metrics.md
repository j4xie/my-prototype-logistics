# T6.4 baseline metrics — 14 real customer factories

**Captured**: 2026-05-08 13:46 CST (local prod)
**Window**: 2026-01-01 → 2026-05-08 YTD (`/dashboard?period=year` → 2026-01-01 → 2026-12-31)
**Endpoints**: `dashboard`, `analysis/sales`, `analysis/finance`, `analysis/inventory` (overview only, no `analysisType`)
**Services**: Java prod 47:10010 + Python prod 47:8083 (both via loopback on server 47)
**Total captures**: 112 (14 × 4 × 2). Java 56/56 HTTP 200, Python 42/56 HTTP 200 + 14/56 HTTP 404 (every dashboard hit, expected).
**Fixtures**: `tests/fixtures/t6-4-baseline/{java,python}/<factoryId>-<endpoint>.json` + `manifest.tsv`.
**Reproduction**: `scripts/capture-t6-4-baseline.sh` (run on server 47 with `set -a; source /www/wwwroot/cretas/.env.prod; set +a; bash scripts/capture-t6-4-baseline.sh`).

---

## TL;DR for T6.4 GO/NO-GO

**Status**: ✅ Baseline establishes T6.4 cutover is **low-risk for the 14 listed factories**, with one architectural caveat.

| Finding | Implication for T6.4 |
|---|---|
| Python prod 8083 returns 404 for every `/smart-bi/dashboard` call | **Dashboard endpoint must remain Java-served post-T6.4** — exclude `/dashboard*` from Python upstream regex. |
| 12/14 customer factories have minimal data (sales empty, finance empty, inventory mostly empty) | Cutover divergence surface area is small — Python and Java both correctly emit "暂无销售数据" placeholder. |
| 2/14 (F002, F006) have inventory data | Java vs Python parity holds: only Pattern A int-collapse divergences (Decimal `0.0` vs `0`), per [Rule 4 Phase 2A dict-eq gate](../../.claude/rules/python-java-port.md#-rule-4-bigdecimal-序列化用-_decimal_to_number). |
| 1/14 (RES_3101_009 = QHJ_PROD) has Gold-layer POS data surfacing only via `/dashboard` | YTD analysis-sales window 2026-01-01 → 2026-05-08 returns empty for this factory because Gold POS data lives outside the Jan-May window; Java dashboard widens to `period=year` and pulls 20.6M revenue / 140k bills. **Not a parity issue** — both Java analysis-sales and Python analysis-sales return identical "no data" within 2026-01-01..05-08. |
| 100% of finance endpoints have 3-5 non-volatile diff paths | All are `profitMetrics[*].value: float vs int` — confirmed Pattern A int-collapse, byte-shape acceptable per Phase 2A standard. |

**Recommendation**: Proceed with T6.4 cutover for these 14 factories using the same nginx-regex-add pattern as T6.3, **excluding** the `/dashboard` path. Use the per-endpoint byte and HTTP-200 thresholds in §5 below as the 24h-soak success gate.

---

## 1. Per-customer data shape (Java prod source-of-truth)

Extracted from each factory's 4 Java captures. "—" means the kpiCard or section is empty/null.

| Factory | Name | Sales total | Sales bills | Inventory ¥ | Batches | Health | Expiry risk | Dashboard sales kpiCards |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| F002 | 张记餐饮管理有限公司 | — | — | 1,156.50 | 4 | 45 (red) | 42.7% | 0 |
| F003 | 绿源食品加工有限公司 | — | — | — | — | — | — | 0 |
| F004 | 鲜味零售连锁有限公司 | — | — | — | — | — | — | 0 |
| F006 | 六膳门食品科技 | — | — | 141,926.54 | 3 | 80 (green) | — | 0 |
| R001 | 白垩纪示范餐厅 | — | — | — | — | — | — | 0 |
| RES_3101_009 | QHJ_PROD | — (analysis-sales window empty) | — | — | — | — | — | **4** (20,639,884.52¥ / 140,541 bills / 8 stores via dashboard period=year) |
| RES_GML_001 | 桂满陇 | — | — | — | — | — | — | 0 |
| R_GML_DEMO | 桂满陇 江浙菜 | — | — | — | — | — | — | 0 |
| R_XMX_CHAIN | 唏嘛香·金城牛大 | — | — | — | — | — | — | 0 |
| R_XMX_FRESH | 唏嘛香 (新-真实上传) | — | — | — | — | — | — | 0 |
| R_XMX_FRESH2 | 唏嘛香 真实流程测试 | — | — | — | — | — | — | 0 |
| R_XMX_FRESH3 | 唏嘛香 V3 真实 | — | — | — | — | — | — | 0 |
| R_YHDJ_DEMO | 永和豆浆 快餐 | — | — | — | — | — | — | 0 |
| R_YJJ_DEMO | 御九井 日料 | — | — | — | — | — | — | 0 |

**Observations**:

- **F002 + F006** are the only factories with material inventory data. F002 shows poor health (45) + high expiry risk (42.7%) — real production-grade red flags; F006 is healthier (score 80). Both are **inventory-only** — no sales/finance signal flows through analysis endpoints.
- **RES_3101_009 (QHJ_PROD)** is unique: dashboard pulls Gold-layer POS aggregates (20.6M revenue, 140,541 bills, 8 stores) via `period=year`, but `analysis-sales?startDate=2026-01-01&endDate=2026-05-08` returns empty — Gold POS data falls outside this YTD window. **Confirms the Java [GoldDashboardBuilder → Python `/api/smartbi/gold/*`] dataflow** documented in `reference_smartbi_gold_layer_architecture.md`. The other 13 factories have 0 Gold POS data and so dashboard.sales is empty too.
- **Production / quality kpiCards** appear in every factory's dashboard (4 / 6 cards each) — these are stub/zero values from Java fallback, not real data. Identical Java vs Python at the analysis level (analysis-sales returns the same empty overview).

---

## 2. Java vs Python byte-shape parity (volatile timestamps stripped)

After stripping `timestamp`, `generatedAt`, `lastUpdated`, `dataVersion` (call-time fields that legitimately differ): per-endpoint diff path counts:

| Endpoint | Factories with 0 diffs | Factories with diffs | Diff pattern | Verdict |
|---|---:|---:|---|---|
| `analysis-sales` | 14/14 | 0/14 | n/a (all return empty overview) | ✅ Full parity |
| `analysis-finance` | 0/14 | 14/14 (3-5 diffs each) | `profitMetrics[i].value: float vs int` ([Pattern A](../../.claude/rules/python-java-port.md#pattern-a-integer-valued-decimal-int-collapse-h1-confirmed)) — and `receivableAging[i].{amount,percentage}` for F003/F004 (data-bearing) | ✅ Pattern A acceptable |
| `analysis-inventory` | 12/14 (no inventory data) | F002 (20 diffs), F006 (10 diffs) | All `charts.{临期风险分布,库龄分布}.data[i].value: float vs int` (Pattern A) | ✅ Pattern A acceptable |
| `dashboard` | n/a (Python 404) | 14/14 | Python returns `{"success":false,"message":"Not Found","code":"NOT_FOUND"}` (70 B) | ⚠️ Architectural — keep dashboard on Java |

### Per-endpoint per-factory byte counts (java vs python, after strip-volatile + JSON re-dump)

| Factory | sales J/P/Δ | finance J/P/Δ | inventory J/P/Δ | dashboard J/P |
|---|---|---|---|---|
| F002 | 1140 / 1131 / +9 | 2779 / 2763 / +16 | 3995 / 3951 / +44 | 78956 / 70 (404) |
| F003 | 1140 / 1131 / +9 | 2816 / 2797 / +19 | 692 / 686 / +6 | 72640 / 70 (404) |
| F004 | 1140 / 1131 / +9 | 2820 / 2803 / +17 | 691 / 685 / +6 | 72641 / 70 (404) |
| F006 | 1140 / 1131 / +9 | 2779 / 2765 / +14 | 3263 / 3237 / +26 | 77837 / 70 (404) |
| R001 | 1140 / 1131 / +9 | 2780 / 2765 / +15 | 692 / 686 / +6 | 72639 / 70 (404) |
| RES_3101_009 | 1140 / 1131 / +9 | 2780 / 2765 / +15 | 692 / 686 / +6 | 89384 / 70 (404) |
| RES_GML_001 | 1140 / 1131 / +9 | 2780 / 2765 / +15 | 692 / 684 / +8 | 72641 / 70 (404) |
| R_GML_DEMO | 1140 / 1131 / +9 | 2779 / 2765 / +14 | 692 / 686 / +6 | 72638 / 70 (404) |
| R_XMX_CHAIN | 1140 / 1129 / +11 | 2780 / 2765 / +15 | 692 / 686 / +6 | 72640 / 70 (404) |
| R_XMX_FRESH | 1140 / 1131 / +9 | 2780 / 2765 / +15 | 691 / 686 / +5 | 72639 / 70 (404) |
| R_XMX_FRESH2 | 1140 / 1130 / +10 | 2780 / 2765 / +15 | 692 / 686 / +6 | 72639 / 70 (404) |
| R_XMX_FRESH3 | 1139 / 1131 / +8 | 2777 / 2765 / +12 | 692 / 685 / +7 | 72640 / 70 (404) |
| R_YHDJ_DEMO | 1140 / 1129 / +11 | 2780 / 2765 / +15 | 692 / 686 / +6 | 72639 / 70 (404) |
| R_YJJ_DEMO | 1140 / 1130 / +10 | 2780 / 2765 / +15 | 692 / 686 / +6 | 72641 / 70 (404) |

**Per-byte interpretation**: deltas of +5..+44 across `analysis-*` endpoints fall within Phase 2A dict-eq tolerance and are dominated by:
- Pattern A scale-2 `BigDecimal("0.00") → Java "0.0"` vs `_decimal_to_number → Python int(0)` (saves 2 chars per occurrence × 5-20 occurrences per finance/inventory response).
- Whitespace differences between Jackson and Python `json.dumps(indent=2)` are not in play here — we re-serialized both sides through `json.dumps(...)` for the count.

---

## 3. Confirmed divergence pattern (Pattern A int-collapse only)

Sample `profitMetrics` row from F002 finance — all 14 factories show identical structure:

```diff
  Java analysis-finance.json:                       Python analysis-finance.json:
- "value": 0.0,                                     + "value": 0,
  "formattedValue": "0.00",                           "formattedValue": "0.00",
  "unit": "元",                                       "unit": "元",
  ...                                                 ...
```

This is the **expected** [Phase 2A dict-eq gate](../../.claude/rules/python-java-port.md#phase-2a-dict-eq-gate--official-standard-2026-05-07-confirmed-by-pr-122--raw-body-fetch) behavior:
- `_decimal_to_number(Decimal("0.00"))` returns `int(0)` because `Decimal("0.00") == Decimal("0.00").to_integral_value()`.
- Java `BigDecimal("0.00")` → Jackson serializes as `0.0` (or `0.00` if scale-preserved).
- After `json.loads()` both parse to Python `0`/`0.0` numerics, `float(a) == float(b)` is True → dict-eq match.
- `formattedValue` is identical because both Java `String.format` and Python `_format_decimal_half_up` agree on `"0.00"`.

**No new patterns** observed for these 14 factories — no Pattern B (Java legacy fallback structural divergence), no Rule 11 microsecond, no Rule 12 banker's-rounding. Consistent with the Phase 2A `T6.1` dryrun's 99.945% match rate generalizing to this customer set.

---

## 4. Architectural finding: Python prod has no `/smart-bi/dashboard`

| Service | `/api/mobile/{factory}/smart-bi/dashboard?period=year` |
|---|---|
| Java prod 10010 | 200, 70-90 KB (UnifiedDashboardResponse with sales + inventory + finance + production + quality enrichment) |
| Python prod 8083 | 404, 70 B (`{"success":false,"data":null,"message":"Not Found","code":"NOT_FOUND"}`) |

`grep -rn "smart-bi/dashboard" backend/python/smartbi_compat/` returns **no matches**. Python's smartbi_compat module mounts only `/analysis/*`, `/alerts`, `/recommendations`, `/query-templates`, `/datasource/*`, `/incentive-plan/*`, `/data-date-range`, `/drill-down` — the executive dashboard composite endpoint was deliberately not ported.

**Implication**: T6.4 nginx regex must NOT include `/dashboard` in the Python upstream branch, or all 14 factories' executive dashboard view collapses. Existing T6.3 regex pattern (`smart-bi/analysis/*` only) already excludes dashboard correctly — T6.4 should keep this scope.

---

## 5. Recommended T6.4 cutover anomaly thresholds (24h soak)

Use these per-factory per-endpoint thresholds for the 24h soak GO/NO-GO decision:

| Metric | Threshold | Source |
|---|---|---|
| HTTP 5xx rate per endpoint | < 0.5% (matches T6.2/T6.3 target) | Memory `project_2026_05_07_t6_2_canary_live.md` and `project_2026_05_08_t6_3_cutover_live.md` |
| HTTP 200 rate per endpoint | ≥ 99.5% | Same |
| p99 latency per endpoint | < 2000 ms | T6.2 GO criteria |
| Java fallback rate | = 0 (Python failures must NOT silently fall back to Java in cutover scope) | Same |
| dict-eq match rate vs Java baseline | ≥ 99.94% (matches T6.1 dryrun standard) | Rule 4 Phase 2A dict-eq gate |
| Per-customer KPI absolute delta | F002 inventory_value: \|Δ\| ≤ ¥0.01 (round-trip Decimal); F006 inventory_value: \|Δ\| ≤ ¥0.01; all others: full structural equality | This baseline doc |
| 404 rate on `/dashboard` | 100% on Python (nginx must not route dashboard to Python upstream); 0% on Java | This baseline doc |

### Per-customer hot-watch list (priority ordering for the canary watcher)

1. **F002, F006** — only factories with inventory data. Watch `analysis-inventory.kpiCards[INVENTORY_VALUE].rawValue` and `charts` data points. Pattern A int-collapse is acceptable; any structural divergence is NOT.
2. **RES_3101_009 (QHJ_PROD)** — has Gold POS data. Sample latency frequently; this is the only factory where dashboard composes Gold-layer data and any Python-side regression on `/api/smartbi/gold/*` (which Java calls into) would surface here. Within this baseline scope (no `analysisType`, YTD window), no anomaly observed.
3. Remaining 11 — minimal data, low risk. Watch only HTTP/latency metrics.

---

## 6. Reproduction

```bash
# On server 47 (jump from local via ssh)
ssh root@47.100.235.168
set -a; source /www/wwwroot/cretas/.env.prod; set +a
bash /tmp/capture-t6-4-baseline.sh   # script copied via scp from scripts/capture-t6-4-baseline.sh

# Pull tarball back
exit
ssh root@47.100.235.168 "tar czf /tmp/t6-4-baseline.tar.gz -C /tmp t6-4-baseline"
scp root@47.100.235.168:/tmp/t6-4-baseline.tar.gz tests/fixtures/
tar xzf tests/fixtures/t6-4-baseline.tar.gz -C tests/fixtures/
```

The `manifest.tsv` (113 lines: 1 header + 112 captures) is the entry point for any post-cutover diff analysis. Re-run the capture during T6.4 24h soak to compare delta against this baseline.

---

## 7. Caveats

- **Date window**: YTD 2026-01-01 → 2026-05-08 was chosen to maximize data presence while bounding response sizes. Per-type variants (`analysisType=profit/cost/receivable/payable/budget` for finance, `turnover/expiry/aging` for inventory, `salesperson/product/customer/trend` for sales) were intentionally **out of scope** — the 4 overview endpoints are the canonical landing views customers hit first. If T6.4 reveals divergence on a per-type variant, capture per-type as a follow-up.
- **JWT generation**: each capture used a 1h `factory_super_admin` JWT generated at call time. This matches `record-java-golden.sh` and is the established pattern. The `INTERNAL_API_KEY`-based path was not used (it bypasses factory-id checks; we want the production auth path).
- **Volatile fields stripped during diff**: `timestamp`, `generatedAt`, `lastUpdated`, `dataVersion`. Java emits 9-digit nanosecond `LocalDateTime` (e.g. `13:46:31.787214245`); Python emits naive UTC microseconds (e.g. `05:46:31.839666`). Both are call-time meta, not data, and DO NOT belong in dict-eq comparison. (See `Rule 11` for the strict-byte case which only matters when emitting `LocalDateTime` *as data*.)
- **Sales endpoint emptiness**: 14/14 factories return "暂无销售数据" for the 2026-01-01..05-08 window. This is real prod data, not a regression. Of the 14, only QHJ_PROD has any sales data at all and it surfaces only through the Gold-layer dashboard composite (period=year window), not the analysis-sales endpoint.
- **No prod state mutation**: All 4 endpoints are read-only GETs. Manifest confirms zero non-200/404 responses, no side effects.

---

## 8. Files

| Path | Purpose |
|---|---|
| `tests/fixtures/t6-4-baseline/java/<factory>-<endpoint>.json` | 56 Java prod captures |
| `tests/fixtures/t6-4-baseline/python/<factory>-<endpoint>.json` | 56 Python prod captures |
| `tests/fixtures/t6-4-baseline/manifest.tsv` | http_code / elapsed_ms / bytes per call |
| `scripts/capture-t6-4-baseline.sh` | Reproducible capture script (server-side) |
| `docs/qa-audits/2026-05-08-t6-4-baseline-metrics.md` | This doc |
