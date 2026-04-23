"""Agent orchestrator — the single entry point for /executive/insights.

Composes:
    question → narrative_cache.get → (hit) return
             → budget_tracker.check_budget → (blocked) degraded response
             → Gold queries (finance/products/discount) for prompt data
             → call LLM with 餐饮数据分析师 system prompt (spec §4.3)
             → budget_tracker.consume + narrative_cache.put
             → return answer

Design decisions
----------------
- Narrative-only in v1: no tool_calls yet. Gold query primitives are
  called deterministically by the orchestrator before the LLM sees
  anything. This keeps latency predictable and makes token accounting
  exact. Function-calling tools can be layered on when a question
  genuinely needs multi-step reasoning (e.g. compare 2 periods).
- Prompt data is always CONCRETE: KPIs, Top 3 stores by revenue, top
  5 products, discount breakdown. LLM cannot hallucinate since it
  sees the real numbers.
- Model routing is deferred to the configured upstream (settings
  .llm_base_url + llm_api_key). If the upstream is Aliyun free and
  rate-limits, the caller will see a degraded response — we don't
  try to re-route providers here (that's a platform-level concern
  and the retry logic in services.insights.llm_client already handles
  per-provider transients).

Feature flag
------------
Gated by env SMARTBI_AGENT_LAYER_ENABLED. When False (default), the
FastAPI route does not register the /insights/custom endpoint, so
this module is never imported in the hot path.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, AsyncIterator, Dict, Optional, Tuple

import asyncpg
import httpx

from smartbi.agent.budget_tracker import AgentBudgetTracker
from smartbi.agent.narrative_cache import (
    NarrativeCacheService,
    compute_question_hash,
)
from smartbi.gold import (
    discount_breakdown,
    finance_summary,
    top_products,
)

logger = logging.getLogger(__name__)


DEGRADED_MESSAGE_BUDGET_EXHAUSTED = (
    "今日 AI 预算已用完，建议明天再问。"
    "如需提前恢复，请联系管理员调整预算上限。"
)
DEGRADED_MESSAGE_LLM_UNAVAILABLE = (
    "AI 服务暂时不可用，请稍后重试。如问题持续，请联系管理员。"
)

# Response shape returned to caller (FastAPI serializes as JSON).
RESULT_SOURCE_CACHE = "cache"
RESULT_SOURCE_LLM = "llm"
RESULT_SOURCE_DEGRADED = "degraded"


SYSTEM_PROMPT = """你是一位服务于中国餐饮连锁企业的资深数据分析师。
你将收到用户的一个业务问题，以及该企业真实经营数据的摘要。你的任务是基于这些数据回答问题，并给出可执行的运营建议。

严格遵守以下要求：
1. 回答必须基于数据中的具体数字，禁止凭空杜撰门店名、商品名、百分比。
2. 每条建议必须同时包含：
   (a) 针对哪个具体指标或哪家门店/商品
   (b) 预期收益区间（如"预计提升 3-5%"）
   (c) 执行前置条件（如"需先完成 X 培训"）
3. 禁止输出空泛建议，例如：
   - "直接涨价"
   - "加强营销"
   - "提高服务质量"
   - "扩大客源"
   这类模糊表述会被视为无效回答。
4. 若提供的数据不足以回答，直接说明"需要 X 数据才能判断"，不要胡编。
5. 用中文回复。使用 Markdown 格式：先 1-2 句核心结论，然后 bullet 列具体建议。

回答长度控制在 300 字以内。"""


@dataclass
class InsightResponse:
    """Structured result from answer_insight()."""
    answer: str
    source: str                     # "cache" | "llm" | "degraded"
    tokens: int
    tokens_used_today: int
    tokens_cap: int
    elapsed_ms: int
    chart_config: Optional[Dict[str, Any]] = None
    data_summary: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer": self.answer,
            "source": self.source,
            "tokens": self.tokens,
            "tokens_used_today": self.tokens_used_today,
            "tokens_cap": self.tokens_cap,
            "elapsed_ms": self.elapsed_ms,
            "chart_config": self.chart_config,
            "data_summary": self.data_summary,
        }


class AgentOrchestrator:
    def __init__(
        self,
        pool: asyncpg.Pool,
        llm_base_url: str,
        llm_api_key: str,
        llm_model: str,
        *,
        budget_tracker: Optional[AgentBudgetTracker] = None,
        cache: Optional[NarrativeCacheService] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self._pool = pool
        self._llm_base_url = llm_base_url.rstrip("/")
        self._llm_api_key = llm_api_key
        self._llm_model = llm_model
        self._budget = budget_tracker or AgentBudgetTracker(pool)
        self._cache = cache or NarrativeCacheService(pool)
        self._http = http_client

    async def answer_insight(
        self,
        factory_id: str,
        question: str,
        date_range: Tuple[date, date],
        *,
        cache_ttl_hours: int = 24,
    ) -> InsightResponse:
        """Main entry point. See module docstring for flow."""
        t0 = time.monotonic()
        start, end = date_range
        start_iso, end_iso = start.isoformat(), end.isoformat()

        # 1. Cache check
        q_hash = compute_question_hash(question, start_iso, end_iso, factory_id)
        hit = await self._cache.get(factory_id, q_hash)
        if hit is not None:
            budget = await self._budget.check_budget(factory_id)
            return InsightResponse(
                answer=hit["answer"],
                source=RESULT_SOURCE_CACHE,
                tokens=0,  # cache hit costs zero new tokens
                tokens_used_today=budget.tokens_used,
                tokens_cap=budget.tokens_cap,
                elapsed_ms=int((time.monotonic() - t0) * 1000),
                chart_config=hit.get("chart_config"),
            )

        # 2. Budget check
        budget = await self._budget.check_budget(factory_id)
        if budget.blocked:
            logger.warning(
                "agent budget exhausted: factory=%s used=%d cap=%d q=%r",
                factory_id, budget.tokens_used, budget.tokens_cap, question,
            )
            return InsightResponse(
                answer=DEGRADED_MESSAGE_BUDGET_EXHAUSTED,
                source=RESULT_SOURCE_DEGRADED,
                tokens=0,
                tokens_used_today=budget.tokens_used,
                tokens_cap=budget.tokens_cap,
                elapsed_ms=int((time.monotonic() - t0) * 1000),
            )

        # 3. Pull Gold summaries (concrete numbers for prompt)
        data = await self._gather_data(factory_id, date_range)

        # 4. Build prompt + call LLM
        user_prompt = self._build_user_prompt(question, start_iso, end_iso, data)
        try:
            answer, tokens = await self._call_llm(user_prompt)
        except Exception as e:
            logger.exception("LLM call failed: %s", e)
            return InsightResponse(
                answer=DEGRADED_MESSAGE_LLM_UNAVAILABLE,
                source=RESULT_SOURCE_DEGRADED,
                tokens=0,
                tokens_used_today=budget.tokens_used,
                tokens_cap=budget.tokens_cap,
                elapsed_ms=int((time.monotonic() - t0) * 1000),
                data_summary=data,
            )

        # 5. Post-call bookkeeping
        post_budget = await self._budget.consume(factory_id, tokens)
        await self._cache.put(
            factory_id, q_hash, answer,
            chart_config=None,
            tokens=tokens,
            ttl_hours=cache_ttl_hours,
        )

        return InsightResponse(
            answer=answer,
            source=RESULT_SOURCE_LLM,
            tokens=tokens,
            tokens_used_today=post_budget.tokens_used,
            tokens_cap=post_budget.tokens_cap,
            elapsed_ms=int((time.monotonic() - t0) * 1000),
            data_summary=data,
        )

    # ---------- Data gathering ----------

    async def _gather_data(
        self, factory_id: str, date_range: Tuple[date, date]
    ) -> Dict[str, Any]:
        """Pull compact summaries from Gold for the prompt.

        Limits top_n to keep prompt size bounded:
        - 3 stores (by revenue)
        - 5 products (by revenue)
        - All discount types (usually <10)
        """
        fin = await finance_summary(self._pool, factory_id, date_range, top_n_stores=3)
        prods = await top_products(self._pool, factory_id, date_range, top_n=5)
        disc = await discount_breakdown(self._pool, factory_id, date_range)
        return {
            "finance": fin,
            "top_products": prods.get("items") or prods.get("products") or [],
            "discount_breakdown": disc.get("items") or disc.get("discounts") or [],
        }

    def _build_user_prompt(
        self,
        question: str,
        start_iso: str,
        end_iso: str,
        data: Dict[str, Any],
    ) -> str:
        """Format the data as a readable prompt. No JSON dumps — LLMs
        handle pretty text more reliably."""
        fin = data["finance"]
        stores = fin.get("top_stores") or []
        top_prods = data["top_products"] or []
        discounts = data["discount_breakdown"] or []

        revenue = fin.get("total_revenue") or 0
        bills = fin.get("bill_count") or 0
        avg_bill = fin.get("avg_bill_value")
        store_count = fin.get("store_count") or 0
        day_count = fin.get("day_count") or 0

        lines = [
            f"用户问：{question}",
            "",
            f"数据范围：{start_iso} 至 {end_iso}（{day_count} 个营业日，{store_count} 家门店）",
            "",
            "## 核心 KPI",
            f"- 总营业额：¥{_fmt_money(revenue)}",
            f"- 订单数：{bills:,}",
            f"- 客单价：¥{_fmt_money(avg_bill) if avg_bill else '—'}",
        ]

        if stores:
            lines.append("")
            lines.append("## Top 3 门店（按营业额）")
            for i, s in enumerate(stores[:3], 1):
                name = s.get("store_name") or s.get("store_id") or "未知门店"
                rev = s.get("revenue") or 0
                bc = s.get("bill_count") or 0
                lines.append(f"{i}. {name}：¥{_fmt_money(rev)}（{bc:,} 单）")

        if top_prods:
            lines.append("")
            lines.append("## Top 5 商品（按营业额）")
            for i, p in enumerate(top_prods[:5], 1):
                name = p.get("product_name") or p.get("name") or "未知商品"
                rev = p.get("revenue") or 0
                qty = p.get("quantity") or p.get("qty") or 0
                lines.append(f"{i}. {name}：¥{_fmt_money(rev)}（销量 {qty:,}）")

        if discounts:
            lines.append("")
            lines.append("## 折扣结构（各类型金额合计）")
            for d in discounts[:8]:
                name = d.get("discount_name") or d.get("name") or "未知折扣"
                amt = d.get("total_amount") or d.get("amount") or 0
                lines.append(f"- {name}：¥{_fmt_money(amt)}")

        lines.append("")
        lines.append("请基于以上真实数据回答用户问题，并给出具体可执行的建议。")
        return "\n".join(lines)

    # ---------- LLM ----------

    async def _call_llm(self, user_prompt: str) -> Tuple[str, int]:
        """POST to OpenAI-compatible chat/completions. Returns (text, total_tokens).

        Raises on upstream error. Caller handles degraded fallback.
        """
        payload = {
            "model": self._llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 600,
        }
        headers = {
            "Authorization": f"Bearer {self._llm_api_key}",
            "Content-Type": "application/json",
        }
        client = self._http or httpx.AsyncClient(timeout=httpx.Timeout(60.0))
        owns_client = self._http is None
        try:
            resp = await client.post(
                f"{self._llm_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            body = resp.json()
        finally:
            if owns_client:
                await client.aclose()

        text = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            or ""
        ).strip()
        usage = body.get("usage") or {}
        tokens = int(usage.get("total_tokens") or 0)
        if not text:
            raise ValueError("LLM returned empty content")
        return text, tokens

    # ---------- Streaming variant (SSE, Phase 9 Apr 24) ----------

    async def stream_insight(
        self,
        factory_id: str,
        question: str,
        date_range: Tuple[date, date],
        *,
        cache_ttl_hours: int = 24,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Streaming variant of answer_insight. Yields event dicts:
          - {"type": "meta", "source": "cache"|"llm"|"degraded", ...}  (first event)
          - {"type": "delta", "text": "..."}  (many events, LLM tokens)
          - {"type": "done", "tokens": N, "elapsed_ms": M}  (final event)

        Cache hit + degraded paths emit meta + a single delta with the
        full text, then done — caller can treat uniformly.
        """
        t0 = time.monotonic()
        start, end = date_range
        start_iso, end_iso = start.isoformat(), end.isoformat()

        # 1. Cache check
        q_hash = compute_question_hash(question, start_iso, end_iso, factory_id)
        hit = await self._cache.get(factory_id, q_hash)
        if hit is not None:
            budget = await self._budget.check_budget(factory_id)
            yield {"type": "meta", "source": RESULT_SOURCE_CACHE,
                   "tokens_used_today": budget.tokens_used, "tokens_cap": budget.tokens_cap}
            yield {"type": "delta", "text": hit["answer"]}
            yield {"type": "done", "tokens": 0,
                   "elapsed_ms": int((time.monotonic() - t0) * 1000)}
            return

        # 2. Budget check
        budget = await self._budget.check_budget(factory_id)
        if budget.blocked:
            yield {"type": "meta", "source": RESULT_SOURCE_DEGRADED,
                   "tokens_used_today": budget.tokens_used, "tokens_cap": budget.tokens_cap}
            yield {"type": "delta", "text": DEGRADED_MESSAGE_BUDGET_EXHAUSTED}
            yield {"type": "done", "tokens": 0,
                   "elapsed_ms": int((time.monotonic() - t0) * 1000)}
            return

        # 3. Gather data + prompt
        data = await self._gather_data(factory_id, date_range)
        user_prompt = self._build_user_prompt(question, start_iso, end_iso, data)

        yield {"type": "meta", "source": RESULT_SOURCE_LLM,
               "tokens_used_today": budget.tokens_used, "tokens_cap": budget.tokens_cap,
               "data_summary_compact": {
                   "finance": {
                       "revenue": data.get("finance", {}).get("total_revenue"),
                       "bills": data.get("finance", {}).get("bill_count"),
                       "stores": data.get("finance", {}).get("store_count"),
                   }
               }}

        # 4. Stream LLM
        full_text_parts = []
        total_tokens = 0
        try:
            async for chunk in self._call_llm_stream(user_prompt):
                if chunk.get("text"):
                    full_text_parts.append(chunk["text"])
                    yield {"type": "delta", "text": chunk["text"]}
                if chunk.get("tokens"):
                    total_tokens = chunk["tokens"]
        except Exception as e:
            logger.exception("LLM stream failed: %s", e)
            # Emit degraded tail so client gets a valid terminator
            yield {"type": "delta", "text": "\n\n" + DEGRADED_MESSAGE_LLM_UNAVAILABLE}
            yield {"type": "done", "tokens": 0,
                   "elapsed_ms": int((time.monotonic() - t0) * 1000)}
            return

        answer = "".join(full_text_parts).strip()
        if answer:
            post_budget = await self._budget.consume(factory_id, total_tokens)
            await self._cache.put(
                factory_id, q_hash, answer,
                chart_config=None, tokens=total_tokens, ttl_hours=cache_ttl_hours,
            )
        yield {"type": "done", "tokens": total_tokens,
               "elapsed_ms": int((time.monotonic() - t0) * 1000)}

    async def _call_llm_stream(self, user_prompt: str) -> AsyncIterator[Dict[str, Any]]:
        """POST to OpenAI-compatible chat/completions with stream=true.

        Yields {"text": "..."} for each delta, and finally {"tokens": N}
        if the upstream reports usage on the final [DONE] message.
        """
        payload = {
            "model": self._llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 600,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        headers = {
            "Authorization": f"Bearer {self._llm_api_key}",
            "Content-Type": "application/json",
        }
        client = self._http or httpx.AsyncClient(timeout=httpx.Timeout(60.0))
        owns_client = self._http is None
        try:
            async with client.stream(
                "POST",
                f"{self._llm_base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        obj = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if choices:
                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if content:
                            yield {"text": content}
                    usage = obj.get("usage")
                    if usage:
                        yield {"tokens": int(usage.get("total_tokens") or 0)}
        finally:
            if owns_client:
                await client.aclose()


def _fmt_money(v: Any) -> str:
    """Render a currency amount with 2 decimals + thousands separator.

    Handles None / Decimal / float / int gracefully.
    """
    if v is None:
        return "0.00"
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v)
