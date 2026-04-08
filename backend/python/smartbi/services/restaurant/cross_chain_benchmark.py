"""跨连锁竞品对比 — W6.5

把多个连锁品牌放在一起比:
  - 人均客单 (avg ticket per brand)
  - SKU 数量 (menu complexity)
  - TOP 品类分布 (哪家偏肉类, 哪家偏海鲜)
  - 价格带分布 (低价位 <20 / 中 20-60 / 高 60+ 占比)
  - 菜品重叠度 (哪些菜多家都有 — 竞争红海)

输入:
  chains: list of ChainInput(name, sub_sector, upload_id)

输出:
  CrossChainReport (dataclass) — chain_profiles, price_bands,
  category_distribution, common_dishes, insights, recommendations
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# ── Column name constants ──────────────────────────────────────
COL_REVENUE = "实收"
COL_CATEGORY = "商品分类"
COL_SKU_NAME = "商品名称"
COL_UNIT_PRICE = "销售单价"
COL_SALES_AMOUNT = "销售金额"
COL_DISCOUNTED = "折后金额"
COL_STORE = "门店名称"
COL_QTY = "单卖数量(不含套餐子商品)"
COL_QTY_WITH_COMBO = "数量(含套餐子商品)"

# Price band thresholds (元)
PRICE_LOW = 20
PRICE_HIGH = 60


# ── Data classes ───────────────────────────────────────────────

@dataclass
class ChainInput:
    """One chain to benchmark."""
    name: str
    sub_sector: str
    upload_id: int
    df: Optional[pd.DataFrame] = None  # loaded lazily


@dataclass
class ChainProfile:
    """Per-chain summary metrics."""
    name: str
    sub_sector: str
    total_revenue: float
    sku_count: int
    store_count: int
    avg_ticket: float          # avg unit price weighted by quantity
    top_category: str          # category with highest revenue
    top_category_pct: float    # that category's share of total revenue

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "subSector": self.sub_sector,
            "totalRevenue": round(self.total_revenue, 2),
            "skuCount": self.sku_count,
            "storeCount": self.store_count,
            "avgTicket": round(self.avg_ticket, 2),
            "topCategory": self.top_category,
            "topCategoryPct": round(self.top_category_pct, 4),
        }


@dataclass
class PriceBand:
    """Per-chain price band distribution (by SKU count share)."""
    chain: str
    low_pct: float    # <20 yuan
    mid_pct: float    # 20-60 yuan
    high_pct: float   # 60+ yuan
    median_price: float

    def to_dict(self) -> dict:
        return {
            "chain": self.chain,
            "lowPct": round(self.low_pct, 4),
            "midPct": round(self.mid_pct, 4),
            "highPct": round(self.high_pct, 4),
            "medianPrice": round(self.median_price, 2),
        }


@dataclass
class CommonDish:
    """A dish found in 2+ chains."""
    dish: str
    chains_with_it: list[str]
    min_price: float
    max_price: float
    avg_price: float

    def to_dict(self) -> dict:
        return {
            "dish": self.dish,
            "chainsWithIt": self.chains_with_it,
            "chainCount": len(self.chains_with_it),
            "minPrice": round(self.min_price, 2),
            "maxPrice": round(self.max_price, 2),
            "avgPrice": round(self.avg_price, 2),
        }


@dataclass
class CrossChainReport:
    """Full benchmark report across chains."""
    chain_profiles: list[ChainProfile]
    price_bands: list[PriceBand]
    category_distribution: list[dict]   # [{chain, categories: {cat: pct}}]
    common_dishes: list[CommonDish]
    insights: list[str]
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "chainProfiles": [p.to_dict() for p in self.chain_profiles],
            "priceBands": [b.to_dict() for b in self.price_bands],
            "categoryDistribution": self.category_distribution,
            "commonDishes": [d.to_dict() for d in self.common_dishes],
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


# ── Helpers ────────────────────────────────────────────────────

_STRIP_RE = re.compile(r"[#＃\s]+")
_PORTION_RE = re.compile(
    r"[(\[（【]"
    r"(?:单人份|[0-9]+-?[0-9]*人份|小份|中份|大份|微辣|微麻微辣|中辣|特辣|"
    r"一吃|两吃|三吃|活鱼现做|手工去刺|小心鱼刺)"
    r"[)\]）】]",
)


def _normalize_dish_name(name: str) -> str:
    """Normalize a dish name for cross-chain matching."""
    if not name or not isinstance(name, str):
        return ""
    s = _STRIP_RE.sub("", name).strip()
    s = _PORTION_RE.sub("", s).strip()
    return s.lower()


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Convert to float safely."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# ── Main class ─────────────────────────────────────────────────

class CrossChainBenchmark:
    """Cross-chain competitive benchmark analyzer.

    Usage:
        >>> chains = [
        ...     ChainInput("青花椒", "鱼类餐饮", 383),
        ...     ChainInput("永和豆浆", "快餐", 388),
        ... ]
        >>> bench = CrossChainBenchmark()
        >>> report = bench.analyze(chains, db_session=db)
        >>> print(report.insights)
    """

    def analyze(
        self,
        chains: list[ChainInput],
        db_session=None,
    ) -> CrossChainReport:
        """Run full benchmark.

        Args:
            chains: list of ChainInput; if df is None, loads from DB.
            db_session: SQLAlchemy session (required if any df is None).
        """
        # 1. Load data
        for c in chains:
            if c.df is None:
                if db_session is None:
                    raise ValueError(f"Chain '{c.name}' has no df and no db_session provided")
                c.df = self._load_from_db(c.upload_id, db_session)
                logger.info(f"Loaded {len(c.df)} rows for {c.name} (upload {c.upload_id})")

        # 2. Build per-chain profiles
        profiles = [self._build_profile(c) for c in chains]

        # 3. Price band analysis
        price_bands = [self._price_band(c) for c in chains]

        # 4. Category distribution
        cat_dist = [self._category_distribution(c) for c in chains]

        # 5. Common dishes across chains
        common = self._find_common_dishes(chains)

        # 6. Generate insights + recommendations
        insights = self._generate_insights(profiles, price_bands, common)
        recommendations = self._generate_recommendations(profiles, price_bands, cat_dist, common)

        return CrossChainReport(
            chain_profiles=profiles,
            price_bands=price_bands,
            category_distribution=cat_dist,
            common_dishes=common,
            insights=insights,
            recommendations=recommendations,
        )

    # ── Data loading ───────────────────────────────────────────

    def _load_from_db(self, upload_id: int, db_session) -> pd.DataFrame:
        """Load upload data from smartbi_db."""
        from smartbi.database.models import SmartBiDynamicData

        rows = (
            db_session.query(SmartBiDynamicData.row_data)
            .filter(SmartBiDynamicData.upload_id == upload_id)
            .all()
        )
        if not rows:
            raise ValueError(f"No data found for upload_id={upload_id}")
        df = pd.DataFrame([r[0] for r in rows])
        # Coerce numeric columns
        for col in [COL_REVENUE, COL_UNIT_PRICE, COL_SALES_AMOUNT,
                    COL_DISCOUNTED, COL_QTY, COL_QTY_WITH_COMBO]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        return df

    # ── Per-chain profile ──────────────────────────────────────

    def _build_profile(self, chain: ChainInput) -> ChainProfile:
        df = chain.df
        total_revenue = df[COL_REVENUE].sum() if COL_REVENUE in df.columns else 0.0

        # SKU count = unique normalized dish names
        if COL_SKU_NAME in df.columns:
            sku_names = df[COL_SKU_NAME].dropna().unique()
            sku_count = len(sku_names)
        else:
            sku_count = 0

        # Store count
        store_count = df[COL_STORE].nunique() if COL_STORE in df.columns else 1

        # Avg ticket = weighted average unit price (revenue / quantity)
        qty_col = COL_QTY_WITH_COMBO if COL_QTY_WITH_COMBO in df.columns else COL_QTY
        total_qty = df[qty_col].sum() if qty_col in df.columns else 0.0
        avg_ticket = total_revenue / total_qty if total_qty > 0 else 0.0

        # Top category by revenue
        top_category = ""
        top_category_pct = 0.0
        if COL_CATEGORY in df.columns and total_revenue > 0:
            cat_rev = df.groupby(COL_CATEGORY)[COL_REVENUE].sum()
            if len(cat_rev) > 0:
                top_cat = cat_rev.idxmax()
                top_category = str(top_cat)
                top_category_pct = cat_rev[top_cat] / total_revenue

        return ChainProfile(
            name=chain.name,
            sub_sector=chain.sub_sector,
            total_revenue=total_revenue,
            sku_count=sku_count,
            store_count=store_count,
            avg_ticket=avg_ticket,
            top_category=top_category,
            top_category_pct=top_category_pct,
        )

    # ── Price band ─────────────────────────────────────────────

    def _price_band(self, chain: ChainInput) -> PriceBand:
        df = chain.df
        if COL_UNIT_PRICE not in df.columns:
            return PriceBand(chain.name, 0, 0, 0, 0)

        # Get unique SKU prices (average price per SKU name)
        sku_prices = (
            df.dropna(subset=[COL_UNIT_PRICE, COL_SKU_NAME])
            .groupby(COL_SKU_NAME)[COL_UNIT_PRICE]
            .mean()
        )
        if len(sku_prices) == 0:
            return PriceBand(chain.name, 0, 0, 0, 0)

        total = len(sku_prices)
        low = (sku_prices < PRICE_LOW).sum() / total
        mid = ((sku_prices >= PRICE_LOW) & (sku_prices < PRICE_HIGH)).sum() / total
        high = (sku_prices >= PRICE_HIGH).sum() / total
        median = float(sku_prices.median())

        return PriceBand(chain.name, low, mid, high, median)

    # ── Category distribution ──────────────────────────────────

    def _category_distribution(self, chain: ChainInput) -> dict:
        df = chain.df
        result: Dict[str, float] = {}
        if COL_CATEGORY in df.columns and COL_REVENUE in df.columns:
            cat_rev = df.groupby(COL_CATEGORY)[COL_REVENUE].sum()
            total = cat_rev.sum()
            if total > 0:
                for cat, rev in cat_rev.items():
                    result[str(cat)] = round(rev / total, 4)
        return {"chain": chain.name, "categories": result}

    # ── Common dishes ──────────────────────────────────────────

    def _find_common_dishes(self, chains: list[ChainInput]) -> list[CommonDish]:
        """Find dish names appearing in 2+ chains (normalized matching)."""
        # Build: normalized_name -> {chain_name: [prices]}
        dish_map: Dict[str, Dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

        for c in chains:
            if COL_SKU_NAME not in c.df.columns:
                continue
            sku_data = c.df.dropna(subset=[COL_SKU_NAME])
            for _, row in sku_data.iterrows():
                raw_name = str(row[COL_SKU_NAME])
                norm = _normalize_dish_name(raw_name)
                if not norm or len(norm) < 2:
                    continue
                price = _safe_float(row.get(COL_UNIT_PRICE, 0))
                if price > 0:
                    dish_map[norm][c.name].append(price)

        # Filter to dishes in 2+ chains
        common: list[CommonDish] = []
        for norm_name, chain_prices in dish_map.items():
            if len(chain_prices) < 2:
                continue
            all_prices = [p for prices in chain_prices.values() for p in prices]
            common.append(CommonDish(
                dish=norm_name,
                chains_with_it=sorted(chain_prices.keys()),
                min_price=min(all_prices) if all_prices else 0,
                max_price=max(all_prices) if all_prices else 0,
                avg_price=sum(all_prices) / len(all_prices) if all_prices else 0,
            ))

        # Sort by number of chains (most common first), then by name
        common.sort(key=lambda d: (-len(d.chains_with_it), d.dish))
        return common

    # ── Insights ───────────────────────────────────────────────

    def _generate_insights(
        self,
        profiles: list[ChainProfile],
        price_bands: list[PriceBand],
        common: list[CommonDish],
    ) -> list[str]:
        insights: list[str] = []
        if not profiles:
            return insights

        # 1. Revenue leader
        sorted_by_rev = sorted(profiles, key=lambda p: -p.total_revenue)
        leader = sorted_by_rev[0]
        trailer = sorted_by_rev[-1]
        insights.append(
            f"营收排名: {leader.name} (¥{leader.total_revenue:,.0f}) 领先, "
            f"{trailer.name} (¥{trailer.total_revenue:,.0f}) 最低, "
            f"差距 {leader.total_revenue / max(trailer.total_revenue, 1):.1f}x"
        )

        # 2. Avg ticket comparison
        sorted_by_ticket = sorted(profiles, key=lambda p: -p.avg_ticket)
        hi = sorted_by_ticket[0]
        lo = sorted_by_ticket[-1]
        insights.append(
            f"客单价: {hi.name} ¥{hi.avg_ticket:.1f} (最高) vs "
            f"{lo.name} ¥{lo.avg_ticket:.1f} (最低) — "
            f"{'同档次' if hi.avg_ticket / max(lo.avg_ticket, 0.01) < 2 else '不同消费层级'}"
        )

        # 3. Menu complexity
        sorted_by_sku = sorted(profiles, key=lambda p: -p.sku_count)
        insights.append(
            f"菜单复杂度: {sorted_by_sku[0].name} ({sorted_by_sku[0].sku_count} SKU) 最丰富, "
            f"{sorted_by_sku[-1].name} ({sorted_by_sku[-1].sku_count} SKU) 最精简"
        )

        # 4. Common dishes
        if common:
            top3 = common[:3]
            dishes_str = ", ".join(f"「{d.dish}」({len(d.chains_with_it)}家)" for d in top3)
            insights.append(f"竞争红海菜品: {dishes_str} — 多家共有, 价格战风险高")

        # 5. Price positioning
        high_end = [b for b in price_bands if b.high_pct > 0.3]
        low_end = [b for b in price_bands if b.low_pct > 0.5]
        if high_end:
            names = ", ".join(b.chain for b in high_end)
            insights.append(f"高端定位 (>30% SKU 超60元): {names}")
        if low_end:
            names = ", ".join(b.chain for b in low_end)
            insights.append(f"平价定位 (>50% SKU 低于20元): {names}")

        return insights

    # ── Recommendations ────────────────────────────────────────

    def _generate_recommendations(
        self,
        profiles: list[ChainProfile],
        price_bands: list[PriceBand],
        cat_dist: list[dict],
        common: list[CommonDish],
    ) -> list[str]:
        recs: list[str] = []

        # 1. SKU bloat warning
        for p in profiles:
            if p.sku_count > 200:
                recs.append(
                    f"{p.name}: {p.sku_count} SKU 过多, 建议精简到 TOP 80% 贡献的核心菜品, "
                    f"降低库存和培训成本"
                )

        # 2. Differentiation opportunity
        if common:
            highly_contested = [d for d in common if len(d.chains_with_it) >= 3]
            if highly_contested:
                recs.append(
                    f"发现 {len(highly_contested)} 道菜被3家以上共有 — "
                    f"考虑差异化定价或口味创新避免同质竞争"
                )

        # 3. Price gap opportunity
        band_map = {b.chain: b for b in price_bands}
        for p in profiles:
            b = band_map.get(p.name)
            if b and b.low_pct > 0.6 and p.avg_ticket < 15:
                recs.append(
                    f"{p.name}: 过于集中低价带 ({b.low_pct:.0%}), "
                    f"考虑增加中价位 (20-60元) 组合套餐提升客单价"
                )

        # 4. Category concentration risk
        for p in profiles:
            if p.top_category_pct > 0.5:
                recs.append(
                    f"{p.name}: 「{p.top_category}」占营收 {p.top_category_pct:.0%}, "
                    f"品类集中度高, 供应链风险大, 建议拓展副品类"
                )

        if not recs:
            recs.append("各连锁品牌定位差异化明显, 暂无重大竞争风险")

        return recs


# ── Convenience runner ─────────────────────────────────────────

def run_benchmark_from_db(
    chain_configs: list[dict],
    db_session=None,
) -> CrossChainReport:
    """Convenience function to run benchmark from upload IDs.

    Args:
        chain_configs: list of {"name": str, "sub_sector": str, "upload_id": int}
        db_session: SQLAlchemy session. If None, creates one.

    Returns:
        CrossChainReport
    """
    chains = [
        ChainInput(
            name=cfg["name"],
            sub_sector=cfg["sub_sector"],
            upload_id=cfg["upload_id"],
        )
        for cfg in chain_configs
    ]

    bench = CrossChainBenchmark()

    if db_session is not None:
        return bench.analyze(chains, db_session=db_session)

    from smartbi.database.connection import get_db_context
    with get_db_context() as db:
        return bench.analyze(chains, db_session=db)
