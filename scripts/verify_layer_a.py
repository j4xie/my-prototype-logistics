"""Runtime Layer A verify — run on server inside backend/python venv."""
import asyncio
import importlib.util
import os
import sys

# Bypass smartbi.services.__init__ which pulls in excel_parser → services.*
# by loading the target module files directly.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)


def _load(mod_name, rel_path):
    spec = importlib.util.spec_from_file_location(
        mod_name, os.path.join(BACKEND_DIR, rel_path)
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


sm_mod = _load("sm_layer_a", "smartbi/services/semantic_mapper.py")
cr_mod = _load("cr_layer_a", "smartbi/services/chart_recommender.py")
cs_mod = _load("cs_layer_a", "smartbi/services/cross_sheet_aggregator.py")

SemanticMapper = sm_mod.SemanticMapper
DataSummary = cr_mod.DataSummary
ChartRecommender = cr_mod.ChartRecommender
CrossSheetAggregator = cs_mod.CrossSheetAggregator


async def main():
    mapper = SemanticMapper()
    columns = [
        "门店名称", "开单日期",
        "销售金额", "销售单价", "销售数量", "折后金额", "实收金额",
        "收入分组", "营业类型", "商品类别",
        "优惠金额", "折扣",
    ]
    samples = [
        ["永和豆浆A店", "2025-10-01", 100.5, 10.05, 10, 95.0, 95.0, "堂食", "外卖", "粥", 5.5, "0.95"],
        ["永和豆浆B店", "2025-10-02", 200.0, 20.0, 10, 180.0, 180.0, "外卖", "堂食", "饭", 20.0, "0.90"],
        ["永和豆浆C店", "2025-10-03", 150.0, 15.0, 10, 140.0, 140.0, "堂食", "外卖", "面", 10.0, "0.93"],
    ]
    result = await mapper.map_fields(columns=columns, sample_data=samples, factory_id="F002")
    print("=== Layer A mapper verification ===")
    for m in result.field_mappings:
        cat = m.category or "None"
        dt = m.data_type or "None"
        print(f"  {m.original:<15} -> std={m.standard:<30} cat={cat:<10} type={dt}")

    stds = [m.standard for m in result.field_mappings if m.standard]
    print(f"\n[A1] Total {len(stds)}, unique {len(set(stds))}")
    dup = [s for s in stds if stds.count(s) > 1]
    assert not dup, f"A1 FAIL collisions: {dup}"
    print("[A1] PASS no collisions")

    rg = next((m for m in result.field_mappings if m.original == "收入分组"), None)
    assert rg and rg.category == "category", f"A2 FAIL: 收入分组 cat={rg.category if rg else None}"
    print("[A2] PASS 收入分组 is category")

    no_dt = [m.original for m in result.field_mappings if m.data_type is None]
    filled = [m for m in result.field_mappings if m.data_type]
    print(f"[A3] filled {len(filled)}/{len(result.field_mappings)}, missing: {no_dt}")
    assert len(filled) >= len(result.field_mappings) * 0.8, f"A3 FAIL: too many None ({no_dt})"
    print("[A3] PASS data_type populated on >=80%")

    # A4 check — single-store upload
    features = [
        {"columnName": "门店", "dataType": "CATEGORICAL", "uniqueCount": 1},
        {"columnName": "金额", "dataType": "NUMERIC", "uniqueCount": 50},
    ]
    ds = DataSummary.from_feature_results(features, row_count=50)
    rec_svc = ChartRecommender()
    recs = rec_svc._minimal_fallback(ds, scenario="general")
    types = [r.chart_type for r in recs]
    print(f"[A4] single-store → chart types: {types}")
    assert "bar" not in types and "pie" not in types, f"A4 FAIL: bar/pie not blocked: {types}"
    print("[A4] PASS cardinality gate blocks bar/pie on unique_count=1")

    # A5 dim inference
    assert CrossSheetAggregator._infer_dim_label_from_sheet_names(["永和豆浆A店", "永和豆浆B店"]) == "门店"
    assert CrossSheetAggregator._infer_dim_label_from_sheet_names(["Sheet1", "Sheet2"]) is None
    print("[A5] PASS dim label inference")

    print("\n=== ALL LAYER A CHECKS PASS ===")


asyncio.run(main())
