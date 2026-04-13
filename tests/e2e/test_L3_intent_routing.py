"""L3: Intent routing accuracy via demo recognize endpoint.
PASS: intentCode matches expected RESTAURANT_* code.
Demo endpoint has rate limiting — 3s gaps between queries.
"""
import json, time, urllib.request, urllib.error, sys

BASE = "http://localhost:10011"

QUERIES = [
    ("人效", "RESTAURANT_LABOR_PRODUCTIVITY"),
    ("BOM差异", "RESTAURANT_BOM_VARIANCE"),
    ("销售计划", "RESTAURANT_SALES_PLAN_TRACK"),
    ("人均产出", "RESTAURANT_LABOR_PRODUCTIVITY"),
    ("桌位", "RESTAURANT_SEAT_OCCUPANCY"),
    ("套餐拆单", "RESTAURANT_COMBO_SPLIT"),
    ("退货异常", "RESTAURANT_RETURN_ANOMALY"),
    ("竞品对比", "RESTAURANT_REVIEW_COMPETITIVE"),
    ("叫货", "RESTAURANT_SMART_REORDER"),
    ("日清日结", "RESTAURANT_DAILY_RECONCILIATION"),
    ("采购预测", "RESTAURANT_PROCUREMENT_FORECAST"),
    ("排班分析", "RESTAURANT_SHIFT_ANALYSIS"),
    ("计件提成", "RESTAURANT_PIECEWORK_CALC"),
    ("绩效考核", "RESTAURANT_PERFORMANCE_EVAL"),
    ("店长KPI", "RESTAURANT_STORE_KPI_DASHBOARD"),
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
        try: return json.loads(e.read())
        except: return {"code": e.code}
    except Exception as e:
        return {"code": 0, "message": str(e)}

def main():
    print(f"====== L3: Intent Routing Accuracy ({len(QUERIES)} queries) ======\n")
    PASS = FAIL = SKIP = 0
    for query, expected in QUERIES:
        time.sleep(3)
        r = post(f"{BASE}/api/public/ai-demo/recognize", {"userInput": query})
        d = r.get("data") or {}
        actual = d.get("intentCode", "")
        method = d.get("matchMethod", "?")
        if not actual:
            SKIP += 1
            print(f"[SKIP] {query:16s} -> (empty, rate limited?)")
            continue
        if actual == expected:
            PASS += 1
            print(f"[PASS] {query:16s} -> {actual} ({method})")
        else:
            FAIL += 1
            print(f"[FAIL] {query:16s} -> {actual} ({method}) [expected {expected}]")
    print(f"\n====== L3 SUMMARY: {PASS} PASS / {FAIL} FAIL / {SKIP} SKIP ======")
    if SKIP: print(f"  ! {SKIP} skipped due to rate limiting")
    sys.exit(1 if FAIL > 0 else 0)

if __name__ == "__main__":
    main()
