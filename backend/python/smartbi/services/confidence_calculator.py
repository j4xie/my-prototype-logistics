"""
Data Confidence Calculator
Computes analysis confidence scores based on data completeness and field coverage.
Used to annotate SmartBI analysis results with reliability indicators.
"""
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class DimensionConfidence:
    score: float          # 0-100
    missing_fields: List[str]
    message: str
    level: str            # high (>75), medium (50-75), low (<50)


@dataclass
class ConfidenceResult:
    overall_score: float
    dimensions: Dict[str, DimensionConfidence]
    summary: str


# Analysis dimension -> required fields mapping
DIMENSION_FIELDS = {
    "oee": {
        "critical": ["operating_hours", "planned_hours", "actual_quantity", "planned_quantity", "good_quantity"],
        "important": ["equipment_id", "downtime_hours", "equipment_name"],
        "nice_to_have": ["maintenance_date", "equipment_type"]
    },
    "yield_rate": {
        "critical": ["actual_quantity", "good_quantity", "defect_quantity"],
        "important": ["product_name", "batch_number", "yield_rate"],
        "nice_to_have": ["defect_type", "inspector_id"]
    },
    "production_cost": {
        "critical": ["material_cost", "labor_cost", "total_cost"],
        "important": ["equipment_cost", "unit_cost", "actual_quantity"],
        "nice_to_have": ["other_cost", "overhead_rate"]
    },
    "labor_efficiency": {
        "critical": ["user_id", "actual_work_minutes", "start_time", "end_time"],
        "important": ["hourly_rate", "labor_cost", "work_type_id"],
        "nice_to_have": ["break_minutes", "overtime_hours"]
    },
    "quality_rate": {
        "critical": ["inspection_type", "result", "batch_id"],
        "important": ["defect_count", "defect_type", "inspector_id"],
        "nice_to_have": ["corrective_action", "root_cause"]
    }
}


def compute_confidence(
    field_completeness: Dict[str, float],
    analysis_dimensions: Optional[List[str]] = None
) -> ConfidenceResult:
    """
    Compute confidence scores for analysis dimensions based on field completeness.

    Args:
        field_completeness: Dict of field_name -> completion percentage (0-100)
        analysis_dimensions: Optional list of dimensions to check. If None, check all.

    Returns:
        ConfidenceResult with per-dimension and overall scores
    """
    dimensions_to_check = analysis_dimensions or list(DIMENSION_FIELDS.keys())
    dimension_results = {}

    for dim in dimensions_to_check:
        if dim not in DIMENSION_FIELDS:
            continue

        config = DIMENSION_FIELDS[dim]
        weights = {"critical": 3, "important": 2, "nice_to_have": 1}

        total_weight = 0
        achieved_weight = 0
        missing = []

        for priority, fields in config.items():
            w = weights[priority]
            for field in fields:
                total_weight += w
                completeness = field_completeness.get(field, 0)
                if completeness >= 80:
                    achieved_weight += w
                elif completeness >= 50:
                    achieved_weight += w * 0.5
                else:
                    missing.append(field)

        score = round(achieved_weight / total_weight * 100, 1) if total_weight > 0 else 0
        level = "high" if score >= 75 else "medium" if score >= 50 else "low"

        dim_label = {
            "oee": "OEE分析", "yield_rate": "良率分析",
            "production_cost": "成本分析", "labor_efficiency": "人效分析",
            "quality_rate": "质量分析"
        }.get(dim, dim)

        if level == "high":
            msg = f"{dim_label}数据充足，分析结果可靠"
        elif level == "medium":
            msg = f"{dim_label}部分字段缺失（{', '.join(missing[:3])}），结果仅供参考"
        else:
            msg = f"{dim_label}关键数据不足（缺失{len(missing)}个字段），建议补充数据后再分析"

        dimension_results[dim] = DimensionConfidence(
            score=score, missing_fields=missing, message=msg, level=level
        )

    # Overall score = weighted average of dimensions
    if dimension_results:
        overall = round(sum(d.score for d in dimension_results.values()) / len(dimension_results), 1)
    else:
        overall = 0

    # Summary message
    low_dims = [k for k, v in dimension_results.items() if v.level == "low"]
    if not low_dims:
        summary = "数据完整度良好，分析结果可信度高"
    elif len(low_dims) <= 2:
        summary = f"部分维度数据不足（{', '.join(low_dims)}），相关分析结果可信度较低"
    else:
        summary = "多个维度数据严重缺失，建议先完善数据采集再进行深度分析"

    return ConfidenceResult(
        overall_score=overall,
        dimensions=dimension_results,
        summary=summary
    )


def format_confidence_for_llm(confidence: ConfidenceResult) -> str:
    """Format confidence info as context string for LLM prompt injection."""
    lines = [f"数据可信度评估（总分: {confidence.overall_score}/100）:"]
    for dim, info in confidence.dimensions.items():
        lines.append(f"  - {dim}: {info.score}分 ({info.level}) - {info.message}")
    lines.append(f"总结: {confidence.summary}")
    lines.append("请在分析中主动说明数据局限性，对低可信度维度给出明确警告。")
    return "\n".join(lines)
