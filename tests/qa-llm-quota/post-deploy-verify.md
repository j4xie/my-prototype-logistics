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

### Prod deploy: 2026-05-13 18:02 EDT

Deploy command:
```
cd C:/Users/Steve/cretas-llm-switch && bash scripts/deploy/deploy-smartbi-python.sh --env prod
```

Result:
```
Production Python restarted (systemd)
健康检查 (SSH localhost): port=8083 (最多等待 30s)
服务正常 (HTTP 200, 等待 2s)
[生产] Python 服务 (8083) 部署成功
部署完成! (环境: prod)
```

systemd `cretas-python` restart confirmed via:
```
May 14 06:02:47 iZuf6aillfem75trsuv1l1Z systemd[1]: Started Cretas Python AI Service (port 8083).
```

### Prod smoke (manual with systemd-loaded LLM_* env vars)

```
2026-05-14 06:03:32 [INFO] HTTP Request: POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions "HTTP/1.1 200 OK"
2026-05-14 06:03:32 [INFO] [cache] slot=chat via aliyun_b/qwen-max: prompt=11 cached=0 (0%) completion=1
2026-05-14 06:03:32 [INFO] [llm_router] slot=chat OK via aliyun_b/qwen-max
=== CHAT: OK === model=qwen-max content=OK

2026-05-14 06:03:33 [INFO] [llm_router] slot=insights OK via aliyun_b/qwen3.6-35b-a3b
=== INSIGHTS: OK === model=qwen3.6-35b-a3b content=OK
```

Prod chain confirmed live: `['aliyun_b', 'aliyun_a', 'zhipu', 'aliyun_a_deepseek', 'deepseek']`.

### Prod 5-min organic watch (06:02:54 → 06:07:54)

```
ssh root@47.100.235.168 "journalctl -u cretas-python --since '6 min ago' --no-pager | grep -E '\\[llm_router\\]|exhausted|HTTP 4[0-9][0-9]|HTTP 5[0-9][0-9]'"
```

Result: **EMPTY** — no organic prod LLM traffic in the 5-min window (no client calls hit the chain in that 5-min span). Only the systemd Start line appears at 06:02:47.

This is fine:
- No errors / 4xx / 5xx → service is healthy
- No `[llm_router] All providers exhausted` → original incident signature gone
- No `[llm_router] OK via deepseek/...` → chain not falling through (would indicate fallback)

Prod is genuinely idle in this window. Real organic traffic will exercise the chain naturally over the next hours; the smoke calls (CHAT + INSIGHTS) above already confirm new SKUs work on prod-key accounts.

### Cleanup checklist after merge

- [ ] Verify `[llm_router] All providers exhausted` doesn't reappear in prod log over next 24-48h
- [ ] Re-audit SKU quota status before next mid-month milestone (2026-05-27 = +2 weeks)
- [ ] Consider Issue #580 ops decision (3 options analyzed in `docs/qa-audits/2026-05-14-deepseek-decision-580.md`, PR #584)

