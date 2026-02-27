#!/usr/bin/env python3
"""
全 LLM 功能测试 — 速度 + 质量
覆盖项目所有涉及 LLM 的 API 端点 (Java + Python)

测试分类:
  A. 意图执行 (Java) — 已优化, 作为基线
  B. 通用 AI 对话 (Java)
  C. 食品知识库 RAG (Python, via Java)
  D. SmartBI 分析 (Python)
  E. AI Proxy 功能 (Python)
  F. 成本分析 (Java)
  G. 对话/澄清 (Java)
  H. 公开 Demo (Java, 无认证)
  I. 报表生成 (Java)
"""
import requests
import time
import sys
import io
import json
import traceback

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_JAVA = "http://47.100.235.168:10010"
BASE_PY   = "http://47.100.235.168:8083"
FACTORY   = "F001"

# ── Auth ──

def login():
    resp = requests.post(f"{BASE_JAVA}/api/mobile/auth/unified-login",
                         json={"username": "factory_admin1", "password": "123456"})
    return resp.json()["data"]["accessToken"]

# ── Helpers ──

def timed(method, url, headers, **kwargs):
    """Execute a request and return (response, elapsed_seconds)."""
    kwargs.setdefault("timeout", 90)
    start = time.time()
    try:
        resp = getattr(requests, method)(url, headers=headers, **kwargs)
        elapsed = time.time() - start
        return resp, elapsed
    except Exception as e:
        elapsed = time.time() - start
        return None, elapsed

def extract_text(resp, max_len=200):
    """Extract displayable text from response."""
    if resp is None:
        return "[REQUEST FAILED]"
    try:
        d = resp.json()
    except Exception:
        return resp.text[:max_len]
    # Java standard format
    if "data" in d and isinstance(d["data"], dict):
        data = d["data"]
        ft = data.get("formattedText") or data.get("content") or data.get("message") or ""
        if ft:
            return str(ft)[:max_len].replace('\n', ' ')
    # Python format
    if "content" in d:
        return str(d["content"])[:max_len].replace('\n', ' ')
    if "result" in d:
        return str(d["result"])[:max_len].replace('\n', ' ')
    if "analysis" in d:
        return str(d["analysis"])[:max_len].replace('\n', ' ')
    if "data" in d:
        return str(d["data"])[:max_len].replace('\n', ' ')
    if "message" in d:
        return str(d["message"])[:max_len].replace('\n', ' ')
    return json.dumps(d, ensure_ascii=False)[:max_len]

def grade(seconds, thresholds=(3, 8)):
    """Grade response time: fast/medium/slow."""
    if seconds < thresholds[0]:
        return "✅"
    elif seconds < thresholds[1]:
        return "⚠️"
    else:
        return "❌"

def quality_check(resp):
    """Basic quality check: returns (pass/fail, reason)."""
    if resp is None:
        return "FAIL", "Request failed"
    if resp.status_code >= 400:
        return "FAIL", f"HTTP {resp.status_code}"
    try:
        d = resp.json()
    except Exception:
        return "FAIL", "Non-JSON response"
    # Check for error markers
    if d.get("success") is False:
        return "FAIL", d.get("message", "success=false")[:60]
    if d.get("error"):
        return "FAIL", str(d["error"])[:60]
    if d.get("status") == "ERROR":
        return "FAIL", d.get("message", "status=ERROR")[:60]
    # Check for meaningful content
    data = d.get("data", d)
    if isinstance(data, dict):
        ft = data.get("formattedText") or data.get("content") or data.get("analysis") or data.get("result")
        if ft and len(str(ft)) > 10:
            return "PASS", f"{len(str(ft))} chars"
        msg = data.get("message", "")
        if msg and len(str(msg)) > 5:
            return "PASS", f"msg: {len(str(msg))} chars"
    if isinstance(data, list) and len(data) > 0:
        return "PASS", f"list: {len(data)} items"
    if isinstance(data, str) and len(data) > 10:
        return "PASS", f"{len(data)} chars"
    # Fallback: if we got 200 with some data, it's a pass
    if resp.status_code == 200 and len(resp.text) > 20:
        return "PASS", f"200 OK, {len(resp.text)} bytes"
    return "WARN", "Thin response"

# ── Test Categories ──

def test_a_intent(headers):
    """A. 意图执行 (基线, 3 个代表性查询)"""
    tests = [
        ("A1 问候",   "你好"),
        ("A2 生产查询", "查看今天的生产批次"),
        ("A3 食品知识", "带鱼怎么保存"),
    ]
    results = []
    for label, text in tests:
        resp, t = timed("post", f"{BASE_JAVA}/api/mobile/{FACTORY}/ai-intents/execute",
                         headers, json={"userInput": text, "factoryId": FACTORY})
        q, reason = quality_check(resp)
        results.append(("A 意图执行", label, t, resp, q, reason))
    return results

def test_b_ai_chat(headers):
    """B. 通用 AI 对话"""
    tests = [
        ("B1 简单对话", {"messages": [{"role": "user", "content": "你好，你是谁？"}]}),
        ("B2 知识问答", {"messages": [{"role": "user", "content": "HACCP体系包含哪几个关键控制点？"}]}),
        ("B3 多轮对话", {"messages": [
            {"role": "user", "content": "食品加工厂的温度控制标准是什么？"},
            {"role": "assistant", "content": "食品加工厂的温度控制标准因食品种类而异..."},
            {"role": "user", "content": "冷冻水产品呢？具体多少度？"}
        ]}),
    ]
    results = []
    for label, body in tests:
        resp, t = timed("post", f"{BASE_JAVA}/api/mobile/ai/chat",
                         headers, json=body)
        q, reason = quality_check(resp)
        results.append(("B AI对话", label, t, resp, q, reason))
    return results

def test_c_food_kb(headers):
    """C. 食品知识库 RAG (通过 Python)"""
    tests = [
        ("C1 添加剂查询", {"query": "山梨酸钾的使用限量是多少", "top_k": 3}),
        ("C2 保存方法",   {"query": "冷冻海鲜解冻后能保存多久", "top_k": 3}),
    ]
    results = []
    for label, body in tests:
        resp, t = timed("post", f"{BASE_PY}/api/food-kb/query",
                         headers, json=body)
        q, reason = quality_check(resp)
        results.append(("C 食品知识", label, t, resp, q, reason))
    return results

def test_d_smartbi(headers):
    """D. SmartBI 分析 (Python)"""
    sample_data = [
        {"月份": "2025-01", "销售额": 150000, "成本": 95000, "利润": 55000},
        {"月份": "2025-02", "销售额": 168000, "成本": 102000, "利润": 66000},
        {"月份": "2025-03", "销售额": 142000, "成本": 88000, "利润": 54000},
        {"月份": "2025-04", "销售额": 195000, "成本": 115000, "利润": 80000},
        {"月份": "2025-05", "销售额": 178000, "成本": 108000, "利润": 70000},
        {"月份": "2025-06", "销售额": 210000, "成本": 125000, "利润": 85000},
    ]

    results = []

    # D1: Insight generation (metrics is List[dict], not List[str])
    resp, t = timed("post", f"{BASE_PY}/api/insight/generate",
                     headers, json={
                         "data": sample_data,
                         "maxInsights": 3,
                         "analysisContext": "月度销售数据分析",
                     })
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D1 洞察生成", t, resp, q, reason))

    # D2: Quick summary (no LLM, baseline)
    resp, t = timed("post", f"{BASE_PY}/api/insight/quick-summary",
                     headers, json=sample_data)
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D2 快速摘要", t, resp, q, reason))

    time.sleep(5)  # Rate limit cooldown

    # D3: Chart recommendation (router at /api/chart, not /api/smartbi/chart)
    resp, t = timed("post", f"{BASE_PY}/api/chart/smart-recommend",
                     headers={**headers}, json={
                         "data": sample_data,
                         "sheetName": "月度销售",
                         "maxRecommendations": 3,
                     })
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D3 图表推荐", t, resp, q, reason))

    time.sleep(5)  # Rate limit cooldown

    # D4: General analysis (chat)
    resp, t = timed("post", f"{BASE_PY}/api/chat/general-analysis",
                     headers, json={
                         "query": "分析这组数据的销售趋势，哪个月表现最好？",
                         "data": sample_data,
                     })
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D4 自由分析", t, resp, q, reason))

    # D5: Drill-down (needs sheet_id, which is required)
    resp, t = timed("post", f"{BASE_PY}/api/chat/drill-down",
                     headers, json={
                         "sheet_id": "test-monthly-sales",
                         "dimension": "月份",
                         "filter_value": "2025-04",
                         "data": sample_data,
                     })
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D5 下钻分析", t, resp, q, reason))

    time.sleep(5)  # Rate limit cooldown

    # D6: Cross-sheet analysis (needs real upload IDs)
    resp, t = timed("post", f"{BASE_PY}/api/smartbi/cross-sheet-analysis",
                     headers, json={
                         "upload_ids": [3892, 3893],
                         "sheet_names": ["生产进度汇总", "人效汇总"],
                         "factory_id": FACTORY,
                     })
    q, reason = quality_check(resp)
    results.append(("D SmartBI", "D6 跨表分析", t, resp, q, reason))

    return results

def test_e_ai_proxy():
    """E. AI Proxy (Python, 无需 JWT)"""
    results = []

    # E1: Intent classify
    resp, t = timed("post", f"{BASE_PY}/api/ai/intent/classify",
                     {"Content-Type": "application/json"}, json={
                         "text": "查看本月的生产批次完成情况",
                         "candidates": ["QUERY_BATCH", "QUERY_REPORT", "GREETING"],
                     })
    q, reason = quality_check(resp)
    results.append(("E AI代理", "E1 意图分类", t, resp, q, reason))

    # E2: Intent clarify
    resp, t = timed("post", f"{BASE_PY}/api/ai/intent/clarify",
                     {"Content-Type": "application/json"}, json={
                         "text": "查看数据",
                         "current_intent": "QUERY_BATCH",
                         "ambiguous_intents": ["QUERY_BATCH", "QUERY_INVENTORY", "QUERY_REPORT"],
                     })
    q, reason = quality_check(resp)
    results.append(("E AI代理", "E2 意图澄清", t, resp, q, reason))

    # E3: Rule parse
    resp, t = timed("post", f"{BASE_PY}/api/ai/rule/parse",
                     {"Content-Type": "application/json"}, json={
                         "rule_text": "当库存量低于安全库存时，自动触发采购申请",
                         "rule_type": "inventory",
                     })
    q, reason = quality_check(resp)
    results.append(("E AI代理", "E3 规则解析", t, resp, q, reason))

    # E4: Parse data operation
    resp, t = timed("post", f"{BASE_PY}/api/ai/intent/parse-data-operation",
                     {"Content-Type": "application/json"}, json={
                         "text": "把批次MB-2026-001的状态改为已完成",
                         "available_entities": ["MaterialBatch", "Product", "QualityInspection"],
                     })
    q, reason = quality_check(resp)
    results.append(("E AI代理", "E4 数据操作解析", t, resp, q, reason))

    # E5: Form schema generation
    resp, t = timed("post", f"{BASE_PY}/api/ai/form/generate-schema",
                     {"Content-Type": "application/json"}, json={
                         "description": "创建一个质检报告表单，需要包含批次号、检测项目、检测结果、检测人",
                         "entity_type": "QualityInspection",
                     })
    q, reason = quality_check(resp)
    results.append(("E AI代理", "E5 表单生成", t, resp, q, reason))

    return results

def test_f_cost_analysis(headers):
    """F. 成本分析 (Java, LLM)"""
    results = []

    # F1: Time range cost analysis
    resp, t = timed("post", f"{BASE_JAVA}/api/mobile/{FACTORY}/ai/analysis/cost/time-range",
                     headers, json={
                         "startDate": "2026-01-01",
                         "endDate": "2026-01-31",
                         "dimension": "weekly",
                         "question": "分析1月份的成本构成",
                     })
    q, reason = quality_check(resp)
    results.append(("F 成本分析", "F1 时间段成本", t, resp, q, reason))

    return results

def test_g_conversation(headers):
    """G. 对话/多轮澄清 (Java)"""
    results = []

    # G1: Start conversation
    resp, t = timed("post", f"{BASE_JAVA}/api/mobile/{FACTORY}/conversation/start",
                     headers, json={
                         "userInput": "查看数据",
                         "userId": 22,
                     })
    q, reason = quality_check(resp)
    session_id = None
    if resp and resp.status_code == 200:
        try:
            session_id = resp.json().get("data", {}).get("sessionId")
        except Exception:
            pass
    results.append(("G 多轮对话", "G1 开始对话", t, resp, q, reason))

    # G2: Continue conversation (if session started)
    if session_id:
        resp, t = timed("post", f"{BASE_JAVA}/api/mobile/{FACTORY}/conversation/{session_id}/reply",
                         headers, json={"userReply": "我想查看生产批次"})
        q, reason = quality_check(resp)
        results.append(("G 多轮对话", "G2 继续对话", t, resp, q, reason))

    return results

def test_h_public_demo():
    """H. 公开 Demo (无需认证)"""
    no_auth = {"Content-Type": "application/json"}
    results = []

    # H1: Recognize intent only
    resp, t = timed("post", f"{BASE_JAVA}/api/public/ai-demo/recognize",
                     no_auth, json={"userInput": "查看今天的生产批次"})
    q, reason = quality_check(resp)
    results.append(("H 公开Demo", "H1 意图识别", t, resp, q, reason))

    # H2: Execute intent
    resp, t = timed("post", f"{BASE_JAVA}/api/public/ai-demo/execute",
                     no_auth, json={"userInput": "你好", "sessionId": "test-001"})
    q, reason = quality_check(resp)
    results.append(("H 公开Demo", "H2 执行意图", t, resp, q, reason))

    return results

def test_i_reports(headers):
    """I. 报表生成 (Java, LLM)"""
    results = []

    # I1: Generate production report
    resp, t = timed("post", f"{BASE_JAVA}/api/mobile/{FACTORY}/ai/reports/generate",
                     headers, json={
                         "reportType": "weekly",
                         "startDate": "2026-02-17",
                         "endDate": "2026-02-23",
                     })
    q, reason = quality_check(resp)
    results.append(("I 报表生成", "I1 周报", t, resp, q, reason))

    return results

def test_j_field_mapping(headers):
    """J. 字段映射 (Python, 需要 JWT)"""
    results = []

    resp, t = timed("post", f"{BASE_PY}/api/field/map",
                     headers, json={
                         "detectedFields": [
                             {"name": "日期", "type": "datetime", "sampleValues": ["2025-01-01", "2025-02-01"]},
                             {"name": "金额", "type": "float64", "sampleValues": [15000, 23000]},
                             {"name": "品类", "type": "object", "sampleValues": ["带鱼", "黄鱼"]},
                         ],
                         "context": "水产品销售数据",
                     })
    q, reason = quality_check(resp)
    results.append(("J 字段映射", "J1 LLM字段映射", t, resp, q, reason))

    return results

# ── Main ──

def main():
    print(f"\n{'='*100}")
    print(f"  全 LLM 功能测试 — 速度 + 质量")
    print(f"  Java: {BASE_JAVA}  |  Python: {BASE_PY}  |  Factory: {FACTORY}")
    print(f"{'='*100}\n")

    # Login
    print("  登录中...")
    token = login()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"  Token: {token[:30]}...\n")

    all_results = []

    # Run each test category
    categories = [
        ("A", "意图执行 (基线)", test_a_intent, (headers,)),
        ("B", "通用 AI 对话", test_b_ai_chat, (headers,)),
        ("C", "食品知识库 RAG", test_c_food_kb, (headers,)),
        ("D", "SmartBI 分析", test_d_smartbi, (headers,)),
        ("E", "AI Proxy 功能", test_e_ai_proxy, ()),
        ("F", "成本分析", test_f_cost_analysis, (headers,)),
        ("G", "多轮对话", test_g_conversation, (headers,)),
        ("H", "公开 Demo", test_h_public_demo, ()),
        ("I", "报表生成", test_i_reports, (headers,)),
        ("J", "字段映射", test_j_field_mapping, (headers,)),
    ]

    for idx, (cat_id, cat_name, test_fn, args) in enumerate(categories):
        # DashScope rate limit ~5 RPM: add delay between LLM-heavy categories
        if idx > 0 and cat_id in ("B", "D", "E", "F", "G"):
            print(f"\n  ⏳ 等待 8s 避免 DashScope 限流...")
            time.sleep(8)

        print(f"\n{'─'*80}")
        print(f"  [{cat_id}] {cat_name}")
        print(f"{'─'*80}")

        try:
            results = test_fn(*args)
            for group, label, t, resp, q, reason in results:
                icon = grade(t)
                q_icon = "✅" if q == "PASS" else ("⚠️" if q == "WARN" else "❌")
                http = resp.status_code if resp else "ERR"
                reply = extract_text(resp, 120)

                print(f"  {icon} {t:6.2f}s | {q_icon} {q:<4} | {http:>3} | {label}")
                if reply and q != "FAIL":
                    print(f"           回复: {reply}")
                elif q == "FAIL":
                    print(f"           原因: {reason}")

                all_results.append((group, label, t, http, q, reason))
        except Exception as e:
            print(f"  ❌ 分类测试异常: {e}")
            traceback.print_exc()
            all_results.append((cat_name, f"{cat_id} ERROR", 0, "ERR", "FAIL", str(e)))

    # ── Summary ──
    print(f"\n{'='*100}")
    print(f"  汇总")
    print(f"{'='*100}")

    total = len(all_results)
    pass_count = sum(1 for *_, q, _ in all_results if q == "PASS")
    warn_count = sum(1 for *_, q, _ in all_results if q == "WARN")
    fail_count = sum(1 for *_, q, _ in all_results if q == "FAIL")
    times = [r[2] for r in all_results if r[2] > 0]

    print(f"\n  总计: {total} 个测试")
    print(f"  ✅ PASS: {pass_count}")
    print(f"  ⚠️ WARN: {warn_count}")
    print(f"  ❌ FAIL: {fail_count}")
    if times:
        print(f"\n  速度统计:")
        fast = sum(1 for t in times if t < 3)
        medium = sum(1 for t in times if 3 <= t < 8)
        slow = sum(1 for t in times if t >= 8)
        print(f"    ✅ < 3s:  {fast} 个")
        print(f"    ⚠️ 3-8s: {medium} 个")
        print(f"    ❌ > 8s:  {slow} 个")
        print(f"    平均: {sum(times)/len(times):.2f}s")
        print(f"    最快: {min(times):.2f}s")
        print(f"    最慢: {max(times):.2f}s")

    # 按分类汇总
    print(f"\n  按分类:")
    groups = {}
    for group, label, t, http, q, reason in all_results:
        groups.setdefault(group, []).append((t, q))
    for group, items in groups.items():
        valid_times = [t for t, _ in items if t > 0]
        avg_t = sum(valid_times) / len(valid_times) if valid_times else 0
        passes = sum(1 for _, q in items if q == "PASS")
        total_g = len(items)
        t_icon = grade(avg_t)
        q_icon = "✅" if passes == total_g else ("⚠️" if passes > 0 else "❌")
        print(f"    {t_icon}{q_icon} {group}: 平均 {avg_t:.2f}s | 质量 {passes}/{total_g}")

    # 失败详情
    failures = [(g, l, t, h, r) for g, l, t, h, q, r in all_results if q == "FAIL"]
    if failures:
        print(f"\n  ❌ 失败详情:")
        for group, label, t, http, reason in failures:
            print(f"    {label} | HTTP {http} | {reason}")

    # 慢查询
    slow_queries = [(g, l, t) for g, l, t, *_ in all_results if t >= 8]
    if slow_queries:
        print(f"\n  🐌 慢查询 (>8s):")
        for group, label, t in slow_queries:
            print(f"    {t:.2f}s | {label}")

if __name__ == "__main__":
    main()
