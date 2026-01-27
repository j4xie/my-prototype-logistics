import pandas as pd
from typing import List, Dict, Any
from collections import defaultdict

def identify_failure_patterns(records: List[Dict[str, Any]], min_frequency: int = 3) -> List[Dict[str, Any]]:
    """Identify frequently occurring failure patterns."""
    if not records:
        return []

    df = pd.DataFrame(records)

    # Filter to failed/cancelled records
    failed_mask = df['executionStatus'].isin(['FAILED', 'CANCELLED']) | df['errorAttribution'].notna()
    failed_df = df[failed_mask]

    if failed_df.empty:
        return []

    # Group by normalized input
    input_col = failed_df['normalizedInput'].fillna(failed_df['userInput'])
    patterns = defaultdict(lambda: {"count": 0, "samples": [], "intents": set(), "attributions": set()})

    for _, row in failed_df.iterrows():
        key = input_col[row.name] or ""
        if not key:
            continue
        patterns[key]["count"] += 1
        if len(patterns[key]["samples"]) < 5:
            original = row.get('userInput', key)
            if original and original not in patterns[key]["samples"]:
                patterns[key]["samples"].append(original)
        if row.get('matchedIntentCode'):
            patterns[key]["intents"].add(row['matchedIntentCode'])
        if row.get('errorAttribution'):
            patterns[key]["attributions"].add(row['errorAttribution'])

    # Filter by frequency and sort
    result = []
    for user_input, data in patterns.items():
        if data["count"] >= min_frequency:
            result.append({
                "userInput": user_input,
                "count": data["count"],
                "matchedIntent": list(data["intents"])[0] if data["intents"] else None,
                "errorAttribution": list(data["attributions"])[0] if data["attributions"] else None,
                "samples": data["samples"]
            })

    return sorted(result, key=lambda x: x["count"], reverse=True)

def identify_ambiguous_intents(records: List[Dict[str, Any]], min_count: int = 2) -> List[Dict[str, Any]]:
    """Identify inputs that match multiple different intents."""
    if not records:
        return []

    df = pd.DataFrame(records)

    # Group by normalized input
    input_col = df['normalizedInput'].fillna(df['userInput'])

    ambiguous = defaultdict(lambda: {"intents": [], "confidences": []})

    for _, row in df.iterrows():
        key = input_col[row.name] or ""
        if not key or not row.get('matchedIntentCode'):
            continue
        ambiguous[key]["intents"].append(row['matchedIntentCode'])
        if row.get('confidenceScore') is not None:
            ambiguous[key]["confidences"].append(row['confidenceScore'])

    result = []
    for user_input, data in ambiguous.items():
        unique_intents = list(set(data["intents"]))
        if len(unique_intents) >= min_count:
            avg_conf = sum(data["confidences"]) / len(data["confidences"]) if data["confidences"] else 0
            result.append({
                "userInput": user_input,
                "count": len(data["intents"]),
                "matchedIntents": unique_intents,
                "avgConfidence": round(avg_conf, 4)
            })

    return sorted(result, key=lambda x: len(x["matchedIntents"]), reverse=True)

def identify_missing_rules(records: List[Dict[str, Any]], min_count: int = 3) -> List[Dict[str, Any]]:
    """Identify inputs that consistently fail to match (RULE_MISS)."""
    if not records:
        return []

    df = pd.DataFrame(records)

    # Filter to RULE_MISS attribution or unmatched
    rule_miss_mask = (df['errorAttribution'] == 'RULE_MISS') | df['matchedIntentCode'].isna()
    miss_df = df[rule_miss_mask]

    if miss_df.empty:
        return []

    # Group by user input
    input_counts = defaultdict(lambda: {"count": 0, "inputs": []})

    for _, row in miss_df.iterrows():
        user_input = row.get('userInput', '')
        if not user_input:
            continue
        # Normalize for grouping
        normalized = row.get('normalizedInput') or user_input
        input_counts[normalized]["count"] += 1
        if user_input not in input_counts[normalized]["inputs"]:
            input_counts[normalized]["inputs"].append(user_input)

    result = []
    for normalized_input, data in input_counts.items():
        if data["count"] >= min_count:
            result.append({
                "userInput": normalized_input,
                "count": data["count"],
                "suggestedKeywords": _extract_simple_keywords(data["inputs"])
            })

    return sorted(result, key=lambda x: x["count"], reverse=True)

def _extract_simple_keywords(inputs: List[str]) -> List[str]:
    """Extract simple keywords without jieba (basic implementation)."""
    # This is a simple implementation - keyword_extractor.py will have jieba version
    word_counts = defaultdict(int)
    for text in inputs:
        words = text.split()
        for word in words:
            if len(word) >= 2:
                word_counts[word] += 1

    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    return [word for word, _ in sorted_words[:5]]
