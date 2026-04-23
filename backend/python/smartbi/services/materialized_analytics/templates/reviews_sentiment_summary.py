"""ReviewsSentimentSummary — 大众点评/美团评价下载分析.

Triggered by review exports (评价下载 xlsx) with columns 星级分 / 口味分 /
环境分 / 服务分 / 评价详情 / 评价门店 / 投诉状态.

Outputs:
  - 评价总数 + 平均星级 / 口味 / 环境 / 服务
  - 星级分布 (5/4/3/2/1 星 buckets)
  - Top/Bottom 门店 by 平均星级
  - 投诉率 + VIP 评价占比
  - 趋势 by month (if 评价时间 date present)

Applies when schema has 评价 OR 星级 column.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant import industry_benchmarks as bench
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_STAR_CANDIDATES = ("星级分", "评分", "星级")
_TASTE_CANDIDATES = ("口味分", "口味")
_ENV_CANDIDATES = ("环境分", "环境")
_SERVICE_CANDIDATES = ("服务分", "服务")
_STORE_CANDIDATES = ("评价门店", "门店名称", "店铺名称")
_REVIEW_TIME_CANDIDATES = ("评价时间", "评论时间")
_CONTENT_CANDIDATES = ("评价详情", "评价内容")
_VIP_CANDIDATES = ("是否vip", "是否VIP", "VIP")
_COMPLAINT_CANDIDATES = ("投诉状态", "投诉")
_PLATFORM_CANDIDATES = ("平台", "评价来源")

_TOP_N = 10


def _first(cols, candidates):
    col_set = set(cols)
    for c in candidates:
        if c in col_set:
            return c
    return None


@register
class ReviewsSentimentSummary(AnalysisTemplate):

    sample_queries = [
        "评价分析",
        "大众点评口碑",
        "星级分布",
        "好评差评比例",
        "评分统计",
        "投诉多不多",
    ]

    @property
    def code(self) -> str:
        return "reviews_sentiment_summary"

    @property
    def title(self) -> str:
        return "评价数据汇总 (星级 / 投诉 / 门店)"

    def applies(self, schema: DataSchema) -> bool:
        names = {f.name for f in schema.fields}
        return _first(names, _STAR_CANDIDATES) is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        star_col = _first(cols, _STAR_CANDIDATES)
        taste_col = _first(cols, _TASTE_CANDIDATES)
        env_col = _first(cols, _ENV_CANDIDATES)
        svc_col = _first(cols, _SERVICE_CANDIDATES)
        store_col = _first(cols, _STORE_CANDIDATES)
        time_col = _first(cols, _REVIEW_TIME_CANDIDATES)
        vip_col = _first(cols, _VIP_CANDIDATES)
        complaint_col = _first(cols, _COMPLAINT_CANDIDATES)
        platform_col = _first(cols, _PLATFORM_CANDIDATES)

        if star_col is None:
            return TemplateResult(code=self.code, title=self.title, data={},
                applies=False, skip_reason="no 星级 column")

        total = df.height

        def _avg(col):
            if col is None:
                return None
            try:
                v = df.select(pl.col(col).cast(pl.Float64, strict=False).mean()).item()
                return round(float(v), 2) if v is not None else None
            except Exception:
                return None

        avg_star = _avg(star_col)
        avg_taste = _avg(taste_col)
        avg_env = _avg(env_col)
        avg_svc = _avg(svc_col)

        # Star distribution (round to nearest int for bucketing)
        star_dist: List[Dict[str, Any]] = []
        star_series = df.select(
            pl.col(star_col).cast(pl.Float64, strict=False).round(0).alias("_star")
        )
        star_rows = (
            star_series
            .filter(pl.col("_star").is_not_null())
            .group_by("_star").agg(pl.len().alias("count"))
            .sort("_star", descending=True).to_dicts()
        )
        for r in star_rows:
            s = int(r["_star"])
            cnt = int(r["count"])
            star_dist.append({
                "star": s, "count": cnt,
                "share_pct": round(cnt / total * 100, 2) if total else 0.0,
            })

        # Top stores by review count + avg rating (require ≥5 reviews to filter noise)
        top_stores: List[Dict[str, Any]] = []
        worst_stores: List[Dict[str, Any]] = []
        if store_col:
            rows = (
                df.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg([
                    pl.len().alias("reviews"),
                    pl.col(star_col).cast(pl.Float64, strict=False).mean().alias("avg_star"),
                ])
                .filter(pl.col("reviews") >= 5)
                .sort("reviews", descending=True)
                .head(_TOP_N)
                .to_dicts()
            )
            top_stores = [
                {
                    "store": str(r.get(store_col) or "<空>"),
                    "reviews": int(r["reviews"]),
                    "avg_star": round(float(r["avg_star"] or 0.0), 2),
                }
                for r in rows
            ]
            rows_bad = (
                df.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg([
                    pl.len().alias("reviews"),
                    pl.col(star_col).cast(pl.Float64, strict=False).mean().alias("avg_star"),
                ])
                .filter(pl.col("reviews") >= 5)
                .sort("avg_star")
                .head(_TOP_N)
                .to_dicts()
            )
            worst_stores = [
                {
                    "store": str(r.get(store_col) or "<空>"),
                    "reviews": int(r["reviews"]),
                    "avg_star": round(float(r["avg_star"] or 0.0), 2),
                }
                for r in rows_bad
            ]

        # Complaint rate
        complaint_rate_pct = None
        complaint_count = 0
        if complaint_col:
            complaint_count = df.filter(
                pl.col(complaint_col).cast(pl.Utf8, strict=False).is_not_null()
                & (pl.col(complaint_col).cast(pl.Utf8, strict=False).str.strip_chars() != "")
                & (pl.col(complaint_col).cast(pl.Utf8, strict=False) != "无")
            ).height
            complaint_rate_pct = round(complaint_count / total * 100, 2) if total else 0.0

        # VIP rate
        vip_rate_pct = None
        if vip_col:
            vip_count = df.filter(
                pl.col(vip_col).cast(pl.Utf8, strict=False).is_in(["是", "1", "true", "True", "yes"])
            ).height
            vip_rate_pct = round(vip_count / total * 100, 2) if total else 0.0

        # Monthly trend
        by_month: List[Dict[str, Any]] = []
        if time_col:
            rows = (
                df.filter(pl.col(time_col).is_not_null())
                .with_columns(
                    pl.col(time_col).cast(pl.Utf8, strict=False).str.slice(0, 7).alias("_ym")
                )
                .group_by("_ym")
                .agg([
                    pl.len().alias("reviews"),
                    pl.col(star_col).cast(pl.Float64, strict=False).mean().alias("avg_star"),
                ])
                .sort("_ym").to_dicts()
            )
            by_month = [
                {
                    "month": str(r.get("_ym") or ""),
                    "reviews": int(r["reviews"]),
                    "avg_star": round(float(r["avg_star"] or 0.0), 2),
                }
                for r in rows
            ]

        # Platform share
        by_platform: List[Dict[str, Any]] = []
        if platform_col:
            rows = (
                df.filter(pl.col(platform_col).is_not_null())
                .group_by(platform_col)
                .agg(pl.len().alias("reviews"))
                .sort("reviews", descending=True).to_dicts()
            )
            by_platform = [
                {
                    "platform": str(r.get(platform_col) or "<空>"),
                    "reviews": int(r["reviews"]),
                    "share_pct": round(r["reviews"] / total * 100, 2) if total else 0.0,
                }
                for r in rows
            ]

        # Per-store 点评榜单资格 eligibility per 点评榜单规则:
        #   - 好评/口味/环境/服务榜 require 星级总分 >= 4.0, 总评价 >= 50, 近30天新增 >= 1
        #   - 热门/销量/打卡榜 require 星级总分 >= 3.5, 总评价 >= 50
        #   - 必吃榜 requires 365-day collection + 182+ active days + 口味分位居前列
        # We approximate by marking stores that already pass the star+review-count bar.
        ranking_qualified: List[Dict[str, Any]] = []
        if store_col and top_stores:
            # Need ALL stores' (not just top N) aggregates for eligibility
            all_stores_rows = (
                df.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg([
                    pl.len().alias("reviews"),
                    pl.col(star_col).cast(pl.Float64, strict=False).mean().alias("avg_star"),
                    *([pl.col(taste_col).cast(pl.Float64, strict=False).mean().alias("avg_taste")]
                      if taste_col else []),
                ])
                .to_dicts()
            )
            for r in all_stores_rows:
                s_name = str(r.get(store_col) or "")
                reviews_n = int(r["reviews"])
                avg_s = float(r["avg_star"] or 0.0)
                avg_t = float(r.get("avg_taste") or 0.0) if taste_col else 0.0
                quality_eligible = (
                    avg_s >= bench.QUALITY_RANKING_MIN_STAR
                    and reviews_n >= bench.QUALITY_RANKING_MIN_REVIEWS
                )
                popular_eligible = (
                    avg_s >= bench.POPULAR_RANKING_MIN_STAR
                    and reviews_n >= bench.QUALITY_RANKING_MIN_REVIEWS
                )
                must_eat_candidate = (
                    quality_eligible
                    and (avg_t >= bench.MUST_EAT_TASTE_THRESHOLD if taste_col else False)
                )
                # 黑珍珠 candidate (per 黑珍珠.docx — 3-钻 approximation)
                black_pearl_candidate = (
                    avg_s >= bench.BLACK_PEARL_MIN_STAR
                    and reviews_n >= bench.BLACK_PEARL_MIN_REVIEWS
                    and (avg_t >= bench.BLACK_PEARL_MIN_TASTE if taste_col else False)
                )
                ranking_qualified.append({
                    "store": s_name,
                    "reviews": reviews_n,
                    "avg_star": round(avg_s, 2),
                    "avg_taste": round(avg_t, 2) if taste_col else None,
                    "quality_ranking_eligible": quality_eligible,
                    "popular_ranking_eligible": popular_eligible,
                    "must_eat_candidate": must_eat_candidate,
                    "black_pearl_candidate": black_pearl_candidate,
                })

        quality_eligible_count = sum(1 for x in ranking_qualified if x["quality_ranking_eligible"])
        popular_eligible_count = sum(1 for x in ranking_qualified if x["popular_ranking_eligible"])
        must_eat_candidate_count = sum(1 for x in ranking_qualified if x["must_eat_candidate"])
        black_pearl_candidate_count = sum(1 for x in ranking_qualified if x["black_pearl_candidate"])

        # Insight
        parts = [f"期内共 {total:,} 条评价，平均星级 {avg_star:.2f}。"]
        if avg_taste and avg_env and avg_svc:
            parts.append(f"口味 {avg_taste}/环境 {avg_env}/服务 {avg_svc}。")
        if worst_stores and top_stores and worst_stores[0]["avg_star"] < top_stores[0]["avg_star"]:
            w = worst_stores[0]
            parts.append(
                f"最低评分门店:{w['store']} {w['avg_star']:.2f} 星 ({w['reviews']} 条)。"
            )
        if complaint_rate_pct is not None and complaint_rate_pct > 0:
            parts.append(f"投诉率 {complaint_rate_pct:.1f}% ({complaint_count} 条)。")
        if vip_rate_pct is not None:
            parts.append(f"VIP 评价占比 {vip_rate_pct:.1f}%。")
        if ranking_qualified:
            parts.append(
                f"📊 点评榜单:{quality_eligible_count} 家达到好评榜准入门槛 (≥4.0 星 & ≥50 条),"
                f"{popular_eligible_count} 家达到热门榜门槛 (≥3.5 星)"
            )
            if must_eat_candidate_count > 0:
                parts[-1] += f",{must_eat_candidate_count} 家口味出众可冲必吃榜"
            if black_pearl_candidate_count > 0:
                parts[-1] += f",💎 {black_pearl_candidate_count} 家已达黑珍珠 3-钻初选资格"
            parts[-1] += "。"
        parts.append(bench.industry_footer_by_context("review"))
        insight_text = " ".join(parts)

        # Chart — star distribution pie
        chart_config = None
        if star_dist:
            chart_config = {
                "type": "pie",
                "title": {"text": "评价星级分布", "left": "center"},
                "tooltip": {"trigger": "item", "formatter": "{b} 星: {c} 条 ({d}%)"},
                "series": [{
                    "name": "评价", "type": "pie", "radius": ["30%", "65%"],
                    "data": [
                        {"name": f"{s['star']} 星", "value": s["count"]}
                        for s in star_dist if s["count"] > 0
                    ],
                }],
            }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "total_reviews": total,
                "avg_star": avg_star, "avg_taste": avg_taste,
                "avg_env": avg_env, "avg_service": avg_svc,
                "star_distribution": star_dist,
                "top_stores": top_stores, "worst_stores": worst_stores,
                "complaint_count": complaint_count,
                "complaint_rate_pct": complaint_rate_pct,
                "vip_rate_pct": vip_rate_pct,
                "by_month": by_month, "by_platform": by_platform,
                "ranking_eligibility": ranking_qualified,
                "quality_ranking_eligible_count": quality_eligible_count,
                "popular_ranking_eligible_count": popular_eligible_count,
                "must_eat_candidate_count": must_eat_candidate_count,
                "black_pearl_candidate_count": black_pearl_candidate_count,
            },
            chart_config=chart_config,
            kpis={
                "total_reviews": total, "avg_star": avg_star,
                "complaint_rate_pct": complaint_rate_pct,
                "worst_store": worst_stores[0]["store"] if worst_stores else None,
                "worst_store_avg_star": worst_stores[0]["avg_star"] if worst_stores else None,
                "quality_ranking_eligible_count": quality_eligible_count,
                "must_eat_candidate_count": must_eat_candidate_count,
                "black_pearl_candidate_count": black_pearl_candidate_count,
            },
            insight_text=insight_text,
        )
