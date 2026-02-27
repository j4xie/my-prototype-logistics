#!/usr/bin/env python3
"""Compare DashScope API speed: model x prompt size matrix"""
import httpx, time, os, sys

api_key = os.environ.get("DASHSCOPE_API_KEY", "")
if not api_key:
    # Try reading from .env file
    env_path = os.path.join(os.path.dirname(__file__), "..", "backend", "python", ".env")
    if not os.path.exists(env_path):
        env_path = ".env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DASHSCOPE_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not api_key:
    print("ERROR: DASHSCOPE_API_KEY not found")
    sys.exit(1)

print("API Key: %s...%s" % (api_key[:8], api_key[-4:]))

url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
headers = {"Authorization": "Bearer %s" % api_key, "Content-Type": "application/json"}

def call_llm(model, system_prompt, user_prompt, max_tokens=200):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
        "enable_thinking": False
    }
    t0 = time.time()
    r = httpx.post(url, headers=headers, json=payload, timeout=60)
    t1 = time.time()
    d = r.json()
    u = d.get("usage", {})
    elapsed = (t1 - t0) * 1000
    prompt_tokens = u.get("prompt_tokens", 0)
    output_tokens = u.get("completion_tokens", 0)
    return elapsed, prompt_tokens, output_tokens

# Small prompt (~30 tokens)
small_sys = "You are an intent classifier. Return JSON: {intent, confidence, reasoning}"
small_usr = "Today production output?\nCandidates: QUERY_PRODUCTION, QUERY_QUALITY, NAVIGATE"

# Big prompt (~4000 tokens, simulating Java buildIntentClassifyPrompt)
lines = []
lines.append("You are intent classifier. Use 4-step Chain-of-Thought analysis.")
lines.append("\n## Steps\nStep 1: Entity recognition\nStep 2: Intent analysis\nStep 3: Candidate matching\nStep 4: Confidence scoring\n")
lines.append("\n## Expression mapping")
for i in range(50):
    lines.append("- Expression %d maps to INTENT_CODE_%d" % (i, i))
lines.append("\n## Candidate intents")
for i in range(90):
    lines.append("- INTENT_%03d: Intent name %d - detailed description with keywords and usage" % (i, i))
lines.append("\n## Output format\nReturn JSON: {intent_code, confidence, reasoning, entities, action_type, domain}")
lines.append("\n## Rules\n1. Must select from candidates\n2. confidence 0-1\n3. reasoning must reflect 4 steps")
big_sys = "\n".join(lines)
big_usr = "Today production output?"

print("\n=== DashScope Speed Matrix ===\n")
print("%-20s %8s %8s %8s" % ("Test", "Time", "In-Tok", "Out-Tok"))
print("-" * 50)

# Test A: Flash + small
ms, pt, ot = call_llm("qwen3.5-flash", small_sys, small_usr)
print("%-20s %7.0fms %7d %7d" % ("Flash + small", ms, pt, ot))

# Test B: Flash + big
ms, pt, ot = call_llm("qwen3.5-flash", big_sys, big_usr, 500)
print("%-20s %7.0fms %7d %7d" % ("Flash + BIG", ms, pt, ot))

# Test C: Plus + small
ms, pt, ot = call_llm("qwen3.5-plus", small_sys, small_usr)
print("%-20s %7.0fms %7d %7d" % ("Plus + small", ms, pt, ot))

# Test D: Plus + big
ms, pt, ot = call_llm("qwen3.5-plus", big_sys, big_usr, 500)
print("%-20s %7.0fms %7d %7d" % ("Plus + BIG", ms, pt, ot))

print("\n=== Summary ===")
print("Python production path: flash + ~200 token prompt")
print("Java direct path (if enabled): plus + ~4500 token prompt")
print("Difference is MODEL + PROMPT SIZE, not Java vs Python HTTP client")
