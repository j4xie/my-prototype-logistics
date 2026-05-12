#!/usr/bin/env python3
"""R1-A smoke harness — curl all 34 smartbi_compat endpoints, dump JSON matrix.

Usage on server:
  export R1A_TOKEN="$(python3 -c 'import json; print(json.load(open(\"/tmp/login.json\"))[\"data\"][\"accessToken\"])')"
  python3 /tmp/r1a_python_smoke.py > /tmp/r1a-results.json
"""
import json
import os
import subprocess
import sys

TOKEN = os.environ.get("R1A_TOKEN") or open("/tmp/jwt.txt").read().strip()
BASE = "http://localhost:8084"
FACTORY = "F001"
DATE_S = "2026-01-01"
DATE_E = "2026-05-12"

# (label, method, path, body_or_None, expected_status_set, expected_rule_9_data_key)
ENDPOINTS = [
    # analysis.py (4 list)
    ("analysis.list_query_templates", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/query-templates", None, {200}, "data.items"),
    ("analysis.list_datasources", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/list", None, {200}, "data.items"),
    ("analysis.alerts", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/alerts", None, {200}, "data.alerts"),
    ("analysis.recommendations", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/recommendations", None, {200}, "data.recommendations"),

    # analysis_finance (4)
    ("analysis_finance.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/finance?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_finance.budget-achievement", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/finance/budget-achievement?year=2026",
     None, {200}, "data.categories"),
    ("analysis_finance.yoy-mom", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/finance/yoy-mom?periodType=MONTH&startPeriod=2026-01",
     None, {200}, "data.categories"),
    ("analysis_finance.category-comparison", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/finance/category-comparison?year=2026&compareYear=2025",
     None, {200}, "data.categories"),

    # analysis_sales/inventory/procurement/region/department (5)
    ("analysis_sales.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/sales?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_inventory.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/inventory?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_procurement.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/procurement?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_region.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/region?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_department.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/department?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),

    # Phase 2B (2)
    ("analysis_production.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/production?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("analysis_quality.composite", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/analysis/quality?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),

    # analysis_drilldown (1 POST)
    ("analysis_drilldown.drill_down", "POST",
     f"/api/mobile/{FACTORY}/smart-bi/drill-down",
     {"drillType": "region", "factoryId": FACTORY,
      "startDate": DATE_S, "endDate": DATE_E,
      "metric": "salesAmount", "dimension": "region"},
     {200}, None),

    # config_thresholds (5)
    ("config_thresholds.list", "GET",
     "/api/mobile/smartbi-config/thresholds", None, {200}, "data.items"),
    ("config_thresholds.create", "POST",
     "/api/mobile/smartbi-config/thresholds",
     {"thresholdType": "smoke_test_r1a", "thresholdName": "R1A smoke",
      "thresholdValue": 100, "comparisonOperator": "GT", "isActive": True},
     {200, 201}, None),
    ("config_thresholds.update", "PUT",
     "/api/mobile/smartbi-config/thresholds/r1a-nonexistent-id",
     {"thresholdType": "smoke_test_r1a", "thresholdName": "R1A smoke",
      "thresholdValue": 100, "comparisonOperator": "GT", "isActive": True},
     {404}, None),
    ("config_thresholds.delete", "DELETE",
     "/api/mobile/smartbi-config/thresholds/r1a-nonexistent-id",
     None, {404}, None),
    ("config_thresholds.reload", "POST",
     "/api/mobile/smartbi-config/thresholds/reload",
     {}, {200}, None),

    # dashboard_composite (3) + dashboard (1)
    ("dashboard_composite.executive", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/dashboard/executive?period=month",
     None, {200}, "data.kpiCards"),
    ("dashboard_composite.executive_custom", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/dashboard/executive/custom?startDate={DATE_S}&endDate={DATE_E}",
     None, {200}, "data.kpiCards"),
    ("dashboard_composite.unified", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/dashboard?period=month",
     None, {200}, "data.kpiCards"),
    ("dashboard.data_date_range", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/data-date-range", None, {200}, None),

    # datasource (5) — fields/history/preview use id=1; upload skipped (multipart, R5)
    ("datasource.fields", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/1/fields",
     None, {200, 404}, None),
    ("datasource.history", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/1/history?page=0&size=20",
     None, {200, 404}, "data.items"),
    ("datasource.upload", "SKIP_MULTIPART",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/upload",
     None, {0}, None),
    ("datasource.preview", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/1/preview",
     None, {200, 404}, None),
    ("datasource.apply", "POST",
     f"/api/mobile/{FACTORY}/smart-bi/datasource/apply",
     {"datasourceId": 1, "schemaChanges": []},
     {200, 400, 404, 422}, None),

    # query_templates_write (3)
    ("query_templates_write.create", "POST",
     f"/api/mobile/{FACTORY}/smart-bi/query-templates",
     {"name": "R1A_smoke_create", "category": "finance",
      "queryTemplate": "SELECT 1", "parameters": "{}"},
     {200, 201}, None),
    ("query_templates_write.update", "PUT",
     f"/api/mobile/{FACTORY}/smart-bi/query-templates/999999",
     {"templateName": "R1A smoke update"},
     {200, 404}, None),
    ("query_templates_write.delete", "DELETE",
     f"/api/mobile/{FACTORY}/smart-bi/query-templates/999999",
     None, {200, 404}, None),

    # incentive_plan (1)
    ("incentive_plan.get", "GET",
     f"/api/mobile/{FACTORY}/smart-bi/incentive-plan/staff/1",
     None, {200, 404}, None),
]


def curl(method, path, body):
    """Run a curl, return dict with http_code, size, body_text."""
    url = BASE + path
    args = ["curl", "-sS", "-m", "30", "-o", "/tmp/r1a-resp.json",
            "-w", "HTTP=%{http_code}|SIZE=%{size_download}",
            "-X", method,
            "-H", f"Authorization: Bearer {TOKEN}",
            "-H", "Content-Type: application/json"]
    if body is not None:
        args += ["-d", json.dumps(body, ensure_ascii=False)]
    args.append(url)
    try:
        out = subprocess.check_output(args, timeout=35, stderr=subprocess.STDOUT).decode()
    except Exception as exc:
        return {"http": 0, "size": 0, "body_text": f"CURL_ERR: {exc}",
                "parsed": None}
    # parse "HTTP=200|SIZE=1234"
    parts = dict(p.split("=", 1) for p in out.split("|") if "=" in p)
    http = int(parts.get("HTTP", "0"))
    size = int(parts.get("SIZE", "0"))
    try:
        body_text = open("/tmp/r1a-resp.json", encoding="utf-8").read()
    except Exception:
        body_text = ""
    parsed = None
    if body_text:
        try:
            parsed = json.loads(body_text)
        except Exception:
            parsed = None
    return {"http": http, "size": size,
            "body_text": body_text[:4000], "parsed": parsed}


def envelope_keys(parsed):
    if isinstance(parsed, dict):
        return sorted(parsed.keys())
    return None


def rule9_sample(parsed, data_key):
    """Sample top3 + mid + last 2 from a data list."""
    if not parsed or not data_key:
        return None
    keys = data_key.split(".")
    cur = parsed
    for k in keys:
        if isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    if not isinstance(cur, list):
        return None
    n = len(cur)
    if n == 0:
        return {"n": 0, "rows": []}
    indices = []
    if n >= 1:
        indices.append(0)
    if n >= 2:
        indices.append(1)
    if n >= 3:
        indices.append(2)
    if n >= 5:
        indices.append(n // 2)
    if n >= 4:
        indices.append(n - 2)
        indices.append(n - 1)
    indices = sorted(set(indices))
    rows = []
    for i in indices:
        row = cur[i]
        if isinstance(row, dict):
            rows.append({"idx": i, "keys": sorted(row.keys())[:8],
                         "sample": {k: row.get(k) for k in list(row.keys())[:4]}})
        else:
            rows.append({"idx": i, "value": row})
    return {"n": n, "rows": rows}


def main():
    results = []
    for label, method, path, body, expected, rule9_key in ENDPOINTS:
        if method == "SKIP_MULTIPART":
            results.append({
                "label": label, "method": "POST", "path": path,
                "http": None, "size": None, "envelope_keys": None,
                "pass_fail": "SKIP",
                "note": "multipart upload — deferred to R5 boundary (per spec §5 Round 5)",
            })
            continue
        r = curl(method, path, body)
        result = {
            "label": label, "method": method, "path": path,
            "http": r["http"], "size": r["size"],
            "envelope_keys": envelope_keys(r["parsed"]),
            "envelope_code": (r["parsed"] or {}).get("code") if isinstance(r["parsed"], dict) else None,
            "envelope_message": (r["parsed"] or {}).get("message") if isinstance(r["parsed"], dict) else None,
            "rule9_sample": rule9_sample(r["parsed"], rule9_key),
            "expected": sorted(expected),
            "body_excerpt": r["body_text"][:600],
        }
        result["pass_fail"] = "PASS" if r["http"] in expected else "FAIL"
        results.append(result)
        print(f"[{result['pass_fail']:4s}] {label:48s} HTTP={r['http']:3d} SIZE={r['size']:6d}",
              file=sys.stderr)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
