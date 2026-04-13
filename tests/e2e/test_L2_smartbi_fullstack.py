"""L2: SmartBI full-stack E2E (Java -> Python).

Tests: Login -> POST /smart-bi/query -> P5.6 regex -> intent pipeline -> tool execute -> Python handler.
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
            print(f"   ! Intent mismatch: expected {expected_intent}")
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
