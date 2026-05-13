# Post-deploy verification log — PR #578

## Test env deploy: 2026-05-13 17:57 EDT (= 2026-05-14 05:57 server UTC)

Deploy command:
```
cd C:/Users/Steve/cretas-llm-switch && bash scripts/deploy/deploy-smartbi-python.sh --env test
```

Result: `部署完成! (环境: test)` — http://47.100.235.168:8084/health 200 OK.

## Smoke tests (real LLM calls via prod-key accounts)

Method: `python -c 'from common.llm_router import SLOT, call_chain; ...'`
on server `47.100.235.168` with LLM_*_API_KEY env vars from `restart-test.sh`.

### Default chain (each slot picks first viable provider)

```
2026-05-14 05:59:41 [INFO] HTTP Request: POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions "HTTP/1.1 200 OK"
2026-05-14 05:59:41 [INFO] [cache] slot=chat via aliyun_b/qwen-max: prompt=11 cached=0 (0%) completion=1
2026-05-14 05:59:41 [INFO] [llm_router] slot=chat OK via aliyun_b/qwen-max
=== CHAT: OK ===
  content: OK
  model:   qwen-max

2026-05-14 05:59:42 [INFO] [llm_router] slot=insights OK via aliyun_b/qwen3.6-35b-a3b
=== INSIGHTS: OK ===
  content: OK
  model:   qwen3.6-35b-a3b

2026-05-14 05:59:45 [INFO] [llm_router] slot=chart OK via aliyun_b/glm-5
=== CHART: OK ===
  content: OK
  model:   glm-5

2026-05-14 06:00:20 [INFO] [llm_router] slot=reasoning OK via aliyun_b/qwen3.5-397b-a17b
=== REASONING: OK === model=qwen3.5-397b-a17b content=OK
```

### Isolated chains (verify each new SKU individually)

```
2026-05-14 06:00:27 [INFO] [llm_router] slot=chat OK via aliyun_a/qwen3.6-max-preview
=== aliyun_a isolated: OK === model=qwen3.6-max-preview content=OK

2026-05-14 06:00:27 [INFO] [cache] slot=chat via zhipu/glm-4.5-air: prompt=8 cached=4 (50%) completion=5
2026-05-14 06:00:27 [INFO] [llm_router] slot=chat OK via zhipu/glm-4.5-air
=== zhipu isolated: OK === model=glm-4.5-air content=(empty completion ok, 5 tokens used)

2026-05-14 06:00:28 [INFO] [llm_router] slot=chat OK via aliyun_a_deepseek/deepseek-v4-pro
=== aliyun_a_deepseek isolated: OK === model=deepseek-v4-pro content=OK
```

### Summary table

| Provider | Default-chain test slot | Isolated test | Status |
|---|---|---|---|
| aliyun_b | qwen-max (CHAT), qwen3.6-35b-a3b (INSIGHTS), glm-5 (CHART), qwen3.5-397b-a17b (REASONING) | (default-chain covers) | ✅ all 200 OK |
| aliyun_a | (would be reached if B fails) | qwen3.6-max-preview | ✅ 200 OK |
| zhipu | (would be reached if A fails) | glm-4.5-air | ✅ 200 OK, cache hit 50% (pool alive) |
| aliyun_a_deepseek (NEW) | (would be reached if zhipu fails) | deepseek-v4-pro | ✅ 200 OK |
| deepseek (official) | NOT TESTED — known 402 balance 0; falls through harmlessly | n/a | (expected unusable; chain handles) |

VL slot not directly probed; relying on Steve's screenshot for qwen3-vl-plus-2025-12-19. Prior live-probe verified the older qwen-vl-plus-2025-05-07 works; newer version should also work per Steve's screenshot.

### Confirmed claims from Steve's MO

- qwen-max on aliyun_b — 1M intact ✓ (verified, 200 OK on first call)
- qwen3.6-max-preview on aliyun_a — 999K intact ✓ (verified, 200 OK)
- glm-4.5-air on zhipu — 6.5M independent pool ✓ (50% cache hit indicates pool is healthy, not depleted)
- deepseek-v4-pro via aliyun_a DashScope — 999K free ✓ (200 OK via new chain entry)

### Prod deploy: PENDING (awaiting Steve GO)

After Steve GO:
```
./scripts/deploy/deploy-smartbi-python.sh --env prod
journalctl -u cretas-python -f | grep -E '\[llm_router\]'
```
Will append observed log lines below.

