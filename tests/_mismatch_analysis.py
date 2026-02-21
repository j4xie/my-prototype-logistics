#!/usr/bin/env python3
"""Analyze Phase 1 routing mismatches — precise diagnostic."""
import sys, json, requests, time
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://47.100.235.168:10010'

# Login
resp = requests.post(f'{BASE}/api/mobile/auth/unified-login',
    json={'username': 'factory_admin1', 'password': '123456'})
token = resp.json()['data']['token']
headers = {'Authorization': f'Bearer {token}'}

def recognize(q):
    try:
        r = requests.post(f'{BASE}/api/mobile/F001/ai-intents/recognize',
                         json={'userInput': q}, headers=headers, timeout=15)
        data = r.json().get('data', {}) or {}
        return {
            'matched': data.get('matched', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'method': str(data.get('matchMethod') or '?'),
            'confidence': data.get('confidence', 0),
        }
    except:
        return {'matched': False, 'intent': 'ERROR', 'method': '?', 'confidence': 0}

# Test specific failure-prone groups from old series (that DON'T include N/A)
# These are cases where the system matched to WRONG intent
samples = [
    # B1: Production (expected PRODUCTION_QUERY|PRODUCTION_SUMMARY)
    ("B1", "今天产量多少", "PRODUCTION_QUERY|PRODUCTION_SUMMARY"),
    ("B1", "查看产线的绩效", "PRODUCTION_QUERY|PRODUCTION_SUMMARY|PRODUCTION_EFFICIENCY|REPORT_EFFICIENCY"),
    # B5: Inventory
    ("B5", "查看产线的绩效", "PRODUCTION_QUERY|PRODUCTION_EFFICIENCY|REPORT_EFFICIENCY"),
    # D6: Purchase
    ("D6", "采购订单创建", "ORDER_CREATE|PROCUREMENT_CREATE|ORDER_NEW"),
    # F1: Shipment
    ("F1", "标记订单为已检验", "QUALITY_BATCH_MARK_AS_INSPECTED|QUALITY_CHECK_EXECUTE"),
    # H1: Cost
    ("H1", "毛利率是多少", "COST_QUERY|FINANCE_STATS|PROFIT_TREND_ANALYSIS|REPORT_KPI"),
    # H6: Shipment write
    ("H6", "下一批出货什么时候", "SHIPMENT_QUERY|SHIPMENT_BY_DATE"),
    # J1: Comparison
    ("J1", "这个产品的成本对比", "COST_TREND_ANALYSIS|COST_QUERY|PRODUCT_SALES_RANKING"),
    # M1: Multi-intent (out of domain)
    ("M1", "这房子能住吗", "N/A|OUT_OF_DOMAIN"),
    ("M1", "今天天气怎么样", "N/A|OUT_OF_DOMAIN"),
    ("M1", "帮我叫一辆出租车", "N/A|OUT_OF_DOMAIN"),
    # T1: Override edge
    ("T1", "注册信息查询", "USER_QUERY|SYSTEM_INFO_QUERY|CONFIG_QUERY"),
    ("T1", "发货时间是什么时候", "SHIPMENT_QUERY|SHIPMENT_STATUS|SHIPMENT_BY_DATE"),
    # N1: Complex embedded
    ("N1", "招聘80个工人", "HR_RECRUIT|HR_QUERY|QUERY_EMPLOYEE_PROFILE"),
    ("N1", "三号冷库温度", "COLD_CHAIN_TEMPERATURE|EQUIPMENT_STATUS_QUERY"),
]

print("=" * 110)
print("Focused Mismatch Analysis — Failure-prone groups")
print("=" * 110)

for group, query, expected_str in samples:
    result = recognize(query)
    intent = str(result.get('intent') or 'N/A')
    matched = bool(result.get('matched'))
    method = str(result.get('method') or '?')
    conf = float(result.get('confidence') or 0)

    exp_intents = expected_str.split('|')
    intent_ok = (matched and any(intent == ei or intent.startswith(ei) for ei in exp_intents)) or \
                (not matched and 'N/A' in exp_intents)

    mark = 'V' if intent_ok else 'X'
    m_str = 'M' if matched else 'U'
    print(f"  {mark} [{group:5s}] {m_str} got={intent:35s} {method:15s} {conf:.2f}")
    print(f"         expected: {expected_str}")
    print(f"         query: {query}")
    time.sleep(0.3)

print()
print("Legend: V=correct, X=wrong, M=matched, U=unmatched")
