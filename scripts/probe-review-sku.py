#!/usr/bin/env python3
"""Quick probe to check if a SKU emits empty output on the REVIEW-style prompt.

Reproduces the empty-output bug seen on aliyun_c benchmark for
deepseek-r1-distill-qwen-32b. Used to confirm whether this is account-specific
(aliyun_c only) or universal (any account).

Usage:
    LLM_ALIYUN_B_API_KEY=sk-xxx python scripts/probe-review-sku.py aliyun_b deepseek-r1-distill-qwen-32b
    LLM_ALIYUN_B_API_KEY=sk-xxx python scripts/probe-review-sku.py aliyun_b qwen-max qwen3.5-397b-a17b deepseek-r1
"""
import os
import sys
import time
import httpx

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(2)

account = sys.argv[1]
skus = sys.argv[2:]

env_var = f"LLM_{account.upper()}_API_KEY"
api_key = os.environ.get(env_var, "")
if not api_key:
    print(f"ERROR: {env_var} not set")
    sys.exit(2)

BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
HEADERS = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

SYSTEM = "你是文档审核者。读一段文字,指出 1) 事实错误, 2) 表达不清, 3) 改进建议。简洁列出。"
USER = "请审核: '本公司销售业绩飞速增长 200%,远超行业平均 5% 水平,毛利达 80%,是同行 4 倍,具有绝对竞争优势。预计明年再翻倍。'"

print(f"Account: {account}  key=sk-...{api_key[-4:]}")
print(f"Prompt: REVIEW-style (Chinese, 3-section critique)\n")
print("| SKU | latency ms | out_tokens | empty? | preview |")
print("|---|---|---|---|---|")

for sku in skus:
    payload = {
        "model": sku,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user",   "content": USER},
        ],
        "temperature": 0.3,
        "max_tokens": 400,
    }
    t0 = time.time()
    try:
        r = httpx.post(f"{BASE_URL}/chat/completions", headers=HEADERS, json=payload, timeout=60.0)
        elapsed_ms = int((time.time() - t0) * 1000)
        if r.status_code != 200:
            print(f"| `{sku}` | {elapsed_ms} | — | HTTP {r.status_code} | {r.text[:80]} |")
            continue
        d = r.json()
        usage = d.get("usage", {})
        out_tok = usage.get("completion_tokens", 0)
        content = (d.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        empty = "YES ⚠️" if not content else "no"
        preview = content.replace("\n", " ").replace("|", "\\|")[:80] if content else "(empty)"
        print(f"| `{sku}` | {elapsed_ms} | {out_tok} | {empty} | {preview} |")
    except Exception as e:
        elapsed_ms = int((time.time() - t0) * 1000)
        print(f"| `{sku}` | {elapsed_ms} | — | EXC | {type(e).__name__}: {e} |")
