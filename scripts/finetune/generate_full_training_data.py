#!/usr/bin/env python3
"""
Generate full training data for 183-intent classifier.

Reads intent definitions from DB export, applies data augmentation,
and outputs JSONL training data for chinese-roberta-wwm-ext fine-tuning.

Strategy:
1. Use keywords as base samples
2. Apply augmentation (prefixes, suffixes, question forms)
3. Filter out test/placeholder intents
4. Target: ~30-80 samples per intent
"""

import json
import random
import re
from pathlib import Path

random.seed(42)

# Augmentation templates
PREFIXES = [
    "", "帮我", "请", "请帮我", "我想", "我要", "查一下", "帮我查",
    "帮我看看", "看一下", "麻烦", "能不能", "可以帮我",
]

SUFFIXES = [
    "", "吧", "一下", "看看", "呢", "吗",
]

QUESTION_FORMS = [
    "{}是什么情况",
    "{}怎么样了",
    "帮我查一下{}",
    "我想看看{}",
    "给我看一下{}",
    "{}有什么新的",
]

# Test/placeholder intents to exclude
EXCLUDE_PATTERNS = [
    r'^E2E_',
    r'^TEST_',
    r'^FACTORY_TEST_',
    r'^PLATFORM_SHARED_',
]


def should_exclude(intent_code: str) -> bool:
    return any(re.match(p, intent_code) for p in EXCLUDE_PATTERNS)


def augment_keyword(keyword: str, intent_name: str) -> list[str]:
    """Generate augmented samples from a single keyword."""
    samples = [keyword]  # Original

    # Skip augmentation for very long phrases (already sentence-like)
    if len(keyword) > 15:
        # Just add a couple variations
        samples.append(f"帮我{keyword}")
        samples.append(f"{keyword}吧")
        return samples

    # Prefix variations
    for prefix in random.sample(PREFIXES[1:], min(3, len(PREFIXES) - 1)):
        text = f"{prefix}{keyword}"
        if text != keyword:
            samples.append(text)

    # Suffix variations
    for suffix in random.sample(SUFFIXES[1:], min(2, len(SUFFIXES) - 1)):
        text = f"{keyword}{suffix}"
        if text != keyword:
            samples.append(text)

    # Question form (only for short keywords that describe a noun/action)
    if len(keyword) <= 8 and not keyword.endswith("?") and not keyword.endswith("？"):
        form = random.choice(QUESTION_FORMS)
        samples.append(form.format(keyword))

    return list(set(samples))  # Deduplicate


def generate_training_data():
    data_dir = Path(__file__).parent / "data"
    input_path = data_dir / "intents_export.jsonl"
    output_path = data_dir / "full_training_data.jsonl"
    label_mapping_path = data_dir / "label_mapping.json"

    intents = []
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            intents.append(json.loads(line))

    print(f"Loaded {len(intents)} intents")

    # Filter out test intents
    intents = [i for i in intents if not should_exclude(i['intent_code'])]
    print(f"After filtering: {len(intents)} intents")

    # Build label mapping
    label_to_id = {}
    for i, intent in enumerate(sorted(intents, key=lambda x: x['intent_code'])):
        label_to_id[intent['intent_code']] = i

    label_mapping = {
        "label_to_id": label_to_id,
        "id_to_label": {v: k for k, v in label_to_id.items()},
        "intent_names": {
            intent['intent_code']: intent['intent_name']
            for intent in intents
        },
        "num_labels": len(label_to_id),
    }

    # Generate training samples
    all_samples = []
    stats = {"total": 0, "per_intent": {}}

    for intent in intents:
        code = intent['intent_code']
        name = intent['intent_name']
        keywords = intent.get('keywords', [])

        intent_samples = []

        for kw in keywords:
            if isinstance(kw, str) and len(kw.strip()) > 0:
                augmented = augment_keyword(kw.strip(), name)
                intent_samples.extend(augmented)

        # Add intent_name as a sample too
        if name:
            intent_samples.append(name)
            intent_samples.append(f"查看{name}")
            intent_samples.append(f"帮我{name}")

        # Deduplicate
        intent_samples = list(set(intent_samples))

        # Cap at 80 samples per intent to avoid imbalance
        if len(intent_samples) > 80:
            intent_samples = random.sample(intent_samples, 80)

        for sample in intent_samples:
            all_samples.append({"text": sample, "label": code})

        stats["per_intent"][code] = len(intent_samples)
        stats["total"] += len(intent_samples)

    # Shuffle
    random.shuffle(all_samples)

    # Write training data
    with open(output_path, 'w', encoding='utf-8') as f:
        for sample in all_samples:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')

    # Write label mapping
    with open(label_mapping_path, 'w', encoding='utf-8') as f:
        json.dump(label_mapping, f, ensure_ascii=False, indent=2)

    # Stats
    counts = list(stats["per_intent"].values())
    print(f"\nTraining data generated:")
    print(f"  Total samples: {stats['total']}")
    print(f"  Intents: {len(stats['per_intent'])}")
    print(f"  Min samples/intent: {min(counts)}")
    print(f"  Max samples/intent: {max(counts)}")
    print(f"  Avg samples/intent: {sum(counts)/len(counts):.1f}")
    print(f"\n  Output: {output_path}")
    print(f"  Label mapping: {label_mapping_path}")

    # Show intents with fewest samples
    print(f"\n  Bottom 10 by sample count:")
    for code, count in sorted(stats["per_intent"].items(), key=lambda x: x[1])[:10]:
        print(f"    {code}: {count}")


if __name__ == "__main__":
    generate_training_data()
