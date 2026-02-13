#!/usr/bin/env python3
"""Deep Response Quality Audit — checks actual content, not just length"""
import json, sys, urllib.request, time

BASE = "http://localhost:10010/api/public/ai-demo/execute"

# 3 categories: 查询(query), 咨询(advisory), 写入(write)
TESTS = [
    # === 查询类 (should return real data) ===
    ("查询", "库存报告", "REPORT_INVENTORY", "应包含库存数据: 总价值/种类/批次数"),
    ("查询", "本周考勤统计", "ATTENDANCE_STATS", "应包含考勤数据: 出勤率/工作日"),
    ("查询", "客户列表", "CUSTOMER_LIST", "应包含客户名称/联系方式"),
    ("查询", "供应商列表", "SUPPLIER_LIST", "应包含供应商名/联系人"),
    ("查询", "质量报告", "REPORT_QUALITY", "应包含质检数据: 合格率/检测量"),
    ("查询", "产量报表", "REPORT_PRODUCTION", "应包含产量数据: 总产量/批次"),
    ("查询", "效率报告", "REPORT_EFFICIENCY", "应包含OEE/产量"),
    ("查询", "设备运行状况", "EQUIPMENT_STATUS_QUERY", "应包含设备台数/运行/空闲/维护状态"),
    ("查询", "今天考勤情况", "ATTENDANCE_TODAY", "应包含今日出勤人数/缺勤"),
    ("查询", "质检记录", "QUALITY_INSPECTION_LIST", "应包含质检记录列表"),
    ("查询", "生产批次查询", "BATCH_QUERY", "应包含批次列表/状态"),
    ("查询", "成本分析", "COST_QUERY", "应包含成本数据或分析维度"),
    ("查询", "排班计划", "SCHEDULING_LIST", "应包含排班信息或时间范围"),

    # === 咨询类 (should provide advice/analysis) ===
    ("咨询", "如何提高生产效率", None, "应给出建议/分析"),
    ("咨询", "最近的质量问题分析", None, "应分析质量趋势或给出建议"),
    ("咨询", "库存优化建议", None, "应给出库存管理建议"),

    # === 写入类 (should ask confirmation or explain permission) ===
    ("写入", "新增一个供应商", None, "应要求确认或说明权限"),
    ("写入", "创建生产工单", None, "应要求参数或说明权限"),
    ("写入", "设备维护计划", "EQUIPMENT_MAINTENANCE", "应要求确认或说明权限"),
    ("写入", "原材料入库", "MATERIAL_INBOUND", "应要求参数或说明权限"),
]

def call_api(query):
    body = json.dumps({"userInput": query, "factoryId": "F001"}).encode()
    req = urllib.request.Request(BASE, data=body, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def quality_check(category, text, intent_code):
    """Rate quality: GOOD / WEAK / BAD / EMPTY"""
    if not text or len(text) == 0:
        return "EMPTY", "无任何回复"

    text_lower = text.lower()

    # Check for generic/useless responses
    generic_patterns = [
        "请稍后", "暂不支持", "功能开发中", "请联系管理员",
        "未能识别", "请尝试更具体"
    ]

    if category == "查询":
        # Query responses should have actual data (numbers, lists, names)
        has_numbers = any(c.isdigit() for c in text)
        has_colon = ":" in text or "：" in text
        has_list = "1." in text or "•" in text or "|" in text
        has_unit = any(u in text for u in ["kg", "¥", "%", "台", "条", "批", "种", "位", "家", "个", "天"])

        if has_numbers and (has_list or has_unit or has_colon) and len(text) >= 40:
            return "GOOD", "包含真实数据"
        elif has_numbers and len(text) >= 20:
            return "WEAK", "有数据但不够详细"
        elif any(p in text for p in generic_patterns):
            return "BAD", "泛化回复无数据"
        elif "敏感度" in text or "需要验证权限" in text:
            return "WEAK", "权限拦截,非数据回复"
        else:
            return "WEAK", "回复简短或无数据"

    elif category == "咨询":
        # Advisory should have suggestions, analysis
        has_suggestion = any(w in text for w in ["建议", "分析", "优化", "改善", "提高", "方案", "策略"])
        has_list = any(f"{i}." in text for i in range(1, 6)) or "•" in text

        if has_suggestion and len(text) >= 50:
            return "GOOD", "有建议/分析内容"
        elif len(text) >= 30:
            return "WEAK", "有回复但缺乏具体建议"
        elif "未能识别" in text:
            return "BAD", "意图未识别"
        else:
            return "WEAK", "回复不够有用"

    elif category == "写入":
        # Write should ask for confirmation or explain permissions
        has_confirm = any(w in text for w in ["确认", "参数", "权限", "敏感", "审批", "登录", "验证"])
        has_form = any(w in text for w in ["请提供", "请输入", "需要", "必须"])

        if has_confirm or has_form:
            return "GOOD", "正确要求确认/权限"
        elif "未能识别" in text:
            return "BAD", "意图未识别"
        elif len(text) >= 20:
            return "WEAK", "有回复但未要求确认"
        else:
            return "WEAK", "回复不完整"

    return "WEAK", "未分类"

print("=" * 140)
print("  Deep Response Quality Audit — Intent Pipeline v6")
print("=" * 140)

results = {"GOOD": 0, "WEAK": 0, "BAD": 0, "EMPTY": 0}
details = []

for cat, query, exp_intent, criteria in TESTS:
    time.sleep(0.3)  # rate limit
    resp = call_api(query)

    if "error" in resp:
        quality, reason = "EMPTY", f"API error: {resp['error'][:30]}"
        intent = "ERROR"
        method = "N/A"
        text = ""
    else:
        data = resp.get("data", {})
        intent = data.get("intentCode") or "NONE"
        method = data.get("matchMethod") or "N/A"
        text = data.get("formattedText") or data.get("message") or ""
        quality, reason = quality_check(cat, text, intent)

    results[quality] += 1

    # Color coding
    q_mark = {"GOOD": "✅", "WEAK": "⚠️", "BAD": "❌", "EMPTY": "💀"}[quality]

    print(f"\n{q_mark} [{cat}] \"{query}\"")
    print(f"   Intent: {intent} | Method: {method} | Quality: {quality} | {reason}")
    print(f"   Criteria: {criteria}")
    if text:
        # Show full response (truncated at 300 chars)
        display = text.replace('\n', ' | ')
        if len(display) > 300:
            display = display[:300] + "..."
        print(f"   Response ({len(text)}c): {display}")
    else:
        print(f"   Response: [EMPTY]")

    details.append({
        "cat": cat, "query": query, "intent": intent,
        "quality": quality, "reason": reason, "len": len(text),
        "response": text[:500]
    })

total = len(TESTS)
print("\n" + "=" * 140)
print(f"\n📊 Quality Summary ({total} tests):")
print(f"   ✅ GOOD: {results['GOOD']}/{total} ({100*results['GOOD']/total:.0f}%) — real data / useful advice / correct permission handling")
print(f"   ⚠️  WEAK: {results['WEAK']}/{total} ({100*results['WEAK']/total:.0f}%) — has response but quality lacking")
print(f"   ❌ BAD:  {results['BAD']}/{total} ({100*results['BAD']/total:.0f}%) — generic/useless response")
print(f"   💀 EMPTY: {results['EMPTY']}/{total} ({100*results['EMPTY']/total:.0f}%) — no response at all")

print(f"\n📊 By Category:")
for cat in ["查询", "咨询", "写入"]:
    cat_items = [d for d in details if d["cat"] == cat]
    cat_good = sum(1 for d in cat_items if d["quality"] == "GOOD")
    cat_total = len(cat_items)
    print(f"   {cat}: {cat_good}/{cat_total} GOOD ({100*cat_good/cat_total:.0f}%)")

# Save full results
with open("/tmp/response_quality_audit.json", "w") as f:
    json.dump({"summary": results, "details": details}, f, ensure_ascii=False, indent=2)
print(f"\nFull results saved to /tmp/response_quality_audit.json")
