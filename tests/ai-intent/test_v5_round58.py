#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 58
Focus: SYSTEM CONFIG & SETTINGS queries for food manufacturing.
       Covers factory config, user management, notification config,
       data config, integration, backup/restore, print config,
       workflow config, and security config.
"""

import requests
import json
import sys
import time
from datetime import datetime

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SERVER = 'http://47.100.235.168:10010'
FACTORY_ID = 'F001'

def get_token():
    r = requests.post(f'{SERVER}/api/mobile/auth/unified-login', json={
        'username': 'factory_admin1', 'password': '123456'
    })
    data = r.json()
    if data.get('success'):
        return data['data']['accessToken']
    raise Exception(f"Login failed: {data}")

# Round 58 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Factory Config (6 cases) =====
    ("工厂设置修改", ["CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("产线配置查看", ["CONFIG_RESET", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("车间设置调整", ["CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "PRODUCTION_STATUS_QUERY", None], "factory_config"),
    ("工位配置管理", ["CONFIG_RESET", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("班次设置", ["CONFIG_RESET", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("产能设置调整", ["CONFIG_RESET", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),

    # ===== 2. User Management (6 cases) =====
    ("用户管理列表", ["HR_EMPLOYEE_LIST", "HR_EMPLOYEE_CREATE", "REPORT_DASHBOARD_OVERVIEW", None], "user_mgmt"),
    ("添加新用户", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "USER_CREATE", None], "user_mgmt"),
    ("权限分配设置", ["HR_EMPLOYEE_LIST", "HR_EMPLOYEE_CREATE", "REPORT_DASHBOARD_OVERVIEW", "USER_ROLE_ASSIGN", None], "user_mgmt"),
    ("角色设置管理", ["HR_EMPLOYEE_LIST", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "USER_ROLE_ASSIGN", None], "user_mgmt"),
    ("账号锁定处理", ["HR_EMPLOYEE_DELETE", "HR_EMPLOYEE_LIST", "CONFIG_RESET", "USER_DISABLE", None], "user_mgmt"),
    ("密码重置操作", ["HR_EMPLOYEE_LIST", "HR_EMPLOYEE_CREATE", "CONFIG_RESET", None], "user_mgmt"),

    # ===== 3. Notification Config (5 cases) =====
    ("通知设置管理", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "ALERT_LIST", None], "notification_config"),
    ("消息推送配置", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", None], "notification_config"),
    ("预警配置调整", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "CONFIG_RESET", None], "notification_config"),
    ("提醒规则设置", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "ALERT_LIST", "RULE_CONFIG", None], "notification_config"),
    ("通知开关管理", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", None], "notification_config"),

    # ===== 4. Data Config (6 cases) =====
    ("数据字段配置", ["FORM_GENERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),
    ("表单配置管理", ["FORM_GENERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),
    ("模板管理设置", ["FORM_GENERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),
    ("字段映射配置", ["FORM_GENERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),
    ("数据源配置", ["CONFIG_RESET", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),
    ("导入模板设置", ["FORM_GENERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "data_config"),

    # ===== 5. Integration (5 cases) =====
    ("接口配置管理", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "integration"),
    ("API管理设置", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "integration"),
    ("对接设置调整", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "integration"),
    ("数据同步配置", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "integration"),
    ("系统集成管理", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "integration"),

    # ===== 6. Backup & Restore (6 cases) =====
    ("数据备份设置", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup_restore"),
    ("数据恢复操作", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "CONTINUE_LAST_OPERATION", None], "backup_restore"),
    ("数据迁移管理", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup_restore"),
    ("日志清理设置", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup_restore"),
    ("存储管理配置", ["CONFIG_RESET", "DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", None], "backup_restore"),
    ("归档设置管理", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup_restore"),

    # ===== 7. Print Config (5 cases) =====
    ("打印设置管理", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", None], "print_config"),
    ("标签模板配置", ["LABEL_TEMPLATE_QUERY", "LABEL_PRINT", "CONFIG_RESET", "PRODUCT_UPDATE", None], "print_config"),
    ("打印机配置管理", ["LABEL_PRINT", "CONFIG_RESET", "LABEL_TEMPLATE_QUERY", None], "print_config"),
    ("条码格式设置", ["LABEL_TEMPLATE_QUERY", "LABEL_PRINT", "CONFIG_RESET", "PRODUCT_UPDATE", None], "print_config"),
    ("打印预览测试", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", None], "print_config"),

    # ===== 8. Workflow Config (6 cases) =====
    ("审批流程设置", ["PLAN_UPDATE", "CONFIG_RESET", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "workflow_config"),
    ("工作流设置管理", ["CONFIG_RESET", "PLAN_UPDATE", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "workflow_config"),
    ("流程模板配置", ["FORM_GENERATION", "CONFIG_RESET", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "workflow_config"),
    ("审批节点管理", ["PLAN_UPDATE", "CONFIG_RESET", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "workflow_config"),
    ("流转规则配置", ["CONFIG_RESET", "PLAN_UPDATE", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "workflow_config"),
    ("自动触发设置", ["CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "FORM_GENERATION", None], "workflow_config"),

    # ===== 9. Security Config (5 cases) =====
    ("安全设置管理", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "security_config"),
    ("登录策略配置", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "security_config"),
    ("访问控制设置", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "security_config"),
    ("IP白名单管理", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "security_config"),
    ("操作审计查看", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", None], "security_config"),
]

def test_intent(token, query, expected_intents, category):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    start_time = time.time()
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            headers=headers,
            json={'userInput': query},
            timeout=25
        )
        latency = time.time() - start_time
        data = r.json()
        if not data.get('success'):
            return query, 'ERROR', None, None, category, data.get('message', 'unknown'), latency

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency
    except Exception as e:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, str(e), latency

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 58 ===")
    print(f"Focus: SYSTEM CONFIG & SETTINGS queries")
    print(f"       (factory config, user mgmt, notification, data config, integration,")
    print(f"        backup/restore, print config, workflow config, security config)")
    print(f"Server: {SERVER}")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Total queries: {len(TEST_CASES)}")
    print()

    token = get_token()
    print(f"Token acquired.\n")

    results = []
    pass_count = 0
    fail_count = 0
    error_count = 0
    categories = {}

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method, latency = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat,
            'method': method, 'latency_ms': round(latency * 1000)
        })

        cat_group = cat.split('-')[0]
        if cat_group not in categories:
            categories[cat_group] = {'pass': 0, 'fail': 0, 'error': 0}

        if status == 'PASS':
            pass_count += 1
            categories[cat_group]['pass'] += 1
            icon = 'OK'
        elif status == 'FAIL':
            fail_count += 1
            categories[cat_group]['fail'] += 1
            icon = 'FAIL'
        else:
            error_count += 1
            categories[cat_group]['error'] += 1
            icon = 'ERR'

        conf_str = f"{conf:.2f}" if conf is not None else "N/A"
        lat_str = f"{latency*1000:.0f}ms"
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method} [{lat_str}]" +
              (f"  (expected: {expected})" if status != 'PASS' else ""))
        time.sleep(0.1)

    print(f"\n{'='*60}")
    print(f"Results: {pass_count} PASS / {fail_count} FAIL / {error_count} ERROR out of {len(TEST_CASES)}")
    print(f"Pass rate: {pass_count/len(TEST_CASES)*100:.1f}%")

    print(f"\n--- Category breakdown ---")
    for cat, counts in sorted(categories.items()):
        total = counts['pass'] + counts['fail'] + counts['error']
        pct = counts['pass']/total*100 if total > 0 else 0
        status_icon = "[OK]" if pct == 100 else "[WEAK]" if pct >= 60 else "[CRITICAL]"
        print(f"  {status_icon} {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']} [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    latencies = [r['latency_ms'] for r in results]
    latencies.sort()
    avg_lat = sum(latencies) / len(latencies)
    p50 = latencies[len(latencies) // 2]
    p90 = latencies[int(len(latencies) * 0.9)]
    p99 = latencies[int(len(latencies) * 0.99)]
    print(f"\n--- Latency stats ---")
    print(f"  Avg: {avg_lat:.0f}ms | P50: {p50}ms | P90: {p90}ms | P99: {p99}ms")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round58_system_config_settings',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'method_distribution': methods,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round58_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
