"""会员 RFM 分析 — W5.4 (经典 SmartBI 客户分群)

设计依据:
  - RFM 模型: Recency (最近消费天数) / Frequency (消费次数) / Monetary (总消费)
  - 三个维度按分位数分 5 档 (1-5), 组合成 5x5x5 = 125 种, 再聚合成 6 大客群:
    - Champions     — 近期高频高消费 (R5/F5/M5 组合)
    - Loyal         — 长期复购 (F>=4, 但 R 不一定最新)
    - New           — 刚注册的新客 (R5, F=1, M 任意)
    - At Risk       — 曾经高消费但最近没来 (R<=2, F>=3, M>=3)
    - Hibernating   — 较久没来, 频次也不高 (R<=2, F<=2)
    - Lost          — 极久未消费 (R=1, F<=2, M<=2)

输入格式 (POS 订单 DataFrame 或 mock):
    orders = [
        {"member_id": "M001", "amount": 280.5, "order_time": "2026-02-01 18:30"},
        ...
    ]

  或直接接收 aggregated form:
    members = [
        {"member_id": "M001", "last_order_days_ago": 12, "order_count": 8, "total_amount": 2800},
    ]

使用示例:
    >>> rfm = MemberRfmAnalyzer()
    >>> report = rfm.analyze_from_orders(orders, as_of="2026-02-28")
    >>> print(report.segment_counts)  # {'Champions': 15, 'Loyal': 32, ...}
    >>> print(report.top_champions[:5])  # top 5 by Monetary
"""
from __future__ import annotations

import logging
import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)


Segment = Literal[
    "Champions",      # 高 R 高 F 高 M — 最佳客户
    "Loyal",          # 高 F — 忠实
    "Potential",      # 中 R 中 F — 有潜力
    "New",            # 高 R 低 F — 新客
    "At Risk",        # 低 R 高 M — 流失风险
    "Hibernating",    # 低 R 低 F — 休眠
    "Lost",           # 极低 R 极低 F — 已流失
]


# ── Data types ──────────────────────────────────────────────


@dataclass
class MemberScore:
    """单个会员 RFM 评分"""
    member_id: str
    recency_days: int           # 最近一次消费距今天数
    frequency: int              # 总订单数
    monetary: float             # 总消费金额

    r_score: int                # 1-5 (5=最近)
    f_score: int                # 1-5 (5=最高频)
    m_score: int                # 1-5 (5=最高消费)

    segment: Segment
    avg_ticket: float           # monetary / frequency

    def to_dict(self) -> dict:
        return {
            "memberId": self.member_id,
            "recencyDays": self.recency_days,
            "frequency": self.frequency,
            "monetary": round(self.monetary, 2),
            "avgTicket": round(self.avg_ticket, 2),
            "rScore": self.r_score,
            "fScore": self.f_score,
            "mScore": self.m_score,
            "segment": self.segment,
        }


@dataclass
class RfmReport:
    """RFM 完整报告"""
    total_members: int
    analyzed_members: int                              # 排除异常后参与分析的
    as_of_date: str
    segment_counts: dict[str, int] = field(default_factory=dict)
    segment_revenue: dict[str, float] = field(default_factory=dict)  # 每个 segment 贡献的总营收

    top_champions: list[MemberScore] = field(default_factory=list)   # TOP 10
    at_risk_members: list[MemberScore] = field(default_factory=list)  # TOP 10 至风险
    members: list[MemberScore] = field(default_factory=list)         # all (可大)

    avg_recency: float = 0.0
    avg_frequency: float = 0.0
    avg_monetary: float = 0.0

    insights: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)  # 分析过程中的警告 (如 quintile fallback)

    def to_dict(self) -> dict:
        return {
            "totalMembers": self.total_members,
            "analyzedMembers": self.analyzed_members,
            "asOfDate": self.as_of_date,
            "segmentCounts": self.segment_counts,
            "segmentRevenue": {k: round(v, 2) for k, v in self.segment_revenue.items()},
            "topChampions": [m.to_dict() for m in self.top_champions],
            "atRiskMembers": [m.to_dict() for m in self.at_risk_members],
            "avgRecency": round(self.avg_recency, 1),
            "avgFrequency": round(self.avg_frequency, 2),
            "avgMonetary": round(self.avg_monetary, 2),
            "insights": self.insights,
            "recommendations": self.recommendations,
            "warnings": self.warnings,
            # 注意: 不返回 all members 以控制 payload 大小
        }


# ── Analyzer ────────────────────────────────────────────────


class MemberRfmAnalyzer:
    """会员 RFM 分析器"""

    # R score 阈值 (天数): 越小越新
    # 低于此分位的 R 得分越高
    _R_QUINTILES_FALLBACK = [7, 14, 30, 60]   # 5/4/3/2/1 分档

    # F score 阈值 (次数): 越多越好
    _F_QUINTILES_FALLBACK = [1, 2, 4, 8]

    # M score 阈值 (金额): 越多越好
    _M_QUINTILES_FALLBACK = [50, 150, 400, 1000]

    def analyze_from_orders(
        self,
        orders: list[dict],
        as_of: Optional[str] = None,
        member_id_key: str = "member_id",
        amount_key: str = "amount",
        order_time_key: str = "order_time",
    ) -> RfmReport:
        """从订单列表聚合再分析

        Args:
            orders: [{member_id, amount, order_time}, ...]
            as_of: "今天" 的日期 (用于算 recency). 默认 max(order_time)
            member_id_key: member id 字段名
            amount_key: 金额字段名
            order_time_key: 订单时间字段名
        """
        if not orders:
            return self._empty("无订单数据")

        # 按 member 聚合
        by_member: dict[str, list[dict]] = {}
        for o in orders:
            mid = o.get(member_id_key)
            if not mid:
                continue
            by_member.setdefault(mid, []).append(o)

        if not by_member:
            return self._empty(f"订单中未找到 {member_id_key} 字段")

        # 算 as_of date
        all_times: list[datetime] = []
        for o in orders:
            dt_raw = o.get(order_time_key)
            if not dt_raw:
                continue
            try:
                dt = self._parse_datetime(dt_raw)
                if dt:
                    all_times.append(dt)
            except Exception:
                continue

        if not all_times:
            return self._empty(f"订单中未找到有效的 {order_time_key}")

        as_of_dt = self._parse_datetime(as_of) if as_of else max(all_times)
        if as_of_dt is None:
            as_of_dt = max(all_times)

        # 转换为 aggregated members
        members_raw: list[dict] = []
        for mid, mem_orders in by_member.items():
            member_times = [
                self._parse_datetime(o.get(order_time_key))
                for o in mem_orders
                if o.get(order_time_key)
            ]
            member_times = [t for t in member_times if t]
            if not member_times:
                continue
            last = max(member_times)
            recency = (as_of_dt - last).days
            freq = len(mem_orders)
            mon = sum(float(o.get(amount_key, 0)) for o in mem_orders)
            members_raw.append(
                {
                    "member_id": mid,
                    "last_order_days_ago": max(0, recency),
                    "order_count": freq,
                    "total_amount": mon,
                }
            )

        return self.analyze(members_raw, as_of_date=as_of_dt.strftime("%Y-%m-%d"))

    def analyze(
        self,
        members: list[dict],
        as_of_date: Optional[str] = None,
    ) -> RfmReport:
        """从已聚合的会员数据直接分析

        Args:
            members: [{member_id, last_order_days_ago, order_count, total_amount}]
        """
        if not members:
            return self._empty("无会员数据")

        total = len(members)
        valid = [
            m for m in members
            if m.get("member_id")
            and m.get("order_count", 0) > 0
            and m.get("total_amount", 0) > 0
        ]
        if not valid:
            return self._empty("所有会员数据无效 (缺字段或 order_count/total_amount 为 0)")

        # 算分位数 (用 quintiles 或 fallback)
        recencies = sorted(m["last_order_days_ago"] for m in valid)
        frequencies = sorted(m["order_count"] for m in valid)
        monetaries = sorted(m["total_amount"] for m in valid)

        # 跟踪哪些维度用了 fallback cutoffs (数据分布退化时警告)
        warnings: list[str] = []
        r_computed = self._compute_quintile_cutoffs(recencies, reverse=True)
        f_computed = self._compute_quintile_cutoffs(frequencies, reverse=False)
        m_computed = self._compute_quintile_cutoffs(monetaries, reverse=False)

        r_cutoffs = r_computed or self._R_QUINTILES_FALLBACK
        f_cutoffs = f_computed or self._F_QUINTILES_FALLBACK
        m_cutoffs = m_computed or self._M_QUINTILES_FALLBACK

        if r_computed is None:
            warnings.append("R (recency) 维度使用默认分位数 — 数据分布过于集中, 分段可能不准确")
        if f_computed is None:
            warnings.append("F (frequency) 维度使用默认分位数 — 数据分布过于集中, 分段可能不准确")
        if m_computed is None:
            warnings.append("M (monetary) 维度使用默认分位数 — 数据分布过于集中, 分段可能不准确")

        # 评分 + 分段
        scores: list[MemberScore] = []
        for m in valid:
            r_score = self._score(m["last_order_days_ago"], r_cutoffs, reverse=True)
            f_score = self._score(m["order_count"], f_cutoffs, reverse=False)
            m_score = self._score(m["total_amount"], m_cutoffs, reverse=False)
            segment = self._classify_segment(r_score, f_score, m_score)
            avg_ticket = m["total_amount"] / m["order_count"]

            scores.append(
                MemberScore(
                    member_id=m["member_id"],
                    recency_days=m["last_order_days_ago"],
                    frequency=m["order_count"],
                    monetary=m["total_amount"],
                    r_score=r_score,
                    f_score=f_score,
                    m_score=m_score,
                    segment=segment,
                    avg_ticket=avg_ticket,
                )
            )

        # 聚合统计
        segment_counts = Counter(s.segment for s in scores)
        segment_revenue: dict[str, float] = {}
        for s in scores:
            segment_revenue[s.segment] = segment_revenue.get(s.segment, 0.0) + s.monetary

        # TOP / risk lists
        top_champions = sorted(
            [s for s in scores if s.segment == "Champions"],
            key=lambda x: -x.monetary,
        )[:10]
        at_risk = sorted(
            [s for s in scores if s.segment == "At Risk"],
            key=lambda x: -x.monetary,
        )[:10]

        avg_recency = statistics.mean(s.recency_days for s in scores)
        avg_frequency = statistics.mean(s.frequency for s in scores)
        avg_monetary = statistics.mean(s.monetary for s in scores)

        insights = self._build_insights(
            len(scores), segment_counts, segment_revenue, avg_recency, avg_monetary
        )
        recommendations = self._build_recommendations(
            segment_counts, top_champions, at_risk
        )

        return RfmReport(
            total_members=total,
            analyzed_members=len(scores),
            as_of_date=as_of_date or date.today().strftime("%Y-%m-%d"),
            segment_counts=dict(segment_counts),
            segment_revenue=segment_revenue,
            top_champions=top_champions,
            at_risk_members=at_risk,
            members=scores,
            avg_recency=avg_recency,
            avg_frequency=avg_frequency,
            avg_monetary=avg_monetary,
            insights=insights,
            recommendations=recommendations,
            warnings=warnings,
        )

    # ── Segmentation logic ──────────────────────────────

    @staticmethod
    def _classify_segment(r: int, f: int, m: int) -> Segment:
        """根据 R/F/M 得分分类 6 大 segment"""
        # Champions: 高 R + 高 F + 高 M (都 >= 4)
        if r >= 4 and f >= 4 and m >= 4:
            return "Champions"

        # New: 最近来过 (R>=4), 但频次低 (F<=2), 金额可高可低
        if r >= 4 and f <= 2:
            return "New"

        # Loyal: 高频 (F>=4), R 中等或高
        if f >= 4 and r >= 3:
            return "Loyal"

        # Potential: 中等 R 中等 F
        if r >= 3 and f >= 3:
            return "Potential"

        # At Risk: R 低 (<=2) + 曾高频高消费 (F>=3, M>=3)
        if r <= 2 and (f >= 3 or m >= 3):
            return "At Risk"

        # Lost: R=1 + F<=2 + M<=2 (流失)
        if r <= 1 and f <= 2 and m <= 2:
            return "Lost"

        # Hibernating: 其他 (R 低, 频次中低, 金额中低)
        return "Hibernating"

    # ── 分位数工具 ──────────────────────────────────────

    @staticmethod
    def _compute_quintile_cutoffs(
        sorted_values: list[float], reverse: bool = False
    ) -> Optional[list[float]]:
        """计算 4 个分位点把样本分 5 档

        Args:
            sorted_values: 已排序
            reverse: True 表示值越小得分越高 (recency)

        Returns:
            [c1, c2, c3, c4] 4 个切点, 或 None (数据不足)
        """
        n = len(sorted_values)
        if n < 5:
            return None

        # 取 20%, 40%, 60%, 80% 分位数
        cutoffs = [
            sorted_values[int(n * 0.20)],
            sorted_values[int(n * 0.40)],
            sorted_values[int(n * 0.60)],
            sorted_values[int(n * 0.80)],
        ]
        # Dedupe (防止所有值相同导致切点相同)
        if len(set(cutoffs)) < 4:
            logger.warning(
                f"_compute_quintile_cutoffs: all cutoffs identical ({cutoffs[0]}), "
                f"falling back to hardcoded values. This usually means the data distribution "
                f"is degenerate (e.g., all members have same order_count). Results may be inaccurate."
            )
            return None
        return cutoffs

    @staticmethod
    def _score(value: float, cutoffs: list[float], reverse: bool = False) -> int:
        """根据值和切点算 1-5 分"""
        if not cutoffs or len(cutoffs) < 4:
            return 3

        if reverse:
            # 值越小越好 (recency)
            if value <= cutoffs[0]:
                return 5
            if value <= cutoffs[1]:
                return 4
            if value <= cutoffs[2]:
                return 3
            if value <= cutoffs[3]:
                return 2
            return 1
        else:
            # 值越大越好 (frequency / monetary)
            if value >= cutoffs[3]:
                return 5
            if value >= cutoffs[2]:
                return 4
            if value >= cutoffs[1]:
                return 3
            if value >= cutoffs[0]:
                return 2
            return 1

    # ── Insights + Recommendations ──────────────────────

    def _build_insights(
        self,
        total: int,
        segment_counts: Counter,
        segment_revenue: dict[str, float],
        avg_recency: float,
        avg_monetary: float,
    ) -> list[str]:
        insights: list[str] = []

        insights.append(
            f"📊 分析 {total} 位会员, 平均 recency={avg_recency:.0f} 天, "
            f"平均总消费 ¥{avg_monetary:.0f}"
        )

        total_revenue = sum(segment_revenue.values()) or 1
        champions = segment_counts.get("Champions", 0)
        champions_rev = segment_revenue.get("Champions", 0)
        if champions > 0:
            insights.append(
                f"🌟 Champions {champions} 人 ({champions / total * 100:.1f}%) "
                f"贡献营收 ¥{champions_rev:,.0f} ({champions_rev / total_revenue * 100:.1f}%)"
            )

        at_risk = segment_counts.get("At Risk", 0)
        at_risk_rev = segment_revenue.get("At Risk", 0)
        if at_risk > 0:
            insights.append(
                f"⚠️ At Risk 客户 {at_risk} 人, 历史贡献 ¥{at_risk_rev:,.0f}, "
                f"若能召回可多留住 {at_risk_rev / total_revenue * 100:.1f}% 营收"
            )

        lost = segment_counts.get("Lost", 0)
        if lost > 0 and lost > total * 0.20:
            insights.append(
                f"🔴 Lost 客户高达 {lost} 人 ({lost / total * 100:.0f}%), "
                f"说明会员运营可能长期失败"
            )

        new_count = segment_counts.get("New", 0)
        if new_count > 0:
            insights.append(
                f"🆕 新客 {new_count} 人, 需要重点培育提升复购"
            )

        return insights

    def _build_recommendations(
        self,
        segment_counts: Counter,
        top_champions: list[MemberScore],
        at_risk: list[MemberScore],
    ) -> list[str]:
        recs: list[str] = []

        if segment_counts.get("Champions", 0) > 0:
            recs.append(
                "📋 Champions 策略: 独家优惠 / VIP 专属菜单 / 生日特权, 防止流失"
            )

        if segment_counts.get("Loyal", 0) > 0:
            recs.append(
                "📋 Loyal 策略: 满减券 / 会员日折扣, 维护粘性"
            )

        if segment_counts.get("New", 0) > 0:
            recs.append(
                "📋 New 策略: 首单返券 / 第 2 单 9 折, 推动首次复购"
            )

        if segment_counts.get("At Risk", 0) > 0:
            recs.append(
                f"📋 At Risk 召回: 针对 {len(at_risk)} 位风险客户发短信 / 高额优惠券 (立减 20-30 元)"
            )

        if segment_counts.get("Hibernating", 0) > 0:
            recs.append(
                "📋 Hibernating 唤醒: 节日问候 + 限时优惠, 测试是否还有复购意愿"
            )

        lost_count = segment_counts.get("Lost", 0)
        if lost_count > 0:
            recs.append(
                f"📋 Lost 复盘: {lost_count} 位已流失客户, 抽样访谈找流失原因 (出品/服务/涨价)"
            )

        return recs

    # ── Helpers ─────────────────────────────────────────

    @staticmethod
    def _parse_datetime(dt_raw: Any) -> Optional[datetime]:
        """解析多种日期格式"""
        if dt_raw is None:
            return None
        if isinstance(dt_raw, datetime):
            return dt_raw
        if isinstance(dt_raw, date):
            return datetime.combine(dt_raw, datetime.min.time())
        if isinstance(dt_raw, str):
            for fmt in (
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d",
                "%Y-%m-%dT%H:%M:%S",
            ):
                try:
                    return datetime.strptime(dt_raw[:19], fmt)
                except ValueError:
                    continue
        return None

    @staticmethod
    def _empty(reason: str) -> RfmReport:
        return RfmReport(
            total_members=0,
            analyzed_members=0,
            as_of_date=date.today().strftime("%Y-%m-%d"),
            insights=[f"数据不足: {reason}"],
            recommendations=[],
        )
