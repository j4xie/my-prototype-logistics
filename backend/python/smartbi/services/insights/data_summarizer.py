from __future__ import annotations
"""
Data preparation utilities: DataFrame-to-text summary, column humanization,
digest computation, and placeholder detection.

All functions are stateless (no LLM calls).
"""
import json
import logging
import re
from typing import List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Column humanization
# ---------------------------------------------------------------------------

def humanize_col(name: str) -> str:
    """Humanize a single column name for LLM prompts.

    Transforms:
      'Column_34' -> '指标34'
      '2025-01-01' -> '1月'
      '2025-01-01_预算数' -> '1月预算数'
      '2025-02-01_实际数' -> '2月实际数'
    """
    if not name or not isinstance(name, str):
        return str(name)
    # Column_N -> 指标N
    m = re.match(r'^Column_(\d+)$', name, re.IGNORECASE)
    if m:
        return f"指标{m.group(1)}"
    # YYYY-MM-DD_suffix -> M月suffix
    m = re.match(r'^(\d{4})-(\d{2})-\d{2}_(.+)$', name)
    if m:
        month = int(m.group(2))
        return f"{month}月{m.group(3)}"
    # Bare YYYY-MM-DD -> M月
    m = re.match(r'^(\d{4})-(\d{2})-\d{2}$', name)
    if m:
        month = int(m.group(2))
        return f"{month}月"
    return name


def humanize_df_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of *df* with humanized column names (for LLM prompts only)."""
    new_cols: dict[str, str] = {}
    seen: dict[str, int] = {}
    for c in df.columns:
        humanized = humanize_col(c)
        count = seen.get(humanized, 0)
        seen[humanized] = count + 1
        new_cols[c] = f"{humanized}_{count + 1}" if count else humanized
    return df.rename(columns=new_cols)


def is_placeholder_col(name: str) -> bool:
    """Check if a column name is an auto-generated placeholder (no business meaning)."""
    s = str(name)
    return bool(re.match(
        r'^(Column_\d+|指标\d+|数据列\d+|Unnamed|Unnamed:\s*\d+)$', s, re.IGNORECASE,
    ))


# ---------------------------------------------------------------------------
# Data summaries for LLM prompts
# ---------------------------------------------------------------------------

def prepare_data_summary(df: pd.DataFrame) -> str:
    """Prepare enriched data summary for LLM."""
    df = humanize_df_columns(df)
    meaningful_cols = [c for c in df.columns if not is_placeholder_col(c)]
    df = df[meaningful_cols]

    summary_parts = [
        f"- 数据行数: {len(df)}",
        f"- 数据列 ({len(df.columns)}个): {', '.join(df.columns.tolist()[:15])}",
    ]

    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        label_col = text_cols[0]
        labels = df[label_col].dropna().unique().tolist()
        if labels:
            summary_parts.append(
                f"- 数据项目({label_col}): {', '.join(str(l) for l in labels[:20])}"
            )

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols[:8]:
        values = df[col].dropna()
        if len(values) == 0:
            continue
        parts = [
            f"总计={values.sum():,.2f}", f"均值={values.mean():,.2f}",
            f"中位数={values.median():,.2f}", f"最大={values.max():,.2f}",
            f"最小={values.min():,.2f}",
        ]
        if len(values) >= 3:
            first, last = values.iloc[0], values.iloc[-1]
            if abs(first) > 1e-6:
                change_pct = ((last - first) / abs(first)) * 100
                parts.append(f"首尾变化={change_pct:+.1f}%")
        summary_parts.append(f"- {col}: {', '.join(parts)}")

    if len(df) > 0:
        sample_rows = df.head(3).to_dict('records')
        sample_text = json.dumps(sample_rows, ensure_ascii=False, default=str)
        if len(sample_text) < 1500:
            summary_parts.append(f"\n样本数据(前3行):\n{sample_text}")

    return "\n".join(summary_parts)


def prepare_metrics_summary(metrics: List[dict]) -> str:
    """Prepare metrics summary text for LLM."""
    summary_parts: List[str] = []
    for m in metrics:
        if m.get("success") and m.get("value") is not None:
            summary_parts.append(
                f"- {m.get('name', m.get('metric'))}: {m.get('value'):,.2f}{m.get('unit', '')}"
            )
    return "\n".join(summary_parts)


def compute_statistical_digest(df: pd.DataFrame) -> str:
    """Pre-compute key statistical digest (MoM change, share ranking, outliers)
    as prompt 'ingredients' for LLM."""
    df = humanize_df_columns(df)
    parts: List[str] = []

    numeric_cols = [
        c for c in df.select_dtypes(include=[np.number]).columns.tolist()
        if not re.match(
            r'^(Column_\d+|指标\d+|Unnamed|Unnamed:\s*\d+)$', str(c), re.IGNORECASE,
        )
    ]
    text_cols = df.select_dtypes(include=['object']).columns

    if not numeric_cols:
        return ""

    parts.append("## 预计算统计摘要")

    # 1. Month-over-month change
    monthly_cols = [
        c for c in numeric_cols
        if pd.to_datetime(c, errors='coerce', format='%Y-%m-%d') is not pd.NaT
        or any(p in str(c) for p in ['月', '年', 'Q', 'q'])
    ]

    if len(monthly_cols) >= 2 and len(text_cols) > 0:
        label_col = text_cols[0]
        mom_parts: List[str] = []
        for _, row in df.head(10).iterrows():
            label = str(row.get(label_col, '')).strip()
            if not label:
                continue
            vals = []
            for mc in monthly_cols:
                v = row.get(mc)
                if pd.notna(v) and isinstance(v, (int, float)):
                    vals.append((str(mc), float(v)))
            if len(vals) >= 2:
                prev_name, prev_val = vals[-2]
                curr_name, curr_val = vals[-1]
                if abs(prev_val) > 1e-6:
                    mom_pct = ((curr_val - prev_val) / abs(prev_val)) * 100
                    mom_parts.append(
                        f"  {label}: {curr_name}环比{mom_pct:+.1f}% "
                        f"({prev_val:,.0f} -> {curr_val:,.0f})"
                    )
        if mom_parts:
            parts.append("### 环比变化（最近两期）")
            parts.extend(mom_parts[:8])

    # 2. Share ranking (first numeric column)
    if len(numeric_cols) >= 1 and len(text_cols) > 0:
        label_col = text_cols[0]
        first_num_col = numeric_cols[0]
        valid_rows = df[[label_col, first_num_col]].dropna()
        valid_rows = valid_rows[
            valid_rows[first_num_col].apply(lambda x: isinstance(x, (int, float)) and x != 0)
        ]
        if len(valid_rows) >= 3:
            total = valid_rows[first_num_col].sum()
            if abs(total) > 1e-6:
                sorted_rows = valid_rows.sort_values(first_num_col, ascending=False).head(5)
                rank_parts: List[str] = []
                for _, row in sorted_rows.iterrows():
                    val = row[first_num_col]
                    pct = (val / abs(total)) * 100
                    rank_parts.append(f"  {row[label_col]}: {val:,.0f} (占{pct:.1f}%)")
                if rank_parts:
                    parts.append(f"### 占比排序（按{first_num_col}降序，前5）")
                    parts.extend(rank_parts)

    # 3. Outlier detection (>2 std from mean)
    anomaly_parts: List[str] = []
    for col in numeric_cols[:6]:
        values = df[col].dropna()
        values = values[values.apply(lambda x: isinstance(x, (int, float)))]
        if len(values) < 5:
            continue
        mean_val = values.mean()
        std_val = values.std()
        if std_val == 0 or abs(mean_val) < 1e-6:
            continue
        outliers = values[abs(values - mean_val) > 2 * std_val]
        for idx in outliers.index[:2]:
            val = outliers[idx]
            dev = ((val - mean_val) / abs(mean_val)) * 100
            direction = "高于" if val > mean_val else "低于"
            row_label = ""
            if len(text_cols) > 0:
                try:
                    row_label = f" ({df.loc[idx, text_cols[0]]})"
                except Exception:
                    pass
            anomaly_parts.append(
                f"  {col}{row_label}: {val:,.0f}, {direction}均值{abs(dev):.0f}%"
            )

    if anomaly_parts:
        parts.append("### 异常值（偏离均值>2倍标准差）")
        parts.extend(anomaly_parts[:6])

    return "\n".join(parts) if len(parts) > 1 else ""
