#!/usr/bin/env python3
"""
Export fine-tuned PyTorch model to ONNX FP32, then quantize to INT8.

Usage:
    cd scripts/finetune && python export_and_quantize.py

Input:  models/chinese-roberta-wwm-ext-classifier/final/ (PyTorch model)
Output: models/chinese-roberta-wwm-ext-classifier/final/onnx/
        - model.onnx      (FP32)
        - model-int8.onnx  (INT8 QUInt8)
        - tokenizer files + label_mapping.json
"""

import json
import shutil
import time
from pathlib import Path

import numpy as np
import torch

# Monkey-patch for transformers 4.57+ / torch < 2.6 compatibility
import transformers.utils.import_utils as _tiu
_tiu.check_torch_load_is_safe = lambda: None
import transformers.modeling_utils as _tmu
_tmu.check_torch_load_is_safe = lambda: None

from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_DIR = Path(__file__).parent / "models" / "chinese-roberta-wwm-ext-classifier" / "final"
ONNX_DIR = MODEL_DIR / "onnx"
MAX_LENGTH = 80  # Must match finetune_full.py


def export_onnx():
    """Export PyTorch model to ONNX FP32."""
    print("=" * 60)
    print("Step 1: Export to ONNX FP32")
    print("=" * 60)

    ONNX_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = ONNX_DIR / "model.onnx"

    print(f"  Loading model from {MODEL_DIR}")
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.eval()

    # Dummy input
    dummy_text = "查看今天的生产批次"
    inputs = tokenizer(
        dummy_text, return_tensors="pt",
        max_length=MAX_LENGTH, truncation=True, padding="max_length"
    )

    print(f"  Exporting to {onnx_path}")
    torch.onnx.export(
        model,
        (inputs["input_ids"], inputs["attention_mask"], inputs.get("token_type_ids")),
        str(onnx_path),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch"},
            "attention_mask": {0: "batch"},
            "token_type_ids": {0: "batch"},
            "logits": {0: "batch"},
        },
        opset_version=14,
        do_constant_folding=True,
    )

    fp32_size = onnx_path.stat().st_size / 1e6
    print(f"  FP32 model: {fp32_size:.1f} MB")
    return onnx_path


def quantize_int8(onnx_path: Path):
    """Quantize ONNX FP32 to INT8."""
    print("\n" + "=" * 60)
    print("Step 2: INT8 Quantization")
    print("=" * 60)

    from onnxruntime.quantization import quantize_dynamic, QuantType

    int8_path = ONNX_DIR / "model-int8.onnx"
    print(f"  Quantizing to {int8_path}")
    quantize_dynamic(str(onnx_path), str(int8_path), weight_type=QuantType.QUInt8)

    fp32_size = onnx_path.stat().st_size / 1e6
    int8_size = int8_path.stat().st_size / 1e6
    print(f"  FP32: {fp32_size:.1f} MB")
    print(f"  INT8: {int8_size:.1f} MB ({(1 - int8_size / fp32_size) * 100:.0f}% reduction)")
    return int8_path


def copy_assets():
    """Copy tokenizer files and label_mapping.json to ONNX dir."""
    print("\n" + "=" * 60)
    print("Step 3: Copy tokenizer + label mapping")
    print("=" * 60)

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    tokenizer.save_pretrained(str(ONNX_DIR))

    label_map = MODEL_DIR / "label_mapping.json"
    if label_map.exists():
        shutil.copy2(str(label_map), str(ONNX_DIR / "label_mapping.json"))
    print("  Done")


def validate(int8_path: Path):
    """Run validation on INT8 model."""
    print("\n" + "=" * 60)
    print("Step 4: Validation")
    print("=" * 60)

    import onnxruntime as ort

    tokenizer = AutoTokenizer.from_pretrained(str(ONNX_DIR))
    session = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"])

    with open(str(ONNX_DIR / "label_mapping.json"), "r") as f:
        mapping = json.load(f)
    id_to_label = mapping.get("id_to_label", {str(v): k for k, v in mapping.get("label_to_id", {}).items()})

    test_queries = [
        # Regular business queries (regression)
        "查看今天的生产批次",
        "库存还有多少",
        "设备状态怎么样",
        "今天谁没来打卡",
        "质检合格率多少",
        "发货了没",
        "订单列表看一下",
        # New classes
        "你好",
        "666",
        "哈哈哈哈",
        "谢谢",
        "今天天气怎么样",
        "同上",
        "继续",
        "跟刚才一样",
        "详细的呢",
        # Edge cases (should NOT be OUT_OF_DOMAIN / CONTEXT_CONTINUE)
        "你好帮我查库存",
        "继续生产这批",
        # Pattern augmentation samples
        "难道库存没了？",
        "不能不查库存",
        "check一下inventory",
        "快过期了怎么办",
        "产量最高的产线",
    ]

    print(f"\n  {'Query':<30s} {'Predicted':<35s} {'Score':>8s}")
    print(f"  {'-'*30} {'-'*35} {'-'*8}")
    for text in test_queries:
        inputs = tokenizer(text, return_tensors="np", max_length=MAX_LENGTH, truncation=True, padding="max_length")
        ort_inputs = {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"],
            "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])),
        }
        logits = session.run(None, ort_inputs)[0]
        top1_idx = int(np.argmax(logits[0]))
        top1_label = id_to_label.get(str(top1_idx), f"UNK_{top1_idx}")
        top1_score = float(logits[0][top1_idx])
        print(f'  {text:<30s} {top1_label:<35s} {top1_score:>8.2f}')

    # Latency benchmark
    print(f"\n  Latency benchmark (100 iterations):")
    test_text = "查看今天的生产批次"
    inputs = tokenizer(test_text, return_tensors="np", max_length=MAX_LENGTH, truncation=True, padding="max_length")
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
    print(f"  Mean: {np.mean(latencies):.1f}ms, P50: {np.median(latencies):.1f}ms, P95: {np.percentile(latencies, 95):.1f}ms")


def main():
    onnx_path = export_onnx()
    int8_path = quantize_int8(onnx_path)
    copy_assets()
    validate(int8_path)
    print(f"\n{'='*60}")
    print(f"All done! Output: {ONNX_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
