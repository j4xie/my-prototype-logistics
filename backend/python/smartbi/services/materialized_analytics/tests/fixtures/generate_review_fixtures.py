"""generate_review_fixtures.py — regenerate synthetic test xlsx fixtures.

Usage:
    cd backend/python/smartbi/services/materialized_analytics/tests/fixtures
    python generate_review_fixtures.py

Reads qhj Q3 review xlsx (12,904 rows, 30 cols) and produces:
  1. qhj_3975_meituan_renamed.xlsx — same data, columns renamed to 美团 style
     for verifying multi-merchant column detection works.
  2. qhj_3975_no_review_cols.xlsx — first 100 rows, ONLY non-review columns
     (no 星级 / 口味分 / etc.) for verifying applies() returns False.

Both fixtures committed to git as part of Slice 4 POC test infrastructure.
"""
from __future__ import annotations

import os
import sys

import pandas as pd


_HERE = os.path.dirname(os.path.abspath(__file__))
# fixtures → tests → materialized_analytics → services → smartbi → python → backend → project root
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "..", "..", "..", ".."))
SOURCE_XLSX = os.path.join(
    _PROJECT_ROOT,
    "smartbi维度分析", "大众点评", "真实餐饮连锁数据", "青花椒",
    "评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx",
)

MEITUAN_RENAMED_OUT = os.path.join(_HERE, "qhj_3975_meituan_renamed.xlsx")
NO_REVIEW_COLS_OUT = os.path.join(_HERE, "qhj_3975_no_review_cols.xlsx")


# Column rename map (qhj 大众点评 actual → 美团-style variants).
# Picks variants listed in schema_helpers candidate tuples so the helpers
# should still detect them, just via a different priority slot.
#
# IMPORTANT: source xlsx actual column names verified empirically:
#   评价门店 (not 具体门店) — priority-2 in _REVIEW_STORE_CANDIDATES
#   星级分 (not 星级) — priority-1 in _STAR_CANDIDATES
#   评价时间, 平台 — match expected
MEITUAN_RENAME = {
    "评价门店": "分店",          # priority-2 → priority-5 (last variant)
    "星级分":   "评分",          # priority-1 → priority-2
    "评价时间": "评论时间",      # priority-1 → priority-2
    "平台":     "渠道",          # priority-1 → priority-3
    # Unchanged (single-candidate fields): 口味分 / 环境分 / 服务分 /
    # 是否vip / 投诉状态 / 菜品标签
}


def main():
    if not os.path.exists(SOURCE_XLSX):
        print(f"ERROR: source xlsx not found at {SOURCE_XLSX}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading source xlsx ({os.path.getsize(SOURCE_XLSX) / 1024 / 1024:.1f} MB)...")
    df = pd.read_excel(SOURCE_XLSX, engine="openpyxl")
    print(f"  loaded {len(df):,} rows x {len(df.columns)} cols")

    # Fixture 1: 美团-renamed (full data)
    print("\nGenerating qhj_3975_meituan_renamed.xlsx...")
    renamed_df = df.rename(columns=MEITUAN_RENAME)
    renamed_df.to_excel(MEITUAN_RENAMED_OUT, index=False, engine="openpyxl")
    print(f"  wrote {os.path.getsize(MEITUAN_RENAMED_OUT) / 1024 / 1024:.1f} MB to {os.path.basename(MEITUAN_RENAMED_OUT)}")  # noqa: E501
    print(f"  renamed cols: {list(MEITUAN_RENAME.items())}")

    # Fixture 2: no review cols (first 100 rows, dropped any rating/review column)
    print("\nGenerating qhj_3975_no_review_cols.xlsx...")
    drop_kws = ("星级", "评分", "口味", "环境", "服务",
                "评价", "评论", "投诉", "菜品标签",
                "VIP", "vip", "门店", "店铺", "分店", "门市")
    drop_cols = [c for c in df.columns if any(kw in c for kw in drop_kws)]
    print(f"  dropping {len(drop_cols)} review-related cols: {drop_cols}")
    no_review_df = df.head(100).drop(columns=drop_cols)
    print(f"  result: {len(no_review_df)} rows x {len(no_review_df.columns)} cols (kept: {list(no_review_df.columns)})")
    no_review_df.to_excel(NO_REVIEW_COLS_OUT, index=False, engine="openpyxl")
    print(f"  wrote {os.path.getsize(NO_REVIEW_COLS_OUT) / 1024:.1f} KB to {os.path.basename(NO_REVIEW_COLS_OUT)}")

    print("\nDone.")


if __name__ == "__main__":
    main()
