"""Runtime verify C1 embedding-first layer on server."""
import asyncio
import importlib.util
import os
import sys

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


async def main():
    # Need to configure embedding first (smartbi main.py does this on startup;
    # in a stand-alone script we have to bootstrap manually)
    import os as _os
    # Load settings from SmartBI config (reads .env)
    cfg_mod = _load("cfg", "config.py")
    settings = cfg_mod.get_settings()

    from food_kb.services.embedding import configure as configure_embedding
    configure_embedding(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model="text-embedding-v3",
        dims=768,
    )

    # Pre-load semantic_mapper as "sm" so standard_field_embedder can find
    # STANDARD_FIELDS without triggering smartbi.services.__init__.
    sm_mod = _load("sm", "smartbi/services/semantic_mapper.py")
    em_mod = _load("em", "smartbi/services/standard_field_embedder.py")

    # Build index
    n = await em_mod.build_index()
    print(f"Index built: {n}/{len(sm_mod.STANDARD_FIELDS)} STANDARD_FIELDS embedded")

    # Test 1: Exact rule-miss scenarios
    test_cases = [
        ("门店销售GMV", ["100.5", "200.0", "300.75"]),     # Expected: revenue
        ("主营产品收入", ["1000", "2000"]),                     # Expected: revenue
        ("卖场毛利额", ["500", "400"]),                          # Expected: gross_profit
        ("规格描述", ["500ml", "1L", "盒"]),                     # Expected: product (or none)
        ("付款方式", ["现金", "微信", "支付宝"]),              # Expected: category
        ("期末累计", ["10000", "20000", "30000"]),             # Expected: ytd_actual
    ]
    print(f"\n=== Embedding lookup tests ===")
    for col, samples in test_cases:
        matches = await em_mod.find_best_matches(col, samples, top_k=3)
        if matches:
            top = matches[0]
            print(f"  {col!r:20s} → top={top[0]:<20s} cos={top[2]:.3f} (cat={top[1]})")
            for m in matches[1:]:
                print(f"    also: {m[0]:<20s} cos={m[2]:.3f}")
        else:
            print(f"  {col!r:20s} → NO MATCH")

    # Test 2: Full mapper integration (embedding between rules and LLM)
    print(f"\n=== Full mapper integration test ===")
    mapper = sm_mod.SemanticMapper()
    columns = ["门店销售GMV", "主营产品收入", "规格描述", "付款方式", "期末累计"]
    samples = [
        ["1000.5", "A产品", "500ml", "现金", "10000"],
        ["2000.0", "B产品", "1L", "微信", "20000"],
    ]
    result = await mapper.map_fields(columns=columns, sample_data=samples, factory_id="F001")
    for m in result.field_mappings:
        print(f"  {m.original:20s} → std={m.standard!r} method={m.method} cat={m.category}")


asyncio.run(main())
