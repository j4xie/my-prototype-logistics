#!/usr/bin/env python3
"""
增量微调脚本 - 防止灾难性遗忘

策略:
1. 低学习率 (1e-5 或更低)
2. 数据混合 (新数据 + 旧数据回放)
3. 冻结早期层 (只训练最后几层)
4. 少量 epoch (1-3)
5. 小 batch size (8-16)
6. 早停 (验证集无提升时停止)

使用方法:
    python incremental_finetune.py --new-data data/incremental_training_data.jsonl
                                   --old-data data/original_training_data.jsonl
                                   --model-path models/chinese-roberta-wwm-ext-classifier/final
                                   --output-path models/chinese-roberta-wwm-ext-classifier/incremental
                                   --epochs 2
                                   --batch-size 8
                                   --lr 5e-6
                                   --replay-ratio 0.5
                                   --freeze-layers 8
"""

import argparse
import json
import random
import logging
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass

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
from sklearn.metrics import accuracy_score, f1_score, classification_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class FinetuneConfig:
    """微调配置"""
    new_data_path: str
    old_data_path: Optional[str] = None
    model_path: str = "hfl/chinese-roberta-wwm-ext"
    output_path: str = "models/incremental"
    epochs: int = 2
    batch_size: int = 8
    learning_rate: float = 5e-6
    replay_ratio: float = 0.5  # 旧数据回放比例
    freeze_layers: int = 8     # 冻结前 N 层
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
    max_length: int = 64
    seed: int = 42
    eval_steps: int = 50
    save_steps: int = 100
    early_stopping_patience: int = 3

class IntentDataset(Dataset):
    """意图识别数据集"""

    def __init__(self, texts: List[str], labels: List[int], tokenizer, max_length: int):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )

        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": torch.tensor(label, dtype=torch.long)
        }

def load_jsonl(file_path: str) -> List[Dict]:
    """加载 JSONL 格式数据"""
    data = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data

def load_csv(file_path: str) -> List[Dict]:
    """加载 CSV 格式数据"""
    import csv
    data = []
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({
                "text": row.get("user_input", row.get("text", "")),
                "label": row.get("intent_code", row.get("label", ""))
            })
    return data

def load_data(file_path: str) -> List[Dict]:
    """自动检测格式并加载数据"""
    path = Path(file_path)
    if path.suffix == ".jsonl":
        return load_jsonl(file_path)
    elif path.suffix == ".csv":
        return load_csv(file_path)
    elif path.suffix == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise ValueError(f"不支持的文件格式: {path.suffix}")

def merge_and_sample_data(
    new_data: List[Dict],
    old_data: Optional[List[Dict]],
    replay_ratio: float
) -> List[Dict]:
    """
    合并新旧数据，防止灾难性遗忘

    Args:
        new_data: 新增训练数据
        old_data: 原有训练数据
        replay_ratio: 旧数据回放比例 (相对于新数据)

    Returns:
        合并后的数据集
    """
    merged = list(new_data)

    if old_data and replay_ratio > 0:
        # 计算需要采样的旧数据数量
        num_old_samples = int(len(new_data) * replay_ratio)
        num_old_samples = min(num_old_samples, len(old_data))

        # 随机采样旧数据
        old_samples = random.sample(old_data, num_old_samples)
        merged.extend(old_samples)

        logger.info(f"数据合并: 新数据 {len(new_data)}, 旧数据回放 {len(old_samples)}, 总计 {len(merged)}")
    else:
        logger.info(f"仅使用新数据: {len(new_data)} 样本")

    random.shuffle(merged)
    return merged

def freeze_model_layers(model, num_layers_to_freeze: int):
    """
    冻结模型的前 N 层

    对于 BERT/RoBERTa，共 12 层 encoder
    建议冻结 8-10 层，只训练最后 2-4 层
    """
    # 冻结 embeddings
    for param in model.roberta.embeddings.parameters():
        param.requires_grad = False

    # 冻结前 N 层 encoder
    for i, layer in enumerate(model.roberta.encoder.layer):
        if i < num_layers_to_freeze:
            for param in layer.parameters():
                param.requires_grad = False
            logger.info(f"冻结 encoder layer {i}")

    # 统计可训练参数
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(f"可训练参数: {trainable_params:,} / {total_params:,} ({100*trainable_params/total_params:.1f}%)")

def compute_metrics(eval_pred):
    """计算评估指标"""
    predictions, labels = eval_pred
    preds = predictions.argmax(-1)

    accuracy = accuracy_score(labels, preds)
    f1_macro = f1_score(labels, preds, average="macro", zero_division=0)
    f1_weighted = f1_score(labels, preds, average="weighted", zero_division=0)

    return {
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
    }

def run_finetuning(config: FinetuneConfig):
    """执行增量微调"""
    # 设置随机种子
    random.seed(config.seed)
    torch.manual_seed(config.seed)

    # 加载数据
    logger.info(f"加载新数据: {config.new_data_path}")
    new_data = load_data(config.new_data_path)

    old_data = None
    if config.old_data_path and Path(config.old_data_path).exists():
        logger.info(f"加载旧数据: {config.old_data_path}")
        old_data = load_data(config.old_data_path)

    # 合并数据
    merged_data = merge_and_sample_data(new_data, old_data, config.replay_ratio)

    # 构建标签映射
    labels = list(set(d["label"] for d in merged_data))
    label_to_id = {label: i for i, label in enumerate(sorted(labels))}
    id_to_label = {i: label for label, i in label_to_id.items()}

    logger.info(f"标签数量: {len(labels)}")
    logger.info(f"标签映射: {label_to_id}")

    # 加载 tokenizer 和模型
    logger.info(f"加载模型: {config.model_path}")

    # 检查是否是预训练模型路径还是微调后的模型路径
    model_path = Path(config.model_path)
    if model_path.exists() and (model_path / "config.json").exists():
        # 加载已微调的模型
        tokenizer = AutoTokenizer.from_pretrained(str(model_path))
        model = AutoModelForSequenceClassification.from_pretrained(
            str(model_path),
            num_labels=len(labels),
            ignore_mismatched_sizes=True  # 允许分类层大小不匹配
        )
        logger.info("加载已微调的模型")
    else:
        # 从 HuggingFace 加载预训练模型
        tokenizer = AutoTokenizer.from_pretrained(config.model_path)
        model = AutoModelForSequenceClassification.from_pretrained(
            config.model_path,
            num_labels=len(labels)
        )
        logger.info("加载预训练模型")

    # 冻结早期层
    if config.freeze_layers > 0:
        freeze_model_layers(model, config.freeze_layers)

    # 准备数据
    texts = [d["text"] for d in merged_data]
    label_ids = [label_to_id[d["label"]] for d in merged_data]

    # 划分训练集和验证集
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, label_ids, test_size=0.1, random_state=config.seed, stratify=label_ids
    )

    train_dataset = IntentDataset(train_texts, train_labels, tokenizer, config.max_length)
    val_dataset = IntentDataset(val_texts, val_labels, tokenizer, config.max_length)

    logger.info(f"训练集: {len(train_dataset)}, 验证集: {len(val_dataset)}")

    # 配置训练参数
    output_path = Path(config.output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(output_path),
        num_train_epochs=config.epochs,
        per_device_train_batch_size=config.batch_size,
        per_device_eval_batch_size=config.batch_size * 2,
        learning_rate=config.learning_rate,
        warmup_ratio=config.warmup_ratio,
        weight_decay=config.weight_decay,
        logging_dir=str(output_path / "logs"),
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=config.eval_steps,
        save_strategy="steps",
        save_steps=config.save_steps,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="f1_weighted",
        greater_is_better=True,
        seed=config.seed,
        fp16=torch.cuda.is_available(),  # 如果有 GPU 则使用混合精度
    )

    # 创建 Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=config.early_stopping_patience)]
    )

    # 训练前评估
    logger.info("训练前评估...")
    initial_metrics = trainer.evaluate()
    logger.info(f"训练前指标: {initial_metrics}")

    # 开始训练
    logger.info("开始增量微调...")
    trainer.train()

    # 训练后评估
    logger.info("训练后评估...")
    final_metrics = trainer.evaluate()
    logger.info(f"训练后指标: {final_metrics}")

    # 保存模型
    final_output = output_path / "final"
    trainer.save_model(str(final_output))
    tokenizer.save_pretrained(str(final_output))

    # 保存标签映射
    with open(final_output / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump({
            "label_to_id": label_to_id,
            "id_to_label": id_to_label
        }, f, ensure_ascii=False, indent=2)

    logger.info(f"模型已保存到: {final_output}")

    # 打印改进情况
    print("\n" + "=" * 50)
    print("增量微调完成")
    print("=" * 50)
    print(f"训练前 F1: {initial_metrics.get('eval_f1_weighted', 0):.4f}")
    print(f"训练后 F1: {final_metrics.get('eval_f1_weighted', 0):.4f}")
    print(f"改进: {final_metrics.get('eval_f1_weighted', 0) - initial_metrics.get('eval_f1_weighted', 0):.4f}")
    print("=" * 50)

    return trainer, final_metrics

def main():
    parser = argparse.ArgumentParser(description="增量微调意图分类器")
    parser.add_argument("--new-data", required=True, help="新增训练数据路径")
    parser.add_argument("--old-data", help="原有训练数据路径 (用于回放)")
    parser.add_argument("--model-path", default="hfl/chinese-roberta-wwm-ext", help="基础模型路径")
    parser.add_argument("--output-path", default="models/incremental", help="输出模型路径")
    parser.add_argument("--epochs", type=int, default=2, help="训练轮数")
    parser.add_argument("--batch-size", type=int, default=8, help="批次大小")
    parser.add_argument("--lr", type=float, default=5e-6, help="学习率")
    parser.add_argument("--replay-ratio", type=float, default=0.5, help="旧数据回放比例")
    parser.add_argument("--freeze-layers", type=int, default=8, help="冻结前 N 层")
    parser.add_argument("--seed", type=int, default=42, help="随机种子")

    args = parser.parse_args()

    config = FinetuneConfig(
        new_data_path=args.new_data,
        old_data_path=args.old_data,
        model_path=args.model_path,
        output_path=args.output_path,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        replay_ratio=args.replay_ratio,
        freeze_layers=args.freeze_layers,
        seed=args.seed,
    )

    run_finetuning(config)

if __name__ == "__main__":
    main()
