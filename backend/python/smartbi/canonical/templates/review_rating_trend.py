"""Review rating trend + Top keywords from dim_review_summary.

Aggregates per-period rows into a trend; flattens JSONB top_keywords arrays
across periods and ranks by frequency for an overall Top-10 keyword list.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from smartbi.canonical.templates.base import TemplateResult

if TYPE_CHECKING:
    import asyncpg


def _aggregate_keywords(keywords_arr: Any, top: int = 10) -> List[Dict[str, Any]]:
    """Flatten JSONB array-of-arrays of keyword entries → Top N by frequency.

    Each per-period entry is expected to be either a list of strings, a list of
    {keyword, count} dicts, or None. Robust against mixed shapes.
    """
    if keywords_arr is None:
        return []
    # asyncpg may return a JSON string or already-decoded list
    if isinstance(keywords_arr, str):
        try:
            keywords_arr = json.loads(keywords_arr)
        except (ValueError, TypeError):
            return []
    if not isinstance(keywords_arr, list):
        return []

    counter: Counter = Counter()
    for entry in keywords_arr:
        if entry is None:
            continue
        if isinstance(entry, str):
            try:
                entry = json.loads(entry)
            except (ValueError, TypeError):
                continue
        if isinstance(entry, list):
            for kw in entry:
                if isinstance(kw, str):
                    counter[kw] += 1
                elif isinstance(kw, dict):
                    name = kw.get("keyword") or kw.get("name") or kw.get("word")
                    if not name:
                        continue
                    cnt = kw.get("count") or kw.get("freq") or 1
                    try:
                        counter[name] += int(cnt)
                    except (ValueError, TypeError):
                        counter[name] += 1
        elif isinstance(entry, dict):
            name = entry.get("keyword") or entry.get("name") or entry.get("word")
            if name:
                cnt = entry.get("count") or entry.get("freq") or 1
                try:
                    counter[name] += int(cnt)
                except (ValueError, TypeError):
                    counter[name] += 1

    return [{"keyword": k, "count": c} for k, c in counter.most_common(top)]


async def compute_review_rating_trend(
    pool: "asyncpg.Pool",
    factory_id: str,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> TemplateResult:
    """Average rating trend over time + aggregated Top keywords.

    Tenant safety: caller MUST set ``app.factory_id`` (via tenant_ctx.set_factory_id
    or pool setup callback) before invoking. Forgetting → FORCE RLS silently returns
    0 rows. Mirrors BaseWriter.write contract.
    """
    where = ["factory_id = $1"]
    params: list = [factory_id]
    if period_start is not None:
        where.append(f"period_start >= ${len(params) + 1}")
        params.append(period_start)
    if period_end is not None:
        where.append(f"period_end <= ${len(params) + 1}")
        params.append(period_end)
    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
          period_start,
          period_end,
          AVG(avg_rating) AS avg_rating,
          SUM(total_count) AS total_count,
          SUM(positive_count) AS positive_count,
          SUM(negative_count) AS negative_count,
          jsonb_agg(top_keywords) AS keywords_arr
        FROM dim_review_summary
        WHERE {where_sql}
        GROUP BY period_start, period_end
        ORDER BY period_start NULLS LAST
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    if not rows:
        return TemplateResult(
            code="review_rating_trend",
            title="评分趋势 + Top 关键词",
            data={},
            applies=False,
            skip_reason="no dim_review_summary rows",
        )

    trend: List[Dict[str, Any]] = []
    all_keyword_arrays: List[Any] = []
    total_reviews = 0
    total_positive = 0
    total_negative = 0
    weighted_rating_num = 0.0
    weighted_rating_den = 0

    for r in rows:
        cnt = int(r["total_count"] or 0)
        avg = float(r["avg_rating"] or 0)
        pos = int(r["positive_count"] or 0)
        neg = int(r["negative_count"] or 0)
        per_top = _aggregate_keywords(r["keywords_arr"], top=10)
        trend.append(
            {
                "period_start": r["period_start"].isoformat() if r["period_start"] else None,
                "period_end": r["period_end"].isoformat() if r["period_end"] else None,
                "avg_rating": round(avg, 2),
                "total_count": cnt,
                "positive_count": pos,
                "negative_count": neg,
                "top_keywords": per_top,
            }
        )
        # extend (not append): r["keywords_arr"] is itself a list (jsonb_agg
        # output), so flattening one level keeps the helper's expected shape.
        kw_val = r["keywords_arr"]
        if isinstance(kw_val, str):
            try:
                kw_val = json.loads(kw_val)
            except (ValueError, TypeError):
                kw_val = []
        if isinstance(kw_val, list):
            all_keyword_arrays.extend(kw_val)
        total_reviews += cnt
        total_positive += pos
        total_negative += neg
        if cnt > 0:
            weighted_rating_num += avg * cnt
            weighted_rating_den += cnt

    overall_avg = (
        round(weighted_rating_num / weighted_rating_den, 2)
        if weighted_rating_den
        else 0.0
    )
    positive_pct = (
        round(total_positive / total_reviews * 100, 2) if total_reviews else 0.0
    )
    negative_pct = (
        round(total_negative / total_reviews * 100, 2) if total_reviews else 0.0
    )

    # flatten + rank across all periods for an overall Top 10
    overall_keywords = _aggregate_keywords(all_keyword_arrays, top=10)

    return TemplateResult(
        code="review_rating_trend",
        title="评分趋势 + Top 关键词",
        data={"trend": trend, "top_keywords": overall_keywords},
        kpis={
            "overall_avg_rating": overall_avg,
            "total_reviews": total_reviews,
            "positive_pct": positive_pct,
            "negative_pct": negative_pct,
            "n_periods": len(trend),
        },
        chart_config={
            "type": "line",
            "x_field": "period_start",
            "y_fields": ["avg_rating"],
            "title": "评分趋势",
        },
        insight_text=(
            f"近期平均评分 {overall_avg} / 5.0，正面占比 {positive_pct:.0f}%。"
        ),
    )
