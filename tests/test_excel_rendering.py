#!/usr/bin/env python3
"""SmartBI Excel Rendering Test Suite - Uses subprocess curl for network.

Flow: Upload(parse) → Confirm(persist) → SmartRecommend(charts) → BatchBuild → AI Insights
"""
import subprocess, json, time, os, tempfile

JAVA_API = "http://47.100.235.168:10010/api/mobile"
PYTHON_API = "http://47.100.235.168:8083"
FACTORY = "F001"
TEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-data")


def curl_json(method, url, headers=None, json_data=None, file_path=None, form_data=None, timeout=120):
    """Execute curl and return (json_dict, elapsed_seconds)."""
    cmd = ["curl", "-s", "-w", r"\n__TIME__%{time_total}", "--max-time", str(timeout)]
    if method == "POST":
        cmd += ["-X", "POST"]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    tf = None
    if json_data is not None:
        tf = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
        json.dump(json_data, tf)
        tf.close()
        cmd += ["-H", "Content-Type: application/json", "-d", f"@{tf.name}"]
    if file_path:
        cmd += ["-F", f"file=@{file_path}"]
        for k, v in (form_data or {}).items():
            cmd += ["-F", f"{k}={v}"]
    cmd.append(url)

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(cmd, capture_output=True, timeout=timeout + 10, env=env)
    raw = result.stdout.decode("utf-8", errors="replace")

    if tf:
        try: os.unlink(tf.name)
        except: pass

    elapsed = 0
    lines = raw.split("\n")
    body_lines = []
    for line in lines:
        if line.startswith("__TIME__"):
            try: elapsed = float(line.replace("__TIME__", ""))
            except: pass
        else:
            body_lines.append(line)
    body = "\n".join(body_lines).strip()

    try:
        return json.loads(body), elapsed
    except json.JSONDecodeError:
        return {"_raw": body[:500], "_error": "JSON parse failed"}, elapsed


def login():
    data, t = curl_json("POST", f"{JAVA_API}/auth/unified-login",
                         json_data={"username": "factory_admin1", "password": "123456"})
    token = data.get("data", {}).get("accessToken", "")
    print(f"Login: {t:.1f}s, token={len(token)} chars")
    return token


def test_file(path, label, token):
    auth = {"Authorization": f"Bearer {token}"}
    print()
    print("=" * 60)
    print(f"TEST: {label}")
    print(f"File: {os.path.basename(path)}")
    print("=" * 60)

    # Step 1: Upload + parse
    data, t_parse = curl_json("POST", f"{JAVA_API}/{FACTORY}/smart-bi/upload",
                               headers=auth, file_path=path,
                               form_data={"data_type": "SALES"})
    pd = data.get("data", {})
    rows = pd.get("rowCount", 0)
    cols = pd.get("columnCount", 0)
    hdrs = pd.get("headers", [])
    preview = pd.get("previewData", [])
    print(f"  Parse: {t_parse:.1f}s - {rows} rows, {cols} cols")

    # Detect metadata sheet (<=3 cols with description-like headers)
    if cols <= 3 and rows < 30:
        print(f"  NOTE: Likely metadata sheet (only {cols} cols). Data may be on another sheet.")

    # Step 2: Confirm + persist
    mappings = pd.get("fieldMappings", [])
    confirmed = {m["originalColumn"]: m.get("standardField", "")
                 for m in mappings if m.get("originalColumn")}
    confirm_payload = {
        "parseResponse": {
            "fileName": os.path.basename(path),
            "sheetName": pd.get("sheetName") or "Sheet1",
            "headers": hdrs,
            "rowCount": rows,
            "columnCount": cols,
            "previewData": preview,
            "tableType": pd.get("tableType", "data"),
            "fieldMappings": mappings,
            "dataFeatures": pd.get("dataFeatures", {}),
        },
        "confirmedMappings": confirmed,
        "dataType": "SALES",
        "saveRawData": True,
        "generateChart": False,
    }
    cdata, t_confirm = curl_json("POST", f"{JAVA_API}/{FACTORY}/smart-bi/upload/confirm",
                                  headers=auth, json_data=confirm_payload)
    cd = cdata.get("data") or {}
    upload_id = None
    if isinstance(cd, dict):
        upload_id = cd.get("uploadId") or cd.get("id")
    confirm_ok = cdata.get("success", False)

    if not upload_id and confirm_ok:
        # Some confirm responses return upload_id at top level
        upload_id = cdata.get("uploadId")

    if not upload_id:
        # Get from history
        hist, _ = curl_json("GET", f"{JAVA_API}/{FACTORY}/smart-bi/uploads", headers=auth)
        uploads = hist.get("data", [])
        if uploads:
            upload_id = uploads[0].get("id") or uploads[0].get("uploadId")
            print(f"  Confirm: {t_confirm:.1f}s - uploadId={upload_id} (from history)")
    else:
        print(f"  Confirm: {t_confirm:.1f}s - uploadId={upload_id}")

    if not upload_id:
        print("  ERROR: No uploadId. Skipping chart/AI.")
        return

    # Step 3: Fetch persisted data for chart generation
    table_data, t_fetch = curl_json("GET",
        f"{JAVA_API}/{FACTORY}/smart-bi/uploads/{upload_id}/data?page=0&size=200",
        headers=auth)
    td = table_data.get("data", {})
    chart_rows = []
    if isinstance(td, dict):
        chart_rows = td.get("content", []) or td.get("data", []) or td.get("rows", [])
    elif isinstance(td, list):
        chart_rows = td
    print(f"  Fetch data: {t_fetch:.1f}s - {len(chart_rows)} rows from DB")

    # If no rows from DB, use previewData from parse
    if not chart_rows and preview:
        chart_rows = preview
        print(f"  Using previewData fallback: {len(chart_rows)} rows")

    # Step 4: Smart chart recommendation
    charts = []
    rec_titles = []
    t_charts = 0
    if chart_rows and len(chart_rows) > 0:
        recommend_payload = {
            "data": chart_rows[:100],  # limit to 100 rows for recommendation
            "sheetName": pd.get("sheetName") or "Sheet1",
            "scenario": "general",
            "maxRecommendations": 7,
        }
        rec_data, t_rec = curl_json("POST", f"{PYTHON_API}/api/chart/smart-recommend",
                                     json_data=recommend_payload, timeout=90)
        t_charts = t_rec

        recommendations = []
        if isinstance(rec_data.get("data"), dict):
            recommendations = rec_data["data"].get("recommendations", [])
        elif isinstance(rec_data.get("recommendations"), list):
            recommendations = rec_data["recommendations"]

        print(f"  Recommend: {t_rec:.1f}s - {len(recommendations)} chart suggestions")
        if rec_data.get("_error") or rec_data.get("detail"):
            print(f"    Error: {rec_data.get('_error') or rec_data.get('detail') or rec_data.get('message','')[:200]}")

        # Step 5: Batch build charts
        if recommendations:
            plans = []
            rec_titles = []
            for r in recommendations[:7]:
                title = r.get("title") or r.get("chartType", "Chart")
                rec_titles.append(title)
                plan = {
                    "chartType": r.get("chartType", "bar"),
                    "data": chart_rows[:100],
                    "xField": r.get("xField", hdrs[0] if hdrs else ""),
                    "yFields": r.get("yFields", [hdrs[1]] if len(hdrs) > 1 else []),
                    "title": title,
                }
                if r.get("seriesField"):
                    plan["seriesField"] = r["seriesField"]
                plans.append(plan)

            build_data, t_build = curl_json("POST", f"{PYTHON_API}/api/chart/batch",
                                             json_data=plans, timeout=90)
            t_charts += t_build

            built = []
            if isinstance(build_data.get("data"), dict):
                built = build_data["data"].get("charts", [])
            elif isinstance(build_data.get("charts"), list):
                built = build_data["charts"]
            elif isinstance(build_data, list):
                built = build_data

            charts = [c for c in built if c.get("success", True)]
            print(f"  Build: {t_build:.1f}s - {len(charts)}/{len(plans)} charts built")
    else:
        print("  Charts: SKIP (no data rows)")

    chart_types = {}
    for c in charts:
        ct = c.get("chartType", "") or c.get("type", "unknown")
        chart_types[ct] = chart_types.get(ct, 0) + 1
    if chart_types:
        print(f"    Types: {chart_types}")
    for i, c in enumerate(charts[:4]):
        title = c.get("title", "") or (rec_titles[i] if i < len(rec_titles) else "N/A")
        ct = c.get("chartType", "")
        print(f"    - [{ct}] {title}")
    if len(charts) > 4:
        print(f"    ... and {len(charts) - 4} more")

    # Step 6: AI insights
    kpis = []
    risks = []
    suggs = []
    ai_payload = {"upload_id": upload_id, "sheet_name": pd.get("sheetName") or "Sheet1"}
    aidata, t_ai = curl_json("POST", f"{PYTHON_API}/api/insight/quick-summary",
                              json_data=ai_payload, timeout=90)

    # quick-summary returns column stats; use generate for richer LLM analysis
    if chart_rows:
        gen_payload = {
            "data": chart_rows[:100],
            "sheetName": pd.get("sheetName") or "Sheet1",
            "analysisType": "comprehensive",
        }
        gen_data, t_gen = curl_json("POST", f"{PYTHON_API}/api/insight/generate",
                                     json_data=gen_payload, timeout=90)
        t_ai += t_gen

        # insight/generate returns {success, insights: [{type, text, risk_alerts, opportunities, ...}]}
        insights_list = gen_data.get("insights", [])
        if isinstance(insights_list, list) and insights_list:
            # Extract from nested insight objects
            for ins in insights_list:
                for ra in (ins.get("risk_alerts") or []):
                    risks.append(ra)
                for op in (ins.get("opportunities") or []):
                    suggs.append(op)
                # The _meta type insight contains the executive summary
                if ins.get("executive_summary"):
                    suggs_text = ins["executive_summary"]
            # Count KPIs from quick-summary columns
            qs_cols = aidata.get("columns", [])
            kpis = [c for c in qs_cols if isinstance(c, dict) and c.get("type") in ("float64", "int64")]

            print(f"  AI: {t_ai:.1f}s")
            print(f"    Insights: {len(insights_list)}, Risks: {len(risks)}, Opportunities: {len(suggs)}, Numeric cols: {len(kpis)}")
        else:
            print(f"  AI: {t_ai:.1f}s - no insights")
            if gen_data.get("_error") or gen_data.get("detail"):
                print(f"    Error: {gen_data.get('_error') or gen_data.get('detail','')[:200]}")
    else:
        print(f"  AI: SKIP (no data)")

    total = t_parse + t_confirm + t_fetch + t_charts + t_ai
    print(f"  TOTAL: {total:.1f}s")

    # Rating: EXCELLENT needs 5+ charts + AI insights, GOOD needs 3+ charts
    has_ai = len(risks) > 0 or len(suggs) > 0
    rating = "EXCELLENT" if len(charts) >= 5 and has_ai else \
             "GOOD" if len(charts) >= 3 else \
             "BASIC" if len(charts) >= 1 else "POOR"
    print(f"  RATING: {rating}")
    return {
        "label": label, "rows": rows, "cols": cols, "charts": len(charts),
        "chart_types": chart_types, "kpis": len(kpis), "risks": len(risks),
        "suggestions": len(suggs), "total_time": total, "rating": rating,
    }


if __name__ == "__main__":
    print("====== SmartBI Excel Rendering Test Suite ======")
    print(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Endpoints: Java={JAVA_API}, Python={PYTHON_API}")
    print()

    token = login()
    if not token:
        print("FATAL: Login failed")
        exit(1)

    files = [
        (os.path.join(TEST_DIR, "Test-mock-mfg-normal-s42.xlsx"), "1. Manufacturing Normal (42 rows)"),
        (os.path.join(TEST_DIR, "restaurant", "Restaurant-hotpot-normal-s42.xlsx"), "2. Restaurant Hotpot (42 rows)"),
        (os.path.join(TEST_DIR, "edge-cases", "Edge-wide-120col.xlsx"), "3. Wide Table (120 cols)"),
        (os.path.join(TEST_DIR, "edge-cases", "Edge-empty-regions.xlsx"), "4. Empty Regions"),
        (os.path.join(TEST_DIR, "edge-cases", "Edge-cross-year-yoy.xlsx"), "5. Cross-Year YoY"),
        (os.path.join(TEST_DIR, "Test-mock-retail-normal-s42.xlsx"), "6. Retail Normal (42 rows)"),
    ]

    results = []
    for path, label in files:
        if os.path.exists(path):
            r = test_file(path, label, token)
            if r:
                results.append(r)
        else:
            print(f"\nSKIP: {label} - file not found: {path}")

    # Summary table
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"{'Test':<35} {'Rows':>5} {'Cols':>5} {'Charts':>6} {'KPIs':>5} {'Time':>6} {'Rating'}")
    print("-" * 90)
    for r in results:
        print(f"{r['label']:<35} {r['rows']:>5} {r['cols']:>5} {r['charts']:>6} {r['kpis']:>5} {r['total_time']:>5.1f}s {r['rating']}")

    passed = sum(1 for r in results if r['rating'] in ('EXCELLENT', 'GOOD'))
    print(f"\nPassed (GOOD+): {passed}/{len(results)}")
    print("====== Complete ======")
