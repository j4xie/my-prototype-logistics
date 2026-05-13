# LLM Provider × SKU Quota Audit — 2026-05-13

**Trigger**: `python-prod.log` reports all 4 providers exhausted on default SKUs

```
[llm_router] All providers exhausted for chat:
  aliyun_b/qwen3.6-flash 403 (FreeTierOnly exhausted)
  aliyun_a/qwen3.5-plus ReadTimeout
  zhipu/glm-4-plus 429 余额不足或无可用资源包
  deepseek/deepseek-v4-flash 402 Insufficient Balance
```

**Method**: Live `chat/completions` test calls with `max_tokens=5`, 25s timeout, recorded HTTP status.
**Audit script**: `/tmp/audit-llm.sh` + `/tmp/audit-llm-2.sh` (May 13 2026)
**Tested with prod API keys** sourced from `scripts/systemd/restart-test.sh.new`.

---

## Audit Matrix

### aliyun_b (account B — historically free-quota mine)

| SKU | Status | Notes |
|---|---|---|
| `qwen3.6-flash` | **403 EXHAUSTED** | free tier 用完, was SLOT.CHAT/INSIGHTS primary — TRIGGERED PROD INCIDENT |
| `qwen-flash` | **200 OK** | working — recommended new primary for CHAT/INSIGHTS |
| `qwen3.5-flash` | 403 EXHAUSTED | free tier 用完 |
| `qwen-plus` | 403 EXHAUSTED | free tier 用完 |
| `qwen-turbo` | **200 OK** | working — current SLOT.MAPPER primary, still OK |
| `qwen3.6-35b-a3b` | **200 OK** | working — additional MAPPER fallback candidate |
| `glm-5` | **200 OK** | working — current CHART primary, still OK |
| `deepseek-r1` | **200 OK** | working — current REASONING primary, still OK |
| `deepseek-r1-distill-qwen-32b` | **200 OK** | working — current REVIEW primary, still OK |
| `qwen-vl-plus-2025-05-07` | **200 OK** | working — current VL primary, still OK |

### aliyun_a (account A)

| SKU | Status | Notes |
|---|---|---|
| `qwen3.5-plus-2026-04-20` | **200 OK** | **STILL WORKING** — log "ReadTimeout" was transient (current CHAT primary) |
| `qwen3.6-flash-2026-04-16` | 403 EXHAUSTED | free tier 用完 (current INSIGHTS primary on A — broken!) |
| `qwen-flash` | **200 OK** | working on A too (memory said paid — re-check; may be free now) |
| `qwen3.5-plus` | **200 OK** | working (bare alias) |
| `qwen3.5-122b-a10b` | **200 OK** | working — current MAPPER primary |
| `qwen3.5-397b-a17b` | **200 OK** | working — current REASONING/REVIEW primary |
| `glm-5` | **200 OK** | working — current CHART primary |
| `qwen3-vl-flash` | 403 EXHAUSTED | free tier 用完 (current VL secondary on A — broken!) |
| `qwen3.5-flash` | **200 OK** | working — INSIGHTS fallback candidate |

### zhipu (ZhipuAI)

| SKU | Status | Notes |
|---|---|---|
| `glm-4-plus` | **429 EXHAUSTED** | 余额不足/无可用资源包 — TRIGGERED PROD INCIDENT |
| `glm-4-flash` | **200 OK** | working — recommended new primary for CHAT/INSIGHTS |
| `glm-4-air` | 429 EXHAUSTED | 余额不足 |
| `glm-4.5-air` | **200 OK** | working — current CHART/MAPPER/REASONING/REVIEW primary |
| `glm-3-turbo` | 429 EXHAUSTED | 余额不足 |
| `glm-4` | 429 EXHAUSTED | 余额不足 |
| `glm-4-flashx`, `glm-4-airx`, `glm-4-long`, `glm-4v`, `glm-4v-plus` | 429 | all 余额不足 |

### deepseek (DeepSeek official — paid only)

| SKU | Status | Notes |
|---|---|---|
| `deepseek-v4-flash` | **402 BALANCE 0** | Insufficient Balance — paid only, recharge needed |
| `deepseek-chat` | 402 BALANCE 0 | same — recharge needed |
| `deepseek-v4-pro` | 402 BALANCE 0 | same — recharge needed |

DeepSeek-official has no free tier; account balance must be recharged. **Until then, deepseek tail provider effectively unusable** but `_is_quota_exhausted` only matches 403/429 — **402 will trigger the "non-quota error" path** which still falls through to next provider, so chain remains correct. The deepseek slots are effectively a no-op until recharge.

---

## SKU Changes per SLOT

Primary recovery: swap exhausted primaries to confirmed-working SKUs. Keep old SKU as fallback in fallback chain (chain order: `aliyun_b → aliyun_a → zhipu → deepseek`). Note: `SLOT_MODELS` is a per-account dict, so "fallback" within a single provider is not natively supported — when primary on B exhausts, the chain moves to A automatically. The pertinent change is **which SKU each provider tries first**.

| SLOT | Account | Before | After | Reason |
|---|---|---|---|---|
| CHAT | aliyun_b | `qwen3.6-flash` 403 | **`qwen-flash`** 200 | unblock incident root cause |
| CHAT | aliyun_a | `qwen3.5-plus-2026-04-20` (ReadTimeout in log, but 200 now) | **unchanged** — transient | log timeout was network blip, SKU works |
| CHAT | zhipu | `glm-4-plus` 429 | **`glm-4-flash`** 200 | unblock incident root cause |
| CHAT | deepseek | `deepseek-v4-flash` 402 | **unchanged** — entire account exhausted | needs $ recharge, not SKU switch |
| INSIGHTS | aliyun_b | `qwen3.6-flash` 403 | **`qwen-flash`** 200 | same root cause |
| INSIGHTS | aliyun_a | `qwen3.6-flash-2026-04-16` 403 | **`qwen3.5-flash`** 200 | A's flash version exhausted too |
| INSIGHTS | zhipu | `glm-4-plus` 429 | **`glm-4-flash`** 200 | same root cause |
| INSIGHTS | deepseek | `deepseek-v4-flash` 402 | unchanged | account exhausted |
| CHART | all | `glm-5` / `glm-5` / `glm-4.5-air` / `deepseek-v4-flash` | **unchanged** | primaries working |
| MAPPER | all | `qwen-turbo` / `qwen3.5-122b-a10b` / `glm-4.5-air` / `deepseek-v4-flash` | **unchanged** | primaries working |
| REASONING | all | `deepseek-r1` / `qwen3.5-397b-a17b` / `glm-4.5-air` / `deepseek-v4-pro` | **unchanged** | primaries working |
| VL | aliyun_b | `qwen-vl-plus-2025-05-07` 200 | unchanged | working |
| VL | aliyun_a | `qwen3-vl-flash` 403 | **`qwen-vl-plus-2025-05-07`** 200 | A's flash VL exhausted; reuse the working SKU id (DashScope compatible-mode lets both accounts call same SKU) |
| VL | zhipu | `glm-4.6v` (payload incompat per code comment) | unchanged | known broken — leave as-is, chain falls to deepseek (None, skip) |
| VL | deepseek | `None` | unchanged | no DeepSeek VL model |
| REVIEW | all | `deepseek-r1-distill-qwen-32b` / `qwen3.5-397b-a17b` / `glm-4.5-air` / `deepseek-v4-pro` | **unchanged** | primaries working |

**Summary**: 5 SKU changes across SLOT.CHAT (2), SLOT.INSIGHTS (3), SLOT.VL (1). 0 chain order changes. 0 circuit-breaker / timeout tuning changes.

---

## Live Audit Confirmation

This audit was run live against production API keys before commit. Results reproducible by running `/tmp/audit-llm.sh` with the keys from `scripts/systemd/restart-test.sh.new`. Re-audit recommended before EVERY SKU change in production routing.

---

## DeepSeek tail provider note

DeepSeek (the official non-DashScope account) is fully balance-exhausted across all SKUs. The chain still walks through but `_is_quota_exhausted` only matches 403/429 — **402 falls through to the "Other errors" branch which still continues to next provider**. So functionally the tail is a no-op. Re-audit after balance recharge.

Suggested follow-up (out of scope for this PR): treat 402 the same as 403/429 for cleaner error logs.

---

## Post-deploy verification

Within 5-10 min of `--env test` (then `--env prod`) deploy, watch:

```
journalctl -u cretas-python -f | grep -E '\[llm_router\]'
```

Expected: `[llm_router] slot=chat OK via aliyun_b/qwen-flash` log line appears, "All providers exhausted" error gone.

If still seeing exhaustion, re-run audit — quota status changes hour-to-hour as other systems consume.
