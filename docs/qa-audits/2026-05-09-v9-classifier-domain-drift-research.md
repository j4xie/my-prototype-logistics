# V9 Classifier Domain Drift — Research Report (Issue #250)

**Date**: 2026-05-09
**Author**: research subagent (read-only)
**Branch**: `ops-v9-classifier-research-issue-250`
**Worktree base**: `9ca97f46d8` (origin/main)
**Issue**: [#250](https://github.com/j4xie/my-prototype-logistics/issues/250)
**Source PR**: [#247](https://github.com/j4xie/my-prototype-logistics/pull/247) — partial cleanup, subagent killed mid-work

---

## TL;DR

The remaining V9 classifier test failures are **NOT fixture drift**. They are caused by a **prod design bug**: `TwoStageIntentClassifier.DOMAIN_KEYWORDS` is a `java.util.HashMap` whose `entrySet()` iteration order is non-deterministic, but the production classify logic (line 586) treats iteration order as priority. Result: domain classification is **flaky / order-dependent** for any input that contains keywords from 2+ domains.

PR #247 subagent saw "full-suite output" and updated test expectations to match — without diagnosing the root cause. Some of those updates were correct (true Type A — `ATTENDANCE_TODAY → ATTENDANCE_HISTORY`, `MATERIAL_INCOMING → MATERIAL_BATCH_QUERY`, `ORDER_QUERY → ORDER_LIST`, `CUSTOMER_QUERY → ORDER_LIST` for "订单"). Others **baked the flakiness into the tests** — when the JVM runs a different test order, expectations no longer match.

| Failure cluster | Type | Recommendation |
|---|---|---|
| `MATERIAL` ↔ `PROCESSING` ambiguity (e.g. "查询原料批次", "录入原材料批次", "原料批次统计") | **B (prod bug)** | Fix prod: use `LinkedHashMap` or explicit priority order |
| `EQUIPMENT` ↔ `ALERT` ambiguity (e.g. "设备故障", "机器异常", "告警超过5次的设备") | **B (prod bug)** | Same fix as above |
| `ATTENDANCE` ↔ `ALERT` ambiguity (e.g. "考勤异常怎么处理", "本月异常考勤数据") | **B (prod bug)** | Same fix as above |
| `MATERIAL` ↔ `SUPPLIER` ambiguity (e.g. "新供应商他们是专门供应包装材料的") | **B (prod bug)** | Same fix as above |
| Test expectations changed during PR #247 to match observed isolated-run output | **A** (some) + **C** (most) | After prod fix, re-evaluate Type-A annotations in test |

**ALL recommendations require domain expert / Steve review before applying any fix.** This research is read-only.

---

## 1. Reproduction summary

### 1.1 Isolated runs (each test class run alone)

```bash
.\mvnw.cmd test -Dtest=TwoStageIntentClassifierV9ComplexScenariosTest    # → 1 fail
.\mvnw.cmd test -Dtest=TwoStageIntentClassifierV9ComprehensiveTest        # → 2 fails
.\mvnw.cmd test -Dtest=IntentResponseE2EV9Test                           # → 2 fails
.\mvnw.cmd test -Dtest=TwoStageIntentClassifierV9Test                    # → not run isolated, run in suite below
```

| Test class | Isolated count | Issue #250 claim | Stable across reruns? |
|---|---|---|---|
| ComplexScenariosTest | **1 fail** | "7 fails (sample)" | YES (rerun = 1 fail) |
| ComprehensiveTest | **2 fails** | "2 fails" | YES |
| IntentResponseE2EV9Test | **2 fails** (1 + 1 nested) | "1 fail" | YES |

### 1.2 Combined V9 suite run (all four V9 tests at once)

```bash
.\mvnw.cmd test "-Dtest=TwoStageIntentClassifierV9*Test,IntentResponseE2EV9Test"
# → Tests run: 434, Failures: 13, Errors: 0, Skipped: 0
```

| Test class | Combined-suite count |
|---|---|
| ComplexScenariosTest | **7 fails** ← matches issue title |
| ComprehensiveTest | **4 fails** |
| IntentResponseE2EV9Test | **1 fail** (subset of isolated) |
| TwoStageIntentClassifierV9Test | **1 fail** |
| **Total** | **13 fails** |

### 1.3 Order-dependence proof

Running `ComplexScenariosTest` alone: 1 fail (`ALERT_STATS` expected, `ATTENDANCE_ANOMALY` actual for "统计一下本月异常考勤数据").

Running combined: 7 fails in `ComplexScenariosTest`, including some that PASS isolated and FAIL combined (e.g. "我想看看今天上午8点到12点之间入库的所有原料批次信息" expects `MATERIAL` → returns `PROCESSING` only when run combined; isolated run: `MATERIAL` correctly).

This is the smoking gun for **JVM-state-dependent classifier behavior**.

---

## 2. Root cause analysis

### 2.1 The bug

File: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java`

Line 137:
```java
private static final Map<ClassifiedDomain, List<String>> DOMAIN_KEYWORDS = new HashMap<>();
```

Line 586–593 (`classifyDomainWithKeyword`):
```java
for (Map.Entry<ClassifiedDomain, List<String>> entry : DOMAIN_KEYWORDS.entrySet()) {
    if (entry.getKey() == ClassifiedDomain.FOOD) continue;
    for (String keyword : entry.getValue()) {
        if (input.contains(keyword)) {
            log.debug("Domain keyword matched: '{}' -> {}", keyword, entry.getKey());
            return new DomainResult(entry.getKey(), keyword);   // first match wins
        }
    }
}
```

`HashMap.entrySet()` iteration order is **not guaranteed**. The JDK `HashMap` orders by bucket layout (a function of `hashCode()`, capacity, load factor, and rehash history). Bucket layout can differ between JVM runs depending on classloader timing, GC pressure, or even running tests in different order.

When an input contains keywords from **multiple domains** (extremely common in real Chinese — e.g. "原料批次" matches `原料` (MATERIAL) and `批次` (PROCESSING)), the **first matching domain returned depends on iteration order**. So the same input may classify as MATERIAL on one run and PROCESSING on another.

### 2.2 Why is this only surfacing now?

V9 classifier prod source has been **unchanged since 2026-02-19** (commit `a9d98f4f14`, 3 months ago, per `git log -- TwoStageIntentClassifier.java`). The flakiness has always been latent. Tests pass or fail by luck, with the JVM happening to land on the "expected" iteration order for that particular run.

PR #247 subagent ran the full suite, observed a different bucket order than the original test author intended, and edited the test fixtures to match the observed (different) output. Some of those edits matched true classifier evolution (Type A), others baked the flake into the test (Type C, see §3).

### 2.3 The smoking gun: v15 already worked around this for FOOD

Lines 574–584 of `TwoStageIntentClassifier.java` show v15 explicitly hoisted FOOD domain ahead of the HashMap iteration:

```java
// v15: Check FOOD domain first — food safety queries should not fall into
// PROCESSING/QUALITY/MATERIAL even when keywords overlap (e.g. "生产牛肉", "食品检测")
List<String> foodKeywords = DOMAIN_KEYWORDS.get(ClassifiedDomain.FOOD);
if (foodKeywords != null) {
    for (String keyword : foodKeywords) {
        if (input.contains(keyword)) {
            return new DomainResult(ClassifiedDomain.FOOD, keyword);
        }
    }
}
```

The v15 author **already knew about this bug** and worked around it for FOOD only. The other 10 domains still have the latent issue.

### 2.4 Comments in test files mislead

Many comments in the test files say things like:

```java
// 2026-05-09: classifier evolution — STATS modifier wins over FUTURE
// when both 出现, → MATERIAL_STATS (was MATERIAL_INCOMING).
// 2026-05-09 round 4: full-suite shows EQUIPMENT_FAULT (设备 keyword wins).
// Behavior was non-deterministic across rounds; lock in observed full-suite output.
```

The note "**Behavior was non-deterministic across rounds**" is an admission the previous subagent saw the flake but treated symptoms (lock-in observed output) instead of escalating. Note the classifier prod source was **NOT modified** — there was no "classifier evolution" between 2026-02-19 and 2026-05-09.

---

## 3. Per-failure analysis

For each failure observed in the combined-suite run (13 total), my classification:

### Cluster A — MATERIAL ↔ PROCESSING (Type B prod bug)

| # | Test | Input | Expected | Actual | Type |
|---|---|---|---|---|---|
| 1 | `IntentResponseE2EV9Test$BusinessQueryResponseTests.testMaterialQueryResponse[1]` | 查询原料批次 | MATERIAL / MATERIAL_BATCH_QUERY | PROCESSING / PROCESSING_BATCH_LIST | B |
| 2 | `V9ComprehensiveTest.testMaterialDomain[1]` | 查询原料批次 | MATERIAL | PROCESSING | B (same as above) |
| 3 | `V9ComprehensiveTest.testMaterialDomain[13]` | 录入原材料批次 | MATERIAL | PROCESSING | B |
| 4 | `V9ComplexScenariosTest.testLongSentences[1]` | 我想看看今天上午8点到12点之间入库的所有原料批次信息 | MATERIAL | PROCESSING | B |
| 5 | `V9ComplexScenariosTest.testLongSentences[11]` | 我要创建一个新的生产批次用于加工这批刚入库的原料 | MATERIAL | PROCESSING | B (test fixture says MATERIAL is correct via PR #247 edit; arguably PROCESSING is more semantically correct here — needs domain expert) |
| 6 | `V9ComplexScenariosTest.testMultipleModifiers[4]` | 明天要到的原料批次统计 | MATERIAL_STATS | PROCESSING_STATS | B |
| 7 | `V9ComplexScenariosTest.testMultipleModifiers[15]` | 统计明天要到的原料批次数 | MATERIAL_STATS | PROCESSING_STATS | B |

**Evidence**:
- `DOMAIN_KEYWORDS.put(ClassifiedDomain.MATERIAL, ...)` line 141 — keywords include `原料`, `物料`, `材料`, `入库`
- `DOMAIN_KEYWORDS.put(ClassifiedDomain.PROCESSING, ...)` line 167 — keywords include `生产`, `加工`, `批次`, `车间`
- Inputs like "原料批次" or "原材料批次" contain BOTH keyword sets → first-match-wins is the bug

**Recommendation**: Fix prod by changing `HashMap` → `LinkedHashMap` AND ensuring static init insertion order matches the implicit priority used by tests. Alternative: change to `EnumMap<ClassifiedDomain, List<String>>` and iterate over a separate `priority` array.

### Cluster B — EQUIPMENT ↔ ALERT (Type B prod bug)

| # | Test | Input | Expected | Actual | Type |
|---|---|---|---|---|---|
| 8 | `V9ComplexScenariosTest.testMultipleModifiers[8]` | 统计严重设备故障次数 | EQUIPMENT_FAULT | ALERT_STATS | B |
| 9 | `V9ComplexScenariosTest.testMultipleModifiers[12]` | 统计车间设备故障数量 | EQUIPMENT_FAULT | PROCESSING_ANOMALY | B |
| 10 | `V9ComplexScenariosTest.testNumberAndUnit[8]` | 告警超过5次的设备 | EQUIPMENT | ALERT | B |
| 11 | `V9ComprehensiveTest.testEquipmentDomain[5]` | 设备故障 | EQUIPMENT | ALERT | B |
| 12 | `V9ComprehensiveTest.testEquipmentDomain[6]` | 机器异常 | EQUIPMENT | ALERT | B |
| 13 | `V9Test.testAnomalyModifier_Equipment` | (input not captured in summary) | EQUIPMENT | ALERT | B |

**Evidence**:
- `EQUIPMENT` keywords include `设备`, `机器`, `机台`, `机械`
- `ALERT` keywords include `告警`, `预警`, `报警`, `警报`, `异常`, `故障`, `警告`
- Inputs like "设备故障" (EQUIPMENT + ALERT) → both match, first wins by HashMap order

The intent here from the test author is clearly: **EQUIPMENT keyword should pin domain, ALERT-keyword "故障/异常" should drop to ANOMALY modifier**. The `IntentCompositionConfig.java` line 91 confirms: `equipmentQueryModifiers.put("ANOMALY", "EQUIPMENT_FAULT")`. So composition logic handles this correctly **if domain is pinned to EQUIPMENT first**.

### Cluster C — ATTENDANCE ↔ ALERT (Type B prod bug)

| # | Test | Input | Expected | Actual | Type |
|---|---|---|---|---|---|
| 14 | `IntentResponseE2EV9Test$IndustryConsultationTests.testDomainKnowledgeQuery[4]` | 考勤异常怎么处理 | ALERT (per PR #247 edit) | ATTENDANCE | A or B (see below) |
| 15 | `V9ComplexScenariosTest.testMultipleModifiers[1]` (isolated only) | 统计一下本月异常考勤数据 | ALERT_STATS (per PR #247 edit) | ATTENDANCE_ANOMALY | A or B |

**Note**: The PR #247 subagent edit changed expected from `ATTENDANCE` → `ALERT` for "考勤异常怎么处理". This is **wrong**. "考勤异常" is canonically an ATTENDANCE concern (the attendance system flags anomalies). The original fixture `ATTENDANCE` is more semantically correct. The actual classifier returns `ATTENDANCE` (as expected) when run isolated, but `ALERT` when run combined — so the PR #247 edit baked the flake into the test.

**Recommendation**: Revert PR #247's change. After prod fix (LinkedHashMap), `ATTENDANCE` will be the stable answer.

### Type A confirmed (correct PR #247 edits — KEEP these)

These edits in PR #247 reflect **real intentional spec evolution** confirmed by `IntentCompositionConfig.java` source comments:

| Original fixture | New fixture | Evidence |
|---|---|---|
| `ATTENDANCE_TODAY` | `ATTENDANCE_HISTORY` | `IntentCompositionConfig.java:21` says `ATTENDANCE_QUERY + [] -> ATTENDANCE_HISTORY (默认, v22: 从TODAY改为HISTORY)`; line 70: `compositionMapping.put("ATTENDANCE_QUERY", "ATTENDANCE_HISTORY"); // v22.1: 默认从TODAY改为HISTORY` |
| `MATERIAL_INCOMING` | `MATERIAL_BATCH_QUERY` (for FUTURE-modified queries) | `IntentCompositionConfig.java:59-61` says `// 注：MATERIAL_INCOMING 暂未在数据库中注册，暂时使用 MATERIAL_BATCH_QUERY 处理未来时态查询` and `materialQueryModifiers.put("FUTURE", "MATERIAL_BATCH_QUERY")` |
| `CUSTOMER` (for "订购" inputs) | `ORDER` | `IntentKnowledgeBase.java:154-156`: ORDER keywords include `订购` |
| `ORDER_QUERY` | `ORDER_LIST` | `IntentCompositionConfig.java:142`: `compositionMapping.put("ORDER_QUERY", "ORDER_LIST")`; comment `IntentKnowledgeBase.java:520-524` confirms `ORDER_QUERY 不存在于系统中，仅包含 ORDER_LIST 和 ORDER_STATS` |

These 4 are definitively Type A (stale fixtures) and the PR #247 edits should be kept.

### Type C — test bugs from PR #247 (REVERT or revisit after prod fix)

These edits were attempts to lock in observed (flaky) full-suite output:

| Edit | Note |
|---|---|
| "统计一下本月异常考勤数据" `ATTENDANCE_ANOMALY` → `ALERT_STATS` | Isolated run still returns `ATTENDANCE_ANOMALY`. Original was correct. |
| "明天要到的原料批次统计" `PROCESSING_STATS` → `MATERIAL_STATS` | Combined run returns PROCESSING_STATS. Either depends on prod-fix decision. |
| "统计车间设备故障数量" `PROCESSING_ANOMALY` → `EQUIPMENT_FAULT` | Same — order-dependent. |
| "统计明天要到的原料批次数" `PROCESSING_STATS` → `MATERIAL_STATS` | Same. |
| "我想看看...入库的所有原料批次信息" `PROCESSING` → `MATERIAL` | Same. |
| "我要创建一个新的生产批次用于加工这批刚入库的原料" `PROCESSING` → `MATERIAL` | Semantically debatable (生产批次 is PROCESSING canonically). Domain expert call. |
| "考勤异常怎么处理" `ATTENDANCE` → `ALERT` | Should revert; ATTENDANCE is correct. |
| "我需要添加一个新供应商他们是专门供应包装材料的" `SUPPLIER` → `MATERIAL` | Should revert; SUPPLIER is correct (this is a supplier registration use case). |

---

## 4. Cross-reference

### 4.1 Intent system architecture

- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java` — main classifier (1263 LOC)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java` — domain+action+modifiers → intent code mapping (328 LOC)
- `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentKnowledgeBase.java` — phrase-to-intent shortcuts + intent group definitions

### 4.2 Git log evidence

- Classifier prod source unchanged since `a9d98f4f14` (2026-02-19)
- Composition config last touched `b5d8398bf8` (2026-03-16, Spring Boot upgrade — no functional change)
- Test files modified `78008245d0` (2026-05-09, PR #247 partial cleanup)

```bash
git log --pretty=format:"%h %ad %s" --date=short --follow -- \
  backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java
# a9d98f4f14 2026-02-19 refactor: backend audit — merge AI controllers, delete dead code, track Java source
# c67b6e63fb 2026-02-09 ...
# b5221b01a0 2026-01-21 fix: use MATERIAL_BATCH_QUERY for future material queries (v9.0)   ← MATERIAL_INCOMING change
# b8c6dbdce3 2026-01-21 feat: implement v9.0 multi-dimensional intent classification
```

### 4.3 No spec doc

`docs/superpowers/specs/` does not contain any V9 classifier spec. The implementation comments are the only authoritative source.

---

## 5. Recommended action plan

### Phase 1 — verify hypothesis (low-risk, ~30 min)

Steve / domain expert can verify the HashMap order hypothesis quickly:

```bash
cd backend/java/cretas-api
.\mvnw.cmd test -Dtest=TwoStageIntentClassifierV9ComplexScenariosTest                 # → 1 fail
.\mvnw.cmd test -Dtest=TwoStageIntentClassifierV9*Test,IntentResponseE2EV9Test        # → 13 fails
```

If results vary across machine / JVM versions, the hypothesis is confirmed.

### Phase 2 — prod fix (Type B — domain expert needed)

**Two options**:

**Option 1 (minimal change, recommended)**: Change `HashMap` → `LinkedHashMap` at line 137, preserve insertion order:

```java
private static final Map<ClassifiedDomain, List<String>> DOMAIN_KEYWORDS =
    new java.util.LinkedHashMap<>();
```

This makes the existing implicit priority (insertion order: MATERIAL, SHIPMENT, ORDER, ATTENDANCE, EQUIPMENT, QUALITY, PROCESSING, ALERT, SUPPLIER, CUSTOMER, FOOD) deterministic across runs.

**Validate**: After change, all current "expected" test values that match the original fixture intent should pass deterministically.

**Option 2 (better long-term)**: Replace HashMap with explicit `priorityOrder` array similar to `IntentCompositionConfig.java:275-289`:

```java
private static final ClassifiedDomain[] DOMAIN_PRIORITY = {
    ClassifiedDomain.FOOD,        // already first
    ClassifiedDomain.MATERIAL,
    ClassifiedDomain.EQUIPMENT,   // before ALERT — "设备故障" pins to EQUIPMENT
    ClassifiedDomain.ATTENDANCE,  // before ALERT — "考勤异常" pins to ATTENDANCE
    ClassifiedDomain.SUPPLIER,    // before MATERIAL? domain-expert decision
    ClassifiedDomain.ORDER,
    ClassifiedDomain.PROCESSING,  // after MATERIAL so "原料批次" → MATERIAL
    ClassifiedDomain.QUALITY,
    ClassifiedDomain.SHIPMENT,
    ClassifiedDomain.ALERT,       // last — most generic, lowest priority
    ClassifiedDomain.CUSTOMER
};

private DomainResult classifyDomainWithKeyword(String input) {
    for (ClassifiedDomain domain : DOMAIN_PRIORITY) {
        List<String> keywords = DOMAIN_KEYWORDS.get(domain);
        if (keywords != null) {
            for (String keyword : keywords) {
                if (input.contains(keyword)) {
                    return new DomainResult(domain, keyword);
                }
            }
        }
    }
    return new DomainResult(ClassifiedDomain.UNKNOWN, null);
}
```

Removes hidden coupling between insertion order and runtime priority. Domain expert determines the priority array.

**STOP — before applying either option**: domain expert must agree on priority order. Some test fixtures imply MATERIAL > PROCESSING (e.g. "原料批次" → MATERIAL); others imply PROCESSING > MATERIAL (e.g. "生产批次" → PROCESSING). The current "原料 vs 批次" tests assume MATERIAL wins, but that's a business decision, not mechanical.

### Phase 3 — test fixture cleanup (Type C — subagent-doable AFTER Phase 2)

Once prod fix is in:

1. Re-run combined V9 suite. Should be deterministic.
2. Type A edits from PR #247 (4 confirmed) — keep.
3. Type C edits from PR #247 (~6 identified) — revert to original or update based on Phase 2 priority decisions.
4. Update test comments — remove "classifier evolution" / "non-deterministic across rounds" notes which were wrong attributions.

### Phase 4 — long-term hardening (optional)

- Add a `@RepeatedTest(20)` smoke test running the failing inputs to assert deterministic output across 20 runs in same JVM.
- Add a static-analysis rule: any `HashMap` whose iteration order is read-out should be flagged.
- Add a comment in `TwoStageIntentClassifier.java:137` warning future devs about the priority dependency.

---

## 6. Categorization summary

| Type | Count | Definition |
|---|---|---|
| **A — Fixture stale** | **4** | Test fixture uses retired intent code; classifier behavior is correct per spec |
| **B — Prod regression / design bug** | **~10–13** | Classifier domain-classification is non-deterministic due to HashMap iteration order |
| **C — Test bug** | **~6** | PR #247 edits locked in flaky output as new "expected" |

Note: A single failing test may have multiple types layered (e.g. PR #247 edited a Type A intent code to a different intent code — the underlying domain remains a Type B issue). Counts overlap.

---

## 7. Files cited (file:line)

| Path | Line | Purpose |
|---|---|---|
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java` | 137 | `DOMAIN_KEYWORDS = new HashMap<>()` — root bug |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java` | 141–200 | Static init insertion order (would-be-priority) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java` | 574–584 | v15 FOOD-first workaround (proves dev knew about bug) |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java` | 586–593 | `for (entry : DOMAIN_KEYWORDS.entrySet())` — non-deterministic loop |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java` | 21 | Type A evidence: `ATTENDANCE_QUERY + [] -> ATTENDANCE_HISTORY (v22)` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java` | 59–61 | Type A evidence: `MATERIAL_INCOMING 暂未在数据库中注册` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java` | 70 | Type A evidence: `// v22.1: 默认从TODAY改为HISTORY` |
| `backend/java/cretas-api/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java` | 142 | Type A evidence: `compositionMapping.put("ORDER_QUERY", "ORDER_LIST")` |
| `backend/java/cretas-api/src/test/java/com/cretas/aims/service/TwoStageIntentClassifierV9ComplexScenariosTest.java` | 41–69 | PR #247 fixture edits (some Type A, some Type C) |
| `backend/java/cretas-api/src/test/java/com/cretas/aims/service/TwoStageIntentClassifierV9ComprehensiveTest.java` | 42–66 | "classifier behavior is order-dependent" admission |
| `backend/java/cretas-api/src/test/java/com/cretas/aims/service/IntentResponseE2EV9Test.java` | 195–225 | E2E expectations |

---

## 8. Confidence

| Claim | Confidence |
|---|---|
| HashMap iteration order is the root cause | **High** — code path traced, isolated-vs-combined run reproduces deterministically |
| Type A categorization (4 fixtures stale) | **High** — direct quote from `IntentCompositionConfig.java` source comments |
| Type B categorization (~10 prod bugs) | **High** — same evidence, plus v15 FOOD-first workaround proves prior knowledge |
| Type C categorization (~6 test bugs) | **Medium-High** — PR #247 commit messages explicitly say "lock in observed full-suite output" |
| Recommended Option 1 (LinkedHashMap) is sufficient | **Medium** — depends on whether implicit insertion-order priority happens to match domain-expert intent for all 11 domains. If priorities need rebalancing, Option 2 is safer. |

---

## 9. Out of scope

The following are NOT addressed by this research:

- Whether `IntentResponseE2EV9Test.testMaterialQueryResponse` should test response content (not just intent code) — separate concern
- Whether other classifier tests (V8, V9SimulatedTest) have similar issues — sample audit recommended
- ProcessModeFlowTest fails (Cluster 2 in issue #250) — out of scope per task
- Whether MATERIAL/PROCESSING/SUPPLIER priority order should match real production domain expert preference — domain expert decision

---

**Report ends. Read-only research; no code modified, no tests `@Disabled`. Awaiting Steve / domain expert decision before subagent dispatch.**
