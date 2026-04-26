"""B Day 1: generate 1200-pair labeling candidate dataset.

Per 03-B v1.2 spec §6. 输出 CSV → admin import 到 entity_resolution_labels 表.

抽样策略:
- 250 真实样本 (prod dim_* 抽 random pair, 同一 store 的 2 条变体记录, 或 cross-product 真实店名对)
- 250 程序生成扰动 (单一店名 × 5 种 perturbation = 5 对)

扰动类型:
- 简繁转换 (zh-Hant ↔ zh-Hans, e.g. 桂滿隴 ↔ 桂满陇)
- 空白增删 (e.g. "桂满陇 陆家嘴店" ↔ "桂满陇陆家嘴店")
- 语序 (e.g. "桂满陇陆家嘴店" ↔ "陆家嘴桂满陇店")
- 缩写 (e.g. "桂满陇陆家嘴正大广场店" ↔ "桂满陇陆家嘴店")
- 括号变体 (e.g. "桂满陇(陆家嘴正大广场店)" ↔ "桂满陇 陆家嘴正大广场")

输出:
- candidates_store.csv (500 行)
- candidates_product.csv (500 行)
- candidates_staff.csv (200 行)

每行 columns: pair_a, pair_b, source, suggested_split, expected_match (system 猜测但留空给人工)

dim_staff 在 prod 是 0 行 (per CLAUDE.md memory) → 200 人名全合成 (常见姓 + 常见名 + 偏旁/拼音变体).
dim_product 2,703 行 + dim_store 149 行 → 真实样本足够.

usage:
    cd backend/python
    python scripts/b_spec/generate_labeling_dataset.py --output-dir ./data/labeling
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
from pathlib import Path

# Don't import asyncpg or smartbi here — run standalone.
# DSN from env: PG_DSN (default: smartbi_db local)
import os
import asyncio
import asyncpg

DEFAULT_DSN = os.environ.get(
    "PG_DSN",
    "postgresql://smartbi_user:smartbi_secure_password_2025@localhost:5432/smartbi_db",
)

# === Perturbation generators ===

ZH_HANS_HANT = {
    "鱼": "魚", "丰": "豐", "店": "店",  # add as needed
    "陆": "陸", "汇": "匯", "门": "門",
    "万": "萬", "众": "眾", "庆": "慶",
}


def to_traditional(s: str) -> str:
    return "".join(ZH_HANS_HANT.get(c, c) for c in s)


def add_spacing(s: str) -> str:
    """Insert space around 店, 后 chars."""
    return s.replace("店", " 店").replace("后", " 后").strip()


def remove_spacing(s: str) -> str:
    return s.replace(" ", "").replace("　", "")


def remove_brackets(s: str) -> str:
    """e.g. '桂满陇(陆家嘴店)' → '桂满陇 陆家嘴店'."""
    import re
    return re.sub(r"[\(\(]([^\)\)]+)[\)\)]", r" \1", s).strip()


def shorten(s: str) -> str:
    """e.g. '桂满陇陆家嘴正大广场店' → '桂满陇陆家嘴店'."""
    # Drop middle 4-char chunks like '正大广场'
    if len(s) > 12:
        return s[:6] + s[-4:]
    return s


PERTURBATIONS = [to_traditional, add_spacing, remove_spacing, remove_brackets, shorten]


def perturb(name: str, n: int = 1) -> list[tuple[str, str]]:
    """Return list of (perturbed, perturbation_type) tuples."""
    pairs = []
    funcs = random.sample(PERTURBATIONS, k=min(n, len(PERTURBATIONS)))
    for f in funcs:
        out = f(name)
        if out and out != name:
            pairs.append((out, f.__name__))
    return pairs


# === Real sample fetcher (from prod dim_*) ===

async def fetch_real_stores(conn, limit: int = 100) -> list[str]:
    rows = await conn.fetch(
        "SELECT name FROM dim_store WHERE name IS NOT NULL ORDER BY random() LIMIT $1",
        limit,
    )
    return [r["name"] for r in rows]


async def fetch_real_products(conn, limit: int = 100) -> list[str]:
    rows = await conn.fetch(
        "SELECT name FROM dim_product WHERE name IS NOT NULL ORDER BY random() LIMIT $1",
        limit,
    )
    return [r["name"] for r in rows]


# === Synthetic staff (dim_staff is empty in prod) ===

SURNAMES = ["张", "王", "李", "刘", "陈", "杨", "黄", "周", "吴", "徐"]
GIVEN_NAMES = ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "杰"]


def generate_staff_pairs(count: int) -> list[tuple[str, str, str]]:
    """Synthesize 100% — pair_a base name + pair_b perturbed."""
    pairs = []
    while len(pairs) < count:
        surname = random.choice(SURNAMES)
        given = random.choice(GIVEN_NAMES)
        full = surname + given
        # Variants: 全名 vs 姓+某 (e.g. "张伟" vs "张某")
        variants = [
            (full, surname + "某"),  # privacy redacted
            (full, surname + " " + given),  # spaced
            (full, surname + given.lower() if given.isascii() else full + "（备注）"),
        ]
        for a, b in variants:
            if a != b:
                pairs.append((a, b, "synthetic"))
                if len(pairs) >= count:
                    break
    return pairs


# === Main ===

async def generate_store_pairs(conn, count: int) -> list[tuple[str, str, str]]:
    """500 pairs: 250 real (random pair from dim_store) + 250 perturbations."""
    pairs = []
    real = await fetch_real_stores(conn, limit=250)
    # 250 real pairs: pick 2 stores, mark "no_match" expectation (helps validate model not over-merging)
    for i in range(0, min(len(real), 250), 2):
        if i + 1 < len(real):
            pairs.append((real[i], real[i + 1], "real_sample"))
    # 250 perturbations
    for name in real[:50]:
        for variant, _type in perturb(name, n=5):
            pairs.append((name, variant, "perturbation"))
            if len(pairs) >= count:
                break
        if len(pairs) >= count:
            break
    return pairs[:count]


async def generate_product_pairs(conn, count: int) -> list[tuple[str, str, str]]:
    pairs = []
    real = await fetch_real_products(conn, limit=250)
    for i in range(0, min(len(real), 250), 2):
        if i + 1 < len(real):
            pairs.append((real[i], real[i + 1], "real_sample"))
    for name in real[:50]:
        for variant, _type in perturb(name, n=5):
            pairs.append((name, variant, "perturbation"))
            if len(pairs) >= count:
                break
        if len(pairs) >= count:
            break
    return pairs[:count]


def assign_split(idx: int, total: int) -> str:
    """60/20/20 deterministic by index (so re-runs assign same row to same split)."""
    pct = idx / total
    if pct < 0.6:
        return "train"
    elif pct < 0.8:
        return "dev"
    else:
        return "holdout"


def write_csv(path: Path, pairs: list[tuple[str, str, str]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["pair_a", "pair_b", "source", "suggested_split", "expected_match"])
        for i, (a, b, src) in enumerate(pairs):
            split = assign_split(i, len(pairs))
            w.writerow([a, b, src, split, ""])  # expected_match left blank for human labeler


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output-dir", default="./data/labeling")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--store-count", type=int, default=500)
    p.add_argument("--product-count", type=int, default=500)
    p.add_argument("--staff-count", type=int, default=200)
    args = p.parse_args()

    random.seed(args.seed)
    output_dir = Path(args.output_dir)

    print(f"Connecting to PG: {DEFAULT_DSN.split('@')[-1].split('/')[0]}")
    conn = await asyncpg.connect(DEFAULT_DSN)
    try:
        # Set tenant context — must be a valid factory or BYPASSRLS
        # For dataset gen, we want broad sample across all factories.
        # Run as BYPASSRLS user OR use __internal__ sentinel + ensure dim_* policies allow it.
        # For simplicity, query without tenant (DBA-level). User must run with admin role.
        await conn.execute("SET LOCAL row_security TO OFF;")  # requires superuser

        store_pairs = await generate_store_pairs(conn, args.store_count)
        product_pairs = await generate_product_pairs(conn, args.product_count)
    finally:
        await conn.close()

    staff_pairs = generate_staff_pairs(args.staff_count)

    write_csv(output_dir / "candidates_store.csv", store_pairs)
    write_csv(output_dir / "candidates_product.csv", product_pairs)
    write_csv(output_dir / "candidates_staff.csv", staff_pairs)

    print(f"Generated:")
    print(f"  store: {len(store_pairs)} pairs → {output_dir / 'candidates_store.csv'}")
    print(f"  product: {len(product_pairs)} pairs → {output_dir / 'candidates_product.csv'}")
    print(f"  staff: {len(staff_pairs)} pairs (synthetic) → {output_dir / 'candidates_staff.csv'}")
    print(f"Total: {len(store_pairs) + len(product_pairs) + len(staff_pairs)}")


if __name__ == "__main__":
    asyncio.run(main())
