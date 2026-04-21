"""test_template_dish_time_slot_matrix.py"""
from smartbi.services.materialized_analytics.compute.polars_backend import PolarsBackend
from smartbi.services.materialized_analytics.schema import DataSchema, Domain, Field, FieldRole
from smartbi.services.materialized_analytics.templates.dish_time_slot_matrix import DishTimeSlotMatrix


def _schema():
    return DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("开单时间", FieldRole.TIME, "datetime"),
                      Field("商品信息", FieldRole.DIMENSION, "string"),
                      Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=5, primary_measure="营业额", time_field="开单时间")


def test_matrix_detects_dinner_peak():
    # 晚餐吃鱼,午餐吃娃娃菜
    rows = [
        {"开单时间": "2025-03-01 19:00:00", "商品信息": "青花椒鱼_1份*69+豆腐皮_1份*8", "营业额": 77},
        {"开单时间": "2025-03-01 20:00:00", "商品信息": "青花椒鱼_1份*69", "营业额": 69},
        {"开单时间": "2025-03-01 12:00:00", "商品信息": "娃娃菜_1份*8", "营业额": 8},
    ]
    backend = PolarsBackend.from_rows(rows)
    result = DishTimeSlotMatrix().run(backend, _schema())
    assert result.applies
    assert result.kpis["peak_dish"] == "青花椒鱼"
    assert result.kpis["peak_slot"] == "晚餐"


def test_matrix_skip_when_no_item_or_time():
    schema = DataSchema(upload_id=1, factory_id="F001", domain=Domain.RESTAURANT,
        fields=tuple([Field("营业额", FieldRole.MEASURE, "float")]),
        row_count=1, primary_measure="营业额", time_field=None)
    backend = PolarsBackend.from_rows([{"营业额": 100}])
    result = DishTimeSlotMatrix().run(backend, schema)
    assert not result.applies
