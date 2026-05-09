# T6.6 Phase A — Python Intent Service Equivalent Design + 4 Endpoint Port Architecture

**Phase**: T6.6 Phase A (design only, NOT execution)
**Status**: Design doc / planning artifact only — execution blocked until T6.5 Phase B + C complete (~July 2026)
**Author**: Chat D (T6.6 Phase A design dispatch, 2026-05-09)
**Predecessor**: PR #180 T6.6 spec (`docs/superpowers/specs/2026-05-09-t6-6-f999-python-migration-spec.md`)
**Successor**: T6.6 Phase B impl marching orders (4 sister chats parallel)

---

## 0. TL;DR

PR #180 §3.1 calls T6.6 Phase A **the blocker** for Phase B parallelization: `/query` port is genuinely-new Python work because the existing `backend/python/classifier/` (BERT) + `backend/python/smartbi/services/intent/query_intent_extractor.py` (regex N/frequency/role) **do not collectively cover** the Java 5-EntityRecognizer + 30+-intent rule engine.

This Phase A design doc resolves that blocker by:

1. **Inventorying Java intent service surface** (§1) — 30 SmartBIIntent enum values + 5 EntityRecognizer + SmartBIIntentMapper + SmartBIPromptService + 6 classpath dictionary JSONs.
2. **Recommending Approach A (rule-engine 1:1 port)** for `/query` (§2) over Approach B (classifier-only) or Approach C (hybrid). Rationale: Phase 2A dict-eq parity standard requires identical `intent`/`parameters`/`responseText` shape; BERT classifier outputs (label IDs, probabilities) diverge non-deterministically from rule-engine outputs.
3. **Spec drift caught: Production / Quality services are MOCK DATA** (§3) — `ProductionAnalysisServiceImpl` has 9 calls to `generateMockProductionData()`, `QualityAnalysisServiceImpl` has 10 calls to `generateMockQualityData()`. Port becomes mechanical mirror of mock generators, NOT real-DB query like Phase 2A `analysis_finance.py`. This shrinks Phase B `/analysis/production` + `/analysis/quality` effort from "2-3 person-days each (mirror finance pattern)" to "1.5-2 person-days each (mirror mock generator pattern + 1 golden)".
4. **Spec drift caught: `/query` dispatch is two paths, not one** (§3.3) — `SmartBIAnalysisController.nlQuery` first tries `smartBIService.processQuery(...)` (production path), only falls back to `intentService.recognizeIntent + executeQueryByIntent` if `smartBIService == null`. Phase B `/query` impl must trace `SmartBIServiceImpl.processQuery` (line ~600+) to understand the actual byte shape, NOT just port the recognizeIntent path.
5. **Phase B PR plan** (§6): 4 endpoints in 4 parallel sister chats; Phase A owner (Chat D / continuity) takes `/query`; smallest endpoint `/drill-down` parity verify can absorb organizer-side nginx work.

**4 endpoint effort revision** (vs PR #180 §2 estimates):

| Endpoint | PR #180 estimate | Revised post-discovery | Reason |
|---|---|---|---|
| `/analysis/production` | 2-3d | **1.5-2d** | Mock data generator mirror, no DB |
| `/analysis/quality` | 2-3d | **1.5-2d** | Mock data generator mirror, no DB |
| `/query` | 5-7d | **5-7d** (unchanged) | Rule engine + 5 recognizers + 6 dicts |
| `/drill-down` parity verify | 1-2d | **0.5-1d** | Python file exists; just record golden + diff + nginx |
| **Total Phase B** | **10-15d** | **8.5-12d** | Phase A discovery shrinks 2 of 4 |

**GO criteria for Phase A → Phase B kickoff**: this design doc reviewed (organizer + chat 3 Phase 2A intent owner), Python `/query` prototype hits ≥80% of F999/F001 representative golden queries.

---

## 1. Java Intent Service Inventory (Current State)

### 1.1 Surface area summary

| Component | File | LOC | Role |
|---|---|---|---|
| `SmartBIIntentService` interface | `service/smartbi/SmartBIIntentService.java` | 230 | API contract |
| `SmartBIIntentServiceImpl` | `service/smartbi/impl/SmartBIIntentServiceImpl.java` | 1338 | Rule engine: keyword + regex + entity boost + parameter extraction |
| `BaseEntityRecognizer<E,N>` | `service/smartbi/BaseEntityRecognizer.java` | 477 | Abstract Trie-tree base (O(n) longest-match) |
| `RegionEntityRecognizer` | `service/smartbi/RegionEntityRecognizer.java` | 522 | 7 大区 + 34 省/直辖市 + 主要城市 + 别名 + 后缀处理 |
| `DepartmentEntityRecognizer` | `service/smartbi/DepartmentEntityRecognizer.java` | ~400 | 部门名称 + 别名 |
| `MetricEntityRecognizer` | `service/smartbi/MetricEntityRecognizer.java` | ~400 | 指标名称 + 别名 |
| `TimeEntityRecognizer` | `service/smartbi/TimeEntityRecognizer.java` | 754 | Trie + 7 regex 动态模式 + 季度/绝对日期/ISO/相对日期 |
| `DimensionEntityRecognizer` | `service/smartbi/DimensionEntityRecognizer.java` | ~400 | 维度模式 (按部门/按区域/按产品/按人员/按时间) |
| `SmartBIIntentMapper` | `service/smartbi/SmartBIIntentMapper.java` | 180 | Bridge to AI Chat IntentMatchResult system |
| `SmartBIPromptService` interface | `service/smartbi/SmartBIPromptService.java` | ~80 | Prompt template API |
| `SmartBIPromptServiceImpl` | `service/smartbi/impl/SmartBIPromptServiceImpl.java` | 720 | LLM prompt builder using `.md` templates + `{{var}}` substitution |
| `SmartBIIntent` enum | `entity/smartbi/enums/SmartBIIntent.java` | 359 | 30 intent types + 5 categories |
| `IntentResult` DTO | `dto/smartbi/IntentResult.java` | ~150 | Output: intent / confidence / candidates / params / timeRange / dimension / entities |
| **Total Java** | | **~5500 LOC** | |

### 1.2 Classpath dictionary JSONs (`config/smartbi/`)

| File | Schema |
|---|---|
| `intent_patterns.json` | `{intent_code: {keywords[], patterns[], required_params[], optional_params[], weight}}` |
| `region_dictionary.json` | `{suffixes[], regions{name: {aliases[], provinces[]}}, provinces{name: {region, aliases[], cities[]}}, majorCities[]}` |
| `time_dictionary.json` | `{relativeTime{TYPE: {patterns[], description}}, quarters{Q1: [...]}, dynamicPatterns{NAME: regex}}` |
| `metric_dictionary.json` | Similar to region |
| `department_dictionary.json` | Similar to region |
| `dimension_dictionary.json` | Similar to region |
| `alert_thresholds.json` | (Used by `AlertThresholdService`, NOT intent-related — out-of-scope for T6.6) |

**Phase B port strategy**: copy these JSONs verbatim into `backend/python/smartbi_compat/intent/dictionaries/` (or symlink — but symlinks brittle on Windows dev). Single source of truth = Java classpath, Python loads at startup.

### 1.3 SmartBIIntentServiceImpl.recognizeIntent flow (rule engine)

```
Input: userQuery (Chinese NL string)
  ↓
Step 1. normalizeQuery: lowercase + strip whitespace + strip punctuation
  ↓
Step 2. Keyword matching loop over intentKeywords map (30 intents × ~15 keywords each)
        → for each intent, count matched keywords → calculateKeywordConfidence()
        → calculate base score (matched / min(total,5)) + coverage bonus + exact match bonus
  ↓
Step 3. Regex pattern matching loop over intentPatterns map
        → for each intent, if any pattern matches, +0.2 confidence (or new candidate at 0.75)
  ↓
Step 4. Entity-aware boost (boostIntentByEntityDetection)
        → run RegionEntityRecognizer + DepartmentEntityRecognizer + MetricEntityRecognizer
        → if region+sales-keyword: boost QUERY_REGION_ANALYSIS by min(0.2 + 0.1*N, 0.4)
        → if department+sales-keyword: boost QUERY_DEPARTMENT_PERFORMANCE similarly
  ↓
Step 5. Sort candidates by confidence DESC
  ↓
Step 6. extractParameters(intent): metric/topN/sortOrder/aggregation/compareType
  ↓
Step 7. parseTimeRange: TimeEntityRecognizer.recognizeFirst → DateRange (or fallback to TIME_PATTERNS)
  ↓
Step 8. parseDimension: DimensionEntityRecognizer.parsePrimaryDimension → "department"|"region"|"product"|"person"|"time"
  ↓
Step 9. parseAllEntitiesAsList: flatten all 5 entity types
  ↓
Step 10. needsLLMFallback: confidence < 0.7 OR intent == UNKNOWN OR ambiguous (top2 within 0.1)
  ↓
Output: IntentResult {intent, confidence, originalQuery, matchedKeywords, matchMethod, candidates,
                       parameters, timeRange, dimension, entities, processingTimeMs, needsLLMFallback}
```

### 1.4 LLM fallback path

When `needsLLMFallback == true`, dispatcher (`SmartBIServiceImpl.processQuery`) calls `LlmIntentFallbackClient` with `intentService.convertToIntentConfigs(allIntents)` for prompt context. LLM result is mapped back via `SmartBIIntentMapper.convertToSmartBIIntentResult`. **Phase B `/query` Python port MUST handle this fallback path** — otherwise low-confidence queries silently degrade.

---

## 2. Python Equivalent Design

### 2.1 Decision matrix: Approach A vs B vs C

| Approach | Description | Parity | Effort | Maintainability |
|---|---|---|---|---|
| **A. Port rule engine 1:1** | Translate Java keyword+regex+Trie+dictionary verbatim into Python | **HIGH** (deterministic mirror) | ~5-7d | MED (locked to Java config) |
| **B. Leverage existing BERT classifier** | Use `classifier/intent_classifier.py` for intent classification + write new entity extractors | LOW (BERT outputs label IDs + probs that diverge non-determinstically from rule engine) | ~3-5d | HIGH |
| **C. Hybrid** | Rule engine fast path (Approach A) + BERT classifier as fallback (vs current LLM fallback) | HIGH for fast path, MED for fallback | ~6-9d | LOW (two systems) |

**Recommendation**: **Approach A** (rule engine 1:1).

**Why**:
- Phase 2A dict-eq gate compares `intent` enum value + `parameters` dict + `responseText` string. Approach B's BERT outputs `label_id: int` + `confidence: float` that map to enum codes via `id_to_label` mapping — but the BERT model and Java rule engine were trained / tuned independently, so the classification outcomes diverge. dict-eq fails.
- Approach C maintains both systems. Higher complexity, higher bug surface. Defer hybrid to Phase 3+ if rule engine accuracy proves insufficient post-T6.6.
- Approach A is "boring tech" — translate Java map-of-keywords + map-of-patterns + Trie + JSON dicts to Python equivalents. Each piece is mechanical. The only conceptual challenge is faithfully replicating `BaseEntityRecognizer.recognize()` (longest-match Trie scan), which is a 50-line algorithm.

### 2.2 Proposed Python module layout

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis_query.py          # NEW (Phase B): /query endpoint route
│   ├── analysis_production.py     # NEW (Phase B): /analysis/production
│   ├── analysis_quality.py        # NEW (Phase B): /analysis/quality
│   └── analysis_drilldown.py      # EXISTS: /drill-down (Phase B = nginx route only)
└── intent/                        # NEW: Phase A → Phase B foundation
    ├── __init__.py
    ├── intent_enum.py             # Mirror SmartBIIntent enum (30 values + category)
    ├── intent_result.py           # Mirror IntentResult dataclass
    ├── recognizer_base.py         # Mirror BaseEntityRecognizer (Trie + dictionary loader)
    ├── recognizer_region.py       # Mirror RegionEntityRecognizer
    ├── recognizer_department.py   # Mirror DepartmentEntityRecognizer
    ├── recognizer_metric.py       # Mirror MetricEntityRecognizer
    ├── recognizer_time.py         # Mirror TimeEntityRecognizer (Trie + 7 regex)
    ├── recognizer_dimension.py    # Mirror DimensionEntityRecognizer
    ├── intent_service.py          # Mirror SmartBIIntentServiceImpl (rule engine top-level)
    ├── intent_mapper.py           # Mirror SmartBIIntentMapper (LLM fallback bridge)
    ├── prompt_service.py          # Mirror SmartBIPromptServiceImpl (template loader)
    ├── llm_fallback.py            # Mirror LlmIntentFallbackClient (DashScope qwen call)
    └── dictionaries/              # Copies of Java classpath JSONs
        ├── intent_patterns.json
        ├── region_dictionary.json
        ├── time_dictionary.json
        ├── metric_dictionary.json
        ├── department_dictionary.json
        └── dimension_dictionary.json
```

**Estimated Phase A foundation LOC**: ~2500 Python (vs ~5500 Java; Python typically 2x denser).

### 2.3 Trie implementation (mirror `BaseEntityRecognizer`)

```python
# backend/python/smartbi_compat/intent/recognizer_base.py
from dataclasses import dataclass, field
from typing import Optional, Generic, TypeVar

E = TypeVar("E")  # Entity type (RegionEntity / TimeEntity / etc.)


@dataclass
class TrieNode:
    """Mirror BaseTrieNode (Java line 49-77)."""
    children: dict[str, "TrieNode"] = field(default_factory=dict)
    is_end: bool = False
    is_alias: bool = False
    alias_text: Optional[str] = None
    normalized_name: Optional[str] = None


class BaseEntityRecognizer(Generic[E]):
    """Mirror Java abstract BaseEntityRecognizer<E,N>.

    Subclasses override:
    - _create_node(): construct subclass-specific node (extends TrieNode)
    - _create_entity(matched_text, node, start, end): build domain entity
    - _init_default_dictionary(): seed default Trie when JSON file missing
    - _process_dictionary_data(parsed_json): load from JSON
    - _entity_start_index(entity): for sorting
    """

    def __init__(self, dictionary_file: str):
        self.dictionary_file = dictionary_file
        self.root = self._create_node()
        self.total_recognitions = 0
        self.entities_found = 0
        self._init()

    def _init(self):
        # Mirror Java @PostConstruct init():
        self._load_dictionary()  # tries dictionary_file, falls back to _init_default_dictionary
        # Database loading deferred to T6.5 Phase D method-level audit (out of T6.6 scope)

    def recognize(self, text: str) -> list[E]:
        """Longest-match Trie scan. O(n*L) where L = max term length.

        Mirror Java BaseEntityRecognizer.recognize (line 329-376).
        """
        if not text:
            return []
        self.total_recognitions += 1
        entities: list[E] = []
        text_len = len(text)
        i = 0
        while i < text_len:
            current = self.root
            j = i
            last_match: Optional[TrieNode] = None
            last_match_end = i
            # Walk Trie greedy
            while j < text_len and text[j] in current.children:
                current = current.children[text[j]]
                j += 1
                if current.is_end:
                    last_match = current
                    last_match_end = j
            if last_match is not None:
                matched_text = text[i:last_match_end]
                entity = self._create_entity(matched_text, last_match, i, last_match_end)
                if entity is not None:
                    entities.append(entity)
                    self.entities_found += 1
                i = last_match_end  # skip past match (no overlapping)
            else:
                i += 1  # advance one char
        # Sort by start index (mirror Java `entities.sort(Comparator.comparingInt(...)))`)
        entities.sort(key=self._entity_start_index)
        return entities

    def _add_to_trie(self, term: str, configurer):
        """Mirror addToTrie (Java line 279-300).

        configurer: callable(node) -> None that sets domain-specific fields.
        """
        if not term:
            return
        current = self.root
        for c in term:
            if c not in current.children:
                current.children[c] = self._create_node()
            current = current.children[c]
        # Only configure if not already set, OR if upgrading alias→non-alias
        if not current.is_end or (current.is_alias and configurer):
            current.is_end = True
            if configurer:
                configurer(current)
```

**Subclass example** (`recognizer_region.py`):

```python
@dataclass
class RegionTrieNode(TrieNode):
    region_type: Optional[str] = None  # "REGION" | "PROVINCE" | "CITY"
    parent_region: Optional[str] = None


@dataclass
class RegionEntity:
    text: str
    type: str
    normalized_name: str
    parent_region: Optional[str]
    start_index: int
    end_index: int
    matched_by_alias: bool = False
    matched_alias: Optional[str] = None
    confidence: float = 1.0


class RegionEntityRecognizer(BaseEntityRecognizer[RegionEntity]):
    def _create_node(self) -> RegionTrieNode:
        return RegionTrieNode()

    def _create_entity(self, matched_text, node, start, end) -> RegionEntity:
        return RegionEntity(
            text=matched_text,
            type=node.region_type,
            normalized_name=node.normalized_name,
            parent_region=node.parent_region,
            start_index=start, end_index=end,
            matched_by_alias=node.is_alias,
            matched_alias=node.alias_text,
            confidence=0.9 if node.is_alias else 1.0,
        )

    def _init_default_dictionary(self):
        # Mirror Java initDefaultDictionary (line 217-277).
        # Bake 7 大区 + 34 province + 14 default cities here.
        ...
```

### 2.4 Time recognizer (most complex — Trie + regex)

`TimeEntityRecognizer` overrides `recognize()` with a 2-phase approach:
1. Trie matching for fixed patterns (今天/昨天/本周/etc + Q1-Q4 quarters)
2. Regex matching for dynamic patterns (`最近(\d+)天`, `(\d{4})年(\d{1,2})月(\d{1,2})日`, ISO `(\d{4})-(\d{1,2})-(\d{1,2})`)

Python port follows same 2-phase shape:

```python
class TimeEntityRecognizer(BaseEntityRecognizer[TimeEntity]):
    DYNAMIC_PATTERNS = {
        "LAST_N_DAYS":     re.compile(r"最近(\d+)天|过去(\d+)天|近(\d+)天"),
        "LAST_N_WEEKS":    re.compile(r"最近(\d+)周|过去(\d+)周|近(\d+)周"),
        "LAST_N_MONTHS":   re.compile(r"最近(\d+)个?月|过去(\d+)个?月|近(\d+)个?月"),
        "ABSOLUTE_DATE":   re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日?"),
        "ABSOLUTE_MONTH":  re.compile(r"(\d{4})年(\d{1,2})月"),
        "ABSOLUTE_YEAR":   re.compile(r"(\d{4})年"),
        "ISO_DATE":        re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})"),
    }

    def recognize(self, text: str) -> list[TimeEntity]:
        # Phase 1: Trie
        trie_matches = super().recognize(text)
        # Phase 2: Regex, deduplicate non-overlapping
        regex_matches = self._recognize_by_regex(text)
        for rm in regex_matches:
            if not self._overlaps_any(rm, trie_matches):
                trie_matches.append(rm)
        trie_matches.sort(key=lambda e: e.start_index)
        return trie_matches
```

**Critical Rule 11 (`python-java-port.md`) compliance**: time entity → DateRange → JSON output must use `_java_isoformat()` for any LocalDateTime mirror to drop trailing-zero microseconds. If `parseTimeRange` is called, return values are date-typed (no time component), so Rule 11 does not bite — but spec doc must explicitly note this.

### 2.5 Confidence calculation parity

`SmartBIIntentServiceImpl.calculateKeywordConfidence` (Java line 1320-1337):

```java
double baseScore = Math.min((double) matchedKeywords.size() / Math.min(totalKeywords, 5), 1.0);
int totalMatchLength = matchedKeywords.stream().mapToInt(String::length).sum();
double coverageBonus = Math.min((double) totalMatchLength / query.length(), 0.3);
double exactMatchBonus = matchedKeywords.stream().anyMatch(kw -> kw.length() >= 4) ? 0.1 : 0.0;
return Math.min(baseScore + coverageBonus + exactMatchBonus, 1.0);
```

Python port (mirror exactly):

```python
def _calculate_keyword_confidence(matched_keywords: list[str], total_keywords: int, query: str) -> float:
    if not matched_keywords:
        return 0.0
    base_score = min(len(matched_keywords) / min(total_keywords, 5), 1.0)
    total_match_length = sum(len(kw) for kw in matched_keywords)
    coverage_bonus = min(total_match_length / len(query), 0.3)
    exact_match_bonus = 0.1 if any(len(kw) >= 4 for kw in matched_keywords) else 0.0
    return min(base_score + coverage_bonus + exact_match_bonus, 1.0)
```

**Rule 12 risk**: this returns `float`. dict-eq tolerates float comparison; strict-byte gate would force `Decimal.quantize(scale, ROUND_HALF_UP)`. Phase 2A dict-eq applies — float OK.

### 2.6 LLM fallback design

`LlmIntentFallbackClient` (Java) calls DashScope qwen with a structured prompt asking for top-K intent codes. Python equivalent: reuse existing `dashscope` SDK call pattern from `backend/python/smartbi/agent/orchestrator.py`. Mirror prompt template **verbatim** to keep LLM output shape stable.

Because LLM responses are non-deterministic, dict-eq parity for low-confidence queries is **best-effort**. Java path produces same non-deterministic LLM output, so dict-eq comparison on a fresh request will likely diverge. This is **expected behavior** per Phase 2A `python-java-port.md` Rule 4 dict-eq gate (LLM output is in the same "non-byte-strict" bucket as Decimal serialization).

**Recommend**: Phase B `/query` test golden suite **uses high-confidence queries** (confidence ≥ 0.7) only. Don't golden-test LLM fallback path.

---

## 3. 4 Endpoint Port Plan

### 3.1 `/analysis/production` (revised effort: 1.5-2d, was 2-3d)

**Spec drift caught**: `ProductionAnalysisServiceImpl` 9/9 entry points call `generateMockProductionData(factoryId, startDate, endDate)`. NO real DB query. Mock generator produces deterministic-by-factoryId data (need to verify seed behavior in Phase B).

**Java source (controller dispatch — line 334-364)**:

```java
@GetMapping("/analysis/production")
public ResponseEntity<...> getProductionAnalysis(factoryId, startDate, endDate, analysisType) {
    Map<String, Object> result = new HashMap<>();
    result.put("startDate", startDate);
    result.put("endDate", endDate);
    if ("oee".equals(analysisType)) {
        result.put("metrics", productionAnalysisService.getOEEMetrics(...));
        result.put("trendChart", productionAnalysisService.getOEETrendChart(..., "DAY"));
    } else if ("efficiency".equals(analysisType)) {
        result.put("metrics", productionAnalysisService.getProductionEfficiency(...));
        result.put("ranking", productionAnalysisService.getProductionLineRanking(...));
    } else if ("equipment".equals(analysisType)) {
        result.put("metrics", productionAnalysisService.getEquipmentUtilization(...));
        result.put("ranking", productionAnalysisService.getEquipmentRanking(...));
        result.put("downtimeChart", productionAnalysisService.getDowntimeDistributionChart(...));
    } else {  // default = overview
        result.put("overview", productionAnalysisService.getOEEOverview(...));
    }
    return ApiResponse.success(result);
}
```

**Python target** (`backend/python/smartbi_compat/api/analysis_production.py`):

- Mirror the 4-branch dispatcher
- Mirror `generateMockProductionData` deterministic generator (verify seed reproducibility — `Random(factoryId.hashCode())` or similar — Phase B Task 0)
- Mirror 4 sub-method outputs (`getOEEOverview`, `getOEEMetrics`, `getProductionEfficiency`, etc.)
- Apply Rules 4 / 8 / 9 / 11 / 12 per `python-java-port.md`
- Goldens: `analysis-production-F999-oee.json` + `-efficiency.json` + `-equipment.json` + `-default.json` (4 per factory × 2 factories = 8 goldens)

**OEE thresholds** to mirror exactly (Java line 56-70):
- OEE: RED < 65, YELLOW < 85, GREEN >= 85
- Availability: RED < 80, YELLOW < 90
- Performance: RED < 75, YELLOW < 90
- Quality: RED < 95, YELLOW < 98
- All thresholds are integers → Rule 7 compliant via `float()` (no Decimal needed)

### 3.2 `/analysis/quality` (revised effort: 1.5-2d, was 2-3d)

Same pattern as §3.1. `QualityAnalysisServiceImpl` 10/10 entry points call `generateMockQualityData(factoryId, startDate, endDate)`. NO real DB.

Controller dispatch (line 373-403): 4 branches `fpy` / `defect` / `rework` / default (summary).

**FPY thresholds** (Java line 58-71):
- FPY: RED < 95, YELLOW < 98
- Defect rate: RED > 5, YELLOW > 2
- Quality cost rate: RED > 3, YELLOW > 1.5  ← Rule 7 risk: 1.5 is non-integer. Phase B reviewer must use `Decimal("1.5")` comparison.
- Rework rate: RED > 20, YELLOW > 10

**Phase B reviewer specifically check**: `QUALITY_COST_YELLOW_THRESHOLD = new BigDecimal("1.5")` is non-integer → Python must use `Decimal("1.5")` comparison NOT `float(1.5) < threshold` (Rule 7 hard).

### 3.3 `/query` (effort unchanged: 5-7d)

**Spec drift caught**: 2 dispatch paths in controller (line 491-528).

```java
@PostMapping("/query")
public ResponseEntity<...> query(factoryId, NLQueryRequest request) {
    if (smartBIService != null) {                          // PATH 1 (production)
        NLQueryResponse response = smartBIService.processQuery(factoryId, null, request);
        return ApiResponse.success(response);
    }
    // PATH 2 (fallback, smartBIService == null) — basic recognizeIntent + executeQueryByIntent
    IntentResult intentResult = intentService.recognizeIntent(query, context);
    NLQueryResponse response = NLQueryResponse.builder()
        .intent(intentResult.getIntent().name())
        .parameters(intentResult.getParameters())
        .build();
    response.setResponseText(executeQueryByIntent(...));
    response.setFollowUpQuestions(generateFollowUpQuestions(intentResult));
    return ApiResponse.success(response);
}
```

**Phase B impl chat must trace `SmartBIServiceImpl.processQuery`** before writing Python equivalent. The `executeQueryByIntent` fallback path is shorter / different shape — porting that alone produces wrong byte shape.

**Phase A discovery TODO (deferred to Phase B kickoff)**: `find smartBIServiceImpl.processQuery` is in `service/smartbi/impl/SmartBIServiceImpl.java` (verified via grep, exists). Trace its dispatch pattern: it likely routes by intent enum to one of the 9 existing analysis services (sales / department / region / finance / inventory / procurement / production / quality / drilldown).

**`/query` golden recording strategy** (≥10 representative queries × 2 factories = ≥20 goldens):

| # | Query | Expected intent | Expected params | Tests |
|---|---|---|---|---|
| 1 | "本月销售情况" | QUERY_SALES_OVERVIEW | timeRange=THIS_MONTH | Trie + keyword + time recognizer |
| 2 | "销售排名 TOP 10" | QUERY_SALES_RANKING | topN=10 | regex + parameter extraction |
| 3 | "本月销售趋势" | QUERY_SALES_TREND | timeRange=THIS_MONTH | trend regex + time |
| 4 | "各部门业绩对比" | QUERY_DEPARTMENT_PERFORMANCE | dimension=department | dept entity + dimension |
| 5 | "华东区域销售" | QUERY_REGION_ANALYSIS | entities=[华东] | region entity boost |
| 6 | "上海业绩怎么样" | QUERY_REGION_ANALYSIS | entities=[上海] | city → province lookup |
| 7 | "Q1 同比增长" | COMPARE_PERIOD | compareType=YoY, time=Q1 | quarter + compare |
| 8 | "销售部 vs 市场部" | COMPARE_DEPARTMENT | dimensions=[department] | dept entity + compare |
| 9 | "下钻销售部明细" | DRILL_DOWN | dimension=department | drill keyword |
| 10 | "下个月销售预测" | FORECAST | timeRange=LAST_MONTH? | forecast keyword + future time |

Mix of high-confidence + boundary cases.

**`responseText` byte shape**: `executeQueryByIntent` returns templated Chinese strings (e.g., "本月销售总额为 ¥XXX，同比增长 X%"). Phase B impl must mirror exactly — including punctuation, spacing, currency symbols. Recommend recording 2 prod responses per query and diffing.

### 3.4 `/drill-down` (revised effort: 0.5-1d, was 1-2d)

**Discovery**: Python `analysis_drilldown.py` already exists (302+ lines). Mirrors `SmartBIServiceImpl.processDrillDown` (Java line 1018-1069). Spec PR #178 §3.1.a flags it as "Python has but nginx doesn't route".

**Phase B Task list**:
1. Record fresh F999 + F001 goldens for 5 dimensions (region / department / product / time / salesperson) × 2 sub-cases each = 10 goldens.
2. Diff against existing `analysis_drilldown.py` outputs (via test env `:8084`) for dict-eq parity.
3. Fix any Rule 1-12 latent issues found.
4. Add nginx regex route (covered in Phase C cutover, not Phase B).

**Effort**: 0.5d golden recording + 0.5d diff/fix. No new file authoring.

### 3.5 Nginx regex update (Phase C cutover, not Phase B)

Per PR #180 §2.5 — single-shot edit at cutover time:

```diff
- location ~ ^/api/mobile/(F00[1-46]|...)/smart-bi/(...|analysis/(sales|department|region|finance|inventory|procurement)) {
+ location ~ ^/api/mobile/(F00[1-46]|...|F999)/smart-bi/(...|query|drill-down|analysis/(sales|department|region|finance|inventory|procurement|production|quality)) {
      proxy_pass http://cretas_python;
  }
```

Two changes:
1. Add `F999` to factory ID alternation
2. Add `production|quality|query|drill-down` to path alternation

---

## 4. Data Flow Diagrams

### 4.1 `/query` end-to-end (Python target)

```
client POST /api/mobile/{factoryId}/smart-bi/query
    body: {query: "本月销售情况", context: {...}}
       │
       ▼
nginx (139) — regex match → cretas_python (47:8083)
       │
       ▼
FastAPI router @router.post("/query")  (analysis_query.py)
       │ (parse NLQueryRequest pydantic)
       ▼
SmartBIIntentService.recognize_intent(query, context)
       │
       ├─ normalize_query: lowercase + strip whitespace + punctuation
       │
       ├─ keyword_match → 30 intents × ~15 keywords
       │   confidence = base + coverage_bonus + exact_bonus
       │
       ├─ regex_match → +0.2 confidence on hit
       │
       ├─ entity_boost
       │   ├─ RegionEntityRecognizer.recognize(query) → [华东, 上海, ...]
       │   ├─ DepartmentEntityRecognizer.recognize(query) → [销售部, ...]
       │   └─ MetricEntityRecognizer.recognize(query) → [销售额, 利润, ...]
       │   if region+sales → boost QUERY_REGION_ANALYSIS by 0.2~0.4
       │   if dept+sales → boost QUERY_DEPARTMENT_PERFORMANCE
       │
       ├─ sort candidates by confidence DESC → top
       │
       ├─ extract_parameters(top.intent) → {topN, sortOrder, aggregation, ...}
       │
       ├─ parse_time_range → DateRange (Trie + regex)
       │
       ├─ parse_dimension → "department" | "region" | etc.
       │
       └─ confidence < 0.7?
           ├─ YES → llm_fallback_client.fallback(query, candidates)  ← non-deterministic
           └─ NO → use top
       │
       ▼
SmartBIService.process_query(factoryId, intent_result, request)
       │
       ├─ dispatch by intent.category
       │   ├─ QUERY_SALES_*        → analysis_sales.py functions
       │   ├─ QUERY_DEPARTMENT_*   → analysis_department.py
       │   ├─ QUERY_REGION_*       → analysis_region.py
       │   ├─ QUERY_FINANCE_*      → analysis_finance.py
       │   ├─ QUERY_INVENTORY_*    → analysis_inventory.py
       │   ├─ QUERY_PROCUREMENT_*  → analysis_procurement.py
       │   ├─ QUERY_PRODUCTION_*   → analysis_production.py (NEW Phase B §3.1)
       │   ├─ QUERY_QUALITY_*      → analysis_quality.py (NEW Phase B §3.2)
       │   ├─ DRILL_DOWN           → analysis_drilldown.py
       │   └─ FORECAST             → analysis_forecast.py (existing? verify in Phase B)
       │
       ▼
NLQueryResponse {intent, parameters, responseText, followUpQuestions, chartConfig?}
       │
       ▼ (wrap_response from schema_compat)
{success: true, data: <NLQueryResponse>, message: "ok"}
       │
       ▼
client receives ApiResponse byte-shape parity vs Java
```

### 4.2 `/analysis/production` flow (simpler — mock data)

```
client GET /api/mobile/F001/smart-bi/analysis/production?startDate=...&endDate=...&analysisType=oee
       │
       ▼
nginx → cretas_python (47:8083)
       │
       ▼
FastAPI router @router.get("/analysis/production")
       │ (verify_jwt_and_factory dependency)
       │ (parse query params: start_date, end_date, analysis_type)
       ▼
generate_mock_production_data(factory_id, start_date, end_date)
       │ (mirror Java seed-based mock generator — verify reproducibility)
       │ → list[dict] {date, factoryId, runtime, planned_runtime, output, theoretical_output, good_units, total_units, ...}
       │
       ▼ branch by analysis_type:
       ├─ "oee"        → metrics + trend_chart
       ├─ "efficiency" → metrics + ranking
       ├─ "equipment"  → metrics + ranking + downtime_chart
       └─ default      → overview (DashboardResponse)
       │
       ▼
{startDate, endDate, [overview|metrics|trendChart|ranking|downtimeChart]}
       │
       ▼ (wrap_response)
{success: true, data: {...}, message: "ok"}
```

### 4.3 LLM fallback (`/query` low-confidence path)

```
recognize_intent → confidence = 0.45 (below 0.7)
       │
       ▼
needs_llm_fallback = True
       │
       ▼
llm_fallback_client.fallback(query, top_candidates, all_supported_intents)
       │
       ├─ build prompt (mirror Java LlmIntentFallbackClient prompt template)
       │   "你是 SmartBI 意图分类助手。用户查询: {query}。
       │    候选意图: {top_candidates as YAML}。
       │    返回 JSON: {intent_code, confidence, reasoning}."
       │
       ├─ DashScope qwen-max-2025-01-25 invoke (existing Python infra)
       │
       └─ parse JSON → {intent_code, confidence, reasoning}
       │
       ▼
mapper.intent_match_to_intent_result(llm_result, original_query)
       │ (rebuild IntentResult with LLM-supplied intent + recompute params/time/dimension/entities)
       │
       ▼
return enriched IntentResult (now confidence ≥ threshold)
```

---

## 5. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Mock data generator seed not faithfully ported (production / quality) | MED | MED — golden mismatch | Phase B Task 0: read `generateMockProductionData` source, document seed strategy, write `_generate_mock_*` Python with bit-exact Random reproducibility (or use deterministic hash-based generator) |
| R2 | `executeQueryByIntent` fallback path missed in /query port | MED | HIGH — wrong shape for low-confidence | Phase B `/query` impl FIRST traces `SmartBIServiceImpl.processQuery` before any code; record golden against PRODUCTION path (smartBIService != null), not fallback |
| R3 | Trie longest-match algorithm subtly diverges (recursion depth, alias resolution order) | LOW | MED — entity miss/extra | Mirror Java line 329-376 verbatim; pytest with same input strings as Java unit tests |
| R4 | LLM fallback non-determinism breaks dict-eq | HIGH | LOW — known limitation, golden test high-confidence only | Document explicitly: low-conf queries skip golden parity verify; instead test that fallback is INVOKED at correct threshold |
| R5 | Time recognizer `LocalDate.now()` differs Java vs Python timezone | MED | MED — relative time off by one day | Force `Asia/Shanghai` TZ in Python service; verify with `LAST_N_DAYS` golden recorded at midnight boundary |
| R6 | `Map.of(N)` key order divergence in NLQueryResponse | MED | LOW — dict-eq tolerates | Apply Rule 8: record golden, mirror Python dict literal order. NLQueryResponse is Lombok `@Data` POJO so Rule 9 also applies (verify Jackson order from real prod request) |
| R7 | `DASHSCOPE_API_KEY` not configured in Python prod env | LOW | HIGH — LLM fallback fails 500 | Phase B impl: include explicit env check at startup; fail loud if missing (NOT silent degrade) |
| R8 | Rule 12 banker-vs-HALF_UP in confidence calculation | LOW | LOW — confidence is float, dict-eq tolerates | confidence is float, no display formatting; safe |
| R9 | `intent_patterns.json` divergence between Java classpath and Python intent/dictionaries/ | MED | MED — keyword/regex out of sync | Phase B impl: copy Java JSON file at build time via deploy script; add CI check that files are byte-identical |
| R10 | Production / Quality mock data deemed "fake data" violation by Steve | LOW | HIGH — re-scope to real DB | Phase A discovery surfaces this BEFORE Phase B kickoff; if Steve mandates real-DB upgrade, T6.6 effort triples (5+5+5+5 = 20d). Default: keep mock parity per current Java |
| R11 | Existing Python `query_intent_extractor.py` (staff-role narrow) accidentally invoked instead of new full intent service | MED | HIGH — wrong dispatch | Phase B `/query` impl: explicitly import from `smartbi_compat.intent.intent_service`, NOT from `smartbi/services/intent`. Add unit test asserting class identity |
| R12 | 6 dictionary JSON files copy creates concurrent-edit hazard | LOW | LOW | Phase B reviewer: enforce `concurrent-edit-safety.md` discipline; commit Java + Python JSONs together |

---

## 6. Rollout Plan (Phase A → Phase D)

### 6.1 Phase A complete (this doc)

- [x] Inventory Java intent service surface (§1)
- [x] Decide Approach A (rule engine 1:1) (§2)
- [x] Caught spec drift: production/quality are mock; /query has 2 paths; /drill-down exists (§3)
- [x] Risk register (§5)
- [x] Phase B PR plan (§6.2)
- [ ] Reviewed by organizer + chat 3 (Phase 2A intent owner)
- [ ] Sign-off recorded in PR description

### 6.2 Phase B execution (3-4 sister chats parallel, after T6.5 Phase B+C complete)

Recommend 4 sister chats parallel via separate worktrees:

| Sister chat | Endpoint | Effort | Owner |
|---|---|---|---|
| Chat A | `/analysis/production` | 1.5-2d | new chat (mechanical mock-mirror, low complexity) |
| Chat B | `/analysis/quality` | 1.5-2d | new chat (same as Chat A, parallel) |
| Chat C | `/query` | 5-7d | **Phase A owner (continuity)** — Trie + 5 recognizers + intent service + LLM fallback |
| Chat D | `/drill-down` parity verify + Phase A foundation review | 0.5-1d | smallest scope; can absorb organizer-side nginx prep |

**Chat C critical-path tasks (in order)**:

1. **Day 1** — Trace `SmartBIServiceImpl.processQuery` (find by grep, confirm dispatch logic). Document in implementation notes.
2. **Day 1-2** — Implement `intent/recognizer_base.py` + `recognizer_region.py` + `recognizer_time.py`. Pytest with Java fixture inputs.
3. **Day 2-3** — Implement remaining 3 recognizers (department / metric / dimension). Copy 6 dictionary JSONs to `intent/dictionaries/`.
4. **Day 3-4** — Implement `intent/intent_service.py` (rule engine top-level). Pytest with 10 representative queries from §3.3.
5. **Day 4-5** — Implement `intent/llm_fallback.py` + `intent_mapper.py`. Test with low-confidence query (confidence 0.45 example).
6. **Day 5-6** — Implement `api/analysis_query.py` route. Wire to existing analysis dispatcher pattern (mirror SmartBIServiceImpl). Record F999 + F001 goldens.
7. **Day 6-7** — Reviewer audit per Rules 1-12. Test env smoke.

**Chats A + B + D run in parallel during Days 1-3** (don't depend on Chat C foundation).

### 6.3 Phase C cutover (~1 day, after Phase B PRs all merged)

1. T-72h: notify F999 internal team (PR #180 §3.3 customer comms framework)
2. T-0: backup nginx config (`bak.t6_6_pre.<ts>` per server-operations.md HARD rule)
3. Edit nginx regex per §3.5
4. `nginx -t` → `nginx -s reload`
5. Smoke 4 endpoints × 76 factories (75 customer + F999) within 5-10 min
6. Active E2E (per `feedback_active_e2e_replaces_passive_soak.md` HARD rule) — Playwright/curl/`agent-browser` exercises NL query + drill-down + production + quality scenarios for ≥15 min. **NO 24h passive soak.**
7. STOP and ping organizer per `feedback_pause_before_deploy_or_push.md` — at each step

**Rollback** (if 5xx spike or P1 customer report): `cp <backup> <conf> && nginx -s reload` (~1 min)

### 6.4 Phase D Java method body deletion (~2-3d, T+30d post-Phase-C)

After 30-day Phase C stability, mirror T6.5 Phase C method-level audit pattern:

| Java surface | Action |
|---|---|
| `SmartBIAnalysisController::getProductionAnalysis` body | Remove method (NOT just stub — T6.5 Phase C proved removal works) |
| `SmartBIAnalysisController::getQualityAnalysis` body | Remove method |
| `SmartBIAnalysisController::query` body | Remove method |
| `SmartBIAnalysisController::drillDown` body | Remove method |
| `ProductionAnalysisServiceImpl` Java class | **KEEP forever** (Dashboard composite injects per PR #178 §3.2.a) |
| `QualityAnalysisServiceImpl` Java class | **KEEP forever** (same reason) |
| `SmartBIIntentService` + 5 EntityRecognizer + Mapper + Prompt classes | **KEEP through Phase D**; re-evaluate ≥30d post-cutover. Removable only if zero non-`/query` callers in repo grep. |

**GO criteria — Phase D complete**:
- `mvn clean compile -DskipTests` passes after method body removal
- `grep` for removed method names returns 0 non-test matches
- Spring context startup clean (no missing controller beans)
- CLAUDE.md updated to reflect SmartBIAnalysisController surface change

---

## 7. Open Questions for Phase B Impl Chat

1. **Production / Quality data source decision**: Keep mock data generator parity with Java (default per Phase 2A standard) OR upgrade to real DB query against `smart_bi_production_data` / `smart_bi_quality_data` (if such tables exist)? **Recommend**: keep mock parity for Phase B; defer real-DB upgrade to Phase 2C scoping. Steve sign-off needed before Phase B starts.

2. **`SmartBIServiceImpl.processQuery` actual dispatch logic**: not traced in Phase A. Phase B Chat C Day 1 must read this file to understand how it routes by intent → analysis service. Estimated ~200-400 LOC method.

3. **Existing `query_intent_extractor.py` (staff-role narrow)**: keep as-is for restaurant `/staff_performance` flows OR consolidate into new `intent/intent_service.py`? **Recommend**: keep separate. Different consumer (template_*.py uses staff role; `/query` uses intent enum). No naming collision because new module is `smartbi_compat.intent.*` vs existing `smartbi.services.intent.*`.

4. **Time-zone handling in TimeEntityRecognizer**: Java `LocalDate.now()` uses default JVM TZ (`Asia/Shanghai` on prod). Python `date.today()` uses system TZ (also `Asia/Shanghai` on prod). Phase B Chat C must add explicit `tzinfo=ZoneInfo("Asia/Shanghai")` defensive guard, AND record goldens at midnight boundary to verify cross-day cases.

5. **Dictionary JSON sync mechanism**: copy at build time? Symlink? Single JSON read from Java's classpath via gRPC? **Recommend**: build-time copy via `deploy-smartbi-python.sh` rsync addition. Add CI check that `backend/python/smartbi_compat/intent/dictionaries/intent_patterns.json` is byte-identical to `backend/java/cretas-api/src/main/resources/config/smartbi/intent_patterns.json`.

6. **LLM fallback rate limiting**: `LlmIntentFallbackClient` likely has DashScope rate limit handling (retry / circuit breaker). Phase B Chat C Day 4-5 must mirror this — or document gap if Java doesn't have it either.

7. **Phase 2A Rule 8 (Map.of(N) key order) for NLQueryResponse**: NLQueryResponse is `@Data` POJO not Map.of, so Rule 8 doesn't apply directly. But Rule 9 (Lombok null emit) does. Phase B reviewer must verify by recording fresh F999 golden + diffing key order.

8. **Phase 2A Rule 11 (`_java_isoformat`) coverage**: `IntentResult.processingTimeMs` is `long`, NOT `LocalDateTime`. `DateRange` has `LocalDate startDate, endDate` (no time component). Likely Rule 11 doesn't bite. Phase B reviewer must confirm via grep for `LocalDateTime` field declarations.

9. **F999 dataset shape**: F999 is the internal test factory. Does it have populated `smart_bi_*` data, or is everything empty? PR #178 §4.1 hints F999 is largely empty. Mock production / quality generators don't care about DB state — but `/query` dispatching to e.g. `analysis_finance.py` for FINANCE_OVERVIEW intent will return Java's "empty Gold" path (Pattern B per PR #135). Phase B Chat C must include both `F999-empty` + `F001-populated` queries in golden suite.

10. **T6.6 Phase B kickoff timing**: PR #180 §1 says "after T6.5 Phase B + C complete ≥30 days". Current Phase 2A 100% complete (2026-05-09). T6.5 Phase B 410-stub estimated mid-late June; Phase C method audit estimated mid-July. **Earliest realistic T6.6 Phase B kickoff: 2026-08-15 (3 months from now)**. Phase A design done now means freeze + revisit at kickoff.

---

## 8. Discovery Findings Baked Into This Spec

| Finding | Source | Implication |
|---|---|---|
| `ProductionAnalysisServiceImpl` 9/9 entry points use `generateMockProductionData()` | Grep `service/smartbi/impl/ProductionAnalysisServiceImpl.java` → 9 hits | §3.1 effort revised 2-3d → 1.5-2d; surface §7 question 1 |
| `QualityAnalysisServiceImpl` 10/10 entry points use `generateMockQualityData()` | Same grep on quality impl | Same as above for §3.2 |
| `SmartBIAnalysisController.query` has 2 dispatch paths (smartBIService preferred, intentService fallback) | Read line 491-528 | §3.3 mandates trace `SmartBIServiceImpl.processQuery` Day 1 of Phase B Chat C |
| `analysis_drilldown.py` already exists, mirrors `processDrillDown` (line 1018-1069) | Glob match + Read 120 lines | §3.4 effort revised 1-2d → 0.5-1d; only golden parity + nginx route needed |
| Python `classifier/intent_classifier.py` is BERT (transformers + temperature scaling + OOD signals) | Read full file 280 lines | §2.1 Approach B feasibility = LOW; classifier outputs label_id+confidence don't dict-eq with rule-engine intent enum |
| Python `query_intent_extractor.py` scope is staff role only (waiter/cashier/chef/manager + N + frequency) | Read full file 192 lines | §2.1 Approach B coverage gap; cannot replace 5-recognizer Java engine |
| `BaseEntityRecognizer.recognize` is a 50-line longest-match Trie scan (line 329-376) | Read recognizer_base.java | §2.3 Python port is mechanical translate of this algorithm |
| 6 classpath dictionary JSONs (intent_patterns + 5 entity dicts) | `find config/smartbi/*.json` | §1.2 Phase B copies all 6; CI byte-equal check (§7 Q5) |
| 30 SmartBIIntent enum values, 5 categories | Read SmartBIIntent.java 359 lines | §1.1 surface area sized; §3.3 golden suite = 10 queries spanning 30 intents |
| `intent_patterns.json` schema = `{intent_code: {keywords[], patterns[], required_params[], optional_params[], weight}}` | Read first 100 lines of intent_patterns.json | §1.2 schema documented; Phase B mechanical loader |
| `TimeEntityRecognizer` uses Trie (fixed) + 7 regex (dynamic) 2-phase scan | Read timeEntityRecognizer.java 754 lines | §2.4 Python mirrors 2-phase exactly |
| Java `RegionEntityRecognizer` has 7 大区 + 34 province + ~14 default cities + suffixes/aliases | Read regionEntityRecognizer.java 522 lines | §1.1 surface area; §2.3 example shows port pattern |
| `SmartBIIntentMapper` bridges to AI Chat `IntentMatchResult` for LLM fallback | Read mapper.java 180 lines | §1.4 LLM fallback path documented; Phase B mirror via `intent_mapper.py` |
| `SmartBIPromptServiceImpl` loads `.md` templates from classpath, uses `{{var}}` substitution | Read prompt service 720 lines | §1.1 surface area; Phase B mirror via `prompt_service.py` |
| Phase 2A dict-eq parity standard tolerates LLM non-determinism | `python-java-port.md` Rule 4 + `feedback_phase2a_dict_eq_official_standard.md` | §2.6 LLM fallback only golden-tested for high-confidence path |
| F999 Java SmartBI route currently NOT covered by nginx regex | PR #178 §4.1 | §3.5 nginx update adds F999 to factory ID alternation |
| Python `analysis_drilldown.py` reuses helpers from `analysis_finance.py` / `analysis_sales.py` / `analysis_region.py` / `analysis_department.py` | Read line 22-31 | §3.4 confirms Python existing code already integrated with cross-module pattern |

---

## 9. ⛔ HOLD Blocks

- ⛔ This is a **design / planning doc only** — no code changes, no deploys, no nginx mutations.
- ⛔ T6.6 Phase B kickoff requires T6.5 Phase B + C complete ≥30 days. Currently estimated 2026-08-15.
- ⛔ `/query` Python port: do **NOT** begin Phase B Chat C impl before tracing `SmartBIServiceImpl.processQuery` (mandatory Day 1 task per §6.2). Risk of dead-end refactor too high.
- ⛔ Phase B Chat A + Chat B (production / quality): do **NOT** assume real-DB query — these are mock data generators (§3.1, §3.2). Verify mock generator seed strategy as Day 0 task.
- ⛔ This spec is **NOT** a marching order. Phase B kickoff requires fresh marching order from organizer with chat assignment + concrete artifact paths.
- ⛔ Production / Quality real-DB-vs-mock decision needs Steve sign-off before Phase B (Open Question 1).
- ⛔ Concurrent-edit safety: Phase B 4 sister chats MUST use isolated worktrees per `concurrent-edit-safety.md` rule 2. Foundation files (`intent/recognizer_base.py` etc.) owned exclusively by Chat C.

---

## 10. Sign-off

Before Phase B kickoff this design reviewed by:

- [ ] Engineering organizer (timing + scope acceptable; T6.5 Phase B/C dependency lock; mock-data decision per Q1)
- [ ] Chat 3 / Phase 2A intent classifier owner (Approach A vs B vs C decision; LLM fallback design soundness)
- [ ] T6.5 Phase B/C lead (handoff acknowledgement, no scope-creep into T6.5)
- [ ] On-call rotation lead (cutover time-window staffing acceptable for Phase C ~July 2026)

Sign-off recorded in PR description when this spec merges main.

---

**End of T6.6 Phase A Design — Python Intent Service Equivalent + 4 Endpoint Port Architecture**
