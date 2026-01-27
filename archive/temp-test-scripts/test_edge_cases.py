import requests
import json

login_resp = requests.post('http://139.196.165.140:10010/api/mobile/auth/unified-login',
    json={'username': 'factory_admin1', 'password': '123456'}, timeout=30)
token = login_resp.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# 边界案例测试 - 可能被误匹配的场景
edge_cases = [
    # (输入, 期望意图, 说明)
    ('销售员信息', 'USER_SEARCH', '不应该匹配到销售报表'),
    ('销售部门考勤', 'ATTENDANCE_DEPARTMENT', '应该是考勤'),
    ('今天设备状态', 'EQUIPMENT_STATUS_QUERY', '应该是设备'),
    ('库存管理员', 'USER_SEARCH', '不应该匹配到库存报表'),
    ('生产线员工', 'USER_SEARCH', '不应该匹配到生产报表'),
    ('质检员考勤', 'ATTENDANCE_HISTORY', '应该是考勤'),
    ('销售情况', 'REPORT_DASHBOARD_OVERVIEW', '应该是销售报表'),
    ('设备维修记录', 'EQUIPMENT_MAINTENANCE', '应该是设备维护'),
    ('今天销售', 'REPORT_DASHBOARD_OVERVIEW', '应该是销售报表'),
    ('销售今天', 'REPORT_DASHBOARD_OVERVIEW', '应该是销售报表'),
]

print("=== 边界案例测试 ===\n")
correct = 0
wrong = []

for inp, expected, note in edge_cases:
    resp = requests.post('http://139.196.165.140:10010/api/mobile/F001/ai-intents/recognize',
        json={'userInput': inp}, headers=headers, timeout=60)
    data = resp.json().get('data', {})
    actual = data.get('intentCode')
    method = data.get('matchMethod')
    conf = data.get('confidence', 0)

    is_correct = actual == expected or (expected == 'USER_SEARCH' and 'USER' in str(actual))
    status = 'OK' if is_correct else 'WRONG'
    if is_correct:
        correct += 1
    else:
        wrong.append((inp, expected, actual, method))

    print(f"[{status}] {inp}")
    print(f"  -> {actual} ({method}, {conf})")
    print(f"  期望: {expected} | {note}")
    print()

print(f"\n=== 结果: {correct}/{len(edge_cases)} ===")
if wrong:
    print("\n误匹配列表:")
    for inp, exp, act, meth in wrong:
        print(f"  {inp}: {act} (应为 {exp}) [{meth}]")
