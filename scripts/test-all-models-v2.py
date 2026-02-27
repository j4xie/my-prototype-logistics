#!/usr/bin/env python3
"""
全模型测试脚本 v2 — 正确的端点和请求格式
测试所有 8 个免费额度 qwen3.5 模型
"""
import json
import time
import sys
import urllib.request
import urllib.error

SERVER = "http://localhost:10010"
PYTHON = "http://localhost:8083"

results = []


def http_post(url, data, token=None, timeout=90):
    body = json.dumps(data).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')
        try:
            return json.loads(body_text)
        except:
            return {"error": f"HTTP {e.code}: {body_text[:300]}"}
    except Exception as e:
        return {"error": str(e)}


def get_preview(resp):
    for key in ['reply', 'answer', 'aiAnalysis', 'analysis', 'response',
                'naturalResponse', 'content', 'summary', 'text']:
        val = resp.get(key) or (resp.get('data') or {}).get(key, '')
        if val and isinstance(val, str) and len(val) > 10:
            return val[:200].replace('\n', ' ')
    for key in ['insights', 'recommendations', 'fields', 'structure',
                'candidates', 'data', 'charts']:
        val = resp.get(key) or (resp.get('data') or {}).get(key)
        if val and isinstance(val, (list, dict)):
            return json.dumps(val, ensure_ascii=False)[:200]
    return json.dumps(resp, ensure_ascii=False)[:200]


def is_success(resp):
    if 'error' in resp and isinstance(resp['error'], str):
        return False
    if 'detail' in resp:
        return False
    s = resp.get('success')
    if s is not None:
        return bool(s)
    return len(json.dumps(resp)) > 50


def speed_label(ms):
    if ms < 3000: return "⚡极快"
    if ms < 8000: return "✅正常"
    if ms < 20000: return "⚠️较慢"
    return "❌超慢"


def run_test(num, model, desc, url, data, token, check_field=None):
    print(f"\n{'━'*55}")
    print(f"TEST {num}: {desc}")
    print(f"  模型: {model}")
    print(f"  端点: {url}")

    start = time.time()
    resp = http_post(url, data, token)
    elapsed_ms = int((time.time() - start) * 1000)
    elapsed_s = f"{elapsed_ms/1000:.1f}s"

    success = is_success(resp)
    content = json.dumps(resp, ensure_ascii=False)
    content_len = len(content)
    preview = get_preview(resp)
    speed = speed_label(elapsed_ms)

    passed = success and content_len > 50
    quality = "✅PASS" if passed else "❌FAIL"

    print(f"  结果: {quality} | 耗时: {elapsed_s} ({speed}) | 响应: {content_len} 字符")
    print(f"  预览: {preview[:150]}")

    results.append({
        'num': num, 'model': model, 'desc': desc,
        'quality': quality, 'time_s': elapsed_s, 'time_ms': elapsed_ms,
        'size': content_len, 'speed': speed, 'passed': passed,
        'preview': preview[:200]
    })
    return resp


def main():
    print("=" * 60)
    print("  LLM 全模型测试 v2 (修正端点)")
    print(f"  {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Login
    print("\n[准备] 获取 Token...")
    login = http_post(f"{SERVER}/api/mobile/auth/unified-login",
                      {"username": "factory_admin1", "password": "123456"})
    token = (login.get('data') or {}).get('accessToken')
    if not token:
        print(f"FATAL: {login}")
        sys.exit(1)
    print(f"[OK] Token: {token[:25]}...")

    # ============================================================
    # 1. qwen3.5-plus (Java 主模型)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 1. qwen3.5-plus (Java 主模型)")
    print(f"{'#'*55}")

    run_test("1.1", "qwen3.5-plus", "AI对话-单轮",
        f"{SERVER}/api/mobile/ai/chat",
        {"messages": [{"role": "user", "content": "食品溯源的三个关键环节，每个一句话"}]},
        token)

    run_test("1.2", "qwen3.5-plus", "AI对话-多轮",
        f"{SERVER}/api/mobile/ai/chat",
        {"messages": [
            {"role": "user", "content": "HACCP有几个原则"},
            {"role": "assistant", "content": "HACCP有7个原则"},
            {"role": "user", "content": "请列出这7个原则"}
        ]},
        token)

    # ============================================================
    # 2. qwen3.5-plus-2026-02-15 (Python 主文本)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 2. qwen3.5-plus-2026-02-15 (Python 主文本)")
    print(f"{'#'*55}")

    run_test("2.1", "qwen3.5-plus-0215", "通用数据分析",
        f"{PYTHON}/api/chat/general-analysis",
        {"query": "分析销售数据趋势",
         "data": [
             {"month": "1月", "sales": 150000, "cost": 100000, "profit": 50000},
             {"month": "2月", "sales": 180000, "cost": 110000, "profit": 70000},
             {"month": "3月", "sales": 160000, "cost": 115000, "profit": 45000},
             {"month": "4月", "sales": 220000, "cost": 130000, "profit": 90000}
         ]},
        token)

    run_test("2.2", "qwen3.5-plus-0215", "根因分析",
        f"{PYTHON}/api/chat/root-cause",
        {"sheet_id": "test-sheet-001",
         "kpi": "profit",
         "threshold": 0.1,
         "data": [
             {"month": "1月", "sales": 150000, "cost": 100000, "profit": 50000},
             {"month": "2月", "sales": 180000, "cost": 110000, "profit": 70000},
             {"month": "3月", "sales": 160000, "cost": 115000, "profit": 45000}
         ]},
        token)

    run_test("2.3", "qwen3.5-plus-0215", "多维度分析",
        f"{PYTHON}/api/chat/multi-dimension",
        {"sheet_id": "test-sheet-001",
         "data": [
             {"month": "1月", "product": "苹果", "sales": 50000},
             {"month": "1月", "product": "香蕉", "sales": 30000},
             {"month": "2月", "product": "苹果", "sales": 60000},
             {"month": "2月", "product": "香蕉", "sales": 35000}
         ],
         "dimensions": ["month", "product"]},
        token)

    # ============================================================
    # 3. qwen3.5-flash-2026-02-23 (Python 洞察)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 3. qwen3.5-flash-2026-02-23 (Python 洞察)")
    print(f"{'#'*55}")

    run_test("3.1", "qwen3.5-flash-0223", "洞察-财务",
        f"{PYTHON}/api/insight/generate",
        {"data": [
            {"month": "1月", "revenue": 500000, "cost": 350000, "gross_margin": 0.30},
            {"month": "2月", "revenue": 550000, "cost": 370000, "gross_margin": 0.33},
            {"month": "3月", "revenue": 480000, "cost": 360000, "gross_margin": 0.25},
            {"month": "4月", "revenue": 620000, "cost": 400000, "gross_margin": 0.35}
        ],
         "columns": ["month", "revenue", "cost", "gross_margin"],
         "sheet_name": "季度财务"},
        token)

    run_test("3.2", "qwen3.5-flash-0223", "洞察-产品",
        f"{PYTHON}/api/insight/generate",
        {"data": [
            {"date": "2025-01", "product": "A", "qty": 100, "price": 50},
            {"date": "2025-02", "product": "B", "qty": 200, "price": 30},
            {"date": "2025-03", "product": "A", "qty": 150, "price": 50},
            {"date": "2025-04", "product": "C", "qty": 80, "price": 100}
        ],
         "columns": ["date", "product", "qty", "price"],
         "sheet_name": "产品销售"},
        token)

    # ============================================================
    # 4. qwen3.5-27b (Python 图表推荐) — 正确路径: /api/chart/recommend
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 4. qwen3.5-27b (Python 图表推荐)")
    print(f"{'#'*55}")

    run_test("4.1", "qwen3.5-27b", "图表推荐-时序",
        f"{PYTHON}/api/chart/recommend",
        {"data": [
            {"month": "1月", "revenue": 500000, "cost": 350000, "profit": 150000},
            {"month": "2月", "revenue": 550000, "cost": 370000, "profit": 180000},
            {"month": "3月", "revenue": 480000, "cost": 360000, "profit": 120000}
        ],
         "fields": [
             {"name": "month", "type": "string", "role": "dimension"},
             {"name": "revenue", "type": "number", "role": "measure"},
             {"name": "cost", "type": "number", "role": "measure"},
             {"name": "profit", "type": "number", "role": "measure"}
         ]},
        token)

    run_test("4.2", "qwen3.5-27b", "图表推荐-分类",
        f"{PYTHON}/api/chart/recommend",
        {"data": [
            {"region": "华东", "Q1": 120, "Q2": 150, "Q3": 180, "Q4": 200},
            {"region": "华南", "Q1": 100, "Q2": 130, "Q3": 160, "Q4": 190}
        ],
         "fields": [
             {"name": "region", "type": "string", "role": "dimension"},
             {"name": "Q1", "type": "number", "role": "measure"},
             {"name": "Q2", "type": "number", "role": "measure"},
             {"name": "Q3", "type": "number", "role": "measure"},
             {"name": "Q4", "type": "number", "role": "measure"}
         ]},
        token)

    # ============================================================
    # 5. qwen3.5-122b-a10b (字段映射) — 正确路径: /api/field/detect
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 5. qwen3.5-122b-a10b (Python 字段映射)")
    print(f"{'#'*55}")

    run_test("5.1", "qwen3.5-122b-a10b", "字段检测",
        f"{PYTHON}/api/field/detect",
        {"headers": ["日期", "产品名称", "销售数量", "单价", "总金额", "备注"],
         "rows": [
             ["2025-01-01", "红富士苹果", 100, 5.50, 550.00, "正常"],
             ["2025-01-02", "海南香蕉", 200, 3.00, 600.00, "促销"],
             ["2025-01-03", "新疆葡萄", 150, 8.00, 1200.00, ""]
         ]},
        token)

    run_test("5.2", "qwen3.5-122b-a10b", "结构分析",
        f"{PYTHON}/api/excel/analyze-structure",
        {"columns": ["月份", "产品线", "销售额", "成本", "毛利率"],
         "sample_data": [
             {"月份": "2025-01", "产品线": "饮料", "销售额": 150, "成本": 100, "毛利率": 33.3},
             {"月份": "2025-01", "产品线": "零食", "销售额": 80, "成本": 50, "毛利率": 37.5}
         ],
         "row_count": 24, "sheet_name": "产品线"},
        token)

    # ============================================================
    # 6. qwen3.5-flash (快速分类)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 6. qwen3.5-flash (Python 快速分类)")
    print(f"{'#'*55}")

    run_test("6.1", "qwen3.5-flash", "意图分类(LLM)",
        f"{PYTHON}/api/ai/intent/classify",
        {"text": "查看本月产量报表", "factoryId": "F001"},
        token)

    run_test("6.2", "qwen3.5-flash", "意图分类-模糊",
        f"{PYTHON}/api/ai/intent/classify",
        {"text": "有什么好吃的推荐", "factoryId": "F001"},
        token)

    # ============================================================
    # 7. qwen3.5-397b-a17b (深度推理)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 7. qwen3.5-397b-a17b (Python 深度推理)")
    print(f"{'#'*55}")

    run_test("7.1", "qwen3.5-397b-a17b", "基准对比",
        f"{PYTHON}/api/chat/benchmark",
        {"sheet_id": "test-sheet-001",
         "industry": "食品加工",
         "metrics": {"毛利率": 0.28, "净利率": 0.05, "库存周转天数": 45}},
        token)

    # ============================================================
    # 8. qwen3.5-35b-a3b (Java 纠错)
    # ============================================================
    print(f"\n\n{'#'*55}")
    print("# 8. qwen3.5-35b-a3b (Java 纠错/ArenaRL)")
    print(f"{'#'*55}")

    run_test("8.1", "qwen3.5-35b-a3b", "意图执行-生产",
        f"{SERVER}/api/mobile/F001/ai-intents/execute",
        {"query": "今天生产了多少产品"},
        token)

    run_test("8.2", "qwen3.5-35b-a3b", "意图执行-仓储",
        f"{SERVER}/api/mobile/F001/ai-intents/execute",
        {"query": "当前库存有多少"},
        token)

    # ============================================================
    # 汇总
    # ============================================================
    print(f"\n\n{'='*70}")
    print(f"  测试完成 — {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    passed = sum(1 for r in results if r['passed'])
    failed = len(results) - passed
    print(f"\n  ✅ 通过: {passed} / {len(results)}")
    print(f"  ❌ 失败: {failed} / {len(results)}")

    # 模型汇总
    print(f"\n{'─'*70}")
    print(f"  按模型汇总")
    print(f"{'─'*70}")
    model_stats = {}
    for r in results:
        m = r['model']
        if m not in model_stats:
            model_stats[m] = {'times': [], 'passed': 0, 'total': 0}
        model_stats[m]['times'].append(r['time_ms'])
        model_stats[m]['total'] += 1
        if r['passed']:
            model_stats[m]['passed'] += 1

    for m, s in model_stats.items():
        avg = sum(s['times']) / len(s['times']) if s['times'] else 0
        icon = "✅" if s['passed'] == s['total'] else "⚠️" if s['passed'] > 0 else "❌"
        print(f"  {icon} {m:28s} | {s['passed']}/{s['total']} pass | 平均 {avg/1000:.1f}s")

    # 详细表格
    print(f"\n{'━'*95}")
    header = f"{'编号':5s} | {'模型':28s} | {'测试项':18s} | {'结果':8s} | {'耗时':8s} | {'大小':8s} | {'速度'}"
    print(header)
    print(f"{'━'*95}")
    for r in results:
        print(f"{r['num']:5s} | {r['model']:28s} | {r['desc']:18s} | {r['quality']:8s} | {r['time_s']:8s} | {r['size']:6d}B | {r['speed']}")
    print(f"{'━'*95}")

    # 失败详情
    fails = [r for r in results if not r['passed']]
    if fails:
        print(f"\n  失败详情:")
        for r in fails:
            print(f"  {r['num']} {r['desc']}: {r['preview'][:120]}")

    # 质量评估
    print(f"\n{'─'*70}")
    print(f"  返回质量评估")
    print(f"{'─'*70}")
    for r in results:
        if r['passed']:
            p = r['preview']
            has_chinese = any('\u4e00' <= c <= '\u9fff' for c in p)
            has_numbers = any(c.isdigit() for c in p)
            quality = "优秀" if has_chinese and has_numbers and r['size'] > 200 else "良好" if r['size'] > 100 else "一般"
            print(f"  {r['num']} {r['desc']:18s} | 质量: {quality} | {r['size']}B | {p[:80]}")


if __name__ == '__main__':
    main()
