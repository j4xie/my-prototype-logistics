#!/usr/bin/env python3
"""
Smart Weight Transfer: 从旧模型 (179 labels) 迁移 classifier head 权重到新模型 (222 labels)

问题: incremental_finetune.py 使用 ignore_mismatched_sizes=True 导致整个 classifier head 被随机重初始化。
解决: 用旧模型的 classifier.weight/bias 中对应 label 的行覆盖新模型的随机权重。

用法:
  python smart_weight_transfer.py \
    --old-model /path/to/final \
    --new-model /path/to/incremental/final \
    --output /path/to/incremental/final_transferred
"""

import argparse
import json
import logging
import shutil
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def load_label_mapping(model_dir: Path) -> dict:
    """加载 label_mapping.json"""
    mapping_path = model_dir / "label_mapping.json"
    if mapping_path.exists():
        with open(mapping_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("label_to_id", data)

    # Fallback: 从 config.json 获取
    config_path = model_dir / "config.json"
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
        return config.get("label2id", {})


def transfer_weights(old_model_path: str, new_model_path: str, output_path: str):
    """
    智能权重迁移:
    1. 加载旧模型 (179 labels) 和新模型 (222 labels)
    2. 对于两个模型共有的 label，将旧模型的 classifier weight/bias 复制到新模型
    3. 新增的 label 保持新模型训练后的权重 (已经过 2 epoch 训练)
    """
    old_dir = Path(old_model_path)
    new_dir = Path(new_model_path)
    out_dir = Path(output_path)

    # 加载 label mappings
    old_label2id = load_label_mapping(old_dir)
    new_label2id = load_label_mapping(new_dir)

    logger.info(f"旧模型 labels: {len(old_label2id)}")
    logger.info(f"新模型 labels: {len(new_label2id)}")

    # 找重叠 labels
    old_labels = set(old_label2id.keys())
    new_labels = set(new_label2id.keys())
    overlap = old_labels & new_labels
    only_old = old_labels - new_labels
    only_new = new_labels - old_labels

    logger.info(f"重叠 labels: {len(overlap)}")
    logger.info(f"仅旧模型有: {len(only_old)} — {sorted(only_old)[:10]}...")
    logger.info(f"仅新模型有: {len(only_new)} — {sorted(only_new)[:10]}...")

    # 加载模型
    logger.info(f"加载旧模型: {old_model_path}")
    old_model = AutoModelForSequenceClassification.from_pretrained(
        str(old_dir), num_labels=len(old_label2id)
    )

    logger.info(f"加载新模型: {new_model_path}")
    new_model = AutoModelForSequenceClassification.from_pretrained(
        str(new_dir), num_labels=len(new_label2id)
    )

    # 迁移 classifier head 权重
    old_weight = old_model.classifier.weight.data  # [179, 768]
    old_bias = old_model.classifier.bias.data      # [179]
    new_weight = new_model.classifier.weight.data  # [222, 768]
    new_bias = new_model.classifier.bias.data      # [222]

    transferred = 0
    for label in overlap:
        old_idx = old_label2id[label]
        new_idx = new_label2id[label]
        new_weight[new_idx] = old_weight[old_idx]
        new_bias[new_idx] = old_bias[old_idx]
        transferred += 1

    new_model.classifier.weight.data = new_weight
    new_model.classifier.bias.data = new_bias

    logger.info(f"迁移了 {transferred}/{len(overlap)} 个 label 的 classifier 权重")

    # 保存
    out_dir.mkdir(parents=True, exist_ok=True)
    new_model.save_pretrained(str(out_dir))

    # 复制 tokenizer 和 label_mapping
    tokenizer = AutoTokenizer.from_pretrained(str(new_dir))
    tokenizer.save_pretrained(str(out_dir))

    # 复制 label_mapping.json
    new_mapping_path = new_dir / "label_mapping.json"
    if new_mapping_path.exists():
        shutil.copy2(new_mapping_path, out_dir / "label_mapping.json")

    logger.info(f"模型已保存到: {output_path}")

    # 验证
    logger.info("验证迁移后模型...")
    verify_model = AutoModelForSequenceClassification.from_pretrained(str(out_dir))
    assert verify_model.classifier.weight.shape[0] == len(new_label2id), \
        f"Label 数量不匹配: {verify_model.classifier.weight.shape[0]} vs {len(new_label2id)}"

    # 抽样检查权重一致性
    sample_label = list(overlap)[0]
    old_idx = old_label2id[sample_label]
    new_idx = new_label2id[sample_label]
    assert torch.allclose(
        verify_model.classifier.weight.data[new_idx],
        old_weight[old_idx]
    ), f"权重迁移验证失败: {sample_label}"

    logger.info(f"验证通过 ✓")

    return {
        "old_labels": len(old_label2id),
        "new_labels": len(new_label2id),
        "transferred": transferred,
        "only_new": len(only_new),
        "only_old": len(only_old),
    }


def main():
    parser = argparse.ArgumentParser(description="Smart weight transfer between classifier models")
    parser.add_argument("--old-model", required=True, help="旧模型路径 (179 labels)")
    parser.add_argument("--new-model", required=True, help="新模型路径 (222 labels, 增量训练后)")
    parser.add_argument("--output", required=True, help="输出路径")
    args = parser.parse_args()

    result = transfer_weights(args.old_model, args.new_model, args.output)

    print("\n" + "=" * 50)
    print("权重迁移完成")
    print("=" * 50)
    print(f"旧模型 labels: {result['old_labels']}")
    print(f"新模型 labels: {result['new_labels']}")
    print(f"迁移权重: {result['transferred']}")
    print(f"新增 labels (保持训练后权重): {result['only_new']}")
    print(f"移除 labels: {result['only_old']}")
    print("=" * 50)


if __name__ == "__main__":
    main()
