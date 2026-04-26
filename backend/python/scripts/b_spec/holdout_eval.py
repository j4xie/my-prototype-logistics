"""B1 baseline evaluation on labeled holdout split.

This evaluates the binary same-entity decision (does pair_a refer to the same
entity as pair_b?), NOT entity → dim_* lookup. The pipeline:
  1. normalize_for_dim(pair_a) == normalize_for_dim(pair_b) → predict 'match'
  2. else cosine(embed(pair_a), embed(pair_b)) >= --threshold → 'match'
  3. else 'no_match'
'unsure' gold rows are excluded from precision/recall but counted in totals.

Spec §4.2.1 ship thresholds: store >=88%, product >=88%, staff >=80%.

Usage:
    python scripts/b_spec/holdout_eval.py --factory F001 --entity-type store
    python scripts/b_spec/holdout_eval.py --factory F001 --entity-type store --split dev
"""
from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable, List, Literal, Optional

from scripts.b_spec._db_helpers import DEFAULT_DSN, acquire_factory_conn
from smartbi.canonical.entity_resolution.agents.deterministic import normalize_for_dim
from smartbi.services.llm_fallback_logger import get_embedding as default_embed

Pred = Literal["match", "no_match"]
EmbedFn = Callable[[str], Awaitable[Optional[List[float]]]]

SPEC_THRESHOLDS = {"store": 0.88, "product": 0.88, "staff": 0.80}


@dataclass
class EvalCounts:
    tp: int = 0
    fp: int = 0
    tn: int = 0
    fn: int = 0
    skipped_unsure: int = 0
    embed_failures: int = 0


def _cosine(a: List[float], b: List[float]) -> float:
    dot = na = nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0 or nb == 0:
        return 0.0
    return dot / ((na ** 0.5) * (nb ** 0.5))


async def predict_pair(
    pair_a: str,
    pair_b: str,
    embed_fn: EmbedFn,
    threshold: float,
    counts: Optional["EvalCounts"] = None,
) -> Pred:
    """Decide same-entity match for a pair via deterministic + embedding."""
    if normalize_for_dim(pair_a) == normalize_for_dim(pair_b):
        return "match"
    emb_a = await embed_fn(pair_a)
    emb_b = await embed_fn(pair_b)
    if emb_a is None or emb_b is None:
        if counts is not None:
            counts.embed_failures += 1
        return "no_match"
    sim = _cosine(emb_a, emb_b)
    return "match" if sim >= threshold else "no_match"


def update_counts(counts: EvalCounts, pred: Pred, gold: str) -> None:
    if gold == "unsure":
        counts.skipped_unsure += 1
        return
    if pred == "match" and gold == "match":
        counts.tp += 1
    elif pred == "match" and gold == "no_match":
        counts.fp += 1
    elif pred == "no_match" and gold == "no_match":
        counts.tn += 1
    elif pred == "no_match" and gold == "match":
        counts.fn += 1


def compute_metrics(c: EvalCounts) -> dict[str, float]:
    decided = c.tp + c.fp + c.tn + c.fn
    precision = c.tp / (c.tp + c.fp) if (c.tp + c.fp) else 0.0
    recall = c.tp / (c.tp + c.fn) if (c.tp + c.fn) else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) else 0.0
    )
    accuracy = (c.tp + c.tn) / decided if decided else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": accuracy,
    }


async def main_async(args: argparse.Namespace) -> int:
    if args.entity_type not in ("store", "product", "staff"):
        print(f"ERROR: invalid entity-type {args.entity_type}")
        return 2
    if args.split not in ("train", "dev", "holdout"):
        print(f"ERROR: invalid split {args.split}")
        return 2

    try:
        from smartbi.config import get_settings
        from food_kb.services.embedding import configure as configure_embedding
        s = get_settings()
        configure_embedding(
            api_key=s.llm_api_key,
            base_url=s.llm_base_url,
            model=s.food_kb_embedding_model,
            dims=s.food_kb_embedding_dims,
        )
    except Exception as exc:
        print(f"WARN: embedding configure failed ({exc}); continuing with deterministic-only.")

    counts = EvalCounts()
    n_total = 0
    async with acquire_factory_conn(args.dsn, args.factory) as conn:
        rows = await conn.fetch(
            """
            SELECT id, pair_a, pair_b, gold_label
            FROM entity_resolution_labels
            WHERE factory_id = $1
              AND entity_type = $2
              AND dataset_split = $3
              AND gold_label IS NOT NULL
            ORDER BY id
            """,
            args.factory, args.entity_type, args.split,
        )
        n_total = len(rows)
        if n_total == 0:
            print(
                f"No gold-labeled rows for split={args.split}, "
                f"entity_type={args.entity_type}."
            )
            return 0

        for i, row in enumerate(rows, start=1):
            pred = await predict_pair(
                row["pair_a"], row["pair_b"], default_embed, args.threshold, counts
            )
            update_counts(counts, pred, row["gold_label"])
            if i % 50 == 0:
                print(f"  ...evaluated {i}/{n_total}")

    metrics = compute_metrics(counts)
    target = SPEC_THRESHOLDS[args.entity_type]
    decision = "PASS" if metrics["accuracy"] >= target else "FAIL"

    print(f"Holdout eval — factory={args.factory}, entity_type={args.entity_type}, "
          f"split={args.split}, n={n_total}")
    print("  Predictions:")
    print(f"    True positives:  {counts.tp}")
    print(f"    False positives: {counts.fp}")
    print(f"    True negatives:  {counts.tn}")
    print(f"    False negatives: {counts.fn}")
    print(f"    Skipped (unsure gold): {counts.skipped_unsure}")
    if counts.embed_failures:
        print(f"    Embedding failures: {counts.embed_failures} (treated as no_match)")
    print(f"  Precision: {metrics['precision']:.3f}")
    print(f"  Recall:    {metrics['recall']:.3f}")
    print(f"  F1:        {metrics['f1']:.3f}")
    print(f"  Accuracy:  {metrics['accuracy']:.3f}  "
          f"← target ≥ {target:.2f} ({decision})")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--factory", required=True)
    p.add_argument(
        "--entity-type", required=True, choices=["store", "product", "staff"]
    )
    p.add_argument("--split", default="holdout", choices=["train", "dev", "holdout"])
    p.add_argument("--threshold", type=float, default=0.7)
    p.add_argument("--dsn", default=DEFAULT_DSN)
    args = p.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
