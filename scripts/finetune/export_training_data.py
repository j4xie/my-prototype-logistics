#!/usr/bin/env python3
"""
Training Data Export Pipeline

Merges labeled training samples from multiple sources into a single
incremental training data file for BERT/ONNX fine-tuning:

  1. ZPD labeled data   -- from zpd_label_batch.py output (JSONL)
  2. Shadow disagreements -- from intent_match_records where shadow_agreed = false
  3. User confirmations  -- from intent_match_records where user_confirmed = true

Deduplication: if two texts have Levenshtein similarity ratio > 0.7,
only the one with higher confidence is kept.

Output format (JSONL):
    {"text": "...", "label": "INTENT_CODE", "source": "zpd|shadow|feedback"}

Usage:
    python export_training_data.py
    python export_training_data.py --since-days 14 --output data/incremental_training_data.jsonl
    python export_training_data.py --zpd-file data/zpd_labeled.jsonl
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration defaults
# ---------------------------------------------------------------------------
DEFAULT_OUTPUT = "data/merged_training_data.jsonl"
DEFAULT_ZPD_FILE = "data/zpd_labeled.jsonl"
DEFAULT_ADJUDICATED_FILE = "data/shadow_adjudicated.jsonl"
DEFAULT_SINCE_DAYS = 7
DEDUP_SIMILARITY_THRESHOLD = 0.7


# ---------------------------------------------------------------------------
# Levenshtein similarity (standard library only, no numpy/rapidfuzz)
# ---------------------------------------------------------------------------
def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            # Insertions, deletions, substitutions
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def levenshtein_ratio(s1: str, s2: str) -> float:
    """
    Compute Levenshtein similarity ratio between two strings.

    Returns a float in [0.0, 1.0] where 1.0 means identical.
    """
    if not s1 and not s2:
        return 1.0
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    distance = levenshtein_distance(s1, s2)
    return 1.0 - (distance / max_len)


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------
def get_db_connection() -> psycopg2.extensions.connection:
    """
    Create a PostgreSQL connection using environment variables.

    Env vars (with defaults for local dev):
        POSTGRES_HOST     (default: localhost)
        POSTGRES_PORT     (default: 5432)
        POSTGRES_DB       (default: cretas_db)
        POSTGRES_USER     (default: cretas_user)
        POSTGRES_PASSWORD (default: cretas_pass)
    """
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "cretas_db"),
        user=os.getenv("POSTGRES_USER", "cretas_user"),
        password=os.getenv("POSTGRES_PASSWORD", "cretas_pass"),
    )
    conn.set_client_encoding("UTF8")
    return conn


# ---------------------------------------------------------------------------
# Data source: ZPD labeled file
# ---------------------------------------------------------------------------
def load_zpd_data(zpd_path: Path) -> List[Dict]:
    """
    Load ZPD labeled data from a JSONL file produced by zpd_label_batch.py.

    Each line has: {"text": "...", "label": "INTENT_CODE", "source": "zpd_mko"}
    """
    if not zpd_path.exists():
        logger.warning("ZPD file not found: %s (skipping ZPD source)", zpd_path)
        return []

    records = []
    line_count = 0
    error_count = 0

    with open(zpd_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            line_count += 1
            try:
                record = json.loads(line)
                text = record.get("text", "").strip()
                label = record.get("label", "").strip()
                if not text or not label:
                    error_count += 1
                    continue
                # Skip OOD records for training (they are negative examples,
                # not valid intent labels)
                if label == "OOD":
                    continue
                records.append(
                    {
                        "text": text,
                        "label": label,
                        "source": "zpd",
                        "confidence": 0.9,  # LLM-labeled, high confidence
                    }
                )
            except json.JSONDecodeError:
                logger.warning("Invalid JSON at line %d in %s", line_num, zpd_path)
                error_count += 1

    logger.info(
        "Loaded %d ZPD records from %s (%d lines, %d errors)",
        len(records),
        zpd_path,
        line_count,
        error_count,
    )
    return records


# ---------------------------------------------------------------------------
# Data source: Shadow mode disagreements
# ---------------------------------------------------------------------------
def fetch_shadow_disagreements(conn, since_days: int) -> List[Dict]:
    """
    Query intent_match_records where the shadow classifier disagrees with
    the primary matcher (shadow_agreed = false).

    The shadow_intent_code is used as the candidate correction label.
    We only include records where shadow_confidence is reasonably high.
    """
    query = """
        SELECT user_input, matched_intent_code,
               shadow_intent_code, shadow_confidence,
               confidence_score, match_method
        FROM intent_match_records
        WHERE shadow_agreed = false
          AND shadow_intent_code IS NOT NULL
          AND shadow_confidence IS NOT NULL
          AND shadow_confidence >= 0.6
          AND created_at >= NOW() - INTERVAL '%s days'
        ORDER BY shadow_confidence DESC
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, [since_days])
        rows = cur.fetchall()

    records = []
    for row in rows:
        row = dict(row)
        text = (row.get("user_input") or "").strip()
        label = (row.get("shadow_intent_code") or "").strip()
        if not text or not label:
            continue

        confidence = float(row["shadow_confidence"]) if row.get("shadow_confidence") else 0.5
        records.append(
            {
                "text": text,
                "label": label,
                "source": "shadow",
                "confidence": confidence,
            }
        )

    logger.info(
        "Loaded %d shadow disagreement records from last %d days",
        len(records),
        since_days,
    )
    return records


# ---------------------------------------------------------------------------
# Data source: User confirmed records
# ---------------------------------------------------------------------------
def fetch_user_confirmed(conn, since_days: int) -> List[Dict]:
    """
    Query intent_match_records where the user explicitly confirmed the
    matched intent (user_confirmed = true).

    These are the highest-quality labels because a human validated them.
    If the user selected a different intent (user_selected_intent), use that
    instead of matched_intent_code.
    """
    query = """
        SELECT user_input, matched_intent_code,
               user_selected_intent, confidence_score
        FROM intent_match_records
        WHERE user_confirmed = true
          AND created_at >= NOW() - INTERVAL '%s days'
        ORDER BY created_at DESC
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, [since_days])
        rows = cur.fetchall()

    records = []
    for row in rows:
        row = dict(row)
        text = (row.get("user_input") or "").strip()
        if not text:
            continue

        # Prefer user_selected_intent over matched_intent_code
        label = (row.get("user_selected_intent") or row.get("matched_intent_code") or "").strip()
        if not label:
            continue

        confidence = float(row["confidence_score"]) if row.get("confidence_score") else 0.8
        # User-confirmed records get a confidence boost
        confidence = min(1.0, confidence + 0.1)

        records.append(
            {
                "text": text,
                "label": label,
                "source": "feedback",
                "confidence": confidence,
            }
        )

    logger.info(
        "Loaded %d user-confirmed records from last %d days",
        len(records),
        since_days,
    )
    return records


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------
def deduplicate(records: List[Dict]) -> List[Dict]:
    """
    Deduplicate records by text similarity.

    If two texts have Levenshtein ratio > DEDUP_SIMILARITY_THRESHOLD AND
    share the same label, keep only the one with higher confidence.

    For performance, we group by label first (O(n) per label group instead
    of O(n^2) over all records). We also skip comparison for short texts
    that are very common (< 5 chars).
    """
    if not records:
        return records

    # Group by label for faster comparison
    by_label: Dict[str, List[Dict]] = defaultdict(list)
    for r in records:
        by_label[r["label"]].append(r)

    kept = []
    total_dupes = 0

    for label, group in by_label.items():
        if len(group) <= 1:
            kept.extend(group)
            continue

        # Sort by confidence descending so higher-confidence records come first
        group.sort(key=lambda x: x.get("confidence", 0), reverse=True)

        selected: List[Dict] = []
        for candidate in group:
            is_dup = False
            for existing in selected:
                if len(candidate["text"]) < 5 and len(existing["text"]) < 5:
                    # Very short texts: require exact match
                    if candidate["text"] == existing["text"]:
                        is_dup = True
                        break
                else:
                    ratio = levenshtein_ratio(candidate["text"], existing["text"])
                    if ratio > DEDUP_SIMILARITY_THRESHOLD:
                        is_dup = True
                        break

            if not is_dup:
                selected.append(candidate)
            else:
                total_dupes += 1

        kept.extend(selected)

    logger.info(
        "Deduplication: %d records -> %d records (%d duplicates removed)",
        len(records),
        len(kept),
        total_dupes,
    )
    return kept


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------
def print_summary(records: List[Dict]) -> None:
    """Print summary statistics of the merged training data."""
    if not records:
        logger.info("No records to summarize.")
        return

    source_counts = Counter(r["source"] for r in records)
    label_counts = Counter(r["label"] for r in records)

    logger.info("=" * 60)
    logger.info("Training Data Export Summary")
    logger.info("=" * 60)
    logger.info("  Total records: %d", len(records))
    logger.info("")
    logger.info("  By source:")
    for source, count in sorted(source_counts.items()):
        logger.info("    %-12s %d", source, count)
    logger.info("")
    logger.info("  By label (top 20):")
    for label, count in label_counts.most_common(20):
        logger.info("    %-35s %d", label, count)
    if len(label_counts) > 20:
        logger.info("    ... and %d more labels", len(label_counts) - 20)
    logger.info("")
    logger.info("  Unique labels: %d", len(label_counts))
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Export and merge training data from ZPD labels, shadow disagreements, and user feedback"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=DEFAULT_OUTPUT,
        help=f"Output JSONL file path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--zpd-file",
        type=str,
        default=DEFAULT_ZPD_FILE,
        help=f"Path to ZPD labeled JSONL file (default: {DEFAULT_ZPD_FILE})",
    )
    parser.add_argument(
        "--adjudicated-file",
        type=str,
        default=DEFAULT_ADJUDICATED_FILE,
        help=f"Path to shadow adjudicated JSONL file (default: {DEFAULT_ADJUDICATED_FILE})",
    )
    parser.add_argument(
        "--since-days",
        type=int,
        default=DEFAULT_SINCE_DAYS,
        help=f"Look back N days for DB records (default: {DEFAULT_SINCE_DAYS})",
    )
    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Resolve paths relative to this script's directory
    script_dir = Path(__file__).resolve().parent
    output_path = script_dir / args.output
    zpd_path = script_dir / args.zpd_file
    adjudicated_path = script_dir / args.adjudicated_file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # Source 1: ZPD labeled data (file-based, no DB needed)
    # -----------------------------------------------------------------------
    all_records: List[Dict] = []

    zpd_records = load_zpd_data(zpd_path)
    all_records.extend(zpd_records)

    # -----------------------------------------------------------------------
    # Source 1b: Shadow adjudicated data (from shadow_adjudicate.py)
    # These are LLM-adjudicated labels — higher quality than raw shadow data
    # -----------------------------------------------------------------------
    adjudicated_records = load_zpd_data(adjudicated_path)  # Same JSONL format
    all_records.extend(adjudicated_records)

    # -----------------------------------------------------------------------
    # Sources 2 & 3: Shadow disagreements + User confirmed (DB-based)
    # Note: if adjudicated data exists, raw shadow disagreements are redundant
    # for overlapping records but dedup will handle it
    # -----------------------------------------------------------------------
    try:
        logger.info("Connecting to PostgreSQL...")
        conn = get_db_connection()
    except psycopg2.Error as e:
        logger.warning(
            "Failed to connect to PostgreSQL: %s (skipping DB sources)", e
        )
        conn = None

    if conn is not None:
        try:
            shadow_records = fetch_shadow_disagreements(conn, args.since_days)
            all_records.extend(shadow_records)

            feedback_records = fetch_user_confirmed(conn, args.since_days)
            all_records.extend(feedback_records)
        finally:
            conn.close()
            logger.info("Database connection closed")

    if not all_records:
        logger.info("No records from any source. Nothing to export.")
        sys.exit(0)

    # -----------------------------------------------------------------------
    # Deduplicate
    # -----------------------------------------------------------------------
    logger.info("Running deduplication (threshold=%.2f)...", DEDUP_SIMILARITY_THRESHOLD)
    deduped = deduplicate(all_records)

    # -----------------------------------------------------------------------
    # Write output (strip internal 'confidence' field from final output)
    # -----------------------------------------------------------------------
    with open(output_path, "w", encoding="utf-8") as f:
        for record in deduped:
            output_record = {
                "text": record["text"],
                "label": record["label"],
                "source": record["source"],
            }
            f.write(json.dumps(output_record, ensure_ascii=False) + "\n")

    logger.info("Wrote %d records to %s", len(deduped), output_path)

    # -----------------------------------------------------------------------
    # Print summary
    # -----------------------------------------------------------------------
    print_summary(deduped)


if __name__ == "__main__":
    main()
