# RAG Categories Label Audit Report

**Date**: 2026-02-12
**Scope**: Java `FoodKnowledgeIntentHandler.ragCategories` vs PostgreSQL `food_knowledge_documents.category`
**Server**: 47.100.235.168 (cretas_db)
**Severity**: CRITICAL -- mismatched tags cause silent 0-result RAG queries

---

## 1. Database Categories (38 categories, 614 documents total)

All documents are `is_active = TRUE`.

| # | DB Category | Doc Count |
|---|-------------|-----------|
| 1 | `process` | 190 |
| 2 | `standard` | 49 |
| 3 | `regulation` | 21 |
| 4 | `fraud_detection` | 20 |
| 5 | `import_export` | 18 |
| 6 | `aquatic` | 17 |
| 7 | `haccp` | 16 |
| 8 | `packaging_tech` | 14 |
| 9 | `certification` | 14 |
| 10 | `food_incident` | 14 |
| 11 | `case_study` | 14 |
| 12 | `dairy` | 13 |
| 13 | `risk_method` | 12 |
| 14 | `bakery` | 12 |
| 15 | `canned_food` | 12 |
| 16 | `cold_chain` | 12 |
| 17 | `functional_food` | 11 |
| 18 | `beverage` | 11 |
| 19 | `central_kitchen` | 11 |
| 20 | `sop` | 11 |
| 21 | `infant_food` | 10 |
| 22 | `health_food` | 10 |
| 23 | `frozen_food` | 10 |
| 24 | `grain` | 9 |
| 25 | `labeling` | 9 |
| 26 | `factory_design` | 9 |
| 27 | `condiment` | 9 |
| 28 | `testing` | 9 |
| 29 | `prefab_food` | 8 |
| 30 | `edible_oil` | 7 |
| 31 | `allergen` | 7 |
| 32 | `organic` | 7 |
| 33 | `contact_material` | 7 |
| 34 | `ecommerce` | 6 |
| 35 | `catering` | 6 |
| 36 | `novel_food` | 5 |
| 37 | `additive` | 5 |
| 38 | `microbe` | 5 |

---

## 2. Java Switch Cases (42 intent codes + 1 default)

Extracted from `FoodKnowledgeIntentHandler.java` lines 91-224.

| # | Intent Code | ragCategories Array |
|---|-------------|---------------------|
| 1 | `FOOD_ADDITIVE_QUERY` | `additive`, `gb2760` |
| 2 | `FOOD_ADDITIVE_SAFETY` | `additive`, `safety`, `toxicology` |
| 3 | `FOOD_ADDITIVE_ALTERNATIVE` | `additive`, `clean_label`, `natural` |
| 4 | `FOOD_ADDITIVE_INTERACTION` | `additive`, `interaction`, `compatibility` |
| 5 | `FOOD_STANDARD_LOOKUP` | `standard`, `gb`, `regulation` |
| 6 | `FOOD_REGULATION_QUERY` | `regulation`, `law`, `compliance` |
| 7 | `FOOD_LABEL_REVIEW` | `label`, `gb7718`, `nutrition_label` |
| 8 | `FOOD_REGULATION_PENALTY` | `regulation`, `penalty`, `enforcement` |
| 9 | `FOOD_HACCP_GUIDE` | `haccp`, `food_safety_system`, `codex` |
| 10 | `FOOD_HACCP_CCP` | `haccp`, `ccp`, `critical_limit` |
| 11 | `FOOD_CERT_GUIDE` | `certification`, `iso22000`, `brc`, `fssc` |
| 12 | `FOOD_AUDIT_PREP` | `audit`, `inspection`, `checklist` |
| 13 | `FOOD_PROCESS_PARAM` | `process`, `parameter`, `technology` |
| 14 | `FOOD_PROCESS_OPTIMIZATION` | `process`, `optimization`, `efficiency` |
| 15 | `FOOD_PROCESS_TROUBLESHOOT` | `process`, `troubleshoot`, `defect` |
| 16 | `FOOD_THERMAL_CALC` | `thermal`, `pasteurization`, `sterilization`, `f_value` |
| 17 | `FOOD_SAFETY_CHECK` | `safety`, `hazard`, `risk_assessment` |
| 18 | `FOOD_RECALL_QUERY` | `recall`, `incident`, `alert` |
| 19 | `FOOD_ALLERGEN_CHECK` | `allergen`, `cross_contamination`, `labeling` |
| 20 | `FOOD_CONTAMINATION_ASSESS` | `contamination`, `heavy_metal`, `pesticide`, `mycotoxin` |
| 21 | `FOOD_NUTRITION_CALC` | `nutrition`, `calculation`, `dietary_reference` |
| 22 | `FOOD_FORMULA_DESIGN` | `formula`, `recipe`, `ingredient` |
| 23 | `FOOD_SHELF_LIFE` | `shelf_life`, `stability`, `accelerated_test` |
| 24 | `FOOD_NUTRITION_LABEL` | `nutrition_label`, `gb28050`, `nrv` |
| 25 | `FOOD_MICROBE_QUERY` | `microbiology`, `pathogen`, `indicator_organism` |
| 26 | `FOOD_TEST_METHOD` | `test_method`, `gb5009`, `analysis` |
| 27 | `FOOD_SAMPLING_PLAN` | `sampling`, `gb2828`, `acceptance` |
| 28 | `FOOD_EQUIPMENT_GUIDE` | `equipment`, `machinery`, `specification` |
| 29 | `FOOD_CIP_GUIDE` | `cip`, `cleaning`, `sanitation` |
| 30 | `FOOD_EQUIPMENT_VALIDATION` | `validation`, `qualification`, `iq_oq_pq` |
| 31 | `FOOD_GMP_GUIDE` | `gmp`, `gb14881`, `prerequisite` |
| 32 | `FOOD_PEST_CONTROL` | `pest_control`, `ipm`, `sanitation` |
| 33 | `FOOD_WATER_QUALITY` | `water_quality`, `gb5749`, `treatment` |
| 34 | `FOOD_WASTE_MANAGEMENT` | `waste`, `effluent`, `environmental` |
| 35 | `FOOD_TRACEABILITY_GUIDE` | `traceability`, `recall`, `supply_chain` |
| 36 | `FOOD_SUPPLIER_AUDIT` | `supplier`, `audit`, `qualification` |
| 37 | `FOOD_COLD_CHAIN` | `cold_chain`, `temperature_control`, `logistics` |
| 38 | `FOOD_DAIRY_GUIDE` | `dairy`, `milk`, `gb19301`, `pasteurization` |
| 39 | `FOOD_MEAT_GUIDE` | `meat`, `gb2707`, `slaughter`, `curing` |
| 40 | `FOOD_BAKERY_GUIDE` | `bakery`, `gb7099`, `fermentation`, `baking` |
| 41 | `FOOD_BEVERAGE_GUIDE` | `beverage`, `gb7101`, `carbonation`, `filling` |
| 42 | `FOOD_FROZEN_GUIDE` | `frozen`, `gb19295`, `quick_freeze`, `cold_storage` |
| 43 | `FOOD_TRAINING_GUIDE` | `training`, `competency`, `food_handler` |
| 44 | `FOOD_COMPLIANCE_CHECK` | `compliance`, `regulation`, `checklist` |
| 45 | `FOOD_RND_CONSULT` | `rnd`, `development`, `innovation` |
| 46 | `FOOD_PACKAGING_GUIDE` | `packaging`, `gb4806`, `migration`, `shelf_life` |
| 47 | `FOOD_SENSORY_EVAL` | `sensory`, `evaluation`, `taste`, `texture`, `appearance` |
| 48 | `FOOD_EXPORT_GUIDE` | `export`, `import_regulations`, `certification`, `codex` |
| 49 | `FOOD_RISK_ASSESSMENT` | `risk`, `assessment`, `haccp`, `hazard_analysis` |
| 50 | `FOOD_INCIDENT_RESPONSE` | `incident`, `emergency`, `recall`, `crisis_management` |
| 51 | `FOOD_KNOWLEDGE_GENERAL` | `food_safety`, `standard`, `regulation`, `process`, `general` |
| 52 | `default` (fallback) | `food_safety`, `standard`, `regulation`, `process`, `general` |

---

## 3. Matching Analysis

### SQL Matching Mechanism

The Python RAG retriever (`knowledge_retriever.py` line 245) uses:
```sql
AND category = ANY($N::text[])
```

This is an **exact string equality** match. Tag `"additive"` matches DB category `"additive"` only. Tag `"gb2760"` will NOT match anything unless there is a row with `category = 'gb2760'`.

### Unique Java Tags (de-duplicated across all switch cases)

Total unique tags used in Java: **84 tags**

---

## 4. MATCH -- Tags That Exist in DB (14 out of 84)

| Java Tag | DB Category | Doc Count | Used By Intent(s) |
|----------|-------------|-----------|---------------------|
| `additive` | `additive` | 5 | FOOD_ADDITIVE_QUERY, FOOD_ADDITIVE_SAFETY, FOOD_ADDITIVE_ALTERNATIVE, FOOD_ADDITIVE_INTERACTION |
| `standard` | `standard` | 49 | FOOD_STANDARD_LOOKUP, FOOD_KNOWLEDGE_GENERAL, default |
| `regulation` | `regulation` | 21 | FOOD_STANDARD_LOOKUP, FOOD_REGULATION_QUERY, FOOD_REGULATION_PENALTY, FOOD_COMPLIANCE_CHECK, FOOD_KNOWLEDGE_GENERAL, default |
| `haccp` | `haccp` | 16 | FOOD_HACCP_GUIDE, FOOD_HACCP_CCP, FOOD_RISK_ASSESSMENT |
| `certification` | `certification` | 14 | FOOD_CERT_GUIDE, FOOD_EXPORT_GUIDE |
| `process` | `process` | 190 | FOOD_PROCESS_PARAM, FOOD_PROCESS_OPTIMIZATION, FOOD_PROCESS_TROUBLESHOOT, FOOD_KNOWLEDGE_GENERAL, default |
| `allergen` | `allergen` | 7 | FOOD_ALLERGEN_CHECK |
| `cold_chain` | `cold_chain` | 12 | FOOD_COLD_CHAIN |
| `dairy` | `dairy` | 13 | FOOD_DAIRY_GUIDE |
| `bakery` | `bakery` | 12 | FOOD_BAKERY_GUIDE |
| `beverage` | `beverage` | 11 | FOOD_BEVERAGE_GUIDE |
| `testing` | `testing` | 9 | (none -- see note below) |
| `labeling` | `labeling` | 9 | FOOD_ALLERGEN_CHECK |
| `sop` | `sop` | 11 | (none -- see note below) |

**Note**: `testing` and `sop` exist in DB but no Java case uses them as a tag directly. `testing` could map to `FOOD_TEST_METHOD` (which uses `test_method` instead) and `sop` could map to GMP/process intents. These are listed in ORPHAN section below.

**Effective matches: 12 tags** that are both used in Java AND exist in DB.

---

## 5. MISMATCH -- Java Tags That DO NOT Exist in DB (70 out of 84)

These are the **CRITICAL** failures. When these tags are passed to `category = ANY(...)`, they match 0 documents. The RAG query only returns results if at least one tag in the array matches.

### Severity: HIGH (all tags in the array miss DB)

These intents have **ZERO** tags matching any DB category -- they will ALWAYS return 0 RAG documents:

| Intent Code | ragCategories | All Miss DB? | Impact |
|-------------|---------------|-------------|---------|
| `FOOD_THERMAL_CALC` | `thermal`, `pasteurization`, `sterilization`, `f_value` | **ALL MISS** | 0 docs always |
| `FOOD_CONTAMINATION_ASSESS` | `contamination`, `heavy_metal`, `pesticide`, `mycotoxin` | **ALL MISS** | 0 docs always |
| `FOOD_NUTRITION_CALC` | `nutrition`, `calculation`, `dietary_reference` | **ALL MISS** | 0 docs always |
| `FOOD_FORMULA_DESIGN` | `formula`, `recipe`, `ingredient` | **ALL MISS** | 0 docs always |
| `FOOD_SHELF_LIFE` | `shelf_life`, `stability`, `accelerated_test` | **ALL MISS** | 0 docs always |
| `FOOD_NUTRITION_LABEL` | `nutrition_label`, `gb28050`, `nrv` | **ALL MISS** | 0 docs always |
| `FOOD_MICROBE_QUERY` | `microbiology`, `pathogen`, `indicator_organism` | **ALL MISS** | 0 docs always (DB has `microbe` not `microbiology`) |
| `FOOD_TEST_METHOD` | `test_method`, `gb5009`, `analysis` | **ALL MISS** | 0 docs always (DB has `testing` not `test_method`) |
| `FOOD_SAMPLING_PLAN` | `sampling`, `gb2828`, `acceptance` | **ALL MISS** | 0 docs always |
| `FOOD_EQUIPMENT_GUIDE` | `equipment`, `machinery`, `specification` | **ALL MISS** | 0 docs always |
| `FOOD_CIP_GUIDE` | `cip`, `cleaning`, `sanitation` | **ALL MISS** | 0 docs always |
| `FOOD_EQUIPMENT_VALIDATION` | `validation`, `qualification`, `iq_oq_pq` | **ALL MISS** | 0 docs always |
| `FOOD_GMP_GUIDE` | `gmp`, `gb14881`, `prerequisite` | **ALL MISS** | 0 docs always |
| `FOOD_PEST_CONTROL` | `pest_control`, `ipm`, `sanitation` | **ALL MISS** | 0 docs always |
| `FOOD_WATER_QUALITY` | `water_quality`, `gb5749`, `treatment` | **ALL MISS** | 0 docs always |
| `FOOD_WASTE_MANAGEMENT` | `waste`, `effluent`, `environmental` | **ALL MISS** | 0 docs always |
| `FOOD_TRACEABILITY_GUIDE` | `traceability`, `recall`, `supply_chain` | **ALL MISS** | 0 docs always |
| `FOOD_SUPPLIER_AUDIT` | `supplier`, `audit`, `qualification` | **ALL MISS** | 0 docs always |
| `FOOD_TRAINING_GUIDE` | `training`, `competency`, `food_handler` | **ALL MISS** | 0 docs always |
| `FOOD_RND_CONSULT` | `rnd`, `development`, `innovation` | **ALL MISS** | 0 docs always |
| `FOOD_SENSORY_EVAL` | `sensory`, `evaluation`, `taste`, `texture`, `appearance` | **ALL MISS** | 0 docs always |
| `FOOD_AUDIT_PREP` | `audit`, `inspection`, `checklist` | **ALL MISS** | 0 docs always |

### Severity: MEDIUM (some tags match, some miss)

These intents have a mix -- at least one tag matches DB, but others are wasted:

| Intent Code | ragCategories | Matching Tags | Missing Tags |
|-------------|---------------|---------------|--------------|
| `FOOD_ADDITIVE_QUERY` | `additive`, `gb2760` | `additive` (5) | `gb2760` |
| `FOOD_ADDITIVE_SAFETY` | `additive`, `safety`, `toxicology` | `additive` (5) | `safety`, `toxicology` |
| `FOOD_ADDITIVE_ALTERNATIVE` | `additive`, `clean_label`, `natural` | `additive` (5) | `clean_label`, `natural` |
| `FOOD_ADDITIVE_INTERACTION` | `additive`, `interaction`, `compatibility` | `additive` (5) | `interaction`, `compatibility` |
| `FOOD_STANDARD_LOOKUP` | `standard`, `gb`, `regulation` | `standard` (49), `regulation` (21) | `gb` |
| `FOOD_REGULATION_QUERY` | `regulation`, `law`, `compliance` | `regulation` (21) | `law`, `compliance` |
| `FOOD_LABEL_REVIEW` | `label`, `gb7718`, `nutrition_label` | (none match) | `label`, `gb7718`, `nutrition_label` |
| `FOOD_REGULATION_PENALTY` | `regulation`, `penalty`, `enforcement` | `regulation` (21) | `penalty`, `enforcement` |
| `FOOD_HACCP_GUIDE` | `haccp`, `food_safety_system`, `codex` | `haccp` (16) | `food_safety_system`, `codex` |
| `FOOD_HACCP_CCP` | `haccp`, `ccp`, `critical_limit` | `haccp` (16) | `ccp`, `critical_limit` |
| `FOOD_CERT_GUIDE` | `certification`, `iso22000`, `brc`, `fssc` | `certification` (14) | `iso22000`, `brc`, `fssc` |
| `FOOD_PROCESS_PARAM` | `process`, `parameter`, `technology` | `process` (190) | `parameter`, `technology` |
| `FOOD_PROCESS_OPTIMIZATION` | `process`, `optimization`, `efficiency` | `process` (190) | `optimization`, `efficiency` |
| `FOOD_PROCESS_TROUBLESHOOT` | `process`, `troubleshoot`, `defect` | `process` (190) | `troubleshoot`, `defect` |
| `FOOD_SAFETY_CHECK` | `safety`, `hazard`, `risk_assessment` | (none match) | all three |
| `FOOD_RECALL_QUERY` | `recall`, `incident`, `alert` | (none match) | all three |
| `FOOD_ALLERGEN_CHECK` | `allergen`, `cross_contamination`, `labeling` | `allergen` (7), `labeling` (9) | `cross_contamination` |
| `FOOD_COLD_CHAIN` | `cold_chain`, `temperature_control`, `logistics` | `cold_chain` (12) | `temperature_control`, `logistics` |
| `FOOD_DAIRY_GUIDE` | `dairy`, `milk`, `gb19301`, `pasteurization` | `dairy` (13) | `milk`, `gb19301`, `pasteurization` |
| `FOOD_MEAT_GUIDE` | `meat`, `gb2707`, `slaughter`, `curing` | (none match) | all four |
| `FOOD_BAKERY_GUIDE` | `bakery`, `gb7099`, `fermentation`, `baking` | `bakery` (12) | `gb7099`, `fermentation`, `baking` |
| `FOOD_BEVERAGE_GUIDE` | `beverage`, `gb7101`, `carbonation`, `filling` | `beverage` (11) | `gb7101`, `carbonation`, `filling` |
| `FOOD_FROZEN_GUIDE` | `frozen`, `gb19295`, `quick_freeze`, `cold_storage` | (none match) | all four |
| `FOOD_COMPLIANCE_CHECK` | `compliance`, `regulation`, `checklist` | `regulation` (21) | `compliance`, `checklist` |
| `FOOD_PACKAGING_GUIDE` | `packaging`, `gb4806`, `migration`, `shelf_life` | (none match) | all four |
| `FOOD_EXPORT_GUIDE` | `export`, `import_regulations`, `certification`, `codex` | `certification` (14) | `export`, `import_regulations`, `codex` |
| `FOOD_RISK_ASSESSMENT` | `risk`, `assessment`, `haccp`, `hazard_analysis` | `haccp` (16) | `risk`, `assessment`, `hazard_analysis` |
| `FOOD_INCIDENT_RESPONSE` | `incident`, `emergency`, `recall`, `crisis_management` | (none match) | all four |
| `FOOD_KNOWLEDGE_GENERAL` | `food_safety`, `standard`, `regulation`, `process`, `general` | `standard` (49), `regulation` (21), `process` (190) | `food_safety`, `general` |

**Re-classifying**: Intents where ALL tags miss (even though listed as "medium" above) should be HIGH:

- `FOOD_LABEL_REVIEW` -- all 3 tags miss (DB has `labeling` not `label`)
- `FOOD_SAFETY_CHECK` -- all 3 tags miss
- `FOOD_RECALL_QUERY` -- all 3 tags miss (DB has `food_incident` not `recall`/`incident`)
- `FOOD_MEAT_GUIDE` -- all 4 tags miss
- `FOOD_FROZEN_GUIDE` -- all 4 tags miss (DB has `frozen_food` not `frozen`)
- `FOOD_PACKAGING_GUIDE` -- all 4 tags miss (DB has `packaging_tech` not `packaging`)
- `FOOD_INCIDENT_RESPONSE` -- all 4 tags miss

**Total intents with ALL tags missing: 29 out of 42 (69%)**

---

## 6. ORPHAN -- DB Categories Not Referenced by Any Java Case (26 categories)

These categories have documents in the database but no Java intent sends these as ragCategories, making the documents **unreachable** through the intent pipeline:

| DB Category | Doc Count | Likely Related Intent |
|-------------|-----------|----------------------|
| `fraud_detection` | 20 | No intent exists |
| `import_export` | 18 | FOOD_EXPORT_GUIDE uses `export` (not `import_export`) |
| `aquatic` | 17 | No intent exists (aquatic products) |
| `packaging_tech` | 14 | FOOD_PACKAGING_GUIDE uses `packaging` (not `packaging_tech`) |
| `food_incident` | 14 | FOOD_RECALL_QUERY uses `recall`/`incident` (not `food_incident`) |
| `case_study` | 14 | No intent exists |
| `risk_method` | 12 | FOOD_RISK_ASSESSMENT uses `risk` (not `risk_method`) |
| `canned_food` | 12 | No intent exists |
| `functional_food` | 11 | No intent exists |
| `central_kitchen` | 11 | No intent exists |
| `sop` | 11 | No intent references `sop` |
| `infant_food` | 10 | No intent exists |
| `health_food` | 10 | No intent exists |
| `frozen_food` | 10 | FOOD_FROZEN_GUIDE uses `frozen` (not `frozen_food`) |
| `grain` | 9 | No intent exists |
| `factory_design` | 9 | No intent exists |
| `condiment` | 9 | No intent exists |
| `prefab_food` | 8 | No intent exists |
| `edible_oil` | 7 | No intent exists |
| `organic` | 7 | No intent exists |
| `contact_material` | 7 | No intent exists |
| `ecommerce` | 6 | No intent exists |
| `catering` | 6 | No intent exists |
| `novel_food` | 5 | No intent exists |
| `microbe` | 5 | FOOD_MICROBE_QUERY uses `microbiology` (not `microbe`) |
| `testing` | 9 | FOOD_TEST_METHOD uses `test_method` (not `testing`) |

**Total orphaned documents: 314 out of 614 (51%)**

---

## 7. Summary Statistics

| Metric | Value |
|--------|-------|
| DB categories | 38 |
| DB documents total | 614 |
| Java intent cases | 42 + 1 default |
| Unique Java tags | 84 |
| Tags matching DB | **14 (17%)** |
| Tags NOT in DB | **70 (83%)** |
| Intents with ALL tags missing | **29 (69%)** |
| Intents with at least 1 match | **13 (31%)** |
| DB categories reachable | **12 (32%)** |
| DB categories orphaned | **26 (68%)** |
| Reachable documents | ~300 (49%) |
| Orphaned documents | ~314 (51%) |

---

## 8. Root Cause

The Java handler was written with **semantic/descriptive** tag names (e.g., `gb2760`, `safety`, `microbiology`, `thermal`, `packaging`), but the database was seeded with **domain category** names (e.g., `additive`, `microbe`, `process`, `packaging_tech`, `frozen_food`).

The two naming systems were never aligned. The SQL uses `category = ANY(tags)` which requires **exact string match** -- there is no fuzzy matching or synonym resolution.

---

## 9. Recommended Fixes

### Option A: Fix Java Tags to Match DB (Minimal Change)

Change the ragCategories arrays in `FoodKnowledgeIntentHandler.java` to use actual DB category values. This is the fastest fix with no DB migration needed.

**Key mappings to fix:**

| Current Java Tag | Should Be (DB Category) |
|------------------|------------------------|
| `gb2760` | `additive` (already covered) -- remove `gb2760` |
| `safety` | `sop` or `haccp` |
| `toxicology` | `additive` (already covered) |
| `microbiology` | `microbe` |
| `test_method` | `testing` |
| `frozen` | `frozen_food` |
| `packaging` | `packaging_tech` |
| `label` | `labeling` |
| `recall`, `incident` | `food_incident` |
| `risk` | `risk_method` |
| `export` | `import_export` |
| `thermal`, `pasteurization`, `sterilization` | `process` |
| `gmp` | `sop` |
| `equipment`, `machinery` | `process` (or add new category) |
| `contamination`, `heavy_metal`, `pesticide` | `testing` or `microbe` |
| `nutrition`, `formula` | (need new DB category or map to `health_food`) |
| `meat` | (need new DB category or map to `process`) |

### Option B: Add Missing DB Categories (More Comprehensive)

Insert new documents with categories that match the Java tags, OR add aliases/secondary categories to existing documents.

### Option C: Hybrid -- Fix Java Tags + Add Key DB Categories

1. Fix Java tags to use existing DB categories as primary
2. Add a few critical new categories to DB where no suitable existing category exists
3. Add `microbe` to FOOD_MICROBE_QUERY, `testing` to FOOD_TEST_METHOD, etc. (near-miss fixes)

### Recommended: Option C

Priority fix order (by user-facing impact):

1. **P0 -- Near-miss fixes** (5 minutes): `microbiology`->`microbe`, `test_method`->`testing`, `frozen`->`frozen_food`, `packaging`->`packaging_tech`, `label`->`labeling`, `recall`/`incident`->`food_incident`, `risk`->`risk_method`, `export`->`import_export`
2. **P1 -- Map specialized tags to broad categories** (15 minutes): Map `thermal`/`gmp`/`equipment`/`cip`/`contamination`/`nutrition` etc. to existing broad categories like `process`, `sop`, `testing`, `standard`
3. **P2 -- Surface orphaned categories** (30 minutes): Add `frozen_food`, `canned_food`, `grain`, `condiment`, etc. to the `FOOD_KNOWLEDGE_GENERAL` default or create new intents
4. **P3 -- Expand document base** (ongoing): Add documents for categories that Java expects but DB doesn't have (e.g., dedicated `nutrition`, `equipment`, `gmp` categories)

---

## 10. Specific Code Fix for P0 Near-Misses

```java
// BEFORE (0 results):
case "FOOD_MICROBE_QUERY" -> handleFoodQuery(..., new String[]{"microbiology", "pathogen", "indicator_organism"});
// AFTER (5 results from 'microbe'):
case "FOOD_MICROBE_QUERY" -> handleFoodQuery(..., new String[]{"microbe", "testing", "process"});

// BEFORE (0 results):
case "FOOD_TEST_METHOD" -> handleFoodQuery(..., new String[]{"test_method", "gb5009", "analysis"});
// AFTER (9 results from 'testing'):
case "FOOD_TEST_METHOD" -> handleFoodQuery(..., new String[]{"testing", "standard", "process"});

// BEFORE (0 results):
case "FOOD_FROZEN_GUIDE" -> handleFoodQuery(..., new String[]{"frozen", "gb19295", "quick_freeze", "cold_storage"});
// AFTER (10+12 results):
case "FOOD_FROZEN_GUIDE" -> handleFoodQuery(..., new String[]{"frozen_food", "cold_chain", "process"});

// BEFORE (0 results):
case "FOOD_PACKAGING_GUIDE" -> handleFoodQuery(..., new String[]{"packaging", "gb4806", "migration", "shelf_life"});
// AFTER (14 results):
case "FOOD_PACKAGING_GUIDE" -> handleFoodQuery(..., new String[]{"packaging_tech", "contact_material", "standard"});

// BEFORE (0 results):
case "FOOD_LABEL_REVIEW" -> handleFoodQuery(..., new String[]{"label", "gb7718", "nutrition_label"});
// AFTER (9 results):
case "FOOD_LABEL_REVIEW" -> handleFoodQuery(..., new String[]{"labeling", "standard", "regulation"});

// BEFORE (0 results):
case "FOOD_RECALL_QUERY" -> handleFoodQuery(..., new String[]{"recall", "incident", "alert"});
// AFTER (14 results):
case "FOOD_RECALL_QUERY" -> handleFoodQuery(..., new String[]{"food_incident", "regulation", "case_study"});

// BEFORE (0 results):
case "FOOD_INCIDENT_RESPONSE" -> handleFoodQuery(..., new String[]{"incident", "emergency", "recall", "crisis_management"});
// AFTER (14+14 results):
case "FOOD_INCIDENT_RESPONSE" -> handleFoodQuery(..., new String[]{"food_incident", "case_study", "regulation"});

// BEFORE (0 results):
case "FOOD_MEAT_GUIDE" -> handleFoodQuery(..., new String[]{"meat", "gb2707", "slaughter", "curing"});
// AFTER (190 results from process):
case "FOOD_MEAT_GUIDE" -> handleFoodQuery(..., new String[]{"process", "haccp", "standard"});

// BEFORE (0 results):
case "FOOD_RISK_ASSESSMENT" -> handleFoodQuery(..., new String[]{"risk", "assessment", "haccp", "hazard_analysis"});
// AFTER (12+16 results):
case "FOOD_RISK_ASSESSMENT" -> handleFoodQuery(..., new String[]{"risk_method", "haccp", "sop"});

// BEFORE (partial match, but 'export' misses):
case "FOOD_EXPORT_GUIDE" -> handleFoodQuery(..., new String[]{"export", "import_regulations", "certification", "codex"});
// AFTER (18+14 results):
case "FOOD_EXPORT_GUIDE" -> handleFoodQuery(..., new String[]{"import_export", "certification", "standard"});

// BEFORE (0 results):
case "FOOD_SAFETY_CHECK" -> handleFoodQuery(..., new String[]{"safety", "hazard", "risk_assessment"});
// AFTER:
case "FOOD_SAFETY_CHECK" -> handleFoodQuery(..., new String[]{"haccp", "risk_method", "sop"});

// General fallback should include more categories:
case "FOOD_KNOWLEDGE_GENERAL" -> handleFoodQuery(..., new String[]{"standard", "regulation", "process", "haccp", "sop"});
```

---

## 11. Verification Query

After applying fixes, run this to verify all Java tags resolve to documents:

```sql
-- Check which tags return 0 documents
WITH java_tags AS (
  SELECT unnest(ARRAY[
    'additive','standard','regulation','haccp','certification','process',
    'allergen','cold_chain','dairy','bakery','beverage','labeling',
    'microbe','testing','frozen_food','packaging_tech','food_incident',
    'risk_method','import_export','case_study','sop','contact_material',
    'health_food','functional_food','canned_food','central_kitchen',
    'infant_food','grain','factory_design','condiment','prefab_food',
    'edible_oil','organic','ecommerce','catering','novel_food',
    'fraud_detection','aquatic'
  ]) AS tag
)
SELECT t.tag, COALESCE(d.cnt, 0) AS doc_count
FROM java_tags t
LEFT JOIN (
  SELECT category, COUNT(*) AS cnt
  FROM food_knowledge_documents
  WHERE is_active = TRUE
  GROUP BY category
) d ON d.category = t.tag
ORDER BY doc_count ASC, t.tag;
```
