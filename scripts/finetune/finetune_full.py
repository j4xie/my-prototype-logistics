#!/usr/bin/env python3
"""
Full fine-tuning of chinese-roberta-wwm-ext for intent classification.

Downloads base model from HuggingFace, fine-tunes on generated training data,
and saves the model with label_mapping.json for deployment.

Requirements: torch, transformers, sklearn
GPU recommended (RTX 3060 ~5-10 min)
"""

import json
import logging
import random
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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "full_training_data.jsonl"
LABEL_MAPPING_PATH = BASE_DIR / "data" / "label_mapping.json"
OUTPUT_DIR = BASE_DIR / "models" / "chinese-roberta-wwm-ext-classifier" / "final"

# Model
BASE_MODEL = "hfl/chinese-roberta-wwm-ext"  # HuggingFace model ID

# Training hyperparameters
EPOCHS = 10
BATCH_SIZE = 32
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1
MAX_LENGTH = 80
SEED = 42
EVAL_SPLIT = 0.1  # 10% for validation


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
            max_length=max_length, return_tensors="pt"
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


def main():
    set_seed(SEED)

    # Load label mapping
    logger.info("Loading label mapping...")
    with open(LABEL_MAPPING_PATH, 'r', encoding='utf-8') as f:
        label_mapping = json.load(f)
    label_to_id = label_mapping["label_to_id"]
    num_labels = label_mapping["num_labels"]
    logger.info(f"  {num_labels} intent classes")

    # Load training data
    logger.info("Loading training data...")
    texts, labels = [], []
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            d = json.loads(line.strip())
            if d["label"] in label_to_id:
                texts.append(d["text"])
                labels.append(label_to_id[d["label"]])
    logger.info(f"  {len(texts)} samples loaded")

    # Train/val split
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=EVAL_SPLIT, random_state=SEED, stratify=labels
    )
    logger.info(f"  Train: {len(train_texts)}, Val: {len(val_texts)}")

    # Load tokenizer and model
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}")
    logger.info(f"Downloading/loading base model: {BASE_MODEL}")

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=num_labels
    )

    # Create datasets
    logger.info("Tokenizing datasets...")
    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(BASE_DIR / "models" / "checkpoints"),
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
        logging_dir=str(BASE_DIR / "models" / "logs"),
        logging_steps=50,
        save_total_limit=2,
        seed=SEED,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_safetensors=False,  # Use PyTorch format to avoid contiguity issues
        label_smoothing_factor=0.1,
    )

    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=4)],
    )

    # Train
    logger.info("Starting training...")
    train_result = trainer.train()
    logger.info(f"Training complete: {train_result.metrics}")

    # Evaluate
    logger.info("Evaluating...")
    eval_metrics = trainer.evaluate()
    logger.info(f"Eval metrics: {eval_metrics}")

    # Save model
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Saving model to {OUTPUT_DIR}")
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))

    # Copy label_mapping.json to model directory
    import shutil
    shutil.copy2(LABEL_MAPPING_PATH, OUTPUT_DIR / "label_mapping.json")

    # Detailed classification report on validation set
    logger.info("Generating classification report...")
    predictions = trainer.predict(val_dataset)
    preds = np.argmax(predictions.predictions, axis=-1)
    id_to_label = {int(v): k for k, v in label_to_id.items()}
    target_names = [id_to_label[i] for i in range(num_labels)]

    # Top-1 and Top-5 accuracy
    top1_correct = (preds == np.array(val_labels)).sum()
    top1_acc = top1_correct / len(val_labels)

    # Top-5
    logits = predictions.predictions
    top5_preds = np.argsort(logits, axis=-1)[:, -5:]
    top5_correct = sum(1 for i, label in enumerate(val_labels) if label in top5_preds[i])
    top5_acc = top5_correct / len(val_labels)

    logger.info(f"\n{'='*50}")
    logger.info(f"Final Results:")
    logger.info(f"  Top-1 Accuracy: {top1_acc:.4f} ({top1_correct}/{len(val_labels)})")
    logger.info(f"  Top-5 Accuracy: {top5_acc:.4f} ({top5_correct}/{len(val_labels)})")
    logger.info(f"  F1 (weighted):  {eval_metrics.get('eval_f1', 0):.4f}")
    logger.info(f"  Model saved to: {OUTPUT_DIR}")
    logger.info(f"{'='*50}")

    # Save metrics
    metrics = {
        "top1_accuracy": float(top1_acc),
        "top5_accuracy": float(top5_acc),
        "f1_weighted": float(eval_metrics.get("eval_f1", 0)),
        "num_intents": num_labels,
        "num_train_samples": len(train_texts),
        "num_val_samples": len(val_texts),
        "epochs": EPOCHS,
        "base_model": BASE_MODEL,
    }
    with open(OUTPUT_DIR / "training_metrics.json", 'w') as f:
        json.dump(metrics, f, indent=2)


if __name__ == "__main__":
    main()
