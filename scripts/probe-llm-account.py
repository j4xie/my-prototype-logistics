#!/usr/bin/env python3
"""Probe a DashScope (Aliyun bailian) account for free-quota availability per SLOT_MODELS SKU list.

Usage:
    LLM_ALIYUN_C_API_KEY=sk-xxx python scripts/probe-llm-account.py [aliyun_c|aliyun_a|aliyun_b]

Prints one line per (SLOT, SKU): HTTP status + first 100 chars of body on non-200.
Exits 0 if all 200, 1 if any non-200.
"""
import os
import sys
import json
import time
import httpx

SKUS_TO_PROBE = {
    # "deepseek-v4 batch" — Steve identified the v4 family as the benchmark winners
    "deepseek-v4-flash":  "deepseek-v4-flash",       # CHAT/INSIGHTS/CHART/MAPPER candidate
    "deepseek-v4-pro":    "deepseek-v4-pro",         # REASONING/REVIEW candidate
    "deepseek-v3.2":      "deepseek-v3.2",
    "deepseek-v3.2-exp":  "deepseek-v3.2-exp",
    "qwen3-vl-plus":      "qwen3-vl-plus-2025-12-19",  # VL — DeepSeek has no VL model
}

account = sys.argv[1] if len(sys.argv) > 1 else "aliyun_c"
env_var = f"LLM_{account.upper()}_API_KEY"
api_key = os.environ.get(env_var, "")
if not api_key:
    print(f"ERROR: {env_var} not set in environment")
    sys.exit(2)

base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
print(f"Probing account={account} key=sk-...{api_key[-4:]} against {len(SKUS_TO_PROBE)} SKUs")
print("=" * 80)

all_ok = True
for slot, sku in SKUS_TO_PROBE.items():
    # VL models need image_url payload; for probe, do plain text (will 400 not 403 — distinguishes quota vs schema)
    if sku.startswith("qwen3-vl-plus") or sku.startswith("qwen-vl"):
        messages = [{"role": "user", "content": "hi"}]
    else:
        messages = [{"role": "user", "content": "hi"}]
    payload = {
        "model": sku,
        "messages": messages,
        "max_tokens": 5,
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    t0 = time.time()
    try:
        r = httpx.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=25.0)
        elapsed_ms = int((time.time() - t0) * 1000)
        status = r.status_code
        body = r.text[:160].replace("\n", " ")
        if 200 <= status < 300:
            mark = "OK   "
        elif status == 403 and ("FreeTierOnly" in body or "AllocationQuota" in body):
            mark = "QUOTA"
            all_ok = False
        elif status == 404 or "model not found" in body.lower() or "not supported" in body.lower():
            mark = "NOSKU"
            all_ok = False
        else:
            mark = "ERR  "
            all_ok = False
        print(f"[{mark}] {slot:22s} {sku:36s} {status} {elapsed_ms}ms")
        if status >= 400:
            print(f"        body: {body}")
    except Exception as e:
        print(f"[EXC  ] {slot:22s} {sku:36s} {type(e).__name__}: {e}")
        all_ok = False

print("=" * 80)
print("All SKUs OK" if all_ok else "Some SKUs failed — see lines above")
sys.exit(0 if all_ok else 1)
