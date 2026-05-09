"""Smart reorder: generate purchase order from forecast + BOM + current stock."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.smart_reorder import SmartReorderHandler


def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)


def test_basic_reorder():
    resp = SmartReorderHandler().compute(
        _req({
            "bom_recipes": [
                {"dish": "麻辣牛肉", "ingredient": "牛肉", "qty_per_dish": 0.3, "unit": "kg", "daily_sales_estimate": 40},
                {"dish": "麻辣牛肉", "ingredient": "辣椒", "qty_per_dish": 0.05, "unit": "kg", "daily_sales_estimate": 40},
                {"dish": "酸菜鱼", "ingredient": "黑鱼", "qty_per_dish": 0.5, "unit": "kg", "daily_sales_estimate": 25},
            ],
            "current_stock": {"牛肉": 5.0, "辣椒": 3.0, "黑鱼": 2.0},
            "lead_days": 1, "safety_factor": 1.2,
        }), {})
    assert resp.status.value == "ok"
    orders = resp.data["suggested_orders"]
    assert len(orders) == 3
    beef = next(o for o in orders if o["ingredient"] == "牛肉")
    assert beef["daily_need"] == 12.0
    assert beef["order_qty"] > 0


def test_no_order_when_sufficient():
    resp = SmartReorderHandler().compute(
        _req({
            "bom_recipes": [{"dish": "米饭", "ingredient": "大米", "qty_per_dish": 0.2, "unit": "kg", "daily_sales_estimate": 50}],  # noqa: E501
            "current_stock": {"大米": 100.0}, "lead_days": 1, "safety_factor": 1.0,
        }), {})
    rice = next(o for o in resp.data["suggested_orders"] if o["ingredient"] == "大米")
    assert rice["order_qty"] == 0


def test_skipped_no_bom():
    resp = SmartReorderHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
