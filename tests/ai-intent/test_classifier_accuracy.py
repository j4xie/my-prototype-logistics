#!/usr/bin/env python3
"""
分类器准确率测试脚本

测试 Python 分类器服务的准确率
使用验证集数据进行测试
"""
import json
import time
import requests
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# 配置
CLASSIFIER_URL = "http://localhost:8083/api/classifier/classify"
VAL_DATA_PATH = Path(__file__).parent.parent.parent / "scripts/finetune/merged_classification_val.json"
LABELS_PATH = Path(__file__).parent.parent.parent / "scripts/finetune/merged_labels.json"

def load_test_data():
    """加载验证数据"""
    with open(VAL_DATA_PATH, 'r', encoding='utf-8') as f:
        val_data = json.load(f)

    with open(LABELS_PATH, 'r', encoding='utf-8') as f:
        labels_info = json.load(f)

    id_to_label = {v: k for k, v in labels_info['label_to_id'].items()}

    return val_data, id_to_label

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

def run_accuracy_test(sample_size: int = None):
    """运行准确率测试"""
    print("=" * 60)
    print("分类器准确率测试")
    print("=" * 60)

    # 加载数据
    print("\n加载测试数据...")
    val_data, id_to_label = load_test_data()

    if sample_size:
        import random
        random.seed(42)
        val_data = random.sample(val_data, min(sample_size, len(val_data)))

    total = len(val_data)
    print(f"测试样本数: {total}")

    # 统计
    correct = 0
    top3_correct = 0
    top5_correct = 0
    errors = []
    label_stats = defaultdict(lambda: {'total': 0, 'correct': 0})
    confidence_sum = 0

    # 测试
    print("\n开始测试...")
    start_time = time.time()

    for i, item in enumerate(val_data):
        text = item['text']
        true_label = item['label']

        result = classify_text(text)

        if not result.get('success'):
            errors.append({
                'text': text,
                'true_label': true_label,
                'error': result.get('error', 'Unknown error')
            })
            continue

        pred_label = result.get('top_intent')
        confidence = result.get('top_confidence', 0)
        predictions = result.get('predictions', [])

        # 统计
        label_stats[true_label]['total'] += 1
        confidence_sum += confidence

        # Top-1 准确率
        if pred_label == true_label:
            correct += 1
            label_stats[true_label]['correct'] += 1

        # Top-3 准确率
        top3_intents = [p['intent'] for p in predictions[:3]]
        if true_label in top3_intents:
            top3_correct += 1

        # Top-5 准确率
        top5_intents = [p['intent'] for p in predictions[:5]]
        if true_label in top5_intents:
            top5_correct += 1

        # 进度显示
        if (i + 1) % 100 == 0 or i == total - 1:
            elapsed = time.time() - start_time
            speed = (i + 1) / elapsed
            print(f"  进度: {i+1}/{total} ({(i+1)/total*100:.1f}%) - 当前准确率: {correct/(i+1)*100:.2f}% - 速度: {speed:.1f} 条/秒")

    # 计算结果
    elapsed = time.time() - start_time
    tested = total - len(errors)

    accuracy = correct / tested * 100 if tested > 0 else 0
    top3_acc = top3_correct / tested * 100 if tested > 0 else 0
    top5_acc = top5_correct / tested * 100 if tested > 0 else 0
    avg_confidence = confidence_sum / tested if tested > 0 else 0

    # 输出结果
    print("\n" + "=" * 60)
    print("测试结果")
    print("=" * 60)
    print(f"\n总样本数: {total}")
    print(f"成功测试: {tested}")
    print(f"错误数量: {len(errors)}")
    print(f"测试耗时: {elapsed:.2f} 秒")
    print(f"平均速度: {tested/elapsed:.1f} 条/秒")

    print(f"\n--- 准确率 ---")
    print(f"Top-1 准确率: {accuracy:.2f}%")
    print(f"Top-3 准确率: {top3_acc:.2f}%")
    print(f"Top-5 准确率: {top5_acc:.2f}%")
    print(f"平均置信度: {avg_confidence:.4f}")

    # 按标签统计
    print(f"\n--- 按标签统计 (前10个最低准确率) ---")
    label_acc = []
    for label, stats in label_stats.items():
        if stats['total'] >= 5:  # 至少5个样本
            acc = stats['correct'] / stats['total'] * 100
            label_acc.append((label, acc, stats['total'], stats['correct']))

    label_acc.sort(key=lambda x: x[1])
    for label, acc, total, correct in label_acc[:10]:
        print(f"  {label}: {acc:.1f}% ({correct}/{total})")

    # 错误分析
    if errors:
        print(f"\n--- 错误样本 (前5个) ---")
        for err in errors[:5]:
            print(f"  文本: {err['text']}")
            print(f"  真实标签: {err['true_label']}")
            print(f"  错误: {err['error']}")
            print()

    # 保存报告
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_samples': total,
        'tested_samples': tested,
        'errors': len(errors),
        'accuracy': {
            'top1': accuracy,
            'top3': top3_acc,
            'top5': top5_acc
        },
        'avg_confidence': avg_confidence,
        'elapsed_seconds': elapsed,
        'label_stats': {k: v for k, v in label_stats.items()}
    }

    report_path = Path(__file__).parent / 'reports' / f'classifier_accuracy_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    report_path.parent.mkdir(exist_ok=True)

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n报告已保存: {report_path}")

    return report

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='分类器准确率测试')
    parser.add_argument('--samples', type=int, default=None, help='测试样本数 (默认全部)')
    args = parser.parse_args()

    run_accuracy_test(args.samples)
