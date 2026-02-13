#!/usr/bin/env python3
"""
食品领域自适应 MLM 预训练脚本

基于 hfl/chinese-roberta-wwm-ext 进行 Masked Language Model 预训练，
使模型更好地理解食品领域专业术语和语义。

特性:
  - 全词遮蔽 (Whole Word Masking, WWM)
  - FP16 混合精度训练
  - 梯度累积
  - 自动保存检查点
  - 验证集评估

使用方式:
  python domain_pretrain.py --corpus ./corpus/food_corpus.jsonl --output-dir ./food-roberta-pretrained
  python domain_pretrain.py --corpus ./corpus/ --output-dir ./output --batch-size 16 --lr 3e-5 --epochs 5
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

import torch
from torch.utils.data import Dataset

from transformers import (
    AutoModelForMaskedLM,
    AutoTokenizer,
    DataCollatorForWholeWordMask,
    Trainer,
    TrainingArguments,
    set_seed,
)

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("domain_pretrain")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_BASE_MODEL = "hfl/chinese-roberta-wwm-ext"
DEFAULT_MAX_SEQ_LENGTH = 512
DEFAULT_MLM_PROBABILITY = 0.15
DEFAULT_LEARNING_RATE = 5e-5
DEFAULT_EPOCHS = 3
DEFAULT_BATCH_SIZE = 8
DEFAULT_GRADIENT_ACCUMULATION = 4
DEFAULT_WARMUP_RATIO = 0.1
DEFAULT_WEIGHT_DECAY = 0.01
DEFAULT_EVAL_SPLIT = 0.05
DEFAULT_SEED = 42
DEFAULT_SAVE_STEPS = 500
DEFAULT_LOGGING_STEPS = 100


# ---------------------------------------------------------------------------
# 数据集
# ---------------------------------------------------------------------------

class FoodCorpusDataset(Dataset):
    """
    食品语料数据集。

    从 JSONL 文件加载文本，进行 tokenization。
    每条记录格式: {"text": "...", "source": "...", "category": "..."}
    """

    def __init__(
        self,
        texts: List[str],
        tokenizer: AutoTokenizer,
        max_length: int = DEFAULT_MAX_SEQ_LENGTH,
    ):
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.examples = []

        logger.info("正在 tokenize %d 条文本...", len(texts))
        for i, text in enumerate(texts):
            if not text.strip():
                continue

            # 对长文本进行分段处理
            # 使用滑动窗口确保不丢失上下文
            encoded = tokenizer(
                text,
                max_length=max_length,
                truncation=False,
                add_special_tokens=False,
            )
            input_ids = encoded["input_ids"]

            # 按 max_length - 2 分段 (留出 [CLS] 和 [SEP])
            stride = max_length - 2
            overlap = max_length // 4  # 25% 重叠

            if len(input_ids) <= stride:
                # 短文本直接处理
                self.examples.append(
                    tokenizer(
                        text,
                        max_length=max_length,
                        truncation=True,
                        padding="max_length",
                        return_special_tokens_mask=True,
                    )
                )
            else:
                # 长文本分段
                for start in range(0, len(input_ids), stride - overlap):
                    chunk_ids = input_ids[start : start + stride]
                    if len(chunk_ids) < 50:  # 过短片段丢弃
                        continue
                    chunk_text = tokenizer.decode(chunk_ids, skip_special_tokens=True)
                    self.examples.append(
                        tokenizer(
                            chunk_text,
                            max_length=max_length,
                            truncation=True,
                            padding="max_length",
                            return_special_tokens_mask=True,
                        )
                    )

            if (i + 1) % 1000 == 0:
                logger.info("已处理 %d / %d 条", i + 1, len(texts))

        logger.info("数据集构建完成: %d 个训练样本", len(self.examples))

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> Dict:
        item = self.examples[idx]
        return {
            "input_ids": torch.tensor(item["input_ids"], dtype=torch.long),
            "attention_mask": torch.tensor(item["attention_mask"], dtype=torch.long),
            # special_tokens_mask 用于 DataCollator 避免遮蔽特殊 token
            "special_tokens_mask": torch.tensor(
                item.get("special_tokens_mask", [0] * len(item["input_ids"])),
                dtype=torch.long,
            ),
        }


# ---------------------------------------------------------------------------
# 数据加载
# ---------------------------------------------------------------------------

def load_corpus(corpus_path: str) -> List[str]:
    """
    加载语料文本。
    支持单个 JSONL 文件或包含多个 JSONL 文件的目录。
    """
    path = Path(corpus_path)
    texts: List[str] = []

    jsonl_files: List[Path] = []
    if path.is_file():
        jsonl_files = [path]
    elif path.is_dir():
        jsonl_files = sorted(path.glob("*.jsonl"))
        if not jsonl_files:
            # 也支持 .txt 文件
            txt_files = sorted(path.glob("*.txt"))
            for tf in txt_files:
                with open(tf, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            texts.append(line)
            logger.info("从 %d 个 txt 文件加载了 %d 条文本", len(txt_files), len(texts))
            return texts
    else:
        logger.error("语料路径不存在: %s", path)
        sys.exit(1)

    for jsonl_file in jsonl_files:
        count = 0
        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    text = record.get("text", "")
                    if text and len(text) >= 20:  # 过滤过短文本
                        texts.append(text)
                        count += 1
                except json.JSONDecodeError:
                    continue
        logger.info("从 %s 加载了 %d 条文本", jsonl_file.name, count)

    logger.info("总计加载 %d 条语料文本", len(texts))
    return texts


def split_train_eval(
    texts: List[str],
    eval_ratio: float,
    seed: int,
) -> tuple:
    """
    划分训练集和验证集。
    """
    import random
    rng = random.Random(seed)
    indices = list(range(len(texts)))
    rng.shuffle(indices)

    eval_size = max(1, int(len(texts) * eval_ratio))
    eval_indices = set(indices[:eval_size])

    train_texts = [t for i, t in enumerate(texts) if i not in eval_indices]
    eval_texts = [t for i, t in enumerate(texts) if i in eval_indices]

    return train_texts, eval_texts


# ---------------------------------------------------------------------------
# 自定义回调: 记录训练指标
# ---------------------------------------------------------------------------

class LoggingCallback:
    """简单的日志回调"""

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs:
            step = state.global_step
            if "loss" in logs:
                logger.info(
                    "Step %d | loss=%.4f | lr=%.2e",
                    step, logs["loss"], logs.get("learning_rate", 0),
                )
            if "eval_loss" in logs:
                perplexity = torch.exp(torch.tensor(logs["eval_loss"])).item()
                logger.info(
                    "Step %d | eval_loss=%.4f | perplexity=%.2f",
                    step, logs["eval_loss"], perplexity,
                )


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="食品领域自适应 MLM 预训练 (基于 chinese-roberta-wwm-ext)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--corpus", type=str, required=True,
        help="语料路径 (JSONL 文件或包含 JSONL 的目录)",
    )
    parser.add_argument(
        "--output-dir", type=str, required=True,
        help="模型输出目录",
    )
    parser.add_argument(
        "--base-model", type=str, default=DEFAULT_BASE_MODEL,
        help=f"基座模型 (默认: {DEFAULT_BASE_MODEL})",
    )
    parser.add_argument(
        "--max-seq-length", type=int, default=DEFAULT_MAX_SEQ_LENGTH,
        help=f"最大序列长度 (默认: {DEFAULT_MAX_SEQ_LENGTH})",
    )
    parser.add_argument(
        "--mlm-probability", type=float, default=DEFAULT_MLM_PROBABILITY,
        help=f"MLM 遮蔽概率 (默认: {DEFAULT_MLM_PROBABILITY})",
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"训练 batch size (默认: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--gradient-accumulation", type=int, default=DEFAULT_GRADIENT_ACCUMULATION,
        help=f"梯度累积步数 (默认: {DEFAULT_GRADIENT_ACCUMULATION})",
    )
    parser.add_argument(
        "--lr", "--learning-rate", type=float, default=DEFAULT_LEARNING_RATE,
        dest="learning_rate",
        help=f"学习率 (默认: {DEFAULT_LEARNING_RATE})",
    )
    parser.add_argument(
        "--epochs", type=int, default=DEFAULT_EPOCHS,
        help=f"训练轮数 (默认: {DEFAULT_EPOCHS})",
    )
    parser.add_argument(
        "--warmup-ratio", type=float, default=DEFAULT_WARMUP_RATIO,
        help=f"Warmup 比例 (默认: {DEFAULT_WARMUP_RATIO})",
    )
    parser.add_argument(
        "--weight-decay", type=float, default=DEFAULT_WEIGHT_DECAY,
        help=f"权重衰减 (默认: {DEFAULT_WEIGHT_DECAY})",
    )
    parser.add_argument(
        "--fp16", action="store_true", default=True,
        help="启用 FP16 混合精度 (默认: 开启)",
    )
    parser.add_argument(
        "--no-fp16", action="store_true",
        help="禁用 FP16 混合精度",
    )
    parser.add_argument(
        "--eval-split", type=float, default=DEFAULT_EVAL_SPLIT,
        help=f"验证集比例 (默认: {DEFAULT_EVAL_SPLIT})",
    )
    parser.add_argument(
        "--save-steps", type=int, default=DEFAULT_SAVE_STEPS,
        help=f"检查点保存间隔 (默认: {DEFAULT_SAVE_STEPS})",
    )
    parser.add_argument(
        "--logging-steps", type=int, default=DEFAULT_LOGGING_STEPS,
        help=f"日志记录间隔 (默认: {DEFAULT_LOGGING_STEPS})",
    )
    parser.add_argument(
        "--seed", type=int, default=DEFAULT_SEED,
        help=f"随机种子 (默认: {DEFAULT_SEED})",
    )
    parser.add_argument(
        "--resume-from", type=str, default=None,
        help="从检查点恢复训练",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="启用详细日志",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    use_fp16 = args.fp16 and not args.no_fp16
    device = "cuda" if torch.cuda.is_available() else "cpu"

    set_seed(args.seed)

    logger.info("=" * 60)
    logger.info("食品领域 MLM 预训练")
    logger.info("基座模型: %s", args.base_model)
    logger.info("设备: %s", device)
    logger.info("FP16: %s", use_fp16)
    logger.info("序列长度: %d", args.max_seq_length)
    logger.info("MLM 概率: %.2f", args.mlm_probability)
    logger.info("Batch size: %d (有效 %d)",
                args.batch_size, args.batch_size * args.gradient_accumulation)
    logger.info("学习率: %e", args.learning_rate)
    logger.info("训练轮数: %d", args.epochs)
    logger.info("输出目录: %s", args.output_dir)
    logger.info("=" * 60)

    # 1. 加载 tokenizer 和模型
    logger.info("加载 tokenizer: %s", args.base_model)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model)

    logger.info("加载模型: %s", args.base_model)
    model = AutoModelForMaskedLM.from_pretrained(args.base_model)

    # 添加食品领域专业词汇到 tokenizer (可选)
    food_special_tokens = [
        "黄曲霉毒素", "沙门氏菌", "大肠杆菌", "山梨酸钾", "苯甲酸钠",
        "凯氏定氮法", "巴氏杀菌", "水分活度", "菌落总数", "真菌毒素",
        "HACCP", "GMP", "CCP", "SSOP", "CIP",
    ]
    num_added = tokenizer.add_tokens(food_special_tokens)
    if num_added > 0:
        model.resize_token_embeddings(len(tokenizer))
        logger.info("添加了 %d 个食品领域特殊 token", num_added)

    # 2. 加载语料
    logger.info("加载语料: %s", args.corpus)
    texts = load_corpus(args.corpus)

    if not texts:
        logger.error("语料为空，退出")
        sys.exit(1)

    # 3. 划分训练集和验证集
    train_texts, eval_texts = split_train_eval(texts, args.eval_split, args.seed)
    logger.info("训练集: %d 条, 验证集: %d 条", len(train_texts), len(eval_texts))

    # 4. 构建数据集
    train_dataset = FoodCorpusDataset(train_texts, tokenizer, args.max_seq_length)
    eval_dataset = FoodCorpusDataset(eval_texts, tokenizer, args.max_seq_length)

    logger.info("训练样本: %d, 验证样本: %d", len(train_dataset), len(eval_dataset))

    # 5. 数据整理器 (全词遮蔽)
    data_collator = DataCollatorForWholeWordMask(
        tokenizer=tokenizer,
        mlm=True,
        mlm_probability=args.mlm_probability,
    )

    # 6. 训练参数
    output_dir = Path(args.output_dir)
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        overwrite_output_dir=True,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size * 2,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        fp16=use_fp16 and device == "cuda",
        logging_dir=str(output_dir / "logs"),
        logging_steps=args.logging_steps,
        save_steps=args.save_steps,
        save_total_limit=3,
        evaluation_strategy="steps",
        eval_steps=args.save_steps,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        dataloader_num_workers=0 if sys.platform == "win32" else 4,
        seed=args.seed,
        report_to="none",  # 不上报到 wandb 等
    )

    # 7. 初始化 Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=data_collator,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
    )

    # 8. 开始训练
    logger.info("开始训练...")
    resume_checkpoint = args.resume_from
    train_result = trainer.train(resume_from_checkpoint=resume_checkpoint)

    # 9. 保存最终模型
    logger.info("保存最终模型到: %s", output_dir)
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    # 10. 保存训练指标
    metrics = train_result.metrics
    trainer.log_metrics("train", metrics)
    trainer.save_metrics("train", metrics)

    # 11. 评估
    logger.info("运行最终评估...")
    eval_metrics = trainer.evaluate()
    perplexity = torch.exp(torch.tensor(eval_metrics["eval_loss"])).item()
    eval_metrics["perplexity"] = perplexity

    trainer.log_metrics("eval", eval_metrics)
    trainer.save_metrics("eval", eval_metrics)

    logger.info("=" * 60)
    logger.info("训练完成!")
    logger.info("训练 loss: %.4f", metrics.get("train_loss", -1))
    logger.info("验证 loss: %.4f", eval_metrics.get("eval_loss", -1))
    logger.info("Perplexity: %.2f", perplexity)
    logger.info("模型保存于: %s", output_dir.resolve())
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
