#!/usr/bin/env python3
"""Validate ONNX INT8 model on server. Upload and run via SSH."""
import json
import time
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

MODEL_DIR = "/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final/onnx"

# Load
print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

print("Loading label mapping...")
with open(f"{MODEL_DIR}/label_mapping.json", "r", encoding="utf-8") as f:
    lm = json.load(f)
id_to_label = {int(v): k for k, v in lm["label_to_id"].items()}
print(f"  Classes: {lm['num_labels']}")

# Load INT8 model
int8_path = f"{MODEL_DIR}/model-int8.onnx"
print(f"Loading INT8 model from {int8_path}...")
sess = ort.InferenceSession(int8_path, providers=["CPUExecutionProvider"])
print("  Model loaded OK")

# Test cases
tests = [
    ("查看本月生产报表", "REPORT_QUERY"),
    ("帮我查一下牛肉的保质期标准", "FOOD_KNOWLEDGE_QUERY"),
    ("添加一个新员工", "HR_ADD_EMPLOYEE"),
    ("今天天气怎么样", "GENERAL_QUESTION"),
    ("查看设备报警列表", "EQUIPMENT_ALERT_LIST"),
    ("库存不足的物料有哪些", "MATERIAL_LOW_STOCK"),
    ("HACCP体系怎么建立", "FOOD_KNOWLEDGE_QUERY"),
    ("帮我看看销售订单", "ORDER_LIST"),
    ("修改客户联系方式", "CRM_UPDATE_CUSTOMER"),
    ("食品添加剂的使用范围在哪个标准里查", "FOOD_KNOWLEDGE_QUERY"),
]

print(f"\nRunning {len(tests)} test cases...")
correct = 0
for text, expected in tests:
    enc = tokenizer(text, truncation=True, padding="max_length", max_length=64, return_tensors="np")
    inputs = {
        "input_ids": enc["input_ids"].astype(np.int64),
        "attention_mask": enc["attention_mask"].astype(np.int64),
        "token_type_ids": enc["token_type_ids"].astype(np.int64),
    }
    logits = sess.run(None, inputs)[0]
    pred_id = int(np.argmax(logits, axis=-1)[0])
    pred_label = id_to_label.get(pred_id, f"UNKNOWN_{pred_id}")
    conf = float(np.exp(logits[0][pred_id]) / np.exp(logits[0]).sum())
    ok = "PASS" if pred_label == expected else "FAIL"
    if pred_label == expected:
        correct += 1
    print(f"  [{ok}] '{text}' -> {pred_label} (conf={conf:.3f}, expected={expected})")

print(f"\nAccuracy: {correct}/{len(tests)} ({100*correct/len(tests):.0f}%)")

# Latency benchmark
print("\nLatency benchmark (100 iterations)...")
enc = tokenizer("查看本月生产报表", truncation=True, padding="max_length", max_length=64, return_tensors="np")
inputs = {
    "input_ids": enc["input_ids"].astype(np.int64),
    "attention_mask": enc["attention_mask"].astype(np.int64),
    "token_type_ids": enc["token_type_ids"].astype(np.int64),
}
# Warmup
for _ in range(10):
    sess.run(None, inputs)
# Benchmark
times = []
for _ in range(100):
    t0 = time.perf_counter()
    sess.run(None, inputs)
    times.append((time.perf_counter() - t0) * 1000)

avg = np.mean(times)
p50 = np.percentile(times, 50)
p95 = np.percentile(times, 95)
print(f"  Avg: {avg:.1f}ms, P50: {p50:.1f}ms, P95: {p95:.1f}ms")
print("\nDone!")
