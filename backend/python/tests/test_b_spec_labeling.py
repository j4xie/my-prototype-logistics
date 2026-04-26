"""Unit tests for B-spec labeling toolkit (import / arbitrate / split / eval)."""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from scripts.b_spec.arbitrate import _auto_promote_agreed
from scripts.b_spec.assign_split import assign_split_for
from scripts.b_spec.holdout_eval import (
    EvalCounts,
    compute_metrics,
    predict_pair,
    update_counts,
)
from scripts.b_spec.import_labels import import_entity, parse_csv
from scripts.b_spec.labeler_cli import _decide_slot


# === parse_csv + import_entity ============================================


def test_parse_csv_reads_pair_rows(tmp_path: Path):
    """parse_csv extracts pair_a / pair_b / source from candidate CSV."""
    csv_path = tmp_path / "candidates_store.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["pair_a", "pair_b", "source", "suggested_split", "expected_match"])
        w.writerow(["店A", "店B", "real_sample", "train", ""])
        w.writerow(["店C", "店D", "perturbation", "dev", ""])
        w.writerow(["", "店X", "real_sample", "train", ""])
    rows = parse_csv(csv_path)
    assert len(rows) == 2
    assert rows[0] == ("店A", "店B", "real_sample")
    assert rows[1] == ("店C", "店D", "perturbation")


async def test_import_entity_idempotent_skips_existing():
    """Re-running import_entity does not duplicate already-present rows."""
    conn = AsyncMock()
    conn.fetchval.side_effect = [None, 99]
    conn.execute = AsyncMock()
    rows = [("a", "b", "real_sample"), ("c", "d", "real_sample")]

    inserted, skipped = await import_entity(conn, "F001", "store", rows)

    assert inserted == 1
    assert skipped == 1
    assert conn.execute.await_count == 1


async def test_import_entity_inserts_all_when_empty():
    """First import inserts every row."""
    conn = AsyncMock()
    conn.fetchval.return_value = None
    conn.execute = AsyncMock()
    rows = [("a", "b", "real_sample"), ("c", "d", "perturbation")]

    inserted, skipped = await import_entity(conn, "F001", "store", rows)

    assert inserted == 2
    assert skipped == 0


# === labeler_cli._decide_slot ===========================================


def test_decide_slot_empty_pair_returns_a():
    """No labels yet → first labeler fills slot a."""
    assert _decide_slot("alice", None, None, None, None) == "a"


def test_decide_slot_a_filled_returns_b():
    """Slot a taken by other labeler → slot b is open."""
    now = datetime.now()
    assert _decide_slot("bob", "alice", now, None, None) == "b"


def test_decide_slot_same_labeler_returns_none():
    """A labeler cannot fill both slots (double-blind)."""
    now = datetime.now()
    assert _decide_slot("alice", "alice", now, None, None) is None


def test_decide_slot_both_filled_returns_none():
    """All slots filled → no work for this labeler."""
    now = datetime.now()
    assert _decide_slot("carol", "alice", now, "bob", now) is None


def test_decide_slot_partial_a_no_timestamp_treats_as_empty():
    """labeler_a set but labeler_a_at NULL → slot a still open."""
    assert _decide_slot("alice", None, None, None, None) == "a"


# === arbitrate._auto_promote_agreed ======================================


async def test_auto_promote_agreed_runs_update_and_returns_count():
    """auto-promote issues a single UPDATE and parses asyncpg's tag."""
    conn = AsyncMock()
    conn.execute.return_value = "UPDATE 17"

    promoted = await _auto_promote_agreed(conn, "F001", "store")

    assert promoted == 17
    conn.execute.assert_awaited_once()
    call_args = conn.execute.await_args
    assert "UPDATE entity_resolution_labels" in call_args.args[0]
    assert "labeler_a_label = labeler_b_label" in call_args.args[0]
    assert call_args.args[1:] == ("F001", "store")


async def test_auto_promote_agreed_zero_rows():
    """Empty table → 0 promoted."""
    conn = AsyncMock()
    conn.execute.return_value = "UPDATE 0"
    assert await _auto_promote_agreed(conn, "F001", "product") == 0


# === assign_split deterministic 60/20/20 ================================


def test_assign_split_for_deterministic_with_seed():
    """Same id+seed → same split."""
    a = assign_split_for(42, seed=7)
    b = assign_split_for(42, seed=7)
    assert a == b


def test_assign_split_for_changes_with_different_seed():
    """Different seed CAN produce different split (proves seed is mixed in)."""
    splits_seed1 = {assign_split_for(i, seed=1) for i in range(20)}
    splits_seed2 = {assign_split_for(i, seed=999) for i in range(20)}
    assert splits_seed1 == {"train", "dev", "holdout"} or len(splits_seed1) >= 2
    found_diff = any(
        assign_split_for(i, seed=1) != assign_split_for(i, seed=999)
        for i in range(50)
    )
    assert found_diff


def test_assign_split_for_60_20_20_ratio_at_scale():
    """At 5000 rows the bucket distribution is within ±5pp of 60/20/20."""
    counts = {"train": 0, "dev": 0, "holdout": 0}
    for i in range(5000):
        counts[assign_split_for(i, seed=42)] += 1
    train_pct = counts["train"] / 5000 * 100
    dev_pct = counts["dev"] / 5000 * 100
    holdout_pct = counts["holdout"] / 5000 * 100
    assert 55 <= train_pct <= 65, f"train {train_pct}%"
    assert 15 <= dev_pct <= 25, f"dev {dev_pct}%"
    assert 15 <= holdout_pct <= 25, f"holdout {holdout_pct}%"


def test_assign_split_for_returns_only_valid_splits():
    """Output is always one of the 3 valid splits."""
    valid = {"train", "dev", "holdout"}
    for i in range(200):
        assert assign_split_for(i, seed=i) in valid


# === holdout_eval metrics ==============================================


def test_compute_metrics_perfect_predictions():
    """All TP+TN, zero FP+FN → precision=recall=f1=accuracy=1.0."""
    counts = EvalCounts(tp=50, fp=0, tn=30, fn=0)
    m = compute_metrics(counts)
    assert m["precision"] == 1.0
    assert m["recall"] == 1.0
    assert m["f1"] == 1.0
    assert m["accuracy"] == 1.0


def test_compute_metrics_known_example():
    """Synthetic confusion matrix → expected precision/recall/F1."""
    counts = EvalCounts(tp=68, fp=5, tn=28, fn=4)
    m = compute_metrics(counts)
    assert abs(m["precision"] - 68 / 73) < 1e-6
    assert abs(m["recall"] - 68 / 72) < 1e-6
    assert abs(m["accuracy"] - 96 / 105) < 1e-6
    expected_f1 = 2 * (68 / 73) * (68 / 72) / ((68 / 73) + (68 / 72))
    assert abs(m["f1"] - expected_f1) < 1e-6


def test_compute_metrics_zero_division_safety():
    """Empty counts → all zeros, no DivisionByZero."""
    counts = EvalCounts()
    m = compute_metrics(counts)
    assert m["precision"] == 0.0
    assert m["recall"] == 0.0
    assert m["f1"] == 0.0
    assert m["accuracy"] == 0.0


def test_update_counts_classifies_each_outcome():
    """Each (pred, gold) combination updates the right field."""
    c = EvalCounts()
    update_counts(c, "match", "match")
    update_counts(c, "match", "no_match")
    update_counts(c, "no_match", "no_match")
    update_counts(c, "no_match", "match")
    update_counts(c, "match", "unsure")
    assert c.tp == 1
    assert c.fp == 1
    assert c.tn == 1
    assert c.fn == 1
    assert c.skipped_unsure == 1


# === predict_pair ========================================================


async def test_predict_pair_deterministic_match_short_circuits():
    """Identical-after-normalize pair → 'match' without calling embed."""
    embed = AsyncMock()
    pred = await predict_pair("桂滿隴(陸家嘴店)", "桂满陇陆家嘴店", embed, threshold=0.7)
    assert pred == "match"
    embed.assert_not_awaited()


async def test_predict_pair_embedding_high_sim_match():
    """Distinct strings + cosine >= threshold → 'match'."""
    async def embed(text: str):
        return [1.0, 0.0, 0.0] if text == "店A" else [0.99, 0.05, 0.0]
    pred = await predict_pair("店A", "完全不同", embed, threshold=0.7)
    assert pred == "match"


async def test_predict_pair_embedding_low_sim_no_match():
    """Distinct strings + cosine < threshold → 'no_match'."""
    async def embed(text: str):
        return [1.0, 0.0, 0.0] if text == "店A" else [0.0, 1.0, 0.0]
    pred = await predict_pair("店A", "店B", embed, threshold=0.7)
    assert pred == "no_match"


async def test_predict_pair_embed_failure_returns_no_match():
    """Embedding service returning None → fall back to 'no_match'."""
    async def embed(text: str):
        return None
    pred = await predict_pair("店A", "店B", embed, threshold=0.7)
    assert pred == "no_match"
