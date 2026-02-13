#!/usr/bin/env python3
"""
运行增量微调 - 简化版本

使用现有模型的标签映射，只对问题意图进行增量学习
"""

import json
import random
import logging
from pathlib import Path

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 配置
MODEL_PATH = Path(__file__).parent / "models/chinese-roberta-wwm-ext-classifier/final"
DATA_PATH = Path(__file__).parent / "data/incremental_training_data.jsonl"
OUTPUT_PATH = Path(__file__).parent / "models/incremental/final"

# 微调参数 - 防止灾难性遗忘
EPOCHS = 2
BATCH_SIZE = 8
LEARNING_RATE = 5e-6
FREEZE_LAYERS = 8  # 冻结前 8 层 (共 12 层)
MAX_LENGTH = 64
SEED = 42

class IntentDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            self.texts[idx],
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": torch.tensor(self.labels[idx], dtype=torch.long)
        }

def freeze_layers(model, num_layers):
    """冻结模型早期层"""
    # 获取基础模型 (支持 BERT 和 RoBERTa)
    if hasattr(model, 'bert'):
        base_model = model.bert
    elif hasattr(model, 'roberta'):
        base_model = model.roberta
    else:
        logger.warning("未知模型架构，跳过层冻结")
        return

    # 冻结 embeddings
    for param in base_model.embeddings.parameters():
        param.requires_grad = False

    # 冻结前 N 层 encoder
    for i, layer in enumerate(base_model.encoder.layer):
        if i < num_layers:
            for param in layer.parameters():
                param.requires_grad = False

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"可训练参数: {trainable:,} / {total:,} ({100*trainable/total:.1f}%)")

def compute_metrics(eval_pred):
    preds = eval_pred.predictions.argmax(-1)
    labels = eval_pred.label_ids
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1_weighted": f1_score(labels, preds, average="weighted", zero_division=0),
    }

def main():
    random.seed(SEED)
    torch.manual_seed(SEED)

    logger.info(f"加载模型: {MODEL_PATH}")

    # 加载标签映射
    with open(MODEL_PATH / "label_mapping.json", "r", encoding="utf-8") as f:
        label_mapping = json.load(f)
    label_to_id = label_mapping["label_to_id"]
    logger.info(f"标签数量: {len(label_to_id)}")

    # 加载训练数据
    logger.info(f"加载数据: {DATA_PATH}")
    data = []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))

    # 过滤有效标签
    valid_data = [d for d in data if d["label"] in label_to_id]
    invalid_labels = set(d["label"] for d in data if d["label"] not in label_to_id)
    if invalid_labels:
        logger.warning(f"跳过未知标签: {invalid_labels}")

    logger.info(f"有效样本: {len(valid_data)}")

    # 统计各意图样本数
    intent_counts = {}
    for d in valid_data:
        intent_counts[d["label"]] = intent_counts.get(d["label"], 0) + 1
    logger.info("样本分布:")
    for intent, count in sorted(intent_counts.items()):
        logger.info(f"  {intent}: {count}")

    # 准备数据
    texts = [d["text"] for d in valid_data]
    labels = [label_to_id[d["label"]] for d in valid_data]

    # 划分训练/验证集
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=0.15, random_state=SEED, stratify=labels
    )
    logger.info(f"训练集: {len(train_texts)}, 验证集: {len(val_texts)}")

    # 加载 tokenizer 和模型
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_PATH))

    # 冻结早期层
    if FREEZE_LAYERS > 0:
        freeze_layers(model, FREEZE_LAYERS)

    # 创建数据集
    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    # 训练配置
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_PATH.parent),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE * 2,
        learning_rate=LEARNING_RATE,
        warmup_ratio=0.1,
        weight_decay=0.01,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=20,
        save_strategy="steps",
        save_steps=20,  # 必须是 eval_steps 的倍数
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="f1_weighted",
        greater_is_better=True,
        seed=SEED,
        fp16=torch.cuda.is_available(),
        report_to="none",  # 禁用 wandb 等
        save_safetensors=False,  # 禁用 safetensors，使用 pytorch 格式避免 non-contiguous tensor 错误
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
    )

    # 训练前评估
    logger.info("训练前评估...")
    initial = trainer.evaluate()
    logger.info(f"训练前: accuracy={initial['eval_accuracy']:.4f}, f1={initial['eval_f1_weighted']:.4f}")

    # 训练
    logger.info("开始微调...")
    trainer.train()

    # 训练后评估
    logger.info("训练后评估...")
    final = trainer.evaluate()
    logger.info(f"训练后: accuracy={final['eval_accuracy']:.4f}, f1={final['eval_f1_weighted']:.4f}")

    # 保存模型
    trainer.save_model(str(OUTPUT_PATH))
    tokenizer.save_pretrained(str(OUTPUT_PATH))

    # 复制标签映射
    import shutil
    shutil.copy(MODEL_PATH / "label_mapping.json", OUTPUT_PATH / "label_mapping.json")

    logger.info(f"模型已保存: {OUTPUT_PATH}")

    # 打印结果
    print("\n" + "=" * 50)
    print("增量微调完成")
    print("=" * 50)
    print(f"训练前 Accuracy: {initial['eval_accuracy']:.4f}")
    print(f"训练后 Accuracy: {final['eval_accuracy']:.4f}")
    print(f"训练前 F1: {initial['eval_f1_weighted']:.4f}")
    print(f"训练后 F1: {final['eval_f1_weighted']:.4f}")
    improvement = final['eval_f1_weighted'] - initial['eval_f1_weighted']
    print(f"F1 变化: {'+' if improvement >= 0 else ''}{improvement:.4f}")
    print("=" * 50)

if __name__ == "__main__":
    main()
