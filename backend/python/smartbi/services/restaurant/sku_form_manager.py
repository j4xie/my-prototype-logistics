"""SKU 主料成本表单管理 — Layer 2 (Week 4.4 + W5.1 DB 持久化)

设计依据 (来自 Image 3 三层学习架构):
  - Layer 1 (类目均价) 精度 ±15% — 新店开业即用
  - Layer 2 (SKU 表单) 精度 ±8%  — 客户填 TOP 20 SKU 主料清单
  - Layer 3 (月度校准) 精度 ±5%  — 用月度采购汇总反推校准
  - Layer 4 (manual override) ±2% — 客户手动覆盖单 SKU

本模块 = Layer 2:
  客户填 TOP 20 SKU 的主料成本表, 每 SKU 包含 ingredients 明细.
  当 ChannelMarginCalculator 或 BomResolver 查询某 SKU 的 COGS 时,
  优先命中本模块, 跳过 Layer 1 的类目均价粗估.

为什么 TOP 20 SKU 够用:
  青花椒数据: 700 SKU, TOP 20 占 80% 销量 — 长尾不用填, 用 Layer 1 即可.
  邓总火锅: 按品类 (招牌主菜/肉类/蔬菜) 填 TOP 5-10 即可覆盖 80% 营收.

数据存储 (W5.1 双模式):
  1. in-memory (db_session=None)     — 单测/临时计算用
  2. DB backed (传入 db_session)     — 生产, 持久化到 restaurant_sku_forms 表

使用示例:
    >>> manager = SkuFormManager()
    >>> entries = [
    ...     SkuFormEntry(
    ...         sku_name="招牌青花椒鱼",
    ...         category="招牌主菜",
    ...         total_cogs_amount=27.60,
    ...         selling_price=69.0,
    ...         ingredients=[
    ...             SkuFormIngredient(name="草鱼", cost=18.0, weight_g=500),
    ...             SkuFormIngredient(name="青花椒", cost=3.5, weight_g=10),
    ...             SkuFormIngredient(name="底料", cost=6.1, weight_g=150),
    ...         ],
    ...     ),
    ... ]
    >>> manager.upload("QHJ", entries)
    1
    >>> hit = manager.lookup("QHJ", "招牌青花椒鱼")
    >>> hit.cogs_pct()
    0.4  # 27.60 / 69.0
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Data types ──────────────────────────────────────────────


@dataclass
class SkuFormIngredient:
    """SKU 主料条目 — 一个 SKU 通常有 3-8 个主料"""
    name: str                                # "草鱼" / "青花椒" / "底料"
    cost: float                              # 元 (本条主料的成本)
    weight_g: Optional[float] = None         # 克 (用于算单价)
    unit_price_per_kg: Optional[float] = None  # 元/kg (可选, 若给了 weight_g 可反算)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "cost": round(self.cost, 4),
            "weightG": self.weight_g,
            "unitPricePerKg": self.unit_price_per_kg,
        }


@dataclass
class SkuFormEntry:
    """一条 TOP 20 SKU 的主料成本表"""
    sku_name: str                            # 规范化后的 SKU 名 (经 menu_normalizer)
    category: str                            # 招牌主菜 / 肉类 / ...
    total_cogs_amount: float                 # 元/份 (ingredients cost 加总)
    ingredients: list[SkuFormIngredient] = field(default_factory=list)
    selling_price: Optional[float] = None    # 售价 (算 cogs_pct 用)
    monthly_sales_quantity: Optional[float] = None  # 月销量 (算 Layer 3 校准用)
    uploaded_at: str = field(default_factory=lambda: datetime.now().isoformat())
    uploaded_by: Optional[str] = None        # 操作员 (审计追踪)
    notes: Optional[str] = None              # 备注 (例: "包含员工餐成本")

    def cogs_pct(self, selling_price_override: Optional[float] = None) -> Optional[float]:
        """算 COGS 占售价比例 (0-1)"""
        price = selling_price_override if selling_price_override is not None else self.selling_price
        if price and price > 0:
            return self.total_cogs_amount / price
        return None

    def ingredient_cost_sum(self) -> float:
        """ingredients 实际加总 (用于校验 total_cogs_amount 是否一致)"""
        return sum(ing.cost for ing in self.ingredients)

    def is_consistent(self, tolerance_pct: float = 0.05) -> bool:
        """检查 total_cogs_amount 与 ingredients 加总是否一致 (允许 5% 误差)"""
        if not self.ingredients:
            return True  # 只填了总价没填明细, 不校验
        total = self.ingredient_cost_sum()
        if self.total_cogs_amount == 0:
            return total == 0
        delta = abs(total - self.total_cogs_amount) / self.total_cogs_amount
        return delta <= tolerance_pct

    def to_dict(self) -> dict:
        return {
            "skuName": self.sku_name,
            "category": self.category,
            "totalCogsAmount": round(self.total_cogs_amount, 2),
            "sellingPrice": self.selling_price,
            "cogsPct": round(self.cogs_pct() or 0, 4),
            "ingredients": [i.to_dict() for i in self.ingredients],
            "ingredientCostSum": round(self.ingredient_cost_sum(), 2),
            "isConsistent": self.is_consistent(),
            "monthlySalesQuantity": self.monthly_sales_quantity,
            "uploadedAt": self.uploaded_at,
            "uploadedBy": self.uploaded_by,
            "notes": self.notes,
        }


# ── Manager ─────────────────────────────────────────────────


class SkuFormManager:
    """SKU 主料成本表单管理器 — Layer 2 存储 + 查找

    双模式 (W5.1):
      - db_session=None: in-memory (单测 / 临时计算)
      - db_session=Session: DB 持久化 (生产, restaurant_sku_forms 表)

    API 设计: 按 factory_id 隔离, 与 factory domain 分开
    (restaurant 域与 factory 域不互相污染, 参见 __init__.py 隔离铁律).
    """

    def __init__(self, db_session: Optional[Any] = None) -> None:
        self.db_session = db_session
        # in-memory fallback: factory_id → {normalized_sku_name → SkuFormEntry}
        self._store: dict[str, dict[str, SkuFormEntry]] = {}

    # ── Internal: DB ORM helpers ────────────────────────

    def _db_to_entry(self, row: Any) -> SkuFormEntry:
        """Convert RestaurantSkuForm ORM row → SkuFormEntry dataclass"""
        ingredients = [
            SkuFormIngredient(
                name=ing.get("name", ""),
                cost=float(ing.get("cost", 0)),
                weight_g=ing.get("weight_g") or ing.get("weightG"),
                unit_price_per_kg=ing.get("unit_price_per_kg") or ing.get("unitPricePerKg"),
            )
            for ing in (row.ingredients or [])
        ]
        return SkuFormEntry(
            sku_name=row.sku_name,
            category=row.category,
            total_cogs_amount=float(row.total_cogs_amount),
            selling_price=float(row.selling_price) if row.selling_price is not None else None,
            monthly_sales_quantity=float(row.monthly_sales_quantity) if row.monthly_sales_quantity is not None else None,
            ingredients=ingredients,
            uploaded_at=row.created_at.isoformat() if row.created_at else datetime.now().isoformat(),
            uploaded_by=row.uploaded_by,
            notes=row.notes,
        )

    @staticmethod
    def _entry_to_db_kwargs(entry: SkuFormEntry, factory_id: str) -> dict:
        """Convert SkuFormEntry → dict for RestaurantSkuForm insert/update"""
        return {
            "factory_id": factory_id,
            "store_id": None,
            "sku_name": entry.sku_name,
            "category": entry.category,
            "total_cogs_amount": entry.total_cogs_amount,
            "selling_price": entry.selling_price,
            "monthly_sales_quantity": entry.monthly_sales_quantity,
            "ingredients": [
                {
                    "name": i.name,
                    "cost": i.cost,
                    "weight_g": i.weight_g,
                    "unit_price_per_kg": i.unit_price_per_kg,
                }
                for i in entry.ingredients
            ],
            "uploaded_by": entry.uploaded_by,
            "notes": entry.notes,
        }

    # ── Upload / Upsert ─────────────────────────────────

    def upload(self, factory_id: str, entries: list[SkuFormEntry]) -> dict:
        """批量上传 SKU 表单 (UPSERT 策略: 同 factory+sku 覆盖)

        Returns:
            {uploaded: N, updated: M, invalid: [sku_name, ...]}
        """
        if not factory_id:
            raise ValueError("factory_id 不能为空")

        uploaded = 0
        updated = 0
        invalid: list[str] = []

        # Filter invalid entries first
        valid_entries = []
        for entry in entries:
            if not entry.sku_name:
                invalid.append("(empty sku_name)")
                continue
            if entry.total_cogs_amount < 0:
                invalid.append(f"{entry.sku_name}: total_cogs_amount < 0")
                continue
            if not entry.is_consistent(tolerance_pct=0.10):
                logger.warning(
                    f"SKU {entry.sku_name} 明细与总价差异 > 10%, "
                    f"total={entry.total_cogs_amount}, sum={entry.ingredient_cost_sum()}"
                )
            valid_entries.append(entry)

        if self.db_session is not None:
            # DB mode
            from smartbi.database.models import RestaurantSkuForm

            for entry in valid_entries:
                existing = (
                    self.db_session.query(RestaurantSkuForm)
                    .filter(
                        RestaurantSkuForm.factory_id == factory_id,
                        RestaurantSkuForm.store_id.is_(None),
                        RestaurantSkuForm.sku_name == entry.sku_name,
                    )
                    .first()
                )
                kwargs = self._entry_to_db_kwargs(entry, factory_id)
                if existing:
                    for k, v in kwargs.items():
                        setattr(existing, k, v)
                    updated += 1
                else:
                    new_row = RestaurantSkuForm(**kwargs)
                    self.db_session.add(new_row)
                    uploaded += 1
            self.db_session.commit()
        else:
            # in-memory mode
            if factory_id not in self._store:
                self._store[factory_id] = {}
            store = self._store[factory_id]
            for entry in valid_entries:
                if entry.sku_name in store:
                    updated += 1
                else:
                    uploaded += 1
                store[entry.sku_name] = entry

        logger.debug(
            f"SkuFormManager.upload factory={factory_id}, "
            f"uploaded={uploaded}, updated={updated}, invalid={len(invalid)}, "
            f"mode={'db' if self.db_session else 'memory'}"
        )
        return {"uploaded": uploaded, "updated": updated, "invalid": invalid}

    # ── Lookup ──────────────────────────────────────────

    def lookup(self, factory_id: str, sku_name: str) -> Optional[SkuFormEntry]:
        """按 SKU 名查找 (精确匹配)"""
        if not factory_id or not sku_name:
            return None

        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            row = (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                    RestaurantSkuForm.sku_name == sku_name,
                )
                .first()
            )
            return self._db_to_entry(row) if row else None

        return self._store.get(factory_id, {}).get(sku_name)

    def lookup_by_category(
        self, factory_id: str, category: str
    ) -> list[SkuFormEntry]:
        """按品类查找所有 SKU"""
        if not factory_id:
            return []

        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            rows = (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                    RestaurantSkuForm.category == category,
                )
                .all()
            )
            return [self._db_to_entry(r) for r in rows]

        store = self._store.get(factory_id, {})
        return [e for e in store.values() if e.category == category]

    def list_all(self, factory_id: str) -> list[SkuFormEntry]:
        """列出所有 SKU 表单"""
        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            rows = (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                )
                .order_by(RestaurantSkuForm.category, RestaurantSkuForm.sku_name)
                .all()
            )
            return [self._db_to_entry(r) for r in rows]

        return list(self._store.get(factory_id, {}).values())

    def count(self, factory_id: str) -> int:
        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            return (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                )
                .count()
            )
        return len(self._store.get(factory_id, {}))

    def count_by_category(self, factory_id: str) -> dict[str, int]:
        """按品类统计 SKU 数"""
        entries = self.list_all(factory_id)
        result: dict[str, int] = {}
        for entry in entries:
            result[entry.category] = result.get(entry.category, 0) + 1
        return result

    # ── Delete / Clear ──────────────────────────────────

    def delete(self, factory_id: str, sku_name: str) -> bool:
        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            deleted = (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                    RestaurantSkuForm.sku_name == sku_name,
                )
                .delete()
            )
            self.db_session.commit()
            return deleted > 0

        store = self._store.get(factory_id, {})
        if sku_name in store:
            del store[sku_name]
            return True
        return False

    def clear(self, factory_id: str) -> int:
        """清空某 factory 的所有 SKU 表单, 返回删除的条数"""
        if self.db_session is not None:
            from smartbi.database.models import RestaurantSkuForm
            deleted = (
                self.db_session.query(RestaurantSkuForm)
                .filter(
                    RestaurantSkuForm.factory_id == factory_id,
                    RestaurantSkuForm.store_id.is_(None),
                )
                .delete()
            )
            self.db_session.commit()
            return deleted

        count = len(self._store.get(factory_id, {}))
        self._store[factory_id] = {}
        return count

    # ── Coverage analysis (诚实边界) ────────────────────

    def coverage_report(
        self,
        factory_id: str,
        total_skus_in_sales: int,
        total_revenue: float,
    ) -> dict:
        """生成覆盖度报告 — 回答 "Layer 2 覆盖了多少销量?"

        客户填了 20 SKU, 但这 20 个 SKU 占实际销量多少? (应该 >= 70%)
        """
        entries = self.list_all(factory_id)
        layer2_sku_count = len(entries)

        # 粗估覆盖的营收 = sum(selling_price × monthly_sales_quantity)
        covered_revenue = 0.0
        missing_data_count = 0
        for e in entries:
            if e.selling_price and e.monthly_sales_quantity:
                covered_revenue += e.selling_price * e.monthly_sales_quantity
            else:
                missing_data_count += 1

        coverage_pct = (
            covered_revenue / total_revenue
            if total_revenue > 0 else 0
        )
        sku_coverage_pct = (
            layer2_sku_count / total_skus_in_sales
            if total_skus_in_sales > 0 else 0
        )

        is_sufficient = coverage_pct >= 0.70  # 覆盖 70% 营收算够

        return {
            "factoryId": factory_id,
            "layer2SkuCount": layer2_sku_count,
            "totalSkusInSales": total_skus_in_sales,
            "skuCoveragePct": round(sku_coverage_pct, 4),
            "coveredRevenue": round(covered_revenue, 2),
            "totalRevenue": round(total_revenue, 2),
            "revenueCoveragePct": round(coverage_pct, 4),
            "isSufficient": is_sufficient,
            "missingDataCount": missing_data_count,
            "message": (
                f"Layer 2 覆盖 {layer2_sku_count}/{total_skus_in_sales} SKU "
                f"({sku_coverage_pct * 100:.1f}%), "
                f"营收覆盖率 {coverage_pct * 100:.1f}% "
                f"{'✓ 达标' if is_sufficient else '⚠ 建议补充 TOP SKU 至 70% 营收覆盖'}"
            ),
        }
