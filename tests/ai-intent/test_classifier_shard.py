#!/usr/bin/env python3
"""
分类器分片测试脚本

支持分片测试，可以并行运行多个实例
"""
import json
import time
import requests
from pathlib import Path
from datetime import datetime
import argparse

# 配置
CLASSIFIER_URL = "http://localhost:8083/api/classifier/classify"
VAL_DATA_PATH = Path(__file__).parent.parent.parent / "scripts/finetune/merged_classification_val.json"
LABELS_PATH = Path(__file__).parent.parent.parent / "scripts/finetune/merged_labels.json"

def classify_text(text: str) -> dict:
    """调用分类器 API"""
    try:
        response = requests.post(
            CLASSIFIER_URL,
            json={'text': text, 'top_k': 5, 'threshold': 0.0},
            timeout=10
        )
        return response.json()
    except Exception as e:
        return {'success': False, 'error': str(e)}

def run_shard_test(shard_id: int, total_shards: int):
    """运行分片测试"""
    print(f"[Shard {shard_id}/{total_shards}] 开始测试...")

    # 加载数据
    with open(VAL_DATA_PATH, 'r', encoding='utf-8') as f:
        val_data = json.load(f)

    # 计算分片
    total = len(val_data)
    shard_size = total // total_shards
    start_idx = shard_id * shard_size
    end_idx = start_idx + shard_size if shard_id < total_shards - 1 else total
    shard_data = val_data[start_idx:end_idx]

    print(f"[Shard {shard_id}] 样本范围: {start_idx}-{end_idx}, 共 {len(shard_data)} 条")

    # 统计
    correct = 0
    top3_correct = 0
    top5_correct = 0
    tested = 0
    errors = []
    confidence_sum = 0

    start_time = time.time()

    for i, item in enumerate(shard_data):
        text = item['text']
        true_label = item['label']

        result = classify_text(text)

        if not result.get('success'):
            errors.append({'text': text, 'true_label': true_label, 'error': result.get('error')})
            continue

        tested += 1
        pred_label = result.get('top_intent')
        confidence = result.get('top_confidence', 0)
        predictions = result.get('predictions', [])

        confidence_sum += confidence

        if pred_label == true_label:
            correct += 1

        top3_intents = [p['intent'] for p in predictions[:3]]
        if true_label in top3_intents:
            top3_correct += 1

        top5_intents = [p['intent'] for p in predictions[:5]]
        if true_label in top5_intents:
            top5_correct += 1

        if (i + 1) % 50 == 0:
            acc = correct / tested * 100 if tested > 0 else 0
            print(f"[Shard {shard_id}] 进度: {i+1}/{len(shard_data)} - 准确率: {acc:.2f}%")

    elapsed = time.time() - start_time

    # 结果
    result = {
        'shard_id': shard_id,
        'total_shards': total_shards,
        'start_idx': start_idx,
        'end_idx': end_idx,
        'total_samples': len(shard_data),
        'tested_samples': tested,
        'errors': len(errors),
        'correct': correct,
        'top3_correct': top3_correct,
        'top5_correct': top5_correct,
        'accuracy_top1': correct / tested * 100 if tested > 0 else 0,
        'accuracy_top3': top3_correct / tested * 100 if tested > 0 else 0,
        'accuracy_top5': top5_correct / tested * 100 if tested > 0 else 0,
        'avg_confidence': confidence_sum / tested if tested > 0 else 0,
        'elapsed_seconds': elapsed,
        'timestamp': datetime.now().isoformat()
    }

    print(f"\n[Shard {shard_id}] 完成!")
    print(f"  Top-1: {result['accuracy_top1']:.2f}%")
    print(f"  Top-3: {result['accuracy_top3']:.2f}%")
    print(f"  Top-5: {result['accuracy_top5']:.2f}%")
    print(f"  耗时: {elapsed:.1f}秒")

    # 保存结果
    report_path = Path(__file__).parent / 'reports' / f'shard_{shard_id}_of_{total_shards}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--shard', type=int, required=True, help='分片ID (0-based)')
    parser.add_argument('--total', type=int, required=True, help='总分片数')
    args = parser.parse_args()

    run_shard_test(args.shard, args.total)
