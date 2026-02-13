#!/usr/bin/env python3
"""
Classifier Base Model Benchmark: Compare multiple Chinese encoder models
for 179-intent classification task.

Based on existing finetune_full.py - loops through candidate base models
with identical hyperparameters and training data.

Current baseline: chinese-roberta-wwm-ext → F1=86.44%

Usage:
    pip install torch transformers sklearn
    python scripts/finetune/benchmark_classifiers.py

GPU recommended. CPU will work but ~30-60 min per model.
"""

import gc
import json
import logging
import os
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl"
LABEL_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json"
OUTPUT_DIR = BASE_DIR / "models" / "benchmark"

# Candidate base models to compare
CANDIDATE_MODELS = [
    {
        "name": "chinese-roberta-wwm-ext (baseline)",
        "model_id": "hfl/chinese-roberta-wwm-ext",
        "params": "~110M",
    },
    {
        "name": "chinese-macbert-base",
        "model_id": "hfl/chinese-macbert-base",
        "params": "~110M",
    },
    {
        "name": "chinese-lert-base",
        "model_id": "hfl/chinese-lert-base",
        "params": "~110M",
    },
    {
        "name": "chinese-roberta-wwm-ext-large",
        "model_id": "hfl/chinese-roberta-wwm-ext-large",
        "params": "~330M",
        "batch_size": 16,  # Smaller batch for large model
    },
]

# Training hyperparameters (same as finetune_full.py for fair comparison)
EPOCHS = 5
BATCH_SIZE = 32
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1
MAX_LENGTH = 64
SEED = 42
EVAL_SPLIT = 0.1


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


class IntentDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length):
        self.encodings = tokenizer(
            texts, truncation=True, padding="max_length",
            max_length=max_length, return_tensors="pt",
        )
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return {
            "input_ids": self.encodings["input_ids"][idx],
            "attention_mask": self.encodings["attention_mask"][idx],
            "labels": self.labels[idx],
        }


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc = accuracy_score(labels, preds)
    f1 = f1_score(labels, preds, average="weighted", zero_division=0)
    return {"accuracy": acc, "f1": f1}


def train_and_evaluate(candidate, texts, labels, label_to_id, num_labels, device):
    """Train and evaluate a single candidate model."""
    name = candidate["name"]
    model_id = candidate["model_id"]
    batch_size = candidate.get("batch_size", BATCH_SIZE)

    logger.info(f"\n{'='*60}")
    logger.info(f"  Training: {name}")
    logger.info(f"  Model: {model_id}, batch_size={batch_size}")
    logger.info(f"{'='*60}")

    result = {"name": name, "model_id": model_id, "params": candidate["params"]}

    # Split data (same seed for fair comparison)
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=EVAL_SPLIT, random_state=SEED, stratify=labels,
    )

    # Load tokenizer and model
    t0 = time.time()
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_id, num_labels=num_labels,
        )
    except Exception as e:
        logger.error(f"  FAILED to load {model_id}: {e}")
        result["error"] = str(e)
        return result

    load_time = time.time() - t0
    result["load_time_s"] = round(load_time, 1)
    logger.info(f"  Model loaded in {load_time:.1f}s")

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    result["total_params_M"] = round(total_params / 1e6, 1)
    logger.info(f"  Parameters: {total_params/1e6:.1f}M total, {trainable_params/1e6:.1f}M trainable")

    # Create datasets
    logger.info("  Tokenizing datasets...")
    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    # Model output directory
    model_output = OUTPUT_DIR / model_id.replace("/", "_")
    checkpoint_dir = model_output / "checkpoints"

    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=64,
        learning_rate=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
        warmup_ratio=WARMUP_RATIO,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        logging_dir=str(model_output / "logs"),
        logging_steps=500,
        disable_tqdm=True,
        save_total_limit=1,
        seed=SEED,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_safetensors=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    # Train
    logger.info("  Starting training...")
    t0 = time.time()
    train_result = trainer.train()
    train_time = time.time() - t0
    result["train_time_s"] = round(train_time, 1)
    result["train_time_min"] = round(train_time / 60, 1)
    logger.info(f"  Training done in {train_time/60:.1f} min")

    # Evaluate
    eval_metrics = trainer.evaluate()
    result["eval_accuracy"] = round(eval_metrics.get("eval_accuracy", 0), 4)
    result["eval_f1"] = round(eval_metrics.get("eval_f1", 0), 4)
    result["eval_loss"] = round(eval_metrics.get("eval_loss", 0), 4)

    # Top-1 and Top-5 accuracy
    predictions = trainer.predict(val_dataset)
    preds = np.argmax(predictions.predictions, axis=-1)
    val_labels_arr = np.array(val_labels)

    top1_correct = (preds == val_labels_arr).sum()
    top1_acc = top1_correct / len(val_labels)
    result["top1_accuracy"] = round(float(top1_acc), 4)

    logits = predictions.predictions
    top5_preds = np.argsort(logits, axis=-1)[:, -5:]
    top5_correct = sum(1 for i, label in enumerate(val_labels) if label in top5_preds[i])
    top5_acc = top5_correct / len(val_labels)
    result["top5_accuracy"] = round(float(top5_acc), 4)

    logger.info(f"  Results: Top-1={top1_acc:.4f}, Top-5={top5_acc:.4f}, F1={result['eval_f1']:.4f}")

    # Inference speed (single query)
    model.eval()
    model.to(device)
    test_text = "查看今天的生产批次"
    latencies = []
    with torch.no_grad():
        for _ in range(50):
            inputs = tokenizer(test_text, return_tensors="pt", max_length=MAX_LENGTH,
                               truncation=True, padding="max_length").to(device)
            t0 = time.perf_counter()
            model(**inputs)
            latencies.append((time.perf_counter() - t0) * 1000)

    result["inference_latency_ms"] = round(np.mean(latencies), 2)
    result["inference_p95_ms"] = round(np.percentile(latencies, 95), 2)
    logger.info(f"  Inference latency: mean={result['inference_latency_ms']:.1f}ms, "
                f"p95={result['inference_p95_ms']:.1f}ms")

    # Cleanup
    del model, trainer
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return result


def print_comparison_table(all_results):
    """Print formatted comparison table."""
    print(f"\n{'='*90}")
    print("  CLASSIFIER BENCHMARK COMPARISON TABLE")
    print(f"  Training data: 19,690 samples, 179 intent classes")
    print(f"  Hyperparams: epochs={EPOCHS}, batch={BATCH_SIZE}, lr={LEARNING_RATE}, max_len={MAX_LENGTH}")
    print(f"{'='*90}")

    metrics = [
        ("Model", "name", "{}", 35),
        ("Params", "total_params_M", "{:.0f}M", 8),
        ("Top-1", "top1_accuracy", "{:.2%}", 8),
        ("Top-5", "top5_accuracy", "{:.2%}", 8),
        ("F1", "eval_f1", "{:.2%}", 8),
        ("Time(m)", "train_time_min", "{:.1f}", 8),
        ("Lat(ms)", "inference_latency_ms", "{:.1f}", 8),
    ]

    # Header
    header = " | ".join(f"{m[0]:<{m[3]}}" for m in metrics)
    print(f"  {header}")
    print(f"  {'-'*len(header)}")

    # Rows
    for r in all_results:
        if "error" in r:
            print(f"  {r['name']:<35} | FAILED: {r['error'][:50]}")
            continue
        row = []
        for _, key, fmt, width in metrics:
            val = r.get(key, "N/A")
            if val == "N/A":
                row.append(f"{'N/A':<{width}}")
            elif isinstance(val, str):
                row.append(f"{val:<{width}}")
            else:
                row.append(f"{fmt.format(val):<{width}}")
        print(f"  {' | '.join(row)}")

    print(f"{'='*90}")

    # Find best
    valid = [r for r in all_results if "error" not in r]
    if valid:
        best_f1 = max(valid, key=lambda x: x.get("eval_f1", 0))
        best_top1 = max(valid, key=lambda x: x.get("top1_accuracy", 0))
        baseline = next((r for r in valid if "baseline" in r["name"]), valid[0])

        print(f"\n  Best F1: {best_f1['name']} ({best_f1['eval_f1']:.2%})")
        print(f"  Best Top-1: {best_top1['name']} ({best_top1['top1_accuracy']:.2%})")

        if best_f1["name"] != baseline["name"]:
            improvement = best_f1["eval_f1"] - baseline["eval_f1"]
            print(f"  F1 improvement over baseline: {improvement:+.2%}")
            if improvement > 0.01:
                print(f"  RECOMMENDATION: Upgrade to {best_f1['name']} (significant improvement)")
            else:
                print(f"  RECOMMENDATION: Keep baseline (marginal improvement not worth complexity)")
        else:
            print(f"  RECOMMENDATION: Keep baseline (already best)")


def main():
    set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print("  Classifier Base Model Benchmark")
    print(f"  Device: {device}")
    print(f"  Candidates: {len(CANDIDATE_MODELS)}")
    if torch.cuda.is_available():
        print(f"  GPU: {torch.cuda.get_device_name()}")
        print(f"  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB")
    print("=" * 60)

    # Load shared data
    logger.info("Loading label mapping...")
    with open(LABEL_MAPPING_PATH, "r", encoding="utf-8") as f:
        label_mapping = json.load(f)
    label_to_id = label_mapping["label_to_id"]
    num_labels = label_mapping["num_labels"]
    logger.info(f"  {num_labels} intent classes")

    logger.info("Loading training data...")
    texts, labels = [], []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            d = json.loads(line.strip())
            if d["label"] in label_to_id:
                texts.append(d["text"])
                labels.append(label_to_id[d["label"]])
    logger.info(f"  {len(texts)} samples loaded")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Benchmark each model
    all_results = []
    for candidate in CANDIDATE_MODELS:
        set_seed(SEED)  # Reset seed for each model for fair comparison
        result = train_and_evaluate(candidate, texts, labels, label_to_id, num_labels, device)
        all_results.append(result)

    # Print comparison
    print_comparison_table(all_results)

    # Save results
    output_path = OUTPUT_DIR / "benchmark_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n  Results saved to: {output_path}")


if __name__ == "__main__":
    main()
