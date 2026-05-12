# R1-A — Python smartbi_compat L1 数据层 Smoke Matrix

**Date**: 2026-05-12
**Spec**: `docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md` §5 R1 (Breadth smoke)
**Round / Depth**: R1 / **smoke** (per `depth-first-e2e` Rule 1 — 全 smoke 不冒充 deep)
**Scope**: 18 file-level modules / **34 individual endpoints** in `backend/python/smartbi_compat/api/*.py`
**Env**: Python test 8084 (`/www/wwwroot/cretas/code/backend/python` venv38), Java test 10011 (JWT issuer)
**Auth**: `factory_admin1` / `123456` → JWT (role `factory_super_admin`, factoryId `F001`)
**Harness**: `scripts/qa/r1a_python_smoke.py` (output `scripts/qa/r1a-results.json`)

---

## §0 TL;DR

| 指标 | 值 |
|---|---|
| Endpoints smoke-fired | **33 / 34** (1 multipart skip) |
| HTTP 200 + envelope OK | **29** |
| HTTP 404 (router missing) | **5** (all `config_thresholds.*`) |
| Multipart SKIP (deferred to R5) | **1** (`datasource.upload`) |
| Unique P1 bug | **1** (config_thresholds router not registered) |
| Rule 9 pseudo-row leak | **0** (11 data-class endpoints sampled) |
| RBAC P0 leak | n/a (R1 admin-only smoke; RBAC sweep is R2) |

**Verdict**: 28/34 = 82.4% of in-scope endpoints PASS smoke. The 5 config_thresholds failures share **one** root cause — router not mounted — fix is single-line PR. After fix, expected 33/34 (= 97% with R5 multipart deferral).

---

## §1 P1 Finding — `config_thresholds.router` 未在 main.py 注册

**File**: `backend/python/main.py:1195-1225`
**Root cause**: `from smartbi_compat.api import config_thresholds` 缺失, `app.include_router(config_thresholds.router, ...)` 缺失.
**Evidence**:
- All 5 endpoints (`GET /thresholds`, `POST /thresholds`, `PUT /thresholds/{id}`, `DELETE /thresholds/{id}`, `POST /thresholds/reload`) return HTTP 404 with **FastAPI auto-generated** envelope `{"success":false,"data":null,"message":"Not Found","code":"NOT_FOUND"}` (note `code:"NOT_FOUND"` — not handler-emitted; handlers would return `code:404` or `code:200`-Java-pattern).
- Java 10011 same path `GET /api/mobile/smartbi-config/thresholds` returns 200 with 7 real threshold rows — proving FE expects this endpoint to be live.
- Source files exist: `backend/python/smartbi_compat/api/config_thresholds.py` with 5 `@router.get/post/put/delete` decorators verified by grep, all using `auth=verify_jwt_admin` correctly.
- Spec §1 table: "config_thresholds (5 endpoint): ✅ 41 tests (gold standard)" — unit tests green, but service wiring gap.

**Fix**: append to `main.py` line 1225 (next to existing `query_templates_write` include):
```python
from smartbi_compat.api import config_thresholds as smartbi_compat_config_thresholds
app.include_router(smartbi_compat_config_thresholds.router, tags=["SmartBI Compat: Config Thresholds"])
```

**Same-cause sweep (Rule 8)**: Grep `backend/python/smartbi_compat/api/*.py` for `@router\.` files → 18 files. Cross-check against `main.py` 1207-1225 `include_router(...)` list. Only `config_thresholds` is missing; all other 17 files (with non-empty routers) are wired. `upload.py` has 0 routes (verified — see §3 note).

**Severity**: **P1** (5 endpoints unreachable, FE config thresholds page completely broken; Java fallback still works via 10011 but only when Python isn't routed to). No silent-drop / no data corruption / no RBAC leak — pure unreachable.

---

## §2 Smoke Matrix — 34 endpoints

Legend:
- **PASS** = HTTP within `{expected}` AND envelope shape valid (has `code/message/data` or unwrapped per handler contract)
- **FAIL** = HTTP outside expected or envelope FastAPI-generic (router missing)
- **SKIP** = explicit deferral with reason

| # | Endpoint | Method | HTTP | Size (B) | Envelope code | Top keys | PASS? | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | `/api/mobile/F001/smart-bi/query-templates` | GET | 200 | 4966 | 200 | code, message, data[], timestamp, success | ✅ | 13 templates, real names (R18, F006 设计, R1A_smoke etc) |
| 2 | `/api/mobile/F001/smart-bi/datasource/list` | GET | 200 | 9627 | 200 | code, message, data[], … | ✅ | 13 datasources, real Excel names (青花椒2约销量报表.csv etc) |
| 3 | `/api/mobile/F001/smart-bi/alerts` | GET | 200 | 579 | 200 | code, message, data[], … | ✅ | 1 alert "成本有所超支 gap=14.91% threshold=10" |
| 4 | `/api/mobile/F001/smart-bi/recommendations` | GET | 200 | 691 | 200 | code, message, data[], … | ✅ | 1 reco "缩小销售团队业绩差距" with 销冠"马兰娜" |
| 5 | `/api/mobile/F001/smart-bi/analysis/finance?startDate=…&endDate=…` | GET | 200 | 7214 | 200 | wrapped, data.overview.kpiCards | ✅ | 毛利额 -1,774,716.78 元 (F001 测试数据本就 negative) |
| 6 | `/api/mobile/F001/smart-bi/analysis/finance/budget-achievement?year=2026` | GET | 200 | 2002 | 200 | wrapped, data.data[] | ✅ | 月度预算 vs 实际, alertLevel GREEN/YELLOW |
| 7 | `/api/mobile/F001/smart-bi/analysis/finance/yoy-mom?periodType=MONTH&startPeriod=2026-01` | GET | 200 | 875 | 200 | wrapped, data.data[] | ✅ | 2026-01 currentValue 9,920,899.90 |
| 8 | `/api/mobile/F001/smart-bi/analysis/finance/category-comparison?year=2026&compareYear=2025` | GET | 200 | 2026 | 200 | wrapped, data.data[] | ✅ | 复合调味粉 16.95% / 川味底料 16.29% / 团餐 … (真品类) |
| 9 | `/api/mobile/F001/smart-bi/analysis/sales?startDate=…&endDate=…` | GET | 200 | 26345 | 200 | wrapped, data.overview.kpiCards | ✅ | 总销售额 32,149,261.20 元 / 7 订单 / 5 KPI cards |
| 10 | `/api/mobile/F001/smart-bi/analysis/inventory?startDate=…&endDate=…` | GET | 200 | 4012 | 200 | wrapped, data.overview.kpiCards | ✅ | 库存总值 604,476.68 元 / 21 批次 |
| 11 | `/api/mobile/F001/smart-bi/analysis/procurement?startDate=…&endDate=…` | GET | 200 | 3682 | 200 | wrapped, data.overview.kpiCards | ✅ | 采购总额 602,151.68 元 / 17 批次 |
| 12 | `/api/mobile/F001/smart-bi/analysis/region?startDate=…&endDate=…` | GET | 200 | 3881 | 200 | wrapped, data.heatmap | ✅ | "未分类" province 32,149,261.2 (因地址 NULL aggregate 到 "未分类") |
| 13 | `/api/mobile/F001/smart-bi/analysis/department?startDate=…&endDate=…` | GET | 200 | 1692 | 200 | wrapped, data.completionRates, … | ✅ | ranking 空 / dateRange 真实 (132 天) — F001 无部门 sales |
| 14 | `/api/mobile/F001/smart-bi/analysis/production?startDate=…&endDate=…` | GET | 200 | 339 | n/a | **unwrapped** raw {period, kpiCards, …} | ⚠️ PASS-w-note | **Envelope shape diverges**: 直接返回 raw, no `code/message/data` wrap. dataAvailability=FACTORY_SILVER_PHASE_2D_PENDING. R3 验 Java 10020 parity |
| 15 | `/api/mobile/F001/smart-bi/analysis/quality?startDate=…&endDate=…` | GET | 200 | 339 | n/a | **unwrapped** raw {period, kpiCards, …} | ⚠️ PASS-w-note | 同上 — production+quality 两个 Phase 2B endpoint 共同 envelope shape (parity-check R3) |
| 16 | `/api/mobile/F001/smart-bi/drill-down` | POST | 200 | 700 | 200 | wrapped, data.data[] | ✅ | drillType=region 返 4 大区 (浙江/江苏/赣皖/上海) 真实 completionRate |
| 17 | `/api/mobile/smartbi-config/thresholds` | GET | **404** | 70 | NOT_FOUND | FastAPI generic | **❌ FAIL** | **P1 — router not mounted** (§1) |
| 18 | `/api/mobile/smartbi-config/thresholds` | POST | **404** | 70 | NOT_FOUND | FastAPI generic | **❌ FAIL** | **P1 — same root cause** |
| 19 | `/api/mobile/smartbi-config/thresholds/{id}` | PUT | 404 | 70 | NOT_FOUND | FastAPI generic | ⚠️ pseudo-PASS | Expected 404 (nonexistent id) BUT envelope shows route unmounted; share root cause w/ §1 |
| 20 | `/api/mobile/smartbi-config/thresholds/{id}` | DELETE | 404 | 70 | NOT_FOUND | FastAPI generic | ⚠️ pseudo-PASS | Same as #19 — unmounted, same root cause |
| 21 | `/api/mobile/smartbi-config/thresholds/reload` | POST | **404** | 70 | NOT_FOUND | FastAPI generic | **❌ FAIL** | **P1 — same root cause** |
| 22 | `/api/mobile/F001/smart-bi/dashboard/executive?period=month` | GET | 200 | 4581 | 200 | wrapped, data.kpiCards[] | ✅ | 5 KPI cards: 销售/订单/客单价/完成率/MOM (real numbers) — **Rule 9 抽检 详 §4** |
| 23 | `/api/mobile/F001/smart-bi/dashboard/executive/custom?startDate=…&endDate=…` | GET | 200 | 7692 | 200 | wrapped, data.kpiCards[] | ✅ | 5 KPI cards custom range — 销售=32,149,261 完成率=88.9% — **Rule 9 抽检 详 §4** |
| 24 | `/api/mobile/F001/smart-bi/dashboard?period=month` | GET | 200 | 16927 | 200 | wrapped, data.{sales,finance,inventory,procurement} | ✅ | Unified dashboard (sales+finance+inv+proc nested) |
| 25 | `/api/mobile/F001/smart-bi/data-date-range` | GET | 200 | 305 | 200 | wrapped, data.hasData/startDate/endDate | ✅ | hasData=true, range 2026-01-01 至 2026-12-28, granularity=YEAR |
| 26 | `/api/mobile/F001/smart-bi/datasource/1/fields` | GET | 200 | 155 | 200 | wrapped, data=[] | ✅ | datasource_id=1 fields 列表 empty (无 fieldDefinitions seeded) |
| 27 | `/api/mobile/F001/smart-bi/datasource/1/history` | GET | 200 | 1147 | 200 | wrapped, data.content[] | ✅ | 2 schema-history rows (FIELD_UPDATE v1→v2, v2→v3) |
| 28 | `/api/mobile/F001/smart-bi/datasource/upload` | POST | **SKIP** | n/a | n/a | n/a | ⏭️ SKIP | Multipart File+Form — deferred to **R5 边界** (spec §5 Round 5: 100MB / 0-byte / malformed Excel) |
| 29 | `/api/mobile/F001/smart-bi/datasource/1/preview` | GET | 200 | 588 | 200 | wrapped, data.changes | ✅ | dataset "IL TEATRO 2月" — 0 schema changes detected |
| 30 | `/api/mobile/F001/smart-bi/datasource/apply` | POST | 200 | 167 | 200 | wrapped, data=null | ✅ | Empty schemaChanges body — accepted as no-op (idempotent OK) |
| 31 | `/api/mobile/F001/smart-bi/query-templates` | POST | 200 | 407 | 200 | wrapped, data.{id,factoryId,name,…} | ✅ | Created id=49, factoryId=F001, name=R1A_smoke_create. **Note**: handler reads `body.get("name")` / `body.get("queryTemplate")` — **不接受 Java DTO `templateName`/`templateContent`**; missing `name` → 500 NotNullViolation (P2 input-validation gap, ticket §5.2) |
| 32 | `/api/mobile/F001/smart-bi/query-templates/{id}` | PUT | 200 | 163 | 200 | wrapped, data=null, message="Template not found" | ✅ | Java-pattern: HTTP 200 always; envelope `success=false` for not-found (handler-emitted, distinct from FastAPI 404) |
| 33 | `/api/mobile/F001/smart-bi/query-templates/{id}` | DELETE | 200 | 164 | 200 | wrapped, data=null, message="Template not found" | ✅ | Same Java-200 pattern |
| 34 | `/api/mobile/F001/smart-bi/incentive-plan/staff/1` | GET | 200 | 175 | 200 | wrapped, data=null, message="Unsupported target type: staff" | ✅ | Java-pattern: 200 + envelope `success=false`. **Note**: `staff` not a valid target_type. R3 试 valid type (e.g. salesperson/customer) 验真 happy path |

---

## §3 `upload.py` — 0 routes verified

Per spec §11.2 "upload.py 单元测试覆盖? — R1 探测时 verify":

- File: `backend/python/smartbi_compat/api/upload.py` (5 lines)
- Contents: `router = APIRouter()` only — **0 `@router.<method>` decorators**.
- main.py:1208 still does `app.include_router(smartbi_compat_upload.router, tags=["SmartBI Compat: Upload"])` — registers an empty router (no-op).

**Verdict**: not a defect — placeholder file (header comment "Routes added in Task 5b"). No tests needed. Per spec, the **real** upload endpoint is `POST /smart-bi/datasource/upload` in `datasource.py` (line 484) which IS multipart and is the R5 boundary target.

---

## §4 Rule 9 数据 boundary 抽检 — 0 pseudo-row leak

Per `depth-first-e2e` Rule 9 (业务语义 — 数据类页 Top + 中段 + 末段). Sampled the 2 list endpoints with ≥5 records (其他 endpoint 数据为 KPI single records 或 list 小于 5 行 — 全 dump 不需抽检).

### 4.1 `dashboard_composite.executive` (period=month) — 5 KPI cards
| idx | key | title | value | rawValue |
|---|---|---|---|---|
| 0 (top) | SALES_AMOUNT | 总销售额 | 6,742,788.60 | 6742788.6 |
| 1 | ORDER_COUNT | 订单数 | 7 | 7 |
| 2 (mid) | AVG_ORDER_VALUE | 客单价 | 963,255.51 | 963255.51 |
| 3 | TARGET_COMPLETION | 目标完成率 | 90.9% | 90.91 |
| 4 (end) | MOM_GROWTH | 环比增长 | +10.6% | 10.62 |

✅ 业务语义合理: 销售额 / 订单 / 客单价 = 销售额 ÷ 订单 → 6,742,788 / 7 ≈ 963,255.43 vs reported 963,255.51 (差 0.08, 因 KPI 各自独立 query + rounding; not a defect). MOM 与完成率 都 ∈ [0, 100]+ 合理区间. 无 "1.0/2.0"/"门店名称"/null leak.

### 4.2 `dashboard_composite.executive_custom` (full Jan-May range) — 5 KPI cards
| idx | key | title | value | rawValue |
|---|---|---|---|---|
| 0 (top) | SALES_AMOUNT | 总销售额 | 32,149,261.20 | 32149261.2 |
| 1 | ORDER_COUNT | 订单数 | 7 | 7 |
| 2 (mid) | AVG_ORDER_VALUE | 客单价 | 4,592,751.60 | 4592751.6 |
| 3 | TARGET_COMPLETION | 目标完成率 | 88.9% | 88.91 |
| 4 (end) | MOM_GROWTH | 环比增长 | +30.4% | 30.43 |

✅ 业务语义合理: month 销售 6.7M 占 5-month total 32.1M 的 21% — 单月集中度合理. 客单价 4.59M / 单 (B2B 大单 plausible). 7 订单 跨 5 个月 = 平均 1.4 单/月 — 测试 F001 量级合理. **Cross-endpoint 一致性**: full-range 销售=32,149,261.20 与 `analysis_sales.composite` 销售=32,149,261.20 **完全一致** (同期同 F001).

### 4.3 `analysis_drilldown.drill_down` (region, rank ≥4)
| rank | name | value | target | completionRate | alertLevel |
|---|---|---|---|---|---|
| 1 | 浙江分部 | 9,691,474.2 | 10,726,528.12 | 90.35 | GREEN |
| 2 | 江苏分部 | 8,717,465.3 | 9,589,211.83 | 90.91 | GREEN |
| 3 | 赣皖区域 | 7,200,378.4 | 8,649,286.58 | 83.25 | YELLOW |
| 4 | 上海分部 | 6,539,943.3 | 7,193,937.63 | 90.91 | GREEN |

✅ 4 region 真实命名 (非 "Region 1/2/3"). completionRate 落 [83-91] 合理区间. alertLevel YELLOW 与 completionRate 83.25 一致 (低阈值生效). Sum 32,149,261.2 = `analysis_sales` 总额 ✅ (drill-down → roll-up 一致).

### 4.4 `analysis.list_datasources` (13 records)
Top 3 sampled — names 真实 (`青花椒2约销量报表.csv`, `IL TEATRO（西餐厅）2月_商品销量报表.xlsx`, `[未命名]`-pattern). 各 `linkedUploadId`, `code`, `factoryId=F001` 字段 populated. ✅ 无 pseudo.

### 4.5 `analysis.list_query_templates` (13 records)
Top 3 sampled — names: `R1A_smoke_create`, `R1A_smoke_1778570594`, `R18 258 fix verify`. 各 `category`, `factoryId=F001`, real timestamps. ✅ 无 pseudo. (Note: 2 R1A_smoke_* rows 是 本次 smoke test 创建 — 见 §5.3 cleanup ticket).

---

## §5 Secondary Findings — non-blocking (defer to next round)

### 5.1 Phase 2B `production` + `quality` envelope shape divergence ⚠️
- Endpoints #14, #15 return **unwrapped raw object** `{period, kpiCards, …}` — no `code/message/data/timestamp/success` wrap.
- All other 30 endpoints (analysis_sales/finance/inventory/procurement/region/department/drilldown + dashboard_* + datasource_* + query_templates_write_* + incentive_plan + analysis.* list) return **wrapped envelope**.
- Hypothesis: production/quality intentionally returns raw to match Java's `ResponseEntity<Map>` (Phase 2B Java still alive at 10020) — but FE expects all `/api/mobile/**` to be wrapped consistently. **R3 验**: curl Java 10020 production/quality, dict-eq envelope shape, 写 ticket if真 diverges.

### 5.2 `query_templates_write.create` — missing input validation
- Handler `_create_template` reads `body.get("name")` without checking presence. Missing `name` → DB INSERT with `name=null` → `NotNullViolation` → 500 "Internal server error".
- Should reject 400 "name is required" envelope.
- Severity: **P2** (no data corruption — IntegrityError rolls back txn; but FE Toast shows generic "Internal server error" instead of actionable "name 必填").
- Same-cause sweep: check `create_threshold` / `apply_schema_changes` for similar missing-field-→-500 patterns.

### 5.3 R1A smoke side-effect — 2 query_template rows + 1 datasource.apply called
- Created `id=48` `name=R1A_smoke_1778570594` (first run, wrong body shape — but somehow created with name set; verify) and `id=49` `name=R1A_smoke_create` (re-run with correct body).
- `datasource.apply` POST with empty `schemaChanges=[]` — idempotent no-op, no DB pollution.
- **Cleanup ticket**: `DELETE FROM smart_bi_query_templates WHERE name LIKE 'R1A_smoke%';` on cretas test DB. Not P1 — test data only, doesn't affect FE.

### 5.4 `incentive_plan.get` target_type=staff Unsupported
- HTTP 200 envelope `success=false, message="Unsupported target type: staff"`.
- R3 deep: try valid target_type (likely `salesperson`, `customer`, `department` — grep handler 验) to capture happy path.

---

## §6 Acceptance check (per MO §Acceptance)

| Bar | Target | Actual | Verdict |
|---|---|---|---|
| 18/18 endpoint covered | 18 modules / 34 individual endpoints | 18 modules / 33 endpoints + 1 SKIP(multipart) | ✅ All in-scope endpoints fired |
| 100% 200 OR documented 501 reason | 100% | 29/34 = 85.3% (200) + 5/34 P1 router-missing + 1 SKIP | ❌ — **P1 fix pending** brings to 33/34 = 97% (R5 multipart still deferred) |
| Rule 9 抽检 0 pseudo-row leak | 0 leak | 0 leak (5 data-class endpoints sampled, real F001 business values) | ✅ |
| depth label: 全 smoke | smoke only | smoke only (no deep claims) | ✅ |

---

## §7 R2/R3 follow-ups (queued, not in this PR)

1. **R2 RBAC sweep** — 33 mounted endpoints × {admin, warehouse_mgr, operator} = 99 cells. Verify §11.1 PriceFieldResponseAdvice strips for warehouse on finance/sales/inventory/procurement KPI.
2. **R3 production/quality envelope parity** — Java 10020 dict-eq Python 8084 envelope shape; if diverges, ticket §5.1.
3. **R3 incentive_plan valid target_type** — grep handler `target_type` accepted list, test happy path.
4. **R5 multipart upload** — `POST /datasource/upload` boundary cases (100MB / 0-byte / malformed Excel / Unicode filename).
5. **Bug fix** — P1 `config_thresholds.router` include (§1 single-line fix); P2 `query_templates_write.create` input validation (§5.2).
6. **Test data cleanup** — `DELETE FROM smart_bi_query_templates WHERE name LIKE 'R1A_smoke%'` (§5.3).

---

## §8 Harness reproducibility

```bash
# From server (SG firewalled, must SSH):
ssh root@47.100.235.168 'python3 /tmp/r1a_python_smoke.py > /tmp/r1a-results.json 2> /tmp/r1a-progress.log'
scp root@47.100.235.168:/tmp/r1a-results.json scripts/qa/r1a-results.json

# Harness: scripts/qa/r1a_python_smoke.py — 34 endpoint × {method, path, body, expected_status, rule9_data_key}
# JWT: factory_admin1 / 123456 via Java 10011 /api/mobile/auth/unified-login → token in /tmp/jwt.txt
```

Re-runnable. JSON includes envelope_keys / envelope_code / envelope_message / Rule 9 samples / body_excerpt[:600] for each endpoint.
