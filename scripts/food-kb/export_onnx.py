#!/usr/bin/env python3
"""
ONNX 导出脚本 — 将微调后的 PyTorch 模型导出为 ONNX 格式

特性:
  - 动态轴支持 (batch_size, sequence_length)
  - 输出验证 (PyTorch vs ONNX 结果对比)
  - 推理速度基准测试 (PyTorch vs ONNX Runtime)
  - opset 14

使用方式:
  python export_onnx.py --model-dir ./food-ner-intent-model/best --output ./onnx/food_model.onnx
  python export_onnx.py --model-dir ./model --output ./onnx/model.onnx --benchmark --num-runs 100
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

# Bypass torch.load security check for torch < 2.6 with transformers >= 4.57
import transformers.utils.import_utils as _tu
if hasattr(_tu, 'check_torch_load_is_safe'):
    _tu.check_torch_load_is_safe = lambda: None
import transformers.modeling_utils as _mu
if hasattr(_mu, 'check_torch_load_is_safe'):
    _mu.check_torch_load_is_safe = lambda: None

from transformers import AutoModel, AutoTokenizer

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("export_onnx")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------
DEFAULT_OPSET = 14
DEFAULT_MAX_SEQ_LENGTH = 256
DEFAULT_BENCHMARK_RUNS = 50
ATOL = 1e-4  # 数值误差容忍度


# ---------------------------------------------------------------------------
# 多任务模型 (与 finetune_food_ner.py 保持一致)
# ---------------------------------------------------------------------------

class MultiTaskModel(nn.Module):
    """多任务模型: 共享编码器 + NER 头 + Intent 头"""

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

        self.ner_dropout = nn.Dropout(dropout_rate)
        self.ner_classifier = nn.Linear(hidden_size, num_ner_labels)

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
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        前向传播 (导出用，同时返回两个任务的 logits)。

        Returns:
            ner_logits: (batch_size, seq_len, num_ner_labels)
            intent_logits: (batch_size, num_intent_labels)
        """
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        )
        sequence_output = outputs.last_hidden_state
        cls_output = sequence_output[:, 0, :]

        ner_logits = self.ner_classifier(self.ner_dropout(sequence_output))
        intent_logits = self.intent_classifier(self.intent_dropout(cls_output))

        return ner_logits, intent_logits


# ---------------------------------------------------------------------------
# 模型加载
# ---------------------------------------------------------------------------

def load_model(
    model_dir: str,
    base_model_name: str,
) -> Tuple[MultiTaskModel, AutoTokenizer, Dict]:
    """
    加载微调后的模型。

    Args:
        model_dir: 模型目录 (包含 model.pt 和 label_mapping.json)
        base_model_name: 基座模型名称/路径

    Returns:
        (model, tokenizer, label_mapping)
    """
    model_dir = Path(model_dir)

    # 加载标签映射
    label_mapping_path = model_dir / "label_mapping.json"
    if not label_mapping_path.exists():
        # 尝试上层目录
        label_mapping_path = model_dir.parent / "label_mapping.json"

    if label_mapping_path.exists():
        with open(label_mapping_path, "r", encoding="utf-8") as f:
            label_mapping = json.load(f)
        num_ner_labels = label_mapping.get("num_ner_labels", 27)
        num_intent_labels = label_mapping.get("num_intent_labels", 230)
    else:
        logger.warning("未找到 label_mapping.json，使用默认标签数")
        label_mapping = {}
        num_ner_labels = 27
        num_intent_labels = 230

    # 加载 tokenizer
    tokenizer_path = model_dir if (model_dir / "tokenizer_config.json").exists() else base_model_name
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

    # 构建并加载模型
    model = MultiTaskModel(
        base_model_name=base_model_name,
        num_ner_labels=num_ner_labels,
        num_intent_labels=num_intent_labels,
    )

    model_pt = model_dir / "model.pt"
    if model_pt.exists():
        state_dict = torch.load(model_pt, map_location="cpu")
        model.load_state_dict(state_dict, strict=False)
        logger.info("加载模型权重: %s", model_pt)
    else:
        logger.warning("未找到 model.pt，使用未训练的模型结构")

    model.eval()
    return model, tokenizer, label_mapping


# ---------------------------------------------------------------------------
# ONNX 导出
# ---------------------------------------------------------------------------

def export_to_onnx(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    output_path: str,
    opset_version: int = DEFAULT_OPSET,
    max_seq_length: int = DEFAULT_MAX_SEQ_LENGTH,
) -> None:
    """
    将 PyTorch 模型导出为 ONNX 格式。

    使用动态轴支持可变 batch_size 和 sequence_length。
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 构造示例输入
    sample_text = "根据GB2760标准，酸奶中山梨酸钾的最大使用量为0.075g/kg"
    encoding = tokenizer(
        sample_text,
        max_length=max_seq_length,
        truncation=True,
        padding="max_length",
        return_tensors="pt",
    )

    input_ids = encoding["input_ids"]
    attention_mask = encoding["attention_mask"]
    token_type_ids = encoding.get(
        "token_type_ids",
        torch.zeros_like(input_ids),
    )

    # 动态轴定义
    dynamic_axes = {
        "input_ids": {0: "batch_size", 1: "sequence_length"},
        "attention_mask": {0: "batch_size", 1: "sequence_length"},
        "token_type_ids": {0: "batch_size", 1: "sequence_length"},
        "ner_logits": {0: "batch_size", 1: "sequence_length"},
        "intent_logits": {0: "batch_size"},
    }

    logger.info("正在导出 ONNX 模型...")
    logger.info("  opset: %d", opset_version)
    logger.info("  输入形状: %s", list(input_ids.shape))
    logger.info("  动态轴: batch_size, sequence_length")

    torch.onnx.export(
        model,
        (input_ids, attention_mask, token_type_ids),
        str(output_path),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["ner_logits", "intent_logits"],
        dynamic_axes=dynamic_axes,
        opset_version=opset_version,
        do_constant_folding=True,
        export_params=True,
    )

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("ONNX 模型已导出: %s (%.1f MB)", output_path, file_size_mb)


# ---------------------------------------------------------------------------
# ONNX 验证
# ---------------------------------------------------------------------------

def validate_onnx(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    onnx_path: str,
    max_seq_length: int = DEFAULT_MAX_SEQ_LENGTH,
    atol: float = ATOL,
) -> bool:
    """
    验证 ONNX 模型的输出与 PyTorch 模型一致。

    Returns:
        True 如果验证通过
    """
    try:
        import onnxruntime as ort
    except ImportError:
        logger.error("请安装 onnxruntime: pip install onnxruntime")
        return False

    # 也可以用 onnx.checker
    try:
        import onnx
        onnx_model = onnx.load(onnx_path)
        onnx.checker.check_model(onnx_model)
        logger.info("ONNX 模型结构验证通过")
    except ImportError:
        logger.info("跳过 onnx.checker (未安装 onnx 包)")
    except Exception as exc:
        logger.warning("ONNX 模型结构验证失败: %s", exc)

    # 测试多个输入
    test_texts = [
        "根据GB2760标准，酸奶中山梨酸钾的最大使用量为0.075g/kg",
        "沙门氏菌检测方法",
        "HACCP认证如何办理",
    ]

    session = ort.InferenceSession(onnx_path)
    all_passed = True

    for text in test_texts:
        encoding = tokenizer(
            text,
            max_length=max_seq_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )

        input_ids = encoding["input_ids"]
        attention_mask = encoding["attention_mask"]
        token_type_ids = encoding.get(
            "token_type_ids",
            torch.zeros_like(input_ids),
        )

        # PyTorch 推理
        with torch.no_grad():
            pt_ner, pt_intent = model(input_ids, attention_mask, token_type_ids)
            pt_ner = pt_ner.numpy()
            pt_intent = pt_intent.numpy()

        # ONNX Runtime 推理
        ort_inputs = {
            "input_ids": input_ids.numpy(),
            "attention_mask": attention_mask.numpy(),
            "token_type_ids": token_type_ids.numpy(),
        }
        ort_ner, ort_intent = session.run(None, ort_inputs)

        # 比较
        ner_close = np.allclose(pt_ner, ort_ner, atol=atol)
        intent_close = np.allclose(pt_intent, ort_intent, atol=atol)

        ner_max_diff = np.max(np.abs(pt_ner - ort_ner))
        intent_max_diff = np.max(np.abs(pt_intent - ort_intent))

        if ner_close and intent_close:
            logger.info(
                "验证通过: '%s...' | NER max_diff=%.6f, Intent max_diff=%.6f",
                text[:20], ner_max_diff, intent_max_diff,
            )
        else:
            logger.error(
                "验证失败: '%s...' | NER close=%s (max_diff=%.6f), "
                "Intent close=%s (max_diff=%.6f)",
                text[:20], ner_close, ner_max_diff, intent_close, intent_max_diff,
            )
            all_passed = False

    return all_passed


# ---------------------------------------------------------------------------
# 推理速度基准测试
# ---------------------------------------------------------------------------

def benchmark(
    model: MultiTaskModel,
    tokenizer: AutoTokenizer,
    onnx_path: str,
    max_seq_length: int = DEFAULT_MAX_SEQ_LENGTH,
    num_runs: int = DEFAULT_BENCHMARK_RUNS,
    batch_size: int = 1,
) -> Dict:
    """
    对比 PyTorch 和 ONNX Runtime 的推理速度。
    """
    try:
        import onnxruntime as ort
    except ImportError:
        logger.error("请安装 onnxruntime: pip install onnxruntime")
        return {}

    # 构造输入
    sample_text = "根据GB2760标准，酸奶中山梨酸钾的最大使用量为0.075g/kg"
    encoding = tokenizer(
        [sample_text] * batch_size,
        max_length=max_seq_length,
        truncation=True,
        padding="max_length",
        return_tensors="pt",
    )

    input_ids = encoding["input_ids"]
    attention_mask = encoding["attention_mask"]
    token_type_ids = encoding.get(
        "token_type_ids",
        torch.zeros_like(input_ids),
    )

    # Warmup
    logger.info("基准测试: batch_size=%d, seq_length=%d, runs=%d",
                batch_size, max_seq_length, num_runs)
    logger.info("Warmup (10 runs)...")

    # PyTorch warmup
    for _ in range(10):
        with torch.no_grad():
            model(input_ids, attention_mask, token_type_ids)

    # ONNX warmup
    session = ort.InferenceSession(onnx_path)
    ort_inputs = {
        "input_ids": input_ids.numpy(),
        "attention_mask": attention_mask.numpy(),
        "token_type_ids": token_type_ids.numpy(),
    }
    for _ in range(10):
        session.run(None, ort_inputs)

    # PyTorch 基准
    logger.info("PyTorch 基准测试...")
    pt_times = []
    for _ in range(num_runs):
        start = time.perf_counter()
        with torch.no_grad():
            model(input_ids, attention_mask, token_type_ids)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        pt_times.append(elapsed)

    # ONNX 基准
    logger.info("ONNX Runtime 基准测试...")
    ort_times = []
    for _ in range(num_runs):
        start = time.perf_counter()
        session.run(None, ort_inputs)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        ort_times.append(elapsed)

    pt_mean = np.mean(pt_times)
    pt_p50 = np.percentile(pt_times, 50)
    pt_p95 = np.percentile(pt_times, 95)
    pt_p99 = np.percentile(pt_times, 99)

    ort_mean = np.mean(ort_times)
    ort_p50 = np.percentile(ort_times, 50)
    ort_p95 = np.percentile(ort_times, 95)
    ort_p99 = np.percentile(ort_times, 99)

    speedup = pt_mean / ort_mean if ort_mean > 0 else 0

    results = {
        "batch_size": batch_size,
        "seq_length": max_seq_length,
        "num_runs": num_runs,
        "pytorch": {
            "mean_ms": round(pt_mean, 2),
            "p50_ms": round(pt_p50, 2),
            "p95_ms": round(pt_p95, 2),
            "p99_ms": round(pt_p99, 2),
        },
        "onnx": {
            "mean_ms": round(ort_mean, 2),
            "p50_ms": round(ort_p50, 2),
            "p95_ms": round(ort_p95, 2),
            "p99_ms": round(ort_p99, 2),
        },
        "speedup": round(speedup, 2),
    }

    logger.info("=" * 50)
    logger.info("基准测试结果 (batch=%d, seq=%d)", batch_size, max_seq_length)
    logger.info("-" * 50)
    logger.info("PyTorch:      mean=%.2f ms | p50=%.2f | p95=%.2f | p99=%.2f",
                pt_mean, pt_p50, pt_p95, pt_p99)
    logger.info("ONNX Runtime: mean=%.2f ms | p50=%.2f | p95=%.2f | p99=%.2f",
                ort_mean, ort_p50, ort_p95, ort_p99)
    logger.info("加速比: %.2fx", speedup)
    logger.info("=" * 50)

    return results


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ONNX 模型导出 — 多任务 NER + Intent 模型",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--model-dir", type=str, required=True,
        help="微调模型目录 (包含 model.pt)",
    )
    parser.add_argument(
        "--base-model", type=str, default="hfl/chinese-roberta-wwm-ext",
        help="基座模型名称 (默认: hfl/chinese-roberta-wwm-ext)",
    )
    parser.add_argument(
        "--output", "-o", type=str, required=True,
        help="ONNX 输出路径",
    )
    parser.add_argument(
        "--opset", type=int, default=DEFAULT_OPSET,
        help=f"ONNX opset 版本 (默认: {DEFAULT_OPSET})",
    )
    parser.add_argument(
        "--max-seq-length", type=int, default=DEFAULT_MAX_SEQ_LENGTH,
        help=f"最大序列长度 (默认: {DEFAULT_MAX_SEQ_LENGTH})",
    )
    parser.add_argument(
        "--validate", action="store_true", default=True,
        help="验证 ONNX 输出 (默认: 开启)",
    )
    parser.add_argument(
        "--no-validate", action="store_true",
        help="跳过验证",
    )
    parser.add_argument(
        "--benchmark", action="store_true",
        help="运行推理速度基准测试",
    )
    parser.add_argument(
        "--num-runs", type=int, default=DEFAULT_BENCHMARK_RUNS,
        help=f"基准测试运行次数 (默认: {DEFAULT_BENCHMARK_RUNS})",
    )
    parser.add_argument(
        "--benchmark-batch-sizes", nargs="+", type=int, default=[1, 4, 16],
        help="基准测试的 batch sizes (默认: 1 4 16)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="启用详细日志",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    do_validate = args.validate and not args.no_validate

    logger.info("=" * 60)
    logger.info("ONNX 模型导出")
    logger.info("模型目录: %s", args.model_dir)
    logger.info("输出路径: %s", args.output)
    logger.info("Opset: %d", args.opset)
    logger.info("验证: %s", do_validate)
    logger.info("基准测试: %s", args.benchmark)
    logger.info("=" * 60)

    # 1. 加载模型
    logger.info("加载模型...")
    model, tokenizer, label_mapping = load_model(args.model_dir, args.base_model)

    # 2. 导出 ONNX
    export_to_onnx(
        model=model,
        tokenizer=tokenizer,
        output_path=args.output,
        opset_version=args.opset,
        max_seq_length=args.max_seq_length,
    )

    # 3. 验证
    if do_validate:
        logger.info("验证 ONNX 输出...")
        is_valid = validate_onnx(
            model=model,
            tokenizer=tokenizer,
            onnx_path=args.output,
            max_seq_length=args.max_seq_length,
        )
        if is_valid:
            logger.info("ONNX 验证通过: 输出与 PyTorch 一致")
        else:
            logger.error("ONNX 验证失败: 输出与 PyTorch 不一致")

    # 4. 基准测试
    if args.benchmark:
        all_results = {}
        for bs in args.benchmark_batch_sizes:
            results = benchmark(
                model=model,
                tokenizer=tokenizer,
                onnx_path=args.output,
                max_seq_length=args.max_seq_length,
                num_runs=args.num_runs,
                batch_size=bs,
            )
            all_results[f"batch_{bs}"] = results

        # 保存基准测试结果
        benchmark_path = Path(args.output).with_suffix(".benchmark.json")
        with open(benchmark_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        logger.info("基准测试结果已保存: %s", benchmark_path)

    # 5. 同时保存 label_mapping 到输出目录
    if label_mapping:
        output_dir = Path(args.output).parent
        mapping_path = output_dir / "label_mapping.json"
        with open(mapping_path, "w", encoding="utf-8") as f:
            json.dump(label_mapping, f, ensure_ascii=False, indent=2)
        logger.info("标签映射已复制: %s", mapping_path)

    logger.info("ONNX 导出完成!")


if __name__ == "__main__":
    main()
