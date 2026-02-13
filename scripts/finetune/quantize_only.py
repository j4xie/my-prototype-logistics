#!/usr/bin/env python3
"""Standalone INT8 quantization + validation (no torch/transformers imports during quantize)."""
import json, time, sys
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).parent
ONNX_DIR = BASE_DIR / 'models' / 'merged-classifier' / 'onnx'
onnx_path = ONNX_DIR / 'model.onnx'
int8_path = ONNX_DIR / 'model-int8.onnx'

# Step 1: Quantize (pure onnxruntime, no torch)
print('=== Step 1: INT8 Quantization ===')
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(str(onnx_path), str(int8_path), weight_type=QuantType.QInt8)

fp32_size = onnx_path.stat().st_size / 1e6
int8_size = int8_path.stat().st_size / 1e6
print(f'FP32: {fp32_size:.1f} MB')
print(f'INT8: {int8_size:.1f} MB')
print(f'Reduction: {(1-int8_size/fp32_size)*100:.0f}%')

# Step 2: Validate with ONNX Runtime
print('\n=== Step 2: Validation ===')
import onnxruntime as ort
from tokenizers import Tokenizer

# Load label mapping
with open(BASE_DIR / 'data' / 'merged_label_mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)
label_to_id = mapping['label_to_id']

# Load validation data
all_data = []
with open(BASE_DIR / 'data' / 'merged_training_data.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        all_data.append(json.loads(line.strip()))

# Same split as training
from sklearn.model_selection import train_test_split
texts = [d['text'] for d in all_data]
labels = [label_to_id[d['label']] for d in all_data]
_, val_texts, _, val_labels = train_test_split(texts, labels, test_size=0.1, random_state=42, stratify=labels)

# Load tokenizer (use HuggingFace tokenizers directly, not transformers)
tokenizer = Tokenizer.from_file(str(ONNX_DIR / 'tokenizer.json'))
tokenizer.enable_padding(pad_id=0, pad_token='[PAD]', length=64)
tokenizer.enable_truncation(max_length=64)

# Load ONNX sessions
session_int8 = ort.InferenceSession(str(int8_path), providers=['CPUExecutionProvider'])
session_fp32 = ort.InferenceSession(str(onnx_path), providers=['CPUExecutionProvider'])

def encode_text(text):
    enc = tokenizer.encode(text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)
    type_ids = np.array([enc.type_ids], dtype=np.int64)
    return {'input_ids': ids, 'attention_mask': mask, 'token_type_ids': type_ids}

# Validate INT8
preds_int8, preds_fp32 = [], []
for text, label in zip(val_texts, val_labels):
    ort_inputs = encode_text(text)
    logits = session_int8.run(None, ort_inputs)[0]
    preds_int8.append(np.argmax(logits, axis=-1)[0])
    logits_fp32 = session_fp32.run(None, ort_inputs)[0]
    preds_fp32.append(np.argmax(logits_fp32, axis=-1)[0])

from sklearn.metrics import f1_score, accuracy_score

int8_acc = accuracy_score(val_labels, preds_int8)
int8_f1 = f1_score(val_labels, preds_int8, average='weighted', zero_division=0)
fp32_acc = accuracy_score(val_labels, preds_fp32)
fp32_f1 = f1_score(val_labels, preds_fp32, average='weighted', zero_division=0)

# Check prediction agreement
agreement = sum(a == b for a, b in zip(preds_int8, preds_fp32)) / len(preds_int8)

print(f'FP32 ONNX Accuracy: {fp32_acc:.4f}')
print(f'FP32 ONNX F1:       {fp32_f1:.4f}')
print(f'INT8 ONNX Accuracy: {int8_acc:.4f}')
print(f'INT8 ONNX F1:       {int8_f1:.4f}')
print(f'FP32 vs INT8 agree: {agreement:.2%}')
print(f'F1 degradation:     {int8_f1 - fp32_f1:+.4f}')

# Step 3: Latency benchmark
print('\n=== Step 3: Latency Benchmark (CPU) ===')
test_inputs = encode_text('查看今天的生产批次')

# Warmup
for _ in range(20):
    session_int8.run(None, test_inputs)
    session_fp32.run(None, test_inputs)

for name, sess in [('INT8', session_int8), ('FP32', session_fp32)]:
    latencies = []
    for _ in range(200):
        t0 = time.perf_counter()
        sess.run(None, test_inputs)
        latencies.append((time.perf_counter() - t0) * 1000)
    print(f'{name}: mean={np.mean(latencies):.1f}ms, P95={np.percentile(latencies, 95):.1f}ms')

speedup = np.mean([time.perf_counter() for _ in range(1)])  # dummy
# Recompute properly
lats_int8, lats_fp32 = [], []
for _ in range(200):
    t0 = time.perf_counter()
    session_int8.run(None, test_inputs)
    lats_int8.append(time.perf_counter() - t0)
    t0 = time.perf_counter()
    session_fp32.run(None, test_inputs)
    lats_fp32.append(time.perf_counter() - t0)

print(f'\nSpeedup: {np.mean(lats_fp32)/np.mean(lats_int8):.2f}x')

print('\n=== FINAL SUMMARY ===')
print(f'Model size:    FP32={fp32_size:.0f}MB -> INT8={int8_size:.0f}MB ({(1-int8_size/fp32_size)*100:.0f}% reduction)')
print(f'F1 accuracy:   FP32={fp32_f1:.4f}, INT8={int8_f1:.4f} (delta={int8_f1-fp32_f1:+.4f})')
print(f'Pred agreement: {agreement:.2%}')
print(f'Files saved:')
print(f'  {int8_path}')
