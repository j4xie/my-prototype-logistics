"""
Convert restaurant chain CSV exports (from POS systems like 哗啦啦) to clean .xlsx files
suitable for SmartBI upload.

These CSVs have 3 metadata rows before the actual column headers:
  Row 0: Report title (e.g. "商品销量报表")
  Row 1: Brand/store header (e.g. "门店名称:九记·東門口")
  Row 2: Query parameters (very long filter string)
  Row 3: Actual column headers
  Row 4+: Data rows

This script strips the metadata rows and saves clean Excel files.

Usage:
    python scripts/tools/convert_restaurant_csv_to_xlsx.py
"""
import os
import sys

import pandas as pd


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
INPUT_DIR = os.path.join(PROJECT_ROOT, "smartbi维度分析", "大众点评", "真实餐饮连锁数据")
OUTPUT_DIR = os.path.join(INPUT_DIR, "xlsx")

FILES = {
    "东门口2月商品销量报表.csv": "东门口2月商品销量报表.xlsx",
    "东门口2月采购入库明细报表.csv": "东门口2月采购入库明细报表.xlsx",
    "青花椒2约销量报表.csv": "青花椒2月销量报表.xlsx",
}


def convert_csv_to_xlsx(csv_path: str, xlsx_path: str, skip_rows: int = 3) -> int:
    """Read a POS-exported CSV, strip metadata rows, save as .xlsx.

    Returns the number of data rows written.
    """
    df = pd.read_csv(
        csv_path,
        encoding="utf-8-sig",
        skiprows=skip_rows,
        dtype=str,          # Keep all as string initially to avoid float issues
        on_bad_lines="skip",
    )

    # Clean column headers
    df.columns = [str(c).strip() for c in df.columns]

    # Drop fully empty columns (trailing commas create unnamed cols)
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df = df.dropna(how="all")

    # Convert numeric-looking columns
    for col in df.columns:
        try:
            converted = pd.to_numeric(df[col], errors="coerce")
            # Only convert if >50% of non-null values are numeric
            non_null = df[col].dropna()
            if len(non_null) > 0:
                numeric_ratio = converted.notna().sum() / len(non_null)
                if numeric_ratio > 0.5:
                    df[col] = converted
        except (ValueError, TypeError):
            pass

    os.makedirs(os.path.dirname(xlsx_path), exist_ok=True)
    df.to_excel(xlsx_path, index=False, engine="openpyxl")
    return len(df)


def main():
    print(f"Input directory : {INPUT_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    for csv_name, xlsx_name in FILES.items():
        csv_path = os.path.join(INPUT_DIR, csv_name)
        xlsx_path = os.path.join(OUTPUT_DIR, xlsx_name)

        if not os.path.exists(csv_path):
            print(f"  SKIP  {csv_name} (not found)")
            continue

        row_count = convert_csv_to_xlsx(csv_path, xlsx_path)
        size_kb = os.path.getsize(xlsx_path) / 1024
        print(f"  OK    {csv_name} -> {xlsx_name}  ({row_count} rows, {size_kb:.0f} KB)")

    print("\nDone.")


if __name__ == "__main__":
    main()
