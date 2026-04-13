from __future__ import annotations

"""Review analysis section — wraps LlmReviewAnalyzer with regex fallback.


Mirrors the behavior of analyzer.py:396-424:
  - If `use_llm` (default True) and LLM is available → try LlmReviewAnalyzer first.
  - On LLM failure, fall back to regex ReviewAnalyzer.
  - If both fail, return SKIPPED with the error message.

Both engines expose ``analyze(reviews, min_mentions=...)`` and return a
``ReviewAnalysisReport`` with ``.to_dict()``. The LLM variant additionally
accepts ``max_reviews`` for cost capping.
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class ReviewAnalysisHandler(AbstractSectionHandler):
    """Wraps LlmReviewAnalyzer (primary) + ReviewAnalyzer (regex fallback).

    Inputs (request.params):
      - ``reviews``         (required) list of review dicts with id/rating/content/created_at
      - ``use_llm``         (optional, default True) try LLM first; False = regex-only
      - ``min_mentions``    (optional, default 2)
      - ``max_reviews``     (optional, default 200) cost cap for LLM

    Output data merges ``ReviewAnalysisReport.to_dict()`` with a ``usedLlm``
    boolean indicating whether the result came from the LLM path.
    """
    section_name = "review_analysis"

    DEFAULT_MIN_MENTIONS = 2
    DEFAULT_MAX_REVIEWS = 200

    def __init__(self) -> None:
        # Lazy-init both analyzers — LLM analyzer reads config + httpx client at
        # construction, so we defer until first use to keep section import cheap.
        self._llm_analyzer = None
        self._regex_analyzer = None

    def _get_llm(self):
        if self._llm_analyzer is None:
            from smartbi.services.restaurant.review_analyzer_llm import LlmReviewAnalyzer
            self._llm_analyzer = LlmReviewAnalyzer()
        return self._llm_analyzer

    def _get_regex(self):
        if self._regex_analyzer is None:
            from smartbi.services.restaurant.review_analyzer import ReviewAnalyzer
            self._regex_analyzer = ReviewAnalyzer()
        return self._regex_analyzer

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        reviews = request.params.get("reviews")
        if not reviews:
            return self.skipped(request, "未提供 reviews 列表", started)

        use_llm = bool(request.params.get("use_llm", True))
        min_mentions = int(request.params.get("min_mentions", self.DEFAULT_MIN_MENTIONS))
        max_reviews = int(request.params.get("max_reviews", self.DEFAULT_MAX_REVIEWS))

        warnings: list[str] = []
        report = None
        used_llm = False

        if use_llm:
            try:
                report = self._get_llm().analyze(
                    reviews,
                    min_mentions=min_mentions,
                    max_reviews=max_reviews,
                )
                used_llm = True
            except Exception as e:
                warnings.append(f"LLM 评论分析失败, 降级到 regex: {e}")
                report = None
                used_llm = False

        if report is None:
            try:
                report = self._get_regex().analyze(
                    reviews=reviews,
                    min_mentions=min_mentions,
                )
            except Exception as e:
                return self.skipped(
                    request,
                    f"review_analyzer 运行失败: {e}",
                    started,
                )

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = dict(report)
        else:
            return self.skipped(
                request,
                f"review_analyzer 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        data["usedLlm"] = used_llm
        return self.ok(request, data=data, started=started, warnings=warnings)
