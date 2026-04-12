"""Review competitive: rank own brand against competitors on review metrics."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class ReviewCompetitiveHandler(AbstractSectionHandler):
    section_name = "review_competitive"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        own = p.get("own_brand")
        if not own:
            return self.skipped(request, "未提供 own_brand", started)

        competitors = p.get("competitors", [])
        all_brands = [own] + competitors
        all_brands.sort(key=lambda b: float(b.get("rating", 0)), reverse=True)

        ranking = []
        for i, brand in enumerate(all_brands, 1):
            ranking.append({"rank": i, "name": brand.get("name", ""),
                "rating": float(brand.get("rating", 0)),
                "review_count": int(brand.get("review_count", 0)),
                "avg_ticket": float(brand.get("avg_ticket", 0)),
                "is_own": brand.get("name") == own.get("name")})

        own_rank = next((r["rank"] for r in ranking if r["is_own"]), len(ranking))
        own_rating = float(own.get("rating", 0))
        insights = []

        if own_rank == 1:
            insights.append("恭喜! 在对比品牌中评分排名第一")
        elif own_rank <= 3:
            leader = ranking[0]
            insights.append(f"评分排名第 {own_rank}, 与第一名 {leader['name']} 差 {round(leader['rating'] - own_rating, 1)} 分")
        else:
            insights.append(f"评分排名第 {own_rank}/{len(ranking)}, 需重点关注服务质量")

        own_ticket = float(own.get("avg_ticket", 0))
        if competitors:
            avg_ticket = sum(float(c.get("avg_ticket", 0)) for c in competitors) / len(competitors)
            if own_ticket > avg_ticket * 1.15:
                insights.append(f"客单价 ¥{own_ticket:.0f} 高于竞品均值 ¥{avg_ticket:.0f} — 确保品质匹配定价")
            elif own_ticket < avg_ticket * 0.85:
                insights.append(f"客单价 ¥{own_ticket:.0f} 低于竞品均值 ¥{avg_ticket:.0f} — 有提价空间")

            own_reviews = int(own.get("review_count", 0))
            avg_reviews = sum(int(c.get("review_count", 0)) for c in competitors) / len(competitors)
            if own_reviews < avg_reviews * 0.5:
                insights.append(f"评论数 {own_reviews} 低于竞品均值 {avg_reviews:.0f} — 建议鼓励留评")

        return self.ok(request, data={"ranking": ranking, "own_rank": own_rank,
            "total_brands": len(ranking), "insights": insights}, started=started)
