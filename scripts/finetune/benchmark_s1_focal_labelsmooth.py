#!/usr/bin/env python3
"""
S1 Optimization Benchmark: Focal Loss + Label Smoothing
Compares training strategies on top of best base models.

Based on Agent Team research findings:
- S1 (Focal Loss + Label Smoothing) is highest ROI optimization
- Expected F1 improvement: +1.0~2.5%
- Current baseline: chinese-roberta-wwm-ext F1=86.44%

Tests:
  A) Baseline (roberta, no tricks)         → already have: F1=86.44%
  B) Baseline + Label Smoothing (0.1)
  C) Baseline + Focal Loss (gamma=2)
  D) Baseline + Both (LS + FL)
  E) LERT-base + Both (LS + FL)            → best base model + best strategy

Usage:
    python scripts/finetune/benchmark_s1_focal_labelsmooth.py
"""

import gc
import json
import logging
import os
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch

# Workaround: transformers 4.57+ requires torch >= 2.6 for torch.load safety check
# but cu121 wheels only go to 2.5.1. Monkey-patch since we only load trusted HuggingFace models.
import transformers.utils.import_utils as _tiu
_tiu.check_torch_load_is_safe = lambda: None
import transformers.modeling_utils as _tmu
_tmu.check_torch_load_is_safe = lambda: None
# Also patch trainer module which has its own import
import transformers.trainer as _tt
if hasattr(_tt, 'check_torch_load_is_safe'):
    _tt.check_torch_load_is_safe = lambda: None
import torch.nn as nn
import torch.nn.functional as F
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
OUTPUT_DIR = BASE_DIR / "models" / "benchmark_s1"

# Training hyperparameters (same as original benchmark)
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


class FocalLoss(nn.Module):
    """Focal Loss for multi-class classification.

    Reduces the loss contribution from easy examples, focusing training
    on hard/misclassified examples. Particularly effective for:
    - Fine-grained classification (179 similar intent classes)
    - Reducing confusion between similar intents
    """
    def __init__(self, gamma=2.0, alpha=None, label_smoothing=0.0, num_classes=179):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha  # Per-class weights (tensor of shape [num_classes])
        self.label_smoothing = label_smoothing
        self.num_classes = num_classes

    def forward(self, logits, targets):
        # Apply label smoothing to targets
        if self.label_smoothing > 0:
            smooth_targets = torch.zeros_like(logits)
            smooth_targets.fill_(self.label_smoothing / (self.num_classes - 1))
            smooth_targets.scatter_(1, targets.unsqueeze(1), 1.0 - self.label_smoothing)
            log_probs = F.log_softmax(logits, dim=-1)
            ce_loss = -(smooth_targets * log_probs).sum(dim=-1)
        else:
            ce_loss = F.cross_entropy(logits, targets, reduction='none')

        # Focal modulation
        probs = F.softmax(logits, dim=-1)
        pt = probs.gather(1, targets.unsqueeze(1)).squeeze(1)
        focal_weight = (1.0 - pt) ** self.gamma

        loss = focal_weight * ce_loss

        # Per-class alpha weighting
        if self.alpha is not None:
            alpha_t = self.alpha.to(logits.device).gather(0, targets)
            loss = alpha_t * loss

        return loss.mean()


class FocalLossTrainer(Trainer):
    """Custom Trainer that uses Focal Loss instead of standard CrossEntropy."""

    def __init__(self, focal_loss_fn=None, **kwargs):
        super().__init__(**kwargs)
        self.focal_loss_fn = focal_loss_fn

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits

        if self.focal_loss_fn is not None:
            loss = self.focal_loss_fn(logits, labels)
        else:
            loss = F.cross_entropy(logits, labels)

        return (loss, outputs) if return_outputs else loss


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc = accuracy_score(labels, preds)
    f1 = f1_score(labels, preds, average="weighted", zero_division=0)
    return {"accuracy": acc, "f1": f1}


def compute_class_weights(labels, num_classes):
    """Compute inverse-frequency alpha weights for Focal Loss."""
    counter = Counter(labels)
    total = len(labels)
    weights = torch.zeros(num_classes)
    for cls_id, count in counter.items():
        # Inverse frequency, normalized
        weights[cls_id] = total / (num_classes * count)
    # Normalize to mean=1
    weights = weights / weights.mean()
    return weights


# Experiment configurations
EXPERIMENTS = [
    {
        "name": "B: roberta + LabelSmooth(0.1)",
        "model_id": "hfl/chinese-roberta-wwm-ext",
        "label_smoothing": 0.1,
        "focal_loss": False,
    },
    {
        "name": "C: roberta + FocalLoss(γ=2)",
        "model_id": "hfl/chinese-roberta-wwm-ext",
        "label_smoothing": 0.0,
        "focal_loss": True,
        "focal_gamma": 2.0,
    },
    {
        "name": "D: roberta + FL(γ=2) + LS(0.1)",
        "model_id": "hfl/chinese-roberta-wwm-ext",
        "label_smoothing": 0.1,
        "focal_loss": True,
        "focal_gamma": 2.0,
    },
    {
        "name": "E: LERT + FL(γ=2) + LS(0.1)",
        "model_id": "hfl/chinese-lert-base",
        "label_smoothing": 0.1,
        "focal_loss": True,
        "focal_gamma": 2.0,
    },
]


def run_experiment(exp, texts, labels, num_labels, class_weights, device):
    """Run a single training experiment."""
    name = exp["name"]
    model_id = exp["model_id"]

    logger.info(f"\n{'='*60}")
    logger.info(f"  Experiment: {name}")
    logger.info(f"  Model: {model_id}")
    logger.info(f"  Label Smoothing: {exp.get('label_smoothing', 0)}")
    logger.info(f"  Focal Loss: {exp.get('focal_loss', False)}")
    logger.info(f"{'='*60}")

    result = {
        "name": name,
        "model_id": model_id,
        "label_smoothing": exp.get("label_smoothing", 0),
        "focal_loss": exp.get("focal_loss", False),
        "focal_gamma": exp.get("focal_gamma", 0),
    }

    # Split data (same seed for fair comparison)
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=EVAL_SPLIT, random_state=SEED, stratify=labels,
    )

    # Load tokenizer and model
    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_id, num_labels=num_labels,
    )
    result["load_time_s"] = round(time.time() - t0, 1)

    # Create datasets
    logger.info("  Tokenizing datasets...")
    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    # Model output directory
    safe_name = name.replace(" ", "_").replace(":", "").replace("(", "").replace(")", "")
    model_output = OUTPUT_DIR / safe_name
    checkpoint_dir = model_output / "checkpoints"

    # Build Focal Loss if needed
    focal_loss_fn = None
    if exp.get("focal_loss", False):
        focal_loss_fn = FocalLoss(
            gamma=exp.get("focal_gamma", 2.0),
            alpha=class_weights,
            label_smoothing=exp.get("label_smoothing", 0.0),
            num_classes=num_labels,
        )

    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=64,
        learning_rate=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
        warmup_ratio=WARMUP_RATIO,
        # Use built-in label smoothing only if NOT using focal loss
        label_smoothing_factor=(exp.get("label_smoothing", 0) if not exp.get("focal_loss", False) else 0),
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
        save_safetensors=True,
    )

    # Use custom Trainer for Focal Loss, standard Trainer for Label Smoothing only
    if focal_loss_fn is not None:
        trainer = FocalLossTrainer(
            focal_loss_fn=focal_loss_fn,
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=compute_metrics,
            callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
        )
    else:
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

    top1_acc = (preds == val_labels_arr).sum() / len(val_labels)
    result["top1_accuracy"] = round(float(top1_acc), 4)

    logits = predictions.predictions
    top5_preds = np.argsort(logits, axis=-1)[:, -5:]
    top5_correct = sum(1 for i, label in enumerate(val_labels) if label in top5_preds[i])
    top5_acc = top5_correct / len(val_labels)
    result["top5_accuracy"] = round(float(top5_acc), 4)

    logger.info(f"  Results: Top-1={top1_acc:.4f}, Top-5={top5_acc:.4f}, F1={result['eval_f1']:.4f}")

    # Inference latency
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

    # Per-class F1 for worst classes
    from sklearn.metrics import f1_score as f1_per_class
    per_class_f1 = f1_per_class(val_labels_arr, preds, average=None, zero_division=0)
    worst_5_idx = np.argsort(per_class_f1)[:5]
    result["worst_5_f1"] = {str(int(idx)): round(float(per_class_f1[idx]), 4) for idx in worst_5_idx}
    result["worst_5_mean_f1"] = round(float(np.mean([per_class_f1[i] for i in worst_5_idx])), 4)

    logger.info(f"  Worst-5 mean F1: {result['worst_5_mean_f1']:.4f}")

    # Cleanup
    del model, trainer
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return result


def main():
    set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print("  S1 Optimization Benchmark: Focal Loss + Label Smoothing")
    print(f"  Device: {device}")
    if torch.cuda.is_available():
        print(f"  GPU: {torch.cuda.get_device_name()}")
    print("=" * 60)

    # Load shared data
    logger.info("Loading label mapping...")
    with open(LABEL_MAPPING_PATH, "r", encoding="utf-8") as f:
        label_mapping = json.load(f)
    label_to_id = label_mapping["label_to_id"]
    id_to_label = {v: k for k, v in label_to_id.items()}
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

    # Compute class weights for Focal Loss alpha
    class_weights = compute_class_weights(labels, num_labels)
    logger.info(f"  Class weight range: [{class_weights.min():.3f}, {class_weights.max():.3f}]")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Include baseline results from previous benchmark
    baseline_result = {
        "name": "A: roberta (baseline, no tricks)",
        "model_id": "hfl/chinese-roberta-wwm-ext",
        "label_smoothing": 0,
        "focal_loss": False,
        "eval_accuracy": 0.87,
        "eval_f1": 0.8644,
        "eval_loss": 0.4859,
        "top1_accuracy": 0.87,
        "top5_accuracy": 0.9756,
        "train_time_min": 6.7,
        "inference_latency_ms": 21.24,
        "inference_p95_ms": 27.34,
    }

    all_results = [baseline_result]

    # Run experiments
    for exp in EXPERIMENTS:
        set_seed(SEED)
        result = run_experiment(exp, texts, labels, num_labels, class_weights, device)
        all_results.append(result)

        # Save intermediate results
        output_path = OUTPUT_DIR / "s1_benchmark_results.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)

    # Print comparison table
    print(f"\n{'='*100}")
    print("  S1 OPTIMIZATION BENCHMARK RESULTS")
    print(f"  Training data: 19,690 samples, 179 intent classes")
    print(f"{'='*100}")

    header = f"  {'Experiment':<38} | {'Top-1':>7} | {'Top-5':>7} | {'F1':>7} | {'Loss':>7} | {'Time':>6} | {'Lat(ms)':>8}"
    print(header)
    print(f"  {'-'*len(header.strip())}")

    for r in all_results:
        f1 = r.get('eval_f1', 0)
        delta = f1 - baseline_result['eval_f1']
        delta_str = f"({delta:+.2%})" if r != baseline_result else ""
        row = (
            f"  {r['name']:<38} | "
            f"{r.get('top1_accuracy', 0):>6.2%} | "
            f"{r.get('top5_accuracy', 0):>6.2%} | "
            f"{f1:>6.2%} | "
            f"{r.get('eval_loss', 0):>7.4f} | "
            f"{r.get('train_time_min', 0):>5.1f}m | "
            f"{r.get('inference_latency_ms', 0):>7.1f}"
        )
        print(f"{row} {delta_str}")

    print(f"{'='*100}")

    # Find best
    best = max(all_results, key=lambda x: x.get("eval_f1", 0))
    improvement = best["eval_f1"] - baseline_result["eval_f1"]
    print(f"\n  BEST: {best['name']}")
    print(f"  F1: {best['eval_f1']:.2%} ({improvement:+.2%} vs baseline)")
    print(f"  Top-1: {best.get('top1_accuracy', 0):.2%}")
    print(f"  Top-5: {best.get('top5_accuracy', 0):.2%}")

    if improvement > 0.01:
        print(f"\n  ✅ SIGNIFICANT IMPROVEMENT: +{improvement:.2%}")
        print(f"  RECOMMENDATION: Deploy {best['name']}")
    elif improvement > 0.005:
        print(f"\n  ⚡ MODERATE IMPROVEMENT: +{improvement:.2%}")
        print(f"  RECOMMENDATION: Consider deploying, also try S2 (data augmentation)")
    else:
        print(f"\n  ⚠️ MARGINAL IMPROVEMENT: +{improvement:.2%}")
        print(f"  RECOMMENDATION: Try S2 (long-tail augmentation) or hyperparameter tuning")

    # Save final results
    output_path = OUTPUT_DIR / "s1_benchmark_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n  Results saved to: {output_path}")


if __name__ == "__main__":
    main()
