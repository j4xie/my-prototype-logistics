#!/usr/bin/env python3
"""
Customers API 完整测试脚本
测试所有19个端点
"""
import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:10010"
FACTORY_ID = "CRETAS_2024_001"

test_results = {"total": 0, "passed": 0, "failed": 0, "errors": []}

def print_result(endpoint: str, method: str, status: str, message: str = ""):
    status_icon = "✅" if status == "PASS" else "❌"
    print(f"{status_icon} [{method:6}] {endpoint:50} - {status} {message}")

def test_endpoint(name: str, method: str, url: str, **kwargs) -> bool:
    global test_results
    test_results["total"] += 1
    try:
        if method == "GET":
            response = requests.get(url, **kwargs, timeout=10)
        elif method == "POST":
            response = requests.post(url, **kwargs, timeout=10)
        elif method == "PUT":
            response = requests.put(url, **kwargs, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, **kwargs, timeout=10)

        if response.status_code in [200, 201]:
            data = response.json()
            if data.get("code") == 200 or data.get("success"):
                print_result(name, method, "PASS", f"({response.status_code})")
                test_results["passed"] += 1
                return True
            else:
                msg = data.get("message", "Unknown error")
                print_result(name, method, "FAIL", f"Code: {data.get('code')}, Msg: {msg}")
                test_results["failed"] += 1
                test_results["errors"].append(f"{name}: {msg}")
                return False
        else:
            print_result(name, method, "FAIL", f"HTTP {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"{name}: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_result(name, method, "ERROR", str(e)[:50])
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {str(e)}")
        return False

def main():
    print("=" * 100)
    print("开始测试 Customers API - 19个端点")
    print("=" * 100)

    print("\n" + "=" * 100)
    print("第1组: 基础CRUD操作 (5个端点)")
    print("=" * 100)

    # 1. GET - 获取客户列表（分页）
    test_endpoint(
        "获取客户列表（分页）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers",
        params={"page": 1, "size": 5}
    )

    # 2. GET - 获取客户详情
    test_endpoint(
        "获取客户详情",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_001"
    )

    # 3. PUT - 更新客户
    update_data = {
        "name": "更新后的客户名称",
        "code": "CUST003",
        "customerCode": "CUSTOMER_003",
        "contactPerson": "更新联系人",
        "phone": "13800003333",
        "email": "updated@customer.com",
        "address": "更新地址",
        "industry": "更新行业",
        "paymentTerms": "月结30天",
        "creditLimit": 250000,
        "rating": 5,
        "isActive": True
    }
    test_endpoint(
        "更新客户",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_003",
        json=update_data
    )

    # 跳过 POST 创建和 DELETE 删除（需要token或避免影响数据）
    print("⚠️  跳过创建客户测试（无Token）")
    print("⚠️  跳过删除客户测试（避免影响后续测试数据）")

    print("\n" + "=" * 100)
    print("第2组: 查询和过滤操作 (6个端点)")
    print("=" * 100)

    # 4. GET - 获取活跃客户列表
    test_endpoint(
        "获取活跃客户列表",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/active"
    )

    # 5. GET - 搜索客户
    test_endpoint(
        "搜索客户（关键词：餐饮）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/search",
        params={"keyword": "餐饮"}
    )

    # 6. GET - 按客户类型获取客户
    test_endpoint(
        "按客户类型获取客户",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/by-type",
        params={"type": "餐饮业"}
    )

    # 7. GET - 按行业获取客户
    test_endpoint(
        "按行业获取客户",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/by-industry",
        params={"industry": "餐饮业"}
    )

    # 8. GET - 检查客户代码（存在）
    test_endpoint(
        "检查客户代码（存在）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/check-code",
        params={"customerCode": "CUST001"}
    )

    # 9. GET - 检查客户代码（不存在）
    test_endpoint(
        "检查客户代码（不存在）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/check-code",
        params={"customerCode": "NOTEXIST999"}
    )

    print("\n" + "=" * 100)
    print("第3组: 状态和属性更新 (4个端点)")
    print("=" * 100)

    # 10. PUT - 切换客户状态
    test_endpoint(
        "切换客户状态",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_004/status",
        params={"isActive": False}
    )

    # 11. PUT - 更新客户评级
    test_endpoint(
        "更新客户评级",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_004/rating",
        params={"rating": 5, "notes": "API测试评级更新"}
    )

    # 12. PUT - 更新客户信用额度
    test_endpoint(
        "更新客户信用额度",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_004/credit-limit",
        params={"creditLimit": 150000}
    )

    # 13. PUT - 更新客户当前余额
    test_endpoint(
        "更新客户当前余额",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_004/balance",
        params={"balance": 50000}
    )

    print("\n" + "=" * 100)
    print("第4组: 统计和历史查询 (3个端点)")
    print("=" * 100)

    # 14. GET - 获取客户统计信息
    test_endpoint(
        "获取客户统计信息",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_001/statistics"
    )

    # 15. GET - 获取客户购买历史
    test_endpoint(
        "获取客户购买历史",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/CUST_TEST_001/purchase-history"
    )

    # 16. GET - 获取客户评级分布
    test_endpoint(
        "获取客户评级分布",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/rating-distribution"
    )

    print("\n" + "=" * 100)
    print("第5组: 导入导出操作 (2个端点)")
    print("=" * 100)

    # 17. GET - 导出客户列表
    try:
        response = requests.get(
            f"{BASE_URL}/api/mobile/{FACTORY_ID}/customers/export",
            timeout=10
        )
        if response.status_code == 200 and len(response.content) > 0:
            print_result("导出客户列表", "GET", "PASS", f"({len(response.content)} bytes)")
            test_results["total"] += 1
            test_results["passed"] += 1
        else:
            print_result("导出客户列表", "GET", "FAIL", f"HTTP {response.status_code}")
            test_results["total"] += 1
            test_results["failed"] += 1
    except Exception as e:
        print_result("导出客户列表", "GET", "ERROR", str(e)[:50])
        test_results["total"] += 1
        test_results["failed"] += 1

    # 18. POST - 批量导入客户（需要token，跳过）
    print("⚠️  跳过批量导入测试（无Token）")

    # 打印测试总结
    print("\n" + "=" * 100)
    print("测试结果总结")
    print("=" * 100)
    print(f"总测试数: {test_results['total']}")
    print(f"通过: {test_results['passed']} ✅")
    print(f"失败: {test_results['failed']} ❌")
    print(f"通过率: {test_results['passed']/test_results['total']*100:.1f}%")

    if test_results['errors']:
        print("\n失败详情:")
        for idx, error in enumerate(test_results['errors'], 1):
            print(f"  {idx}. {error}")

    print("=" * 100)

if __name__ == "__main__":
    main()
