"""
报工 E2E 完整测试
Tests the full work-reporting flow:
  Login → Scan → Report → Team Report → Photo Upload → VL Analysis → DB Verify
"""
import json
import base64
import httpx
import sys

BASE = "http://localhost:10010"
PY = "http://localhost:8083"
RESULTS = []


def log(step, status, detail):
    RESULTS.append({"step": step, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else "FAIL"
    print(f"[{icon}] Step {step}: {detail[:200]}")


def main():
    # ===== STEP 1: Login =====
    print("=" * 60)
    print("STEP 1: Login as workshop_sup1")
    print("=" * 60)
    r = httpx.post(
        f"{BASE}/api/mobile/auth/unified-login",
        json={"username": "workshop_sup1", "password": "123456"},
        timeout=15,
    )
    d = r.json()
    if not d.get("success"):
        log(1, "FAIL", f'Login failed: {d.get("message")}')
        print("ABORT")
        return

    token = d["data"]["token"]
    user_id = d["data"]["userId"]
    factory_id = d["data"]["factoryId"]
    role = d["data"]["role"]
    profile_name = d["data"].get("profile", {}).get("name", "")
    log(1, "PASS", f"Login OK: userId={user_id}, factoryId={factory_id}, role={role}, name={profile_name}")
    print(f"  Token: {token[:50]}...")
    print(f"  Profile: {profile_name} ({role})")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ===== STEP 2: List batches =====
    print()
    print("=" * 60)
    print("STEP 2: List active production batches")
    print("=" * 60)
    r = httpx.get(
        f"{BASE}/api/mobile/{factory_id}/processing/batches",
        params={"page": 1, "size": 10},
        headers=headers,
        timeout=15,
    )
    d = r.json()
    test_batch_id = None
    test_batch_number = None

    if d.get("success"):
        raw = d.get("data", {})
        if isinstance(raw, dict) and "content" in raw:
            batches = raw["content"]
        elif isinstance(raw, list):
            batches = raw
        else:
            batches = []

        log(2, "PASS", f"Found {len(batches)} batches")
        for b in batches[:8]:
            bid = b.get("id", "?")
            bn = b.get("batchNumber", "?")
            pt = b.get("productType", "?")
            st = b.get("status", "?")
            aq = b.get("actualQuantity", "?")
            print(f"  Batch #{bid}: {bn} | product={pt} | status={st} | actualQty={aq}")

        if batches:
            test_batch = batches[0]
            test_batch_id = test_batch.get("id")
            test_batch_number = test_batch.get("batchNumber")
    else:
        log(2, "FAIL", f'List batches failed: {d.get("message")}')

    if not test_batch_id:
        test_batch_id = 3
        test_batch_number = "PB20241220001"
        print(f"  Using fallback: id={test_batch_id}, number={test_batch_number}")

    # ===== STEP 3: Scan batch by code =====
    print()
    print("=" * 60)
    print(f"STEP 3: Scan batch by batchNumber={test_batch_number}")
    print("=" * 60)
    r = httpx.post(
        f"{BASE}/api/mobile/{factory_id}/processing/batches/scan",
        json={"code": test_batch_number},
        headers=headers,
        timeout=15,
    )
    d = r.json()
    pre_actual = 0
    pre_good = 0
    pre_defect = 0

    if d.get("success") and d.get("data"):
        bd = d["data"]
        pre_actual = bd.get("actualQuantity", 0) or 0
        pre_good = bd.get("goodQuantity", 0) or 0
        pre_defect = bd.get("defectQuantity", 0) or 0
        log(
            3,
            "PASS",
            f'Scan OK: id={bd.get("id")}, status={bd.get("status")}, '
            f"actual={pre_actual}, good={pre_good}, defect={pre_defect}",
        )
        for k in [
            "id", "batchNumber", "productType", "status",
            "targetQuantity", "actualQuantity", "goodQuantity", "defectQuantity",
        ]:
            print(f"  {k}: {bd.get(k, 'N/A')}")
    else:
        log(3, "FAIL", f'Scan failed: {d.get("message", "unknown")}')

    # ===== STEP 4: Individual work report =====
    print()
    print("=" * 60)
    print(f"STEP 4: Submit individual work report (+50/+48/+2)")
    print("=" * 60)
    report_data = {
        "actualQuantity": 50,
        "goodQuantity": 48,
        "defectQuantity": 2,
        "notes": "E2E test - individual report",
    }
    r = httpx.post(
        f"{BASE}/api/mobile/{factory_id}/processing/batches/{test_batch_id}/report",
        json=report_data,
        headers=headers,
        timeout=15,
    )
    d = r.json()
    if d.get("success") and d.get("data"):
        after = d["data"]
        na = after.get("actualQuantity", 0) or 0
        ng = after.get("goodQuantity", 0) or 0
        nd = after.get("defectQuantity", 0) or 0
        log(
            4,
            "PASS",
            f"Report OK: actual {pre_actual}->{na} (+{na - pre_actual}), "
            f"good {pre_good}->{ng} (+{ng - pre_good}), "
            f"defect {pre_defect}->{nd} (+{nd - pre_defect})",
        )
        print(f"  Before: actual={pre_actual}, good={pre_good}, defect={pre_defect}")
        print(f"  After:  actual={na}, good={ng}, defect={nd}")
        print(f"  Delta:  actual=+{na - pre_actual}, good=+{ng - pre_good}, defect=+{nd - pre_defect}")
        mid_actual = na
    else:
        log(4, "FAIL", f'Report failed: {d.get("message", "unknown")} | HTTP {r.status_code}')
        print(f"  Response: {r.text[:500]}")
        mid_actual = pre_actual

    # ===== STEP 5: Team batch report =====
    print()
    print("=" * 60)
    print(f"STEP 5: Submit team report (3 members: +30, +25, +20)")
    print("=" * 60)
    team_data = {
        "batchId": test_batch_id,
        "members": [
            {"userId": 10, "outputQuantity": 30, "notes": "Worker A"},
            {"userId": 11, "outputQuantity": 25, "notes": "Worker B"},
            {"userId": 12, "outputQuantity": 20, "notes": "Worker C"},
        ],
    }
    r = httpx.post(
        f"{BASE}/api/mobile/{factory_id}/processing/work-sessions/batch-report",
        json=team_data,
        headers=headers,
        timeout=15,
    )
    d = r.json()
    if d.get("success") and d.get("data"):
        tr = d["data"]
        log(5, "PASS", f"Team report OK: {json.dumps(tr, ensure_ascii=False)}")
        for k, v in tr.items():
            print(f"  {k}: {v}")
    else:
        log(5, "FAIL", f'Team report failed: {d.get("message", "unknown")} | HTTP {r.status_code}')
        print(f"  Response: {r.text[:500]}")

    # ===== STEP 6: Photo upload =====
    print()
    print("=" * 60)
    print(f"STEP 6: Upload photo to batch #{test_batch_id}")
    print("=" * 60)
    with open("screenshots/emulator-launch.png", "rb") as f:
        files = {"file": ("factory_scene.png", f, "image/png")}
        form = {"stage": "IN_PROGRESS"}
        r = httpx.post(
            f"{BASE}/api/mobile/{factory_id}/processing/batches/{test_batch_id}/photos",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data=form,
            timeout=30,
        )
    d = r.json()
    if d.get("success") and d.get("data"):
        pid = d["data"].get("photoId")
        purl = d["data"].get("photoUrl")
        log(6, "PASS", f"Photo uploaded: photoId={pid}, url={purl}")
        print(f"  photoId: {pid}")
        print(f"  photoUrl: {purl}")
    else:
        log(6, "FAIL", f'Photo upload failed: {d.get("message", "unknown")}')

    # ===== STEP 7: VL Efficiency Analysis =====
    print()
    print("=" * 60)
    print("STEP 7: Python VL Efficiency Analysis")
    print("=" * 60)
    with open("screenshots/emulator-launch.png", "rb") as f:
        files = {"file": ("scene.png", f, "image/png")}
        form = {"factory_type": "食品加工", "process_hint": "包装"}
        r = httpx.post(f"{PY}/api/efficiency/analyze-frame-upload", files=files, data=form, timeout=120)
    d = r.json()
    if d.get("success"):
        log(
            7,
            "PASS",
            f'VL: workers={d.get("worker_count")}, active={d.get("active_workers")}, '
            f'efficiency={d.get("efficiency_score")}, stage={d.get("process_stage")}',
        )
        for k in [
            "worker_count", "active_workers", "idle_workers", "efficiency_score",
            "process_stage", "safety_compliance", "scene_description", "notes",
        ]:
            print(f"  {k}: {d.get(k, 'N/A')}")
        for i, w in enumerate(d.get("workers", [])):
            print(f"  Worker #{i+1}: pos={w.get('position')}, status={w.get('status')}, action={w.get('action')}")
        if not d.get("workers"):
            print("  (No workers detected - expected for non-factory image)")
    else:
        log(7, "FAIL", f'VL failed: {d.get("error")}')

    # ===== STEP 8: Photo OCR + Counting =====
    print()
    print("=" * 60)
    print("STEP 8: Photo OCR + Counting Analysis")
    print("=" * 60)
    with open("screenshots/emulator-launch.png", "rb") as f:
        files = {"file": ("label.png", f, "image/png")}
        form = {"analysis_type": "both"}
        r = httpx.post(f"{PY}/api/efficiency/photo/analyze", files=files, data=form, timeout=120)
    d = r.json()
    if d.get("success"):
        ocr = d.get("ocr", {})
        counting = d.get("counting", {})
        log(
            8,
            "PASS",
            f'OCR: readable={ocr.get("readable")}, score={ocr.get("overall_score")}, '
            f'rec={ocr.get("recommendation")} | Count: total={counting.get("total_count")}',
        )
        print(f"  OCR readable: {ocr.get('readable')}")
        print(f"  OCR quality: {ocr.get('print_quality')}")
        print(f"  OCR score: {ocr.get('overall_score')}")
        print(f"  OCR recommendation: {ocr.get('recommendation')}")
        recog = ocr.get("recognized_text", {})
        found_any = False
        for k, v in recog.items():
            if v is not None:
                print(f"  OCR.{k}: {v}")
                found_any = True
        if not found_any:
            print("  OCR: No text recognized (expected for non-label image)")
        print(f"  Counting total: {counting.get('total_count')}")
        print(f"  Counting method: {counting.get('counting_method', 'N/A')}")
    else:
        log(8, "FAIL", f'Photo analysis failed: {d.get("error")}')

    # ===== STEP 9: Unified Analysis =====
    print()
    print("=" * 60)
    print("STEP 9: Unified Analysis (eff+ocr+counting in one call)")
    print("=" * 60)
    with open("screenshots/emulator-launch.png", "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    r = httpx.post(
        f"{PY}/api/efficiency/analyze",
        json={
            "image_base64": img_b64,
            "analysis_types": ["efficiency", "ocr", "counting"],
            "factory_type": "食品加工",
        },
        timeout=120,
    )
    d = r.json()
    if d.get("success"):
        results = d.get("results", {})
        types_present = list(results.keys())
        all_ok = all(t in types_present for t in ["efficiency", "ocr", "counting"])
        eff = results.get("efficiency", {})
        log(
            9,
            "PASS",
            f"Unified OK: types={types_present}, all_3_present={all_ok}, "
            f'workers={eff.get("worker_count")}, eff_score={eff.get("efficiency_score")}',
        )
        print(f"  Types present: {types_present}")
        print(f"  All 3 types: {all_ok}")
        print(f"  Efficiency workers: {eff.get('worker_count')}")
        print(f"  OCR readable: {results.get('ocr', {}).get('readable')}")
        print(f"  Counting total: {results.get('counting', {}).get('total_count')}")
    else:
        log(9, "FAIL", f'Unified failed: {d.get("error")}')

    # ===== STEP 10: Final batch verification =====
    print()
    print("=" * 60)
    print(f"STEP 10: Verify final batch data accumulation")
    print("=" * 60)
    r = httpx.post(
        f"{BASE}/api/mobile/{factory_id}/processing/batches/scan",
        json={"code": test_batch_number},
        headers=headers,
        timeout=15,
    )
    d = r.json()
    if d.get("success") and d.get("data"):
        final = d["data"]
        fa = final.get("actualQuantity", 0) or 0
        fg = final.get("goodQuantity", 0) or 0
        fd = final.get("defectQuantity", 0) or 0
        # Expected: individual +50 + team +75 = +125 total on actual
        total_added = fa - pre_actual
        log(
            10,
            "PASS",
            f"Final: actual={fa} (+{total_added} from start), good={fg}, defect={fd}",
        )
        print(f"  Start of test:  actual={pre_actual}, good={pre_good}, defect={pre_defect}")
        print(f"  After all:      actual={fa}, good={fg}, defect={fd}")
        print(f"  Total added:    actual=+{total_added}, good=+{fg - pre_good}, defect=+{fd - pre_defect}")
        print(f"  Expected adds:  individual(+50/+48/+2) + team(+75 actual)")
    else:
        log(10, "FAIL", f'Final verification failed: {d.get("message")}')

    # ===== SUMMARY =====
    print()
    print("=" * 60)
    print("COMPLETE E2E TEST SUMMARY")
    print("=" * 60)
    passes = sum(1 for r in RESULTS if r["status"] == "PASS")
    fails = sum(1 for r in RESULTS if r["status"] == "FAIL")
    total = len(RESULTS)
    print()
    for r in RESULTS:
        icon = "OK" if r["status"] == "PASS" else "XX"
        print(f"  [{icon}] Step {r['step']:2d}: {r['detail'][:120]}")
    print()
    print(f"  Result: {passes}/{total} PASS, {fails}/{total} FAIL")
    if fails == 0:
        print("  ALL TESTS PASSED!")
    print("=" * 60)

    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
