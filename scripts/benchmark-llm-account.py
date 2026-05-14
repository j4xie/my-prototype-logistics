#!/usr/bin/env python3
"""Benchmark candidate SKUs on an Aliyun bailian account, per SLOT.

For each SLOT, tries N candidate SKUs from Steve's May-14 allowlist with a
representative prompt drawn from real project usage. Records HTTP status,
latency (3 runs, median), output token count, and a short content preview
so a human can rank quality.

Usage:
    LLM_ALIYUN_C_API_KEY=sk-xxx python scripts/benchmark-llm-account.py [aliyun_c]

Output: stdout markdown table per SLOT.
"""
import os
import sys
import time
import json
import statistics
import httpx

account = sys.argv[1] if len(sys.argv) > 1 else "aliyun_c"
env_var = f"LLM_{account.upper()}_API_KEY"
api_key = os.environ.get(env_var, "")
if not api_key:
    print(f"ERROR: {env_var} not set")
    sys.exit(2)

BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
HEADERS = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

# Representative prompt + candidate SKUs per SLOT (allowlist intersect).
SLOT_TESTS = {
    "CHAT": {
        "system": "你是白垩纪食品溯源系统的助手,用专业但简洁的口吻回答用户的中文问题。",
        "user":   "F001 工厂今天的原料批次入库情况怎么样? 请用 2-3 句话总结。",
        "skus": [
            "deepseek-v4-flash",
            "qwen-flash",
            "qwen3.6-flash",
            "qwen3.5-flash",
            "qwen-plus",
            "qwen3-max-2026-01-23",
        ],
        "max_tokens": 200,
    },
    "INSIGHTS": {
        "system": "你是数据洞察生成器。输入是图表数据,输出 1-2 句简短洞察(不超过 50 字)。",
        "user":   "数据: 5 月销售环比 +15%, 客单价 -3%, 复购率 +8%。给出关键洞察。",
        "skus": [
            "deepseek-v4-flash",
            "qwen-flash",
            "qwen3.6-flash",
            "qwen3.5-flash-2026-02-23",
            "qwen3.5-flash",
        ],
        "max_tokens": 150,
    },
    "CHART": {
        "system": "你是图表推荐器。根据数据返回 JSON: {chartType, xAxis, yAxis, title}。chartType 必须是 BAR/LINE/PIE 之一。只返回 JSON,不要 markdown。",
        "user":   "数据维度: 日期(string), 销售额(number), 区域(string)。10 行,日期跨 5 个区域。推荐一个图表。",
        "skus": [
            "glm-5",
            "glm-4.5-air",
            "deepseek-v4-flash",
            "qwen3.5-122b-a10b",
            "qwen-turbo",
        ],
        "max_tokens": 150,
    },
    "MAPPER": {
        "system": "你是 Excel 字段映射器。输入是 Excel 表头列表,输出 JSON 映射到标准字段 (date/amount/category/customer/quantity)。只返回 JSON。",
        "user":   "Excel 列: ['交易日期', '产品类别', '销售金额(元)', '客户名称', '订购数量']。映射到标准字段。",
        "skus": [
            "qwen-turbo",
            "qwen-flash",
            "qwen3.5-122b-a10b",
            "deepseek-v4-flash",
            "qwen3.6-flash",
        ],
        "max_tokens": 200,
    },
    "REASONING": {
        "system": "你是供应链分析师。给定一个场景,做 3 步推理: 1) 识别问题, 2) 列出可能原因, 3) 给出最优解决方案。",
        "user":   "场景: F001 工厂 3 月毛利率从 22% 跌到 18%,但销售额没变,采购总额上升 7%,人力成本不变。分析。",
        "skus": [
            "deepseek-v4-pro",
            "deepseek-r1",
            "qwen3.5-397b-a17b",
            "qwen3-max-2026-01-23",
            "deepseek-v3.2-exp",
        ],
        "max_tokens": 500,
    },
    "REVIEW": {
        "system": "你是文档审核者。读一段文字,指出 1) 事实错误, 2) 表达不清, 3) 改进建议。简洁列出。",
        "user":   "请审核: '本公司销售业绩飞速增长 200%,远超行业平均 5% 水平,毛利达 80%,是同行 4 倍,具有绝对竞争优势。预计明年再翻倍。'",
        "skus": [
            "deepseek-v4-pro",
            "deepseek-r1-distill-qwen-32b",
            "qwen3.5-397b-a17b",
            "deepseek-v3.2",
            "qwen3-max-2026-01-23",
        ],
        "max_tokens": 350,
    },
}

RUNS_PER_SKU = 3  # median of N latency runs


def call_one(model: str, system: str, user: str, max_tokens: int):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }
    t0 = time.time()
    try:
        r = httpx.post(f"{BASE_URL}/chat/completions", headers=HEADERS, json=payload, timeout=60.0)
        elapsed_ms = int((time.time() - t0) * 1000)
        if r.status_code != 200:
            return {
                "status": r.status_code,
                "elapsed_ms": elapsed_ms,
                "out_tokens": 0,
                "preview": r.text[:120].replace("\n", " "),
                "ok": False,
            }
        d = r.json()
        usage = d.get("usage", {})
        content = (d.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        return {
            "status": 200,
            "elapsed_ms": elapsed_ms,
            "out_tokens": usage.get("completion_tokens", 0),
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "preview": content.replace("\n", " ").replace("|", "\\|")[:140],
            "full": content,
            "ok": True,
        }
    except Exception as e:
        elapsed_ms = int((time.time() - t0) * 1000)
        return {
            "status": -1,
            "elapsed_ms": elapsed_ms,
            "out_tokens": 0,
            "preview": f"{type(e).__name__}: {e}",
            "ok": False,
        }


def bench_slot(slot: str, spec: dict):
    print(f"\n## SLOT: {slot}")
    print(f"**Prompt** (user): {spec['user']}\n")
    print("| SKU | latency med (ms) | latency min/max | out tokens | preview |")
    print("|---|---|---|---|---|")
    full_outputs = {}
    for sku in spec["skus"]:
        latencies = []
        last_ok = None
        out_tokens = 0
        preview = "—"
        for _ in range(RUNS_PER_SKU):
            res = call_one(sku, spec["system"], spec["user"], spec["max_tokens"])
            latencies.append(res["elapsed_ms"])
            if res["ok"]:
                last_ok = res
                out_tokens = res["out_tokens"]
                preview = res["preview"]
            time.sleep(0.3)
        med = int(statistics.median(latencies))
        lo, hi = min(latencies), max(latencies)
        status_mark = "" if last_ok else "❌"
        if not last_ok:
            preview = f"{status_mark} (status={call_one(sku, spec['system'], spec['user'], spec['max_tokens'])['status']})"
        print(f"| `{sku}` | {med} | {lo}/{hi} | {out_tokens} | {preview} |")
        if last_ok:
            full_outputs[sku] = last_ok.get("full", "")
    # Full outputs for human quality review (printed separately so the table stays readable)
    print()
    for sku, out in full_outputs.items():
        print(f"\n<details><summary>{slot} / {sku} full output</summary>\n\n```\n{out}\n```\n</details>")


print(f"# LLM benchmark — account={account} key=sk-...{api_key[-4:]}")
print(f"Runs per SKU: {RUNS_PER_SKU} (median latency reported)")
print(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")

for slot, spec in SLOT_TESTS.items():
    bench_slot(slot, spec)

print("\n# Done")
