# T6.6 Q1 Sign-off: Real DB (not Mock) — Spec Amendment

**Decision date**: 2026-05-09
**Decision by**: Steve (organizer directive)
**Affects**: PR #180 (T6.6 main spec) + PR #199 (production-port detail) + PR #203 (quality-port detail)
**Spec author**: Q1 amendment dispatch chat (organizer-handed)
**Branch**: `ops-q1-spec-amendment-real-db`
**Status**: Spec amendment / planning artifact only — execution still blocked until T6.5 Phase B + C complete (~2026-07-09)

---

## 0. TL;DR

T6.6 Phase B `/analysis/production` (PR #199) and `/analysis/quality` (PR #203) detail specs both surfaced the same Q1: **mock-parity (1.5–2 person-days each) vs real-DB upgrade (~5 person-days each, ~10 person-days combined)?** The default in both detail specs was "keep mock parity" pending Steve sign-off.

**Steve has signed off 2026-05-09: choose Option B — real DB.**

Rationale: real restaurant chain data already lives in repo (22 Excel/CSV files spanning 14 chains, multi-month coverage). Going real-DB rather than maintaining synthetic Java `Random(factoryId.hashCode())` mock parity:

- Eliminates the `_JavaRandom` LCG + `_java_string_hashcode` bit-exact reproduction primitive (PR #199 §3 BLOCKER, PR #203 §2.2 D1) — no longer needed.
- Removes the Q4 frozen-sentinel timestamp problem entirely (real-DB rows have stable `created_at`/`updated_at`, no `LocalDateTime.now()` per-request drift).
- Makes the eventual `/analysis/production` + `/analysis/quality` outputs **business-meaningful** for showcase / customer demos rather than synthetic noise.
- Aligns with the project's existing Silver/Gold layer data fabric pattern (`fact_pos_transaction`, `agg_restaurant_daily_ops`, etc.) already populated for restaurant analytics.

**Effort revision**: T6.6 Phase B production+quality combined effort revised from **3–4 person-days** (mock) → **~10 person-days** (real-DB). Plus shared upfront ETL infrastructure (Step 1 + Step 2 + Step 3 below) of ~10 person-days. **Total T6.6 Phase B: ~20 person-days**.

This amendment does NOT change T6.6 Phase A design (PR #196), the `/query` endpoint port (PR #180 §2.3 — already real), the `/drill-down` parity-verify (PR #180 §2.4 — already exists Python), the cutover/Phase C/Phase D plan, or any T6.5 dependency. It strictly updates the data source decision for the production + quality endpoints.

⛔ HOLD — same as PR #180 §9: spec amendment only, no code changes, no deploys, no migrations. T6.6 Phase B kickoff still requires T6.5 Phase B + C complete ≥30 days.

---

## 1. Decision

| Aspect | Old default (PR #196 §7 Q1, PR #199 §8 Q1, PR #203 §1.3) | New decision (this amendment) |
|---|---|---|
| Q1 path | Option A — keep mock-data parity | **Option B — real DB** |
| Production data source | `generateMockProductionData(factoryId, startDate, endDate)` mirror | Real OEE / equipment / production-line data from Excel imports + Silver/Gold tables |
| Quality data source | `generateMockQualityData(factoryId, startDate, endDate)` mirror | Real defect / rework / FPY data from Excel imports + Silver/Gold tables |
| Effort production endpoint | 1.5–2 person-days | ~5 person-days (impl) + share ETL costs |
| Effort quality endpoint | 1.5–2 person-days | ~5 person-days (impl) + share ETL costs |
| `_JavaRandom` LCG primitive | **REQUIRED** (PR #199 §3 + PR #203 D1) | **NOT NEEDED** — drop entirely |
| Frozen-sentinel timestamps | Required (PR #199 Q4) | NOT NEEDED — real `created_at` from DB |
| Goldens shape | 8 production + 8 quality (4 modes × 2 factories) | Same count, but recorded against real data |
| Phase 2A dict-eq gate | Applies | Applies (unchanged) |
| Service impl Java file fate | KEEP (Dashboard composite still uses) | KEEP (unchanged — Dashboard still uses original Java mock impl until Phase 2C handles it) |

**Critical implication for Java side**:

The Java `ProductionAnalysisServiceImpl` and `QualityAnalysisServiceImpl` files **stay unchanged** through T6.6. They keep returning mock data because they still serve `SmartBIDashboardController` composites (per PR #178 §3.2.a, PR #180 §2.6). T6.6 Phase D removes only the **controller method bodies** (`SmartBIAnalysisController::getProductionAnalysis` + `::getQualityAnalysis`), NOT the service impls.

This means **post-T6.6 cutover, Java path is mock and Python path is real** — they intentionally diverge. dict-eq gate **does NOT apply between Java and Python anymore** for these two endpoints once cutover happens, because they are no longer equivalent surfaces. Phase B must record goldens against the **Python real-DB output** as the new source of truth, and Phase D removes the Java path entirely.

This is a meaningful semantic shift from the rest of Phase 2A. Reviewer audits per Rules 1–12 still apply for Python correctness, but the "Java prod 10010 dict-eq vs Python prod 8083" comparison gate is replaced by "Python real-DB output vs Python golden snapshot" gate.

---

## 2. Data Source Inventory

### 2.1 Path

```
smartbi维度分析/大众点评/真实餐饮连锁数据/
```

### 2.2 File inventory (22 files, 14 restaurant chains)

| Chain (Chinese) | Cuisine | Files | Time coverage |
|---|---|---|---|
| IL TEATRO 西餐厅 | Western | 1 sales (.xls + .xlsx pre-converted) | 2026 February |
| 上马火锅 | Hot pot | 1 sales (.xls + .xlsx) | 2026 February |
| 锦川火锅 | Hot pot | 5 months sub-dir | 5 months |
| 唏嘛香 牛肉面 | Noodles | 1 sales (.xls + .xlsx) | 2026 February |
| 御九井 日料 | Japanese | 1 sales (.xls + .xlsx) | 2026 February |
| 永和豆浆 快餐 | Fast food | 1 sales (.xls + .xlsx) | 2026 February |
| 鑫巴蜀 | Sichuan | 5 months sub-dir | 5 months |
| 青花椒 | Sichuan | top + 25年 sub-dirs | 2 months + 2025 history |
| 东门口 | Local | 2 reports (sales + purchase, .csv) + 25年 sub-dir | 2026 February + 2025 history |
| 鸿德记 | — | 5 months sub-dir | 5 months |
| 今日牛事 | Beef | 5 months sub-dir | 5 months |
| 有滋有味 | — | 5 months sub-dir | 5 months |
| 邻家宴 | — | 5 months sub-dir | 5 months |
| 火锅 (generic profit report) | Hot pot | 1 profit (.xls) | 2026 February |

Plus a generic dianping-export top-level item `20260306094202727_e72f865f5e1_商品销量报表.xlsx`.

### 2.3 Data types observed

| Report type | File pattern | Structure | Used for |
|---|---|---|---|
| 商品销量报表 (sales by product) | `*商品销量报表.xls(x)` | 17 columns: 门店名称 / 商品分类 / 商品类别 / 商品名称 / 编码 / 商品类型 / 点单方式 / 销售数量 / 退货数量 / 单位 / 销售单价 / 销售金额 / 折后金额 / 已摊优惠 / 实退金额 / 实收 | Quality endpoint (defects/FPY-equivalent), production endpoint (output) |
| 采购入库明细报表 (purchase entry) | `*采购入库明细报表.csv` or `.xls(x)` | 21 columns: 店铺名称 / 单号 / 单据业务日期 / 单据操作日期 / 状态 / 入库仓库 / 供应商 / 原料分类 / 原料条形码 / 原料名称 / 规格 / 入库单位 / 入库数量 / 计价单位 / 单价(元) / 金额(元) / 税率(%) / 不含税单价(元) / 不含税金额(元) / 税额(元) / 整单备注 | Material cost basis for OEE / equipment cost analysis |
| 利润表 (P&L profit report) | `*利润表.xls` | 10 columns: 项目 / 行次 / 本年发生 / 占比 / 本年发生 / 占比 / 预算数 / 预算占比 / 上年同期 / 上年同期占比 (75 rows item-by-item) | Quality / production cost-derivation context |
| 月度报表 / multi-month sub-dirs | `5个月/` `25年/` directories | Repeated monthly Excel exports (similar 17-col structure) | Trend / time-series analysis |
| 收入管理报表 | `收入管理报表.xlsx` (青花椒) | Income management — supplements sales | Composite revenue analytics |
| 评价下载 | `评价下载*.xlsx` (青花椒) | Customer reviews from 大众点评 | Quality-feedback analytics (advanced T6.6+ scope) |

### 2.4 Format notes

- Most `.xls` files are **legacy Excel 97-2003 binary format** (BIFF8). Need `xlrd` (Python) for reading.
  - `openpyxl` only handles modern `.xlsx`.
  - `xlrd >= 2.0` removed `.xls` support; need `xlrd == 1.2.0` for legacy `.xls` OR use `xlrd2` fork.
  - **Verified Python 3 reads them correctly** with `xlrd 1.2.0` (sample profit report 75 rows × 10 cols loaded clean).
- `xlsx_converted/` and `xlsx/` subdirectories contain **6 pre-converted `.xlsx` versions** of select sales reports — these are usable directly with `openpyxl` (faster + more robust).
- One CSV file (`东门口2月采购入库明细报表.csv`) — UTF-8 with BOM, comma-delimited, multi-line headers (lines 1-3 are metadata banners, line 4 is header, line 5+ data).
- Chinese encoding mostly UTF-8 in `.xlsx` and `.csv`. Some `.xls` legacy files internally GBK; Python sees corrupted bytes via openpyxl but xlrd handles GBK natively.
- Some sub-directories contain `.zip` archives (`订单销售明细表.zip`) — need `unzip` step in ETL.

---

## 3. Schema Compatibility Analysis

### 3.1 Existing SmartBI Silver/Gold tables

Verified by reading `backend/python/smartbi/database/migrations/`:

| Table | Layer | Grain | Coverage of Excel data |
|---|---|---|---|
| `dim_ingredient` | Silver dim | Per ingredient (factory-scoped) | ⭐ HIGH — `原料名称` / `原料分类` / `规格` / `单位` map directly |
| `dim_product` | Silver dim | Per menu item | ⭐ HIGH — `商品名称` / `商品分类` map |
| `dim_store` | Silver dim | Per store within chain | ⭐ HIGH — `门店名称` / `店铺名称` / `店铺编码` |
| `dim_staff` | Silver dim | Per staff | ⚠️ PARTIAL — Excel data does not break down by staff |
| `fact_pos_transaction` | Silver fact | Per bill | ⭐ HIGH — sales bill grain matches; needs synthesis from product-line aggregates |
| `fact_pos_item` | Silver fact | Per bill × product line | ⭐ HIGH — Excel sales reports directly map to this grain |
| `fact_pos_payment` | Silver fact | Per payment line | ⚠️ PARTIAL — limited payment detail in Excel |
| `fact_pos_discount` | Silver fact | Per discount line | ⚠️ PARTIAL — `已摊优惠` column present but coarse |
| `fact_restaurant_requisition` | Silver fact | Per material requisition | ⭐ HIGH — purchase entry maps via `单据业务日期` + `原料` + `数量` + `金额` |
| `fact_restaurant_wastage` | Silver fact | Per wastage event | ❌ MISSING — Excel data has no wastage column. Quality endpoint needs **alternative source** (review data? or rate-derived from sales-vs-purchase delta?) |
| `fact_restaurant_recipe_line` | Silver fact | Recipe BOM line | ❌ MISSING — Excel data has no BOM info |
| `fact_restaurant_stocktaking` | Silver fact | Stocktaking event | ❌ MISSING — Excel data has no stocktaking |
| `agg_restaurant_daily_ops` | Gold agg | Per factory × date | ⭐ HIGH — synthesizable from facts |
| `agg_restaurant_daily_totals` | Gold agg | Per factory × date | ⭐ HIGH — synthesizable from facts |
| `agg_restaurant_product_cost` | Gold agg | Per factory × date × product | ⭐ HIGH — synthesizable from sales + purchase |

### 3.2 Mapping verdict

**For `/analysis/quality` (PR #203)**:

- **Defect analysis** (`getDefectAnalysis`): NO direct Excel column maps to "defect rate". Closest proxies:
  - **退货数量 (return count)** column in sales report can serve as "defect-like" signal (return = customer rejected = quality issue). Plus 评价下载 (review data) for 青花椒 chain only.
  - Real "defect rate" / "rework rate" / "FPY" are factory-floor manufacturing concepts. Restaurant chain data has them only as **proxies** (returns, complaints, wastage).
  - **Recommendation**: redefine quality endpoint semantics for restaurant context. `defectRate` → `returnRate`, `reworkRate` → `wastageRate` (if `fact_restaurant_wastage` populated, else NULL with explicit "data not available"), `FPY` → `customerSatisfactionRate` (from reviews).
- **Quality cost distribution** (`getQualityCostDistributionChart`): map to `已摊优惠` (discount applied) + return-cost + wastage-cost composite. Approximation acceptable.
- **Quality trend chart**: aggregate by date from `fact_pos_transaction` + `fact_restaurant_wastage` (if populated).

**For `/analysis/production` (PR #199)**:

- **OEE / equipment / production-line metrics**: original Java mock generated synthetic factory-floor metrics (產線A/B/C/D, 設備1-5). Restaurant chain has **NO equipment / production-line concept** in this Excel data.
- **Closest restaurant analogues**:
  - "Production line" → "Kitchen station" or "Store location" (multi-store chains have implicit "store" dimension)
  - "Equipment utilization" → "Store opening rate" / "Hour-of-day utilization"
  - "OEE" → not directly applicable — could be "throughput per hour-day vs theoretical capacity"
- **Recommendation**: redefine production endpoint semantics for restaurant context. Production endpoint becomes "store-level operational metrics" rather than "factory-floor OEE". Or alternatively, **restaurant chains return empty production data with explicit "endpoint not applicable for restaurant tenant type"** message and `/analysis/production` is gated to FACTORY tenant type only.

**Implementation outline**:

The production endpoint may need **tenant-type branching**: FACTORY tenants get real OEE-style data (would require schema not yet present — `fact_production_line` / `fact_equipment_event`), RESTAURANT tenants get a downscaled "store ops" variant or 410-stub.

This is a meaningful design decision for Phase B kickoff. **Open Question 4 below.**

### 3.3 Existing data state in `smartbi_prod_db`

- **Most Silver/Gold tables empty** for the 14 chains in this inventory (none of these chains have factories matching the 75 `factory_id`s currently routed to Python via T6.4).
- F999 (test factory) and F001 (default seed) are populated for unit-test purposes only.
- **Step 3 ETL must**: create new factory_ids for each chain, import the Excel data, and run Silver→Gold materialization.

---

## 4. Implementation Outline (T6.6 Phase B revised plan)

### 4.1 Step 1: Excel/CSV → Canonical CSV normalization (~3 person-days)

**Goal**: Convert all 22 source files into a unified, UTF-8 + canonical-column-named intermediate CSV layer. This is a pre-ETL pure-Python pipeline, not deployed to prod.

**Tasks**:
- Install `xlrd==1.2.0` and `openpyxl` (already present per `requirements.txt` audit needed) for legacy + modern Excel.
- Detect format per file: `.xls` → xlrd, `.xlsx` → openpyxl, `.csv` → csv module.
- Field name standardization: map Chinese column headers to canonical English snake_case (e.g., `门店名称` → `store_name`, `商品名称` → `product_name`, `销售数量` → `sales_qty`, `退货数量` → `return_qty`, `销售金额` → `sales_amount`, `单据业务日期` → `business_date`).
- Skip metadata-banner rows (rows 1-3 in CSV / first 4 rows in profit report).
- Output to `data/imports/restaurant-chains/<chain>/<report-type>/<period>.csv` canonical layout.
- Quarantine malformed rows to `data/imports/_quarantine/` with line+reason; do NOT silently drop.
- Write `data/imports/_index.json` cataloging chain × report-type × period × row count for audit.

**Deliverable**: 22 source files → ~40-50 canonical CSV files (one per chain × report-type × month).

**Effort**: ~3 person-days (1d normalize logic + 1d quirks: encoding, multi-month archives, ZIP unpacking, profit-report multi-row headers + 1d audit index + reviewer pass).

### 4.2 Step 2: ETL into smartbi_prod_db Silver/Gold layer (~3 person-days)

**Goal**: Load canonical CSVs into `dim_*` + `fact_*` Silver tables, then run Gold materialization to populate `agg_restaurant_daily_*`.

**Tasks**:
- Allocate factory_id per chain (Step 3 below).
- Idempotent loader script `scripts/etl/import-restaurant-chain.py --factory-id R_ILTEATRO_REAL --source data/imports/restaurant-chains/IL_TEATRO/...`.
  - Upsert into `dim_store`, `dim_product`, `dim_ingredient` (with factory-scoped uniqueness).
  - Insert into `fact_pos_item` with `(factory_id, source_type='excel', store_id, source_bill_no)` natural key.
  - Insert into `fact_restaurant_requisition` for purchase data.
  - **Wastage left empty** (data not available) — this is documented gap, not a bug.
- Trigger existing Gold materialization (existing migration `2026_05_05_gold_aggregations.sql` covers this).
- Verify RLS policies (factory-scoped tenant isolation) work correctly post-import.

**Effort**: ~3 person-days (1.5d loader + 0.5d Gold trigger verify + 1d RLS smoke + reviewer pass).

### 4.3 Step 3: factory_id naming convention (~0.5 person-day)

Recommend `R_<CHAIN_ROMAN>_REAL` pattern, mirroring existing `R_GML_DEMO` / `R_XMX_FRESH` from Phase 2A:

| Chain | factory_id |
|---|---|
| IL TEATRO 西餐 | `R_ILTEATRO_REAL` |
| 上马火锅 | `R_SHANGMA_HG_REAL` |
| 锦川火锅 | `R_JINCHUAN_HG_REAL` |
| 唏嘛香 牛肉面 | `R_XIMAXIANG_REAL` |
| 御九井 日料 | `R_YUJIUJING_REAL` |
| 永和豆浆 | `R_YONGHE_REAL` |
| 鑫巴蜀 | `R_XINBASHU_REAL` |
| 青花椒 | `R_QINGHUAJIAO_REAL` (note: `RES_3101_009` already exists for 青花椒 staging seed; this is a separate **real-data** factory) |
| 东门口 | `R_DONGMENKOU_REAL` |
| 鸿德记 | `R_HONGDEJI_REAL` |
| 今日牛事 | `R_JINRINIUSHI_REAL` |
| 有滋有味 | `R_YOUZIYOUWEI_REAL` |
| 邻家宴 | `R_LINJIAYAN_REAL` |
| 火锅 (generic) | merge into `R_SHANGMA_HG_REAL` or assign `R_HUOGUO_GENERIC_REAL` — **defer to Phase B kickoff** |

**Open Question 1**: Steve confirm naming convention `R_<CHAIN>_REAL` vs alternatives.

**Open Question 2**: Treat 青花椒 25年 sub-dir as historic continuation of `R_QINGHUAJIAO_REAL` or as a separate `R_QINGHUAJIAO_2025_REAL`? Recommend continuation (just additional `business_date` rows in 2025 range).

**Effort**: ~0.5 person-day (chain → factory_id mapping written into seed migration; Steve sign-off; reviewer audit).

### 4.4 Step 4: Production / Quality service refactor (~10 person-days combined)

Per PR #199 + PR #203 plus Q1=real-DB scope creep:

- Replace Python `_generate_mock_production_data()` / `_generate_mock_quality_data()` with **real-DB query helpers** following Rule 5 (`SELECT *`) + Rule 6 (None-check) per `python-java-port.md`.
- Drop `_JavaRandom` LCG primitive entirely (no longer needed).
- Drop frozen-sentinel timestamp logic (real `created_at` from DB).
- Define semantics for restaurant tenants per §3.2 verdict (likely tenant-type branching, or restaurant-friendly metric redefinitions).
- Goldens recorded against real Python output for the new factory_ids (e.g., `R_ILTEATRO_REAL`, plus F999 retains synthetic-data variant for cross-tenant smoke).
- Reviewer audits per Rules 1–12 (especially Rules 4 / 5 / 6 / 8 / 9 / 10 / 11 / 12 — same checklist as PR #199 §5.2 + PR #203 R1-R7).
- Pytest with mocked DB query helpers (per Phase 2A test pattern).
- Test env deploy via `./scripts/deploy/deploy-smartbi-python.sh --env test`.

**Effort**: ~5 person-days production + ~5 person-days quality = ~10 person-days.

### 4.5 Step 5: Java parity goldens recording at F999 (~2 person-days)

Per `python-java-port.md` Phase 2A pattern: `scripts/record-java-golden.sh F999 R_<CHAIN>_REAL <endpoint> <args>` for each (4 modes × N factories) tuple.

**However**: as noted in §1, post-Q1=real-DB, Java path stays mock and Python path is real. dict-eq Java-vs-Python no longer applies for these endpoints. Goldens are now Python-vs-Python regression goldens, not Java parity goldens.

**Action**: record Java goldens for archival/comparison reference only; treat as informational, not gate. Phase B GO criteria use Python-vs-Python regression match, not Java-vs-Python dict-eq.

**Effort**: ~2 person-days.

### 4.6 Step 6: Byte-shape parity test infrastructure (~2 person-days)

PR #154 already specifies the test infra (StrictDiff comparator, `assert_response_eq` dispatcher). For Q1=real-DB, this remains relevant for Python-vs-Python regression rather than Java-vs-Python parity.

**Effort**: ~2 person-days.

### 4.7 Total revised effort

| Step | Person-days |
|---|---|
| 1. Excel → Canonical CSV | 3 |
| 2. ETL into Silver/Gold | 3 |
| 3. factory_id naming + seed migration | 0.5 |
| 4. Production + Quality service refactor | 10 |
| 5. Java goldens (informational) | 2 |
| 6. Test infrastructure | 2 |
| **Total** | **~20.5 person-days** |

Vs original mock-parity estimate: ~3-4 person-days for production+quality combined.

Increase: ~16 person-days (5x cost). Justified by real-data semantic value + drop of `_JavaRandom` LCG complexity + alignment with project Silver/Gold pattern + showcase-grade output for customer demos.

---

## 5. Trigger Conditions

T6.6 Phase B with Q1=real-DB cannot kickoff until **all** of:

- [ ] T6.5 Phase A audit reviewed + organizer-acknowledged (PR #178 — done)
- [ ] T6.5 Phase B 410-stub of 23 SAFE_NGINX_ROUTED endpoints deployed prod stable ≥30 days
- [ ] T6.5 Phase C method-level service audit + controller body removal complete (~mid-July 2026)
- [ ] 0 customer P1 reports in 30-day post-Phase-C soak window
- [ ] F999 internal test team acknowledges brief outage during cutover (T-72h notice)
- [ ] Phase 2C scoping decisions known (so T6.6 doesn't conflict with parallel ports)
- [ ] **NEW**: Steve signs off Q1 naming convention + 青花椒 split decision (Open Questions 1, 2 in §4.3)
- [ ] **NEW**: Step 1+2+3 ETL infrastructure work scheduled (~6.5 person-days, may be done in parallel with T6.5 Phase B/C)

**ETA**: T6.6 Phase B kickoff ~2026-07-09 to ~2026-07-29 (assuming T6.5 Phase B 30-day soak completes ~2026-06-09 and T6.5 Phase C completes ~2026-07-09). The ETL infrastructure (Steps 1-3) can begin earlier in parallel with T6.5 Phase B/C 30-day soak windows (~mid-June 2026).

---

## 6. Risk Register Updates

Updates to PR #180 §4 risk table:

| Risk | New (Q1=real-DB) | Change |
|---|---|---|
| `_JavaRandom` LCG bit-exact reproduction divergence (PR #199 §3 BLOCKER, PR #203 R1) | **REMOVED** — no longer needed | Risk eliminated |
| Frozen-sentinel timestamp drift (PR #199 Q4) | **REMOVED** | Risk eliminated |
| Real-DB schema gaps for restaurant quality concepts (defects/FPY/rework on restaurant tenant) | **NEW HIGH** | Mitigation: §3.2 verdict — redefine semantics or tenant-type-gate; finalize in Phase B kickoff design doc |
| ETL idempotence + RLS scoping bugs in Step 2 import | **NEW MEDIUM** | Mitigation: Step 1+2 reviewer audit; idempotent upsert keys verified; RLS smoke at end of Step 2 |
| Phase 2A dict-eq gate no longer applies Java-vs-Python | **NEW** | Mitigation: gate replaced by Python-vs-Python regression goldens; documented explicitly so reviewer audits do not falsely flag |
| Excel `.xls` legacy format requires `xlrd==1.2.0` (deprecated lib) | **NEW LOW** | Mitigation: pin version in `requirements.txt` or `requirements-dev.txt`; pre-convert all `.xls` to `.xlsx` upfront in Step 1 |
| Multi-month sub-directories vary in structure | **NEW LOW** | Mitigation: Step 1 normalizer handles per-file format detection + quarantine on failure |
| `R_QINGHUAJIAO_REAL` collides with existing `RES_3101_009` (青花椒 staging) | **NEW LOW** | Mitigation: distinct factory_ids; Open Question 2 |

---

## 7. Out-of-Scope (NOT Q1 amendment)

- T6.6 Phase A `/query` design doc (PR #196) — unaffected; query endpoint always was real, no Q1 question.
- T6.6 Phase A `/drill-down` parity verify (PR #180 §2.4) — unaffected; Python file already exists.
- T6.5 Phase B 410-stubs of 22 OTHER endpoints — unaffected; Q1 is production+quality only.
- T6.6 Phase C cutover plan (PR #180 §3.3) — unaffected; same nginx regex flip.
- T6.6 Phase D Java method body deletion — unaffected; same controller-only deletion.
- Phase 2C SmartBI Config / Dashboard / Upload / PublicDemo — separate scoping (PR #152).
- `GoldDashboardBuilder` / `GoldFinanceClient` retention — unaffected (KEEP per task #24).
- Strict-byte gate adoption — Phase 3+ decision (PR #153).
- Customer-facing positioning of these factories — UNDECIDED (Open Question 3).

---

## 8. Open Questions

| # | Question | Default if no answer |
|---|---|---|
| Q1 | factory_id naming convention — confirm `R_<CHAIN_ROMAN>_REAL` per §4.3 table or alternative? | Use the table above; reviewer flags conflicts at Step 2 |
| Q2 | 青花椒 25年 sub-dir → continuation of `R_QINGHUAJIAO_REAL` or separate `R_QINGHUAJIAO_2025_REAL`? | Continuation (single factory_id, multiple `business_date` periods) |
| Q3 | These 14 real chains — internal showcase only or customer-facing demos? | Internal showcase + sales-demo only; not exposed in customer-facing nginx routing without explicit per-chain opt-in |
| Q4 | `/analysis/production` for restaurant tenant — define restaurant-friendly semantics (store-level ops) OR tenant-type-gate to FACTORY only OR 410-stub for restaurant tenants? | Recommend tenant-type-gate to FACTORY (cleanest); restaurant tenants receive HTTP 200 with empty data + `"notApplicableForTenantType": true` field. Final decision in Phase B kickoff design doc. |
| Q5 | Defect / FPY / rework redefinition for restaurant tenant — `returnRate` (from sales return col) + `wastageRate` (from `fact_restaurant_wastage` if present) + `customerSatisfactionRate` (from review data, only 青花椒 has)? | Yes per §3.2 mapping; Phase B kickoff design doc finalizes. |
| Q6 | ETL idempotence — re-running loader on same source CSV must be safe (UPSERT not INSERT). Existing migrations use `ON CONFLICT DO NOTHING` for similar tables. Verify in Step 2 design. | Yes; reviewer audit gate. |
| Q7 | Customer review data (青花椒 评价下载) — load into separate fact table or aggregate to `fact_pos_transaction.has_complaint` flag? | New `fact_restaurant_review` table preferred; out-of-scope for Q1 amendment but flag for Phase B kickoff. |
| Q8 | `.xls` legacy format — pre-convert all to `.xlsx` upfront in Step 1, or read in-place each ETL run? | Pre-convert + commit to repo (one-time cost ~1h, then no `xlrd` runtime dep). |
| Q9 | If T6.5 Phase B/C slips beyond 2026-07-09 — does T6.6 Phase B Q1=real-DB scope shift to Phase 2C? | NO — Q1 amendment is pre-T6.5 work; Steps 1+2 ETL can be done independently of T6.5 timing. Steps 4+5+6 wait on T6.5. |
| Q10 | `agg_restaurant_*` Gold materialization — already covered by existing `2026_05_05_gold_aggregations.sql` migration, or need extension? | Verify in Step 2 design doc; likely covers daily/totals/product_cost adequately. Quality-specific Gold may need NEW migration. |

---

## 8.1 Resolution Status (Updated 2026-05-12 — Steve verbal sign-off)

Steve resolved key open questions via AskUserQuestion conversations 2026-05-11 / 2026-05-12. Resolutions ratified in canonical spec docs:

| # | Question | Resolution | Evidence |
|---|---|---|---|
| Q1 | factory_id naming convention | ✅ `R_<CHAIN_ROMAN>_REAL` per §4.3 (Q-ETL-3 sign-off) | PR #316 §10 + PR #325 V20260511_02 (14 rows live prod) |
| **Q4** | `/analysis/production` for restaurant tenant | ✅ **Option B 餐饮重定义** — 厨房工位利用率 / 备菜时间 / 翻台率 (NOT tenant-type-gate to FACTORY; supersedes recommended default) | PR #326 Q4/Q5 decision spec §1 |
| **Q5** | Defect / FPY / rework redefinition | ✅ **Option B 餐饮重定义** — 食安事故率 / 投诉率 / 退菜率 / 损耗率 | PR #326 Q4/Q5 decision spec §2 |
| Q7 (related) | Customer review data — fact_restaurant_review separate table? | ⏳ Deferred to Sub-A/B impl spec (per PR #326 §5 ETL backfill deps) | PR #326 §5 Q-DEC-6 (related ETL extension) |

**Q2/Q3/Q6/Q8/Q9/Q10 remain at recommended defaults** — no Steve action required for those, defaults are operational and don't block T6.6 Phase B execution.

**Resolution discovery pattern**: Per HARD rule (`feedback_organizer_dispatch_must_grep_canonical_HOLD.md` + reviewer audit Section E.2 2026-05-11), verbal AskUserQuestion sign-offs MUST be ratified into source-of-truth spec doc to be greppable. This §8.1 closes that gap for Q4 + Q5.

---

## 9. Cross-references

- **PR #180** (T6.6 main spec) — T6.6 base spec; this amendment supersedes PR #180 §2.1 + §2.2 effort estimate (production + quality).
- **PR #196** (T6.6 Phase A design) — caught Q1 spec drift "production+quality are mock data"; this amendment resolves the Q1 question PR #196 §7 raised.
- **PR #199** (production-port detail) — this amendment voids PR #199 §3 BLOCKER (`_JavaRandom`) and PR #199 §8 Q1; impl details otherwise still useful for service method mirroring.
- **PR #203** (quality-port detail) — this amendment voids PR #203 §2.2 D1 (`JavaRandom` helper) and PR #203 §1.3 + §8.8 R7 default; impl details otherwise still useful.
- **PR #205** (T6.5 Phase B 23 stub endpoints — already shipped) — unrelated; T6.5 Phase B does NOT include production/quality endpoints (per PR #178 §6.4 NOT_SAFE_FALLTHROUGH classification).
- **PR #150** (T6.5 deprecation spec) — predecessor; T6.5 Phase C completion is T6.6 trigger.
- **PR #152** (Phase 2C scoping) — separate scope; does NOT include production/quality endpoints.
- **PR #153** (strict-byte gate) — Phase 3+ decision; unaffected.
- **PR #154** (strict-byte test infra spec) — relevant for Step 6 regression infrastructure.
- **`python-java-port.md` Rules 1–12** — still apply for Python correctness review on Steps 4+5; Rule 4 dict-eq gate clarification: Phase 2A standard for Java-vs-Python; here repurposed as Python-vs-Python regression.
- **`server-operations.md` migration runner HARD RULE** — applies to Step 2 ETL idempotence (script writes `V<YYYYMMDD>_NN__import_restaurant_chains.sql` if any DDL needed; data-only loads use ETL python script not migrations).

---

## 10. ⛔ HOLD blocks

- ⛔ This is a **spec amendment / planning doc only** — NO code changes, NO deploys, NO migrations.
- ⛔ T6.6 Phase B kickoff still requires T6.5 Phase B + C complete ≥30 days. This amendment does NOT accelerate the trigger.
- ⛔ Steve sign-off needed on Open Questions 1, 2, 3, 4 BEFORE Phase B kickoff marching order (per PR #199 §9 Q1 + PR #203 §1.3 prereq).
- ⛔ Q1=real-DB decision irreversibly enlarges T6.6 Phase B effort from ~3-4 days to ~20 days. Confirm scope acceptance before proceeding.
- ⛔ Step 1+2+3 ETL infrastructure can be staged independently in parallel with T6.5 Phase B 30-day soak — but separate marching order required, NOT this amendment.
- ⛔ Java `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` files **stay forever** through and after T6.6 (Dashboard composite still binds them — see PR #178 §3.2.a).
- ⛔ Customer-facing routing of the 14 real chains is **NOT enabled** by this amendment. Existing nginx regex (PR #178 §2.2) does NOT include `R_<CHAIN>_REAL` factory_ids; opt-in additions deferred to separate decision per Open Question 3.
- ⛔ This spec amendment is **not** a marching order. Phase B kickoff requires fresh marching order from organizer with concrete chat assignments, artifact paths, and test evidence requirements.

---

## 11. Sign-off

Before Phase B kickoff this spec amendment reviewed by:

- [x] Steve — Q1=real-DB decision recorded 2026-05-09 ✅ (this amendment encodes the decision)
- [ ] Engineering organizer (timing + scope acceptable; effort revision +16 person-days acknowledged; T6.5 dependency unchanged)
- [ ] T6.5 Phase B/C lead (parallel Step 1+2+3 ETL during T6.5 30-day soak window does not interfere)
- [ ] Step 1 ETL designer (canonical CSV schema review; xlrd dependency pin; quarantine handling)
- [ ] Step 2 ETL designer (Silver→Gold mapping verify; RLS scope; idempotence)
- [ ] On-call rotation lead (Step 4 cutover schedule consistent with T6.6 Phase C timing)

Sign-off recorded in PR description when this amendment merges main.

---

**End of T6.6 Q1 Sign-off: Real DB (not Mock) — Spec Amendment**
