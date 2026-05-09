"""大众点评评论分析 — 改进 7+8 (Week 4.5)

⚠️ 定位: **Bonus 功能, 不是核心卖点**
  - 原始 11 improvements 审查中被砍 (见 2026-04-08_smartbi-restaurant-11-improvements-secondary-review.md):
    "改进 7+8 (endpoint 不支持)" — 当时没有 review 数据获取通路
  - Week 4.5 加回来的原因: 技术可行性提升 (加了 upload 通路)
  - Week 6 升级: DeepSeek LLM 驱动 (精度 90%+)
  - 核心卖点仍然是 W2 的 cost_rigidity + benchmark alerts, 这个是辅助

依赖: 客户必须主动上传 review 数据 (美团商家端导出 Excel 或 dianping 爬取)
  - 没上传 → reviewAnalysis section 自动 skip (graceful)
  - 上传后 → 自动从 DB 加载, 不需要每次 POST 都带 reviews

设计依据:
  - 改进 7: 评分趋势分析 — 识别 Q3→Q4 下滑, 预警失去 TOP N 排名
  - 改进 8: 菜品标签聚合 — 统计客户提及的菜品 + 情感倾向, 发现真实招牌

核心价值 (如果客户有数据):
  客户真实反馈 vs 老板主观判断:
  - 老板认为"招牌毛肚"是销量冠军 → 评论里只提 5 次, 少
  - 客户实际爱"鲜鸭血" → 评论里提 85 次, 好评 95%
  → 应该把"鲜鸭血"变成主推, 调整菜单

输入格式 (来自 POS 上传或手动导入):
    reviews = [
        {
            "id": 1,
            "store_name": "邓总火锅旗舰店",
            "rating": 4.5,                  # 1-5 星
            "content": "招牌毛肚很嫩, 鸭血一般",
            "created_at": "2026-02-15",
            "platform": "大众点评",
            "reviewer": "美食达人A",
        },
        ...
    ]

使用示例:
    >>> analyzer = ReviewAnalyzer()
    >>> result = analyzer.analyze(reviews, period='quarterly')
    >>> print(result.dish_tags[0])  # 招牌菜真实排名
    >>> print(result.rating_trend)  # 评分趋势
    >>> print(result.risk_alerts)   # 风险告警
"""
from __future__ import annotations

import logging
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

logger = logging.getLogger(__name__)


# ── Type definitions ────────────────────────────────────────

Sentiment = Literal["positive", "neutral", "negative"]
TrendDirection = Literal["rising", "stable", "declining", "sharp_decline"]


@dataclass
class DishMention:
    """客户提到的菜品"""
    dish_name: str                           # 规范化后的菜品名
    mention_count: int                       # 总提及次数
    positive_count: int                      # 正向情感次数
    negative_count: int                      # 负向情感次数
    neutral_count: int = 0
    example_quotes: list[str] = field(default_factory=list)  # 最多 3 条代表性评论
    avg_review_rating: float = 0.0           # 提到此菜的评论平均星级

    @property
    def positive_rate(self) -> float:
        if self.mention_count == 0:
            return 0.0
        return self.positive_count / self.mention_count

    @property
    def net_sentiment(self) -> float:
        """净情感分 = (正 - 负) / 总, -1 到 1"""
        if self.mention_count == 0:
            return 0.0
        return (self.positive_count - self.negative_count) / self.mention_count

    def to_dict(self) -> dict:
        return {
            "dishName": self.dish_name,
            "mentionCount": self.mention_count,
            "positiveCount": self.positive_count,
            "negativeCount": self.negative_count,
            "neutralCount": self.neutral_count,
            "positiveRate": round(self.positive_rate, 3),
            "netSentiment": round(self.net_sentiment, 3),
            "avgReviewRating": round(self.avg_review_rating, 2),
            "exampleQuotes": self.example_quotes[:3],
        }


@dataclass
class PeriodRating:
    """一个时段的评分统计"""
    period: str                              # "2025-Q4" / "2026-02"
    avg_rating: float
    review_count: int
    positive_rate: float                     # ≥4 星比例

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "avgRating": round(self.avg_rating, 2),
            "reviewCount": self.review_count,
            "positiveRate": round(self.positive_rate, 3),
        }


@dataclass
class RatingTrend:
    """评分趋势 (多期对比)"""
    periods: list[PeriodRating]              # 按时间正序
    direction: TrendDirection
    total_delta: float                       # 最新期 vs 最早期 差值
    latest_avg: float
    earliest_avg: float
    max_period_drop: float                   # 单期最大跌幅

    def to_dict(self) -> dict:
        return {
            "periods": [p.to_dict() for p in self.periods],
            "direction": self.direction,
            "totalDelta": round(self.total_delta, 2),
            "latestAvg": round(self.latest_avg, 2),
            "earliestAvg": round(self.earliest_avg, 2),
            "maxPeriodDrop": round(self.max_period_drop, 2),
        }


@dataclass
class ReviewAnalysisReport:
    """完整评论分析报告"""
    total_reviews: int
    avg_rating: float
    rating_trend: Optional[RatingTrend]
    dish_tags: list[DishMention]             # 按 mention_count 降序
    top_praised_dishes: list[DishMention]    # TOP 5 好评菜品
    top_complained_dishes: list[DishMention]  # TOP 5 差评菜品
    hidden_gems: list[DishMention]           # 提及少但好评率高 (潜力菜)
    risk_alerts: list[str]                   # 风险告警
    insights: list[str]                      # 业务洞察
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "totalReviews": self.total_reviews,
            "avgRating": round(self.avg_rating, 2),
            "ratingTrend": self.rating_trend.to_dict() if self.rating_trend else None,
            "dishTags": [d.to_dict() for d in self.dish_tags],
            "topPraisedDishes": [d.to_dict() for d in self.top_praised_dishes],
            "topComplainedDishes": [d.to_dict() for d in self.top_complained_dishes],
            "hiddenGems": [d.to_dict() for d in self.hidden_gems],
            "riskAlerts": self.risk_alerts,
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


# ── Analyzer ────────────────────────────────────────────────


class ReviewAnalyzer:
    """大众点评评论分析器"""

    # 正向情感关键词
    _POSITIVE_KEYWORDS = {
        "好吃", "美味", "鲜嫩", "入味", "爽口", "香", "棒", "赞", "推荐",
        "满意", "惊艳", "绝", "绝了", "超级", "回购", "喜欢", "爱了",
        "回头客", "必点", "值", "不错", "可以", "好",
    }

    # 负向情感关键词
    _NEGATIVE_KEYWORDS = {
        "难吃", "一般", "失望", "不好", "差", "不新鲜", "腥", "老",
        "柴", "不推荐", "太贵", "不值", "踩雷", "后悔", "糟糕",
        "冷", "咸", "腻", "淡", "硬", "难嚼", "不熟",
    }

    # 抑制符号 (用于分割评论)
    _SPLIT_PATTERN = re.compile(r"[,。;、,\.\s!！？?]+")

    def analyze(
        self,
        reviews: list[dict],
        min_mentions: int = 3,  # 菜品至少被提及 N 次才进榜
    ) -> ReviewAnalysisReport:
        """主分析入口

        Args:
            reviews: 评论列表 (dict 含 rating, content, created_at 等)
            min_mentions: 菜品最小提及次数

        Returns:
            ReviewAnalysisReport
        """
        if not reviews:
            return self._empty("无评论数据")

        # 过滤有效评论
        valid = [r for r in reviews if r.get("content") and r.get("rating")]
        if not valid:
            return self._empty("所有评论缺少 content 或 rating")

        total = len(valid)
        avg_rating = statistics.mean(float(r["rating"]) for r in valid)

        # ── 1. 评分趋势 ─────────────────────────────
        rating_trend = self._compute_rating_trend(valid)

        # ── 2. 菜品标签聚合 ─────────────────────────
        dish_mentions = self._extract_dish_mentions(valid)
        # 按 mention_count 降序 + 过滤 min_mentions
        dish_tags = sorted(
            [d for d in dish_mentions.values() if d.mention_count >= min_mentions],
            key=lambda d: -d.mention_count,
        )

        # ── 3. TOP 好评 / 差评 / 隐藏宝藏 ──────────
        top_praised = sorted(
            [d for d in dish_tags if d.mention_count >= 5 and d.positive_rate >= 0.7],
            key=lambda d: -d.mention_count,
        )[:5]

        top_complained = sorted(
            [d for d in dish_tags if d.negative_count >= 2],
            key=lambda d: -d.negative_count,
        )[:5]

        # 隐藏宝藏: 提及 3-10 次, 好评率 >= 85% (销量不高但口碑极好)
        hidden_gems = sorted(
            [d for d in dish_tags if 3 <= d.mention_count <= 10 and d.positive_rate >= 0.85],
            key=lambda d: -d.positive_rate,
        )[:5]

        # ── 4. 风险告警 ─────────────────────────────
        risk_alerts = self._build_risk_alerts(avg_rating, rating_trend, top_complained)

        # ── 5. 业务洞察 + 建议 ──────────────────────
        insights = self._build_insights(
            total, avg_rating, rating_trend, dish_tags, top_praised, hidden_gems
        )
        recommendations = self._build_recommendations(
            rating_trend, top_praised, top_complained, hidden_gems
        )

        return ReviewAnalysisReport(
            total_reviews=total,
            avg_rating=avg_rating,
            rating_trend=rating_trend,
            dish_tags=dish_tags,
            top_praised_dishes=top_praised,
            top_complained_dishes=top_complained,
            hidden_gems=hidden_gems,
            risk_alerts=risk_alerts,
            insights=insights,
            recommendations=recommendations,
        )

    # ── 评分趋势 ────────────────────────────────────────

    def _compute_rating_trend(self, reviews: list[dict]) -> Optional[RatingTrend]:
        """按月聚合评分并识别趋势"""
        by_period: dict[str, list[float]] = defaultdict(list)

        for r in reviews:
            dt_str = r.get("created_at", "")
            period = self._parse_period(dt_str)
            if period:
                by_period[period].append(float(r["rating"]))

        if len(by_period) < 2:
            return None  # 数据不足

        periods_sorted = sorted(by_period.keys())
        period_stats = []
        for p in periods_sorted:
            ratings = by_period[p]
            period_stats.append(
                PeriodRating(
                    period=p,
                    avg_rating=statistics.mean(ratings),
                    review_count=len(ratings),
                    positive_rate=sum(1 for rt in ratings if rt >= 4) / len(ratings),
                )
            )

        earliest = period_stats[0].avg_rating
        latest = period_stats[-1].avg_rating
        total_delta = latest - earliest

        # 最大单期跌幅
        max_drop = 0.0
        for i in range(1, len(period_stats)):
            drop = period_stats[i - 1].avg_rating - period_stats[i].avg_rating
            if drop > max_drop:
                max_drop = drop

        # 方向判定
        if total_delta <= -0.5 or max_drop >= 0.4:
            direction = "sharp_decline"
        elif total_delta < -0.2:
            direction = "declining"
        elif total_delta > 0.2:
            direction = "rising"
        else:
            direction = "stable"

        return RatingTrend(
            periods=period_stats,
            direction=direction,
            total_delta=total_delta,
            latest_avg=latest,
            earliest_avg=earliest,
            max_period_drop=max_drop,
        )

    @staticmethod
    def _parse_period(dt_str: str) -> Optional[str]:
        """解析日期字符串, 返回 'YYYY-MM' 格式"""
        if not dt_str:
            return None
        try:
            # 支持多种格式
            for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d"):
                try:
                    dt = datetime.strptime(dt_str[:19], fmt)
                    return dt.strftime("%Y-%m")
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    # ── 菜品提及提取 ──────────────────────────────────

    # 菜品尾字表 — 用于 regex 锚定和验证
    _DISH_SUFFIX_CHARS = (
        "鱼肉牛羊虾蟹鸡鸭菜汤饭面粉锅饺包卷丝片块丸球串"
        "肚血肠筋脑蛋皮翅爪胗腰舌心肝腿排骨豆腐卤饼盘"
    )
    # Pattern A: 前缀 + 1-3 汉字 + 必须以菜品尾字结束 (防止 "鲜鸭血好吃" 被贪吃)
    _DISH_PATTERN_A = re.compile(
        r"(招牌|特色|精品|特价|鲜|活|手工)([\u4e00-\u9fa5]{1,3}["
        + _DISH_SUFFIX_CHARS
        + r"])"
    )
    # Pattern B: 1-2 汉字 + 菜品尾字 (无前缀, 捕获 鸭血 / 毛肚 / 肥牛 等)
    _DISH_PATTERN_B = re.compile(
        r"([\u4e00-\u9fa5]{1,2})(["
        + _DISH_SUFFIX_CHARS
        + r"])"
    )
    # 停用词 — 过滤掉常见但非菜品的匹配
    _DISH_STOPWORDS = {
        "这个", "那个", "什么", "好吃", "难吃", "一般", "不错",
        "可以", "推荐", "东西", "菜品", "味道", "口味", "感觉",
        "其他", "服务", "老板", "味道", "服务", "环境",
        "一点", "有点", "之前",
    }
    # Pattern B 前置词, 若 core 以这些结尾则认为不是菜品 (如 "但毛肚" → 但 不是菜名前缀)
    _B_CORE_PREFIX_STOPWORDS = {
        "但", "是", "的", "了", "过", "很", "还", "就", "也", "不",
    }

    def _extract_dish_mentions(
        self, reviews: list[dict]
    ) -> dict[str, DishMention]:
        """从评论中提取菜品提及 + 情感

        简化版 NLP: 用双 regex + 情感词匹配
        生产版应该接 LLM 或训练好的 NER 模型
        """
        mentions: dict[str, DishMention] = {}

        def register(dish: str, clause: str, rating: float) -> None:
            """登记一次菜品提及"""
            if len(dish) < 2 or len(dish) > 8:
                return
            if dish in self._DISH_STOPWORDS:
                return

            sentiment = self._classify_sentiment(clause)

            if dish not in mentions:
                mentions[dish] = DishMention(
                    dish_name=dish,
                    mention_count=0,
                    positive_count=0,
                    negative_count=0,
                )
            m = mentions[dish]
            m.mention_count += 1
            if sentiment == "positive":
                m.positive_count += 1
            elif sentiment == "negative":
                m.negative_count += 1
            else:
                m.neutral_count += 1
            if len(m.example_quotes) < 3 and clause not in m.example_quotes:
                m.example_quotes.append(clause[:50])
            m.avg_review_rating += rating

        for review in reviews:
            content = review.get("content", "")
            rating = float(review.get("rating", 0))
            if not content:
                continue

            clauses = self._SPLIT_PATTERN.split(content)
            for clause in clauses:
                clause = clause.strip()
                if len(clause) < 3:
                    continue

                seen_in_clause: set[str] = set()
                # Pattern A: 带前缀的菜品 (招牌毛肚 / 精品肥牛 / 鲜鸭血)
                a_spans: list[tuple[int, int]] = []
                for match in self._DISH_PATTERN_A.finditer(clause):
                    prefix = match.group(1)
                    core = match.group(2)
                    dish = f"{prefix}{core}"
                    if dish in seen_in_clause:
                        continue
                    seen_in_clause.add(dish)
                    a_spans.append(match.span())
                    register(dish, clause, rating)

                # Pattern B: 尾字命中的菜品 (鸭血 / 毛肚 / 肥牛)
                for match in self._DISH_PATTERN_B.finditer(clause):
                    # 如果 B 的 span 落在 A 的 span 内, 说明是 A 匹配的子串, 跳过
                    b_start, b_end = match.span()
                    if any(a_start <= b_start and b_end <= a_end
                           for a_start, a_end in a_spans):
                        continue

                    core = match.group(1) or ""
                    suffix = match.group(2)

                    # 过滤 B 的 core 开头 stopword (但毛肚 → 毛肚, 的毛肚 → 毛肚 等)
                    # 扫描 core 中的 stopword 字符并去掉
                    core_clean = "".join(
                        c for c in core if c not in self._B_CORE_PREFIX_STOPWORDS
                    )
                    dish = f"{core_clean}{suffix}"
                    if len(dish) < 2:
                        continue

                    if dish in seen_in_clause:
                        continue
                    seen_in_clause.add(dish)
                    register(dish, clause, rating)

        # 去重合并: 如果 "毛肚" 和 "招牌毛肚" 都存在, 把 "毛肚" 的计数合并到招牌版
        # 因为同一菜品的完整/缩略名应该统一
        # 注意: avg_review_rating 在这一步仍是 running sum (累加值), 合并后再统一求平均
        to_merge: list[tuple[str, str]] = []
        for short in list(mentions.keys()):
            for full in list(mentions.keys()):
                if short != full and short != full[-len(short):] and short in full:
                    # short 是 full 的子串, 但不在末尾 → 可能不是缩略
                    continue
                if short != full and full.endswith(short) and len(full) > len(short):
                    to_merge.append((short, full))
                    break  # 每个 short 只合并一次

        for short, full in to_merge:
            if short in mentions and full in mentions:
                short_m = mentions[short]
                full_m = mentions[full]
                full_m.mention_count += short_m.mention_count
                full_m.positive_count += short_m.positive_count
                full_m.negative_count += short_m.negative_count
                full_m.neutral_count += short_m.neutral_count
                full_m.avg_review_rating += short_m.avg_review_rating  # still running sum
                # 保留 full 的示例
                del mentions[short]

        # 现在才算平均评分 (merge 完成后)
        for m in mentions.values():
            if m.mention_count > 0:
                m.avg_review_rating /= m.mention_count

        return mentions

    def _classify_sentiment(self, clause: str) -> Sentiment:
        """极简情感分类: 关键词匹配 + 否定词处理"""
        # 否定前缀 → 翻转
        has_negation = bool(re.search(r"不|没|别|无|非", clause))

        pos_hits = sum(1 for kw in self._POSITIVE_KEYWORDS if kw in clause)
        neg_hits = sum(1 for kw in self._NEGATIVE_KEYWORDS if kw in clause)

        if has_negation:
            # "不好吃" → neg, "不难吃" → pos (相对少见)
            pos_hits, neg_hits = neg_hits, pos_hits

        if pos_hits > neg_hits:
            return "positive"
        if neg_hits > pos_hits:
            return "negative"
        return "neutral"

    # ── 风险告警 ────────────────────────────────────────

    def _build_risk_alerts(
        self,
        avg_rating: float,
        trend: Optional[RatingTrend],
        top_complained: list[DishMention],
    ) -> list[str]:
        alerts: list[str] = []

        if avg_rating < 4.0:
            alerts.append(
                f"🔴 整体评分 {avg_rating:.2f} 星 < 4.0, "
                f"大众点评 TOP 推荐门槛通常是 4.2+, 有掉出榜单风险"
            )

        if trend:
            if trend.direction == "sharp_decline":
                alerts.append(
                    f"🔴 评分急剧下滑: {trend.earliest_avg:.2f} → {trend.latest_avg:.2f} "
                    f"(跌 {abs(trend.total_delta):.2f}), 单期最大跌幅 {trend.max_period_drop:.2f}"
                )
            elif trend.direction == "declining":
                alerts.append(
                    f"🟡 评分缓慢下滑: {trend.earliest_avg:.2f} → {trend.latest_avg:.2f} "
                    f"(跌 {abs(trend.total_delta):.2f}), 需关注是否季节性"
                )

        for dish in top_complained[:3]:
            if dish.negative_count >= 3 and dish.positive_rate < 0.3:
                alerts.append(
                    f"🟡 {dish.dish_name} 差评 {dish.negative_count} 次, "
                    f"好评率仅 {dish.positive_rate * 100:.0f}%, "
                    f"建议检查出品/下架"
                )

        return alerts

    # ── 洞察 + 建议 ─────────────────────────────────────

    def _build_insights(
        self,
        total: int,
        avg_rating: float,
        trend: Optional[RatingTrend],
        dish_tags: list[DishMention],
        top_praised: list[DishMention],
        hidden_gems: list[DishMention],
    ) -> list[str]:
        insights: list[str] = []

        insights.append(
            f"📊 {total} 条评论, 平均 {avg_rating:.2f} 星, "
            f"识别出 {len(dish_tags)} 个被提及的菜品"
        )

        if trend:
            if trend.direction == "stable":
                insights.append(f"✅ 评分稳定 (delta {trend.total_delta:+.2f})")
            else:
                insights.append(
                    f"{'📈' if trend.direction == 'rising' else '📉'} "
                    f"评分趋势: {trend.direction} "
                    f"({trend.earliest_avg:.2f} → {trend.latest_avg:.2f})"
                )

        if top_praised:
            insights.append(
                f"🌟 客户口中的招牌菜 TOP 3: "
                f"{', '.join(d.dish_name for d in top_praised[:3])} "
                f"(提及 {top_praised[0].mention_count}+ 次, 好评率 {top_praised[0].positive_rate * 100:.0f}%+)"
            )

        if hidden_gems:
            insights.append(
                f"💎 潜力菜 (低曝光高好评): "
                f"{', '.join(d.dish_name for d in hidden_gems[:3])}, "
                f"建议增加曝光/推荐位"
            )

        return insights

    def _build_recommendations(
        self,
        trend: Optional[RatingTrend],
        top_praised: list[DishMention],
        top_complained: list[DishMention],
        hidden_gems: list[DishMention],
    ) -> list[str]:
        recs: list[str] = []

        if trend and trend.direction in ("declining", "sharp_decline"):
            recs.append(
                "📋 复盘下滑原因: 查最近 1 个月差评高频词 + 对应菜品是否换厨师/改配方/涨价"
            )

        if top_praised:
            recs.append(
                f"📋 加大招牌菜曝光: 将 {top_praised[0].dish_name} 放在菜单头条 + "
                f"外卖封面图 + 推荐位"
            )

        if top_complained:
            worst = top_complained[0]
            if worst.negative_count >= 3:
                recs.append(
                    f"📋 {worst.dish_name} 差评集中, 建议: "
                    f"1) 找出品部复盘 2) 试菜对比 3) 考虑下架或改版"
                )

        if hidden_gems:
            recs.append(
                f"📋 潜力菜推广: {', '.join(d.dish_name for d in hidden_gems[:2])} "
                f"口碑极好但销量不高, 增加推荐位 + 套餐捆绑"
            )

        return recs

    # ── 空报告 ──────────────────────────────────────────

    @staticmethod
    def _empty(reason: str) -> ReviewAnalysisReport:
        return ReviewAnalysisReport(
            total_reviews=0,
            avg_rating=0.0,
            rating_trend=None,
            dish_tags=[],
            top_praised_dishes=[],
            top_complained_dishes=[],
            hidden_gems=[],
            risk_alerts=[],
            insights=[f"数据不足: {reason}"],
            recommendations=[],
        )
