#!/usr/bin/env python3
"""Quick test for question pattern detection"""

import requests
import json

BASE_URL = "http://139.196.165.140:10010"

# Test cases for question patterns
QUESTION_TESTS = [
    ("东西发出去没有", "SHIPMENT_QUERY"),    # 疑问句结尾"没有"
    ("机器还转着吗", "EQUIPMENT_STATUS"),     # 疑问句结尾"吗"
    ("谁还没打卡", "ATTENDANCE_QUERY"),       # 疑问句"谁..."开头
    ("库存够不够啊", "MATERIAL_BATCH_QUERY"), # 疑问句"够不够"
    ("质量过关吗", "QUALITY_CHECK_QUERY"),    # 疑问句"吗"结尾
    ("客户那边催没催", "CUSTOMER_QUERY"),     # 疑问句"没催"
]

def get_token():
    resp = requests.post(
        f"{BASE_URL}/api/mobile/auth/unified-login",
        json={"username": "factory_admin1", "password": "123456"},
        timeout=30
    )
    data = resp.json()
    if data.get("success") and data.get("data", {}).get("accessToken"):
        return data["data"]["accessToken"]
    raise Exception(f"Login failed: {data}")

def test_intent(token, query, session_id):
    try:
        resp = requests.post(
            f"{BASE_URL}/api/mobile/F001/ai-intents/execute",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            json={"userInput": query, "sessionId": session_id},
            timeout=35
        )
        data = resp.json()
        if data.get("success") and data.get("data"):
            return data["data"].get("intentCode")
        return None
    except Exception as e:
        return f"ERROR:{e}"

def main():
    print("获取Token...")
    token = get_token()
    print("Token获取成功")
    print()
    print("测试疑问句检测...")
    print()

    passed = 0
    failed = 0

    for i, (query, expected) in enumerate(QUESTION_TESTS, 1):
        actual = test_intent(token, query, f"qtest-{i}")
        if actual == expected:
            print(f"[{i}] {query}... ✅ ({actual})")
            passed += 1
        else:
            print(f"[{i}] {query}... ❌ ({actual} vs {expected})")
            failed += 1

    print()
    print(f"结果: {passed}/{len(QUESTION_TESTS)} 通过")

if __name__ == "__main__":
    main()
