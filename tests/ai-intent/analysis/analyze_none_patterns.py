"""
NONE Pattern Analysis Script
Analyzes ~5000 queries across 100 rounds of intent recognition testing.
Focuses on queries where the pipeline returned no intent (method=NONE/null).
"""
import json
import os
import re
from collections import defaultdict, Counter
from pathlib import Path
import statistics

REPORTS_DIR = Path("C:/Users/Steve/my-prototype-logistics/tests/ai-intent/reports")
OUTPUT_PATH = Path("C:/Users/Steve/my-prototype-logistics/tests/ai-intent/analysis/none_pattern_analysis.json")


def find_latest_reports():
    """Find the latest report file for each round (3-100)."""
    # Pattern: v5_round{N}_{timestamp}.json
    pattern = re.compile(r"^v5_round(\d+)_(\d{8}_\d{6})\.json$")

    round_files = defaultdict(list)
    for fname in os.listdir(REPORTS_DIR):
        m = pattern.match(fname)
        if m:
            round_num = int(m.group(1))
            timestamp = m.group(2)
            round_files[round_num].append((timestamp, fname))

    latest = {}
    for rnd, files in sorted(round_files.items()):
        if 3 <= rnd <= 100:
            # Sort by timestamp descending, pick latest
            files.sort(key=lambda x: x[0], reverse=True)
            latest[rnd] = files[0][1]

    return latest


def load_all_reports(latest_files):
    """Load all report JSONs."""
    reports = {}
    for rnd, fname in sorted(latest_files.items()):
        fpath = REPORTS_DIR / fname
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
            reports[rnd] = data
        except Exception as e:
            print(f"  WARNING: Failed to load round {rnd} ({fname}): {e}")
    return reports


def analyze_none_patterns(reports):
    """Main analysis: find all NONE queries, group by category, compute stats."""

    all_results = []
    none_results = []
    non_none_results = []

    total_queries = 0
    total_none = 0
    rounds_loaded = 0

    for rnd, data in sorted(reports.items()):
        rounds_loaded += 1
        results = data.get("results", [])
        total_queries += len(results)

        for r in results:
            method = r.get("method")
            intent = r.get("intent")
            query = r.get("query", "")
            category = r.get("category", "unknown")
            confidence = r.get("confidence")
            status = r.get("status", "UNKNOWN")
            latency = r.get("latency_ms")

            record = {
                "round": rnd,
                "query": query,
                "status": status,
                "intent": intent,
                "confidence": confidence,
                "category": category,
                "method": method,
                "latency_ms": latency,
            }
            all_results.append(record)

            # NONE = method is null/None, or intent is "NONE"
            is_none = (method is None) or (method == "NONE") or (intent == "NONE")

            if is_none:
                total_none += 1
                none_results.append(record)
            else:
                non_none_results.append(record)

    print(f"Loaded {rounds_loaded} rounds, {total_queries} total queries")
    print(f"NONE queries: {total_none} ({100*total_none/total_queries:.1f}%)")
    print(f"Non-NONE queries: {len(non_none_results)}")

    # =========================================================
    # Task 3-6: Group NONE queries by category, top 30 with examples
    # =========================================================
    none_by_category = defaultdict(list)
    for r in none_results:
        none_by_category[r["category"]].append(r)

    # Sort by count descending
    sorted_categories = sorted(none_by_category.items(), key=lambda x: len(x[1]), reverse=True)

    top30 = []
    for cat, items in sorted_categories[:30]:
        # Deduplicate example queries
        seen = set()
        examples = []
        for item in items:
            q = item["query"]
            if q not in seen and len(examples) < 5:
                seen.add(q)
                examples.append({
                    "query": q,
                    "intent_returned": item["intent"],
                    "confidence": item["confidence"],
                    "status": item["status"],
                })
        top30.append({
            "rank": len(top30) + 1,
            "category": cat,
            "none_count": len(items),
            "unique_queries": len(set(i["query"] for i in items)),
            "pass_count": sum(1 for i in items if i["status"] == "PASS"),
            "fail_count": sum(1 for i in items if i["status"] == "FAIL"),
            "example_queries": examples,
        })

    # =========================================================
    # Task 7: Business domain analysis
    # =========================================================
    # Map categories to business domains
    domain_keywords = {
        "production": ["production", "batch", "processing", "output", "yield", "product", "manufacturing"],
        "quality": ["quality", "qc", "inspection", "defect", "check", "compliance", "standard"],
        "inventory": ["inventory", "stock", "warehouse", "storage", "material", "inbound", "outbound"],
        "maintenance": ["maintenance", "equipment", "repair", "downtime", "machine", "device"],
        "cold_chain": ["cold", "temperature", "temp", "refriger", "frozen", "chain", "cool"],
        "finance": ["finance", "cost", "revenue", "profit", "budget", "expense", "price", "payment"],
        "hr": ["hr", "employee", "worker", "attendance", "labor", "staff", "personnel", "clock"],
        "traceability": ["trace", "traceab", "track", "origin", "supply-chain", "source"],
        "scheduling": ["schedule", "plan", "dispatch", "assign", "shift", "arrange"],
        "reporting": ["report", "summary", "statistic", "analysis", "dashboard", "kpi"],
        "alerts": ["alert", "alarm", "warning", "notification", "notify", "anomal"],
        "compliance": ["complian", "regulation", "certif", "audit", "standard", "license", "recall"],
        "logistics": ["logistic", "transport", "delivery", "shipping", "shipment", "route"],
        "ai_analysis": ["ai", "predict", "forecast", "smart", "intelligent", "recommend"],
        "iot": ["iot", "sensor", "device", "monitor", "scale", "camera"],
    }

    domain_none_counts = defaultdict(lambda: {"count": 0, "categories": set(), "queries": []})

    for cat, items in none_by_category.items():
        cat_lower = cat.lower()
        matched_domains = []
        for domain, keywords in domain_keywords.items():
            if any(kw in cat_lower for kw in keywords):
                matched_domains.append(domain)

        if not matched_domains:
            # Also check query text
            for item in items:
                q_lower = item["query"].lower()
                for domain, keywords in domain_keywords.items():
                    if any(kw in q_lower for kw in keywords):
                        if domain not in matched_domains:
                            matched_domains.append(domain)

        if not matched_domains:
            matched_domains = ["other"]

        for domain in matched_domains:
            domain_none_counts[domain]["count"] += len(items)
            domain_none_counts[domain]["categories"].add(cat)
            for item in items[:3]:
                if len(domain_none_counts[domain]["queries"]) < 10:
                    domain_none_counts[domain]["queries"].append(item["query"])

    # Sort domains by NONE count
    domain_ranking = []
    for domain, info in sorted(domain_none_counts.items(), key=lambda x: x[1]["count"], reverse=True):
        domain_ranking.append({
            "domain": domain,
            "none_count": info["count"],
            "num_categories": len(info["categories"]),
            "categories": sorted(info["categories"]),
            "sample_queries": list(set(info["queries"]))[:5],
        })

    # =========================================================
    # Task 8: Confidence distribution for non-NONE queries
    # =========================================================
    confidence_by_method = defaultdict(list)
    latency_by_method = defaultdict(list)

    for r in non_none_results:
        method = r["method"]
        if method and r["confidence"] is not None:
            confidence_by_method[method].append(r["confidence"])
        if method and r["latency_ms"] is not None:
            latency_by_method[method].append(r["latency_ms"])

    confidence_stats = {}
    for method, confs in sorted(confidence_by_method.items()):
        if confs:
            confidence_stats[method] = {
                "count": len(confs),
                "avg": round(statistics.mean(confs), 4),
                "median": round(statistics.median(confs), 4),
                "min": round(min(confs), 4),
                "max": round(max(confs), 4),
                "stdev": round(statistics.stdev(confs), 4) if len(confs) > 1 else 0,
                "below_50pct": sum(1 for c in confs if c < 0.5),
                "below_70pct": sum(1 for c in confs if c < 0.7),
                "above_90pct": sum(1 for c in confs if c >= 0.9),
            }

    latency_stats = {}
    for method, lats in sorted(latency_by_method.items()):
        if lats:
            latency_stats[method] = {
                "count": len(lats),
                "avg_ms": round(statistics.mean(lats), 1),
                "median_ms": round(statistics.median(lats), 1),
                "min_ms": round(min(lats), 1),
                "max_ms": round(max(lats), 1),
                "p95_ms": round(sorted(lats)[int(len(lats) * 0.95)], 1) if len(lats) > 20 else None,
            }

    # =========================================================
    # Additional: NONE rate per round (trend)
    # =========================================================
    none_rate_per_round = []
    for rnd, data in sorted(reports.items()):
        results = data.get("results", [])
        n_total = len(results)
        n_none = sum(1 for r in results if r.get("method") is None or r.get("method") == "NONE" or r.get("intent") == "NONE")
        none_rate_per_round.append({
            "round": rnd,
            "total": n_total,
            "none_count": n_none,
            "none_rate_pct": round(100 * n_none / n_total, 1) if n_total > 0 else 0,
        })

    # =========================================================
    # Additional: NONE vs PASS/FAIL breakdown
    # =========================================================
    none_pass_count = sum(1 for r in none_results if r["status"] == "PASS")
    none_fail_count = sum(1 for r in none_results if r["status"] == "FAIL")

    # =========================================================
    # Overall method distribution
    # =========================================================
    method_counts = Counter()
    for r in all_results:
        m = r["method"] if r["method"] else "NONE"
        method_counts[m] += 1

    # =========================================================
    # Build output
    # =========================================================
    output = {
        "summary": {
            "rounds_analyzed": rounds_loaded,
            "round_range": f"{min(reports.keys())}-{max(reports.keys())}",
            "total_queries": total_queries,
            "total_none": total_none,
            "none_percentage": round(100 * total_none / total_queries, 2),
            "none_pass": none_pass_count,
            "none_fail": none_fail_count,
            "none_pass_pct": round(100 * none_pass_count / total_none, 1) if total_none > 0 else 0,
            "none_fail_pct": round(100 * none_fail_count / total_none, 1) if total_none > 0 else 0,
            "distinct_none_categories": len(none_by_category),
            "distinct_none_queries": len(set(r["query"] for r in none_results)),
        },
        "overall_method_distribution": dict(method_counts.most_common()),
        "top_30_none_categories": top30,
        "business_domain_ranking": domain_ranking,
        "confidence_by_method": confidence_stats,
        "latency_by_method": latency_stats,
        "none_rate_trend": none_rate_per_round,
    }

    return output


def print_report(output):
    """Print a human-readable summary to console."""
    s = output["summary"]
    print("\n" + "=" * 80)
    print("NONE PATTERN ANALYSIS REPORT")
    print("=" * 80)
    print(f"Rounds analyzed:    {s['rounds_analyzed']} (rounds {s['round_range']})")
    print(f"Total queries:      {s['total_queries']}")
    print(f"Total NONE:         {s['total_none']} ({s['none_percentage']}%)")
    print(f"  NONE + PASS:      {s['none_pass']} ({s['none_pass_pct']}%) -- correctly returned NONE")
    print(f"  NONE + FAIL:      {s['none_fail']} ({s['none_fail_pct']}%) -- should have matched an intent")
    print(f"Distinct NONE cats: {s['distinct_none_categories']}")
    print(f"Distinct NONE queries: {s['distinct_none_queries']}")

    print("\n--- Overall Method Distribution ---")
    for method, count in output["overall_method_distribution"].items():
        pct = 100 * count / s["total_queries"]
        print(f"  {method:20s}: {count:5d} ({pct:5.1f}%)")

    print("\n--- TOP 30 Categories with Most NONE Results ---")
    print(f"{'Rank':>4}  {'Category':<45} {'NONE':>5} {'Uniq':>5} {'PASS':>5} {'FAIL':>5}")
    print("-" * 80)
    for item in output["top_30_none_categories"]:
        print(f"{item['rank']:4d}  {item['category']:<45} {item['none_count']:5d} {item['unique_queries']:5d} {item['pass_count']:5d} {item['fail_count']:5d}")
        for ex in item["example_queries"][:3]:
            print(f"        -> \"{ex['query']}\" (intent={ex['intent_returned']}, conf={ex['confidence']})")

    print("\n--- Business Domain Ranking (Most Underserved) ---")
    print(f"{'Rank':>4}  {'Domain':<20} {'NONE':>6} {'Categories':>10}")
    print("-" * 50)
    for i, d in enumerate(output["business_domain_ranking"], 1):
        print(f"{i:4d}  {d['domain']:<20} {d['none_count']:6d} {d['num_categories']:10d}")
        for q in d["sample_queries"][:2]:
            print(f"        -> \"{q}\"")

    print("\n--- Confidence Distribution by Method (non-NONE) ---")
    print(f"{'Method':<20} {'Count':>6} {'Avg':>7} {'Med':>7} {'Min':>7} {'Max':>7} {'StDev':>7} {'<50%':>6} {'<70%':>6} {'>90%':>6}")
    print("-" * 100)
    for method, stats in output["confidence_by_method"].items():
        print(f"{method:<20} {stats['count']:6d} {stats['avg']:7.4f} {stats['median']:7.4f} "
              f"{stats['min']:7.4f} {stats['max']:7.4f} {stats['stdev']:7.4f} "
              f"{stats['below_50pct']:6d} {stats['below_70pct']:6d} {stats['above_90pct']:6d}")

    print("\n--- Latency by Method ---")
    for method, stats in output["latency_by_method"].items():
        print(f"  {method:<20}: avg={stats['avg_ms']:.0f}ms, med={stats['median_ms']:.0f}ms, "
              f"min={stats['min_ms']:.0f}ms, max={stats['max_ms']:.0f}ms, p95={stats.get('p95_ms', 'N/A')}ms")

    # NONE rate trend summary
    none_rates = [r["none_rate_pct"] for r in output["none_rate_trend"]]
    if none_rates:
        print(f"\n--- NONE Rate Trend ---")
        print(f"  Min rate:  {min(none_rates):.1f}% (round {output['none_rate_trend'][none_rates.index(min(none_rates))]['round']})")
        print(f"  Max rate:  {max(none_rates):.1f}% (round {output['none_rate_trend'][none_rates.index(max(none_rates))]['round']})")
        print(f"  Avg rate:  {statistics.mean(none_rates):.1f}%")


def main():
    print("Finding latest report files for rounds 3-100...")
    latest = find_latest_reports()
    print(f"Found {len(latest)} rounds: {min(latest.keys())}-{max(latest.keys())}")

    print("\nLoading reports...")
    reports = load_all_reports(latest)
    print(f"Successfully loaded {len(reports)} reports")

    print("\nAnalyzing NONE patterns...")
    output = analyze_none_patterns(reports)

    # Save to JSON
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nSaved analysis to: {OUTPUT_PATH}")

    print_report(output)


if __name__ == "__main__":
    main()
