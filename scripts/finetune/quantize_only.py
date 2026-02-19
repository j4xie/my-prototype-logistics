#!/usr/bin/env python3
"""Standalone ONNX INT8 quantization + validation script."""
import json
import time
import shutil
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models" / "chinese-roberta-wwm-ext-classifier" / "final"
ONNX_DIR = MODEL_DIR / "onnx"
onnx_path = ONNX_DIR / "model.onnx"
int8_path = ONNX_DIR / "model-int8.onnx"
MAX_LENGTH = 64

# Step 1: Quantize
print("Step 1: INT8 Quantization...")
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(str(onnx_path), str(int8_path), weight_type=QuantType.QUInt8)

fp32_size = onnx_path.stat().st_size / 1e6
int8_size = int8_path.stat().st_size / 1e6
print(f"  FP32: {fp32_size:.1f} MB")
print(f"  INT8: {int8_size:.1f} MB ({(1 - int8_size/fp32_size)*100:.0f}% reduction)")

# Step 2: Copy tokenizer + label mapping
print("\nStep 2: Copying tokenizer files...")
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
tokenizer.save_pretrained(str(ONNX_DIR))
label_map = MODEL_DIR / "label_mapping.json"
if label_map.exists():
    shutil.copy2(str(label_map), str(ONNX_DIR / "label_mapping.json"))
print("  Done")

# Step 3: Validate
print("\nStep 3: Validation...")
import onnxruntime as ort
session = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"])

with open(str(ONNX_DIR / "label_mapping.json"), "r") as f:
    mapping = json.load(f)
id_to_label = mapping.get("id_to_label", {str(v): k for k, v in mapping.get("label_to_id", {}).items()})

test_queries = [
    "过期未处理的质检报告",
    "处理不合格品",
    "质检报告查询",
    "执行处置方案",
    "查看今天的生产批次",
    "生产牛肉有什么要注意的吗",
    "猪肉冷库温度异常",
]

for text in test_queries:
    inputs = tokenizer(text, return_tensors="np", max_length=MAX_LENGTH, truncation=True, padding="max_length")
    ort_inputs = {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs["attention_mask"],
        "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])),
    }
    logits = session.run(None, ort_inputs)[0]
    top3_idx = np.argsort(logits[0])[::-1][:3]
    top1_label = id_to_label.get(str(top3_idx[0]), f"UNK_{top3_idx[0]}")
    top1_score = float(logits[0][top3_idx[0]])
    print(f'  "{text}" -> {top1_label} ({top1_score:.2f})')

# Latency benchmark
print("\nStep 4: Latency benchmark...")
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
print(f"  Mean: {np.mean(latencies):.1f}ms, P95: {np.percentile(latencies, 95):.1f}ms")

print("\nAll done!")
