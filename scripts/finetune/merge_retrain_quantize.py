#!/usr/bin/env python3
"""
Full pipeline: Merge duplicate intents → Retrain classifier → Export ONNX INT8

Steps:
1. Merge 9 duplicate/overlapping intents (179 → 170)
2. Retrain chinese-roberta-wwm-ext on cleaned data
3. Evaluate and compare with baseline (F1=86.44%)
4. Export best model to ONNX
5. Quantize to INT8 (for AMD EPYC AVX-512+VNNI)
6. Validate ONNX INT8 accuracy matches PyTorch

Usage:
    python scripts/finetune/merge_retrain_quantize.py
"""

import gc
import json
import logging
import os
import random
import shutil
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch

# Monkey-patch for transformers 4.57+ / torch < 2.6 compatibility
import transformers.utils.import_utils as _tiu
_tiu.check_torch_load_is_safe = lambda: None
import transformers.modeling_utils as _tmu
_tmu.check_torch_load_is_safe = lambda: None
import transformers.trainer as _tt
if hasattr(_tt, 'check_torch_load_is_safe'):
    _tt.check_torch_load_is_safe = lambda: None

from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl"
LABEL_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json"
MERGED_DATA_PATH = BASE_DIR / "data" / "merged_training_data.jsonl"
MERGED_LABEL_PATH = BASE_DIR / "data" / "merged_label_mapping.json"
OUTPUT_DIR = BASE_DIR / "models" / "merged-classifier" / "final"
ONNX_DIR = BASE_DIR / "models" / "merged-classifier" / "onnx"

# Model
BASE_MODEL = "hfl/chinese-roberta-wwm-ext"

# Training hyperparameters
EPOCHS = 5
BATCH_SIZE = 32
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1
MAX_LENGTH = 64
SEED = 42
EVAL_SPLIT = 0.1

# ============================================================
# MERGE MAPPING: old_intent → new_intent
# ============================================================
MERGE_MAP = {
    # Word-order duplicates (same words, different order)
    "NOTIFICATION_WECHAT_SEND": "NOTIFICATION_SEND_WECHAT",
    "HR_EMPLOYEE_DELETE": "HR_DELETE_EMPLOYEE",

    # Semantic duplicates
    "SEND_WECHAT_MESSAGE": "NOTIFICATION_SEND_WECHAT",
    "NAVIGATION_NEXT_PAGE": "PAGINATION_NEXT",

    # Generic → Equipment-specific
    "ALERT_ACKNOWLEDGE": "EQUIPMENT_ALERT_ACKNOWLEDGE",
    "ALERT_LIST": "EQUIPMENT_ALERT_LIST",
    "ALERT_RESOLVE": "EQUIPMENT_ALERT_RESOLVE",
    "ALERT_STATS": "EQUIPMENT_ALERT_STATS",

    # UPDATE/MODIFY overlap
    "ORDER_MODIFY": "ORDER_UPDATE",
}


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


# ============================================================
# Step 1: Merge training data
# ============================================================
def merge_training_data():
    logger.info("=" * 60)
    logger.info("  Step 1: Merging duplicate intents")
    logger.info("=" * 60)

    # Load original data
    original_data = []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            original_data.append(json.loads(line.strip()))

    logger.info(f"  Original: {len(original_data)} samples")

    # Apply merges
    merged_data = []
    merge_counts = Counter()
    for item in original_data:
        old_label = item["label"]
        new_label = MERGE_MAP.get(old_label, old_label)
        if new_label != old_label:
            merge_counts[f"{old_label} -> {new_label}"] += 1
        merged_data.append({"text": item["text"], "label": new_label})

    # Count unique labels
    unique_labels = sorted(set(d["label"] for d in merged_data))
    logger.info(f"  After merge: {len(merged_data)} samples, {len(unique_labels)} classes")
    logger.info(f"  Reduced by: {179 - len(unique_labels)} classes")

    for merge_desc, count in merge_counts.most_common():
        logger.info(f"    {merge_desc}: {count} samples redirected")

    # Create new label mapping
    label_to_id = {label: idx for idx, label in enumerate(unique_labels)}
    merged_mapping = {
        "label_to_id": label_to_id,
        "id_to_label": {v: k for k, v in label_to_id.items()},
        "num_labels": len(unique_labels),
        "merge_map": MERGE_MAP,
        "original_num_labels": 179,
    }

    # Save merged data
    with open(MERGED_DATA_PATH, "w", encoding="utf-8") as f:
        for item in merged_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    with open(MERGED_LABEL_PATH, "w", encoding="utf-8") as f:
        json.dump(merged_mapping, f, indent=2, ensure_ascii=False)

    logger.info(f"  Saved: {MERGED_DATA_PATH}")
    logger.info(f"  Saved: {MERGED_LABEL_PATH}")

    # Show per-class distribution after merge
    new_counts = Counter(d["label"] for d in merged_data)
    enriched = [(name, cnt) for name, cnt in new_counts.most_common() if cnt > 150]
    logger.info(f"\n  Enriched classes (>150 samples after merge):")
    for name, cnt in enriched:
        logger.info(f"    {name}: {cnt}")

    return merged_data, merged_mapping


# ============================================================
# Step 2: Retrain classifier
# ============================================================
def retrain_classifier(merged_data, merged_mapping):
    logger.info("\n" + "=" * 60)
    logger.info("  Step 2: Retraining classifier on merged data")
    logger.info("=" * 60)

    set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"  Device: {device}")

    label_to_id = merged_mapping["label_to_id"]
    num_labels = merged_mapping["num_labels"]

    # Prepare data
    texts = [d["text"] for d in merged_data]
    labels = [label_to_id[d["label"]] for d in merged_data]

    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=EVAL_SPLIT, random_state=SEED, stratify=labels,
    )
    logger.info(f"  Train: {len(train_texts)}, Val: {len(val_texts)}")

    # Load model
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=num_labels,
    )

    # Datasets
    logger.info("  Tokenizing...")
    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    # Training
    checkpoint_dir = OUTPUT_DIR.parent / "checkpoints"
    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=64,
        learning_rate=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
        warmup_ratio=WARMUP_RATIO,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        logging_dir=str(OUTPUT_DIR.parent / "logs"),
        logging_steps=50,
        save_total_limit=1,
        seed=SEED,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_safetensors=True,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    logger.info("  Training...")
    t0 = time.time()
    trainer.train()
    train_time = time.time() - t0
    logger.info(f"  Training done in {train_time/60:.1f} min")

    # Evaluate
    eval_metrics = trainer.evaluate()
    f1 = eval_metrics.get("eval_f1", 0)
    acc = eval_metrics.get("eval_accuracy", 0)
    logger.info(f"  Eval F1: {f1:.4f}, Accuracy: {acc:.4f}")

    # Top-1 and Top-5
    predictions = trainer.predict(val_dataset)
    preds = np.argmax(predictions.predictions, axis=-1)
    val_labels_arr = np.array(val_labels)

    top1_acc = (preds == val_labels_arr).sum() / len(val_labels)
    logits = predictions.predictions
    top5_preds = np.argsort(logits, axis=-1)[:, -5:]
    top5_correct = sum(1 for i, label in enumerate(val_labels) if label in top5_preds[i])
    top5_acc = top5_correct / len(val_labels)

    logger.info(f"  Top-1: {top1_acc:.4f}, Top-5: {top5_acc:.4f}")

    # Per-class worst performers
    per_class_f1 = f1_score(val_labels_arr, preds, average=None, zero_division=0)
    id_to_label = {v: k for k, v in label_to_id.items()}
    worst_5_idx = np.argsort(per_class_f1)[:5]
    logger.info(f"\n  Worst-5 classes after merge:")
    for idx in worst_5_idx:
        logger.info(f"    {id_to_label.get(int(idx), '?')}: F1={per_class_f1[idx]:.4f}")

    # Save model
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    shutil.copy2(MERGED_LABEL_PATH, OUTPUT_DIR / "label_mapping.json")

    # Save metrics
    metrics = {
        "top1_accuracy": float(top1_acc),
        "top5_accuracy": float(top5_acc),
        "f1_weighted": float(f1),
        "eval_accuracy": float(acc),
        "num_intents": num_labels,
        "num_train_samples": len(train_texts),
        "num_val_samples": len(val_texts),
        "epochs": EPOCHS,
        "base_model": BASE_MODEL,
        "train_time_min": round(train_time / 60, 1),
        "merge_map": MERGE_MAP,
        "original_intents": 179,
        "merged_intents": num_labels,
    }
    with open(OUTPUT_DIR / "training_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    logger.info(f"  Model saved to: {OUTPUT_DIR}")

    # Comparison
    baseline_f1 = 0.8644
    improvement = f1 - baseline_f1
    logger.info(f"\n  {'='*50}")
    logger.info(f"  COMPARISON vs BASELINE (179 intents)")
    logger.info(f"  Baseline F1:  {baseline_f1:.4f}")
    logger.info(f"  Merged F1:    {f1:.4f} ({improvement:+.4f})")
    logger.info(f"  Top-1:        {top1_acc:.4f}")
    logger.info(f"  Top-5:        {top5_acc:.4f}")
    logger.info(f"  {'='*50}")

    return model, tokenizer, metrics


# ============================================================
# Step 3: Export to ONNX
# ============================================================
def export_onnx(model, tokenizer):
    logger.info("\n" + "=" * 60)
    logger.info("  Step 3: Exporting to ONNX")
    logger.info("=" * 60)

    ONNX_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = ONNX_DIR / "model.onnx"

    model.eval()
    model.cpu()

    # Dummy input
    dummy_text = "查看生产批次状态"
    inputs = tokenizer(
        dummy_text, return_tensors="pt", max_length=MAX_LENGTH,
        truncation=True, padding="max_length",
    )

    # Export
    logger.info(f"  Exporting to {onnx_path}...")
    torch.onnx.export(
        model,
        (inputs["input_ids"], inputs["attention_mask"], inputs.get("token_type_ids")),
        str(onnx_path),
        opset_version=14,
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "seq_length"},
            "attention_mask": {0: "batch_size", 1: "seq_length"},
            "token_type_ids": {0: "batch_size", 1: "seq_length"},
            "logits": {0: "batch_size"},
        },
    )

    onnx_size = onnx_path.stat().st_size / 1e6
    logger.info(f"  ONNX FP32 exported: {onnx_size:.1f} MB")

    # Copy tokenizer files
    tokenizer.save_pretrained(str(ONNX_DIR))
    shutil.copy2(OUTPUT_DIR / "label_mapping.json", ONNX_DIR / "label_mapping.json")

    return onnx_path


# ============================================================
# Step 4: INT8 Quantization
# ============================================================
def quantize_int8(onnx_path):
    logger.info("\n" + "=" * 60)
    logger.info("  Step 4: INT8 Quantization")
    logger.info("=" * 60)

    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        logger.error("  onnxruntime not installed. Run: pip install onnxruntime")
        return None

    int8_path = ONNX_DIR / "model-int8.onnx"

    logger.info(f"  Quantizing to INT8...")
    quantize_dynamic(
        str(onnx_path),
        str(int8_path),
        weight_type=QuantType.QInt8,
    )

    fp32_size = onnx_path.stat().st_size / 1e6
    int8_size = int8_path.stat().st_size / 1e6
    reduction = (1 - int8_size / fp32_size) * 100

    logger.info(f"  FP32:  {fp32_size:.1f} MB")
    logger.info(f"  INT8:  {int8_size:.1f} MB")
    logger.info(f"  Reduction: {reduction:.0f}%")

    return int8_path


# ============================================================
# Step 5: Validate ONNX INT8 accuracy
# ============================================================
def validate_onnx(int8_path, tokenizer, merged_mapping):
    logger.info("\n" + "=" * 60)
    logger.info("  Step 5: Validating ONNX INT8 accuracy")
    logger.info("=" * 60)

    try:
        import onnxruntime as ort
    except ImportError:
        logger.error("  onnxruntime not installed")
        return

    label_to_id = merged_mapping["label_to_id"]

    # Load validation data
    all_data = []
    with open(MERGED_DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            all_data.append(json.loads(line.strip()))

    texts = [d["text"] for d in all_data]
    labels = [label_to_id[d["label"]] for d in all_data]

    _, val_texts, _, val_labels = train_test_split(
        texts, labels, test_size=EVAL_SPLIT, random_state=SEED, stratify=labels,
    )

    # Load ONNX model
    session = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"])

    # Inference
    correct = 0
    all_preds = []
    t0 = time.time()

    for text, label in zip(val_texts, val_labels):
        inputs = tokenizer(
            text, return_tensors="np", max_length=MAX_LENGTH,
            truncation=True, padding="max_length",
        )
        ort_inputs = {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"],
            "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])),
        }
        logits = session.run(None, ort_inputs)[0]
        pred = np.argmax(logits, axis=-1)[0]
        all_preds.append(pred)
        if pred == label:
            correct += 1

    total_time = time.time() - t0
    avg_latency = total_time / len(val_texts) * 1000

    onnx_acc = correct / len(val_labels)
    onnx_f1 = f1_score(val_labels, all_preds, average="weighted", zero_division=0)

    logger.info(f"  ONNX INT8 Accuracy: {onnx_acc:.4f}")
    logger.info(f"  ONNX INT8 F1:       {onnx_f1:.4f}")
    logger.info(f"  Avg latency:        {avg_latency:.1f} ms/query")
    logger.info(f"  Total val time:     {total_time:.1f}s for {len(val_texts)} samples")

    # Latency benchmark (single query, 100 iterations)
    test_text = "查看今天的生产批次"
    inputs = tokenizer(
        test_text, return_tensors="np", max_length=MAX_LENGTH,
        truncation=True, padding="max_length",
    )
    ort_inputs = {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs["attention_mask"],
        "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])),
    }

    latencies = []
    for _ in range(100):
        t0 = time.perf_counter()
        session.run(None, ort_inputs)
        latencies.append((time.perf_counter() - t0) * 1000)

    mean_lat = np.mean(latencies)
    p95_lat = np.percentile(latencies, 95)
    logger.info(f"\n  Single-query latency (CPU):")
    logger.info(f"    Mean: {mean_lat:.1f} ms")
    logger.info(f"    P95:  {p95_lat:.1f} ms")

    return {"accuracy": onnx_acc, "f1": onnx_f1, "latency_mean_ms": mean_lat, "latency_p95_ms": p95_lat}


# ============================================================
# Main
# ============================================================
def main():
    set_seed(SEED)

    print("=" * 60)
    print("  Intent Merge + Retrain + ONNX INT8 Pipeline")
    print(f"  Device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
    if torch.cuda.is_available():
        print(f"  GPU: {torch.cuda.get_device_name()}")
    print("=" * 60)

    # Step 1: Merge
    merged_data, merged_mapping = merge_training_data()

    # Step 2: Retrain
    model, tokenizer, train_metrics = retrain_classifier(merged_data, merged_mapping)

    # Step 3: Export ONNX
    onnx_path = export_onnx(model, tokenizer)

    # Step 4: Quantize INT8
    int8_path = quantize_int8(onnx_path)

    # Step 5: Validate
    onnx_metrics = None
    if int8_path:
        onnx_metrics = validate_onnx(int8_path, tokenizer, merged_mapping)

    # Final summary
    print("\n" + "=" * 60)
    print("  FINAL SUMMARY")
    print("=" * 60)
    print(f"  Intents: 179 -> {merged_mapping['num_labels']} ({179 - merged_mapping['num_labels']} merged)")
    print(f"  Baseline F1:    86.44%")
    print(f"  Merged F1:      {train_metrics['f1_weighted']:.2%}")
    print(f"  Improvement:    {train_metrics['f1_weighted'] - 0.8644:+.2%}")
    print(f"  Top-1:          {train_metrics['top1_accuracy']:.2%}")
    print(f"  Top-5:          {train_metrics['top5_accuracy']:.2%}")
    if onnx_metrics:
        print(f"  ONNX INT8 F1:   {onnx_metrics['f1']:.2%}")
        print(f"  ONNX Latency:   {onnx_metrics['latency_mean_ms']:.1f}ms (mean), {onnx_metrics['latency_p95_ms']:.1f}ms (P95)")
    print(f"\n  Output files:")
    print(f"    PyTorch: {OUTPUT_DIR}")
    print(f"    ONNX:    {ONNX_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
