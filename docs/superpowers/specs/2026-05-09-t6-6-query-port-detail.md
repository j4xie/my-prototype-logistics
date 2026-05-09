# T6.6 Phase B `/query` Python Intent Service Port — Detail Design

**Status**: Phase B detail design (refines PR #196 Phase A)
**Date**: 2026-05-09
**Owner**: Chat O (this spec) → handed to Phase B Chat C impl when T6.5 Phase B+C complete (~July 2026)
**Approach**: A — rule engine 1:1 port (decided in PR #196, see §1.4 of that doc for B/C rejection rationale)
**Companion**: PR #196 Phase A design (`docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md`)

---

## §0 TL;DR

`/query` is the most complex T6.6 endpoint. PR #196 §3 named it 5-7d effort; this spec refines that estimate to **5-7d firm** by tracing the full Java surface and confirming that ~70% of executeIntent's downstream services already exist in Python (`backend/python/smartbi_compat/api/analysis_*.py` from Phase 2A).

**Three Java entry layers must be ported, in this order**:

1. **`SmartBIServiceImpl.processQuery`** (primary path, ~75 LOC at L621-695) — the orchestrator: quota → 指代消解 → restaurant route fallback → recognizeIntent → LLM fallback → executeIntent dispatch (15 cases) → response text generation (LLM + template) → chart config → follow-ups → memory update → persistence → build NLQueryResponse.
2. **`SmartBIIntentServiceImpl.recognizeIntent`** (rule engine, ~720 LOC at L600-720) — the matcher: keyword scan over 30+ intents → regex pattern scan → entity-aware boost → confidence calc → time/dimension/entity extraction. Loads patterns from DB (priority) > JSON file > hardcoded defaults.
3. **5 EntityRecognizer + BaseEntityRecognizer** (~2400 LOC across 6 files) — Trie-based matchers for region/department/metric/time/dimension. Each has a JSON dictionary file + DB table backing + hardcoded defaults.

**Plus 2 supporting ports**:
- `SmartBIIntentMapper` — bridges AI-Chat `IntentMatchResult` ↔ SmartBI `IntentResult` (used in LLM fallback path).
- `SmartBIPromptService` — 6 markdown templates with `{{var}}` placeholder substitution (used by `generateLLMResponseText` for narrative generation).

**Parity gate: dict-eq, NOT strict-byte** (per Rule 4 §"Phase 2A dict-eq gate official standard"). T6.6 inherits Phase 2A standard. Specific divergence patterns documented in §7.

**What does NOT need porting**:
- `tryRouteRestaurantDiagnostic` (P5.6 Tool-Skill route) — Java retains this; Python `/query` returns 404 for `RESTAURANT_*` intent codes when the legacy nginx route absorbs them. Decision: **mirror as no-op stub** to keep response shape parity (returns `null` → caller falls through to legacy intent path), OR document Python's `/query` as "post-T6.5 only routes when restaurant Tool-Skill has migrated to Python". §8 Q-A discusses the tradeoff.
- `tryLLMFallback` LLM call site — Python already has `LlmFallbackClient` equivalent in `smartbi/services/intent/` (shipped Phase 2A subset for AIQuery template router). Phase B reuses, no new LLM client work.
- `executeIntent`'s 15 case branches — every downstream `salesService.getSalesOverview` etc has a Python counterpart in `smartbi_compat/api/analysis_*.py`. Phase B wires them by intent code; no new analysis port work.

**Discoveries (refines PR #196 estimates)**:
- **D1**: Existing `backend/python/smartbi/services/intent/query_intent_extractor.py` is **NOT** the Java `SmartBIIntentServiceImpl` predecessor. It only extracts `n` / `frequency` / `role` for AIQuery template router (193 LOC narrow scope). Phase B writes a NEW `intent_recognizer.py` in same package. They co-exist (different consumers).
- **D2**: Java `executeIntent` switch has a **P6 fallback** at the `default:` branch — calls `intentExecutorService.execute()` (Tool-Skill pipeline). Python doesn't have `IntentExecutorService` yet (T6.5 territory). **Phase B mirrors as 400 error** (matching the post-fallback line in Java when Tool-Skill also fails). Q-B in §11.
- **D3**: Java `processQuery` calls `conversationMemoryService.resolveReference` for multi-turn 指代消解 ("这批", "那家") — depends on `ConversationMemoryService` from AI-Chat. Python doesn't have this Service ported. **Phase B mirrors as no-op pass-through** (`resolved_query = effective_query`) and accepts that single-turn parity is the only practical target. Q-D in §11.
- **D4**: `recognizeIntent` reads `ai_intent_configs` table for SmartBI-flagged rows via `AIIntentConfigRepository.findSmartBIIntents()`. Python `/query` parity depends on this table being readable by Python. Existing Phase 2A Python services already query SmartBI/cretas DBs. **No new wiring**.

**Effort breakdown (revised)**:

| Phase B sub-task | Java LOC | Python LOC est. | Effort |
|---|---|---|---|
| Port 5 EntityRecognizer + BaseEntityRecognizer Trie | ~2400 | ~900 (compact) | 2.0d |
| Port `SmartBIIntentServiceImpl.recognizeIntent` rule engine | ~720 | ~450 | 1.5d |
| Port `SmartBIServiceImpl.processQuery` orchestrator + executeIntent dispatch | ~200 (just orchestration; dispatch wires existing) | ~250 | 1.0d |
| Port `SmartBIPromptService` template engine | ~720 | ~200 | 0.5d |
| Port `SmartBIIntentMapper` (LLM fallback bridge) | ~180 | ~80 | 0.25d |
| DTO mirrors (`IntentResult` / `NLQueryRequest` / `NLQueryResponse`) | ~280 | ~80 (Pydantic) | 0.25d |
| Golden recording (F999 + F001, sample 30+ queries across 30+ intents) | — | — | 0.75d |
| dict-eq parity tests + bug fixes from divergence | — | ~300 (tests) | 0.75d |
| **Total** | | | **7.0d** |

**T6.6 prereqs (unchanged from PR #196)**: T6.5 Phase B+C complete + 30-day soak (~Aug 2026 earliest kickoff).

---

## §1 Java `SmartBIServiceImpl.processQuery` Primary Path Trace

**Source**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` L621-695 (and dependents L699-1014).

### §1.1 Endpoint surface

| Element | Value |
|---|---|
| Controller | `SmartBIAnalysisController.java:491` |
| HTTP route | `POST /api/smartbi/query` |
| Demo controller | `SmartBIPublicDemoController.java:43` (factoryId=DEMO, otherwise identical) |
| Path param | `factoryId` (header / path; controller-injected) |
| Auth header | `userId` (Long, optional, used for usage record) |
| Request body | `NLQueryRequest` |
| Response | `ApiResponse<NLQueryResponse>` |

### §1.2 Step-by-step flow (12 steps)

```
┌────────────────────────────────────────────────────────────────────┐
│ processQuery(factoryId, userId, NLQueryRequest request)            │
│                                                                    │
│ 1. checkQuota(factoryId)                                           │
│    └─→ 429 if exhausted; persists daily/monthly counter            │
│                                                                    │
│ 2. resolvedQuery = resolveQueryReferences(request)                 │
│    └─→ ConversationMemoryService.resolveReference(sessionId, q)    │
│        replaces "这批", "那家" with prior-turn entities            │
│        Falls back to original q if memory disabled / sessionId null│
│                                                                    │
│ 3. tryRouteRestaurantDiagnostic(factoryId, userId, request,        │
│        resolvedQuery, startTime)                                   │
│    └─→ if RESTAURANT_DIAGNOSTIC_KEYWORDS regex matches:            │
│        IntentExecutorService.execute(...) → if intentCode starts   │
│        with "RESTAURANT_" → return mapped NLQueryResponse          │
│        Else null → fall through to step 4                          │
│                                                                    │
│ 4. intentResult = intentService.recognizeIntent(resolvedQuery)     │
│    [details in §2 below]                                           │
│                                                                    │
│ 5. if (intentResult.isNeedsLLMFallback())                          │
│        intentResult = tryLLMFallback(factoryId, userId,            │
│                                       resolvedQuery, intentResult) │
│    └─→ LlmFallbackClient.classifyIntent(query, configs, ...)       │
│        Only override if LLM confidence > rule confidence           │
│                                                                    │
│ 6. data = executeIntent(factoryId, intentResult)                   │
│    [SWITCH on 15 cases, see §1.3]                                  │
│                                                                    │
│ 7. responseText = generateLLMResponseText(...)                     │
│        ?? generateResponseText(intentResult, data)                 │
│    └─→ Try LLM-generated narrative first; fall back to template    │
│        Uses SmartBIPromptService for both paths                    │
│                                                                    │
│ 8. charts = generateChartConfig(intentResult, data)                │
│    └─→ produces ChartConfig list (ECharts options)                 │
│                                                                    │
│ 9. followUpQuestions = generateFollowUpQuestions(intentResult)     │
│    └─→ Hardcoded suggestions per intent (3-5 strings)              │
│                                                                    │
│ 10. updateConversationMemory(sessionId, request, intentResult,     │
│         responseText)                                              │
│    └─→ ConversationMemoryService.addMessage(user) / addMessage(    │
│        assistant) / updateLastIntent                               │
│                                                                    │
│ 11. persistQueryRecord(factoryId, userId, request, intentResult,   │
│         responseText, elapsed)                                     │
│    └─→ saveQueryHistory + recordUsageWithQuery (auto-commit each)  │
│                                                                    │
│ 12. Build NLQueryResponse:                                         │
│         responseText: <step 7>                                     │
│         intent: intentResult.getIntent().getCode()  // enum.code   │
│         confidence: <inherits from builder default 0.0>            │
│            ⚠ NOT explicitly set in step 12;                        │
│             see §6.4 Note A                                        │
│         parameters: intentResult.getParameters() ?? new HashMap    │
│           + parameters.put("timeRange", intentResult.timeRange)    │
│             (when timeRange != null)                               │
│         charts: <step 8>                                           │
│         followUpQuestions: <step 9>                                │
│         (data, chartConfig, suggestions, intentCode, toolName,     │
│          skillName, sections, followUpChips, message,              │
│          forecast, needsClarification, clarificationQuestion       │
│          remain null/default — Java's primary path doesn't fill    │
│          these for legacy SmartBI flow)                            │
└────────────────────────────────────────────────────────────────────┘
```

### §1.3 `executeIntent` dispatch table (15 SmartBIIntent cases)

Java L1552-1634. Maps intent enum → backing service call. **All 15 backing services have Phase 2A Python equivalents** in `backend/python/smartbi_compat/api/`.

| SmartBIIntent | Java handler | Python equivalent (existing) |
|---|---|---|
| QUERY_SALES_OVERVIEW | `salesService.getSalesOverview(factoryId, start, end)` | `analysis_sales._get_sales_overview` |
| QUERY_SALES_RANKING | `salesService.getSalespersonRanking(factoryId, start, end)` | `analysis_sales._get_salesperson_ranking` |
| QUERY_SALES_TREND | `salesService.getSalesTrendChart(factoryId, start, end, "DAY")` | `analysis_sales._get_sales_trend_chart` |
| QUERY_DEPARTMENT_PERFORMANCE | `deptService.getDepartmentRanking(factoryId, start, end)` | `analysis_department._get_department_ranking` |
| QUERY_REGION_ANALYSIS | `regionService.getRegionRanking(factoryId, start, end)` | `analysis_region._get_region_ranking` |
| QUERY_FINANCE_OVERVIEW | `financeService.getFinanceOverview(factoryId, start, end)` | `analysis_finance._get_finance_overview` |
| QUERY_PROFIT_ANALYSIS | `financeService.getProfitMetrics(factoryId, start, end)` | `analysis_finance._get_profit_metrics` |
| QUERY_COST_ANALYSIS | `financeService.getCostStructureChart(factoryId, start, end)` | `analysis_finance._get_cost_structure_chart` |
| QUERY_RECEIVABLE | `financeService.getReceivableMetrics(factoryId, end)` | `analysis_finance._get_receivable_metrics` |
| QUERY_PRODUCT_ANALYSIS | `salesService.getProductRanking(factoryId, start, end)` | `analysis_sales._get_product_ranking` |
| COMPARE_PERIOD | `handlePeriodComparison(factoryId, intentResult)` (current vs lastMonth, both via salesService) | composite — call `_get_sales_overview` twice with different date ranges |
| COMPARE_DEPARTMENT | `handleDepartmentComparison(factoryId, intentResult, start, end)` (with entities filter) | `analysis_department._get_department_ranking` (filter by entities post-query) |
| COMPARE_REGION | `handleRegionComparison(factoryId, intentResult, start, end)` (with entities filter) | `analysis_region._get_region_ranking` (filter by entities post-query) |
| DRILL_DOWN | `handleDrillDownIntent(factoryId, intentResult)` | `analysis_drilldown._process_drill_down` |
| FORECAST | `handleForecastIntent(factoryId, intentResult, start, end)` | `forecast.py:_forecast_sales` (or dynamic by metricType param) |
| **default** | P6 Tool-Skill fallback → if fails: `BusinessException(400, "暂不支持该查询类型")` | **Phase B**: skip Tool-Skill (D2 above), throw `HTTPException(400, "暂不支持该查询类型")` directly |

**Date range default**: `if (range == null) range = DateRange.thisMonth();`  
Python mirror: same default via `DateRange.this_month()`.

### §1.4 Response build precision (Note A: `confidence` field)

Java L688-694 builds `NLQueryResponse` without setting `confidence` field. Lombok `@Builder.Default` for `confidence` is `0.0`. Looking at `executeIntent`'s top-of-method confidence (which IS available via `intentResult.getConfidence()`), it's NOT propagated to the response. **This is intentional per Java legacy code** — Java relies on the AI Chat path (P5.6 restaurant route) to populate `confidence`, where `mapIntentExecuteResponse` sets it from execResponse. Legacy primary path emits `confidence: 0.0`.

**Python mirror**: do exactly the same — emit `confidence: 0.0` in primary path. F999 golden will confirm. **DO NOT optimize / fix this in Python** — that would diverge byte-shape.

---

## §2 Java `SmartBIIntentServiceImpl.recognizeIntent` Rule Engine Trace

**Source**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIIntentServiceImpl.java` L600-722.

### §2.1 Configuration loading (PostConstruct, init order matters)

```
1. initDefaultKeywords()  — hardcoded ~30 intents, each 5-15 keywords
2. initDefaultPatterns()  — hardcoded ~8 intents, each 1-5 regex (most intents have NO regex)
3. loadPatternsFromFile() — config/smartbi/intent_patterns.json (additive: merges keywords/patterns/weights)
4. loadIntentsFromDatabase() — ai_intent_configs table where category = SmartBI;
                                DB row's keywords[] OVERWRITES default; regex prepended (priority 0).
                                Row's confidence_boost → intentWeights map.
```

**Python mirror**: identical 4-stage init at module-level singleton boot (Python smartbi service uses uvicorn worker singletons; init runs once per worker startup).

**Key contract**: Database is authoritative when present. Phase B Python MUST query `ai_intent_configs` table same way as Java. The table is in `cretas_db` / `cretas_prod_db` (same DB Java uses), accessible via existing asyncpg pool. SQL:
```sql
SELECT intent_code, keywords, regex_pattern, confidence_boost
FROM ai_intent_configs
WHERE intent_category = 'SMARTBI' AND is_active = true
ORDER BY priority ASC;
```

### §2.2 recognizeIntent flow (10 steps)

Java L605-722. Each step mirrors 1:1 in Python.

```
1. totalRequests++; if (q == null || q.trim().isEmpty()) return IntentResult.unknown("");
2. normalizedQuery = normalizeQuery(q)
   = q.toLowerCase().replaceAll("[\\s]+", "").replaceAll("[,，.。!！?？;；:：]", "")
3. candidates = []
4. KEYWORD scan: for each (intent, keywords) in intentKeywords:
       matched = keywords.stream().filter(normalizedQuery::contains).toList()
       if matched not empty:
           confidence = calculateKeywordConfidence(matched, keywords.size, normalizedQuery)
           candidates.add(CandidateIntent(intent, confidence, matched))

5. PATTERN scan: for each (intent, patterns) in intentPatterns:
       for each pattern:
           if pattern.matcher(normalizedQuery).matches():  # full-match, NOT find!
               existing = candidates.firstOrNull(c -> c.intent == intent)
               if existing:
                   existing.confidence = min(existing.confidence + 0.2, 1.0)
               else:
                   candidates.add(CandidateIntent(intent, 0.75, []))
               break  # one pattern hit per intent

6. boostIntentByEntityDetection(normalizedQuery, candidates)
   └─→ regionRecognizer.recognize(query) + departmentRecognizer.recognize(query)
       + metricRecognizer.recognize(query)
       └─→ if hasRegionEntity AND hasSalesKeyword: boostRegionAnalysisIntent(...)
              boost = min(0.2 + regionEntities.size * 0.1, 0.4)
              new = min(existing.confidence + boost, 1.0)
       └─→ if hasDeptEntity AND hasSalesKeyword: boostDepartmentIntent(...) (same formula)
       └─→ hasSalesKeyword = hasMetricEntity OR query.contains(销售|业绩|销量|营收|收入|情况|怎么样|如何|数据|分析)

7. candidates.sort(desc by confidence)
8. if candidates empty:
       result = IntentResult.unknown(userQuery); llmFallbackCount++
   else:
       top = candidates[0]
       result = IntentResult.builder()
                   .intent(top.intent).confidence(top.confidence)
                   .originalQuery(userQuery)
                   .matchedKeywords(top.matchedKeywords)
                   .matchMethod(matchedKeywords.isEmpty() ? "PATTERN" : "KEYWORD")
                   .candidates(candidates)
                   .needsLLMFallback(top.confidence < llmFallbackThreshold)
                   .build()
       intentCounts[top.intent]++; if needsFallback: llmFallbackCount++

9. if (result.isValid()):  // intent != UNKNOWN
       result.parameters = extractParameters(userQuery, result.intent)
   result.timeRange = parseTimeRange(userQuery)  // delegates to TimeEntityRecognizer
   result.dimension = parseDimension(userQuery)  // delegates to DimensionEntityRecognizer
   result.entities = parseAllEntitiesAsList(userQuery)
                     = stream("department","region","metric","time","dimension")
                       .flatMap(t -> parseEntities(q, t)).distinct().toList()

10. result.processingTimeMs = now - startTime; totalConfidence += result.confidence
    return result
```

### §2.3 `calculateKeywordConfidence` formula

Java L1320-1337. Python MUST mirror exactly to keep candidate ordering stable.

```python
def _calculate_keyword_confidence(matched_keywords, total_keywords, normalized_query):
    if not matched_keywords:
        return 0.0
    base = min(len(matched_keywords) / min(total_keywords, 5), 1.0)
    total_match_len = sum(len(k) for k in matched_keywords)
    coverage_bonus = min(total_match_len / len(normalized_query), 0.3)
    exact_match_bonus = 0.1 if any(len(k) >= 4 for k in matched_keywords) else 0.0
    return min(base + coverage_bonus + exact_match_bonus, 1.0)
```

**Watch-out (Rule 12 risk)**: this returns a `float`. Java uses `double`. Both follow IEEE 754, so semantic equality holds. NOT a banker's-rounding zone. **Do NOT quantize**. Confidence is kept raw, only emitted in JSON via Java Jackson (Python `json.dumps(float)` → identical formatting in Phase 2A test data).

### §2.4 `extractParameters` flow

Java L733-797. Per-intent param extraction. Python mirrors:

| Param | Extraction logic | Cases |
|---|---|---|
| `metric` | METRIC_PATTERN regex group(1) | All intents |
| `topN` | regex `top\s*(\d+)\|前\s*(\d+)` group(1) or group(2); fall back to 10 for RANKING/PERFORMANCE | RANKING / DEPARTMENT_PERFORMANCE |
| `sortOrder` | "升序"/"从低到高" → "ASC"; "降序"/"从高到低" → "DESC"; default DESC for RANKING/PERFORMANCE | RANKING / PERFORMANCE |
| `aggregation` | 总计/合计/总和→SUM, 平均/均值→AVG, 最大/最高→MAX, 最小/最低→MIN, 数量/个数→COUNT | All |
| `compareType` | 同比→YoY, 环比→MoM | COMPARE_PERIOD only |

### §2.5 `parseTimeRange` cascade

Java L803-836:
1. `timeRecognizer.recognizeFirst(userQuery)` — Trie + regex; if found, `timeRecognizer.parseToDateRange(entity)`.
2. Else: hardcoded `TIME_PATTERNS` map iteration (LinkedHashMap, deterministic order).
3. Else: return `defaultRange` (caller's default; processQuery doesn't pass one → null).

Python mirror: identical cascade. `time_recognizer.recognize_first` first; fall back to hardcoded TIME_PATTERNS dict ordered by insertion (Python 3.7+ dict guarantees order — Rule 8 risk but here we're just iterating, not serializing).

### §2.6 LLM Fallback bridge

Java L913-941. When `intentResult.needsLLMFallback`:
1. Call `LlmFallbackClient.classifyIntent(query, intentConfigs, factoryId, userId, null)`.
2. If LLM has a match AND `llmConfidence > ruleConfidence` → use `convertToSmartBIIntentResult` to produce final IntentResult with `matchMethod="LLM"`.

**Python mirror**: equivalent client already exists in Python (`llm_fallback_admin.py` etc) for AI-Chat path. Phase B reuses; just need `_classify_intent_for_smartbi(query, intent_configs, ...)` thin wrapper to pass SmartBI-flagged configs.

---

## §3 6 EntityRecognizer Port Plan (Approach A: Trie 1:1)

**Sources**:
- `BaseEntityRecognizer.java` (478 LOC) — abstract base with Trie + dict loading.
- `RegionEntityRecognizer.java` (522 LOC) — 7 大区 / 34 省 / 主要 城市 + suffix normalization.
- `TimeEntityRecognizer.java` (754 LOC) — Trie for relative + Q1-4; regex for LAST_N_DAYS/WEEKS/MONTHS + ABSOLUTE_DATE/MONTH/YEAR + ISO_DATE.
- `DepartmentEntityRecognizer.java` (~600 LOC) — 销售部/市场部/... + numbered patterns (一部/2部).
- `MetricEntityRecognizer.java` (~500 LOC) — 销售额/销量/利润/成本 + category + unit + aggregation metadata.
- `DimensionEntityRecognizer.java` (~550 LOC) — 部门/区域/产品/人员/时间/客户/渠道 + time granularity sub-patterns.

### §3.1 Common Trie + dict loading (BaseEntityRecognizer)

```python
# backend/python/smartbi/services/intent/_base_recognizer.py

class BaseTrieNode:
    """Common Trie node fields. Subclass-specific fields in derived nodes."""
    __slots__ = ("children", "is_end", "is_alias", "alias_text", "normalized_name")
    def __init__(self):
        self.children = {}            # dict[char, BaseTrieNode]
        self.is_end = False
        self.is_alias = False
        self.alias_text = None
        self.normalized_name = None

class BaseEntityRecognizer:
    """Abstract base. Subclasses override:
       - _create_trie_node()           — return subclass-specific node
       - _create_entity(text, node, start, end)  — return entity dict
       - _init_default_dictionary()    — populate Trie from hardcoded fallback
       - _process_dictionary_data(d)   — populate Trie from JSON file
       - _process_db_entry(row)        — populate Trie from DB row
       - dict_type / recognizer_name / dictionary_file class attrs
    """

    def __init__(self):
        self.root = self._create_trie_node()
        self.total_recognitions = 0
        self.entities_found = 0

    async def init(self):
        # 1. JSON file (resources/config/smartbi/{dict_type}_dictionary.json)
        # 2. DB (smart_bi_dictionary WHERE dict_type=? AND is_active ORDER BY priority ASC)
        # 3. defaults (if file missing AND DB returns 0)
        ...

    def recognize(self, text: str) -> list[dict]:
        """O(n) Trie scan, longest-match wins, sorted by start_index."""
        ...

    def recognize_first(self, text):
        result = self.recognize(text)
        return result[0] if result else None

    def contains_entity(self, text):
        ...
```

### §3.2 Per-recognizer porting notes

| Recognizer | Specific node fields | Recognize algorithm | Notes |
|---|---|---|---|
| **RegionEntityRecognizer** | `region_type` (enum), `parent_region` | Pure Trie | Suffix normalization in `normalize()` (separate from recognize). Includes 7 大区 + 34 省 + 主要 城市 from default dict (`init_default_dictionary` line 220-277). |
| **DepartmentEntityRecognizer** | `department_type` (enum), `parent_department` | Trie + numbered pattern regex (一部/2部) | Numbered regex compiled at init: `[一二三四五六七八九十]部` and `\d+部`. Match contributes alongside Trie hits, dedup by start_index. |
| **MetricEntityRecognizer** | `category`, `unit`, `aggregation` | Pure Trie | Default dict in `_init_default_dictionary`: 销售额(SUM/¥), 销量(SUM/件), 利润(SUM/¥), 成本(SUM/¥), 同比(CALC/%), etc. |
| **TimeEntityRecognizer** | `time_type` (enum), `granularity` (enum), `description` | Trie (Phase 1) + regex (Phase 2, non-overlap with Phase 1) | Phase 2 regex order: LAST_N_DAYS → LAST_N_WEEKS → LAST_N_MONTHS → ABSOLUTE_DATE → ISO_DATE → ABSOLUTE_MONTH (skips overlaps with ABSOLUTE_DATE) → ABSOLUTE_YEAR (skips overlaps with ABSOLUTE_MONTH). **Order matters** — strict 1:1. |
| **DimensionEntityRecognizer** | `dimension_type` (str), `description`, `db_field`, `granularity` (str, only for time sub-patterns) | Pure Trie | 7 dimension types: department/region/product/person/time/customer/channel. Time has sub-patterns 按月/按周/按日 each carrying granularity field. |
| **BaseEntityRecognizer** | n/a | Common Trie scan + reload + statistics | DB query: `SELECT name, aliases, dict_type, parent_name, metadata FROM smart_bi_dictionary WHERE dict_type=$1 AND is_active=true ORDER BY priority ASC`. |

### §3.3 Dictionary JSON sync

**Java location**: `backend/java/cretas-api/src/main/resources/config/smartbi/{region|time|department|metric|dimension}_dictionary.json`.

**Python sync options** (Q-E in §11):
- **Option α (chosen for spec — simplest)**: copy JSON files into `backend/python/smartbi/services/intent/data/` at deploy time via `deploy-smartbi-python.sh` step. Files versioned together. **Risk**: JSON edited in Java repo doesn't auto-propagate to Python until deploy script copies.
- **Option β**: Python reads JSON via `requests.get(java_url)` at startup — adds Java-side endpoint + new failure mode.
- **Option γ**: Both Java and Python read directly from `smart_bi_dictionary` DB table; eliminate JSON files entirely. **Bigger refactor**, defer to Phase 2C+.

**Recommendation**: α. Add `cp backend/java/cretas-api/src/main/resources/config/smartbi/*.json backend/python/smartbi/services/intent/data/` to deploy script (or symlink in dev). Deploy contract: any edit to Java JSON requires Python redeploy.

### §3.4 Confidence value parity

`calculate_confidence(is_alias)`: returns `0.9` (alias) or `1.0` (exact). Both float64 IEEE 754, byte-identical to Java `double`. **No Rule 12 risk** (those are integer-valued anyway: 0.9 / 1.0 — banker's-zone irrelevant).

---

## §4 SmartBIIntentMapper Java → Python

**Source**: `SmartBIIntentMapper.java` (180 LOC).

**Used by**: `SmartBIServiceImpl.tryLLMFallback` (after LLM returns `IntentMatchResult` from AI-Chat layer, mapper converts to SmartBI's `IntentResult` shape).

### §4.1 Methods to port

| Java method | Python signature | Logic |
|---|---|---|
| `convertToIntentConfigs(SmartBIIntent[] intents)` | `def convert_to_intent_configs(intents: list[SmartBIIntent]) -> list[dict]` | Filter UNKNOWN, map each enum to dict {intentCode, intentName, intentCategory, description, sensitivityLevel, isActive, priority} |
| `toAIIntentConfig(SmartBIIntent intent)` | helper inside above | priority = `_calculate_priority(intent)`: QUERY=50, COMPARE=60, DRILL=70, FORECAST=80, AGGREGATE=55. category = "ANALYSIS" for all (mapping erases SmartBI sub-category). |
| `convertToSmartBIIntentResult(IntentMatchResult, str query)` | `def convert_to_smartbi_intent_result(match_result: dict, original_query: str) -> dict` | Read bestMatch.intentCode → SmartBIIntent.from_code; confidence from match_result; matchMethod from `_map_match_method` (EXACT/PHRASE_MATCH/KEYWORD → "KEYWORD", REGEX → "PATTERN", SEMANTIC/FUSION → "SEMANTIC", LLM → "LLM"); needsLLMFallback = (confidence < 0.7 OR intent == UNKNOWN). |
| `findSmartBIIntent(String code)` | `def find_smartbi_intent(code: str) -> SmartBIIntent` | `SmartBIIntent.from_code(code)` (case-insensitive). |

### §4.2 SmartBIIntent enum Python equivalent

Python uses `enum.StrEnum` for byte-shape parity (str value = Java's `.code` field; `.name` = Python's enum name = Java's `.getName()` returns localized Chinese name, NOT enum name — careful):

```python
class SmartBIIntent(StrEnum):
    QUERY_SALES_OVERVIEW       = "sales_overview"
    QUERY_SALES_RANKING        = "sales_ranking"
    # ... 30 more (full table in §4.3)
    UNKNOWN                    = "unknown"

    @classmethod
    def from_code(cls, code: str | None) -> "SmartBIIntent":
        if not code:
            return cls.UNKNOWN
        for member in cls:
            if member.value.lower() == code.lower():
                return member
        return cls.UNKNOWN

    @property
    def display_name(self) -> str:
        """Maps to Java's getName() (Chinese display)."""
        return _DISPLAY_NAMES[self]

    @property
    def category(self) -> str:
        return _CATEGORIES[self]

# Maintain _DISPLAY_NAMES + _CATEGORIES dicts as separate sources (cleaner than shadowing enum value).
```

### §4.3 Full enum mapping table

(Spec dispatcher omitted from inline table; see `SmartBIIntent.java` L24-253 for canonical source. Phase B impl chat to copy verbatim — 30 entries.)

---

## §5 SmartBIPromptService LLM Prompt Template Engine

**Source**: `SmartBIPromptServiceImpl.java` (720 LOC).

### §5.1 Template surface

| analysisType | Template file (resources/prompts/smartbi/) |
|---|---|
| OVERVIEW | overview_analysis.md |
| SALES | sales_analysis.md |
| DEPARTMENT | department_analysis.md |
| REGION | region_analysis.md |
| FINANCE | finance_analysis.md |
| QA | qa_general.md |

Files loaded at PostConstruct → `templateCache: Map<String, String>` (concurrent map; key = analysisType uppercased).

### §5.2 Placeholder substitution

Pattern: `{{var}}` or `{{obj.prop.subprop}}`. Java regex: `\\{\\{([a-zA-Z_][a-zA-Z0-9_.]*?)\\}\\}`.

Resolver (Java L484-507): split by `.`, walk Map→get / Object→reflection getter (`getXxx()`). On null → return placeholder unchanged (e.g. `{{missing.field}}` literal).

Value-to-string (Java L538-552):
- `null` → `""`
- `String` → as-is
- `Number` / `Boolean` → `.toString()` (Java's float `1.5` → `"1.5"`)
- `Collection` / `Map` → `serializeToJson` via Jackson **with `INDENT_OUTPUT=true`**
- else → `.toString()`

### §5.3 Python port (`prompt_service.py`)

```python
# backend/python/smartbi/services/prompt_service.py

PROMPT_DIR = Path(__file__).parent / "prompts" / "smartbi"
ANALYSIS_TYPE_TO_TEMPLATE = {
    "OVERVIEW": "overview_analysis",
    "SALES": "sales_analysis",
    "DEPARTMENT": "department_analysis",
    "REGION": "region_analysis",
    "FINANCE": "finance_analysis",
    "QA": "qa_general",
}
PLACEHOLDER_RE = re.compile(r"\{\{([a-zA-Z_][a-zA-Z0-9_.]*?)\}\}")

_template_cache: dict[str, str] = {}  # module-level

def _load_all_templates():
    for analysis_type, template_name in ANALYSIS_TYPE_TO_TEMPLATE.items():
        path = PROMPT_DIR / f"{template_name}.md"
        if path.exists():
            _template_cache[analysis_type.upper()] = path.read_text(encoding="utf-8")

def _resolve_value(placeholder: str, data: dict) -> Any:
    parts = placeholder.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return f"{{{{{placeholder}}}}}"  # literal placeholder
    return current

def _value_to_string(value: Any) -> str:
    if value is None:               return ""
    if isinstance(value, str):       return value
    if isinstance(value, bool):      return "true" if value else "false"  # Java JSON convention
    if isinstance(value, (int, float)): return str(value)
    if isinstance(value, (list, dict)):
        # MUST match Jackson INDENT_OUTPUT=true byte-shape
        return json.dumps(value, indent=2, ensure_ascii=False, default=str)
    return str(value)

def fill_prompt_template(analysis_type: str, data: dict) -> str:
    template = _template_cache.get(analysis_type.upper())
    if template is None:
        raise ValueError(f"未找到分析类型对应的模板: {analysis_type}")
    return PLACEHOLDER_RE.sub(
        lambda m: _value_to_string(_resolve_value(m.group(1), data)),
        template,
    )
```

### §5.4 Template files: copy from Java repo

Same dict-sync model as §3.3 — copy `resources/prompts/smartbi/*.md` into `backend/python/smartbi/services/intent/prompts/smartbi/` at deploy time. Files are pure text, no compilation needed.

### §5.5 Jackson INDENT_OUTPUT byte parity

⚠ **Critical Rule 8/9 risk**: `SmartBIPromptServiceImpl` constructor at L97-99 enables `SerializationFeature.INDENT_OUTPUT`. Java emits 2-space indented JSON with newlines:
```
"data" : [ {
  "key" : "value"
} ]
```

Python `json.dumps(..., indent=2)` emits:
```
"data": [
  {
    "key": "value"
  }
]
```

**Different!** Java Jackson INDENT_OUTPUT default: space-around-colon (`"key" : "value"`); Python json default: no-space-after-colon. Furthermore Jackson formats arrays with `[ {` on same line; Python wraps `[` then `{` on next line.

**Phase B mitigation**: This template-fill step feeds INTO LLM, NOT into byte-eq-tested response. So strict-byte parity here doesn't matter for /query response golden. **But** the LLM output text DOES go into `responseText` field. If Java's prompt happens to produce different LLM output than Python's prompt due to JSON formatting differences, the LLM might generate slightly different `responseText` strings → response divergence.

**Decision**: emit prompts using `_jackson_indent_compat(obj)` helper that mimics Java Jackson exact whitespace. Ship the helper in Phase B alongside a unit test verifying `_jackson_indent_compat({...}) == java_golden_string`. Estimated +2h to the §0 effort.

---

## §6 IntentResult + NLQueryRequest/Response DTO Mirror

### §6.1 IntentResult Pydantic mirror

```python
# backend/python/smartbi/services/intent/models.py
from pydantic import BaseModel, Field
from typing import Optional

class CandidateIntent(BaseModel):
    intent: str           # SmartBIIntent.value (code, e.g. "sales_overview")
    confidence: float
    matchedKeywords: list[str] = Field(default_factory=list)

class IntentResult(BaseModel):
    intent: str           # SmartBIIntent.value
    confidence: float
    parameters: dict = Field(default_factory=dict)
    timeRange: Optional[dict] = None  # DateRange shape; see §6.3
    dimension: Optional[str] = None
    entities: list[str] = Field(default_factory=list)
    needsLLMFallback: bool = False
    originalQuery: Optional[str] = None
    matchedKeywords: list[str] = Field(default_factory=list)
    matchMethod: Optional[str] = None  # KEYWORD / PATTERN / SEMANTIC / LLM / UNKNOWN
    candidates: list[CandidateIntent] = Field(default_factory=list)
    processingTimeMs: int = 0
```

### §6.2 NLQueryRequest Pydantic mirror

```python
class NLQueryRequest(BaseModel):
    query: str
    factoryId: Optional[str] = None
    sessionId: Optional[str] = None
    queryText: Optional[str] = None  # deprecated; @Deprecated in Java
    context: Optional[dict] = None
    startDate: Optional[str] = None  # ISO date string
    endDate: Optional[str] = None

    def effective_query(self) -> str:
        if self.query and self.query.strip():
            return self.query
        return self.queryText or ""
```

### §6.3 NLQueryResponse Pydantic mirror

```python
class NLQueryResponse(BaseModel):
    intent: Optional[str] = None
    confidence: float = 0.0          # default 0.0 — see §1.4 Note A
    responseText: Optional[str] = None
    data: Optional[Any] = None
    parameters: Optional[dict] = None
    chartConfig: Optional[dict] = None      # singular
    charts: Optional[list[dict]] = None     # plural
    suggestions: Optional[list[str]] = None
    followUpQuestions: Optional[list[str]] = None  # deprecated; populated by primary path
    needsClarification: bool = False
    clarificationQuestion: Optional[str] = None
    forecast: Optional[dict] = None
    # P5.6 Tool-Skill (additive, populated by restaurant route only):
    intentCode: Optional[str] = None
    toolName: Optional[str] = None
    skillName: Optional[str] = None
    sections: Optional[list[dict]] = None
    followUpChips: Optional[list[str]] = None
    message: Optional[str] = None
```

### §6.4 DateRange Pydantic mirror

Already exists in Phase 2A `smartbi_compat`. Phase B **reuses** without changes. Refer to existing model.

### §6.5 Lombok `@Data` + Jackson serialization (Rule 9)

Java DTOs use `@Data @Builder` — derived getters serialize as fields. None of the DTO field names contain consecutive uppercase letters that would trigger `Introspector.decapitalize` quirk (xAxisField → xaxisField). All field names are plain camelCase.

**Verified field names** (Phase B impl must record F999 golden to confirm):
- `IntentResult`: intent, confidence, parameters, timeRange, dimension, entities, needsLLMFallback, originalQuery, matchedKeywords, matchMethod, candidates, processingTimeMs.
- `NLQueryRequest`: query, factoryId, sessionId, queryText, context, startDate, endDate.
- `NLQueryResponse`: 18 fields above.

**Risk**: `@JsonInclude` not set on these DTOs → null fields ARE emitted (per Rule 9 §9.2). Phase B Pydantic must NOT use `exclude_none=True` when serializing. Use default `model_dump()`.

---

## §7 Byte-Shape Parity Gate — Golden + dict-eq Plan

### §7.1 Phase 2A standard inheritance

T6.6 inherits Phase 2A's **dict-eq gate** per Rule 4 §"Phase 2A dict-eq gate official standard" (commits and rationale documented in `python-java-port.md` Audit 历史 row "PR #122 + raw-body reproduction"). T6.6 does NOT upgrade to strict-byte.

**Acceptance**: ≥ 99.5% dict-eq match rate across recorded golden corpus (matches Phase 2A T6.1 99.945%).

### §7.2 Golden corpus recording plan

**Target**: 30+ queries spanning all 30 SmartBIIntent codes + corner cases.

```bash
# Record F999 (sandbox) goldens
./scripts/record-java-golden.sh F999 \
  /api/smartbi/query \
  '{"query":"本月销售情况","factoryId":"F999","sessionId":null}' \
  > tests/fixtures/java-smartbi-golden/query-F999-sales-overview-thismonth.json

# Repeat for each intent code × selected query phrasing
# F001 (real factory) for entity-boost cases (区域分析 needs F001's region data)
```

**Required corner cases**:
- Empty query (expects 400 from controller validation OR UNKNOWN intent path).
- Query with no keyword/pattern hit (expects intent=UNKNOWN, needsLLMFallback=true, but LLM returns nothing → final IntentResult is UNKNOWN with confidence=0.0).
- Multi-entity boost: "华东销售情况怎么样" (region + sales keyword).
- Time absolute date: "2026年1月销售额是多少".
- Time relative dynamic: "最近30天销售情况".
- Drill-down: "看看华东区的具体明细".
- Forecast: "预测下个月销售".
- Compare period: "本月销售比上月多多少".

### §7.3 dict-eq comparator

Reuse Phase 2A `assert_response_eq` dispatcher (PR #154 chat 2 spec for strict-byte test infra has the design; dict-eq fallback path is the existing default). Test markers `@dict_eq` per pytest fixture.

### §7.4 Expected dict-eq divergences (Phase 2A patterns)

**Pattern A** (integer Decimal int-collapse): `confidence: 0.0` Java emits `0.0`, Python emits `0` (or `0.0` depending on json.dumps behavior with Pydantic float field). Acceptable per Rule 4.

**Pattern A2** (scale-4 trailing-zero): N/A — confidence/probabilities are NOT BigDecimal scaled. Should be byte-identical floats.

**Rule 11 (LocalDateTime microsecond)**: `processingTimeMs: long` is integer ms (not LocalDateTime). N/A.

**Rule 8 (Map.of key order)**: `parameters: Map<String, Object>` is `HashMap` (not `Map.of`). HashMap key order is INSERTION-stable in Java since Java 8 in practice but NOT GUARANTEED. `extractParameters` puts keys in: metric, topN, sortOrder, aggregation, compareType, then defaults. Python `dict` insertion-order is guaranteed. **Phase B impl must record F999 golden and mirror Java HashMap output order**. If Java's HashMap iteration is non-deterministic across runs, document as known divergence and accept dict-eq match.

**Rule 9 (Lombok null emit)**: NLQueryResponse has 18 fields, primary path fills ~5. Other 13 emit `null`. **Pydantic Python mirror MUST emit all 18 with null** (no `exclude_none=True`).

### §7.5 Dispatch ID stability

`IntentResult.intent` is the SmartBIIntent enum's `code` (string), NOT enum name. Dict-eq compares string equality — stable.

### §7.6 Test scaffolding

```python
# backend/python/tests/smartbi/test_query_parity.py
import pytest
from .fixtures import load_golden, dict_eq

QUERY_PARITY_CASES = [
    ("F999", "本月销售情况", "query-F999-sales-overview-thismonth"),
    ("F001", "华东区销售怎么样", "query-F001-region-analysis"),
    ("F999", "预测下个月销售", "query-F999-forecast"),
    # ... 30 cases
]

@pytest.mark.dict_eq
@pytest.mark.parametrize("factory_id,query,golden_name", QUERY_PARITY_CASES)
async def test_query_parity_dict_eq(client, factory_id, query, golden_name):
    response = await client.post("/api/smartbi/query",
                                  json={"query": query, "factoryId": factory_id})
    assert response.status_code == 200
    actual = response.json()
    expected = load_golden(f"java-smartbi-golden/{golden_name}.json")
    dict_eq(actual, expected, msg=f"divergence on {golden_name}")
```

---

## §8 Edge Cases

### §8.1 LLM rate limiting

Java `LlmFallbackClient` uses Python LLM endpoint (`/api/smartbi/llm/classify-intent` or similar). Rate limit applies at Python layer.

**Phase B Python `/query`**: when calling its own LLM client, rate limit is shared with all other Python LLM users. **Risk**: high-traffic factories may exhaust LLM budget. **Mitigation**: cap `/query` LLM fallback at `LLM_FALLBACK_MAX_PER_MINUTE_PER_FACTORY` env var (default 30). Above cap → return rule result without LLM enhancement (matches Java behavior when LLM client is offline).

### §8.2 Timezone handling

`TimeEntityRecognizer` uses `LocalDate.now()` — no timezone. Java JVM default = `Asia/Shanghai` (server-set). Python `datetime.date.today()` uses system tz.

**Risk**: if Python container runs UTC and Java runs CST, "今天" diverges by 8h.

**Mitigation**: explicit timezone in Python via `pytz.timezone("Asia/Shanghai")`:
```python
from datetime import datetime
from pytz import timezone
TZ = timezone("Asia/Shanghai")
def today() -> date:
    return datetime.now(TZ).date()
```
Apply in all `_calculate_date_range` paths. Verify Python container TZ via `TZ=Asia/Shanghai` env var in `cretas-python.service`.

### §8.3 Dictionary JSON sync (revisited)

See §3.3 + §5.4 — chosen Option α (deploy script copies JSON / .md files). Phase B impl chat must:
1. Add `cp -r resources/config/smartbi/*.json backend/python/smartbi/services/intent/data/` to `deploy-smartbi-python.sh`.
2. Add `cp -r resources/prompts/smartbi/*.md backend/python/smartbi/services/intent/prompts/smartbi/` to same script.
3. Add unit test: `assert os.path.exists("smartbi/services/intent/data/region_dictionary.json")` to catch dropped files.

### §8.4 Empty / blank query

Java `recognizeIntent` L609: returns `IntentResult.unknown("")`. `processQuery` continues to LLM fallback (which returns nothing for empty query → final UNKNOWN → executeIntent throws 400 "暂不支持该查询类型: 未知意图").

Python mirror identically. Don't short-circuit at controller — let it flow through to 400.

### §8.5 Intent boost double-count

`boostIntentByEntityDetection` adds `RegionEntity.size * 0.1` boost. Multiple region mentions in one query (e.g. "比较华东和华南") → boost = min(0.2 + 2*0.1, 0.4) = 0.4. Python must do exactly the same min/cap calculation with `len(region_entities)`.

### §8.6 Quota exhaustion

Java `checkQuota` reads `smartbi_billing_configs` table. Python Phase B reuses existing Python `check_quota` from Phase 2A `usage` module. If Python's check is missing, port from Java.

### §8.7 P5.6 restaurant route gate

Per D1: Python `/query` mirrors `tryRouteRestaurantDiagnostic` as **no-op stub returning None** (skips the restaurant fast-path). Reasoning:
- `IntentExecutorService` (Tool-Skill pipeline) is NOT yet ported to Python.
- T6.5 will deprecate Java's restaurant route eventually; until then Java retains `RESTAURANT_*` ownership.
- Nginx routing in T6.6 cutover prefix-match has Python `/api/smartbi/query` only for non-restaurant queries — restaurant queries can be routed back to Java by extending T6.6's nginx regex.

**Q-A in §11**: confirm with T6.5 Phase C lead that nginx regex can dispatch restaurant queries to Java.

### §8.8 Conversation memory (D3)

Python no-op pass-through (`resolved_query = effective_query`). Single-turn parity only. Multi-turn 指代消解 explicitly out of T6.6 scope.

---

## §9 Estimated Effort (Refined from PR #196)

PR #196 estimated 5-7d. This spec confirms **firm 7d** with breakdown:

| Day | Deliverable |
|---|---|
| Day 1 | DTO mirrors (IntentResult / NLQueryRequest / NLQueryResponse / SmartBIIntent enum) + skeleton routes. F999 record golden 30+ queries. |
| Day 2 | Port `BaseEntityRecognizer` Trie + 3 lighter recognizers (Region / Department / Metric). |
| Day 3 | Port `TimeEntityRecognizer` (Trie + 7 regex patterns) + `DimensionEntityRecognizer`. |
| Day 4 | Port `SmartBIIntentServiceImpl.recognizeIntent` rule engine (keyword + pattern + boost + extract*). |
| Day 5 | Port `SmartBIServiceImpl.processQuery` orchestrator + executeIntent dispatcher (15 cases wire to existing Phase 2A analysis_*.py). |
| Day 6 | Port `SmartBIPromptService` + `SmartBIIntentMapper`. Wire LLM fallback. Implement dict-sync deploy step. |
| Day 7 | Run dict-eq parity tests on 30+ golden corpus. Fix divergences. Reach ≥ 99.5% match rate. Spec sign-off + PR. |

**Buffer**: +2d for unforeseen Pattern A/A2/8/9/10/11/12 surfaces caught by audit cycle 1-2. **Total committed: 9d.**

---

## §10 Risk Register

12 risks (extending PR #196's R1-R12):

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Database `ai_intent_configs` schema drift between when spec written and impl day → recognizer init crashes | MED | Phase B Day 0: `psql -c "\d ai_intent_configs"` to confirm columns. If drifted, file P0 doc fix. |
| R2 | Trie Python implementation slower than Java due to dict overhead → /query p99 > 500ms gate | MED | Use `__slots__` on TrieNode; benchmark 1M-char text < 50ms before Day 4. If slower, switch to `pyahocorasick` library (Aho-Corasick automaton, C extension). |
| R3 | Java `Pattern.matches()` is full-string match, Python `re.fullmatch` semantics — must use `fullmatch` not `search` | LOW | Code review check: every regex `pattern.matcher(q).matches()` → Python `pattern.fullmatch(q)`. |
| R4 | LLM fallback diverges (LLM non-deterministic) → dict-eq fails | HIGH | Mock LLM in test environment. Goldens recorded with LLM disabled (rule engine only). Document this exclusion in `assert_response_eq` skip list. |
| R5 | Conversation memory (D3) skipped → multi-turn queries fail | LOW | Out of scope. Document. T6.6 single-turn parity only. |
| R6 | Restaurant route (D1) skipped → restaurant queries 404 from Python | MED | Nginx regex routes RESTAURANT_* keywords back to Java. Verify with T6.5 lead (Q-A). |
| R7 | Dict JSON sync drift (α option) → Java edits dict, Python doesn't see | MED | Deploy contract: ANY edit to `resources/config/smartbi/*.json` requires `deploy-smartbi-python.sh` re-run. Add CI check: lint commit messages for "dict edit" tag. |
| R8 | Jackson INDENT_OUTPUT byte parity in prompts (§5.5) | MED | Custom `_jackson_indent_compat` helper + unit test against golden Java output. +2h Day 6. |
| R9 | TimeEntityRecognizer Phase 2 regex order matters; reordering breaks parity | LOW | Spec §3.2 documents exact order. Phase B impl chat regex unit test enforces order. |
| R10 | `parameters` HashMap iteration order non-deterministic in Java → goldens flaky | MED | Record multiple goldens, dict-eq compares values not key order. Pydantic `model_dump()` produces stable Python dict order. Acceptable. |
| R11 | Existing `query_intent_extractor.py` confused with Phase B's new full intent service → wrong import in caller | MED | New file: `backend/python/smartbi/services/intent/intent_recognizer.py`. Existing kept as-is (different consumer = AIQuery template router). Document in module docstrings. |
| R12 | TZ mismatch (§8.2) causes "今天" date drift | HIGH | Phase B Day 0: confirm Python systemd unit has `Environment=TZ=Asia/Shanghai`. Add unit test asserting `today() == java today()` in CI. |

**Top-3 by impact**:
1. **R4** (LLM non-determinism) — hardest to mitigate; LLM fallback path effectively must be excluded from byte-shape gate or mocked.
2. **R12** (TZ) — easy mitigation but high impact if missed.
3. **R8** (Jackson INDENT_OUTPUT in prompts) — subtle, requires explicit helper + test.

---

## §11 Open Questions

10 questions for Phase B kickoff (extends PR #196's 10):

- **Q-A** [Steve / T6.5 lead]: Can T6.6 nginx regex dispatch restaurant-keyword queries (`餐饮` / `菜品` / `服务员` / etc) BACK to Java `/query` while routing all else to Python? This implements the §8.7 split. **If no**, Phase B must port `tryRouteRestaurantDiagnostic` + `IntentExecutorService` shim — adds ~3d.

- **Q-B** [Steve]: When `executeIntent` hits `default:` (unmatched intent), Java falls through to Tool-Skill `IntentExecutorService.execute()`. Python doesn't have this. Phase B mirrors as direct 400 error. **OK?** Or wait until T6.5's IntentExecutorService is Python-ported? (Latter pushes T6.6 to ~Sep 2026.)

- **Q-C** [Phase 2A LLM fallback owner]: Confirm Python's `LlmFallbackClient` equivalent in `smartbi/services/intent/` already supports SmartBI-flagged config filter (i.e. `WHERE intent_category = 'SMARTBI'` query against `ai_intent_configs`). If not, +0.5d.

- **Q-D** [Steve]: D3 — `ConversationMemoryService.resolveReference` skipped → multi-turn 指代消解 doesn't work in Python `/query`. **Are real customers using multi-turn 指代消解 in production?** If yes, T6.6 cutover blocks until Python port (separate ticket, ~3-5d). If no, accept gap.

- **Q-E** [Phase B impl chat]: Choose dict-sync approach (§3.3): α (deploy copy, default), β (HTTP fetch), γ (DB-only refactor). **Recommend α**; impl chat may revisit.

- **Q-F** [Phase B impl chat]: Trie performance — accept Pure-Python implementation, or pre-empt with `pyahocorasick`? Benchmark Day 0 to decide.

- **Q-G** [Phase B impl chat]: For `parameters` HashMap key order (§7.4 Rule 8), confirm via 5 random F999 query reps that Java's HashMap iteration is stable per query (i.e. same query = same key order). If unstable, dict-eq is fine; if 2+ orderings observed, add dict-eq tolerance docstring.

- **Q-H** [Steve]: Confirm Phase B kickoff timing — earliest after T6.5 Phase B+C complete + 30-day soak, i.e. ~Aug 2026. Phase 2A spec signed off this estimate; T6.5 progress may shift.

- **Q-I** [Phase B impl chat]: Should `SmartBIIntent` enum live in `smartbi/services/intent/models.py` (same module as DTOs) or own `smartbi/services/intent/intents.py`? Recommend latter for clarity.

- **Q-J** [Phase B impl chat]: F999 (sandbox) vs F001 (real prod factory) golden split — what % of cases need F001 (entity-boost requires real region/department data)? Estimate 8/30 cases need F001; 22/30 OK with F999. Confirm during Day 1 recording.

---

## Appendix A — Quick Reference: Files

### Java sources to read

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├─ controller/SmartBIAnalysisController.java:491-510   (POST /query route)
├─ controller/SmartBIPublicDemoController.java:43-58   (demo /query)
├─ service/smartbi/impl/SmartBIServiceImpl.java
│  ├─ L621-695: processQuery
│  ├─ L726-866: tryRouteRestaurantDiagnostic + mapIntentExecuteResponse
│  ├─ L881-941: resolveQueryReferences + tryLLMFallback
│  ├─ L985-1014: convertToIntentConfigs + convertToSmartBIIntentResult
│  ├─ L1552-1634: executeIntent (15 cases + P6 fallback)
│  ├─ L1636-1720: handleForecastIntent + handlePeriodComparison + handleDeptComparison + handleRegionComparison
│  ├─ L1751-...: generateLLMResponseText
│  └─ L1816+ / L1894+: generateResponseText (template) + generateChartConfig + generateFollowUpQuestions
├─ service/smartbi/impl/SmartBIIntentServiceImpl.java (1338 LOC)
│  ├─ L600-722: recognizeIntent + extractParameters + parseTimeRange + parseDimension
│  ├─ L1222-1315: boostIntentByEntityDetection + boostRegionAnalysisIntent + boostDeptIntent
│  └─ L1320-1337: calculateKeywordConfidence
├─ service/smartbi/impl/SmartBIPromptServiceImpl.java (720 LOC)
├─ service/smartbi/SmartBIIntentService.java (interface, 230 LOC)
├─ service/smartbi/SmartBIIntentMapper.java (180 LOC)
├─ service/smartbi/BaseEntityRecognizer.java (478 LOC)
├─ service/smartbi/RegionEntityRecognizer.java (522 LOC)
├─ service/smartbi/TimeEntityRecognizer.java (754 LOC)
├─ service/smartbi/DepartmentEntityRecognizer.java (~600 LOC)
├─ service/smartbi/MetricEntityRecognizer.java (~500 LOC)
├─ service/smartbi/DimensionEntityRecognizer.java (~550 LOC)
├─ entity/smartbi/enums/SmartBIIntent.java (358 LOC, 30+ enum values)
├─ dto/smartbi/IntentResult.java (297 LOC)
├─ dto/smartbi/NLQueryRequest.java (82 LOC)
├─ dto/smartbi/NLQueryResponse.java (197 LOC)
└─ dto/smartbi/DateRange.java (existing in smartbi_compat)

resources/
├─ config/smartbi/region_dictionary.json
├─ config/smartbi/department_dictionary.json
├─ config/smartbi/metric_dictionary.json
├─ config/smartbi/time_dictionary.json
├─ config/smartbi/dimension_dictionary.json
├─ config/smartbi/intent_patterns.json
├─ prompts/smartbi/overview_analysis.md
├─ prompts/smartbi/sales_analysis.md
├─ prompts/smartbi/department_analysis.md
├─ prompts/smartbi/region_analysis.md
├─ prompts/smartbi/finance_analysis.md
└─ prompts/smartbi/qa_general.md
```

### Python files Phase B will create

```
backend/python/smartbi/services/intent/
├─ __init__.py                              (existing — module marker)
├─ query_intent_extractor.py                (existing — KEEP, narrow-scope for AIQuery template router)
├─ intent_recognizer.py                     (NEW — full SmartBIIntentServiceImpl Python equiv)
├─ intents.py                               (NEW — SmartBIIntent StrEnum + display names + categories)
├─ models.py                                (NEW — IntentResult / NLQueryRequest / NLQueryResponse Pydantic)
├─ intent_mapper.py                         (NEW — SmartBIIntentMapper Python equiv)
├─ prompt_service.py                        (NEW — SmartBIPromptService Python equiv)
├─ recognizers/
│  ├─ __init__.py
│  ├─ _base_recognizer.py                   (NEW — BaseEntityRecognizer Trie)
│  ├─ region_recognizer.py                  (NEW)
│  ├─ time_recognizer.py                    (NEW)
│  ├─ department_recognizer.py              (NEW)
│  ├─ metric_recognizer.py                  (NEW)
│  └─ dimension_recognizer.py               (NEW)
├─ data/                                    (NEW — synced from Java resources at deploy)
│  ├─ region_dictionary.json
│  ├─ department_dictionary.json
│  ├─ metric_dictionary.json
│  ├─ time_dictionary.json
│  ├─ dimension_dictionary.json
│  └─ intent_patterns.json
└─ prompts/smartbi/                          (NEW — synced)
   ├─ overview_analysis.md
   ├─ sales_analysis.md
   ├─ department_analysis.md
   ├─ region_analysis.md
   ├─ finance_analysis.md
   └─ qa_general.md

backend/python/smartbi_compat/api/
├─ query.py                                  (NEW — POST /api/smartbi/query route + processQuery orchestrator)
└─ public_demo_query.py                      (NEW — POST /api/smartbi/public-demo/query)

backend/python/tests/smartbi/
├─ test_query_parity.py                      (NEW — 30+ dict-eq cases)
├─ test_intent_recognizer.py                 (NEW — unit tests for rule engine)
├─ test_recognizers.py                       (NEW — Trie + recognize tests)
├─ test_prompt_service.py                    (NEW — placeholder substitution + Jackson INDENT_OUTPUT parity)
└─ fixtures/java-smartbi-golden/
   ├─ query-F999-sales-overview-thismonth.json
   └─ ... 30 more
```

---

## Appendix B — Phase B Sign-off Checklist

Before Phase B impl chat starts:

- [ ] Q-A answered (nginx restaurant route gating)
- [ ] Q-B answered (Tool-Skill fallback path)
- [ ] Q-D answered (multi-turn 指代消解 customer impact)
- [ ] Q-H answered (timing — confirm post-T6.5+30d)
- [ ] T6.5 Phase B + C status: complete + ≥30d soaked
- [ ] T6.6 nginx routing decision documented (which prefixes → Python `/query`)
- [ ] Phase B impl chat assigned + has compute budget for 9-day work window

---

## Appendix C — What This Spec Does NOT Cover

- Implementation details inside individual `analysis_*.py` Phase 2A modules — already shipped, refer to those PRs.
- LLM provider switch / DashScope API contract — out of scope; existing Phase 2A LLM client used as-is.
- Tool-Skill `IntentExecutorService` Python port — owned by T6.5 Phase B+C; T6.6 prereq.
- Web-admin / RN frontend changes — none required (response shape unchanged from Java).
- Conversation memory port — out of scope per D3 / Q-D.
- Restaurant Tool-Skill port — out of scope per D1 / Q-A.
- Strict-byte gate — out of scope; T6.6 inherits Phase 2A dict-eq gate.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
