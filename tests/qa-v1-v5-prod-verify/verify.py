"""
R1 RBAC verify — F1 (PR #495) + V1-V5 (PR #489) prod cutover.

Hits prod via 139.196.165.140:8086 nginx → 47:10010/10020 (prod Java BG).

Two F006 accounts (primary, per Steve directive):
  - f006_admin (factory_super_admin, *:*)
  - f006_warehouse_mgr (warehouse_manager — has warehouse:*, production:read,
    dashboard:read per PERMISSION_MATRIX; lacks finance:read,
    procurement:price:view)

Plus two F001 accounts (F1 needs production-plan data; F006 has 0 plans):
  - factory_admin1 (factory_super_admin)
  - warehouse_mgr1 (warehouse_manager)

PR design (corrected vs PR #495 description doc bug):
  - F1 @RequirePermission({finance:read, production:read}, OR)
    + defense-in-depth resolveCanViewCosts(gates on finance:read):
       admin                 → 200 + 8 cost values visible
       warehouse_manager     → 200 + 8 cost KEYS present, values=null
                              (annotation gate passes via production:read,
                               cost values nulled because no finance:read)
       no-prod-no-finance    → 403 (annotation gate)
  - V1-V5 @RequirePermission({procurement:price:view, finance:read*}, OR):
       warehouse_manager → 403 (lacks all)
       admin / finance_mgr / restaurant_mgr → 200
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Force utf-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).parent
BASE = "http://139.196.165.140:8086"


def load_tok(name: str) -> dict:
    with open(HERE / f"login_{name}.json", encoding="utf-8") as f:
        return json.load(f)["data"]


F006_ADMIN = load_tok("admin")
F006_WH = load_tok("warehouse")
F001_ADMIN = load_tok("f001_admin")
F001_WH = load_tok("f001_wh")

F1_COST_KEYS = [
    "estimatedMaterialCost", "actualMaterialCost",
    "estimatedLaborCost", "actualLaborCost",
    "estimatedEquipmentCost", "actualEquipmentCost",
    "estimatedOtherCost", "actualOtherCost",
]

LEAK_KEYS = {
    "V1_summary": ["thisMonthWastageCost"],
    "V2_inventory": ["totalValue"],
    "V2_finance": ["accountsReceivable", "accountsPayable", "customerPrepayments"],
    "V2_overview": ["kpi"],
    "V3_stats": ["totalCost"],
    "V3_list": ["unitPrice", "totalCost"],
    "V4_supplier_report": ["currentBalance"],
    "V5_pricelist_list": ["standardPrice", "minPrice", "maxPrice"],
    "V5_pricelist_effective": ["standardPrice"],
    "Sibling_wastage_stats": ["totalCost"],
}


def call(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        status = e.code
    except Exception as e:
        return {"status": -1, "error": f"{type(e).__name__}: {e}", "body": ""}
    out = {"status": status, "body": body, "len": len(body)}
    try:
        out["json"] = json.loads(body)
    except Exception:
        pass
    return out


def collect_keys(obj, max_depth=4) -> set:
    keys = set()
    def walk(o, d):
        if d > max_depth: return
        if isinstance(o, dict):
            for k, v in o.items():
                keys.add(k)
                walk(v, d + 1)
        elif isinstance(o, list):
            for item in o[:5]:
                walk(item, d + 1)
    walk(obj, 0)
    return keys


def f1_verify(fid: str, admin_tok: str, wh_tok: str) -> dict:
    """F1 budget-vs-actual: admin sees costs, warehouse_mgr sees 8 keys all null."""
    path = f"/api/mobile/{fid}/production-analytics/budget-vs-actual"
    admin = call(BASE + path, admin_tok)
    wh = call(BASE + path, wh_tok)
    notes = []
    admin_rows = admin.get("json", {}).get("data", []) if "json" in admin else []
    wh_rows = wh.get("json", {}).get("data", []) if "json" in wh else []
    notes.append(f"admin: HTTP {admin['status']}, {len(admin_rows)} rows")
    notes.append(f"warehouse_mgr: HTTP {wh['status']}, {len(wh_rows)} rows")

    leak = False
    if len(wh_rows) == 0:
        notes.append("DATA-LIMITED: 0 rows on this factory — cannot directly observe cost nulling")
        # Gate behavior still verifiable: warehouse_mgr should be 200 (annotation gate
        # passes via production:read), admin should be 200.
        gate_ok = admin["status"] == 200 and wh["status"] == 200
        verdict = "PASS-GATE-ONLY" if gate_ok else "FAIL"
    else:
        # Check admin sees cost values
        admin_visible = sum(1 for r in admin_rows for k in F1_COST_KEYS if r.get(k) is not None)
        admin_total_slots = len(admin_rows) * len(F1_COST_KEYS)
        # Check warehouse_mgr has all cost values null
        wh_present_keys = sum(1 for r in wh_rows for k in F1_COST_KEYS if k in r)
        wh_non_null = sum(1 for r in wh_rows for k in F1_COST_KEYS if r.get(k) is not None)
        wh_expected_keys = len(wh_rows) * len(F1_COST_KEYS)
        notes.append(
            f"admin cost values present: {admin_visible}/{admin_total_slots} "
            f"({admin_visible*100//max(admin_total_slots,1)}%)"
        )
        notes.append(
            f"warehouse_mgr cost keys present: {wh_present_keys}/{wh_expected_keys} "
            f"(stable contract), non-null values: {wh_non_null}"
        )
        if wh_non_null > 0:
            # Leak — warehouse_mgr should have all costs nulled
            leak = True
            sample = [(i, k, r.get(k)) for i, r in enumerate(wh_rows[:3])
                      for k in F1_COST_KEYS if r.get(k) is not None][:5]
            notes.append(f"P0 LEAK: warehouse_mgr received non-null cost values: {sample}")
            verdict = "P0_LEAK"
        elif wh_present_keys == wh_expected_keys and wh_non_null == 0 and admin_visible > 0:
            notes.append("STRIP CONFIRMED: warehouse_mgr 8 keys present, all values=null; admin sees real costs")
            verdict = "PASS"
        else:
            notes.append("UNEXPECTED: shape doesn't match design")
            verdict = "FAIL"

    return {
        "key": f"F1_budget_vs_actual_{fid}",
        "endpoint": f"F1 ProductionAnalytics /budget-vs-actual ({fid})",
        "path": path,
        "admin_status": admin["status"],
        "warehouse_status": wh["status"],
        "verdict": verdict,
        "leak": leak,
        "notes": notes,
        "_admin_body": admin.get("body", "")[:400],
        "_wh_body": wh.get("body", "")[:400],
    }


def v_verify(ep_key: str, name: str, path: str, fid: str, admin_tok: str, wh_tok: str) -> dict:
    """V1-V5 + Sibling: warehouse_mgr → 403, admin → 200 (or 404/500 non-403 acceptable)."""
    admin = call(BASE + path.replace("{FID}", fid), admin_tok)
    wh = call(BASE + path.replace("{FID}", fid), wh_tok)
    notes = []
    leak = False
    notes.append(f"admin: HTTP {admin['status']}")
    notes.append(f"warehouse_mgr: HTTP {wh['status']}")

    # warehouse_mgr expected 403
    if wh["status"] == 403:
        wh_ok = True
        notes.append("warehouse_mgr 403 OK (gate blocks)")
    elif wh["status"] == 200 and "json" in wh:
        keys = collect_keys(wh["json"])
        expected_leak_keys = LEAK_KEYS.get(ep_key, [])
        present_leak = [k for k in expected_leak_keys if k in keys]
        if present_leak:
            leak = True
            wh_ok = False
            notes.append(f"P0 LEAK: warehouse_mgr 200 with leak fields {present_leak}")
        else:
            wh_ok = False
            notes.append("warehouse_mgr 200 with no leak keys (gate bypass but body empty/structure differs)")
    else:
        wh_ok = False
        notes.append(f"warehouse_mgr unexpected status {wh['status']}")

    # admin: any non-403 is acceptable
    admin_ok = admin["status"] != 403
    if not admin_ok:
        notes.append("admin 403 — gate too tight, blocks factory_super_admin")

    if admin_ok and wh_ok:
        verdict = "PASS"
    elif leak:
        verdict = "P0_LEAK"
    else:
        verdict = "FAIL"

    return {
        "key": ep_key,
        "endpoint": f"{name} ({fid})",
        "path": path.replace("{FID}", fid),
        "admin_status": admin["status"],
        "warehouse_status": wh["status"],
        "verdict": verdict,
        "leak": leak,
        "notes": notes,
        "_admin_body": admin.get("body", "")[:400],
        "_wh_body": wh.get("body", "")[:400],
    }


# (key, name, path with {FID} placeholder)
V_ENDPOINTS = [
    ("V1_summary",             "V1 RestaurantDashboard /summary",                "/api/mobile/{FID}/restaurant-dashboard/summary"),
    ("V2_inventory",           "V2 Report /inventory",                           "/api/mobile/{FID}/reports/inventory"),
    ("V2_finance",             "V2 Report /finance",                             "/api/mobile/{FID}/reports/finance"),
    ("V2_overview",            "V2 Report /dashboard/overview",                  "/api/mobile/{FID}/reports/dashboard/overview"),
    ("V3_stats",               "V3 MaterialConsumption /stats",                  "/api/mobile/{FID}/processing/material-consumptions/stats"),
    ("V3_list",                "V3 MaterialConsumption / (list)",                "/api/mobile/{FID}/processing/material-consumptions"),
    ("V4_supplier_report",     "V4 SupplierAdmission /report/{id}",              "/api/mobile/{FID}/supplier-admission/report/00000000-0000-0000-0000-000000000000"),
    ("V5_pricelist_list",      "V5 PriceList / (list)",                          "/api/mobile/{FID}/price-lists"),
    ("V5_pricelist_effective", "V5 PriceList /effective",                        "/api/mobile/{FID}/price-lists/effective"),
    ("Sibling_wastage_stats",  "Sibling WastageRecord /statistics",              "/api/mobile/{FID}/restaurant/wastage/statistics"),
]


def main():
    results = []

    # Part A: F1 strip — run on F006 primary, F001 for data-backed observation
    print("=== Part A: F1 budget-vs-actual strip verify ===", flush=True)
    print("--- F006 (no plan data, gate behavior only) ---", flush=True)
    r = f1_verify("F006", F006_ADMIN["token"], F006_WH["token"])
    results.append(r)
    print(f"  verdict={r['verdict']}", flush=True)
    for n in r["notes"]: print(f"    - {n}", flush=True)

    print("--- F001 (51 plans, full strip verification) ---", flush=True)
    r = f1_verify("F001", F001_ADMIN["token"], F001_WH["token"])
    results.append(r)
    print(f"  verdict={r['verdict']}", flush=True)
    for n in r["notes"]: print(f"    - {n}", flush=True)

    # Part B: V1-V5 + sibling on F006 (primary per Steve directive)
    print("\n=== Part B: V1-V5 + Sibling RBAC gate verify (F006) ===", flush=True)
    for ep_key, name, path in V_ENDPOINTS:
        print(f"--- {name} ---", flush=True)
        r = v_verify(ep_key, name, path, "F006", F006_ADMIN["token"], F006_WH["token"])
        results.append(r)
        print(f"  admin={r['admin_status']}  warehouse={r['warehouse_status']}  verdict={r['verdict']}", flush=True)
        for n in r["notes"]: print(f"    - {n}", flush=True)

    summary = {
        "test_run": "qa/v1-v5-prod-verify",
        "executed_at": "2026-05-13",
        "base_url": BASE,
        "primary_factory": "F006 (六膳门食品科技, FACTORY type)",
        "f001_supplement": "F001 used only for F1 strip verification (F006 has 0 plans)",
        "users": {
            "f006_admin": "factory_super_admin (perms *:*) — baseline",
            "f006_warehouse_mgr": "warehouse_manager (warehouse:*+production:read+dashboard:read per matrix; lacks finance:read, procurement:price:view) — strip target",
            "factory_admin1": "F001 factory_super_admin — F1 baseline w/ data",
            "warehouse_mgr1": "F001 warehouse_manager — F1 strip target w/ data",
        },
        "endpoints_tested": len(results),
        "PASS": sum(1 for r in results if r["verdict"] == "PASS"),
        "PASS-GATE-ONLY": sum(1 for r in results if r["verdict"] == "PASS-GATE-ONLY"),
        "FAIL": sum(1 for r in results if r["verdict"] == "FAIL"),
        "P0_LEAK": sum(1 for r in results if r["verdict"] == "P0_LEAK"),
        "any_leak": any(r["leak"] for r in results),
        "results": results,
    }

    with open(HERE / "results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n=== SUMMARY ===", flush=True)
    print(f"PASS:           {summary['PASS']}/{summary['endpoints_tested']}", flush=True)
    print(f"PASS-GATE-ONLY: {summary['PASS-GATE-ONLY']}/{summary['endpoints_tested']} (no data to observe field strip)", flush=True)
    print(f"FAIL:           {summary['FAIL']}/{summary['endpoints_tested']}", flush=True)
    print(f"P0_LEAK:        {summary['P0_LEAK']}/{summary['endpoints_tested']}", flush=True)
    print(f"any_leak:       {summary['any_leak']}", flush=True)
    return 0 if summary["FAIL"] == 0 and summary["P0_LEAK"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
