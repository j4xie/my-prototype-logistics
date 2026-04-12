"""L1: Direct Python section handler verification.
Tests all 36 registered handlers via POST /api/smartbi/restaurant/sections/{name}.
PASS: HTTP 200 + JSON with 'sectionName' field. 'skipped' status is OK.
"""
import json, time, urllib.request, urllib.error, sys

BASE = "http://localhost:8084"

SECTIONS = [
    "cost_rigidity", "diagnostics", "expense_breakdown", "benchmark_alerts",
    "channel_margin", "dining_heatmap", "long_tail_sku", "menu_normalization",
    "temporal_comparison", "review_analysis", "member_rfm", "stored_value",
    "multi_store_comparison", "calibration_history", "store_pnl_one_pager",
    "bom_layer_status", "shrinkage_analysis", "department_pnl",
    "menu_engineering", "monthly_ppt_export", "cross_chain_benchmark",
    "bom_variance", "sales_plan_tracking", "labor_productivity",
    "seat_occupancy", "combo_split", "return_anomaly", "review_competitive",
    "smart_reorder", "daily_reconciliation", "procurement_forecast", "restaurant_forecast",
    "shift_analysis", "piecework_calc", "performance_eval", "store_kpi_dashboard",
]

BODY = {"factory_id": "F001", "sub_sector": "火锅", "store_id": "S-001", "store_name": "测试店", "params": {}}

def post(url, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except: return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}

def main():
    try:
        h = json.loads(urllib.request.urlopen(f"{BASE}/health", timeout=5).read())
        print(f"Python health: {h.get('status', '?')}")
    except Exception as e:
        print(f"Python NOT UP: {e}"); sys.exit(1)

    print(f"\n====== L1: Python Section Direct Test ({len(SECTIONS)} handlers) ======\n")
    PASS = FAIL = 0
    results = []
    for section in SECTIONS:
        status, body = post(f"{BASE}/api/smartbi/restaurant/sections/{section}", BODY)
        has_section = isinstance(body, dict) and "sectionName" in body
        section_status = body.get("status", "?") if isinstance(body, dict) else "?"
        ok = status == 200 and has_section
        if ok: PASS += 1; mark = "PASS"
        else: FAIL += 1; mark = "FAIL"
        warnings = body.get("warnings", []) if isinstance(body, dict) else []
        warn_str = f" [{'; '.join(str(w)[:50] for w in warnings[:2])}]" if warnings else ""
        error_str = ""
        if not ok:
            if isinstance(body, dict):
                error_str = f" | body={json.dumps(body)[:120]}"
            else:
                error_str = f" | body={str(body)[:120]}"
        print(f"[{mark}] {section:30s} HTTP={status} status={section_status}{warn_str}{error_str}")
        results.append((mark, section, status, section_status))
        time.sleep(0.3)

    print(f"\n====== L1 SUMMARY: {PASS}/{PASS + FAIL} PASS ======")
    if FAIL > 0:
        print("\nFailed handlers:")
        for mark, section, status, section_status in results:
            if mark == "FAIL":
                print(f"  - {section} (HTTP={status}, status={section_status})")
    sys.exit(1 if FAIL > 0 else 0)

if __name__ == "__main__":
    main()
