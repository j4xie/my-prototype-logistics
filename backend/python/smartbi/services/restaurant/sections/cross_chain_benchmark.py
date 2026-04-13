from __future__ import annotations

"""Cross-chain benchmark section — wraps CrossChainBenchmark for section pipeline.


Part of P3 Task 3.3-3.4. The underlying CrossChainBenchmark class already
exists (508 lines with unit tests) but was never wired into the section
pipeline. This handler exposes it as a FastAPI section.

The underlying class API is:
  CrossChainBenchmark.analyze(chains: list[ChainInput]) -> CrossChainReport

where ChainInput(name, sub_sector, upload_id, df) requires a DataFrame
injected via df= (or db_session if loading from DB).

Inputs (via request.params):
  chains (list[dict], required): list of brand chains to compare.
    Each dict must have:
      - name (str): brand/chain name
      - sub_sector (str): e.g. "川菜", "火锅"
      - rows (list[dict]): POS row data — the same column schema as the
        uploaded SmartBI Excel (商品名称, 销售单价, 实收, etc.)
    Minimum 2 chains required for a meaningful cross-chain comparison.

Missing chains → SKIPPED (caller must supply at least 2 brands).
Single chain → SKIPPED (no peer to compare against).
"""

import time
from typing import Any

import pandas as pd

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class CrossChainBenchmarkHandler(AbstractSectionHandler):
    """Wraps CrossChainBenchmark.analyze() for the section pipeline."""

    section_name = "cross_chain_benchmark"

    def __init__(self) -> None:
        self._bench = None  # lazy to avoid module-load cost

    def _get_bench(self):
        if self._bench is None:
            from smartbi.services.restaurant.cross_chain_benchmark import (
                CrossChainBenchmark,
            )
            self._bench = CrossChainBenchmark()
        return self._bench

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        # Retrieve chains list from params
        chains_raw = request.params.get("chains")
        if not chains_raw:
            return self.skipped(
                request,
                "缺少 chains 参数 — 跨连锁对标需要至少 2 个品牌的数据 "
                "(传入 params.chains: [{name, sub_sector, rows}])",
                started,
            )

        if not isinstance(chains_raw, list) or len(chains_raw) < 2:
            return self.skipped(
                request,
                f"chains 至少需要 2 个品牌，当前仅提供 {len(chains_raw) if isinstance(chains_raw, list) else 0} 个",
                started,
            )

        # Import ChainInput from the underlying module
        try:
            from smartbi.services.restaurant.cross_chain_benchmark import ChainInput
        except ImportError as e:
            return self.skipped(request, f"无法导入 CrossChainBenchmark: {e}", started)

        # Build ChainInput list from raw dicts
        chain_inputs = []
        for item in chains_raw:
            if not isinstance(item, dict):
                return self.skipped(
                    request,
                    f"chains 中的每个元素必须是 dict，得到 {type(item).__name__}",
                    started,
                )
            name = item.get("name") or "未命名品牌"
            sub_sector = item.get("sub_sector") or request.sub_sector or "通用"

            # Build DataFrame from rows if provided
            rows = item.get("rows")
            if rows is not None and isinstance(rows, list):
                try:
                    df = pd.DataFrame(rows)
                    # Coerce numeric columns that CrossChainBenchmark expects
                    for col in ["实收", "销售单价", "销售金额", "折后金额",
                                "单卖数量(不含套餐子商品)", "数量(含套餐子商品)"]:
                        if col in df.columns:
                            df[col] = pd.to_numeric(df[col], errors="coerce")
                except Exception as e:
                    return self.skipped(
                        request,
                        f"品牌 '{name}' 的 rows 无法转为 DataFrame: {e}",
                        started,
                    )
            else:
                # No inline rows — cannot load from DB without db_session
                return self.skipped(
                    request,
                    f"品牌 '{name}' 未提供 rows 数据 (section handler 不支持 DB 加载模式, 请直接传 rows)",
                    started,
                )

            chain_inputs.append(
                ChainInput(name=name, sub_sector=sub_sector, upload_id=0, df=df)
            )

        # Run the benchmark
        try:
            bench = self._get_bench()
            report = bench.analyze(chain_inputs)
        except Exception as e:
            return self.skipped(request, f"跨连锁对标计算失败: {e}", started)

        # Normalize to dict
        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"CrossChainBenchmark 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)
