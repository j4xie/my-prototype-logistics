# -*- coding: utf-8 -*-
"""LLM Performance Test - Before/After D1-D7 comparison"""
import requests, time, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://47.100.235.168:10010"
PY = "http://47.100.235.168:8083"

r = requests.post(f"{BASE}/api/mobile/auth/unified-login",
    json={"username":"factory_admin1","password":"123456"})
token = r.json()["data"]["accessToken"]
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

results = []

def test(name, url, body, stream=False, headers=None):
    h = headers or H
    start = time.time()
    try:
        r = requests.post(url, json=body, headers=h, timeout=90, stream=stream)
        if stream:
            ttft = None
            full = ""
            for line in r.iter_lines():
                if ttft is None:
                    ttft = int((time.time() - start) * 1000)
                if line:
                    txt = line.decode('utf-8', errors='replace')
                    if txt.startswith("data:"):
                        try:
                            d = json.loads(txt[5:].strip())
                            c = d.get("content", d.get("data", d.get("text", "")))
                            if c:
                                full += str(c)
                        except:
                            full += txt[5:30]
            total = int((time.time() - start) * 1000)
            preview = full[:150].replace('\n', ' ') if full else "(empty)"
            results.append((name, r.status_code, ttft, total, preview))
        else:
            total = int((time.time() - start) * 1000)
            d = r.json()
            if isinstance(d, dict):
                dd = d.get("data", d)
                if isinstance(dd, dict):
                    ic = dd.get("intentCode", "")
                    mn = dd.get("matchMethod", "")
                    conf = dd.get("confidence", "")
                    resp = dd.get("response", dd.get("reply", dd.get("content", "")))
                    if ic:
                        preview = f"intent={ic} method={mn} conf={conf}"
                        if resp:
                            preview += f" | {str(resp)[:60]}"
                    elif resp:
                        preview = str(resp)[:150].replace('\n', ' ')
                    else:
                        for k in ["classification", "clarification", "parsed_rule", "operation"]:
                            if k in dd and dd[k]:
                                preview = str(dd[k])[:150].replace('\n', ' ')
                                break
                        else:
                            preview = str(dd)[:150].replace('\n', ' ')
                else:
                    preview = str(dd)[:150].replace('\n', ' ')
            else:
                preview = str(d)[:150]
            results.append((name, r.status_code, None, total, preview))
    except Exception as e:
        total = int((time.time() - start) * 1000)
        results.append((name, "ERR", None, total, str(e)[:80]))

print("=" * 80)
print("LLM Performance Test - AFTER D1-D7 Deployment")
print("=" * 80)

baselines = {
    "J1 xianli-chat": 462, "J2 general-consult": 768, "J3 data-query": 473,
    "J4 complex-query": 16928, "J5 navigation": 489, "J6 food-knowledge": 12727,
    "J7 write-op": 463, "J8 chat-stream": 3031, "J9 consult-stream": 12945,
    "J10 query-stream": 462, "P1 intent-classify": 1745, "P2 intent-clarify": 1252,
    "P3 rule-parse": 1681, "P4 data-op-parse": 1317,
}

# Java Intent Sync
print("\n[Java Intent Pipeline - Sync]")
tests_java = [
    ("J1 xianli-chat",    f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "你好啊", "enableThinking": False}),
    ("J2 general-consult", f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "如何提高生产效率", "enableThinking": False}),
    ("J3 data-query",     f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "今天的产量是多少", "enableThinking": False}),
    ("J4 complex-query",  f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "帮我查一下本月各产线的良品率对比", "enableThinking": False}),
    ("J5 navigation",     f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "打开生产报表页面", "enableThinking": False}),
    ("J6 food-knowledge", f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "牛肉的保质期是多少天", "enableThinking": False}),
    ("J7 write-op",       f"{BASE}/api/mobile/F001/ai-intents/execute", {"userInput": "创建一个新的生产批次", "enableThinking": False}),
]
for name, url, body in tests_java:
    print(f"  {name}...", end=" ", flush=True)
    test(name, url, body)
    r = results[-1]
    bl = baselines.get(name)
    delta = f" (was {bl}ms)" if bl else ""
    print(f"{r[3]}ms{delta}")

# Java Stream
print("\n[Java Intent Pipeline - Stream]")
tests_stream = [
    ("J8 chat-stream",    f"{BASE}/api/mobile/F001/ai-intents/execute/stream", {"userInput": "你好", "enableThinking": False}),
    ("J9 consult-stream", f"{BASE}/api/mobile/F001/ai-intents/execute/stream", {"userInput": "怎么降低生产成本", "enableThinking": False}),
    ("J10 query-stream",  f"{BASE}/api/mobile/F001/ai-intents/execute/stream", {"userInput": "查看今天的订单", "enableThinking": False}),
    ("J11 complex-stream", f"{BASE}/api/mobile/F001/ai-intents/execute/stream", {"userInput": "帮我分析本月产量趋势", "enableThinking": False}),
]
for name, url, body in tests_stream:
    print(f"  {name}...", end=" ", flush=True)
    test(name, url, body, stream=True)
    r = results[-1]
    bl = baselines.get(name)
    delta = f" (was Total={bl}ms)" if bl else ""
    print(f"TTFT={r[2]}ms Total={r[3]}ms{delta}")

# Python ai_proxy (D1)
print("\n[Python AI Proxy - D1 Model Routing]")
tests_proxy = [
    ("P1 intent-classify", f"{PY}/api/ai/intent/classify",
     {"text": "查看本月销售数据", "candidate_intents": ["SALES_QUERY", "PRODUCTION_QUERY", "REPORT_GENERATE"]}),
    ("P2 intent-clarify",  f"{PY}/api/ai/intent/clarify",
     {"text": "查一下数据", "current_intent": "SALES_QUERY", "ambiguous_intents": ["SALES_QUERY", "PRODUCTION_QUERY"]}),
    ("P3 rule-parse",      f"{PY}/api/ai/rule/parse",
     {"rule_text": "如果温度超过30度则发出预警", "rule_type": "quality_control"}),
    ("P4 data-op-parse",   f"{PY}/api/ai/intent/parse-data-operation",
     {"text": "删除编号为B001的批次记录", "available_entities": ["batch", "order", "product"]}),
]
for name, url, body in tests_proxy:
    print(f"  {name}...", end=" ", flush=True)
    test(name, url, body, headers={"Content-Type": "application/json"})
    r = results[-1]
    bl = baselines.get(name)
    delta = f" (was {bl}ms)" if bl else ""
    print(f"{r[3]}ms [{r[1]}]{delta}")

# Python Chat D4 streaming
print("\n[Python Chat - D4 New Stream Endpoints]")
tests_chat_stream = [
    ("P5 drilldown-strm", f"{PY}/api/chat/drill-down-stream",
     {"question": "详细分析销售数据变化趋势", "dimension": "time", "data_context": {"metric": "sales"}}),
    ("P6 rootcause-strm", f"{PY}/api/chat/root-cause-stream",
     {"question": "分析生产效率下降的原因", "metric": "efficiency", "current_value": 0.75, "target_value": 0.9}),
    ("P7 benchmark-strm", f"{PY}/api/chat/benchmark-stream",
     {"question": "对比行业平均水平", "metrics": ["gross_margin", "net_margin"], "industry": "food_processing"}),
    ("P8 multidim-strm",  f"{PY}/api/chat/multi-dimension-stream",
     {"question": "从多维度分析成本结构", "dimensions": ["time", "category", "department"]}),
]
for name, url, body in tests_chat_stream:
    print(f"  {name}...", end=" ", flush=True)
    test(name, url, body, stream=True)
    r = results[-1]
    print(f"TTFT={r[2]}ms Total={r[3]}ms [{r[1]}]")

# Summary
print("\n" + "=" * 80)
print(f"{'Test':<22} {'Code':>4} {'TTFT':>7} {'Total':>7} {'Before':>8} {'Change':>7}  Preview")
print("-" * 100)
for name, code, ttft, total, preview in results:
    c = "OK" if code == 200 else str(code)
    t = f"{ttft}ms" if ttft else "     -"
    bl = baselines.get(name)
    if bl:
        delta_pct = ((total - bl) / bl) * 100
        delta = f"{delta_pct:+.0f}%"
        bl_str = f"{bl}ms"
    else:
        delta = "  NEW"
        bl_str = "     -"
    print(f"{name:<22} {c:>4} {t:>7} {total:>5}ms {bl_str:>8} {delta:>7}  {preview[:40]}")

# Stats
print("\n[Performance Summary]")
improved = [(n, c, t, to, p) for n, c, t, to, p in results if c == 200 and baselines.get(n) and to < baselines[n] * 0.9]
regressed = [(n, c, t, to, p) for n, c, t, to, p in results if c == 200 and baselines.get(n) and to > baselines[n] * 1.1]
same = [(n, c, t, to, p) for n, c, t, to, p in results if c == 200 and baselines.get(n) and baselines[n] * 0.9 <= to <= baselines[n] * 1.1]
new_eps = [(n, c, t, to, p) for n, c, t, to, p in results if not baselines.get(n)]
fail = [(n, c, t, to, p) for n, c, t, to, p in results if c != 200]

print(f"  Improved (>10% faster): {len(improved)}")
for n, c, t, to, p in improved:
    bl = baselines[n]
    print(f"    {n}: {bl}ms -> {to}ms ({((to - bl) / bl) * 100:+.0f}%)")
print(f"  Same (~10%):            {len(same)}")
print(f"  Regressed (>10% slow):  {len(regressed)}")
for n, c, t, to, p in regressed:
    bl = baselines[n]
    print(f"    {n}: {bl}ms -> {to}ms ({((to - bl) / bl) * 100:+.0f}%)")
print(f"  New endpoints:          {len(new_eps)}")
for n, c, t, to, p in new_eps:
    print(f"    {n}: TTFT={t}ms Total={to}ms [{c}]")
print(f"  Failed:                 {len(fail)}")
for n, c, t, to, p in fail:
    print(f"    {n}: [{c}] {p[:60]}")
