"""Shape detection for uploaded CSV/xlsx files."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import List, Sequence

logger = logging.getLogger(__name__)


class FileShape(Enum):
    BILL_FLOW = "bill_flow"
    PRODUCT_SUMMARY = "product_summary"
    REVIEW = "review"
    FINANCE = "finance"
    INVENTORY = "inventory"
    SCHEDULE = "schedule"
    MEMBER = "member"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class DetectionResult:
    shape: FileShape
    confidence: float
    reasoning: str


class ShapeDetector:
    """LLM-augmented shape detector with rule-based fast path."""

    AUTO_ROUTE_THRESHOLD = 0.85
    ADMIN_REVIEW_THRESHOLD = 0.50

    async def detect(
        self,
        sample_rows: List[dict],
        column_names: List[str],
    ) -> DetectionResult:
        """Rules first; LLM fallback when rule confidence is low."""
        rule_result = self._rule_detect(column_names)
        if rule_result.confidence > self.AUTO_ROUTE_THRESHOLD:
            return rule_result
        return await self._llm_detect(sample_rows, column_names)

    def _rule_detect(self, column_names: List[str]) -> DetectionResult:
        """Heuristic rules covering common cases."""
        col_set = set(column_names)

        if (
            any(c in col_set for c in ["账单号", "结账号", "订单号"])
            and any(c in col_set for c in ["营业日期", "日期", "transaction_date"])
            and any(c in col_set for c in ["商品信息", "菜品明细"])
        ):
            return DetectionResult(
                FileShape.BILL_FLOW, 0.95, "rule: 账单+日期+商品 三件套"
            )

        if (
            any(c in col_set for c in ["商品名称", "菜品名称"])
            and not any(c in col_set for c in ["账单号", "订单号"])
            and any(c in col_set for c in ["销售金额", "营业额"])
        ):
            return DetectionResult(
                FileShape.PRODUCT_SUMMARY, 0.90, "rule: 商品+金额 + 缺账单"
            )

        if any(c in col_set for c in ["评分", "星级", "rating"]) and any(
            c in col_set for c in ["评论", "评价", "review_text"]
        ):
            return DetectionResult(FileShape.REVIEW, 0.92, "rule: 评分+评论文本")

        if any(c in col_set for c in ["凭证号", "voucher_no"]) and any(
            c in col_set for c in ["科目", "subject"]
        ):
            return DetectionResult(FileShape.FINANCE, 0.88, "rule: 凭证+科目")

        if any(c in col_set for c in ["库存量", "盘点量", "stock_qty"]) and any(
            c in col_set for c in ["食材", "原材料", "ingredient"]
        ):
            return DetectionResult(FileShape.INVENTORY, 0.85, "rule: 库存+食材")

        return DetectionResult(FileShape.UNKNOWN, 0.50, "rule: 无明显特征, 需 LLM")

    async def _llm_detect(
        self,
        sample_rows: Sequence[dict],
        column_names: Sequence[str],
    ) -> DetectionResult:
        """LLM fallback. Returns UNKNOWN/0.0 on any failure (graceful degrade)."""
        # Use multi-provider chain so DashScope outages don't break detection.
        from smartbi.services.insights.llm_client import call_llm

        prompt = (
            "你是餐饮数据形态识别专家. 给定 Excel/CSV 列名 + 前 5 行样本, 判断它是哪种形态:\n\n"
            "支持的形态:\n"
            "1. bill_flow (账单流水): 每行=一笔顾客订单, 含账单号+日期+菜品组合\n"
            "2. product_summary (商品销售汇总): 每行=一道菜在某段时间的总销售\n"
            "3. review (评论): 含评分+评论文本\n"
            "4. finance (财务凭证): 含凭证号+科目+收支\n"
            "5. inventory (库存盘点): 含食材+库存量\n"
            "6. schedule (排班): 含员工+班次+日期\n"
            "7. member (会员): 含会员 ID+储值\n"
            "8. unknown: 都不是\n\n"
            f"列名: {list(column_names)}\n"
            f"前 5 行样本: {list(sample_rows[:5])}\n\n"
            'JSON 格式: {"shape": "<one of bill_flow/product_summary/review/finance/'
            'inventory/schedule/member/unknown>", "confidence": <0-1>, '
            '"reasoning": "<简要原因>"}'
        )

        system_role = "你是餐饮数据形态识别专家."
        try:
            response = await call_llm(prompt, system_role=system_role, max_tokens=300)
        except Exception as exc:
            logger.warning("ShapeDetector LLM call failed: %s", exc)
            return DetectionResult(
                FileShape.UNKNOWN, 0.0, f"LLM error: {type(exc).__name__}"
            )

        if not response:
            return DetectionResult(FileShape.UNKNOWN, 0.0, "LLM returned empty")

        try:
            data = json.loads(response)
            shape = FileShape(data.get("shape", "unknown"))
            confidence = float(data.get("confidence", 0.5))
            reasoning = str(data.get("reasoning", ""))
            return DetectionResult(shape, confidence, f"LLM: {reasoning}")
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "ShapeDetector LLM JSON parse failed: %s; raw=%r",
                exc, response[:200],
            )
            return DetectionResult(FileShape.UNKNOWN, 0.0, f"LLM parse error: {exc}")
