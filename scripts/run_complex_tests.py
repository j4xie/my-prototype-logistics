#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complex Test Runner - 300+ test cases
"""

import requests
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

# Ensure UTF-8 output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER = 'http://139.196.165.140:10010'
FACTORY_ID = 'F001'
BASE_DIR = Path(__file__).parent.parent

def main():
    print('='*70)
    print('复杂场景测试 - 300+ 测试用例')
    print('='*70)

    # Login
    print('[1/4] 登录中...')
    try:
        r = requests.post(f'{SERVER}/api/mobile/auth/unified-login',
                          json={'username': 'factory_admin1', 'password': '123456'}, timeout=10)
        token = r.json().get('data', {}).get('accessToken')
        if not token:
            print('登录失败!')
            return
        print(f'登录成功: {token[:30]}...')
    except Exception as e:
        print(f'登录异常: {e}')
        return

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    # Load test cases
    print('[2/4] 加载测试用例...')
    test_files = [
        BASE_DIR / 'backend-java/src/main/resources/data/testing/complex_test_cases_extended.json',
        BASE_DIR / 'backend-java/src/main/resources/data/testing/advanced_test_cases.json',
    ]

    all_cases = []
    for tf in test_files:
        with open(tf, 'r', encoding='utf-8') as f:
            cases = json.load(f)
            all_cases.extend(cases)
            print(f'  - {tf.name}: {len(cases)} 条')

    print(f'共加载 {len(all_cases)} 条测试用例')

    # Run tests
    print('[3/4] 开始测试...')
    print('-'*70)

    results = {'pass': 0, 'fail': 0}
    difficulty_stats = defaultdict(lambda: {'pass': 0, 'fail': 0, 'total': 0})
    failed_cases = []
    latencies = []

    for i, case in enumerate(all_cases, 1):
        user_input = case.get('userInput', '')
        expected = case.get('expectedIntent')
        difficulty = case.get('difficulty', 'unknown')

        try:
            start = time.time()
            r = requests.post(f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
                              json={'userInput': user_input, 'userId': 1, 'sessionId': 'test_batch', 'topN': 5},
                              headers=headers, timeout=60)
            latency = (time.time() - start) * 1000
            latencies.append(latency)

            data = r.json()
            actual = data.get('data', {}).get('intentCode') if data.get('success') else None
        except Exception as e:
            actual = None
            latency = 0

        passed = (actual == expected)
        if passed:
            results['pass'] += 1
            difficulty_stats[difficulty]['pass'] += 1
        else:
            results['fail'] += 1
            difficulty_stats[difficulty]['fail'] += 1
            if len(failed_cases) < 50:
                failed_cases.append({
                    'input': user_input,
                    'expected': expected,
                    'actual': actual,
                    'diff': difficulty
                })

        difficulty_stats[difficulty]['total'] += 1

        # Progress output every 20 cases
        if i % 20 == 0 or i == len(all_cases):
            pct = results['pass'] / i * 100
            avg_lat = sum(latencies[-20:]) / min(20, len(latencies))
            print(f'[{i:3d}/{len(all_cases)}] 通过率: {pct:5.1f}% ({results["pass"]}/{i}) 平均延迟: {avg_lat:.0f}ms')

    print('-'*70)
    print('[4/4] 测试完成!')
    print('='*70)

    # Summary
    total = results['pass'] + results['fail']
    print('总体结果:')
    print(f'  通过: {results["pass"]}/{total} ({results["pass"]/total*100:.1f}%)')
    print(f'  失败: {results["fail"]}/{total}')
    if latencies:
        print(f'  平均延迟: {sum(latencies)/len(latencies):.0f}ms')

    print('')
    print('按难度分类统计:')
    print('-'*70)
    for diff in sorted(difficulty_stats.keys()):
        stats = difficulty_stats[diff]
        pct = stats['pass'] / stats['total'] * 100 if stats['total'] > 0 else 0
        status = 'PASS' if pct >= 70 else 'WARN' if pct >= 50 else 'FAIL'
        print(f'  {diff:25s}: {stats["pass"]:3d}/{stats["total"]:3d} ({pct:5.1f}%) [{status}]')

    if failed_cases:
        print('')
        print(f'失败用例示例 (前{min(50, len(failed_cases))}条):')
        print('-'*70)
        for fc in failed_cases[:50]:
            exp = fc['expected'] if fc['expected'] else 'None'
            act = fc['actual'] if fc['actual'] else 'None'
            inp = fc['input'][:30] + '...' if len(fc['input']) > 30 else fc['input']
            print(f'  [{fc["diff"]:20s}] "{inp}" -> {act} (期望: {exp})')

    print('='*70)

    # Return pass rate for CI
    return results['pass'] / total if total > 0 else 0

if __name__ == '__main__':
    rate = main()
    sys.exit(0 if rate >= 0.7 else 1)
