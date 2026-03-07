#!/usr/bin/env python3
"""
Synthesize Training Data for Weak Intent Classes

Reads data/weak_intents.json to identify weak intents, queries PostgreSQL for
intent metadata (description, keywords, examples), then uses DashScope qwen3.5
LLM to generate diverse training expressions.

Applies ZPD (Zone of Proximal Development) filtering: generated expressions
that the classifier already classifies correctly with high confidence (>0.85)
are discarded, keeping only boundary samples that the model struggles with.

Output: data/synthetic_weak_class.jsonl
Format: {"text": "...", "label": "INTENT_CODE", "source": "synthetic"}

Usage:
  python synthesize_weak_class_data.py
  python synthesize_weak_class_data.py --per-intent 40 --dry-run
  python synthesize_weak_class_data.py --input data/weak_intents.json --output data/synthetic_weak_class.jsonl
"""

import argparse
import json
import logging
import os
import sys
import time
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
DEFAULT_INPUT = SCRIPT_DIR / "data" / "weak_intents.json"
DEFAULT_OUTPUT = SCRIPT_DIR / "data" / "synthetic_weak_class.jsonl"
DEFAULT_CLASSIFIER_URL = "http://localhost:8083/api/classifier/classify"

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "cretas_db")
DB_USER = os.environ.get("DB_USER", "cretas_user")
DB_PASS = os.environ.get("DB_PASSWORD", "cretas_pass")

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

# Approximate tokens per Chinese character for cost estimation
CHARS_PER_TOKEN = 1.5


# ---------------------------------------------------------------------------
# Load weak intents
# ---------------------------------------------------------------------------
def load_weak_intents(filepath: Path) -> List[dict]:
    """Load the weak intents list from JSON file."""
    if not filepath.exists():
        logger.error("Weak intents file not found: %s", filepath)
        logger.error("Run identify_weak_intents.py first to generate it.")
        sys.exit(1)

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    logger.info("Loaded %d weak intents from %s", len(data), filepath)
    return data


# ---------------------------------------------------------------------------
# Database: fetch intent metadata
# ---------------------------------------------------------------------------
def fetch_intent_metadata(intent_codes: List[str]) -> Dict[str, dict]:
    """
    Query ai_intent_configs for metadata of the specified intents.

    Returns:
        Dict mapping intent_code -> {intent_name, description, keywords, examples}
    """
    if not intent_codes:
        return {}

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

    metadata: Dict[str, dict] = {}

    try:
        with conn.cursor() as cur:
            placeholders = ", ".join(["%s"] * len(intent_codes))
            cur.execute(
                f"""
                SELECT intent_code, intent_name, description, keywords, examples
                FROM ai_intent_configs
                WHERE intent_code IN ({placeholders})
                  AND is_active = true
                ORDER BY intent_code
                """,
                intent_codes,
            )
            rows = cur.fetchall()

            for intent_code, intent_name, description, keywords_json, examples_json in rows:
                # Parse JSON fields
                keywords = []
                if keywords_json:
                    try:
                        keywords = json.loads(keywords_json)
                        if not isinstance(keywords, list):
                            keywords = []
                    except (json.JSONDecodeError, TypeError):
                        pass

                examples = []
                if examples_json:
                    try:
                        examples = json.loads(examples_json)
                        if not isinstance(examples, list):
                            examples = []
                    except (json.JSONDecodeError, TypeError):
                        pass

                metadata[intent_code] = {
                    "intent_code": intent_code,
                    "intent_name": intent_name or "",
                    "description": description or "",
                    "keywords": keywords,
                    "examples": [e for e in examples if isinstance(e, str)],
                }

            logger.info("Fetched metadata for %d/%d intents from DB", len(metadata), len(intent_codes))

    finally:
        conn.close()

    # Warn about intents not found in DB
    for code in intent_codes:
        if code not in metadata:
            logger.warning("Intent %s not found in ai_intent_configs (may be synthetic or deleted)", code)
            metadata[code] = {
                "intent_code": code,
                "intent_name": code.replace("_", " ").title(),
                "description": "",
                "keywords": [],
                "examples": [],
            }

    return metadata


# ---------------------------------------------------------------------------
# LLM: generate diverse expressions
# ---------------------------------------------------------------------------
def build_synthesis_prompt(intent_meta: dict, num_expressions: int) -> str:
    """
    Build the LLM prompt for generating diverse expressions for an intent.
    """
    intent_code = intent_meta["intent_code"]
    intent_name = intent_meta["intent_name"]
    description = intent_meta["description"]
    keywords = intent_meta["keywords"]
    examples = intent_meta["examples"]

    keywords_str = ", ".join(keywords[:15]) if keywords else "(none)"
    examples_str = "\n".join(f"  - {ex}" for ex in examples[:10]) if examples else "  (none)"

    prompt = f"""你是一个B2B食品工厂MES系统的意图数据标注专家。

当前需要为意图分类器生成训练数据。以下是目标意图的信息：

【意图代码】{intent_code}
【意图名称】{intent_name}
【描述】{description}
【关键词】{keywords_str}
【示例问句】
{examples_str}

请为这个意图生成 {num_expressions} 条多样化的用户输入表达。要求：

1. **口语化变体**：工厂工人日常说话方式，带语气词（嘛、啦、呗、咯）
2. **缩写简称**：极短输入（2-4个字），省略主语或谓语
3. **方言变体**：北方/南方口语（瞅瞅、整一下、搞一下、弄弄）
4. **带上下文**：加入时间（今天、上周、本月）、地点（A车间、2号冷库）、人名（张三、李四）
5. **带错别字**：5-10%的表达故意包含常见错别字或同音字替换
6. **不同句式**：疑问句、祈使句、陈述句、反问句、被动句
7. **间接表达**：暗示型表达，不直接说动作但意图明确
8. **带数量/条件**：包含数字、比较词（超过、不到、至少）
9. **礼貌/委婉**：请问、麻烦、能不能、帮我
10. **混合中英文**：偶尔夹杂行业英文缩写（KPI、QC、MRP、OEE）

注意：
- 每条表达必须真正属于 {intent_code} 这个意图
- 避免与其他意图混淆的表达
- 长度从2个字到30个字不等
- 不要加编号、序号、引号或其他格式标记
- 每行一条表达，直接输出文本内容

请直接输出 {num_expressions} 条表达，每行一条："""

    return prompt


def call_dashscope_llm(
    prompt: str,
    model: str = "qwen3-235b-a22b",
    max_tokens: int = 4000,
    temperature: float = 0.9,
    retries: int = 3,
) -> Optional[str]:
    """
    Call DashScope compatible API to generate text.

    Returns:
        Generated text or None on failure.
    """
    if not DASHSCOPE_API_KEY:
        logger.error("DASHSCOPE_API_KEY environment variable not set")
        return None

    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "enable_thinking": False,
    }

    for attempt in range(retries):
        try:
            resp = requests.post(
                DASHSCOPE_API_URL,
                headers=headers,
                json=payload,
                timeout=120,
            )

            if resp.status_code == 429:
                wait = 2 ** (attempt + 1)
                logger.warning("Rate limited. Waiting %ds before retry...", wait)
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

            if content:
                return content

            logger.warning("Empty content in LLM response")

        except requests.exceptions.RequestException as e:
            wait = 2 ** (attempt + 1)
            logger.warning(
                "LLM call failed (attempt %d/%d): %s. Retrying in %ds...",
                attempt + 1,
                retries,
                e,
                wait,
            )
            time.sleep(wait)

    logger.error("LLM call failed after %d retries", retries)
    return None


def parse_generated_expressions(raw_text: str) -> List[str]:
    """
    Parse LLM output into a list of expressions.
    Handles various output formats (numbered, bulleted, plain).
    """
    lines = raw_text.strip().split("\n")
    expressions = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Remove numbering: "1. ", "1) ", "- ", "* ", etc.
        line = line.lstrip("0123456789.-)*·•# ")
        line = line.strip()

        # Remove surrounding quotes
        if (line.startswith('"') and line.endswith('"')) or (
            line.startswith("'") and line.endswith("'")
        ):
            line = line[1:-1].strip()

        # Skip empty or too short
        if len(line) < 2:
            continue

        # Skip lines that look like metadata/instructions
        if any(
            kw in line
            for kw in ["意图", "代码", "说明", "注意", "以下", "生成", "表达"]
        ):
            continue

        expressions.append(line)

    return expressions


# ---------------------------------------------------------------------------
# ZPD Filtering
# ---------------------------------------------------------------------------
def zpd_filter(
    expressions: List[str],
    intent_code: str,
    classifier_url: str,
    confidence_threshold: float = 0.85,
) -> Tuple[List[str], int, int]:
    """
    Apply Zone of Proximal Development filtering.

    Keep expressions that the classifier either:
    - Classifies incorrectly (hardest boundary samples)
    - Classifies correctly but with low confidence (< threshold)

    Discard expressions the classifier already handles confidently.

    Returns:
        (kept_expressions, num_discarded, num_errors)
    """
    if not expressions:
        return [], 0, 0

    kept = []
    discarded = 0
    errors = 0

    # Use batch endpoint for efficiency
    batch_url = classifier_url.replace("/classify", "/classify/batch")

    try:
        resp = requests.post(
            batch_url,
            json={"texts": expressions, "top_k": 1},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("success") and "results" in data:
            for idx, result in enumerate(data["results"]):
                if idx >= len(expressions):
                    break

                if not result.get("success"):
                    # Classifier error — keep the sample
                    kept.append(expressions[idx])
                    errors += 1
                    continue

                predicted = result.get("top_intent", "")
                confidence = result.get("top_confidence", 0.0)

                if predicted == intent_code and confidence >= confidence_threshold:
                    # Classifier already handles this well — discard
                    discarded += 1
                else:
                    # Boundary sample — keep
                    kept.append(expressions[idx])

            return kept, discarded, errors

    except requests.exceptions.RequestException:
        pass

    # Fallback: classify one by one
    for expr in expressions:
        result = classify_text_single(expr, classifier_url)
        if result is None:
            kept.append(expr)
            errors += 1
            continue

        predicted = result.get("top_intent", "")
        confidence = result.get("top_confidence", 0.0)

        if predicted == intent_code and confidence >= confidence_threshold:
            discarded += 1
        else:
            kept.append(expr)

    return kept, discarded, errors


def classify_text_single(
    text: str, classifier_url: str
) -> Optional[dict]:
    """Classify a single text via the classifier API."""
    try:
        resp = requests.post(
            classifier_url,
            json={"text": text, "top_k": 1, "threshold": 0.0},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException:
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Synthesize training data for weak intent classes using LLM + ZPD filtering."
    )
    parser.add_argument(
        "--input",
        type=str,
        default=str(DEFAULT_INPUT),
        help="Path to weak_intents.json (default: data/weak_intents.json)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="Output JSONL path (default: data/synthetic_weak_class.jsonl)",
    )
    parser.add_argument(
        "--per-intent",
        type=int,
        default=40,
        help="Number of expressions to generate per intent (default: 40, LLM generates more, ZPD filters down)",
    )
    parser.add_argument(
        "--classifier-url",
        type=str,
        default=DEFAULT_CLASSIFIER_URL,
        help="Classifier API URL for ZPD filtering (default: http://localhost:8083/api/classifier/classify)",
    )
    parser.add_argument(
        "--zpd-threshold",
        type=float,
        default=0.85,
        help="Confidence threshold for ZPD filtering (default: 0.85). Samples above this are discarded.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="qwen3-235b-a22b",
        help="DashScope model to use (default: qwen3-235b-a22b)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be generated without calling LLM or writing output",
    )
    parser.add_argument(
        "--skip-zpd",
        action="store_true",
        help="Skip ZPD filtering (keep all generated expressions)",
    )

    args = parser.parse_args()

    # ----- Load weak intents -----
    weak_intents = load_weak_intents(Path(args.input))

    if not weak_intents:
        logger.info("No weak intents found. Nothing to synthesize.")
        return 0

    intent_codes = [w["intent_code"] for w in weak_intents]
    logger.info("Weak intents to process: %s", ", ".join(intent_codes))

    # ----- Dry run mode -----
    if args.dry_run:
        print("\n" + "=" * 70)
        print("  DRY RUN — No LLM calls or file writes")
        print("=" * 70)
        print(f"\n  Intents to synthesize: {len(intent_codes)}")
        print(f"  Expressions per intent (pre-filter): {args.per_intent + 15}")
        print(f"  Target expressions per intent (post-filter): ~{args.per_intent}")
        print(f"  ZPD confidence threshold: {args.zpd_threshold}")
        print(f"  Model: {args.model}")

        # Estimate tokens
        # Prompt ~500 chars + response ~50 chars * per_intent
        est_input_tokens = len(intent_codes) * 500 / CHARS_PER_TOKEN
        est_output_tokens = len(intent_codes) * (args.per_intent + 15) * 15 / CHARS_PER_TOKEN
        print(f"\n  Estimated input tokens:  ~{int(est_input_tokens):,}")
        print(f"  Estimated output tokens: ~{int(est_output_tokens):,}")
        print(f"  Estimated total tokens:  ~{int(est_input_tokens + est_output_tokens):,}")

        print(f"\n  Intents:")
        for w in weak_intents:
            print(f"    {w['intent_code']:<45} F1={w['f1']:.2f}  samples={w['total_samples']}")

        print("=" * 70)
        return 0

    # ----- Validate prerequisites -----
    if not DASHSCOPE_API_KEY:
        logger.error("DASHSCOPE_API_KEY environment variable not set. Cannot call LLM.")
        sys.exit(1)

    # Check classifier health (for ZPD filtering)
    classifier_available = False
    if not args.skip_zpd:
        try:
            health_url = args.classifier_url.replace("/classify", "/health")
            health_resp = requests.get(health_url, timeout=10)
            health_data = health_resp.json()
            classifier_available = health_data.get("model_available", False)
            if classifier_available:
                logger.info("Classifier available for ZPD filtering")
            else:
                logger.warning(
                    "Classifier model not loaded. ZPD filtering will be skipped."
                )
        except requests.exceptions.RequestException:
            logger.warning("Cannot reach classifier. ZPD filtering will be skipped.")

    # ----- Fetch intent metadata from DB -----
    metadata = fetch_intent_metadata(intent_codes)

    # ----- Generate expressions per intent -----
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    all_samples: List[dict] = []
    stats: Dict[str, dict] = {}

    # Request more than needed to account for ZPD filtering
    generate_count = args.per_intent + 15

    total_input_tokens = 0
    total_output_tokens = 0

    for idx, weak_info in enumerate(weak_intents, 1):
        intent_code = weak_info["intent_code"]
        meta = metadata.get(intent_code, {})

        logger.info(
            "[%d/%d] Generating %d expressions for %s (F1=%.2f)...",
            idx,
            len(weak_intents),
            generate_count,
            intent_code,
            weak_info["f1"],
        )

        # Build prompt
        prompt = build_synthesis_prompt(meta, generate_count)

        # Estimate input tokens
        input_tokens_est = int(len(prompt) / CHARS_PER_TOKEN)
        total_input_tokens += input_tokens_est

        # Call LLM
        raw_output = call_dashscope_llm(
            prompt,
            model=args.model,
            max_tokens=4000,
            temperature=0.9,
        )

        if raw_output is None:
            logger.error("LLM generation failed for %s. Skipping.", intent_code)
            stats[intent_code] = {
                "generated": 0,
                "after_zpd": 0,
                "discarded": 0,
                "errors": 0,
                "status": "LLM_FAILED",
            }
            continue

        # Estimate output tokens
        output_tokens_est = int(len(raw_output) / CHARS_PER_TOKEN)
        total_output_tokens += output_tokens_est

        # Parse expressions
        expressions = parse_generated_expressions(raw_output)
        logger.info(
            "  Parsed %d expressions from LLM output (%d chars)",
            len(expressions),
            len(raw_output),
        )

        # Deduplicate
        seen = set()
        unique_expressions = []
        for expr in expressions:
            normalized = expr.strip().lower()
            if normalized not in seen:
                seen.add(normalized)
                unique_expressions.append(expr)
        expressions = unique_expressions

        # Also deduplicate against existing examples in DB
        existing_examples = set(
            e.strip().lower() for e in meta.get("examples", [])
        )
        expressions = [
            e for e in expressions if e.strip().lower() not in existing_examples
        ]

        generated_count = len(expressions)

        # ZPD filtering
        discarded = 0
        errors = 0
        if classifier_available and not args.skip_zpd:
            expressions, discarded, errors = zpd_filter(
                expressions,
                intent_code,
                args.classifier_url,
                args.zpd_threshold,
            )
            logger.info(
                "  ZPD filter: %d kept, %d discarded (confident), %d errors",
                len(expressions),
                discarded,
                errors,
            )

        # Create JSONL records
        for expr in expressions:
            all_samples.append(
                {
                    "text": expr,
                    "label": intent_code,
                    "source": "synthetic",
                }
            )

        stats[intent_code] = {
            "generated": generated_count,
            "after_zpd": len(expressions),
            "discarded": discarded,
            "errors": errors,
            "status": "OK",
        }

        # Rate limiting — avoid hitting DashScope too fast
        if idx < len(weak_intents):
            time.sleep(1)

    # ----- Write output -----
    with open(output_path, "w", encoding="utf-8") as f:
        for sample in all_samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    logger.info("Wrote %d synthetic samples to %s", len(all_samples), output_path)

    # ----- Print summary -----
    print("\n" + "=" * 90)
    print("  Synthesis Summary")
    print("=" * 90)
    print(f"\n  {'Intent Code':<45} {'Generated':>9} {'ZPD Kept':>9} {'Discarded':>9} {'Status':>10}")
    print("  " + "-" * 84)

    total_generated = 0
    total_kept = 0
    total_discarded_all = 0

    for intent_code in intent_codes:
        s = stats.get(intent_code, {})
        gen = s.get("generated", 0)
        kept = s.get("after_zpd", 0)
        disc = s.get("discarded", 0)
        status = s.get("status", "?")
        total_generated += gen
        total_kept += kept
        total_discarded_all += disc
        print(f"  {intent_code:<45} {gen:>9} {kept:>9} {disc:>9} {status:>10}")

    print("  " + "-" * 84)
    print(f"  {'TOTAL':<45} {total_generated:>9} {total_kept:>9} {total_discarded_all:>9}")

    # Token count estimate
    print(f"\n  Token usage estimate:")
    print(f"    Input tokens:  ~{total_input_tokens:,}")
    print(f"    Output tokens: ~{total_output_tokens:,}")
    print(f"    Total tokens:  ~{total_input_tokens + total_output_tokens:,}")

    print(f"\n  Output file: {output_path}")
    print(f"  Total samples written: {len(all_samples)}")

    # Per-label distribution
    label_counts = defaultdict(int)
    for s in all_samples:
        label_counts[s["label"]] += 1

    if label_counts:
        print(f"\n  Per-label distribution:")
        for label, count in sorted(label_counts.items(), key=lambda x: -x[1]):
            print(f"    {label:<45} {count:>5} samples")

    print("=" * 90)

    return 0


if __name__ == "__main__":
    sys.exit(main())
