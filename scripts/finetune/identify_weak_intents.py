#!/usr/bin/env python3
"""
Identify Weak Intent Classes

Evaluates per-intent accuracy and pseudo-F1 by running test queries through
the classifier API. Outputs intents below a configurable F1 threshold to
data/weak_intents.json for downstream synthesis.

Data sources (in priority order):
  1. Parse test definitions from --test-results file (default: tests/intent-routing-e2e-150.py)
  2. Query ai_intent_configs from PostgreSQL to get intent codes + example_queries

Classifier: HTTP POST to http://localhost:8083/api/classifier/classify

Usage:
  python identify_weak_intents.py
  python identify_weak_intents.py --threshold 0.50 --source db
  python identify_weak_intents.py --test-results tests/intent-routing-e2e-150.py --output data/weak_intents.json
"""

import argparse
import ast
import json
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import psycopg2
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_TEST_FILE = PROJECT_ROOT / "tests" / "intent-routing-e2e-150.py"
DEFAULT_OUTPUT = SCRIPT_DIR / "data" / "weak_intents.json"
DEFAULT_CLASSIFIER_URL = "http://localhost:8083/api/classifier/classify"

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "cretas_db")
DB_USER = os.environ.get("DB_USER", "cretas_user")
DB_PASS = os.environ.get("DB_PASSWORD", "cretas_pass")


# ---------------------------------------------------------------------------
# Test file parser
# ---------------------------------------------------------------------------
def parse_test_file(filepath: Path) -> Dict[str, List[Tuple[str, List[str]]]]:
    """
    Parse the E2E test file to extract per-intent test samples.

    Returns:
        Dict mapping intent_code -> list of (query_text, acceptable_intents)
    """
    logger.info("Parsing test file: %s", filepath)

    content = filepath.read_text(encoding="utf-8")

    # Extract the `categories` dict via regex — find all test case tuples
    # Format: ('query text', 'TYPE', 'INTENT1|INTENT2|...', 'description'),
    pattern = re.compile(
        r"\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)"
    )

    # intent_code -> [(query_text, [acceptable_intents])]
    intent_samples: Dict[str, List[Tuple[str, List[str]]]] = defaultdict(list)
    total_samples = 0

    for match in pattern.finditer(content):
        query_text = match.group(1)
        # expected_type = match.group(2)  # CONSULT, QUERY, WRITE, or compound
        acceptable_intents_str = match.group(3)
        # description = match.group(4)

        acceptable_intents = [
            i.strip() for i in acceptable_intents_str.split("|") if i.strip()
        ]

        # The first intent in the pipe-separated list is the primary expected intent.
        # We track this sample under EACH acceptable intent so we can measure recall.
        # But for accuracy computation, we only count the PRIMARY (first) intent.
        primary_intent = acceptable_intents[0]
        intent_samples[primary_intent].append((query_text, acceptable_intents))
        total_samples += 1

    logger.info(
        "Parsed %d test samples across %d primary intents",
        total_samples,
        len(intent_samples),
    )
    return dict(intent_samples)


# ---------------------------------------------------------------------------
# Database source
# ---------------------------------------------------------------------------
def load_intents_from_db() -> Dict[str, List[Tuple[str, List[str]]]]:
    """
    Load intent configs from PostgreSQL and use their example_queries as test samples.

    Returns:
        Dict mapping intent_code -> [(example_query, [intent_code])]
    """
    logger.info(
        "Connecting to PostgreSQL %s@%s:%d/%s", DB_USER, DB_HOST, DB_PORT, DB_NAME
    )

    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
    )

    intent_samples: Dict[str, List[Tuple[str, List[str]]]] = {}
    total = 0

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT intent_code, intent_name, examples
                FROM ai_intent_configs
                WHERE is_active = true
                ORDER BY intent_code
                """
            )
            rows = cur.fetchall()
            logger.info("Loaded %d active intents from DB", len(rows))

            for intent_code, intent_name, examples_json in rows:
                if not examples_json:
                    continue

                try:
                    examples = json.loads(examples_json)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(
                        "Skipping %s: invalid examples JSON", intent_code
                    )
                    continue

                if not isinstance(examples, list) or len(examples) == 0:
                    continue

                samples = [(ex, [intent_code]) for ex in examples if isinstance(ex, str)]
                if samples:
                    intent_samples[intent_code] = samples
                    total += len(samples)

    finally:
        conn.close()

    logger.info(
        "Loaded %d example samples across %d intents from DB", total, len(intent_samples)
    )
    return intent_samples


# ---------------------------------------------------------------------------
# Classifier client
# ---------------------------------------------------------------------------
def classify_text(
    text: str, classifier_url: str, top_k: int = 5, retries: int = 2
) -> Optional[dict]:
    """
    Call the classifier API for a single text.

    Returns:
        API response dict or None on failure.
    """
    payload = {"text": text, "top_k": top_k, "threshold": 0.0}

    for attempt in range(retries + 1):
        try:
            resp = requests.post(classifier_url, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            return data
        except requests.exceptions.RequestException as e:
            if attempt < retries:
                logger.warning(
                    "Classifier request failed (attempt %d/%d): %s",
                    attempt + 1,
                    retries + 1,
                    e,
                )
            else:
                logger.error("Classifier request failed after %d attempts: %s", retries + 1, e)
                return None

    return None


def classify_batch(
    texts: List[str], classifier_url: str, batch_size: int = 50
) -> List[Optional[dict]]:
    """
    Classify a list of texts, using batch endpoint if available.
    Falls back to single calls.
    """
    batch_url = classifier_url.replace("/classify", "/classify/batch")
    results: List[Optional[dict]] = []

    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]

        try:
            resp = requests.post(
                batch_url,
                json={"texts": chunk, "top_k": 5},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("success") and "results" in data:
                for r in data["results"]:
                    results.append(r)
                continue
        except requests.exceptions.RequestException:
            pass

        # Fallback to single calls
        for text in chunk:
            result = classify_text(text, classifier_url)
            if result and result.get("success"):
                results.append(result)
            else:
                results.append(None)

    return results


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------
def evaluate_intents(
    intent_samples: Dict[str, List[Tuple[str, List[str]]]],
    classifier_url: str,
) -> List[dict]:
    """
    Evaluate each intent by running its samples through the classifier.

    For each intent I:
      - TP = classifier returns I when I is an acceptable answer
      - FP = classifier returns I when I is NOT an acceptable answer (across all samples)
      - FN = classifier does NOT return I when I IS an acceptable answer

    pseudo-F1 = 2 * precision * recall / (precision + recall)

    Returns list of per-intent stats dicts.
    """
    # Gather all query texts and their mappings
    all_queries: List[Tuple[str, str, List[str]]] = []
    # (query_text, primary_intent, acceptable_intents)

    for intent_code, samples in intent_samples.items():
        for query_text, acceptable_intents in samples:
            all_queries.append((query_text, intent_code, acceptable_intents))

    logger.info("Evaluating %d queries across %d intents...", len(all_queries), len(intent_samples))

    # Classify all queries
    texts = [q[0] for q in all_queries]
    api_results = classify_batch(texts, classifier_url)

    # Compute per-intent TP, FP, FN
    tp_count: Dict[str, int] = defaultdict(int)
    fp_count: Dict[str, int] = defaultdict(int)
    fn_count: Dict[str, int] = defaultdict(int)
    total_per_intent: Dict[str, int] = defaultdict(int)
    correct_per_intent: Dict[str, int] = defaultdict(int)

    # Also track per-intent confidence stats
    confidence_sums: Dict[str, float] = defaultdict(float)
    confidence_counts: Dict[str, int] = defaultdict(int)

    for idx, (query_text, primary_intent, acceptable_intents) in enumerate(all_queries):
        result = api_results[idx] if idx < len(api_results) else None

        # Track total samples for the primary intent
        total_per_intent[primary_intent] += 1

        if result is None:
            fn_count[primary_intent] += 1
            continue

        predicted_intent = result.get("top_intent", "UNKNOWN")
        predicted_confidence = result.get("top_confidence", 0.0)

        # Filter out N/A from acceptable intents
        valid_acceptable = [i for i in acceptable_intents if i != "N/A"]

        # Is the prediction acceptable?
        is_correct = predicted_intent in valid_acceptable

        if is_correct:
            tp_count[primary_intent] += 1
            correct_per_intent[primary_intent] += 1
        else:
            fn_count[primary_intent] += 1

        # Track if prediction was a false positive for the predicted intent
        # (predicted I but I was not acceptable)
        if not is_correct and predicted_intent:
            fp_count[predicted_intent] += 1

        # Track confidence for the primary intent
        confidence_sums[primary_intent] += predicted_confidence
        confidence_counts[primary_intent] += 1

    # Compute metrics
    results = []
    for intent_code in sorted(intent_samples.keys()):
        tp = tp_count.get(intent_code, 0)
        fp = fp_count.get(intent_code, 0)
        fn = fn_count.get(intent_code, 0)
        total = total_per_intent.get(intent_code, 0)
        correct = correct_per_intent.get(intent_code, 0)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )
        accuracy = correct / total if total > 0 else 0.0

        avg_confidence = (
            confidence_sums[intent_code] / confidence_counts[intent_code]
            if confidence_counts.get(intent_code, 0) > 0
            else 0.0
        )

        results.append(
            {
                "intent_code": intent_code,
                "total_samples": total,
                "correct": correct,
                "accuracy": round(accuracy, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "avg_confidence": round(avg_confidence, 4),
            }
        )

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Identify weak intent classes by evaluating classifier accuracy per intent."
    )
    parser.add_argument(
        "--source",
        choices=["test-file", "db"],
        default="test-file",
        help="Data source: parse test file or query PostgreSQL DB (default: test-file)",
    )
    parser.add_argument(
        "--test-results",
        type=str,
        default=str(DEFAULT_TEST_FILE),
        help="Path to E2E test results file (default: tests/intent-routing-e2e-150.py)",
    )
    parser.add_argument(
        "--classifier-url",
        type=str,
        default=DEFAULT_CLASSIFIER_URL,
        help="Classifier API URL (default: http://localhost:8083/api/classifier/classify)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="Output path for weak intents JSON (default: data/weak_intents.json)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.40,
        help="F1 threshold below which an intent is considered weak (default: 0.40)",
    )
    parser.add_argument(
        "--show-all",
        action="store_true",
        help="Print metrics for ALL intents, not just weak ones",
    )

    args = parser.parse_args()

    # ----- Load test samples -----
    if args.source == "db":
        intent_samples = load_intents_from_db()
    else:
        test_file = Path(args.test_results)
        if not test_file.exists():
            logger.error("Test file not found: %s", test_file)
            sys.exit(1)
        intent_samples = parse_test_file(test_file)

    if not intent_samples:
        logger.error("No test samples found. Exiting.")
        sys.exit(1)

    # ----- Check classifier health -----
    health_url = args.classifier_url.replace("/classify", "/health")
    try:
        health_resp = requests.get(health_url, timeout=10)
        health_data = health_resp.json()
        if not health_data.get("model_available", False):
            logger.error(
                "Classifier model not loaded. Status: %s",
                health_data.get("status", "unknown"),
            )
            sys.exit(1)
        logger.info("Classifier health: %s", health_data.get("status", "unknown"))
    except requests.exceptions.RequestException as e:
        logger.error("Cannot reach classifier at %s: %s", health_url, e)
        sys.exit(1)

    # ----- Evaluate -----
    results = evaluate_intents(intent_samples, args.classifier_url)

    # ----- Display results -----
    # Sort by F1 ascending (weakest first)
    results.sort(key=lambda x: x["f1"])

    weak_intents = [r for r in results if r["f1"] < args.threshold]
    strong_intents = [r for r in results if r["f1"] >= args.threshold]

    # Summary table
    print("\n" + "=" * 90)
    print(f"  Intent Classification Evaluation Report")
    print(f"  Source: {args.source} | Threshold: F1 < {args.threshold}")
    print(f"  Total intents evaluated: {len(results)}")
    print(f"  Weak intents (F1 < {args.threshold}): {len(weak_intents)}")
    print(f"  Strong intents (F1 >= {args.threshold}): {len(strong_intents)}")
    print("=" * 90)

    if args.show_all:
        display_list = results
        print("\n  ALL INTENTS (sorted by F1 ascending):")
    else:
        display_list = weak_intents
        print(f"\n  WEAK INTENTS (F1 < {args.threshold}):")

    print(f"  {'Intent Code':<45} {'Samples':>7} {'Correct':>7} {'Acc':>6} {'Prec':>6} {'Rec':>6} {'F1':>6}")
    print("  " + "-" * 86)

    for r in display_list:
        marker = " *" if r["f1"] < args.threshold else ""
        print(
            f"  {r['intent_code']:<45} {r['total_samples']:>7} {r['correct']:>7} "
            f"{r['accuracy']:>6.2f} {r['precision']:>6.2f} {r['recall']:>6.2f} {r['f1']:>6.2f}{marker}"
        )

    # ----- Overall stats -----
    total_samples = sum(r["total_samples"] for r in results)
    total_correct = sum(r["correct"] for r in results)
    overall_accuracy = total_correct / total_samples if total_samples > 0 else 0
    avg_f1 = sum(r["f1"] for r in results) / len(results) if results else 0

    print("\n  " + "-" * 86)
    print(f"  Overall accuracy: {overall_accuracy:.4f} ({total_correct}/{total_samples})")
    print(f"  Macro-average F1: {avg_f1:.4f}")
    print("=" * 90)

    # ----- Write output -----
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Output only essential fields for weak intents
    weak_output = [
        {
            "intent_code": r["intent_code"],
            "f1": r["f1"],
            "total_samples": r["total_samples"],
            "correct": r["correct"],
            "accuracy": r["accuracy"],
            "precision": r["precision"],
            "recall": r["recall"],
            "tp": r["tp"],
            "fp": r["fp"],
            "fn": r["fn"],
            "avg_confidence": r["avg_confidence"],
        }
        for r in weak_intents
    ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(weak_output, f, ensure_ascii=False, indent=2)

    logger.info(
        "Wrote %d weak intents to %s", len(weak_output), output_path
    )

    # Also write full results for reference
    full_output_path = output_path.with_name("all_intent_metrics.json")
    with open(full_output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    logger.info("Wrote full metrics for %d intents to %s", len(results), full_output_path)

    return 0 if len(weak_intents) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
