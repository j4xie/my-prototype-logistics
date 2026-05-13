# Issue #580 — DeepSeek balance 0: 3 options cost/value analysis

**Date**: 2026-05-13 (CST)
**Status**: Decision pending Steve. **Do NOT close #580** — this doc surfaces options + recommendation; pick one then implement.
**Author**: chat3 (LLM router context, same chat that shipped PR #577 + PR #578)

---

## TL;DR

**Recommendation: Hybrid of Option 2 + Option 3 — drop `deepseek` (official) from `DEFAULT_CHAIN`, keep `aliyun_a_deepseek` (already shipped in PR #578).**

Rationale: PR #578 already implements Option 3 (`deepseek-v4-pro` via DashScope free pool on aliyun_a key). The remaining `deepseek` (official) chain entry is now redundant — it would only fire if `aliyun_b → aliyun_a → zhipu → aliyun_a_deepseek` all exhaust simultaneously, an extremely rare 4-failure scenario. Removing it gives:

- Faster fail-fast on chain exhaustion (4-provider chain instead of 5)
- Clearer ops semantics (no paid-tier surprise charges if free quotas drift)
- ~$0.60/month historical savings (immaterial dollar amount, but eliminates a cost-surprise vector)
- Cleaner error logs (no perpetual "deepseek 402" noise)

If reliability is paramount and the $0.60-1/month is acceptable: Option 1 (top up DeepSeek balance to $10-50) gives a paid last-resort that physically exists. But it's belt-and-suspenders on top of an already-redundant DeepSeek route via aliyun_a_deepseek.

---

## Current state (as of 2026-05-13 18:00 EDT)

After PR #577 (merged earlier today) + PR #578 (in flight, https://github.com/j4xie/my-prototype-logistics/pull/578):

**Chain order** (5 providers):
```
aliyun_b → aliyun_a → zhipu → aliyun_a_deepseek → deepseek (official)
```

**Per-SLOT defaults** post-PR-#578:

| SLOT | aliyun_b | aliyun_a | zhipu | aliyun_a_deepseek (NEW) | deepseek (official) |
|---|---|---|---|---|---|
| CHAT | qwen-max | qwen3.6-max-preview | glm-4.5-air | deepseek-v4-pro | deepseek-v4-pro |
| INSIGHTS | qwen3.6-35b-a3b | qwen3.6-35b-a3b | glm-4.5-air | deepseek-v4-pro | deepseek-v4-pro |
| CHART | glm-5 | glm-5 | glm-4.5-air | deepseek-v4-pro | deepseek-v4-pro |
| MAPPER | qwen3.5-122b-a10b | qwen3.5-122b-a10b | glm-4.5-air | deepseek-v4-pro | deepseek-v4-pro |
| REASONING | qwen3.5-397b-a17b | qwen3.5-397b-a17b | glm-4.5-air | deepseek-v4-pro | deepseek-v4-pro |
| VL | qwen3-vl-plus-2025-12-19 | qwen3-vl-plus-2025-12-19 | glm-4.6v | None | None |
| REVIEW | deepseek-r1-distill-qwen-32b | qwen3.5-397b-a17b | glm-4.5-air | None | deepseek-v4-pro |

**Failure state of DeepSeek-official** (per audit-matrix.md from PR #577): all SKUs return HTTP 402 "Insufficient Balance" — account balance 0. Live-probe May 13 confirmed `deepseek-v4-flash`, `deepseek-chat`, `deepseek-v4-pro` all return 402.

The chain's `_is_quota_exhausted` matches 403/429 but NOT 402. So 402 falls through the "Other errors" branch which still continues to next provider — but `deepseek` is end-of-chain, so the chain just exhausts cleanly with an empty errors list (this is the behavior that triggered Issue #580's noisy logs).

---

## Usage audit (smart_bi_llm_usage table)

### ⚠️ Caveat: LLM usage logging DIED ~April 28, 2026

Last logged `ts` across all providers:
```
aliyun_a:  last call 2026-04-28 09:10
zhipu:     last call 2026-04-27 04:19
aliyun_b:  last call 2026-04-27 08:46
deepseek:  last call 2026-04-28 12:15
dashscope: last call 2026-04-16 15:02
```

We are at 2026-05-13. **No LLM usage rows since April 28** — that's a 15-day gap with active prod traffic. Most likely cause: the Apr 28 P0 RLS hardening on `smart_bi_llm_usage` (per memory `project_apr28_p0_rls_gap_finding.md`) broke INSERTs because the metrics writer doesn't set `app.factory_id`. The RLS INSERT policy on this table is:

```sql
((factory_id IS NULL) AND (current_setting('app.factory_id', true) IS NULL OR ''))
  OR ((factory_id IS NOT NULL) AND (current_setting(...) = ANY ... OR setting is NULL))
```

If the metrics writer passes `factory_id IS NULL` AND the session has `app.factory_id` set to a non-empty factory (which JWT-scoped Python routes would do), the INSERT silently fails the WITH CHECK.

**This is a separate Issue worth filing**: LLM metrics silently broken since Apr 28. We cannot answer "current usage" from this table — need to either fix the metrics writer or grep journalctl.

**For this analysis, we use the Apr 27-28 sample as the best available baseline.**

### Historical DeepSeek usage (Apr 27-28, 2-day window)

```
 model             | calls | in_tok | out_tok | success | errors
-------------------|-------|--------|---------|---------|--------
 deepseek-chat     |   298 |  53050 |   19734 |     298 |      0
 deepseek-v4-flash |    32 |  11484 |    3697 |      32 |      0
```

- 330 calls in 2 days = ~165 calls/day
- 88K tokens total in 2 days (64.5K input + 23.4K output)
- **100% success rate** in that window (account was funded then; balance ran out later)

### DeepSeek callers (which SLOTs/services trigger fallback)

```
 caller                     | total | deepseek
----------------------------|-------|----------
 ai_query_chat              |  3936 |      226   (5.7% deepseek-fallback rate)
 agent_orchestrator         |   408 |       97   (24% deepseek-fallback rate)
 semantic_mapper            |    85 |        3
 structure_detector         |    23 |        2
 agent_orchestrator_stream  |     2 |        1
 insight_generator          |     6 |        1
```

`agent_orchestrator` shows 24% deepseek-fallback rate — meaning 1 in 4 of its calls hit DeepSeek tail in that window. That's significant. Either zhipu/aliyun_a were under-provisioned then, or agent_orchestrator's payloads were rejected by free providers (need to verify; this analysis just notes the pattern).

### Cost projection

At historical rate of ~88K tokens / 2 days = 44K tokens/day extrapolated to deepseek tail:

- **DeepSeek-chat (V3) pricing** (https://api-docs.deepseek.com pricing as of 2025-12):
  - Input cached: $0.07/M
  - Input uncached: $0.27/M
  - Output: $1.10/M
- **DeepSeek-V4-flash pricing**: comparable economics
- Assume 50% cache hit rate (conservative — DeepSeek prompt cache is aggressive)

Monthly cost projection:
- Input: 64.5K × 30/2 × ($0.07 × 0.5 + $0.27 × 0.5)/M = 967K × $0.17/M = **$0.16/month**
- Output: 23K × 30/2 × $1.10/M = 345K × $1.10/M = **$0.38/month**
- **Monthly total: ~$0.54/month** at historical rate

⚠️ This is a HISTORICAL projection. Current chain (with 5 providers + better SKU picks per PR #578) routes around DeepSeek-official much more aggressively. Actual cost would likely be lower — DeepSeek-official only hit when 4 preceding providers all fail simultaneously.

---

## Option 1: Top up DeepSeek-official balance ($10-50/month)

### What

Add USD to https://api.deepseek.com balance via WeChat/Alipay/credit card. Top-up retains existing 5-provider chain order; `deepseek-v4-pro` (or whichever SKU is set) becomes a working paid last-resort tier.

### Cost

- Historical projection: ~$0.50-1/month → $10 lasts ~16 months
- Worst-case (chain failure cascades to deepseek frequently): $5-10/month → $50 lasts 5-10 months
- One-time top-up of $20-50 likely covers a year of use

### Pros

- Zero code changes
- Adds genuine paid-tier redundancy on a DIFFERENT account (not aliyun-anything) — true diversification if all DashScope accounts simultaneously exhaust
- Keeps `agent_orchestrator`'s 24% deepseek-fallback rate path working

### Cons

- Recurring payment hassle (WeChat/Alipay top-up flow has been historically annoying)
- Belt-and-suspenders on top of `aliyun_a_deepseek` which already provides DeepSeek-class quality via free quota
- Doesn't solve the broken metrics logging problem (separate issue)
- DeepSeek-official prices may rise faster than DashScope-hosted prices (different competitive dynamics)

### Implementation if picked

1. Top up balance via DeepSeek console (~$10-20 starter)
2. (Optional) Tighten `LLM_DEEPSEEK_MAX_USD_PER_MONTH` env var (currently 10.0) to match top-up amount
3. No code changes
4. Wait for first chain-cascade-to-deepseek event in journalctl to verify

---

## Option 2: Drop `deepseek` (official) from chain entirely

### What

Edit `backend/python/common/llm_router.py`:
- Remove `"deepseek"` from `DEFAULT_CHAIN` (becomes 4-provider chain: `aliyun_b → aliyun_a → zhipu → aliyun_a_deepseek`)
- Remove `"deepseek"` entries from each SLOT in `SLOT_MODELS` (or set to None)
- Remove `"deepseek"` entry from `_provider_config`
- Remove the `LLM_DEEPSEEK_API_KEY` env var requirement (becomes harmless to omit)
- Optionally keep `deepseek_over_budget` check for budget defensive code

### Cost

- ~30min implementation + test
- No recurring cost (saves ~$0.50/month historical, dollar amount immaterial)

### Pros

- Cleanest chain — 4 providers all on free tier (aliyun_b, aliyun_a, zhipu, aliyun_a_deepseek)
- Eliminates 402 error noise in logs
- Faster exhaustion-error (one fewer provider to try when all upstream exhausted)
- Removes a payment-required vector from prod path
- Removes the `LLM_DEEPSEEK_MAX_USD_PER_MONTH` budget gate complexity

### Cons

- If aliyun_a_deepseek's free pool also exhausts, no DeepSeek-class fallback
- `agent_orchestrator`'s 24% historical fallback path loses one option (but aliyun_a_deepseek's free deepseek-v4-pro covers the same model class)
- No truly-paid tier — if all 4 free tiers exhaust same day (extreme tail case), system fails

### Implementation if picked

Marching order would specify:
1. Remove "deepseek" from DEFAULT_CHAIN
2. Set all SLOT_MODELS[slot]["deepseek"] = None (or remove key entirely)
3. Remove `"deepseek"` entry from `_provider_config`
4. Remove `deepseek_over_budget` import + call site (or leave as dead code with TODO)
5. Smoke test all 7 SLOTs to confirm chain still completes
6. Add comment to llm_router.py header noting DeepSeek-official removal + when
7. Optionally: filter LLM_DEEPSEEK_* env vars from systemd cretas-python.service (or leave as harmless unused)

---

## Option 3: Use aliyun-DashScope deepseek-v4-pro free quota (Steve MO suggested this)

### Already shipped via PR #578

PR #578 (https://github.com/j4xie/my-prototype-logistics/pull/578, in flight) added `aliyun_a_deepseek` as a 5th chain entry. It reuses aliyun_a's API key + DashScope compatible-mode endpoint but routes `deepseek-v4-pro` — which has 999K free quota on Aliyun-A per Steve's screenshot audit.

Verified working in test env smoke (PR #578 commit `61458743c`):
```
slot=chat OK via aliyun_a_deepseek/deepseek-v4-pro
```

### Cost

- $0 (uses Aliyun's free quota, independent of qwen-* pool)
- ~999K tokens/month free pool resets monthly
- At historical rate (~88K/2 days deepseek usage extrapolated to monthly ~1.3M), the free pool MIGHT exhaust mid-month — but real prod chain probably uses this MUCH less since aliyun_b/aliyun_a/zhipu pick up earlier

### Pros

- Free
- DeepSeek-class quality (deepseek-v4-pro is actually a SUPERIOR SKU vs deepseek-chat/v4-flash that historical usage hit)
- Independent free pool — does not deplete aliyun_a's qwen-* quota
- Already integrated via PR #578 (zero additional work if Steve approves merge)

### Cons

- All 4 of (aliyun_b, aliyun_a, zhipu, aliyun_a_deepseek) share Aliyun + Zhipu accounts. If one of those vendors has a regional outage, multiple chain entries fail simultaneously
- ~999K monthly pool may exhaust in heavy-traffic month
- Doesn't add paid redundancy

### Implementation if picked

ALREADY DONE in PR #578. Just merge.

---

## Decision matrix

| Criterion | Option 1 (top up) | Option 2 (drop) | Option 3 (DashScope free, PR #578) |
|---|---|---|---|
| $/month cost | $0.50-1 (historical) | $0 | $0 |
| Code changes | None | ~30min | DONE (PR #578) |
| Vendor diversification | ⭐⭐⭐ (DeepSeek + Aliyun + Zhipu) | ⭐⭐ (Aliyun + Zhipu only) | ⭐⭐ (Aliyun + Zhipu only) |
| Reliability if Aliyun outage | ⭐⭐⭐ (DeepSeek independent) | ⭐ (only zhipu left, narrow) | ⭐ (only zhipu left, narrow) |
| Operational simplicity | ⭐⭐ (top-up hassle) | ⭐⭐⭐ (4-provider clean) | ⭐⭐⭐ (5-provider, all free) |
| Error log noise | ⭐⭐⭐ (no 402) | ⭐⭐⭐ (no DeepSeek) | ⭐⭐ (deepseek-official still in chain, still 402s) |

---

## Recommendation: Option 2 + Option 3 combined

**Merge PR #578 (gives Option 3 free DashScope route), then file a follow-up to drop `deepseek` (official) from chain entirely (Option 2).**

The combined state is:
- 4-provider chain: `aliyun_b → aliyun_a → zhipu → aliyun_a_deepseek`
- All 4 on free tier, with DeepSeek-class quality available via `aliyun_a_deepseek`
- Zero recurring cost
- Cleaner ops semantics (no 402 noise, no paid-tier surprise)
- ~30min follow-up work (drop deepseek-official)

**Trade-off accepted**: Loss of cross-vendor diversification — if Aliyun + Zhipu both have a simultaneous regional outage, the chain has no paid-tier fallback. This is an extremely tail-risk scenario. If/when it bites, can re-add DeepSeek-official as Option 1 trivially.

### If Steve prefers reliability over cost (rare AliCN outage concern)

**Option 1 + Option 3 combined**: keep current 5-provider chain (post-PR-#578), plus top up DeepSeek-official to $10-20. ~$0.50/month at historical rate, ensures cross-vendor fallback exists.

---

## Side issue uncovered: LLM metrics broken since Apr 28

While running this audit I discovered `smart_bi_llm_usage` has had ZERO inserts since April 28, 2026 — almost certainly due to the Apr 28 P0 RLS hardening (memory `project_apr28_p0_rls_gap_finding.md`). The RLS INSERT policy on the table requires `app.factory_id` setting alignment that the LLM metrics writer doesn't satisfy.

**This is a separate operational gap** — recommend filing a new issue:
- Title: `bug(observability): smart_bi_llm_usage RLS blocks INSERTs since Apr 28 — no metrics visibility`
- Impact: cannot answer cost / usage questions; cannot detect chain anomalies via aggregation
- Fix: either bypass RLS for metrics writer (set `app.factory_id=''` in writer session), or use a system-level table (no RLS), or write to journalctl + structured parser

Not in scope for #580 but blocks future analyses like this one.

---

## Appendix: Live verification of PR #578 chain (prod env, this session)

Per `tests/qa-llm-quota/post-deploy-verify.md` (PR #578 evidence commit `61458743c`):

```
slot=chat OK via aliyun_b/qwen-max                          ✓
slot=insights OK via aliyun_b/qwen3.6-35b-a3b               ✓
slot=chart OK via aliyun_b/glm-5                            ✓
slot=reasoning OK via aliyun_b/qwen3.5-397b-a17b            ✓
aliyun_a isolated: qwen3.6-max-preview                      ✓
zhipu isolated: glm-4.5-air (50% cache hit, pool alive)     ✓
aliyun_a_deepseek isolated: deepseek-v4-pro                 ✓ ← Option 3 works
```

Test + prod both verified 2026-05-13.

---

## Open questions for Steve

1. Pick which option(s): 1+3, 2+3, or 1+2+3?
2. If picking 2 (drop deepseek-official), can chat3 do the follow-up PR in this session (~30min)?
3. Should chat3 file the separate `smart_bi_llm_usage` RLS metrics issue (separate from #580)?
