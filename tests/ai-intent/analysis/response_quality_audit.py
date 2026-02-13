#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Response Quality Audit for ALL Intent Handlers

Tests every known intent code against the production server's /execute endpoint
and evaluates the quality of each response (formattedText, resultData, etc.)

Output: response_quality_audit.json
"""

import requests
import json
import sys
import time
from datetime import datetime
from collections import defaultdict

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SERVER = 'http://139.196.165.140:10010'
FACTORY_ID = 'F001'
LOGIN_URL = f'{SERVER}/api/mobile/auth/unified-login'
EXECUTE_URL = f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/execute'

# All known intent codes organized by handler/category with appropriate test queries
INTENTS_TO_TEST = [
    # === BATCH / MATERIAL (MaterialIntentHandler) ===
    {"code": "PROCESSING_BATCH_LIST", "query": "查看所有生产批次", "category": "Batch/Material"},
    {"code": "MATERIAL_BATCH_QUERY", "query": "查看原料批次信息", "category": "Batch/Material"},
    {"code": "MATERIAL_LOW_STOCK_ALERT", "query": "低库存预警", "category": "Batch/Material"},
    {"code": "MATERIAL_EXPIRED_QUERY", "query": "查看过期原料", "category": "Batch/Material"},
    {"code": "MATERIAL_EXPIRING_ALERT", "query": "临期原料预警", "category": "Batch/Material"},
    {"code": "MATERIAL_FIFO_RECOMMEND", "query": "先进先出推荐", "category": "Batch/Material"},

    # === ATTENDANCE (HRIntentHandler) ===
    {"code": "ATTENDANCE_TODAY", "query": "今天考勤情况怎么样", "category": "Attendance"},
    {"code": "ATTENDANCE_HISTORY", "query": "查看考勤历史记录", "category": "Attendance"},
    {"code": "ATTENDANCE_STATS", "query": "本月考勤统计分析", "category": "Attendance"},
    {"code": "ATTENDANCE_STATUS", "query": "当前考勤状态", "category": "Attendance"},
    {"code": "ATTENDANCE_MONTHLY", "query": "月度考勤汇总", "category": "Attendance"},
    {"code": "ATTENDANCE_ANOMALY", "query": "考勤异常情况", "category": "Attendance"},
    {"code": "ATTENDANCE_DEPARTMENT", "query": "部门考勤统计", "category": "Attendance"},

    # === REPORTS (ReportIntentHandler) ===
    {"code": "REPORT_PRODUCTION", "query": "查看本月产量报告", "category": "Reports"},
    {"code": "REPORT_QUALITY", "query": "质检报告", "category": "Reports"},
    {"code": "REPORT_INVENTORY", "query": "库存报告", "category": "Reports"},
    {"code": "REPORT_KPI", "query": "KPI关键指标报告", "category": "Reports"},
    {"code": "REPORT_DASHBOARD_OVERVIEW", "query": "仪表盘总览数据", "category": "Reports"},
    {"code": "REPORT_EFFICIENCY", "query": "生产效率报告", "category": "Reports"},
    {"code": "REPORT_TRENDS", "query": "趋势分析报告", "category": "Reports"},
    {"code": "REPORT_FINANCE", "query": "财务报告", "category": "Reports"},
    {"code": "REPORT_ANOMALY", "query": "异常报告", "category": "Reports"},
    {"code": "COST_QUERY", "query": "成本查询分析", "category": "Reports"},
    {"code": "COST_TREND_ANALYSIS", "query": "成本趋势分析", "category": "Reports"},

    # === QUALITY (QualityIntentHandler) ===
    {"code": "QUALITY_CHECK_QUERY", "query": "查看质检记录", "category": "Quality"},
    {"code": "QUALITY_STATS", "query": "质检统计数据", "category": "Quality"},
    {"code": "QUALITY_CRITICAL_ITEMS", "query": "关键质检项目", "category": "Quality"},

    # === SHIPMENT / TRACE (ShipmentIntentHandler) ===
    {"code": "SHIPMENT_QUERY", "query": "查看发货记录", "category": "Shipment"},
    {"code": "SHIPMENT_STATS", "query": "发货统计数据", "category": "Shipment"},
    {"code": "TRACE_BATCH", "query": "批次溯源查询", "category": "Shipment"},
    {"code": "TRACE_FULL", "query": "完整溯源信息", "category": "Shipment"},
    {"code": "TRACE_PUBLIC", "query": "公开溯源查询", "category": "Shipment"},

    # === ALERTS (AlertIntentHandler) ===
    {"code": "ALERT_LIST", "query": "查看告警列表", "category": "Alerts"},
    {"code": "ALERT_STATS", "query": "告警统计分析", "category": "Alerts"},
    {"code": "ALERT_ACTIVE", "query": "当前活跃告警", "category": "Alerts"},
    {"code": "ALERT_TRIAGE", "query": "告警分类处理", "category": "Alerts"},

    # === CRM (CRMIntentHandler) ===
    {"code": "CUSTOMER_LIST", "query": "客户列表", "category": "CRM"},
    {"code": "CUSTOMER_STATS", "query": "客户统计数据", "category": "CRM"},
    {"code": "CUSTOMER_ACTIVE", "query": "活跃客户", "category": "CRM"},
    {"code": "CUSTOMER_PURCHASE_HISTORY", "query": "客户采购历史", "category": "CRM"},
    {"code": "SUPPLIER_LIST", "query": "供应商列表", "category": "CRM"},
    {"code": "SUPPLIER_ACTIVE", "query": "活跃供应商", "category": "CRM"},
    {"code": "SUPPLIER_RANKING", "query": "供应商排名", "category": "CRM"},

    # === SCALE (ScaleIntentHandler) ===
    {"code": "SCALE_LIST_DEVICES", "query": "查看秤设备列表", "category": "Scale"},
    {"code": "SCALE_LIST_PROTOCOLS", "query": "查看秤协议列表", "category": "Scale"},

    # === CONFIG (ConfigIntentHandler) ===
    {"code": "EQUIPMENT_MAINTENANCE", "query": "设备维护记录查询", "category": "Config"},
    {"code": "RULE_CONFIG", "query": "查看业务规则配置", "category": "Config"},

    # === DATA OPERATION (DataOperationIntentHandler) ===
    {"code": "PRODUCT_TYPE_QUERY", "query": "查看产品类型", "category": "DataOp"},

    # === USER (UserIntentHandler) — preview only ===
    {"code": "USER_CREATE", "query": "创建新用户 用户名test_user 姓名测试用户 角色operator", "category": "User", "preview": True},

    # === SYSTEM (SystemIntentHandler) ===
    {"code": "SCHEDULING_SET_AUTO", "query": "设置排产为全自动模式", "category": "System", "preview": True},

    # === CAMERA (CameraIntentHandler) ===
    {"code": "CAMERA_LIST", "query": "查看摄像头列表", "category": "Camera"},
    {"code": "CAMERA_STATUS", "query": "摄像头在线状态", "category": "Camera"},

    # === META (MetaIntentHandler) ===
    {"code": "INTENT_ANALYZE", "query": "分析所有意图使用情况", "category": "Meta"},

    # === DECORATION (DecorationIntentHandler) ===
    {"code": "HOME_LAYOUT_SUGGEST", "query": "首页布局优化建议", "category": "Decoration"},

    # === Additional intents that may or may not exist ===
    {"code": "COLD_CHAIN_TEMPERATURE", "query": "冷链温度监控", "category": "Extra"},
    {"code": "PROCESSING_BATCH_TIMELINE", "query": "生产批次时间线", "category": "Extra"},
    {"code": "EQUIPMENT_STATUS_QUERY", "query": "设备运行状态", "category": "Extra"},
    {"code": "EQUIPMENT_LIST", "query": "设备列表", "category": "Extra"},
    {"code": "EQUIPMENT_STATS", "query": "设备统计数据", "category": "Extra"},
    {"code": "PRODUCTION_STATUS_QUERY", "query": "生产进度查询", "category": "Extra"},
]


def login():
    """Login and get JWT token."""
    payload = {"username": "factory_admin1", "password": "123456"}
    resp = requests.post(LOGIN_URL, json=payload, timeout=15)
    resp.raise_for_status()
    body = resp.json()
    if not body.get('success'):
        raise Exception(f"Login failed: {body.get('message')}")
    token = body['data'].get('accessToken') or body['data'].get('token')
    if not token:
        raise Exception(f"No token in response. Keys: {list(body['data'].keys())}")
    print(f"[OK] Logged in. Token: {token[:20]}...")
    return token


def execute_intent(token, intent_code, user_input, preview_only=False):
    """Execute a single intent and return full response details."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "intentCode": intent_code,
        "userInput": user_input,
        "previewOnly": preview_only
    }

    start = time.time()
    try:
        resp = requests.post(EXECUTE_URL, json=payload, headers=headers, timeout=30)
        elapsed_ms = (time.time() - start) * 1000
        http_status = resp.status_code

        if http_status != 200:
            return {
                "http_status": http_status,
                "error": resp.text[:500],
                "elapsed_ms": round(elapsed_ms, 1)
            }

        body = resp.json()
        return {
            "http_status": http_status,
            "success": body.get("success"),
            "message_top": body.get("message"),
            "data": body.get("data"),
            "elapsed_ms": round(elapsed_ms, 1)
        }
    except requests.exceptions.Timeout:
        return {"http_status": 0, "error": "TIMEOUT (30s)", "elapsed_ms": 30000}
    except Exception as e:
        elapsed_ms = (time.time() - start) * 1000
        return {"http_status": 0, "error": str(e), "elapsed_ms": round(elapsed_ms, 1)}


def grade_response(result, intent_code):
    """
    Grade the response quality:
    A = Rich response with formatted text + meaningful data
    B = Has data but no/poor formatted text
    C = Empty or useless response (success but no useful content)
    F = Failed/error
    """
    if result.get("error"):
        return "F", "HTTP error or timeout"

    if not result.get("success"):
        return "F", f"success=false: {result.get('message_top', 'unknown')}"

    data = result.get("data")
    if not data:
        return "F", "No data object in response"

    status = data.get("status", "")
    if status == "FAILED":
        return "F", f"status=FAILED: {data.get('message', 'unknown')}"

    # Check formattedText
    formatted_text = data.get("formattedText") or ""
    ft_len = len(formatted_text.strip())

    # Check resultData
    result_data = data.get("resultData")
    rd_keys = list(result_data.keys()) if isinstance(result_data, dict) else []
    rd_has_content = False
    rd_content_details = {}

    if isinstance(result_data, dict):
        for k, v in result_data.items():
            if isinstance(v, list):
                rd_content_details[k] = f"list[{len(v)}]"
                if len(v) > 0:
                    rd_has_content = True
            elif isinstance(v, dict):
                rd_content_details[k] = f"dict[{len(v)}]"
                if len(v) > 0:
                    rd_has_content = True
            elif v is not None and v != "" and v != 0:
                rd_content_details[k] = str(v)[:50]
                rd_has_content = True
            else:
                rd_content_details[k] = repr(v)

    # Grading logic
    issues = []

    if ft_len == 0:
        issues.append("formattedText is EMPTY")
    elif ft_len < 20:
        issues.append(f"formattedText very short ({ft_len} chars)")

    if not rd_keys:
        issues.append("resultData is empty/null")
    elif not rd_has_content:
        issues.append("resultData has keys but all empty values")

    if ft_len >= 50 and rd_has_content:
        return "A", "Rich response"
    elif ft_len >= 20 and rd_has_content:
        return "A", "Good response"
    elif rd_has_content and ft_len == 0:
        return "B", "Has data but NO formattedText"
    elif rd_has_content and ft_len < 20:
        return "B", f"Has data but formattedText too short ({ft_len} chars)"
    elif ft_len >= 20 and not rd_has_content:
        return "B", "Has formattedText but empty resultData"
    elif status == "SUCCESS" and not rd_has_content and ft_len == 0:
        return "C", "SUCCESS but empty response"
    else:
        return "C", "; ".join(issues) if issues else "Unclear quality"


def run_audit():
    """Run the full audit."""
    print("=" * 70)
    print("  AI Intent Response Quality Audit")
    print(f"  Server: {SERVER}")
    print(f"  Time: {datetime.now().isoformat()}")
    print("=" * 70)

    # Login
    token = login()
    print()

    results = []
    category_stats = defaultdict(lambda: {"A": 0, "B": 0, "C": 0, "F": 0, "total": 0})
    grade_counts = {"A": 0, "B": 0, "C": 0, "F": 0}

    total = len(INTENTS_TO_TEST)
    for i, intent in enumerate(INTENTS_TO_TEST):
        code = intent["code"]
        query = intent["query"]
        category = intent["category"]
        preview = intent.get("preview", False)

        print(f"[{i+1}/{total}] {code} ... ", end="", flush=True)

        result = execute_intent(token, code, query, preview_only=preview)

        # Extract key fields from data
        data = result.get("data", {}) or {}
        formatted_text = (data.get("formattedText") or "")
        ft_len = len(formatted_text.strip())

        result_data = data.get("resultData")
        rd_keys = list(result_data.keys()) if isinstance(result_data, dict) else []

        rd_content_details = {}
        if isinstance(result_data, dict):
            for k, v in result_data.items():
                if isinstance(v, list):
                    rd_content_details[k] = f"list[{len(v)}]"
                elif isinstance(v, dict):
                    rd_content_details[k] = f"dict[{len(v)}]"
                elif v is not None:
                    rd_content_details[k] = str(v)[:80]
                else:
                    rd_content_details[k] = "null"

        grade, reason = grade_response(result, code)

        # Record
        entry = {
            "intentCode": code,
            "query": query,
            "category": category,
            "previewOnly": preview,
            "httpStatus": result.get("http_status"),
            "success": result.get("success"),
            "dataStatus": data.get("status"),
            "dataMessage": data.get("message", ""),
            "intentRecognized": data.get("intentRecognized"),
            "recognizedIntentCode": data.get("intentCode"),
            "recognizedIntentName": data.get("intentName"),
            "formattedTextLength": ft_len,
            "formattedTextPreview": formatted_text.strip()[:200] if formatted_text else "",
            "resultDataKeys": rd_keys,
            "resultDataDetails": rd_content_details,
            "suggestedActions": data.get("suggestedActions"),
            "grade": grade,
            "gradeReason": reason,
            "elapsedMs": result.get("elapsed_ms"),
            "error": result.get("error"),
        }
        results.append(entry)

        grade_counts[grade] += 1
        category_stats[category]["total"] += 1
        category_stats[category][grade] += 1

        # Color-coded grade
        grade_symbol = {"A": "A+", "B": "B ", "C": "C-", "F": "F!"}
        print(f"[{grade_symbol.get(grade, '??')}] {reason[:50]}  ({result.get('elapsed_ms', 0):.0f}ms)")

        # Small delay to avoid overloading
        time.sleep(0.3)

    # Summary
    print()
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"  Total intents tested: {total}")
    print(f"  Grade A (rich response):    {grade_counts['A']}")
    print(f"  Grade B (partial response): {grade_counts['B']}")
    print(f"  Grade C (empty/useless):    {grade_counts['C']}")
    print(f"  Grade F (failed):           {grade_counts['F']}")
    print()

    print("  By Category:")
    for cat, stats in sorted(category_stats.items()):
        print(f"    {cat:20s}  A:{stats['A']}  B:{stats['B']}  C:{stats['C']}  F:{stats['F']}  total:{stats['total']}")

    print()

    # Identify issues
    empty_ft = [r for r in results if r["grade"] in ("B", "C") and r["formattedTextLength"] == 0]
    if empty_ft:
        print(f"  EMPTY formattedText ({len(empty_ft)} intents):")
        for r in empty_ft:
            print(f"    - {r['intentCode']} ({r['category']}): resultData keys={r['resultDataKeys']}")

    failed = [r for r in results if r["grade"] == "F"]
    if failed:
        print(f"\n  FAILED ({len(failed)} intents):")
        for r in failed:
            msg = r.get("error") or r.get("dataMessage") or r.get("gradeReason")
            print(f"    - {r['intentCode']} ({r['category']}): {msg[:80]}")

    # Build output JSON
    output = {
        "meta": {
            "title": "AI Intent Response Quality Audit",
            "server": SERVER,
            "timestamp": datetime.now().isoformat(),
            "totalIntentsTested": total,
        },
        "summary": {
            "gradeA": grade_counts["A"],
            "gradeB": grade_counts["B"],
            "gradeC": grade_counts["C"],
            "gradeF": grade_counts["F"],
            "total": total,
            "qualityRate": round((grade_counts["A"]) / total * 100, 1) if total > 0 else 0,
            "successRate": round((grade_counts["A"] + grade_counts["B"] + grade_counts["C"]) / total * 100, 1) if total > 0 else 0,
        },
        "categoryBreakdown": dict(category_stats),
        "results": results,
    }

    # Save
    output_path = "C:/Users/Steve/my-prototype-logistics/tests/ai-intent/analysis/response_quality_audit.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    print(f"\n  Results saved to: {output_path}")
    print("=" * 70)

    return output


if __name__ == "__main__":
    run_audit()
