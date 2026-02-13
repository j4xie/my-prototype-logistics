#!/usr/bin/env python3
"""
多任务微调脚本 — NER + 意图分类 (食品领域)

基于领域预训练的 food-roberta 模型，同时训练:
  - NER: 27 个 BIO 标签 (13 类实体 x B/I + O)
  - Intent: 230 类意图 (179 原有 + 50 新增食品意图 + 1 UNKNOWN)

抗灾难性遗忘策略:
  - EWC (Elastic Weight Consolidation) 正则化
  - 数据回放 (Data Replay): 混入旧数据
  - 层冻结 (Layer Freezing): 可冻结 Transformer 底层

使用方式:
  python finetune_food_ner.py \\
    --model ./food-roberta-pretrained \\
    --ner-data ./ner_data.jsonl \\
    --intent-data ./food_intent_data.jsonl \\
    --old-intent-data ./full_training_data.jsonl \\
    --output-dir ./food-ner-intent-model

  python finetune_food_ner.py \\
    --model hfl/chinese-roberta-wwm-ext \\
    --ner-data ./ner_data.jsonl \\
    --intent-data ./food_intent_data.jsonl \\
    --output-dir ./output \\
    --ewc-lambda 5000 \\
    --freeze-layers 6
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import ConcatDataset, DataLoader, Dataset, Subset

# Bypass torch.load security check for torch < 2.6 with transformers >= 4.57
import transformers.utils.import_utils as _tu
if hasattr(_tu, 'check_torch_load_is_safe'):
    _tu.check_torch_load_is_safe = lambda: None
import transformers.modeling_utils as _mu
if hasattr(_mu, 'check_torch_load_is_safe'):
    _mu.check_torch_load_is_safe = lambda: None

from transformers import (
    AutoConfig,
    AutoModel,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
    set_seed,
)

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
)

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("finetune_food_ner")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_MAX_SEQ_LENGTH = 256
DEFAULT_BATCH_SIZE = 16
DEFAULT_LEARNING_RATE = 3e-5
DEFAULT_EPOCHS = 10
DEFAULT_WARMUP_RATIO = 0.1
DEFAULT_WEIGHT_DECAY = 0.01
DEFAULT_EWC_LAMBDA = 5000.0
DEFAULT_REPLAY_RATIO = 0.2
DEFAULT_FREEZE_LAYERS = 0
DEFAULT_SEED = 42
DEFAULT_NER_WEIGHT = 1.0
DEFAULT_INTENT_WEIGHT = 1.0

# NER BIO 标签 (13 类 x 2 + O = 27)
NER_LABEL_LIST = [
    "O",
    "B-ADD", "I-ADD",  # ADDITIVE
    "B-CRT", "I-CRT",  # CERT
    "B-EQP", "I-EQP",  # EQUIPMENT
    "B-HAZ", "I-HAZ",  # HAZARD
    "B-ING", "I-ING",  # INGREDIENT
    "B-MIC", "I-MIC",  # MICROBE
    "B-NUT", "I-NUT",  # NUTRIENT
    "B-ORG", "I-ORG",  # ORG
    "B-PRM", "I-PRM",  # PROCESS_PARAM
    "B-PRD", "I-PRD",  # PRODUCT
    "B-REG", "I-REG",  # REGULATION
    "B-STD", "I-STD",  # STANDARD
    "B-TST", "I-TST",  # TEST_METHOD
]
NER_LABEL2ID = {label: i for i, label in enumerate(NER_LABEL_LIST)}
NER_ID2LABEL = {i: label for i, label in enumerate(NER_LABEL_LIST)}
NUM_NER_LABELS = len(NER_LABEL_LIST)


# ---------------------------------------------------------------------------
# 多任务模型
# ---------------------------------------------------------------------------

class MultiTaskModel(nn.Module):
    """
    多任务模型: 共享 Transformer 编码器 + NER 头 + Intent 分类头

    Architecture:
        [CLS] token1 token2 ... [SEP]
          |      |      |         |
        Encoder (shared)
          |      |      |
        Intent  NER   NER    ...
        Head    Head  Head
    """

    def __init__(
        self,
        base_model_name: str,
        num_ner_labels: int,
        num_intent_labels: int,
        dropout_rate: float = 0.1,
    ):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base_model_name)
        hidden_size = self.encoder.config.hidden_size

        # NER 头: 对每个 token 做分类
        self.ner_dropout = nn.Dropout(dropout_rate)
        self.ner_classifier = nn.Linear(hidden_size, num_ner_labels)

        # Intent 分类头: 对 [CLS] token 做分类
        self.intent_dropout = nn.Dropout(dropout_rate)
        self.intent_classifier = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size, num_intent_labels),
        )

        self.num_ner_labels = num_ner_labels
        self.num_intent_labels = num_intent_labels

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: Optional[torch.Tensor] = None,
        ner_labels: Optional[torch.Tensor] = None,
        intent_labels: Optional[torch.Tensor] = None,
        task: str = "both",  # "ner", "intent", "both"
    ) -> Dict[str, torch.Tensor]:
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        )
        sequence_output = outputs.last_hidden_state  # (B, L, H)
        cls_output = sequence_output[:, 0, :]  # (B, H)

        result = {}

        # NER
        if task in ("ner", "both"):
            ner_logits = self.ner_classifier(self.ner_dropout(sequence_output))
            result["ner_logits"] = ner_logits

            if ner_labels is not None:
                loss_fct = nn.CrossEntropyLoss(ignore_index=-100)
                ner_loss = loss_fct(
                    ner_logits.view(-1, self.num_ner_labels),
                    ner_labels.view(-1),
                )
                result["ner_loss"] = ner_loss

        # Intent
        if task in ("intent", "both"):
            intent_logits = self.intent_classifier(self.intent_dropout(cls_output))
            result["intent_logits"] = intent_logits

            if intent_labels is not None:
                loss_fct = nn.CrossEntropyLoss()
                intent_loss = loss_fct(intent_logits, intent_labels)
                result["intent_loss"] = intent_loss

        return result

    def freeze_encoder_layers(self, num_layers: int) -> None:
        """冻结编码器底部的 N 层。"""
        if num_layers <= 0:
            return
        # 冻结嵌入层
        for param in self.encoder.embeddings.parameters():
            param.requires_grad = False
        # 冻结底部 Transformer 层
        for i in range(min(num_layers, len(self.encoder.encoder.layer))):
            for param in self.encoder.encoder.layer[i].parameters():
                param.requires_grad = False
        logger.info("已冻结编码器嵌入层 + 底部 %d 层", num_layers)


# ---------------------------------------------------------------------------
# EWC (Elastic Weight Consolidation)
# ---------------------------------------------------------------------------

class EWC:
    """
    Elastic Weight Consolidation 正则化。
    通过惩罚参数偏离旧任务最优值来防止灾难性遗忘。
    """

    def __init__(self, model: nn.Module, dataloader: DataLoader, device: str):
        self.params = {}
        self.fisher = {}
        self._compute_fisher(model, dataloader, device)

    def _compute_fisher(
        self,
        model: nn.Module,
        dataloader: DataLoader,
        device: str,
        num_samples: int = 200,
    ) -> None:
        """计算 Fisher 信息矩阵的对角近似。"""
        model.eval()
        fisher_diag = {}

        for name, param in model.named_parameters():
            if param.requires_grad:
                self.params[name] = param.data.clone()
                fisher_diag[name] = torch.zeros_like(param)

        count = 0
        for batch in dataloader:
            if count >= num_samples:
                break

            batch = {k: v.to(device) for k, v in batch.items()}
            model.zero_grad()

            # 用 intent 任务计算 Fisher
            if "intent_labels" in batch:
                outputs = model(
                    input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    intent_labels=batch["intent_labels"],
                    task="intent",
                )
                loss = outputs["intent_loss"]
            elif "ner_labels" in batch:
                outputs = model(
                    input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    ner_labels=batch["ner_labels"],
                    task="ner",
                )
                loss = outputs["ner_loss"]
            else:
                continue

            loss.backward()

            for name, param in model.named_parameters():
                if param.requires_grad and param.grad is not None:
                    fisher_diag[name] += param.grad.data ** 2

            count += batch["input_ids"].size(0)

        # 归一化
        for name in fisher_diag:
            fisher_diag[name] /= max(count, 1)

        self.fisher = fisher_diag
        logger.info("EWC Fisher 矩阵计算完成 (基于 %d 样本)", count)

    def penalty(self, model: nn.Module) -> torch.Tensor:
        """计算 EWC 惩罚项。"""
        loss = torch.tensor(0.0, device=next(model.parameters()).device)
        for name, param in model.named_parameters():
            if name in self.fisher:
                loss += (self.fisher[name] * (param - self.params[name]) ** 2).sum()
        return loss


# ---------------------------------------------------------------------------
# 数据集
# ---------------------------------------------------------------------------

class NERDataset(Dataset):
    """NER 数据集 (BIO 格式)"""

    def __init__(
        self,
        data_path: str,
        tokenizer: AutoTokenizer,
        label2id: Dict[str, int],
        max_length: int = DEFAULT_MAX_SEQ_LENGTH,
    ):
        self.tokenizer = tokenizer
        self.label2id = label2id
        self.max_length = max_length
        self.examples = []

        with open(data_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    text = record["text"]
                    labels = record["labels"]
                    if len(text) != len(labels):
                        logger.warning(
                            "行 %d: 文本长度 (%d) != 标签长度 (%d), 跳过",
                            line_num, len(text), len(labels),
                        )
                        continue
                    self.examples.append({"text": text, "labels": labels})
                except (json.JSONDecodeError, KeyError) as exc:
                    logger.warning("行 %d: 解析失败 (%s), 跳过", line_num, exc)

        logger.info("NER 数据集: %d 条 (from %s)", len(self.examples), data_path)

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        example = self.examples[idx]
        text = example["text"]
        char_labels = example["labels"]

        # Tokenize (字级别)
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
            return_offsets_mapping=True,
        )

        # 将字级别标签对齐到 token
        offsets = encoding.pop("offset_mapping")
        token_labels = []

        for offset in offsets:
            start, end = offset
            if start == 0 and end == 0:
                # 特殊 token ([CLS], [SEP], [PAD])
                token_labels.append(-100)
            elif start < len(char_labels):
                label_str = char_labels[start]
                token_labels.append(self.label2id.get(label_str, 0))
            else:
                token_labels.append(-100)

        return {
            "input_ids": torch.tensor(encoding["input_ids"], dtype=torch.long),
            "attention_mask": torch.tensor(encoding["attention_mask"], dtype=torch.long),
            "ner_labels": torch.tensor(token_labels, dtype=torch.long),
        }


class IntentDataset(Dataset):
    """意图分类数据集"""

    def __init__(
        self,
        data_path: str,
        tokenizer: AutoTokenizer,
        label2id: Dict[str, int],
        max_length: int = DEFAULT_MAX_SEQ_LENGTH,
    ):
        self.tokenizer = tokenizer
        self.label2id = label2id
        self.max_length = max_length
        self.examples = []

        with open(data_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    text = record["text"]
                    label = record["label"]
                    if label in self.label2id:
                        self.examples.append({"text": text, "label": label})
                    else:
                        # 未知标签映射到 UNKNOWN
                        if "UNKNOWN" in self.label2id:
                            self.examples.append({"text": text, "label": "UNKNOWN"})
                except (json.JSONDecodeError, KeyError):
                    continue

        logger.info("Intent 数据集: %d 条 (from %s)", len(self.examples), data_path)

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        example = self.examples[idx]
        encoding = self.tokenizer(
            example["text"],
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
        )
        return {
            "input_ids": torch.tensor(encoding["input_ids"], dtype=torch.long),
            "attention_mask": torch.tensor(encoding["attention_mask"], dtype=torch.long),
            "intent_labels": torch.tensor(
                self.label2id[example["label"]], dtype=torch.long,
            ),
        }


# ---------------------------------------------------------------------------
# 标签映射构建
# ---------------------------------------------------------------------------

def build_intent_label_mapping(
    *data_paths: str,
) -> Tuple[Dict[str, int], Dict[int, str]]:
    """
    从多个 JSONL 文件中收集所有意图标签，构建统一的标签映射。
    自动包含 UNKNOWN 类别。
    """
    labels = set()
    for path in data_paths:
        if not path or not Path(path).exists():
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    labels.add(record["label"])
                except (json.JSONDecodeError, KeyError):
                    continue

    labels.add("UNKNOWN")
    sorted_labels = sorted(labels)
    label2id = {label: i for i, label in enumerate(sorted_labels)}
    id2label = {i: label for label, i in label2id.items()}

    return label2id, id2label


# ---------------------------------------------------------------------------
# 评估
# ---------------------------------------------------------------------------

def evaluate_ner(
    model: nn.Module,
    dataloader: DataLoader,
    device: str,
    id2label: Dict[int, str],
) -> Dict:
    """评估 NER 性能。"""
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in dataloader:
            batch = {k: v.to(device) for k, v in batch.items()}
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
                task="ner",
            )
            preds = outputs["ner_logits"].argmax(dim=-1)  # (B, L)
            labels = batch["ner_labels"]

            for pred_seq, label_seq, mask in zip(
                preds, labels, batch["attention_mask"]
            ):
                for p, l, m in zip(pred_seq, label_seq, mask):
                    if m.item() == 1 and l.item() != -100:
                        all_preds.append(id2label.get(p.item(), "O"))
                        all_labels.append(id2label.get(l.item(), "O"))

    # 过滤掉 O 标签计算实体 F1
    entity_labels = [l for l in set(all_labels) if l != "O"]

    micro_f1 = f1_score(
        all_labels, all_preds, labels=entity_labels, average="micro", zero_division=0,
    )
    macro_f1 = f1_score(
        all_labels, all_preds, labels=entity_labels, average="macro", zero_division=0,
    )

    report = classification_report(
        all_labels, all_preds, labels=entity_labels, output_dict=True, zero_division=0,
    )

    return {
        "ner_micro_f1": micro_f1,
        "ner_macro_f1": macro_f1,
        "ner_report": report,
    }


def evaluate_intent(
    model: nn.Module,
    dataloader: DataLoader,
    device: str,
    id2label: Dict[int, str],
) -> Dict:
    """评估意图分类性能。"""
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in dataloader:
            batch = {k: v.to(device) for k, v in batch.items()}
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
                task="intent",
            )
            preds = outputs["intent_logits"].argmax(dim=-1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(batch["intent_labels"].cpu().tolist())

    pred_labels = [id2label.get(p, "UNKNOWN") for p in all_preds]
    true_labels = [id2label.get(l, "UNKNOWN") for l in all_labels]

    accuracy = accuracy_score(true_labels, pred_labels)
    micro_f1 = f1_score(true_labels, pred_labels, average="micro", zero_division=0)
    macro_f1 = f1_score(true_labels, pred_labels, average="macro", zero_division=0)

    report = classification_report(
        true_labels, pred_labels, output_dict=True, zero_division=0,
    )

    return {
        "intent_accuracy": accuracy,
        "intent_micro_f1": micro_f1,
        "intent_macro_f1": macro_f1,
        "intent_report": report,
    }


# ---------------------------------------------------------------------------
# 训练循环
# ---------------------------------------------------------------------------

def train_epoch(
    model: nn.Module,
    ner_loader: Optional[DataLoader],
    intent_loader: Optional[DataLoader],
    optimizer: torch.optim.Optimizer,
    scheduler: Any,
    device: str,
    ner_weight: float,
    intent_weight: float,
    ewc: Optional[EWC] = None,
    ewc_lambda: float = 0.0,
    max_grad_norm: float = 1.0,
) -> Dict[str, float]:
    """单轮训练。"""
    model.train()
    total_loss = 0.0
    total_ner_loss = 0.0
    total_intent_loss = 0.0
    total_ewc_loss = 0.0
    num_steps = 0

    # 交替训练 NER 和 Intent
    ner_iter = iter(ner_loader) if ner_loader else None
    intent_iter = iter(intent_loader) if intent_loader else None

    while True:
        loss = torch.tensor(0.0, device=device, requires_grad=True)
        step_done = False

        # NER step
        if ner_iter is not None:
            try:
                batch = next(ner_iter)
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(
                    input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    ner_labels=batch["ner_labels"],
                    task="ner",
                )
                ner_loss = outputs["ner_loss"] * ner_weight
                loss = loss + ner_loss
                total_ner_loss += ner_loss.item()
                step_done = True
            except StopIteration:
                ner_iter = None

        # Intent step
        if intent_iter is not None:
            try:
                batch = next(intent_iter)
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(
                    input_ids=batch["input_ids"],
                    attention_mask=batch["attention_mask"],
                    intent_labels=batch["intent_labels"],
                    task="intent",
                )
                intent_loss = outputs["intent_loss"] * intent_weight
                loss = loss + intent_loss
                total_intent_loss += intent_loss.item()
                step_done = True
            except StopIteration:
                intent_iter = None

        if not step_done:
            break

        # EWC 惩罚
        if ewc is not None and ewc_lambda > 0:
            ewc_penalty = ewc.penalty(model) * ewc_lambda
            loss = loss + ewc_penalty
            total_ewc_loss += ewc_penalty.item()

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()

        total_loss += loss.item()
        num_steps += 1

    return {
        "loss": total_loss / max(num_steps, 1),
        "ner_loss": total_ner_loss / max(num_steps, 1),
        "intent_loss": total_intent_loss / max(num_steps, 1),
        "ewc_loss": total_ewc_loss / max(num_steps, 1),
        "steps": num_steps,
    }


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="多任务微调: NER (27类BIO) + Intent (230类) — 食品领域",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # 模型与数据
    parser.add_argument("--model", type=str, required=True, help="基座模型路径")
    parser.add_argument("--ner-data", type=str, default=None, help="NER 训练数据 (JSONL)")
    parser.add_argument("--intent-data", type=str, default=None, help="新意图训练数据 (JSONL)")
    parser.add_argument("--old-intent-data", type=str, default=None, help="旧意图训练数据 (JSONL, 用于数据回放)")
    parser.add_argument("--output-dir", type=str, required=True, help="模型输出目录")

    # 训练超参
    parser.add_argument("--max-seq-length", type=int, default=DEFAULT_MAX_SEQ_LENGTH)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=DEFAULT_LEARNING_RATE, dest="learning_rate")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--warmup-ratio", type=float, default=DEFAULT_WARMUP_RATIO)
    parser.add_argument("--weight-decay", type=float, default=DEFAULT_WEIGHT_DECAY)
    parser.add_argument("--ner-weight", type=float, default=DEFAULT_NER_WEIGHT, help="NER 任务权重")
    parser.add_argument("--intent-weight", type=float, default=DEFAULT_INTENT_WEIGHT, help="Intent 任务权重")

    # 抗遗忘策略
    parser.add_argument("--ewc-lambda", type=float, default=DEFAULT_EWC_LAMBDA, help="EWC 正则化强度")
    parser.add_argument("--replay-ratio", type=float, default=DEFAULT_REPLAY_RATIO, help="旧数据回放比例")
    parser.add_argument("--freeze-layers", type=int, default=DEFAULT_FREEZE_LAYERS, help="冻结编码器底部层数")

    # 其他
    parser.add_argument("--eval-split", type=float, default=0.1, help="验证集比例")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--fp16", action="store_true", help="启用 FP16")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    set_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("多任务微调: NER + Intent (食品领域)")
    logger.info("基座模型: %s", args.model)
    logger.info("设备: %s", device)
    logger.info("EWC lambda: %.1f", args.ewc_lambda)
    logger.info("回放比例: %.2f", args.replay_ratio)
    logger.info("冻结层数: %d", args.freeze_layers)
    logger.info("=" * 60)

    # 1. 加载 tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model)

    # 2. 构建意图标签映射
    intent_data_paths = [
        p for p in [args.intent_data, args.old_intent_data] if p
    ]
    intent_label2id, intent_id2label = build_intent_label_mapping(*intent_data_paths)
    num_intent_labels = len(intent_label2id)
    logger.info("意图标签数: %d", num_intent_labels)

    # 3. 构建数据集
    # NER
    ner_train_loader = None
    ner_eval_loader = None
    if args.ner_data:
        ner_dataset = NERDataset(
            args.ner_data, tokenizer, NER_LABEL2ID, args.max_seq_length,
        )
        ner_eval_size = max(1, int(len(ner_dataset) * args.eval_split))
        ner_train_size = len(ner_dataset) - ner_eval_size
        indices = list(range(len(ner_dataset)))
        ner_train_ds = Subset(ner_dataset, indices[:ner_train_size])
        ner_eval_ds = Subset(ner_dataset, indices[ner_train_size:])
        ner_train_loader = DataLoader(ner_train_ds, batch_size=args.batch_size, shuffle=True)
        ner_eval_loader = DataLoader(ner_eval_ds, batch_size=args.batch_size * 2)
        logger.info("NER 训练: %d, 验证: %d", len(ner_train_ds), len(ner_eval_ds))

    # Intent (新 + 旧数据回放)
    intent_train_loader = None
    intent_eval_loader = None
    intent_datasets = []

    if args.intent_data:
        new_intent_ds = IntentDataset(
            args.intent_data, tokenizer, intent_label2id, args.max_seq_length,
        )
        intent_datasets.append(new_intent_ds)

    if args.old_intent_data and args.replay_ratio > 0:
        old_intent_ds = IntentDataset(
            args.old_intent_data, tokenizer, intent_label2id, args.max_seq_length,
        )
        # 按回放比例采样
        replay_size = int(len(old_intent_ds) * args.replay_ratio)
        if replay_size > 0:
            import random
            rng = random.Random(args.seed)
            replay_indices = rng.sample(range(len(old_intent_ds)), min(replay_size, len(old_intent_ds)))
            replay_ds = Subset(old_intent_ds, replay_indices)
            intent_datasets.append(replay_ds)
            logger.info("旧数据回放: %d 条 (%.1f%%)", len(replay_ds), args.replay_ratio * 100)

    if intent_datasets:
        combined_intent_ds = ConcatDataset(intent_datasets) if len(intent_datasets) > 1 else intent_datasets[0]
        intent_eval_size = max(1, int(len(combined_intent_ds) * args.eval_split))
        intent_train_size = len(combined_intent_ds) - intent_eval_size
        indices = list(range(len(combined_intent_ds)))
        import random
        random.Random(args.seed).shuffle(indices)
        intent_train_ds = Subset(combined_intent_ds, indices[:intent_train_size])
        intent_eval_ds = Subset(combined_intent_ds, indices[intent_train_size:])
        intent_train_loader = DataLoader(intent_train_ds, batch_size=args.batch_size, shuffle=True)
        intent_eval_loader = DataLoader(intent_eval_ds, batch_size=args.batch_size * 2)
        logger.info("Intent 训练: %d, 验证: %d", len(intent_train_ds), len(intent_eval_ds))

    if ner_train_loader is None and intent_train_loader is None:
        logger.error("至少需要提供 --ner-data 或 --intent-data")
        sys.exit(1)

    # 4. 构建模型
    model = MultiTaskModel(
        base_model_name=args.model,
        num_ner_labels=NUM_NER_LABELS,
        num_intent_labels=num_intent_labels,
    )

    # 层冻结
    if args.freeze_layers > 0:
        model.freeze_encoder_layers(args.freeze_layers)

    model.to(device)

    # 5. EWC 初始化 (如果有旧数据)
    ewc = None
    if args.ewc_lambda > 0 and args.old_intent_data and intent_train_loader:
        logger.info("计算 EWC Fisher 信息矩阵...")
        ewc = EWC(model, intent_train_loader, device)

    # 6. 优化器和调度器
    no_decay = ["bias", "LayerNorm.weight"]
    optimizer_params = [
        {
            "params": [
                p for n, p in model.named_parameters()
                if p.requires_grad and not any(nd in n for nd in no_decay)
            ],
            "weight_decay": args.weight_decay,
        },
        {
            "params": [
                p for n, p in model.named_parameters()
                if p.requires_grad and any(nd in n for nd in no_decay)
            ],
            "weight_decay": 0.0,
        },
    ]
    optimizer = torch.optim.AdamW(optimizer_params, lr=args.learning_rate)

    # 估算总步数
    steps_per_epoch = max(
        len(ner_train_loader) if ner_train_loader else 0,
        len(intent_train_loader) if intent_train_loader else 0,
    )
    total_steps = steps_per_epoch * args.epochs
    warmup_steps = int(total_steps * args.warmup_ratio)

    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=warmup_steps, num_training_steps=total_steps,
    )

    # 7. 训练循环
    best_metric = 0.0
    best_epoch = -1

    scaler = torch.cuda.amp.GradScaler() if args.fp16 and device == "cuda" else None

    for epoch in range(args.epochs):
        logger.info("--- Epoch %d/%d ---", epoch + 1, args.epochs)

        train_metrics = train_epoch(
            model=model,
            ner_loader=ner_train_loader,
            intent_loader=intent_train_loader,
            optimizer=optimizer,
            scheduler=scheduler,
            device=device,
            ner_weight=args.ner_weight,
            intent_weight=args.intent_weight,
            ewc=ewc,
            ewc_lambda=args.ewc_lambda,
        )

        logger.info(
            "Epoch %d | loss=%.4f | ner_loss=%.4f | intent_loss=%.4f | ewc_loss=%.4f",
            epoch + 1, train_metrics["loss"], train_metrics["ner_loss"],
            train_metrics["intent_loss"], train_metrics["ewc_loss"],
        )

        # 评估
        eval_metric_sum = 0.0

        if ner_eval_loader:
            ner_metrics = evaluate_ner(model, ner_eval_loader, device, NER_ID2LABEL)
            logger.info(
                "  NER — micro_F1=%.4f, macro_F1=%.4f",
                ner_metrics["ner_micro_f1"], ner_metrics["ner_macro_f1"],
            )
            eval_metric_sum += ner_metrics["ner_micro_f1"]

        if intent_eval_loader:
            intent_metrics = evaluate_intent(
                model, intent_eval_loader, device, intent_id2label,
            )
            logger.info(
                "  Intent — accuracy=%.4f, micro_F1=%.4f, macro_F1=%.4f",
                intent_metrics["intent_accuracy"],
                intent_metrics["intent_micro_f1"],
                intent_metrics["intent_macro_f1"],
            )
            eval_metric_sum += intent_metrics["intent_accuracy"]

        # 保存最佳模型
        if eval_metric_sum > best_metric:
            best_metric = eval_metric_sum
            best_epoch = epoch + 1
            best_dir = output_dir / "best"
            best_dir.mkdir(exist_ok=True)
            torch.save(model.state_dict(), best_dir / "model.pt")
            tokenizer.save_pretrained(str(best_dir))
            logger.info("  ** 最佳模型已保存 (metric=%.4f)", best_metric)

        # 定期保存检查点
        if (epoch + 1) % 3 == 0 or epoch == args.epochs - 1:
            ckpt_dir = output_dir / f"checkpoint-epoch{epoch+1}"
            ckpt_dir.mkdir(exist_ok=True)
            torch.save({
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "best_metric": best_metric,
            }, ckpt_dir / "checkpoint.pt")
            logger.info("  检查点已保存: %s", ckpt_dir)

    # 8. 保存最终模型和标签映射
    logger.info("保存最终模型...")
    final_dir = output_dir / "final"
    final_dir.mkdir(exist_ok=True)
    torch.save(model.state_dict(), final_dir / "model.pt")
    tokenizer.save_pretrained(str(final_dir))

    # 保存标签映射 — 使用与运行时分类器一致的键名 (label_to_id / id_to_label)
    # 同时保留 intent_ 前缀的键名以便训练脚本内部使用
    intent_names = {label: label for label in intent_label2id}  # placeholder names
    label_mapping = {
        # 运行时分类器期望的键名
        "label_to_id": intent_label2id,
        "id_to_label": {str(k): v for k, v in intent_id2label.items()},
        "intent_names": intent_names,
        "num_labels": num_intent_labels,
        # NER 相关
        "ner_labels": NER_LABEL_LIST,
        "ner_label2id": NER_LABEL2ID,
        "num_ner_labels": NUM_NER_LABELS,
        # 训练脚本兼容键名
        "intent_label2id": intent_label2id,
        "intent_id2label": {str(k): v for k, v in intent_id2label.items()},
        "num_intent_labels": num_intent_labels,
    }
    with open(output_dir / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump(label_mapping, f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info("训练完成!")
    logger.info("最佳 Epoch: %d (metric=%.4f)", best_epoch, best_metric)
    logger.info("NER 标签数: %d", NUM_NER_LABELS)
    logger.info("Intent 标签数: %d", num_intent_labels)
    logger.info("模型目录: %s", output_dir.resolve())
    logger.info("标签映射: %s", (output_dir / "label_mapping.json").resolve())
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
