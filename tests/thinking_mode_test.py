"""
Thinking Mode Optimization Test
Tests simple vs complex queries on the test environment (port 10011)
"""
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://47.100.235.168:10011"

def api_post(path, data, token=None, timeout=60):
    """Make a POST request and return (status_code, response_dict, elapsed_ms)"""
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            **({"Authorization": f"Bearer {token}"} if token else {})
        },
        method="POST"
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = int((time.time() - start) * 1000)
            return resp.status, json.loads(resp.read().decode('utf-8')), elapsed
    except urllib.error.HTTPError as e:
        elapsed = int((time.time() - start) * 1000)
        try:
            body = json.loads(e.read().decode('utf-8'))
        except:
            body = {"error": str(e)}
        return e.code, body, elapsed

def login():
    status, data, ms = api_post("/api/mobile/auth/unified-login", {
        "username": "factory_admin1",
        "password": "123456"
    })
    token = data.get("data", {}).get("accessToken", "")
    print(f"Login: {'OK' if token else 'FAILED'} ({ms}ms)")
    return token

def test_chat(label, messages, token, max_tokens=500):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    user_msg = [m["content"] for m in messages if m["role"] == "user"][-1]
    print(f"  Query: {user_msg[:100]}")
    print(f"  Length: {len(user_msg)} chars")

    status, data, ms = api_post("/api/mobile/ai/chat", {
        "messages": messages,
        "temperature": 0.7,
        "maxTokens": max_tokens
    }, token=token, timeout=120)

    print(f"  HTTP: {status} | Time: {ms}ms ({ms/1000:.1f}s)")

    if data.get("success"):
        d = data["data"]
        print(f"  Model: {d.get('model', '?')} | Tokens: {d.get('tokensUsed', '?')}")
        content = d.get("content", "")
        print(f"  Response: {content[:200]}{'...' if len(content) > 200 else ''}")
    else:
        print(f"  ERROR: {data.get('message', str(data))}")

    return ms

def main():
    print("=" * 60)
    print("  Thinking Mode Optimization Test")
    print(f"  Target: {BASE_URL}")
    print("=" * 60)

    token = login()
    if not token:
        return

    results = {}

    # === SIMPLE QUERIES (thinking OFF expected) ===
    print("\n\n>>> SIMPLE QUERIES (thinking should be OFF = faster) <<<")

    ms = test_chat("Test 1: Short greeting", [
        {"role": "user", "content": "hello"}
    ], token)
    results["simple_greeting"] = ms

    ms = test_chat("Test 2: Simple math", [
        {"role": "user", "content": "what is 2+2?"}
    ], token)
    results["simple_math"] = ms

    ms = test_chat("Test 3: Short factory query", [
        {"role": "system", "content": "You are a helpful assistant for a food factory."},
        {"role": "user", "content": "Show me today production count"}
    ], token)
    results["simple_factory"] = ms

    # === COMPLEX QUERIES (thinking ON expected) ===
    print("\n\n>>> COMPLEX QUERIES (thinking should be ON = deeper analysis) <<<")

    ms = test_chat("Test 4: Production efficiency analysis", [
        {"role": "system", "content": "You are a senior business analyst for a food traceability and manufacturing company."},
        {"role": "user", "content": "Please analyze the production efficiency trends over the past quarter and suggest optimization strategies for reducing waste while maintaining quality standards across all production lines. Consider seasonal factors and compare against industry benchmarks."}
    ], token, max_tokens=2000)
    results["complex_production"] = ms

    ms = test_chat("Test 5: Warehouse optimization plan", [
        {"role": "system", "content": "You are a supply chain optimization expert."},
        {"role": "user", "content": "Compare and analyze our warehouse inventory turnover rate versus industry benchmarks, identify the root causes for slow-moving items, and provide a detailed optimization plan with predicted cost savings. Include recommendations for improving procurement forecasting accuracy."}
    ], token, max_tokens=2000)
    results["complex_warehouse"] = ms

    # === SUMMARY ===
    print("\n\n" + "=" * 60)
    print("  RESULTS SUMMARY")
    print("=" * 60)
    print(f"  {'Query Type':<30} {'Time (ms)':>10} {'Time (s)':>10}")
    print(f"  {'-'*30} {'-'*10} {'-'*10}")

    simple_times = []
    complex_times = []
    for key, ms in results.items():
        category = "SIMPLE" if key.startswith("simple") else "COMPLEX"
        name = key.replace("simple_", "").replace("complex_", "")
        print(f"  [{category}] {name:<23} {ms:>10} {ms/1000:>10.1f}")
        if key.startswith("simple"):
            simple_times.append(ms)
        else:
            complex_times.append(ms)

    if simple_times and complex_times:
        avg_simple = sum(simple_times) / len(simple_times)
        avg_complex = sum(complex_times) / len(complex_times)
        print(f"\n  Average SIMPLE:  {avg_simple:.0f}ms ({avg_simple/1000:.1f}s)")
        print(f"  Average COMPLEX: {avg_complex:.0f}ms ({avg_complex/1000:.1f}s)")
        if avg_simple > 0:
            print(f"  Ratio: Complex is {avg_complex/avg_simple:.1f}x slower than simple")

    print("\n  Expected behavior:")
    print("  - Simple queries: thinking OFF -> faster (target: <5s)")
    print("  - Complex queries: thinking ON -> slower but deeper analysis")
    print("=" * 60)

if __name__ == "__main__":
    main()
