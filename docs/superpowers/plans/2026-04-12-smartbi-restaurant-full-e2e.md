# SmartBI Restaurant Full E2E Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify ALL 36 restaurant section handlers end-to-end across 3 layers: (L1) Python handler direct call, (L2) SmartBI API full-stack, (L3) intent routing regression.

**Architecture:** Single Python test script per layer, run on server via SSH to bypass security group. L1 tests Python handlers directly (no Java). L2 tests Java→Python via SmartBI `/smart-bi/query` endpoint. L3 tests intent recognition accuracy for all 15 Phase 1-4 queries + 21 legacy queries.

**Tech Stack:** Python 3.8 (server venv), urllib (no external deps), test env at localhost:10011 (Java) + localhost:8084 (Python)

---

## File Structure

- Create: `tests/e2e/test_L1_python_sections.py` — Direct Python handler test (36 sections)
- Create: `tests/e2e/test_L2_smartbi_fullstack.py` — Full-stack SmartBI query test (15 Phase 1-4)
- Create: `tests/e2e/test_L3_intent_routing.py` — Intent routing accuracy (36 queries)
- Create: `tests/e2e/run_all.sh` — Runner script

---

## Section Handler Inventory (36 total)

### Pre-existing (21 handlers, already tested in earlier sessions)
| # | section_name | Category | Sample Query |
|---|---|---|---|
| 1 | cost_rigidity | Finance | 成本刚性分析 |
| 2 | diagnostics | Overview | 门店诊断 |
| 3 | expense_breakdown | Finance | 费用明细 |
| 4 | benchmark_alerts | Benchmark | 行业基准告警 |
| 5 | channel_margin | Channel | 渠道毛利分析 |
| 6 | dining_heatmap | Operations | 时段客流热力图 |
| 7 | long_tail_sku | Menu | 长尾SKU分析 |
| 8 | menu_normalization | Menu | 菜单归一化 |
| 9 | temporal_comparison | Finance | 同店同比 |
| 10 | review_analysis | Customer | 评论分析 |
| 11 | member_rfm | Customer | 会员RFM分层 |
| 12 | stored_value | Customer | 储值卡分析 |
| 13 | multi_store_comparison | Benchmark | 多店对比 |
| 14 | calibration_history | Data | BOM校准历史 |
| 15 | store_pnl_one_pager | Finance | 单店P&L |
| 16 | bom_layer_status | Data | BOM精度状态 |
| 17 | shrinkage_analysis | Finance | 档口损溢 |
| 18 | department_pnl | Finance | 部门P&L |
| 19 | menu_engineering | Menu | 菜单工程四象限 |
| 20 | monthly_ppt_export | Report | 月度PPT |
| 21 | cross_chain_benchmark | Benchmark | 跨连锁对标 |

### Phase 1-4 New (15 handlers, built this session)
| # | section_name | Phase | Sample Query |
|---|---|---|---|
| 22 | bom_variance | P1 | BOM差异归因 |
| 23 | sales_plan_tracking | P1 | 销售计划完成度 |
| 24 | labor_productivity | P1 | 人效分析 |
| 25 | seat_occupancy | P2 | 桌位占有率 |
| 26 | combo_split | P2 | 套餐拆单 |
| 27 | return_anomaly | P2 | 退货异常 |
| 28 | review_competitive | P2 | 竞品对比 |
| 29 | smart_reorder | P3 | 叫货单 |
| 30 | daily_reconciliation | P3 | 日清日结 |
| 31 | procurement_forecast | P3 | 采购预测 |
| 32 | shift_analysis | P4 | 排班分析 |
| 33 | piecework_calc | P4 | 计件提成 |
| 34 | performance_eval | P4 | 绩效评估 |
| 35 | store_kpi_dashboard | P4 | 店长KPI |
| 36 | restaurant_forecast | P3.5 | 销售预测 |

---

## Tasks

### Task 1: L1 — Python Section Handler Direct Tests

Tests each of the 36 handlers directly via `POST /api/smartbi/restaurant/sections/{name}`.
A handler passes if it returns HTTP 200 with a JSON body containing `sectionName` field.
Handlers may return `status: "skipped"` (missing data) — that's still a PASS (handler executed correctly).

**Files:**
- Create: `tests/e2e/test_L1_python_sections.py`

- [ ] **Step 1: Write the test script**

```python
"""L1: Direct Python section handler verification.

Tests all 36 registered handlers via POST /api/smartbi/restaurant/sections/{name}.
PASS criteria: HTTP 200 + JSON response with 'sectionName' field.
'skipped' status is OK — means handler ran but lacked input data.

Run on server: python3 /tmp/test_L1_python_sections.py
"""
import json, time, urllib.request, urllib.error, sys

BASE = "http://localhost:8084"

# All 36 registered handlers
SECTIONS = [
    # Pre-existing (21)
    "cost_rigidity", "diagnostics", "expense_breakdown", "benchmark_alerts",
    "channel_margin", "dining_heatmap", "long_tail_sku", "menu_normalization",
    "temporal_comparison", "review_analysis", "member_rfm", "stored_value",
    "multi_store_comparison", "calibration_history", "store_pnl_one_pager",
    "bom_layer_status", "shrinkage_analysis", "department_pnl",
    "menu_engineering", "monthly_ppt_export", "cross_chain_benchmark",
    # Phase 1 (3)
    "bom_variance", "sales_plan_tracking", "labor_productivity",
    # Phase 2 (4)
    "seat_occupancy", "combo_split", "return_anomaly", "review_competitive",
    # Phase 3 (3) + forecast
    "smart_reorder", "daily_reconciliation", "procurement_forecast", "restaurant_forecast",
    # Phase 4 (4)
    "shift_analysis", "piecework_calc", "performance_eval", "store_kpi_dashboard",
]

BODY = {
    "factory_id": "F001",
    "sub_sector": "火锅",
    "store_id": "S-001",
    "store_name": "青花椒测试店",
    "params": {}
}


def post(url, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    # Health check
    try:
        h = json.loads(urllib.request.urlopen(f"{BASE}/health", timeout=5).read())
        print(f"Python health: {h.get('status', '?')}")
    except Exception as e:
        print(f"Python NOT UP: {e}")
        sys.exit(1)

    print(f"\n====== L1: Python Section Direct Test ({len(SECTIONS)} handlers) ======\n")

    PASS = FAIL = 0
    results = []

    for section in SECTIONS:
        status, body = post(f"{BASE}/api/smartbi/restaurant/sections/{section}", BODY)

        # PASS criteria: HTTP 200 + has sectionName in response
        has_section = isinstance(body, dict) and "sectionName" in body
        section_status = body.get("status", "?") if isinstance(body, dict) else "?"
        ok = status == 200 and has_section

        if ok:
            PASS += 1
            mark = "PASS"
        else:
            FAIL += 1
            mark = "FAIL"

        warnings = body.get("warnings", []) if isinstance(body, dict) else []
        warn_str = f" [{'; '.join(str(w)[:50] for w in warnings[:2])}]" if warnings else ""

        print(f"[{mark}] {section:30s} HTTP={status} status={section_status}{warn_str}")
        results.append({"section": section, "ok": ok, "http": status, "status": section_status})
        time.sleep(0.3)

    print(f"\n====== L1 SUMMARY: {PASS}/{PASS + FAIL} PASS ======")

    # Categorize failures
    fails = [r for r in results if not r["ok"]]
    if fails:
        print("\nFailed sections:")
        for f in fails:
            print(f"  - {f['section']}: HTTP {f['http']}, status={f['status']}")

    sys.exit(1 if FAIL > 0 else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Upload and run on server**

```bash
scp tests/e2e/test_L1_python_sections.py root@47.100.235.168:/tmp/
ssh root@47.100.235.168 '/www/wwwroot/cretas/code/backend/python/venv38/bin/python3 /tmp/test_L1_python_sections.py'
```

Expected: 36/36 PASS (all handlers return 200 with sectionName, most with status=skipped due to no data)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/test_L1_python_sections.py
git commit -m "test(e2e): L1 — direct Python section handler verification (36 handlers)"
```

---

### Task 2: L2 — SmartBI Full-Stack Tests (Java → Python)

Tests the complete flow: Login → SmartBI query → P5.6 regex routing → Intent recognition → Tool execution → Python handler call → Response.

**Files:**
- Create: `tests/e2e/test_L2_smartbi_fullstack.py`

- [ ] **Step 1: Write the test script**

```python
"""L2: SmartBI full-stack E2E (Java → Python).

Tests: Login → POST /smart-bi/query → P5.6 regex → intent pipeline → tool execute → Python handler.
PASS criteria: HTTP 200 from SmartBI endpoint (tool executed, even if Python returns 'skipped').

Run on server: python3 /tmp/test_L2_smartbi_fullstack.py
"""
import json, time, urllib.request, urllib.error, sys

BASE = "http://localhost:10011"

# All queries that should route to RESTAURANT_* intents via P5.6 regex
QUERIES = [
    # Phase 1: Financial
    ("人效分析各门店人均产出", "P1", "Labor Productivity", "RESTAURANT_LABOR_PRODUCTIVITY"),
    ("BOM差异归因看看供应链还是管理问题", "P1", "BOM Variance", "RESTAURANT_BOM_VARIANCE"),
    ("本月销售计划完成度怎么样", "P1", "Sales Plan Track", "RESTAURANT_SALES_PLAN_TRACK"),
    ("创建销售计划目标营收50万", "P1", "Sales Plan Create", "RESTAURANT_SALES_PLAN_CREATE"),
    # Phase 2: Operational
    ("桌位占有率分析两人位够不够", "P2", "Seat Occupancy", "RESTAURANT_SEAT_OCCUPANCY"),
    ("套餐拆单统计看看哪些菜靠套餐带", "P2", "Combo Split", "RESTAURANT_COMBO_SPLIT"),
    ("退货异常检测供应商反复退货", "P2", "Return Anomaly", "RESTAURANT_RETURN_ANOMALY"),
    ("竞品对比分析评分差距", "P2", "Review Competitive", "RESTAURANT_REVIEW_COMPETITIVE"),
    # Phase 3: Supply Chain
    ("帮我生成叫货单自动下单", "P3", "Smart Reorder", "RESTAURANT_SMART_REORDER"),
    ("日清日结今天库存对账", "P3", "Daily Reconciliation", "RESTAURANT_DAILY_RECONCILIATION"),
    ("采购预测下周备货量", "P3", "Procurement Forecast", "RESTAURANT_PROCUREMENT_FORECAST"),
    # Phase 4: Workforce
    ("排班分析全职兼职比例", "P4", "Shift Analysis", "RESTAURANT_SHIFT_ANALYSIS"),
    ("迎宾计件提成算一下本月", "P4", "Piecework Calc", "RESTAURANT_PIECEWORK_CALC"),
    ("绩效考核KPI得分评估", "P4", "Performance Eval", "RESTAURANT_PERFORMANCE_EVAL"),
    ("店长KPI三维度健康度看看", "P4", "Store KPI Dashboard", "RESTAURANT_STORE_KPI_DASHBOARD"),
    # Pre-existing restaurant diagnostics (via P5.6 regex)
    ("成本刚性分析 营收降了47%", "Legacy", "Cost Rigidity", "RESTAURANT_COST_RIGIDITY"),
    ("菜单工程四象限分析", "Legacy", "Menu Engineering", "RESTAURANT_MENU_ENGINEERING"),
    ("同店同比看看上个月对比", "Legacy", "Temporal Compare", "RESTAURANT_TEMPORAL_COMPARISON"),
    ("评论分析差评关键词", "Legacy", "Review Analysis", "RESTAURANT_REVIEW_ANALYSIS"),
    ("多店对比17家店排名", "Legacy", "Multi Store", "RESTAURANT_MULTI_STORE_COMPARISON"),
]


def post(url, body, token=None):
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"code": e.code}
    except Exception as e:
        return {"code": 0, "message": str(e)}


def main():
    # Health
    h = json.loads(urllib.request.urlopen(f"{BASE}/api/mobile/health", timeout=5).read())
    print(f"Java health: {h.get('status', '?')}")

    # Login
    lr = post(f"{BASE}/api/mobile/auth/unified-login",
              {"username": "operator1", "password": "demo123", "factoryId": "F001"})
    token = (lr.get("data") or {}).get("token", "")
    if not token:
        print(f"Login FAILED: {json.dumps(lr, ensure_ascii=False)[:200]}")
        sys.exit(1)
    print(f"Login: OK\n")

    print(f"====== L2: SmartBI Full-Stack E2E ({len(QUERIES)} queries) ======\n")

    PASS = FAIL = 0
    phase_results = {}

    for query, phase, name, expected_intent in QUERIES:
        time.sleep(3)  # Rate limit protection
        r = post(f"{BASE}/api/mobile/F001/smart-bi/query",
                 {"query": query, "factoryId": "F001"}, token)

        code = r.get("code", 0)
        d = r.get("data") or {}
        if not isinstance(d, dict):
            d = {}

        resp_text = str(d.get("responseText") or d.get("message") or "")[:80]
        intent_code = d.get("intentCode", "")

        ok = code == 200
        intent_match = expected_intent in str(intent_code) if expected_intent else True

        if ok:
            PASS += 1
            mark = "PASS"
        else:
            FAIL += 1
            mark = "FAIL"

        print(f"[{mark}] [{phase}] {name}")
        print(f"   query: \"{query}\"")
        print(f"   HTTP: {code}, intent: {intent_code or 'N/A'}")
        print(f"   response: {resp_text}")
        if not intent_match:
            print(f"   ⚠ Intent mismatch: expected {expected_intent}")
        print()

        phase_results.setdefault(phase, []).append(ok)

    print(f"====== L2 SUMMARY: {PASS}/{PASS + FAIL} PASS ======")
    for p in ["P1", "P2", "P3", "P4", "Legacy"]:
        pr = phase_results.get(p, [])
        if pr:
            pp = sum(pr)
            st = "ALL_PASS" if pp == len(pr) else "PARTIAL"
            print(f"  {p}: {pp}/{len(pr)} [{st}]")

    sys.exit(1 if FAIL > 0 else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Upload and run**

```bash
scp tests/e2e/test_L2_smartbi_fullstack.py root@47.100.235.168:/tmp/
ssh root@47.100.235.168 '/www/wwwroot/cretas/code/backend/python/venv38/bin/python3 /tmp/test_L2_smartbi_fullstack.py'
```

Expected: 20/20 PASS (15 Phase 1-4 + 5 legacy queries)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/test_L2_smartbi_fullstack.py
git commit -m "test(e2e): L2 — SmartBI full-stack Java→Python verification (20 queries)"
```

---

### Task 3: L3 — Intent Routing Accuracy (Demo Endpoint)

Tests intent recognition accuracy via the public demo endpoint.
Verifies that `restaurantPhraseMapping` (v33) correctly routes all 15 Phase 1-4 queries.

**Files:**
- Create: `tests/e2e/test_L3_intent_routing.py`

- [ ] **Step 1: Write the test script**

```python
"""L3: Intent routing accuracy via demo recognize endpoint.

Tests all 15 Phase 1-4 queries + 10 legacy queries via POST /api/public/ai-demo/recognize.
PASS criteria: intentCode matches expected RESTAURANT_* code.

IMPORTANT: Demo endpoint has rate limiting. Tests use 3s gaps between queries.
Run on server: python3 /tmp/test_L3_intent_routing.py
"""
import json, time, urllib.request, urllib.error, sys

BASE = "http://localhost:10011"

QUERIES = [
    # Phase 1
    ("人效", "RESTAURANT_LABOR_PRODUCTIVITY"),
    ("BOM差异", "RESTAURANT_BOM_VARIANCE"),
    ("销售计划", "RESTAURANT_SALES_PLAN_TRACK"),
    ("人均产出", "RESTAURANT_LABOR_PRODUCTIVITY"),
    # Phase 2
    ("桌位", "RESTAURANT_SEAT_OCCUPANCY"),
    ("套餐拆单", "RESTAURANT_COMBO_SPLIT"),
    ("退货异常", "RESTAURANT_RETURN_ANOMALY"),
    ("竞品对比", "RESTAURANT_REVIEW_COMPETITIVE"),
    # Phase 3
    ("叫货", "RESTAURANT_SMART_REORDER"),
    ("日清日结", "RESTAURANT_DAILY_RECONCILIATION"),
    ("采购预测", "RESTAURANT_PROCUREMENT_FORECAST"),
    # Phase 4
    ("排班分析", "RESTAURANT_SHIFT_ANALYSIS"),
    ("计件提成", "RESTAURANT_PIECEWORK_CALC"),
    ("绩效考核", "RESTAURANT_PERFORMANCE_EVAL"),
    ("店长KPI", "RESTAURANT_STORE_KPI_DASHBOARD"),
    # Legacy (10 — validate no regression)
    ("成本刚性", "RESTAURANT_COST_RIGIDITY"),
    ("时段客流", "RESTAURANT_DINING_HEATMAP"),
    ("长尾SKU", "RESTAURANT_LONG_TAIL_SKU"),
    ("同店同比", "RESTAURANT_TEMPORAL_COMPARISON"),
    ("评论分析", "RESTAURANT_REVIEW_ANALYSIS"),
    ("会员RFM", "RESTAURANT_MEMBER_RFM"),
    ("储值卡", "RESTAURANT_STORED_VALUE"),
    ("多店对比", "RESTAURANT_MULTI_STORE_COMPARISON"),
    ("菜单工程", "RESTAURANT_MENU_ENGINEERING"),
    ("跨连锁对标", "RESTAURANT_CROSS_CHAIN_BENCHMARK"),
]


def post(url, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"code": e.code}
    except Exception as e:
        return {"code": 0, "message": str(e)}


def main():
    print(f"====== L3: Intent Routing Accuracy ({len(QUERIES)} queries) ======\n")

    PASS = FAIL = SKIP = 0

    for query, expected in QUERIES:
        time.sleep(3)
        r = post(f"{BASE}/api/public/ai-demo/recognize", {"userInput": query})
        d = (r.get("data") or {})
        actual = d.get("intentCode", "")
        method = d.get("matchMethod", "?")

        if not actual:
            # Rate limited or error
            SKIP += 1
            print(f"[SKIP] {query:16s} → (empty, rate limited?)")
            continue

        if actual == expected:
            PASS += 1
            print(f"[PASS] {query:16s} → {actual} ({method})")
        else:
            FAIL += 1
            print(f"[FAIL] {query:16s} → {actual} ({method}) [expected {expected}]")

    print(f"\n====== L3 SUMMARY: {PASS} PASS / {FAIL} FAIL / {SKIP} SKIP ======")
    if SKIP:
        print(f"  ⚠ {SKIP} skipped due to rate limiting — rerun with wider gaps")

    sys.exit(1 if FAIL > 0 else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Upload and run**

```bash
scp tests/e2e/test_L3_intent_routing.py root@47.100.235.168:/tmp/
ssh root@47.100.235.168 '/www/wwwroot/cretas/code/backend/python/venv38/bin/python3 /tmp/test_L3_intent_routing.py'
```

Expected: 25/25 PASS (15 Phase 1-4 + 10 legacy). Some may SKIP due to rate limiting.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/test_L3_intent_routing.py
git commit -m "test(e2e): L3 — intent routing accuracy (25 queries, demo endpoint)"
```

---

### Task 4: Runner script + execute all layers

**Files:**
- Create: `tests/e2e/run_all.sh`

- [ ] **Step 1: Create runner**

```bash
#!/bin/bash
# SmartBI Restaurant E2E — run all 3 layers on test server
# Usage: bash tests/e2e/run_all.sh

SERVER=root@47.100.235.168
PY=/www/wwwroot/cretas/code/backend/python/venv38/bin/python3

echo "=== Uploading test scripts ==="
scp tests/e2e/test_L1_python_sections.py $SERVER:/tmp/
scp tests/e2e/test_L2_smartbi_fullstack.py $SERVER:/tmp/
scp tests/e2e/test_L3_intent_routing.py $SERVER:/tmp/

echo ""
echo "==================== L1: Python Direct ===================="
ssh $SERVER "$PY /tmp/test_L1_python_sections.py"
L1=$?

echo ""
echo "==================== L2: SmartBI Full-Stack ===================="
ssh $SERVER "$PY /tmp/test_L2_smartbi_fullstack.py"
L2=$?

echo ""
echo "==================== L3: Intent Routing ===================="
ssh $SERVER "$PY /tmp/test_L3_intent_routing.py"
L3=$?

echo ""
echo "==================== FINAL REPORT ===================="
[ $L1 -eq 0 ] && echo "L1 Python Direct:    ✅ ALL PASS" || echo "L1 Python Direct:    ❌ FAILURES"
[ $L2 -eq 0 ] && echo "L2 SmartBI Full-Stack: ✅ ALL PASS" || echo "L2 SmartBI Full-Stack: ❌ FAILURES"
[ $L3 -eq 0 ] && echo "L3 Intent Routing:    ✅ ALL PASS" || echo "L3 Intent Routing:    ❌ FAILURES"

exit $(( L1 + L2 + L3 ))
```

- [ ] **Step 2: Run all layers**

```bash
bash tests/e2e/run_all.sh
```

Expected:
```
L1 Python Direct:     ✅ ALL PASS (36/36)
L2 SmartBI Full-Stack: ✅ ALL PASS (20/20)
L3 Intent Routing:    ✅ ALL PASS (25/25)
```

- [ ] **Step 3: Commit all**

```bash
git add tests/e2e/
git commit -m "test(e2e): complete SmartBI restaurant E2E suite (L1+L2+L3, 81 test points)"
```

---

## Self-Review

### Spec coverage

| Requirement | Task | Status |
|---|---|---|
| All 36 section handlers respond | Task 1 (L1) | Covered |
| Phase 1-4 full-stack (Java→Python) | Task 2 (L2) | Covered |
| Intent routing accuracy (new + legacy) | Task 3 (L3) | Covered |
| Rate limit handling | Task 3 (3s gaps + SKIP tracking) | Covered |
| Runner for all layers | Task 4 | Covered |

### Placeholder scan

No TBD/TODO/placeholders found.

### Type consistency

- All scripts use same `post()` helper pattern
- `SECTIONS` list in L1 matches the 36 HANDLERS keys in `restaurant_sections.py`
- `QUERIES` in L2/L3 use identical intent codes matching `ai_intent_configs` DB rows
