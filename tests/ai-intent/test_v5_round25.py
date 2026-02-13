#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 25
Focus: SYSTEM CONFIGURATION & ADMIN - user management, system settings,
       permissions, notifications, system health, logs, backups, integrations.
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

# Round 25 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. User Management (6 cases) =====
    ("添加一个新用户", ["USER_CREATE", None], "user-add"),
    ("查看用户列表", ["USER_LIST", "USER_DETAIL", None], "user-list"),
    ("这个用户是什么角色", ["USER_DETAIL", "USER_LIST", None], "user-roles"),
    ("重置张三的密码", [None, "USER_DETAIL", "CONFIG_RESET"], "user-reset-password"),
    ("停用这个账号", [None, "USER_DETAIL", "USER_DISABLE"], "user-deactivate"),
    ("查看用户权限配置", ["USER_DETAIL", "USER_LIST", "USER_ROLE_ASSIGN", None], "user-permissions"),

    # ===== 2. System Settings (6 cases) =====
    ("系统配置在哪里", ["FACTORY_SETTINGS", "CONFIG_RESET", None], "system-config"),
    ("修改工厂设置", ["FACTORY_SETTINGS", "FACTORY_LIST", None], "system-factory-settings"),
    ("通知设置怎么改", [None, "FACTORY_SETTINGS", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG"], "system-notification-settings"),
    ("切换系统语言为英文", [None], "system-language"),
    ("设置时区为东八区", [None], "system-timezone"),
    ("系统偏好设置", ["FACTORY_SETTINGS", None], "system-preferences"),

    # ===== 3. Permissions & Roles (5 cases) =====
    ("查看所有角色", ["USER_LIST", "USER_ROLE_ASSIGN", None], "permission-role-list"),
    ("创建一个新角色叫质检主管", [None, "USER_CREATE", "QUALITY_CHECK_QUERY"], "permission-create-role"),
    ("给仓库管理员分配出库权限", [None, "USER_ROLE_ASSIGN"], "permission-assign"),
    ("访问控制怎么配置", [None, "FACTORY_SETTINGS", "RULE_CONFIG"], "permission-access-control"),
    ("权限审计报告", [None, "REPORT_DASHBOARD_OVERVIEW", "USER_ROLE_ASSIGN"], "permission-audit"),

    # ===== 4. Notifications (5 cases) =====
    ("查看所有通知", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "notification-list"),
    ("有多少未读通知", ["ALERT_ACTIVE", "ALERT_LIST", "ALERT_STATS", "FACTORY_NOTIFICATION_CONFIG", None], "notification-unread"),
    ("推送通知怎么设置", [None, "FACTORY_SETTINGS", "FACTORY_NOTIFICATION_CONFIG"], "notification-push-settings"),
    ("告警偏好设置", [None, "ALERT_LIST", "FACTORY_SETTINGS", "RULE_CONFIG"], "notification-alert-preferences"),
    ("通知历史记录", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", None], "notification-history"),

    # ===== 5. System Health (6 cases) =====
    ("系统运行状态", [None, "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY"], "health-system-status"),
    ("服务器健康检查", [None], "health-server"),
    ("数据库连接状态", [None], "health-database"),
    ("磁盘空间还剩多少", [None], "health-disk-space"),
    ("内存使用率多少", [None], "health-memory"),
    ("API响应时间", [None], "health-api-response"),

    # ===== 6. Audit Logs (5 cases) =====
    ("查看系统日志", [None, "REPORT_DASHBOARD_OVERVIEW"], "audit-system-logs"),
    ("操作日志查询", [None, "PROCESSING_BATCH_TIMELINE"], "audit-operation-logs"),
    ("登录历史记录", [None], "audit-login-history"),
    ("数据变更记录", [None, "MATERIAL_ADJUST_QUANTITY"], "audit-change-log"),
    ("安全事件日志", [None, "ALERT_LIST"], "audit-security-events"),

    # ===== 7. Data Management (6 cases) =====
    ("备份状态怎么样", [None], "data-backup-status"),
    ("导出全部数据", [None, "REPORT_DASHBOARD_OVERVIEW"], "data-export"),
    ("导入数据", [None, "REPORT_DASHBOARD_OVERVIEW"], "data-import"),
    ("清理过期数据", [None, "DATA_BATCH_DELETE"], "data-cleanup"),
    ("归档去年的数据", [None], "data-archive"),
    ("存储空间使用情况", [None], "data-storage-usage"),

    # ===== 8. Integration (5 cases) =====
    ("外部API连接状态", [None], "integration-api-status"),
    ("同步外部系统数据", [None], "integration-sync"),
    ("集成日志查看", [None], "integration-log"),
    ("Webhook状态检查", [None], "integration-webhook"),
    ("第三方系统连接", [None], "integration-third-party"),

    # ===== 9. Maintenance & Updates (6 cases) =====
    ("系统有没有新版本", [None], "maintenance-update"),
    ("计划维护时间", [None, "EQUIPMENT_MAINTENANCE"], "maintenance-scheduled"),
    ("当前系统版本号", [None], "maintenance-version"),
    ("系统更新日志", [None], "maintenance-changelog"),
    ("停机通知", [None, "ALERT_LIST"], "maintenance-downtime"),
    ("重启服务", [None], "maintenance-restart"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 25 ===")
    print(f"Focus: SYSTEM CONFIGURATION & ADMIN - user management, system settings,")
    print(f"       permissions, notifications, system health, logs, backups, integrations")
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
        'test': 'v5_round25_system_config_admin',
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
    report_path = f'tests/ai-intent/reports/v5_round25_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
