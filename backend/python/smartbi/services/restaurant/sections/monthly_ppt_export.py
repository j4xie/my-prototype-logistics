from __future__ import annotations

"""Monthly PPT export section — wraps MonthlyPptExporter.


Part of P3.5D P3. Takes analyzer-output params and generates a filled
19-slide .pptx file in /tmp/smartbi_ppt/, returns path + download URL
for the caller to fetch.

Params:
  financial_metrics (dict, required): from store_pnl_one_pager section output
  diagnostics (list, optional): diagnostic results list
  department_breakdown (dict, optional): from department_pnl section
  shrinkage_report (dict, optional): from shrinkage_analysis section
  expense_breakdown (dict, optional): from expense_breakdown section

Returns:
  pptPath (str): absolute path to the generated .pptx file
  pptSizeBytes (int): file size in bytes
  downloadUrl (str): relative URL to the download endpoint
"""

import tempfile
import time
from pathlib import Path
from typing import Any, Optional

from smartbi.services.reporting.monthly_ppt_exporter import MonthlyPptExporter
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class MonthlyPptExportHandler(AbstractSectionHandler):
    """Generate a monthly analysis PPT from analyzer output."""

    section_name = "monthly_ppt_export"

    def __init__(self) -> None:
        self._exporter: Optional[MonthlyPptExporter] = None

    def _get_exporter(self) -> MonthlyPptExporter:
        """Lazy-load the exporter so python-pptx import cost is deferred."""
        if self._exporter is None:
            self._exporter = MonthlyPptExporter()
        return self._exporter

    def compute(
        self,
        request: SectionRequest,
        context: dict[str, Any],
    ) -> SectionResponse:
        started = time.time()

        fm = request.params.get("financial_metrics")
        if not fm:
            return self.skipped(
                request,
                "未提供 financial_metrics 参数 (需要 store_pnl_one_pager 的输出)",
                started,
            )

        try:
            output_dir = Path(tempfile.gettempdir()) / "smartbi_ppt"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = (
                output_dir
                / f"monthly_{request.factory_id}_{request.period}.pptx"
            )

            result_path = self._get_exporter().export(
                store_name=request.store_name or "店铺",
                period=request.period,
                financial_metrics=fm,
                diagnostics=request.params.get("diagnostics") or [],
                department_breakdown=request.params.get("department_breakdown"),
                shrinkage_report=request.params.get("shrinkage_report"),
                expense_breakdown=request.params.get("expense_breakdown"),
                output_path=output_file,
            )
        except Exception as e:
            return self.skipped(
                request,
                f"PPT 生成失败: {e}",
                started,
            )

        return self.ok(
            request,
            data={
                "pptPath": str(result_path),
                "pptSizeBytes": result_path.stat().st_size,
                "downloadUrl": (
                    f"/api/smartbi/restaurant/sections/ppt-export/download/"
                    f"{request.factory_id}/{request.period}"
                ),
            },
            started=started,
        )
