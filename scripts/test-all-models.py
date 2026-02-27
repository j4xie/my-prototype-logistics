#!/usr/bin/env python3
"""
全模型测试脚本 — 测试所有 8 个免费额度 qwen3.5 模型
测量: 响应时间 | 返回质量 | 内容长度
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
    """发送 POST 请求"""
    body = json.dumps(data).encode('utf-8')
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            return json.loads(body)
        except:
            return {"error": f"HTTP {e.code}: {body[:200]}"}
    except urllib.error.URLError as e:
        return {"error": f"URLError: {str(e)}"}
    except Exception as e:
        return {"error": f"Exception: {str(e)}"}


def get_preview(resp):
    """从响应中提取预览文本"""
    for key in ['reply', 'answer', 'aiAnalysis', 'analysis', 'response', 'naturalResponse', 'content', 'summary']:
        val = resp.get(key) or (resp.get('data') or {}).get(key, '')
        if val and isinstance(val, str) and len(val) > 10:
            return val[:200].replace('\n', ' ')
    # 尝试列表类型
    for key in ['insights', 'recommendations', 'fields', 'structure', 'candidates']:
        val = resp.get(key) or (resp.get('data') or {}).get(key)
        if val and isinstance(val, (list, dict)):
            s = json.dumps(val, ensure_ascii=False)
            return s[:200]
    return json.dumps(resp, ensure_ascii=False)[:200]


def is_success(resp):
    """判断请求是否成功"""
    if 'error' in resp and isinstance(resp['error'], str):
        return False
    if 'detail' in resp:
        return False
    s = resp.get('success')
    if s is not None:
        return bool(s)
    return True


def speed_label(ms):
    if ms < 3000: return "⚡极快"
    if ms < 8000: return "✅正常"
    if ms < 20000: return "⚠️较慢"
    return "❌超慢"


def run_test(num, model, desc, url, data, token, check_field=None):
    """执行单个测试"""
    print(f"\n{'━'*50}")
    print(f"TEST {num}: {desc}")
    print(f"  模型: {model}")
    print(f"  端点: {url}")

    start = time.time()
    resp = http_post(url, data, token)
    elapsed_ms = int((time.time() - start) * 1000)
    elapsed_s = f"{elapsed_ms/1000:.2f}s"

    success = is_success(resp)
    content_len = len(json.dumps(resp, ensure_ascii=False))
    preview = get_preview(resp)
    speed = speed_label(elapsed_ms)

    # 检查关键字段
    has_field = True
    if check_field and success:
        parts = check_field.split('.')
        val = resp
        for p in parts:
            if isinstance(val, dict):
                val = val.get(p)
            else:
                val = None
                break
        has_field = val is not None and val != '' and val != []

    passed = success and content_len > 50
    quality = "✅PASS" if passed else "❌FAIL"

    print(f"  结果: {quality} | 耗时: {elapsed_s} ({speed}) | 响应: {content_len} 字符")
    print(f"  预览: {preview[:150]}")

    results.append({
        'num': num, 'model': model, 'desc': desc,
        'quality': quality, 'time': elapsed_s, 'time_ms': elapsed_ms,
        'size': content_len, 'speed': speed, 'passed': passed,
        'preview': preview[:200]
    })
    return resp


def main():
    print("=" * 55)
    print("  LLM 模型全面测试")
    print(f"  {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 55)

    # 获取 Token
    print("\n[准备] 获取认证 Token...")
    login_resp = http_post(f"{SERVER}/api/mobile/auth/unified-login",
                           {"username": "factory_admin1", "password": "123456"})
    token = (login_resp.get('data') or {}).get('accessToken')
    if not token:
        print(f"FATAL: 无法获取 Token: {login_resp}")
        sys.exit(1)
    print(f"[准备] Token: {token[:25]}...")

    # ============================================================
    # 1. qwen3.5-plus (Java 主模型)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 1. qwen3.5-plus (Java 主模型 — 意图分类)")
    print(f"{'#'*50}")

    run_test("1.1", "qwen3.5-plus", "通用AI对话-单轮",
             f"{SERVER}/api/mobile/ai/chat",
             {"messages": [{"role": "user", "content": "简要介绍食品安全溯源体系的三个关键环节，每个环节一句话"}]},
             token, "data.reply")

    run_test("1.2", "qwen3.5-plus", "通用AI对话-多轮",
             f"{SERVER}/api/mobile/ai/chat",
             {"messages": [
                 {"role": "user", "content": "HACCP是什么"},
                 {"role": "assistant", "content": "HACCP是危害分析关键控制点体系"},
                 {"role": "user", "content": "它有几个原则？列出来"}
             ]},
             token, "data.reply")

    # ============================================================
    # 2. qwen3.5-plus-2026-02-15 (Python 主文本)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 2. qwen3.5-plus-2026-02-15 (Python 主文本)")
    print(f"{'#'*50}")

    run_test("2.1", "qwen3.5-plus-0215", "通用数据分析",
             f"{PYTHON}/api/chat/general-analysis",
             {"query": "分析销售数据趋势和异常",
              "data": [
                  {"month": "1月", "sales": 150000, "cost": 100000, "profit": 50000},
                  {"month": "2月", "sales": 180000, "cost": 110000, "profit": 70000},
                  {"month": "3月", "sales": 160000, "cost": 115000, "profit": 45000},
                  {"month": "4月", "sales": 220000, "cost": 130000, "profit": 90000}
              ]},
             token, "answer")

    run_test("2.2", "qwen3.5-plus-0215", "根因分析",
             f"{PYTHON}/api/chat/root-cause",
             {"query": "3月利润为什么下降",
              "data": [
                  {"month": "1月", "sales": 150000, "cost": 100000, "profit": 50000},
                  {"month": "2月", "sales": 180000, "cost": 110000, "profit": 70000},
                  {"month": "3月", "sales": 160000, "cost": 115000, "profit": 45000}
              ],
              "metric": "profit", "direction": "down"},
             token, "answer")

    run_test("2.3", "qwen3.5-plus-0215", "多维度分析",
             f"{PYTHON}/api/chat/multi-dimension",
             {"query": "按月份和产品分析",
              "data": [
                  {"month": "1月", "product": "苹果", "sales": 50000},
                  {"month": "1月", "product": "香蕉", "sales": 30000},
                  {"month": "2月", "product": "苹果", "sales": 60000},
                  {"month": "2月", "product": "香蕉", "sales": 35000}
              ],
              "dimensions": ["month", "product"]},
             token, "answer")

    # ============================================================
    # 3. qwen3.5-flash-2026-02-23 (Python 洞察)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 3. qwen3.5-flash-2026-02-23 (Python 洞察生成)")
    print(f"{'#'*50}")

    run_test("3.1", "qwen3.5-flash-0223", "洞察生成-财务",
             f"{PYTHON}/api/insight/generate",
             {"data": [
                 {"month": "1月", "revenue": 500000, "cost": 350000, "gross_margin": 0.30},
                 {"month": "2月", "revenue": 550000, "cost": 370000, "gross_margin": 0.33},
                 {"month": "3月", "revenue": 480000, "cost": 360000, "gross_margin": 0.25},
                 {"month": "4月", "revenue": 620000, "cost": 400000, "gross_margin": 0.35}
             ],
              "columns": ["month", "revenue", "cost", "gross_margin"],
              "sheet_name": "季度财务"},
             token, "insights")

    run_test("3.2", "qwen3.5-flash-0223", "洞察生成-产品明细",
             f"{PYTHON}/api/insight/generate",
             {"data": [
                 {"date": "2025-01", "product": "A", "qty": 100, "price": 50},
                 {"date": "2025-02", "product": "B", "qty": 200, "price": 30},
                 {"date": "2025-03", "product": "A", "qty": 150, "price": 50},
                 {"date": "2025-04", "product": "C", "qty": 80, "price": 100},
                 {"date": "2025-05", "product": "B", "qty": 180, "price": 30},
                 {"date": "2025-06", "product": "A", "qty": 120, "price": 50}
             ],
              "columns": ["date", "product", "qty", "price"],
              "sheet_name": "产品销售明细"},
             token, "insights")

    # ============================================================
    # 4. qwen3.5-27b (Python 图表推荐)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 4. qwen3.5-27b (Python 图表推荐)")
    print(f"{'#'*50}")

    run_test("4.1", "qwen3.5-27b", "图表推荐-时序",
             f"{PYTHON}/api/smartbi/chart/recommend",
             {"columns": ["month", "revenue", "cost", "profit", "margin"],
              "sample_data": [
                  {"month": "1月", "revenue": 500000, "cost": 350000, "profit": 150000, "margin": 0.30},
                  {"month": "2月", "revenue": 550000, "cost": 370000, "profit": 180000, "margin": 0.33}
              ],
              "row_count": 12, "sheet_name": "年度财务"},
             token, "recommendations")

    run_test("4.2", "qwen3.5-27b", "图表推荐-分类",
             f"{PYTHON}/api/smartbi/chart/recommend",
             {"columns": ["region", "Q1", "Q2", "Q3", "Q4"],
              "sample_data": [
                  {"region": "华东", "Q1": 120, "Q2": 150, "Q3": 180, "Q4": 200},
                  {"region": "华南", "Q1": 100, "Q2": 130, "Q3": 160, "Q4": 190}
              ],
              "row_count": 6, "sheet_name": "区域季度对比"},
             token, "recommendations")

    # ============================================================
    # 5. qwen3.5-122b-a10b (Python 字段映射)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 5. qwen3.5-122b-a10b (Python 字段映射/清洗)")
    print(f"{'#'*50}")

    run_test("5.1", "qwen3.5-122b-a10b", "字段类型检测",
             f"{PYTHON}/api/smartbi/excel/detect-fields",
             {"columns": ["日期", "产品名称", "销售数量", "单价", "总金额", "备注"],
              "sample_values": [
                  ["2025-01-01", "红富士苹果", 100, 5.50, 550.00, "正常"],
                  ["2025-01-02", "海南香蕉", 200, 3.00, 600.00, "促销"],
                  ["2025-01-03", "新疆葡萄", 150, 8.00, 1200.00, ""]
              ]},
             token, "fields")

    run_test("5.2", "qwen3.5-122b-a10b", "结构分析",
             f"{PYTHON}/api/smartbi/excel/analyze-structure",
             {"columns": ["月份", "产品线", "销售额", "成本", "毛利率"],
              "sample_data": [
                  {"月份": "2025-01", "产品线": "饮料", "销售额": 150, "成本": 100, "毛利率": 33.3},
                  {"月份": "2025-01", "产品线": "零食", "销售额": 80, "成本": 50, "毛利率": 37.5}
              ],
              "row_count": 24, "sheet_name": "产品线月度分析"},
             token, "structure")

    # ============================================================
    # 6. qwen3.5-flash (Python 快速分类)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 6. qwen3.5-flash (Python 快速分类)")
    print(f"{'#'*50}")

    run_test("6.1", "qwen3.5-flash", "场景检测",
             f"{PYTHON}/api/smartbi/excel/detect-scenario",
             {"columns": ["日期", "产品", "数量", "金额"],
              "sample_data": [{"日期": "2025-01-01", "产品": "苹果", "数量": 100, "金额": 500}],
              "sheet_name": "销售明细", "row_count": 100},
             token, "scenario")

    run_test("6.2", "qwen3.5-flash", "意图分类(LLM)",
             f"{PYTHON}/api/ai/intent/classify",
             {"text": "查看本月产量报表", "factoryId": "F001"},
             token, "intent")

    # ============================================================
    # 7. qwen3.5-397b-a17b (Python 深度推理)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 7. qwen3.5-397b-a17b (Python 深度推理)")
    print(f"{'#'*50}")

    run_test("7.1", "qwen3.5-397b-a17b", "基准对比分析",
             f"{PYTHON}/api/chat/benchmark",
             {"query": "与行业标准对比",
              "data": [
                  {"metric": "毛利率", "value": 0.28},
                  {"metric": "净利率", "value": 0.05},
                  {"metric": "库存周转天数", "value": 45},
                  {"metric": "应收账款周转天数", "value": 60}
              ],
              "industry": "食品加工"},
             token, "answer")

    # ============================================================
    # 8. qwen3.5-35b-a3b (Java 纠错 + ArenaRL)
    # ============================================================
    print(f"\n\n{'#'*50}")
    print("# 8. qwen3.5-35b-a3b (Java 纠错/ArenaRL)")
    print(f"{'#'*50}")

    run_test("8.1", "qwen3.5-35b-a3b", "意图执行-生产查询",
             f"{SERVER}/api/mobile/F001/ai-intents/execute",
             {"query": "查看今天的生产报工数据"},
             token, "data")

    run_test("8.2", "qwen3.5-35b-a3b", "意图执行-质量查询",
             f"{SERVER}/api/mobile/F001/ai-intents/execute",
             {"query": "最近质量检查情况怎么样"},
             token, "data")

    # ============================================================
    # 汇总
    # ============================================================
    print(f"\n\n{'='*70}")
    print(f"  测试完成汇总 — {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    passed = sum(1 for r in results if r['passed'])
    failed = len(results) - passed
    print(f"\n  ✅ 通过: {passed} / {len(results)}")
    print(f"  ❌ 失败: {failed} / {len(results)}")

    # 按模型分组统计
    print(f"\n{'─'*70}")
    print(f"  模型性能汇总")
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
        avg = sum(s['times']) / len(s['times'])
        status = "✅" if s['passed'] == s['total'] else "⚠️" if s['passed'] > 0 else "❌"
        print(f"  {status} {m:28s} | {s['passed']}/{s['total']} pass | 平均 {avg/1000:.1f}s")

    # 详细表格
    print(f"\n{'━'*90}")
    print(f"{'编号':5s} | {'模型':28s} | {'测试项':20s} | {'结果':6s} | {'耗时':8s} | {'大小':8s} | {'速度':8s}")
    print(f"{'━'*90}")
    for r in results:
        print(f"{r['num']:5s} | {r['model']:28s} | {r['desc']:20s} | {r['quality']:6s} | {r['time']:8s} | {r['size']:6d}B | {r['speed']:8s}")
    print(f"{'━'*90}")

    # 失败详情
    if failed > 0:
        print(f"\n{'─'*70}")
        print(f"  失败详情")
        print(f"{'─'*70}")
        for r in results:
            if not r['passed']:
                print(f"  {r['num']} {r['desc']}: {r['preview'][:120]}")


if __name__ == '__main__':
    main()
