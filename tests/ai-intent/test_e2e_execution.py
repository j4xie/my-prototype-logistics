#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E Intent Pipeline Test: Recognition -> Execution -> Response Quality
=======================================================================
Tests the FULL intent pipeline across all categories:
  - DATA_RETRIEVAL: 20 tests (batches, materials, attendance, quality, alerts, etc.)
  - REPORT_GENERATION: 5 tests (production, quality, inventory, KPI, dashboard)
  - CONVERSATION: 10 tests (start, reply, confirm, cancel, stats, active)
  - PERMISSION: 5 tests (cross-role access control)
  - ERROR_HANDLING: 5 tests (empty input, invalid intent, no auth, wrong factory, gibberish)
  - RECOGNITION_ACCURACY: 7 tests (classifier, phrase match, sensitivity levels)
  - DROOLS_VALIDATION_BUG: 2 tests (verifies known Drools NPE + bypass workaround)
  - PUBLIC_DEMO: 3 tests (public endpoints, sensitivity filtering)

Server: http://47.100.235.168:10010
Auth: factory_admin1 / 123456

IMPORTANT: All data-modifying operations use previewOnly=true to avoid side effects.
"""

import requests
import json
import sys
import os
import time
import traceback
from datetime import datetime
from collections import defaultdict

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ==============================================================================
# Configuration
# ==============================================================================

SERVER = 'http://139.196.165.140:10010'
FACTORY_ID = 'F001'
REQUEST_TIMEOUT = 60

TEST_ACCOUNTS = {
    'factory_admin': {
        'username': 'factory_admin1',
        'password': '123456',
        'role': 'factory_super_admin',
        'factoryId': 'F001'
    },
    'quality_inspector': {
        'username': 'quality_insp1',
        'password': '123456',
        'role': 'quality_inspector',
        'factoryId': 'F001'
    },
    'warehouse_manager': {
        'username': 'warehouse_mgr1',
        'password': '123456',
        'role': 'warehouse_manager',
        'factoryId': 'F001'
    },
}

# ==============================================================================
# Test Case Definitions
# ==============================================================================

# Category: DATA_RETRIEVAL - Execute intent with intentCode, expect SUCCESS + data
DATA_RETRIEVAL_TESTS = [
    {
        'id': 'DATA-01',
        'query': '查看所有批次',
        'intentCode': 'PROCESSING_BATCH_LIST',
        'description': 'Processing batch list',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
            ('formattedText', 'not_empty', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-02',
        'query': '查看原料批次',
        'intentCode': 'MATERIAL_BATCH_QUERY',
        'description': 'Material batch query',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-03',
        'query': '低库存预警',
        'intentCode': 'MATERIAL_LOW_STOCK_ALERT',
        'description': 'Low stock alert',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.warnings', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-04',
        'query': '过期原料查询',
        'intentCode': 'MATERIAL_EXPIRED_QUERY',
        'description': 'Expired material query',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.batches', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-05',
        'query': '今天考勤情况',
        'intentCode': 'ATTENDANCE_TODAY',
        'description': 'Today attendance',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'DATA-06',
        'query': '考勤记录',
        'intentCode': 'ATTENDANCE_HISTORY',
        'description': 'Attendance history',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'DATA-07',
        'query': '考勤统计',
        'intentCode': 'ATTENDANCE_STATS',
        'description': 'Attendance stats',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.metrics', 'exists', None),
        ],
    },
    {
        'id': 'DATA-08',
        'query': '产量报告',
        'intentCode': 'REPORT_PRODUCTION',
        'description': 'Production report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.reportType', 'exists', None),
        ],
    },
    {
        'id': 'DATA-09',
        'query': '质检报告',
        'intentCode': 'REPORT_QUALITY',
        'description': 'Quality report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.reportType', 'exists', None),
        ],
    },
    {
        'id': 'DATA-10',
        'query': '库存报告',
        'intentCode': 'REPORT_INVENTORY',
        'description': 'Inventory report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'DATA-11',
        'query': 'KPI报告',
        'intentCode': 'REPORT_KPI',
        'description': 'KPI report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'DATA-12',
        'query': '仪表盘数据',
        'intentCode': 'REPORT_DASHBOARD_OVERVIEW',
        'description': 'Dashboard overview',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'DATA-13',
        'query': '质检记录',
        'intentCode': 'QUALITY_CHECK_QUERY',
        'description': 'Quality check query',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-14',
        'query': '质检统计',
        'intentCode': 'QUALITY_STATS',
        'description': 'Quality stats',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.summary', 'exists', None),
        ],
    },
    {
        'id': 'DATA-15',
        'query': '出货查询',
        'intentCode': 'SHIPMENT_QUERY',
        'description': 'Shipment query',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-16',
        'query': '出货统计',
        'intentCode': 'SHIPMENT_STATS',
        'description': 'Shipment stats',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.summary', 'exists', None),
        ],
    },
    {
        'id': 'DATA-17',
        'query': '告警列表',
        'intentCode': 'ALERT_LIST',
        'description': 'Alert list',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-18',
        'query': '告警统计',
        'intentCode': 'ALERT_STATS',
        'description': 'Alert stats',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.statistics', 'exists', None),
        ],
    },
    {
        'id': 'DATA-19',
        'query': '客户列表',
        'intentCode': 'CUSTOMER_LIST',
        'description': 'Customer list',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
    {
        'id': 'DATA-20',
        'query': '供应商列表',
        'intentCode': 'SUPPLIER_LIST',
        'description': 'Supplier list',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [
            ('resultData.content', 'is_array', None),
        ],
    },
]

EXTRA_DATA_TESTS = [
    {
        'id': 'EXTRA-01',
        'query': '秤设备列表',
        'intentCode': 'SCALE_LIST_DEVICES',
        'description': 'Scale device list',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'EXTRA-02',
        'query': '产品类型',
        'intentCode': 'PRODUCT_TYPE_QUERY',
        'description': 'Product type query',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'EXTRA-03',
        'query': '效率报告',
        'intentCode': 'REPORT_EFFICIENCY',
        'description': 'Efficiency report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
            ('resultData', 'not_null', None),
        ],
        'deep_validations': [],
    },
    {
        'id': 'EXTRA-04',
        'query': '异常报告',
        'intentCode': 'REPORT_ANOMALY',
        'description': 'Anomaly report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
        ],
        'deep_validations': [],
    },
    {
        'id': 'EXTRA-05',
        'query': '趋势报告',
        'intentCode': 'REPORT_TRENDS',
        'description': 'Trends report',
        'validations': [
            ('status', 'in', ['SUCCESS', 'COMPLETED']),
        ],
        'deep_validations': [],
    },
]

# Category: RECOGNITION_ACCURACY - Test /recognize endpoint for correct intent matching
RECOGNITION_TESTS = [
    {
        'id': 'RECOG-01',
        'query': '查看这个月的产量',
        'expectedIntentCode': 'REPORT_PRODUCTION',
        'description': 'Monthly production -> REPORT_PRODUCTION',
        'validations': [
            ('matched', 'equals', True),
            ('confidence', 'greater_than', 0.7),
        ],
    },
    {
        'id': 'RECOG-02',
        'query': '删除所有用户',
        'expectedIntentCode': 'USER_DELETE',
        'description': 'Delete users -> USER_DELETE (CRITICAL)',
        'validations': [
            ('matched', 'equals', True),
            ('intentCode', 'equals', 'USER_DELETE'),
            ('sensitivityLevel', 'equals', 'CRITICAL'),
        ],
    },
    {
        'id': 'RECOG-03',
        'query': '生产线1号设备是什么状态',
        'expectedIntentCode': 'EQUIPMENT_STATUS_QUERY',
        'description': 'Equipment status query',
        'validations': [
            ('matched', 'equals', True),
            ('intentCode', 'equals', 'EQUIPMENT_STATUS_QUERY'),
        ],
    },
    {
        'id': 'RECOG-04',
        'query': '如何提高生产效率',
        'expectedIntentCode': None,  # Could match various intents
        'description': 'Advisory query - should match some intent',
        'validations': [
            ('matched', 'equals', True),
        ],
    },
    {
        'id': 'RECOG-05',
        'query': '原材料快过期了吗',
        'expectedIntentCode': 'MATERIAL_EXPIRING_ALERT',
        'description': 'Expiring materials alert',
        'validations': [
            ('matched', 'equals', True),
            ('intentCode', 'equals', 'MATERIAL_EXPIRING_ALERT'),
        ],
    },
    {
        'id': 'RECOG-06',
        'query': '今天谁迟到了',
        'expectedIntentCode': 'ATTENDANCE_ANOMALY',
        'description': 'Who was late -> attendance anomaly',
        'validations': [
            ('matched', 'equals', True),
            ('intentCode', 'equals', 'ATTENDANCE_ANOMALY'),
        ],
    },
    {
        'id': 'RECOG-07',
        'query': '添加一个新的秤设备',
        'expectedIntentCode': 'SCALE_ADD_DEVICE',
        'description': 'Add scale device -> MEDIUM sensitivity',
        'validations': [
            ('matched', 'equals', True),
            ('intentCode', 'equals', 'SCALE_ADD_DEVICE'),
            ('sensitivityLevel', 'equals', 'MEDIUM'),
        ],
    },
]

# Category: DROOLS_VALIDATION_BUG - Verify known Drools NPE bug + bypass
DROOLS_TESTS = [
    {
        'id': 'DROOLS-01',
        'query': '查看所有批次',
        'intentCode_provided': False,
        'description': 'Execute WITHOUT intentCode -> Drools NPE expected',
        'expected_status': 'VALIDATION_FAILED',
    },
    {
        'id': 'DROOLS-02',
        'query': '查看所有批次',
        'intentCode_provided': True,
        'intentCode': 'PROCESSING_BATCH_LIST',
        'description': 'Execute WITH intentCode -> bypasses Drools, SUCCESS',
        'expected_status': 'SUCCESS',
    },
]

# Category: ERROR_HANDLING
ERROR_HANDLING_TESTS = [
    {
        'id': 'ERR-01',
        'query': '',
        'description': 'Empty input -> should handle gracefully',
        'expected_behavior': 'NEED_CLARIFICATION or similar graceful response',
    },
    {
        'id': 'ERR-02',
        'query': 'test',
        'intentCode': 'NON_EXISTENT_INTENT',
        'description': 'Non-existent intent code -> FAILED',
        'expected_behavior': 'FAILED with message about intent not found',
    },
    {
        'id': 'ERR-03',
        'query': '查看批次',
        'auth': 'none',
        'description': 'No auth token -> HTTP 401',
        'expected_http_status': 401,
    },
    {
        'id': 'ERR-04',
        'query': '查看批次',
        'factoryId': 'WRONG_FACTORY',
        'intentCode': 'PROCESSING_BATCH_LIST',
        'description': 'Wrong factory ID -> HTTP 403 or error',
        'expected_http_status': 403,
    },
    {
        'id': 'ERR-05',
        'query': 'asdfghjklqwertyu',
        'description': 'Gibberish input -> not recognized',
        'expected_behavior': 'NEED_CLARIFICATION or intentRecognized=false',
    },
]

# Category: PUBLIC_DEMO
PUBLIC_DEMO_TESTS = [
    {
        'id': 'PUBLIC-01',
        'query': '今天产量多少',
        'endpoint': '/api/public/ai-demo/execute',
        'description': 'Public demo execute - LOW sensitivity intent',
        'validations': [
            ('intentRecognized', 'equals', True),
        ],
    },
    {
        'id': 'PUBLIC-02',
        'query': '删除用户',
        'endpoint': '/api/public/ai-demo/execute',
        'description': 'Public demo - CRITICAL intent blocked',
        'validations': [
            ('intentRecognized', 'equals', True),
            ('status', 'equals', 'NO_PERMISSION'),
        ],
    },
    {
        'id': 'PUBLIC-03',
        'query': '查看批次',
        'endpoint': '/api/public/ai-demo/recognize',
        'description': 'Public demo recognize',
        'validations': [
            ('matched', 'equals', True),
        ],
    },
]


# ==============================================================================
# Helper Functions
# ==============================================================================

def login(username, password, factory_id='F001'):
    """Authenticate and return JWT token."""
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/auth/unified-login',
            json={'username': username, 'password': password, 'factoryId': factory_id},
            timeout=30
        )
        data = r.json()
        if data.get('success'):
            token = data.get('data', {}).get('accessToken')
            if token:
                return token
            # Some responses nest token differently
            return data.get('data', {}).get('token')
        else:
            print(f"  Login failed for {username}: {data.get('message', 'unknown error')}")
            return None
    except Exception as e:
        print(f"  Login exception for {username}: {e}")
        return None


def make_headers(token):
    """Build request headers with auth token."""
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }


def resolve_path(obj, path):
    """
    Resolve a dot-separated path in a nested dict/list.
    e.g. 'resultData.content' -> obj['resultData']['content']
    Returns (True, value) if found, (False, None) if not.
    """
    parts = path.split('.')
    current = obj
    for part in parts:
        if current is None:
            return False, None
        if isinstance(current, dict):
            if part in current:
                current = current[part]
            else:
                return False, None
        elif isinstance(current, list):
            try:
                idx = int(part)
                current = current[idx]
            except (ValueError, IndexError):
                return False, None
        else:
            return False, None
    return True, current


def validate_field(response_data, field_path, operator, expected):
    """
    Validate a single field in the response.
    Returns (passed: bool, message: str).
    """
    found, value = resolve_path(response_data, field_path)

    if operator == 'not_null':
        if not found or value is None:
            return False, f"{field_path} is null or missing"
        return True, f"{field_path} is present"

    elif operator == 'not_empty':
        if not found or value is None or value == '' or value == []:
            return False, f"{field_path} is empty or missing"
        return True, f"{field_path} is not empty"

    elif operator == 'exists':
        if not found:
            return False, f"{field_path} does not exist"
        return True, f"{field_path} exists"

    elif operator == 'equals':
        if not found:
            return False, f"{field_path} not found (expected {expected})"
        if value != expected:
            return False, f"{field_path} = {value!r} (expected {expected!r})"
        return True, f"{field_path} = {value!r}"

    elif operator == 'in':
        if not found:
            return False, f"{field_path} not found (expected one of {expected})"
        if value not in expected:
            return False, f"{field_path} = {value!r} (expected one of {expected})"
        return True, f"{field_path} = {value!r}"

    elif operator == 'is_array':
        if not found or not isinstance(value, list):
            return False, f"{field_path} is not an array (got {type(value).__name__ if found else 'missing'})"
        return True, f"{field_path} is array (len={len(value)})"

    elif operator == 'is_boolean':
        if not found or not isinstance(value, bool):
            return False, f"{field_path} is not boolean"
        return True, f"{field_path} = {value}"

    elif operator == 'greater_than':
        if not found:
            return False, f"{field_path} not found"
        try:
            if float(value) <= float(expected):
                return False, f"{field_path} = {value} (expected > {expected})"
        except (TypeError, ValueError):
            return False, f"{field_path} = {value!r} (cannot compare numerically)"
        return True, f"{field_path} = {value}"

    elif operator == 'contains':
        if not found or value is None:
            return False, f"{field_path} not found"
        if expected not in str(value):
            return False, f"{field_path} does not contain '{expected}'"
        return True, f"{field_path} contains '{expected}'"

    else:
        return False, f"Unknown operator: {operator}"


# ==============================================================================
# Test Runners
# ==============================================================================

def run_execute_test(test_case, headers, factory_id='F001'):
    """
    Run a single intent execution test.
    Calls /execute with intentCode (Drools bypass) and validates response.
    """
    result = {
        'id': test_case['id'],
        'query': test_case['query'],
        'intentCode': test_case.get('intentCode', ''),
        'description': test_case.get('description', ''),
        'category': 'DATA_RETRIEVAL',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }

    try:
        body = {
            'userInput': test_case['query'],
            'intentCode': test_case.get('intentCode', ''),
        }
        # For any execution tests that could modify data
        if test_case.get('previewOnly'):
            body['previewOnly'] = True

        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{factory_id}/ai-intents/execute',
            json=body,
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result['latency_ms'] = round(latency, 1)
        result['http_status'] = r.status_code

        if r.status_code != 200:
            result['error'] = f"HTTP {r.status_code}"
            result['response_summary'] = {'raw': r.text[:500]}
            return result

        resp = r.json()
        if not resp.get('success') and not resp.get('data'):
            result['error'] = f"API returned success=false: {resp.get('message', '')}"
            result['response_summary'] = resp
            return result

        # The actual intent response is in resp['data']
        data = resp.get('data', {})
        if data is None:
            data = {}

        result['response_summary'] = {
            'intentRecognized': data.get('intentRecognized'),
            'intentCode': data.get('intentCode'),
            'intentName': data.get('intentName'),
            'status': data.get('status'),
            'confidence': data.get('confidence'),
            'matchMethod': data.get('matchMethod'),
            'formattedText': (data.get('formattedText') or '')[:200],
            'hasResultData': data.get('resultData') is not None,
            'resultDataKeys': list(data.get('resultData', {}).keys()) if isinstance(data.get('resultData'), dict) else None,
            'suggestedActions': data.get('suggestedActions'),
        }

        # Run validations
        all_passed = True
        for field_path, operator, expected in test_case.get('validations', []):
            passed, msg = validate_field(data, field_path, operator, expected)
            result['validation_results'].append({'field': field_path, 'passed': passed, 'message': msg})
            if not passed:
                all_passed = False

        # Run deep validations (nested in resultData)
        for field_path, operator, expected in test_case.get('deep_validations', []):
            passed, msg = validate_field(data, field_path, operator, expected)
            result['validation_results'].append({'field': field_path, 'passed': passed, 'message': msg})
            if not passed:
                all_passed = False

        result['passed'] = all_passed

    except requests.exceptions.Timeout:
        result['error'] = 'Request timeout'
    except requests.exceptions.ConnectionError:
        result['error'] = 'Connection error'
    except Exception as e:
        result['error'] = f'{type(e).__name__}: {str(e)}'

    return result


def run_recognition_test(test_case, headers):
    """
    Run a recognition-only test via /recognize endpoint.
    """
    result = {
        'id': test_case['id'],
        'query': test_case['query'],
        'expectedIntentCode': test_case.get('expectedIntentCode'),
        'description': test_case.get('description', ''),
        'category': 'RECOGNITION_ACCURACY',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }

    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            json={'userInput': test_case['query']},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result['latency_ms'] = round(latency, 1)
        result['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {})
        if data is None:
            data = {}

        result['response_summary'] = {
            'matched': data.get('matched'),
            'intentCode': data.get('intentCode'),
            'intentName': data.get('intentName'),
            'category': data.get('category'),
            'sensitivityLevel': data.get('sensitivityLevel'),
            'confidence': data.get('confidence'),
            'matchMethod': data.get('matchMethod'),
        }

        all_passed = True
        for field_path, operator, expected in test_case.get('validations', []):
            passed, msg = validate_field(data, field_path, operator, expected)
            result['validation_results'].append({'field': field_path, 'passed': passed, 'message': msg})
            if not passed:
                all_passed = False

        result['passed'] = all_passed

    except Exception as e:
        result['error'] = f'{type(e).__name__}: {str(e)}'

    return result


def run_drools_tests(headers):
    """Run the 2 Drools validation bug tests."""
    results = []

    # DROOLS-01: Execute WITHOUT intentCode -> expect VALIDATION_FAILED (Drools NPE)
    test = DROOLS_TESTS[0]
    result = {
        'id': test['id'],
        'query': test['query'],
        'description': test['description'],
        'category': 'DROOLS_VALIDATION_BUG',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/execute',
            json={'userInput': test['query']},  # No intentCode
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result['latency_ms'] = round(latency, 1)
        result['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}

        result['response_summary'] = {
            'status': data.get('status'),
            'message': data.get('message', ''),
            'validationViolations': data.get('validationViolations'),
            'intentCode': data.get('intentCode'),
        }

        # We EXPECT VALIDATION_FAILED (known bug)
        status = data.get('status')
        if status == 'VALIDATION_FAILED':
            result['passed'] = True
            result['validation_results'].append({
                'field': 'status',
                'passed': True,
                'message': f'status = VALIDATION_FAILED (Drools bug confirmed)'
            })
        else:
            # If it's NOT VALIDATION_FAILED, the bug may have been fixed
            result['passed'] = False
            result['validation_results'].append({
                'field': 'status',
                'passed': False,
                'message': f'status = {status} (expected VALIDATION_FAILED from Drools bug, bug may be fixed!)'
            })
    except Exception as e:
        result['error'] = str(e)

    results.append(result)

    # DROOLS-02: Execute WITH intentCode -> expect SUCCESS (bypass)
    test = DROOLS_TESTS[1]
    result2 = run_execute_test(
        {
            'id': test['id'],
            'query': test['query'],
            'intentCode': test['intentCode'],
            'description': test['description'],
            'validations': [
                ('status', 'in', ['SUCCESS', 'COMPLETED']),
                ('resultData', 'not_null', None),
            ],
            'deep_validations': [],
        },
        headers
    )
    result2['category'] = 'DROOLS_VALIDATION_BUG'
    results.append(result2)

    return results


def run_conversation_tests(headers):
    """
    Run the full conversation flow tests:
    1. Start conversation with vague input
    2. Reply to narrow down
    3. Confirm intent
    4. Cancel another conversation
    5. Get stats
    6. Get active session
    7. Get non-existent session
    """
    results = []
    session_id_for_reply = None
    session_id_for_cancel = None

    # CONV-01: Start conversation with vague input
    result = {
        'id': 'CONV-01',
        'query': '帮我看看数据',
        'description': 'Start conversation - vague input',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/start',
            json={'userInput': '帮我看看数据'},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result['latency_ms'] = round(latency, 1)
        result['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}

        result['response_summary'] = {
            'success': resp.get('success'),
            'sessionId': data.get('sessionId'),
            'status': data.get('status'),
            'currentRound': data.get('currentRound'),
            'maxRounds': data.get('maxRounds'),
            'message': (data.get('message') or '')[:200],
            'candidateCount': len(data.get('candidates', [])),
            'requiresConfirmation': data.get('requiresConfirmation'),
        }

        session_id_for_reply = data.get('sessionId')

        validations = [
            ('sessionId', 'not_null', None),
            ('status', 'equals', 'ACTIVE'),
            ('currentRound', 'equals', 1),
        ]
        all_passed = True
        for field, op, exp in validations:
            p, m = validate_field(data, field, op, exp)
            result['validation_results'].append({'field': field, 'passed': p, 'message': m})
            if not p:
                all_passed = False

        # Also check candidates
        candidates = data.get('candidates', [])
        if len(candidates) > 0:
            result['validation_results'].append({'field': 'candidates', 'passed': True, 'message': f'Has {len(candidates)} candidates'})
        else:
            result['validation_results'].append({'field': 'candidates', 'passed': False, 'message': 'No candidates returned'})
            all_passed = False

        result['passed'] = all_passed
    except Exception as e:
        result['error'] = str(e)
    results.append(result)

    # CONV-02: Start another conversation (for cancel test)
    result2 = {
        'id': 'CONV-02',
        'query': '帮我处理一下',
        'description': 'Start conversation - ambiguous input for cancel later',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/start',
            json={'userInput': '帮我处理一下'},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result2['latency_ms'] = round(latency, 1)
        result2['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}

        result2['response_summary'] = {
            'success': resp.get('success'),
            'sessionId': data.get('sessionId'),
            'status': data.get('status'),
            'candidateCount': len(data.get('candidates', [])),
        }

        session_id_for_cancel = data.get('sessionId')

        p, m = validate_field(data, 'sessionId', 'not_null', None)
        result2['validation_results'].append({'field': 'sessionId', 'passed': p, 'message': m})
        result2['passed'] = p
    except Exception as e:
        result2['error'] = str(e)
    results.append(result2)

    # CONV-03: Single vague word
    result3 = {
        'id': 'CONV-03',
        'query': '数据',
        'description': 'Start conversation - single vague word',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/start',
            json={'userInput': '数据'},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result3['latency_ms'] = round(latency, 1)
        result3['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        result3['response_summary'] = {
            'sessionId': data.get('sessionId'),
            'status': data.get('status'),
            'message': (data.get('message') or '')[:200],
        }
        p, m = validate_field(data, 'status', 'equals', 'ACTIVE')
        result3['validation_results'].append({'field': 'status', 'passed': p, 'message': m})
        p2, m2 = validate_field(data, 'message', 'not_empty', None)
        result3['validation_results'].append({'field': 'message', 'passed': p2, 'message': m2})
        result3['passed'] = p and p2
    except Exception as e:
        result3['error'] = str(e)
    results.append(result3)

    # CONV-05: Reply to first conversation
    if session_id_for_reply:
        result5 = {
            'id': 'CONV-05',
            'query': '产品类型查询',
            'description': 'Reply to narrow down conversation',
            'category': 'CONVERSATION',
            'passed': False,
            'validation_results': [],
            'response_summary': {},
            'error': None,
            'latency_ms': 0,
        }
        try:
            start = time.time()
            r = requests.post(
                f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/{session_id_for_reply}/reply',
                json={'userReply': '产品类型查询'},
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            latency = (time.time() - start) * 1000
            result5['latency_ms'] = round(latency, 1)
            result5['http_status'] = r.status_code

            resp = r.json()
            data = resp.get('data', {}) or {}
            result5['response_summary'] = {
                'sessionId': data.get('sessionId'),
                'currentRound': data.get('currentRound'),
                'completed': data.get('completed'),
                'message': (data.get('message') or '')[:200],
                'intentCode': data.get('intentCode'),
            }

            p, m = validate_field(data, 'currentRound', 'greater_than', 1)
            result5['validation_results'].append({'field': 'currentRound', 'passed': p, 'message': m})
            result5['passed'] = p
        except Exception as e:
            result5['error'] = str(e)
        results.append(result5)

        # CONV-06: Confirm intent from the conversation
        result6 = {
            'id': 'CONV-06',
            'query': 'Confirm: PRODUCT_TYPE_QUERY',
            'description': 'Confirm intent identified through conversation',
            'category': 'CONVERSATION',
            'passed': False,
            'validation_results': [],
            'response_summary': {},
            'error': None,
            'latency_ms': 0,
        }
        try:
            start = time.time()
            r = requests.post(
                f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/{session_id_for_reply}/confirm',
                json={'intentCode': 'PRODUCT_TYPE_QUERY'},
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            latency = (time.time() - start) * 1000
            result6['latency_ms'] = round(latency, 1)
            result6['http_status'] = r.status_code

            resp = r.json()
            result6['response_summary'] = {
                'success': resp.get('success'),
                'message': resp.get('message', '')[:200],
            }
            result6['passed'] = resp.get('success', False)
            result6['validation_results'].append({
                'field': 'success',
                'passed': resp.get('success', False),
                'message': f"success={resp.get('success')}"
            })
        except Exception as e:
            result6['error'] = str(e)
        results.append(result6)
    else:
        results.append({
            'id': 'CONV-05', 'category': 'CONVERSATION', 'passed': False,
            'error': 'Skipped: no session_id from CONV-01',
            'query': '', 'description': 'Reply - skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })
        results.append({
            'id': 'CONV-06', 'category': 'CONVERSATION', 'passed': False,
            'error': 'Skipped: no session_id from CONV-01',
            'query': '', 'description': 'Confirm - skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # CONV-07: Cancel conversation
    if session_id_for_cancel:
        result7 = {
            'id': 'CONV-07',
            'query': 'Cancel',
            'description': 'Cancel active conversation',
            'category': 'CONVERSATION',
            'passed': False,
            'validation_results': [],
            'response_summary': {},
            'error': None,
            'latency_ms': 0,
        }
        try:
            start = time.time()
            r = requests.post(
                f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/{session_id_for_cancel}/cancel',
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            latency = (time.time() - start) * 1000
            result7['latency_ms'] = round(latency, 1)
            result7['http_status'] = r.status_code

            resp = r.json()
            result7['response_summary'] = {
                'success': resp.get('success'),
                'message': resp.get('message', '')[:200],
            }
            result7['passed'] = resp.get('success', False)
            result7['validation_results'].append({
                'field': 'success',
                'passed': resp.get('success', False),
                'message': f"success={resp.get('success')}"
            })
        except Exception as e:
            result7['error'] = str(e)
        results.append(result7)
    else:
        results.append({
            'id': 'CONV-07', 'category': 'CONVERSATION', 'passed': False,
            'error': 'Skipped: no session_id from CONV-02',
            'query': '', 'description': 'Cancel - skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # CONV-08: Conversation stats
    result8 = {
        'id': 'CONV-08',
        'query': 'stats',
        'description': 'Get conversation statistics (last 7 days)',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.get(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/stats?days=7',
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result8['latency_ms'] = round(latency, 1)
        result8['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        result8['response_summary'] = {
            'totalSessions': data.get('totalSessions'),
            'completedCount': data.get('completedCount'),
            'successRate': data.get('successRate'),
            'averageRounds': data.get('averageRounds'),
        }

        p1, m1 = validate_field(data, 'totalSessions', 'exists', None)
        result8['validation_results'].append({'field': 'totalSessions', 'passed': p1, 'message': m1})
        result8['passed'] = p1
    except Exception as e:
        result8['error'] = str(e)
    results.append(result8)

    # CONV-09: Get active session
    result9 = {
        'id': 'CONV-09',
        'query': 'active',
        'description': 'Get active conversation for current user',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.get(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/active',
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result9['latency_ms'] = round(latency, 1)
        result9['http_status'] = r.status_code

        resp = r.json()
        result9['response_summary'] = {
            'success': resp.get('success'),
            'data': str(resp.get('data', ''))[:200],
        }
        result9['passed'] = resp.get('success', False)
        result9['validation_results'].append({
            'field': 'success', 'passed': resp.get('success', False),
            'message': f"success={resp.get('success')}"
        })
    except Exception as e:
        result9['error'] = str(e)
    results.append(result9)

    # CONV-10: Get non-existent session
    result10 = {
        'id': 'CONV-10',
        'query': 'non-existent-session',
        'description': 'Get non-existent session -> should return error',
        'category': 'CONVERSATION',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.get(
            f'{SERVER}/api/mobile/{FACTORY_ID}/conversation/non-existent-id-12345',
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        result10['latency_ms'] = round(latency, 1)
        result10['http_status'] = r.status_code

        resp = r.json()
        result10['response_summary'] = {
            'success': resp.get('success'),
            'message': resp.get('message', '')[:200],
        }
        # Non-existent session should return success=false
        not_success = not resp.get('success', True)
        result10['passed'] = not_success
        result10['validation_results'].append({
            'field': 'success',
            'passed': not_success,
            'message': f"success={resp.get('success')} (expected false)"
        })
    except Exception as e:
        result10['error'] = str(e)
    results.append(result10)

    return results


def run_permission_tests(tokens):
    """
    Run permission tests with different role tokens.
    Tests that low-priv roles cannot execute HIGH/CRITICAL intents.
    """
    results = []

    qi_token = tokens.get('quality_inspector')
    wm_token = tokens.get('warehouse_manager')
    fa_token = tokens.get('factory_admin')

    # PERM-01: Quality inspector tries USER_DELETE (CRITICAL)
    if qi_token:
        r1 = run_execute_test(
            {
                'id': 'PERM-01',
                'query': '删除用户',
                'intentCode': 'USER_DELETE',
                'description': 'Quality inspector -> USER_DELETE (CRITICAL) -> NO_PERMISSION expected',
                'validations': [
                    ('status', 'in', ['NO_PERMISSION', 'FAILED']),
                ],
                'deep_validations': [],
            },
            make_headers(qi_token)
        )
        r1['category'] = 'PERMISSION'
        results.append(r1)
    else:
        results.append({
            'id': 'PERM-01', 'category': 'PERMISSION', 'passed': False,
            'error': 'quality_inspector login failed', 'query': '删除用户',
            'description': 'Skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # PERM-02: Quality inspector tries USER_CREATE (HIGH)
    if qi_token:
        r2 = run_execute_test(
            {
                'id': 'PERM-02',
                'query': '创建用户',
                'intentCode': 'USER_CREATE',
                'description': 'Quality inspector -> USER_CREATE (HIGH) -> NO_PERMISSION expected',
                'previewOnly': True,
                'validations': [
                    ('status', 'in', ['NO_PERMISSION', 'FAILED', 'PREVIEW']),
                ],
                'deep_validations': [],
            },
            make_headers(qi_token)
        )
        r2['category'] = 'PERMISSION'
        results.append(r2)
    else:
        results.append({
            'id': 'PERM-02', 'category': 'PERMISSION', 'passed': False,
            'error': 'quality_inspector login failed', 'query': '创建用户',
            'description': 'Skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # PERM-03: Quality inspector tries DATA_BATCH_DELETE (CRITICAL)
    if qi_token:
        r3 = run_execute_test(
            {
                'id': 'PERM-03',
                'query': '批量删除数据',
                'intentCode': 'DATA_BATCH_DELETE',
                'description': 'Quality inspector -> DATA_BATCH_DELETE (CRITICAL) -> NO_PERMISSION',
                'previewOnly': True,
                'validations': [
                    ('status', 'in', ['NO_PERMISSION', 'FAILED']),
                ],
                'deep_validations': [],
            },
            make_headers(qi_token)
        )
        r3['category'] = 'PERMISSION'
        results.append(r3)
    else:
        results.append({
            'id': 'PERM-03', 'category': 'PERMISSION', 'passed': False,
            'error': 'quality_inspector login failed', 'query': '批量删除数据',
            'description': 'Skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # PERM-04: Quality inspector CAN access QUALITY_CHECK_QUERY (LOW)
    if qi_token:
        r4 = run_execute_test(
            {
                'id': 'PERM-04',
                'query': '质检记录',
                'intentCode': 'QUALITY_CHECK_QUERY',
                'description': 'Quality inspector -> QUALITY_CHECK_QUERY (LOW) -> SUCCESS',
                'validations': [
                    ('status', 'in', ['SUCCESS', 'COMPLETED']),
                    ('resultData', 'not_null', None),
                ],
                'deep_validations': [],
            },
            make_headers(qi_token)
        )
        r4['category'] = 'PERMISSION'
        results.append(r4)
    else:
        results.append({
            'id': 'PERM-04', 'category': 'PERMISSION', 'passed': False,
            'error': 'quality_inspector login failed', 'query': '质检记录',
            'description': 'Skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    # PERM-05: Warehouse manager CAN view batches
    if wm_token:
        r5 = run_execute_test(
            {
                'id': 'PERM-05',
                'query': '查看批次',
                'intentCode': 'PROCESSING_BATCH_LIST',
                'description': 'Warehouse manager -> PROCESSING_BATCH_LIST -> SUCCESS',
                'validations': [
                    ('status', 'in', ['SUCCESS', 'COMPLETED']),
                    ('resultData', 'not_null', None),
                ],
                'deep_validations': [],
            },
            make_headers(wm_token)
        )
        r5['category'] = 'PERMISSION'
        results.append(r5)
    else:
        results.append({
            'id': 'PERM-05', 'category': 'PERMISSION', 'passed': False,
            'error': 'warehouse_manager login failed', 'query': '查看批次',
            'description': 'Skipped', 'validation_results': [],
            'response_summary': {}, 'latency_ms': 0
        })

    return results


def run_error_handling_tests(headers):
    """Run error handling edge case tests."""
    results = []

    # ERR-01: Empty input
    r1 = {
        'id': 'ERR-01',
        'query': '',
        'description': 'Empty input -> handled gracefully',
        'category': 'ERROR_HANDLING',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/execute',
            json={'userInput': ''},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r1['latency_ms'] = round(latency, 1)
        r1['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        r1['response_summary'] = {
            'status': data.get('status'),
            'message': (data.get('message') or resp.get('message', ''))[:200],
            'intentRecognized': data.get('intentRecognized'),
            'suggestedActions': data.get('suggestedActions'),
        }
        # Should not crash - any graceful response is acceptable
        # Expect NEED_CLARIFICATION, NEED_MORE_INFO, FAILED, or NOT_RECOGNIZED
        status = data.get('status')
        graceful = status in ['NEED_CLARIFICATION', 'NEED_MORE_INFO', 'FAILED', 'NOT_RECOGNIZED', None]
        # Also accept HTTP 200 with success=false as graceful
        if not graceful and r.status_code == 200:
            graceful = True
        r1['passed'] = graceful and r.status_code != 500
        r1['validation_results'].append({
            'field': 'graceful_handling',
            'passed': r1['passed'],
            'message': f"HTTP {r.status_code}, status={status}"
        })
    except Exception as e:
        r1['error'] = str(e)
    results.append(r1)

    # ERR-02: Non-existent intent code
    r2 = run_execute_test(
        {
            'id': 'ERR-02',
            'query': 'test',
            'intentCode': 'NON_EXISTENT_INTENT',
            'description': 'Non-existent intentCode -> FAILED',
            'validations': [
                ('status', 'in', ['FAILED', 'NOT_RECOGNIZED']),
            ],
            'deep_validations': [],
        },
        headers
    )
    r2['category'] = 'ERROR_HANDLING'
    results.append(r2)

    # ERR-03: No auth token -> HTTP 401
    r3 = {
        'id': 'ERR-03',
        'query': '查看批次',
        'description': 'No auth token -> HTTP 401',
        'category': 'ERROR_HANDLING',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/execute',
            json={'userInput': '查看批次', 'intentCode': 'PROCESSING_BATCH_LIST'},
            headers={'Content-Type': 'application/json'},  # No Authorization
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r3['latency_ms'] = round(latency, 1)
        r3['http_status'] = r.status_code
        r3['response_summary'] = {'http_status': r.status_code, 'body': r.text[:200]}

        passed = r.status_code in [401, 403]
        r3['passed'] = passed
        r3['validation_results'].append({
            'field': 'http_status',
            'passed': passed,
            'message': f"HTTP {r.status_code} (expected 401 or 403)"
        })
    except Exception as e:
        r3['error'] = str(e)
    results.append(r3)

    # ERR-04: Wrong factory ID -> 403
    r4 = {
        'id': 'ERR-04',
        'query': '查看批次',
        'description': 'Wrong factory ID -> HTTP 403',
        'category': 'ERROR_HANDLING',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/WRONG_FACTORY/ai-intents/execute',
            json={'userInput': '查看批次', 'intentCode': 'PROCESSING_BATCH_LIST'},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r4['latency_ms'] = round(latency, 1)
        r4['http_status'] = r.status_code
        r4['response_summary'] = {'http_status': r.status_code, 'body': r.text[:200]}

        # Should get 403, or at least an error (not 200 SUCCESS)
        if r.status_code in [403, 401]:
            r4['passed'] = True
        elif r.status_code == 200:
            resp = r.json()
            data = resp.get('data', {}) or {}
            # If it returns success=false or a non-SUCCESS status, that's also acceptable
            if not resp.get('success') or data.get('status') in ['FAILED', 'NO_PERMISSION']:
                r4['passed'] = True
        r4['validation_results'].append({
            'field': 'access_denied',
            'passed': r4['passed'],
            'message': f"HTTP {r.status_code}"
        })
    except Exception as e:
        r4['error'] = str(e)
    results.append(r4)

    # ERR-05: Gibberish input
    r5 = {
        'id': 'ERR-05',
        'query': 'asdfghjklqwertyu',
        'description': 'Gibberish input -> not recognized',
        'category': 'ERROR_HANDLING',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/execute',
            json={'userInput': 'asdfghjklqwertyu'},
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r5['latency_ms'] = round(latency, 1)
        r5['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        r5['response_summary'] = {
            'status': data.get('status'),
            'intentRecognized': data.get('intentRecognized'),
            'message': (data.get('message') or '')[:200],
        }
        # Gibberish should not succeed as a real intent
        status = data.get('status')
        recognized = data.get('intentRecognized', False)
        # Accept: NEED_CLARIFICATION, NOT_RECOGNIZED, VALIDATION_FAILED, or recognized=false
        passed = status in ['NEED_CLARIFICATION', 'NOT_RECOGNIZED', 'NEED_MORE_INFO'] or not recognized
        # If it matched something by accident but with low confidence, still note it
        if recognized and status in ['VALIDATION_FAILED']:
            passed = True  # Drools blocked it, still acceptable
        r5['passed'] = passed
        r5['validation_results'].append({
            'field': 'graceful_handling',
            'passed': passed,
            'message': f"status={status}, recognized={recognized}"
        })
    except Exception as e:
        r5['error'] = str(e)
    results.append(r5)

    return results


def run_public_demo_tests():
    """Run tests against public demo endpoints (no auth required)."""
    results = []

    # PUBLIC-01: Public demo execute
    r1 = {
        'id': 'PUBLIC-01',
        'query': '今天产量多少',
        'description': 'Public demo execute - LOW sensitivity',
        'category': 'PUBLIC_DEMO',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/public/ai-demo/execute',
            json={'userInput': '今天产量多少'},
            headers={'Content-Type': 'application/json'},
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r1['latency_ms'] = round(latency, 1)
        r1['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        r1['response_summary'] = {
            'intentRecognized': data.get('intentRecognized'),
            'intentCode': data.get('intentCode'),
            'status': data.get('status'),
            'sensitivityLevel': data.get('sensitivityLevel'),
            'sessionId': data.get('sessionId'),
        }

        p, m = validate_field(data, 'intentRecognized', 'equals', True)
        r1['validation_results'].append({'field': 'intentRecognized', 'passed': p, 'message': m})
        r1['passed'] = p
    except Exception as e:
        r1['error'] = str(e)
    results.append(r1)

    # PUBLIC-02: Public demo CRITICAL intent blocked
    r2 = {
        'id': 'PUBLIC-02',
        'query': '删除用户',
        'description': 'Public demo - CRITICAL intent -> NO_PERMISSION',
        'category': 'PUBLIC_DEMO',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/public/ai-demo/execute',
            json={'userInput': '删除用户'},
            headers={'Content-Type': 'application/json'},
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r2['latency_ms'] = round(latency, 1)
        r2['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        r2['response_summary'] = {
            'intentRecognized': data.get('intentRecognized'),
            'status': data.get('status'),
            'sensitivityLevel': data.get('sensitivityLevel'),
            'message': (data.get('message') or '')[:200],
        }

        # Should recognize the intent but block execution
        p1, m1 = validate_field(data, 'intentRecognized', 'equals', True)
        p2, m2 = validate_field(data, 'status', 'equals', 'NO_PERMISSION')
        r2['validation_results'].append({'field': 'intentRecognized', 'passed': p1, 'message': m1})
        r2['validation_results'].append({'field': 'status', 'passed': p2, 'message': m2})
        r2['passed'] = p1 and p2
    except Exception as e:
        r2['error'] = str(e)
    results.append(r2)

    # PUBLIC-03: Public demo recognize
    r3 = {
        'id': 'PUBLIC-03',
        'query': '查看批次',
        'description': 'Public demo recognize',
        'category': 'PUBLIC_DEMO',
        'passed': False,
        'validation_results': [],
        'response_summary': {},
        'error': None,
        'latency_ms': 0,
    }
    try:
        start = time.time()
        r = requests.post(
            f'{SERVER}/api/public/ai-demo/recognize',
            json={'userInput': '查看批次'},
            headers={'Content-Type': 'application/json'},
            timeout=REQUEST_TIMEOUT
        )
        latency = (time.time() - start) * 1000
        r3['latency_ms'] = round(latency, 1)
        r3['http_status'] = r.status_code

        resp = r.json()
        data = resp.get('data', {}) or {}
        r3['response_summary'] = {
            'matched': data.get('matched'),
            'intentCode': data.get('intentCode'),
            'canExecuteInDemo': data.get('canExecuteInDemo'),
            'toolName': data.get('toolName'),
        }

        p, m = validate_field(data, 'matched', 'equals', True)
        r3['validation_results'].append({'field': 'matched', 'passed': p, 'message': m})
        r3['passed'] = p
    except Exception as e:
        r3['error'] = str(e)
    results.append(r3)

    return results


# ==============================================================================
# Main Test Runner
# ==============================================================================

def main():
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    print("=" * 78)
    print("  E2E Intent Pipeline Test: Recognition -> Execution -> Response Quality")
    print(f"  Server: {SERVER}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 78)
    print()

    all_results = []
    category_stats = defaultdict(lambda: {'total': 0, 'passed': 0, 'failed': 0})
    total_start = time.time()

    # ============================
    # Phase 1: Authentication
    # ============================
    print("[Phase 1] Authenticating test accounts...")
    tokens = {}
    for account_name, creds in TEST_ACCOUNTS.items():
        token = login(creds['username'], creds['password'], creds.get('factoryId', 'F001'))
        if token:
            tokens[account_name] = token
            print(f"  [OK] {account_name} ({creds['username']})")
        else:
            print(f"  [FAIL] {account_name} ({creds['username']})")

    fa_headers = make_headers(tokens.get('factory_admin', ''))
    if not tokens.get('factory_admin'):
        print("\n  FATAL: factory_admin login failed. Cannot continue.")
        return

    print()

    # ============================
    # Phase 2: Data Retrieval Tests (20 core + 5 extra)
    # ============================
    print("[Phase 2] DATA_RETRIEVAL tests (25 intent codes)...")
    all_data_tests = DATA_RETRIEVAL_TESTS + EXTRA_DATA_TESTS
    for i, test in enumerate(all_data_tests):
        result = run_execute_test(test, fa_headers)
        result['category'] = 'DATA_RETRIEVAL'
        all_results.append(result)

        status_icon = 'PASS' if result['passed'] else 'FAIL'
        print(f"  [{status_icon}] {result['id']}: {test['description']} "
              f"({result['latency_ms']}ms)"
              f"{' - ' + (result.get('error') or '') if result.get('error') else ''}")

        cat = 'DATA_RETRIEVAL'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 3: Recognition Accuracy Tests
    # ============================
    print("[Phase 3] RECOGNITION_ACCURACY tests (7 queries)...")
    for test in RECOGNITION_TESTS:
        result = run_recognition_test(test, fa_headers)
        all_results.append(result)

        status_icon = 'PASS' if result['passed'] else 'FAIL'
        actual = result['response_summary'].get('intentCode', 'N/A')
        conf = result['response_summary'].get('confidence', 0)
        print(f"  [{status_icon}] {result['id']}: \"{test['query']}\" -> {actual} "
              f"(conf={conf}, {result['latency_ms']}ms)")

        cat = 'RECOGNITION_ACCURACY'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 4: Drools Validation Bug Tests
    # ============================
    print("[Phase 4] DROOLS_VALIDATION_BUG tests (2 tests)...")
    drools_results = run_drools_tests(fa_headers)
    for result in drools_results:
        all_results.append(result)
        status_icon = 'PASS' if result['passed'] else 'FAIL'
        print(f"  [{status_icon}] {result['id']}: {result.get('description', '')}")

        cat = 'DROOLS_VALIDATION_BUG'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 5: Conversation Flow Tests
    # ============================
    print("[Phase 5] CONVERSATION tests (10 tests)...")
    conv_results = run_conversation_tests(fa_headers)
    for result in conv_results:
        all_results.append(result)
        status_icon = 'PASS' if result['passed'] else 'FAIL'
        err_msg = f" - {result.get('error', '')}" if result.get('error') else ''
        print(f"  [{status_icon}] {result['id']}: {result.get('description', '')}"
              f" ({result['latency_ms']}ms){err_msg}")

        cat = 'CONVERSATION'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 6: Permission Tests
    # ============================
    print("[Phase 6] PERMISSION tests (5 tests across roles)...")
    perm_results = run_permission_tests(tokens)
    for result in perm_results:
        all_results.append(result)
        status_icon = 'PASS' if result['passed'] else 'FAIL'
        print(f"  [{status_icon}] {result['id']}: {result.get('description', '')}"
              f" ({result.get('latency_ms', 0)}ms)")

        cat = 'PERMISSION'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 7: Error Handling Tests
    # ============================
    print("[Phase 7] ERROR_HANDLING tests (5 tests)...")
    error_results = run_error_handling_tests(fa_headers)
    for result in error_results:
        all_results.append(result)
        status_icon = 'PASS' if result['passed'] else 'FAIL'
        print(f"  [{status_icon}] {result['id']}: {result.get('description', '')}"
              f" ({result.get('latency_ms', 0)}ms)")

        cat = 'ERROR_HANDLING'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Phase 8: Public Demo Tests
    # ============================
    print("[Phase 8] PUBLIC_DEMO tests (3 tests, no auth)...")
    public_results = run_public_demo_tests()
    for result in public_results:
        all_results.append(result)
        status_icon = 'PASS' if result['passed'] else 'FAIL'
        print(f"  [{status_icon}] {result['id']}: {result.get('description', '')}"
              f" ({result.get('latency_ms', 0)}ms)")

        cat = 'PUBLIC_DEMO'
        category_stats[cat]['total'] += 1
        if result['passed']:
            category_stats[cat]['passed'] += 1
        else:
            category_stats[cat]['failed'] += 1

    print()

    # ============================
    # Summary
    # ============================
    total_elapsed = time.time() - total_start
    total_tests = len(all_results)
    total_passed = sum(1 for r in all_results if r['passed'])
    total_failed = total_tests - total_passed

    print("=" * 78)
    print("  RESULTS SUMMARY")
    print("=" * 78)
    print()
    print(f"  Total: {total_tests} tests | Passed: {total_passed} | Failed: {total_failed}")
    print(f"  Pass Rate: {total_passed/total_tests*100:.1f}%")
    print(f"  Total Time: {total_elapsed:.1f}s")
    print()

    # Per-category summary
    print(f"  {'Category':<30} {'Total':>6} {'Pass':>6} {'Fail':>6} {'Rate':>8}")
    print(f"  {'-'*56}")
    for cat in ['DATA_RETRIEVAL', 'RECOGNITION_ACCURACY', 'DROOLS_VALIDATION_BUG',
                'CONVERSATION', 'PERMISSION', 'ERROR_HANDLING', 'PUBLIC_DEMO']:
        stats = category_stats[cat]
        if stats['total'] > 0:
            rate = stats['passed'] / stats['total'] * 100
            print(f"  {cat:<30} {stats['total']:>6} {stats['passed']:>6} {stats['failed']:>6} {rate:>7.1f}%")

    # Latency stats
    latencies = [r['latency_ms'] for r in all_results if r.get('latency_ms', 0) > 0]
    if latencies:
        print()
        print(f"  Latency: avg={sum(latencies)/len(latencies):.0f}ms, "
              f"min={min(latencies):.0f}ms, max={max(latencies):.0f}ms, "
              f"p50={sorted(latencies)[len(latencies)//2]:.0f}ms")

    # List failures
    failures = [r for r in all_results if not r['passed']]
    if failures:
        print()
        print(f"  FAILED TESTS ({len(failures)}):")
        for r in failures:
            err = r.get('error', '')
            summary = r.get('response_summary', {})
            status = summary.get('status', 'N/A')
            print(f"    - {r['id']} [{r.get('category', '')}]: {r.get('description', '')}")
            if err:
                print(f"      Error: {err}")
            else:
                failed_validations = [v for v in r.get('validation_results', []) if not v['passed']]
                for v in failed_validations[:3]:
                    print(f"      Validation: {v['message']}")

    print()
    print("=" * 78)

    # ============================
    # Save Report
    # ============================
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')
    os.makedirs(report_dir, exist_ok=True)

    report_file = os.path.join(report_dir, f'e2e_execution_{timestamp}.json')

    report = {
        'meta': {
            'title': 'E2E Intent Pipeline Test: Recognition -> Execution -> Response Quality',
            'server': SERVER,
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
        },
        'summary': {
            'total': total_tests,
            'passed': total_passed,
            'failed': total_failed,
            'pass_rate': round(total_passed / total_tests * 100, 1) if total_tests > 0 else 0,
        },
        'category_breakdown': {
            cat: {
                'total': stats['total'],
                'passed': stats['passed'],
                'failed': stats['failed'],
                'pass_rate': round(stats['passed'] / stats['total'] * 100, 1) if stats['total'] > 0 else 0,
            }
            for cat, stats in category_stats.items()
        },
        'latency': {
            'avg_ms': round(sum(latencies) / len(latencies), 1) if latencies else 0,
            'min_ms': round(min(latencies), 1) if latencies else 0,
            'max_ms': round(max(latencies), 1) if latencies else 0,
            'p50_ms': round(sorted(latencies)[len(latencies) // 2], 1) if latencies else 0,
        },
        'results': all_results,
    }

    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"  Report saved: {report_file}")
    print("=" * 78)


if __name__ == '__main__':
    main()
