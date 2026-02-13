#!/usr/bin/env python3
"""Generate BERT training data audit report."""

import json
import glob
import os
from collections import Counter, defaultdict
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def load_jsonl_labels(path):
    counts = Counter()
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                counts[item.get('label', 'UNKNOWN')] += 1
            except:
                pass
    return counts

def main():
    audit = {
        'audit_timestamp': datetime.now().isoformat(),
        'audit_version': '1.0',
        'summary': {},
        'training_files': [],
        'model_info': {},
        'label_mapping_analysis': {},
        'undertrained_intents': [],
        'overtrained_intents': [],
        'missing_intents': [],
        'duplicate_intents': [],
        'confusion_pairs': [],
        'low_confidence_queries': [],
        'critical_gaps': [],
        'recommendations': []
    }

    # === 1. TRAINING FILES ===
    data_dir = os.path.join(BASE_DIR, 'scripts', 'finetune', 'data')

    # full_training_data.jsonl
    counts_full = load_jsonl_labels(os.path.join(data_dir, 'full_training_data.jsonl'))
    audit['training_files'].append({
        'path': 'scripts/finetune/data/full_training_data.jsonl',
        'total_samples': sum(counts_full.values()),
        'unique_intents': len(counts_full),
        'min_samples_per_intent': min(counts_full.values()),
        'max_samples_per_intent': max(counts_full.values()),
        'avg_samples_per_intent': round(sum(counts_full.values()) / len(counts_full), 1),
        'samples_per_intent': dict(sorted(counts_full.items(), key=lambda x: x[1]))
    })

    # incremental_training_data.jsonl
    counts_incr = load_jsonl_labels(os.path.join(data_dir, 'incremental_training_data.jsonl'))
    audit['training_files'].append({
        'path': 'scripts/finetune/data/incremental_training_data.jsonl',
        'total_samples': sum(counts_incr.values()),
        'unique_intents': len(counts_incr),
        'samples_per_intent': dict(sorted(counts_incr.items(), key=lambda x: x[1]))
    })

    # Augmentation files
    for aug_file in ['v3_augmentation.jsonl', 'v4_augmentation.jsonl', 'v5_augmentation.jsonl']:
        aug_path = os.path.join(data_dir, aug_file)
        if os.path.exists(aug_path):
            aug_counts = load_jsonl_labels(aug_path)
            audit['training_files'].append({
                'path': f'scripts/finetune/data/{aug_file}',
                'total_samples': sum(aug_counts.values()),
                'unique_intents': len(aug_counts),
                'samples_per_intent': dict(sorted(aug_counts.items(), key=lambda x: x[1]))
            })

    # === 2. MODEL INFO ===
    audit['model_info'] = {
        'architecture': 'BertForSequenceClassification',
        'base_model': 'hfl/chinese-roberta-wwm-ext',
        'model_type': 'Chinese RoBERTa-wwm-ext (Whole Word Masking)',
        'hidden_size': 768,
        'num_hidden_layers': 12,
        'num_attention_heads': 12,
        'vocab_size': 21128,
        'max_position_embeddings': 512,
        'training_max_length': 64,
        'inference_max_length': 128,
        'num_labels': 177,
        'model_location': 'scripts/finetune/models/chinese-roberta-wwm-ext-classifier/final/',
        'model_file_size': '409 MB (pytorch_model.bin)',
        'training_script': 'scripts/finetune/finetune_full.py',
        'data_generation_script': 'scripts/finetune/generate_full_training_data_v2.py',
        'hyperparameters': {
            'epochs': 5,
            'batch_size': 32,
            'learning_rate': 2e-5,
            'weight_decay': 0.01,
            'warmup_ratio': 0.1,
            'eval_split': 0.1,
            'early_stopping_patience': 2,
            'fp16': True,
            'seed': 42
        },
        'training_metrics': {
            'top1_accuracy': 0.8740,
            'top5_accuracy': 0.9758,
            'f1_weighted': 0.8685,
            'num_train_samples': 17493,
            'num_val_samples': 1944
        },
        'deployment_paths': [
            '/www/wwwroot/smartbi-python/models/chinese-roberta-wwm-ext-classifier/final',
            '/www/wwwroot/python-services/models/chinese-roberta-wwm-ext-classifier/final',
            'C:/Users/Steve/my-prototype-logistics/scripts/finetune/models/chinese-roberta-wwm-ext-classifier/final'
        ],
        'java_integration': {
            'class': 'com.cretas.aims.service.ClassifierIntentMatcher',
            'config_class': 'com.cretas.aims.config.PythonClassifierConfig',
            'api_endpoint': '/api/classifier/classify',
            'weight_in_fusion': 0.5,
            'min_confidence': 0.1,
            'top_k': 5,
            'health_check_interval_ms': 30000
        }
    }

    # === 3. LABEL MAPPING ANALYSIS ===
    with open(os.path.join(data_dir, 'label_mapping.json'), 'r', encoding='utf-8') as f:
        label_mapping = json.load(f)

    training_intents = set(counts_full.keys())
    mapped_intents = set(label_mapping['label_to_id'].keys())

    kb_intents = set()
    with open(os.path.join(data_dir, 'intents_export.jsonl'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                kb_intents.add(item.get('intent_code', ''))
            except:
                pass

    # Get test expected intents
    test_expected = set()
    report_dir = os.path.join(BASE_DIR, 'tests', 'ai-intent', 'reports')
    report_files = sorted(glob.glob(os.path.join(report_dir, 'v5_round*_*.json')))
    for rf in report_files:
        try:
            with open(rf, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for r in data.get('results', []):
                for e in (r.get('expected', []) or []):
                    if e and e is not None:
                        test_expected.add(e)
        except:
            pass

    audit['label_mapping_analysis'] = {
        'total_mapped_labels': len(mapped_intents),
        'total_kb_intents': len(kb_intents),
        'total_training_intents': len(training_intents),
        'total_test_expected_intents': len(test_expected),
        'in_kb_not_in_training': sorted(kb_intents - training_intents),
        'in_tests_not_in_training': sorted(test_expected - training_intents - {None, 'None'}),
        'in_tests_not_in_kb': sorted(test_expected - kb_intents - {None, 'None'})
    }

    # === 4. DUPLICATE INTENTS ===
    audit['duplicate_intents'] = [
        {'group': 'HR employee delete', 'intents': ['HR_DELETE_EMPLOYEE', 'HR_EMPLOYEE_DELETE', 'HRM_DELETE_EMPLOYEE'], 'wasted_samples': 200},
        {'group': 'WeChat notification', 'intents': ['NOTIFICATION_SEND_WECHAT', 'NOTIFICATION_WECHAT_SEND', 'SEND_WECHAT_MESSAGE'], 'wasted_samples': 200},
        {'group': 'Exclude selected', 'intents': ['EXCLUDE_SELECTED', 'FILTER_EXCLUDE_SELECTED', 'SYSTEM_FILTER_EXCLUDE_SELECTED', 'UI_EXCLUDE_SELECTED'], 'wasted_samples': 300},
        {'group': 'Navigation to location', 'intents': ['NAVIGATE_TO_LOCATION', 'NAVIGATION_TO_LOCATION'], 'wasted_samples': 100},
        {'group': 'Navigation to city', 'intents': ['NAVIGATE_TO_CITY', 'NAVIGATION_TO_CITY'], 'wasted_samples': 100},
        {'group': 'Pagination/Next page', 'intents': ['NAVIGATION_NEXT_PAGE', 'PAGINATION_NEXT'], 'wasted_samples': 100},
        {'group': 'Order update/modify', 'intents': ['ORDER_MODIFY', 'ORDER_UPDATE'], 'wasted_samples': 100},
        {'group': 'Task assign', 'intents': ['TASK_ASSIGN_EMPLOYEE', 'TASK_ASSIGN_WORKER'], 'wasted_samples': 100},
        {'group': 'Financial ratios/ROE', 'intents': ['QUERY_FINANCE_ROE', 'financial_ratios'], 'wasted_samples': 100}
    ]

    # === 5. UNDER/OVER-TRAINED ===
    audit['undertrained_intents'] = []  # All have >= 100
    audit['overtrained_intents'] = [
        {'intent': intent, 'count': count}
        for intent, count in sorted(counts_full.items(), key=lambda x: -x[1])
        if count >= 150
    ]

    # === 6. CONFUSION PAIRS ===
    confusion = defaultdict(Counter)
    classifier_fail_details = []

    for rf in report_files:
        try:
            with open(rf, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for r in data.get('results', []):
                method = r.get('method', '')
                if 'CLASSIFIER' in str(method) and r.get('status') == 'FAIL':
                    got = r.get('intent', '')
                    for e in (r.get('expected', []) or []):
                        if e and e is not None:
                            confusion[got][e] += 1
                    classifier_fail_details.append({
                        'query': r.get('query', ''),
                        'got_intent': got,
                        'expected': r.get('expected', []),
                        'confidence': r.get('confidence', 0)
                    })
        except:
            pass

    pairs = []
    for got, expected_counter in confusion.items():
        for expected, count in expected_counter.items():
            if count >= 3:
                pairs.append({'predicted': got, 'expected': expected, 'confusion_count': count})
    pairs.sort(key=lambda x: -x['confusion_count'])
    audit['confusion_pairs'] = pairs[:50]

    # === 7. LOW CONFIDENCE QUERIES ===
    classifier_fail_details.sort(key=lambda x: x['confidence'])
    seen_queries = set()
    low_conf = []
    for f_item in classifier_fail_details:
        q = f_item['query']
        if q and q not in seen_queries:
            seen_queries.add(q)
            low_conf.append(f_item)
        if len(low_conf) >= 50:
            break
    audit['low_confidence_queries'] = low_conf

    # === 8. CRITICAL GAPS ===
    fail_expected_counter = Counter()
    for rf in report_files:
        try:
            with open(rf, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for r in data.get('results', []):
                if r.get('status') == 'FAIL':
                    for e in (r.get('expected', []) or []):
                        if e and e is not None:
                            fail_expected_counter[e] += 1
        except:
            pass

    missing_needed = {k: v for k, v in fail_expected_counter.items()
                      if k not in training_intents and k != 'None' and k is not None}

    audit['critical_gaps'] = [
        {'intent': intent, 'test_failure_count': count, 'in_training': False, 'in_kb': intent in kb_intents}
        for intent, count in sorted(missing_needed.items(), key=lambda x: -x[1])[:50]
    ]

    # === 9. MISSING INTENTS ===
    audit['missing_intents'] = sorted(test_expected - training_intents - {None, 'None'})

    # === 10. SUMMARY ===
    total_classifier_results = 0
    total_classifier_failures = 0
    classifier_confs = []
    for rf in report_files:
        try:
            with open(rf, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for r in data.get('results', []):
                if 'CLASSIFIER' in str(r.get('method', '')):
                    total_classifier_results += 1
                    classifier_confs.append(r.get('confidence', 0))
                    if r.get('status') == 'FAIL':
                        total_classifier_failures += 1
        except:
            pass

    audit['summary'] = {
        'total_training_samples': sum(counts_full.values()),
        'total_training_intents': len(counts_full),
        'total_kb_intents': len(kb_intents),
        'total_test_expected_intents': len(test_expected),
        'intents_in_tests_not_in_training': len(test_expected - training_intents - {None, 'None'}),
        'duplicate_intent_groups': len(audit['duplicate_intents']),
        'wasted_samples_on_duplicates': sum(d['wasted_samples'] for d in audit['duplicate_intents']),
        'model_top1_accuracy': 0.8740,
        'model_top5_accuracy': 0.9758,
        'model_f1_weighted': 0.8685,
        'total_classifier_test_results': total_classifier_results,
        'total_classifier_test_failures': total_classifier_failures,
        'classifier_failure_rate_pct': round(total_classifier_failures / total_classifier_results * 100, 2) if total_classifier_results else 0,
        'mean_classifier_confidence': round(sum(classifier_confs) / len(classifier_confs), 4) if classifier_confs else 0,
        'classifier_conf_below_0_5': sum(1 for c in classifier_confs if c < 0.5),
        'classifier_conf_below_0_7': sum(1 for c in classifier_confs if c < 0.7),
        'classifier_conf_above_0_9': sum(1 for c in classifier_confs if c >= 0.9),
        'top_confusion_pairs_count': len([p for p in pairs if p['confusion_count'] >= 3]),
        'critical_gap_intents_count': len(audit['critical_gaps'])
    }

    # === 11. RECOMMENDATIONS ===
    top_missing = sorted(missing_needed.items(), key=lambda x: -x[1])[:20]
    audit['recommendations'] = [
        {
            'priority': 'P0-CRITICAL',
            'category': 'Missing Intent Coverage',
            'title': 'Add 102 missing intents to label mapping and training data',
            'description': (
                'Tests expect 102 intents that have ZERO training samples and are not in the label mapping. '
                'Top ones by failure frequency: ' +
                ', '.join(f'{i} ({c} failures)' for i, c in top_missing[:5]) + '.'
            ),
            'impact': 'These intents can NEVER be correctly classified by BERT since they do not exist in the model output space.',
            'effort': 'High - requires regenerating training data, retraining model, updating label_mapping.json from 177 to ~250+ labels',
            'specific_intents_top20': [i for i, _ in top_missing]
        },
        {
            'priority': 'P1-HIGH',
            'category': 'Duplicate Intent Consolidation',
            'title': 'Merge 9 groups of duplicate intents (13 redundant labels)',
            'description': (
                'There are 9 groups of semantically identical intents wasting ~1,300 training samples. '
                'Examples: HR_DELETE_EMPLOYEE / HR_EMPLOYEE_DELETE / HRM_DELETE_EMPLOYEE all mean the same thing.'
            ),
            'impact': 'Reduces confusion, frees up label space for genuinely new intents, improves decision boundaries.',
            'effort': 'Medium - merge labels in KB, regenerate training data, update Java intent handlers',
            'groups': [d['group'] for d in audit['duplicate_intents']]
        },
        {
            'priority': 'P1-HIGH',
            'category': 'Confusion Resolution',
            'title': 'Add hard negatives for top 10 confusion pairs',
            'description': (
                'The BERT model frequently confuses: '
                'QUALITY_CHECK_EXECUTE vs QUALITY_CHECK_QUERY (22x), '
                'COST_TREND_ANALYSIS vs REPORT_FINANCE (16x), '
                'TRACE_PUBLIC vs TRACE_BATCH (13x). '
                'These need explicit hard negative training samples.'
            ),
            'impact': 'Could reduce classifier failure rate by 30-40% for the most confused intent pairs.',
            'effort': 'Medium - add 20-30 hard negative samples per confusion pair, retrain',
            'top_pairs': [{'predicted': p['predicted'], 'expected': p['expected'], 'count': p['confusion_count']} for p in pairs[:10]]
        },
        {
            'priority': 'P2-MEDIUM',
            'category': 'Training Data Quality',
            'title': 'Improve training sample diversity beyond template-based augmentation',
            'description': (
                'The generate_full_training_data_v2.py script uses template-based augmentation with domain synonyms. '
                'All 177 intents have exactly 100-176 samples each. The samples follow repetitive patterns. '
                'Real user queries are much more diverse.'
            ),
            'impact': 'Better generalization to real-world queries.',
            'effort': 'Medium - collect real user queries from production logs, use LLM-based augmentation',
        },
        {
            'priority': 'P2-MEDIUM',
            'category': 'Training/Inference Mismatch',
            'title': 'Fix MAX_LENGTH mismatch: training=64, inference=128',
            'description': (
                'Training uses max_length=64 but the classifier service uses max_length=128 at inference. '
                'The model was never trained on inputs longer than 64 tokens.'
            ),
            'impact': 'Better handling of complex, multi-part user queries.',
            'effort': 'Low - change MAX_LENGTH in finetune_full.py and retrain',
        },
        {
            'priority': 'P2-MEDIUM',
            'category': 'Label Naming Inconsistency',
            'title': 'Fix financial_ratios - uses snake_case instead of UPPER_SNAKE_CASE',
            'description': (
                'All 176 intents use UPPER_SNAKE_CASE except "financial_ratios" which uses lower_snake_case. '
                'Should be renamed to FINANCIAL_RATIOS.'
            ),
            'impact': 'Consistency and maintainability.',
            'effort': 'Low',
        },
        {
            'priority': 'P2-MEDIUM',
            'category': 'Negative Keywords',
            'title': 'Add negative_keywords to 147/183 intents that have none',
            'description': (
                '147 out of 183 KB intents have zero negative_keywords. '
                'These are used for generating hard negatives in training data.'
            ),
            'impact': 'Improved discrimination between similar intents.',
            'effort': 'Medium',
        },
        {
            'priority': 'P3-LOW',
            'category': 'Unused Training Data',
            'title': 'Incorporate 780 incremental/augmentation samples into model',
            'description': (
                'There are 780 additional samples (466 incremental + 163 v3 + 71 v4 + 80 v5) '
                'covering high-frequency intents. These were NOT used in the current model training.'
            ),
            'impact': 'Better coverage of the most common user queries.',
            'effort': 'Low - merge into full_training_data.jsonl and retrain',
        },
        {
            'priority': 'P3-LOW',
            'category': 'Config Quality',
            'title': 'Update model config.json to use real label names instead of LABEL_X',
            'description': (
                'The model config.json has id2label mapping like {"0": "LABEL_0"} instead of {"0": "ALERT_ACKNOWLEDGE"}.'
            ),
            'impact': 'Minor - only affects debugging and model inspection.',
            'effort': 'Low',
        },
        {
            'priority': 'P3-LOW',
            'category': 'Test Suite Alignment',
            'title': 'Align test suite expected intents with actual model capabilities',
            'description': (
                'Tests expect 246 unique intents but the model only knows 177. '
                'Many test "expected" intents are aliases. '
                'Either add missing intents or update test expectations.'
            ),
            'impact': 'More accurate test results and clearer gap analysis.',
            'effort': 'Medium',
        }
    ]

    # Write the audit
    output_path = os.path.join(BASE_DIR, 'tests', 'ai-intent', 'analysis', 'bert_training_audit.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(audit, f, indent=2, ensure_ascii=False)

    print(f'Audit written to {output_path}')
    print(f'File size: {os.path.getsize(output_path):,} bytes')
    print()
    print('=== AUDIT SUMMARY ===')
    for k, v in audit['summary'].items():
        print(f'  {k}: {v}')


if __name__ == '__main__':
    main()
