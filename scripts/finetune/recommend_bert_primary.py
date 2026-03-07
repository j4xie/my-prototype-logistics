#!/usr/bin/env python3
"""
R4.3: BERT-primary 自动推荐脚本

从 shadow data 中找出满足条件的意图，推荐加入 BERT-primary 列表：
- agreement ≥ 95%
- sample count ≥ 15
- 不在当前 BERT-primary 列表中
"""

import os
import sys
import json
import argparse
from datetime import datetime

# DB connection
try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# Current BERT-primary list (from application-pg-prod.properties)
CURRENT_BERT_PRIMARY = {
    "CLOCK_IN", "COST_TREND_ANALYSIS", "ORDER_DELETE", "ISAPI_CONFIG_LINE_DETECTION",
    "INVENTORY_CLEAR", "USER_CREATE", "MATERIAL_EXPIRING_ALERT", "QUALITY_CHECK_EXECUTE",
    "MATERIAL_FIFO_RECOMMEND", "MATERIAL_BATCH_RESERVE", "PROCESSING_BATCH_CANCEL",
    "QUERY_FINANCE_ROA", "QUERY_FINANCE_ROE", "SHIPMENT_STATS", "USER_DISABLE",
    "FACTORY_NOTIFICATION_CONFIG", "ISAPI_CONFIG_FIELD_DETECTION", "PRODUCT_UPDATE",
    "EQUIPMENT_STOP", "TASK_ASSIGN_WORKER", "CUSTOMER_ACTIVE", "ATTENDANCE_TODAY",
    "USER_TODO_LIST", "RESTAURANT_MARGIN_ANALYSIS", "RESTAURANT_SLOW_SELLER_QUERY",
    "RESTAURANT_WASTAGE_ANOMALY", "SYSTEM_FEEDBACK", "SYSTEM_PASSWORD_RESET",
    "SYSTEM_SETTINGS", "SYSTEM_SWITCH_FACTORY", "RESTAURANT_INGREDIENT_LOW_STOCK",
    "RESTAURANT_BESTSELLER_QUERY",
    # R3 additions
    "SUPPLIER_EVALUATE", "COST_QUERY", "PROCESSING_BATCH_RESUME", "SHIPMENT_UPDATE",
    "CUSTOMER_SEARCH", "ORDER_STATUS", "EQUIPMENT_ALERT_STATS", "PROCESSING_BATCH_PAUSE",
    "PLAN_UPDATE",
}


def get_db_connection():
    """Connect to production or local DB."""
    host = os.environ.get("DB_HOST", "47.100.235.168")
    port = os.environ.get("DB_PORT", "5432")
    dbname = os.environ.get("DB_NAME", "cretas_prod_db")
    user = os.environ.get("DB_USER", "cretas_user")
    password = os.environ.get("DB_PASSWORD", "cretas123")

    return psycopg2.connect(
        host=host, port=port, dbname=dbname, user=user, password=password
    )


def query_shadow_agreement(conn, min_samples=15, min_agreement=0.95):
    """Query shadow data for high-agreement intents."""
    sql = """
    SELECT
        matched_intent_code AS intent,
        COUNT(*) AS total,
        SUM(CASE WHEN shadow_agreed = true THEN 1 ELSE 0 END) AS agreed,
        ROUND(
            SUM(CASE WHEN shadow_agreed = true THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric,
            4
        ) AS agreement_rate
    FROM intent_match_records
    WHERE shadow_intent_code IS NOT NULL
      AND matched_intent_code IS NOT NULL
    GROUP BY matched_intent_code
    HAVING COUNT(*) >= %s
    ORDER BY agreement_rate DESC, total DESC
    """

    with conn.cursor() as cur:
        cur.execute(sql, (min_samples,))
        rows = cur.fetchall()

    results = []
    for row in rows:
        intent, total, agreed, agreement_rate = row
        agreement_float = float(agreement_rate)
        if agreement_float >= min_agreement:
            results.append({
                "intent": intent,
                "total": total,
                "agreed": agreed,
                "agreement_rate": agreement_float,
            })
    return results


def main():
    parser = argparse.ArgumentParser(description="Recommend intents for BERT-primary list")
    parser.add_argument("--min-samples", type=int, default=15, help="Min shadow samples (default: 15)")
    parser.add_argument("--min-agreement", type=float, default=0.95, help="Min agreement rate (default: 0.95)")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file")
    args = parser.parse_args()

    print(f"Connecting to DB...")
    conn = get_db_connection()

    print(f"Querying shadow data (min_samples={args.min_samples}, min_agreement={args.min_agreement})...")
    candidates = query_shadow_agreement(conn, args.min_samples, args.min_agreement)
    conn.close()

    # Filter out already in BERT-primary
    new_candidates = [c for c in candidates if c["intent"] not in CURRENT_BERT_PRIMARY]
    already_in = [c for c in candidates if c["intent"] in CURRENT_BERT_PRIMARY]

    print(f"\n{'='*60}")
    print(f"Shadow Agreement Analysis")
    print(f"{'='*60}")
    print(f"Total high-agreement intents: {len(candidates)}")
    print(f"Already in BERT-primary: {len(already_in)}")
    print(f"NEW candidates: {len(new_candidates)}")
    print(f"Current BERT-primary size: {len(CURRENT_BERT_PRIMARY)}")

    if new_candidates:
        print(f"\n--- New Candidates ---")
        print(f"{'Intent':<40} {'Samples':>8} {'Agreed':>8} {'Rate':>8}")
        print("-" * 68)
        for c in new_candidates:
            print(f"{c['intent']:<40} {c['total']:>8} {c['agreed']:>8} {c['agreement_rate']:>8.2%}")

        new_codes = ",".join(c["intent"] for c in new_candidates)
        print(f"\n--- Update Command ---")
        print(f"Add to bert-primary.intent-codes: {new_codes}")
    else:
        print("\nNo new candidates found.")

    if args.output:
        output_data = {
            "timestamp": datetime.now().isoformat(),
            "config": {"min_samples": args.min_samples, "min_agreement": args.min_agreement},
            "current_bert_primary_count": len(CURRENT_BERT_PRIMARY),
            "new_candidates": new_candidates,
            "already_in_bert_primary": [c["intent"] for c in already_in],
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"\nOutput saved to: {args.output}")


if __name__ == "__main__":
    main()
