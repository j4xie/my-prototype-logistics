"""多店对比分析 — W6.4

对比同一连锁品牌的多个门店:
  - 营收排名 (per-store revenue)
  - 菜品结构差异 (每店 TOP 5 菜品)
  - 评分对比 (per-store avg rating from reviews)
  - 效率指标 (revenue per item, avg ticket)
  - 找出表现最差的店 + 表现最好的店
  - 异常检测: 某店 revenue 比均值低 30%+ = warning

输入:
  pos_df: POS DataFrame with 门店名称 column
  reviews: list[dict] with store_name (optional)

输出:
  MultiStoreReport — structured report with rankings, anomalies, insights

使用示例:
    >>> comparator = MultiStoreComparator()
    >>> report = comparator.compare(
    ...     pos_df=pos_df,
    ...     revenue_col='实收额',
    ...     product_col='商品名称',
    ...     store_col='门店名称',
    ...     reviews=reviews,
    ... )
    >>> print(report.top_store.store_name, report.top_store.revenue)
    >>> print(report.anomalies)
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger(__name__)


# ── Result types ────────────────────────────────────────────


@dataclass
class StoreProfile:
    """单个门店的汇总 profile"""
    store_name: str
    revenue: float
    order_count: int
    unique_sku_count: int
    avg_ticket: float                    # revenue / order_count
    revenue_per_sku: float               # revenue / unique_sku_count
    rank: int = 0                        # 1 = best
    vs_avg_pct: float = 0.0             # (revenue - avg) / avg, e.g. +0.25 = 25% above avg

    def to_dict(self) -> dict:
        return {
            "storeName": self.store_name,
            "revenue": round(self.revenue, 2),
            "orderCount": self.order_count,
            "uniqueSkuCount": self.unique_sku_count,
            "avgTicket": round(self.avg_ticket, 2),
            "revenuePerSku": round(self.revenue_per_sku, 2),
            "rank": self.rank,
            "vsAvgPct": round(self.vs_avg_pct, 4),
        }


@dataclass
class StoreDifference:
    """某门店与全链平均的偏差"""
    store_name: str
    metric: str                          # revenue / avg_ticket / unique_sku_count / ...
    metric_label: str                    # 中文标签
    value: float
    chain_avg: float
    vs_avg_pct: float                    # (value - avg) / avg

    def to_dict(self) -> dict:
        return {
            "storeName": self.store_name,
            "metric": self.metric,
            "metricLabel": self.metric_label,
            "value": round(self.value, 2),
            "chainAvg": round(self.chain_avg, 2),
            "vsAvgPct": round(self.vs_avg_pct, 4),
        }


@dataclass
class StoreAnomaly:
    """门店异常检测结果"""
    store_name: str
    metric: str
    metric_label: str
    value: float
    expected: float                      # chain average
    deviation_pct: float                 # how far from expected (negative = below)
    severity: str                        # "warning" / "critical"
    message_zh: str

    def to_dict(self) -> dict:
        return {
            "storeName": self.store_name,
            "metric": self.metric,
            "metricLabel": self.metric_label,
            "value": round(self.value, 2),
            "expected": round(self.expected, 2),
            "deviationPct": round(self.deviation_pct, 4),
            "severity": self.severity,
            "messageZh": self.message_zh,
        }


@dataclass
class StoreRatingProfile:
    """门店评分 profile (from reviews)"""
    store_name: str
    avg_rating: float
    review_count: int
    rating_rank: int = 0

    def to_dict(self) -> dict:
        return {
            "storeName": self.store_name,
            "avgRating": round(self.avg_rating, 2),
            "reviewCount": self.review_count,
            "ratingRank": self.rating_rank,
        }


@dataclass
class MultiStoreReport:
    """多店对比完整报告"""
    store_count: int
    total_revenue: float
    avg_revenue: float
    store_rankings: list[StoreProfile]
    top_store: Optional[StoreProfile]
    bottom_store: Optional[StoreProfile]
    store_differences: list[StoreDifference]
    per_store_top_dishes: dict[str, list[dict]]   # store -> [{dish, revenue, pct}]
    per_store_ratings: list[StoreRatingProfile]    # empty if no reviews
    anomalies: list[StoreAnomaly]
    insights: list[str]
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "storeCount": self.store_count,
            "totalRevenue": round(self.total_revenue, 2),
            "avgRevenue": round(self.avg_revenue, 2),
            "storeRankings": [s.to_dict() for s in self.store_rankings],
            "topStore": self.top_store.to_dict() if self.top_store else None,
            "bottomStore": self.bottom_store.to_dict() if self.bottom_store else None,
            "storeDifferences": [d.to_dict() for d in self.store_differences],
            "perStoreTopDishes": {
                store: dishes
                for store, dishes in self.per_store_top_dishes.items()
            },
            "perStoreRatings": [r.to_dict() for r in self.per_store_ratings],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


# ── Main comparator ────────────────────────────────────────


# Anomaly thresholds
_ANOMALY_WARNING_THRESHOLD = -0.30   # 30% below avg
_ANOMALY_CRITICAL_THRESHOLD = -0.50  # 50% below avg
_TOP_DISHES_PER_STORE = 5


class MultiStoreComparator:
    """多门店对比分析器

    Stateless: 每次调用 compare() 独立运行, 无需持久化.
    """

    def compare(
        self,
        pos_df: pd.DataFrame,
        revenue_col: str = "实收",
        product_col: str = "商品名称",
        store_col: str = "门店名称",
        quantity_col: str = "数量",
        reviews: Optional[list[dict]] = None,
    ) -> MultiStoreReport:
        """主入口: 多门店对比分析

        Args:
            pos_df: POS DataFrame, 必须含 store_col 列
            revenue_col: 营收列名
            product_col: 商品名称列名
            store_col: 门店名称列名
            quantity_col: 数量列名 (可选, 用于 order count)
            reviews: 大众点评评论 list (可选)

        Returns:
            MultiStoreReport

        Raises:
            ValueError: 缺少必要列或只有 1 个门店
        """
        # ── 0. 验证 ──
        self._validate_input(pos_df, store_col, revenue_col, product_col)

        # 确保 revenue 列是数值
        pos_df = pos_df.copy()
        pos_df[revenue_col] = pd.to_numeric(pos_df[revenue_col], errors="coerce").fillna(0)

        stores = pos_df[store_col].dropna().unique()
        if len(stores) < 2:
            raise ValueError(
                f"多店对比需要 ≥2 个门店, 当前只有 {len(stores)} 个"
            )

        # ── 1. Per-store aggregation ──
        store_profiles = self._aggregate_stores(
            pos_df, store_col, revenue_col, product_col, quantity_col
        )

        # ── 2. Rankings ──
        store_profiles.sort(key=lambda s: s.revenue, reverse=True)
        for i, sp in enumerate(store_profiles):
            sp.rank = i + 1

        total_revenue = sum(sp.revenue for sp in store_profiles)
        avg_revenue = total_revenue / len(store_profiles) if store_profiles else 0

        # vs_avg_pct
        for sp in store_profiles:
            sp.vs_avg_pct = (sp.revenue - avg_revenue) / avg_revenue if avg_revenue > 0 else 0

        top_store = store_profiles[0] if store_profiles else None
        bottom_store = store_profiles[-1] if store_profiles else None

        # ── 3. Cross-store differences ──
        differences = self._compute_differences(store_profiles)

        # ── 4. Per-store TOP dishes ──
        per_store_top_dishes = self._compute_top_dishes(
            pos_df, store_col, product_col, revenue_col
        )

        # ── 5. Review ratings (optional) ──
        per_store_ratings: list[StoreRatingProfile] = []
        if reviews:
            per_store_ratings = self._compute_review_ratings(reviews, stores)

        # ── 6. Anomaly detection ──
        anomalies = self._detect_anomalies(store_profiles, avg_revenue)

        # ── 7. Insights + recommendations ──
        insights = self._generate_insights(
            store_profiles, avg_revenue, per_store_top_dishes,
            per_store_ratings, anomalies
        )
        recommendations = self._generate_recommendations(
            store_profiles, anomalies, per_store_top_dishes, per_store_ratings
        )

        return MultiStoreReport(
            store_count=len(store_profiles),
            total_revenue=total_revenue,
            avg_revenue=avg_revenue,
            store_rankings=store_profiles,
            top_store=top_store,
            bottom_store=bottom_store,
            store_differences=differences,
            per_store_top_dishes=per_store_top_dishes,
            per_store_ratings=per_store_ratings,
            anomalies=anomalies,
            insights=insights,
            recommendations=recommendations,
        )

    # ── Internal methods ───────────────────────────────────

    def _validate_input(
        self,
        df: pd.DataFrame,
        store_col: str,
        revenue_col: str,
        product_col: str,
    ) -> None:
        missing = [c for c in [store_col, revenue_col, product_col] if c not in df.columns]
        if missing:
            raise ValueError(f"POS DataFrame 缺少列: {missing}")

    def _aggregate_stores(
        self,
        df: pd.DataFrame,
        store_col: str,
        revenue_col: str,
        product_col: str,
        quantity_col: str,
    ) -> list[StoreProfile]:
        """Per-store aggregation: revenue, order_count, unique_sku, avg_ticket"""
        profiles: list[StoreProfile] = []

        for store_name, group in df.groupby(store_col):
            if pd.isna(store_name) or str(store_name).strip() == "":
                continue

            revenue = group[revenue_col].sum()
            order_count = len(group)
            unique_sku = group[product_col].nunique()
            avg_ticket = revenue / order_count if order_count > 0 else 0
            revenue_per_sku = revenue / unique_sku if unique_sku > 0 else 0

            profiles.append(StoreProfile(
                store_name=str(store_name),
                revenue=float(revenue),
                order_count=int(order_count),
                unique_sku_count=int(unique_sku),
                avg_ticket=float(avg_ticket),
                revenue_per_sku=float(revenue_per_sku),
            ))

        return profiles

    def _compute_differences(
        self,
        profiles: list[StoreProfile],
    ) -> list[StoreDifference]:
        """Compute per-store deviations from chain average for key metrics"""
        if not profiles:
            return []

        # Chain averages
        avg_revenue = statistics.mean(p.revenue for p in profiles)
        avg_ticket_mean = statistics.mean(p.avg_ticket for p in profiles)
        avg_sku_count = statistics.mean(p.unique_sku_count for p in profiles)
        avg_order_count = statistics.mean(p.order_count for p in profiles)

        metrics = [
            ("revenue", "营收", avg_revenue, lambda p: p.revenue),
            ("avg_ticket", "客单价", avg_ticket_mean, lambda p: p.avg_ticket),
            ("unique_sku_count", "SKU 数", avg_sku_count, lambda p: p.unique_sku_count),
            ("order_count", "订单数", avg_order_count, lambda p: p.order_count),
        ]

        diffs: list[StoreDifference] = []
        for profile in profiles:
            for metric_key, label, chain_avg, getter in metrics:
                value = getter(profile)
                vs_avg = (value - chain_avg) / chain_avg if chain_avg > 0 else 0
                # Only record notable differences (>10% deviation)
                if abs(vs_avg) > 0.10:
                    diffs.append(StoreDifference(
                        store_name=profile.store_name,
                        metric=metric_key,
                        metric_label=label,
                        value=float(value),
                        chain_avg=float(chain_avg),
                        vs_avg_pct=float(vs_avg),
                    ))

        # Sort by absolute deviation descending
        diffs.sort(key=lambda d: abs(d.vs_avg_pct), reverse=True)
        return diffs

    def _compute_top_dishes(
        self,
        df: pd.DataFrame,
        store_col: str,
        product_col: str,
        revenue_col: str,
    ) -> dict[str, list[dict]]:
        """Per-store TOP N dishes by revenue"""
        result: dict[str, list[dict]] = {}

        for store_name, group in df.groupby(store_col):
            if pd.isna(store_name):
                continue
            store = str(store_name)

            dish_revenue = (
                group.groupby(product_col)[revenue_col]
                .sum()
                .sort_values(ascending=False)
            )
            store_total = dish_revenue.sum()

            top_dishes: list[dict] = []
            for dish, rev in dish_revenue.head(_TOP_DISHES_PER_STORE).items():
                pct = rev / store_total if store_total > 0 else 0
                top_dishes.append({
                    "dish": str(dish),
                    "revenue": round(float(rev), 2),
                    "pctOfStore": round(float(pct), 4),
                })

            result[store] = top_dishes

        return result

    def _compute_review_ratings(
        self,
        reviews: list[dict],
        store_names: Any,
    ) -> list[StoreRatingProfile]:
        """Per-store average rating from reviews

        Matches reviews to POS stores using substring/containment:
        review.store_name "青花椒松江地中海店" matches POS "青花椒松江地中海店"
        """
        from collections import defaultdict

        store_reviews: dict[str, list[float]] = defaultdict(list)

        # Build lookup: strip whitespace for matching
        pos_store_set = {str(s).strip() for s in store_names if not pd.isna(s)}

        for review in reviews:
            r_store = str(review.get("store_name", "")).strip()
            rating = review.get("rating") or review.get("score")
            if not r_store or rating is None:
                continue

            try:
                rating_f = float(rating)
            except (ValueError, TypeError):
                continue

            # Exact match first
            if r_store in pos_store_set:
                store_reviews[r_store].append(rating_f)
                continue

            # Fuzzy: check if review store contains or is contained by POS store
            for pos_store in pos_store_set:
                if pos_store in r_store or r_store in pos_store:
                    store_reviews[pos_store].append(rating_f)
                    break
            else:
                # No match to POS stores — still collect under review store name
                store_reviews[r_store].append(rating_f)

        profiles: list[StoreRatingProfile] = []
        for store, ratings in store_reviews.items():
            if not ratings:
                continue
            profiles.append(StoreRatingProfile(
                store_name=store,
                avg_rating=statistics.mean(ratings),
                review_count=len(ratings),
            ))

        # Rank by avg_rating descending
        profiles.sort(key=lambda p: p.avg_rating, reverse=True)
        for i, p in enumerate(profiles):
            p.rating_rank = i + 1

        return profiles

    def _detect_anomalies(
        self,
        profiles: list[StoreProfile],
        avg_revenue: float,
    ) -> list[StoreAnomaly]:
        """Detect stores significantly below chain average"""
        if not profiles or avg_revenue <= 0:
            return []

        anomalies: list[StoreAnomaly] = []

        # Revenue anomalies
        for p in profiles:
            dev = (p.revenue - avg_revenue) / avg_revenue
            if dev <= _ANOMALY_CRITICAL_THRESHOLD:
                anomalies.append(StoreAnomaly(
                    store_name=p.store_name,
                    metric="revenue",
                    metric_label="营收",
                    value=p.revenue,
                    expected=avg_revenue,
                    deviation_pct=dev,
                    severity="critical",
                    message_zh=(
                        f"{p.store_name} 营收 ¥{p.revenue:,.0f} "
                        f"比全链均值 ¥{avg_revenue:,.0f} 低 {abs(dev)*100:.0f}%, 需重点关注"
                    ),
                ))
            elif dev <= _ANOMALY_WARNING_THRESHOLD:
                anomalies.append(StoreAnomaly(
                    store_name=p.store_name,
                    metric="revenue",
                    metric_label="营收",
                    value=p.revenue,
                    expected=avg_revenue,
                    deviation_pct=dev,
                    severity="warning",
                    message_zh=(
                        f"{p.store_name} 营收 ¥{p.revenue:,.0f} "
                        f"比全链均值低 {abs(dev)*100:.0f}%, 建议排查原因"
                    ),
                ))

        # Avg ticket anomalies
        avg_ticket_mean = statistics.mean(p.avg_ticket for p in profiles)
        if avg_ticket_mean > 0:
            for p in profiles:
                dev = (p.avg_ticket - avg_ticket_mean) / avg_ticket_mean
                if dev <= _ANOMALY_WARNING_THRESHOLD:
                    anomalies.append(StoreAnomaly(
                        store_name=p.store_name,
                        metric="avg_ticket",
                        metric_label="客单价",
                        value=p.avg_ticket,
                        expected=avg_ticket_mean,
                        deviation_pct=dev,
                        severity="warning",
                        message_zh=(
                            f"{p.store_name} 客单价 ¥{p.avg_ticket:.0f} "
                            f"比全链均值 ¥{avg_ticket_mean:.0f} 低 {abs(dev)*100:.0f}%"
                        ),
                    ))

        anomalies.sort(key=lambda a: a.deviation_pct)
        return anomalies

    def _generate_insights(
        self,
        profiles: list[StoreProfile],
        avg_revenue: float,
        per_store_top_dishes: dict[str, list[dict]],
        per_store_ratings: list[StoreRatingProfile],
        anomalies: list[StoreAnomaly],
    ) -> list[str]:
        """Generate human-readable insights in Chinese"""
        if not profiles:
            return []

        insights: list[str] = []
        top = profiles[0]
        bottom = profiles[-1]

        # 1. Revenue spread
        if len(profiles) >= 2:
            spread_ratio = top.revenue / bottom.revenue if bottom.revenue > 0 else float("inf")
            insights.append(
                f"全链 {len(profiles)} 店营收排名: "
                f"冠军 {top.store_name} (¥{top.revenue:,.0f}) vs "
                f"末位 {bottom.store_name} (¥{bottom.revenue:,.0f}), "
                f"极差 {spread_ratio:.1f} 倍"
            )

        # 2. Anomaly count
        critical_count = sum(1 for a in anomalies if a.severity == "critical")
        warning_count = sum(1 for a in anomalies if a.severity == "warning")
        if critical_count > 0:
            insights.append(
                f"发现 {critical_count} 家门店营收严重偏低 (低于均值 50%+), 需立即干预"
            )
        elif warning_count > 0:
            insights.append(
                f"发现 {warning_count} 家门店指标偏低 (低于均值 30%+), 建议排查"
            )
        else:
            insights.append("各门店营收分布均匀, 无明显异常")

        # 3. Menu overlap analysis
        if len(per_store_top_dishes) >= 2:
            # Find common top dishes across stores
            all_tops: list[set[str]] = []
            for dishes in per_store_top_dishes.values():
                all_tops.append({d["dish"] for d in dishes})
            if all_tops:
                common = all_tops[0]
                for s in all_tops[1:]:
                    common = common & s
                if common:
                    insights.append(
                        f"全链共同 TOP 菜品: {', '.join(sorted(common)[:5])} — 核心品类一致性好"
                    )
                else:
                    insights.append(
                        "各店 TOP 5 菜品无交集, 菜品结构差异大, 建议统一核心品类"
                    )

        # 4. Rating vs revenue correlation
        if per_store_ratings and len(per_store_ratings) >= 3:
            top_rated = per_store_ratings[0]
            insights.append(
                f"评分最高: {top_rated.store_name} "
                f"({top_rated.avg_rating:.1f} 分, {top_rated.review_count} 条评论)"
            )

        # 5. SKU efficiency
        sku_efficiencies = [(p.store_name, p.revenue_per_sku) for p in profiles]
        sku_efficiencies.sort(key=lambda x: x[1], reverse=True)
        most_efficient = sku_efficiencies[0]
        least_efficient = sku_efficiencies[-1]
        if most_efficient[1] > 0 and least_efficient[1] > 0:
            eff_ratio = most_efficient[1] / least_efficient[1]
            if eff_ratio > 1.5:
                insights.append(
                    f"SKU 效率差异显著: {most_efficient[0]} "
                    f"(¥{most_efficient[1]:,.0f}/SKU) vs {least_efficient[0]} "
                    f"(¥{least_efficient[1]:,.0f}/SKU), 差 {eff_ratio:.1f} 倍"
                )

        return insights

    def _generate_recommendations(
        self,
        profiles: list[StoreProfile],
        anomalies: list[StoreAnomaly],
        per_store_top_dishes: dict[str, list[dict]],
        per_store_ratings: list[StoreRatingProfile],
    ) -> list[str]:
        """Generate actionable recommendations"""
        if not profiles:
            return []

        recs: list[str] = []
        top = profiles[0]
        bottom = profiles[-1]

        # 1. Underperformer action
        critical_stores = [a.store_name for a in anomalies if a.severity == "critical"]
        if critical_stores:
            recs.append(
                f"重点整改: {', '.join(critical_stores)} — "
                f"建议派驻督导, 对标冠军店 {top.store_name} 的运营 SOP"
            )

        # 2. Menu replication
        top_dishes = per_store_top_dishes.get(top.store_name, [])
        if top_dishes and bottom.store_name in per_store_top_dishes:
            bottom_dishes = {d["dish"] for d in per_store_top_dishes[bottom.store_name]}
            top_only = [d["dish"] for d in top_dishes if d["dish"] not in bottom_dishes]
            if top_only:
                recs.append(
                    f"菜单复制: 冠军店 {top.store_name} 的热门菜品 "
                    f"({', '.join(top_only[:3])}) 在末位店 {bottom.store_name} 缺失, "
                    f"建议引入"
                )

        # 3. SKU optimization for inefficient stores
        avg_sku = statistics.mean(p.unique_sku_count for p in profiles)
        bloated_stores = [
            p for p in profiles
            if p.unique_sku_count > avg_sku * 1.3 and p.rank > len(profiles) // 2
        ]
        if bloated_stores:
            names = ", ".join(p.store_name for p in bloated_stores[:3])
            recs.append(
                f"精简菜单: {names} SKU 数高于均值 30%+ 但营收排名靠后, "
                f"建议砍长尾 SKU 降低运营复杂度"
            )

        # 4. Rating-based action
        if per_store_ratings:
            low_rated = [r for r in per_store_ratings if r.avg_rating < 4.0]
            if low_rated:
                names = ", ".join(r.store_name for r in low_rated[:3])
                recs.append(
                    f"口碑提升: {names} 评分低于 4.0, "
                    f"建议重点改善服务和菜品质量"
                )

        # 5. Best practice sharing
        if len(profiles) >= 3 and not critical_stores:
            recs.append(
                f"标杆分享: 组织 {top.store_name} 店长分享会, "
                f"重点推广其客单价 ¥{top.avg_ticket:.0f} 的提升策略"
            )

        if not recs:
            recs.append("各门店表现均衡, 继续保持并关注季度趋势变化")

        return recs
