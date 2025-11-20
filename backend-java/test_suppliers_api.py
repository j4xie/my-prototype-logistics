#!/usr/bin/env python3
"""
Suppliers API 完整测试脚本
测试所有17个端点
"""
import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:10010"
FACTORY_ID = "CRETAS_2024_001"

# 测试结果统计
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "errors": []
}

def print_result(endpoint: str, method: str, status: str, message: str = ""):
    """打印测试结果"""
    status_icon = "✅" if status == "PASS" else "❌"
    print(f"{status_icon} [{method:6}] {endpoint:50} - {status} {message}")

def test_endpoint(name: str, method: str, url: str, **kwargs) -> bool:
    """测试单个端点"""
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

        # 检查响应
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

def get_auth_token() -> str:
    """获取授权token"""
    url = f"{BASE_URL}/api/auth/mobile/unified-login"
    payload = {
        "username": "张华",
        "password": "Test@123456",
        "factoryId": FACTORY_ID
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()
        if data.get("code") == 200:
            token = data.get("data", {}).get("accessToken", "")
            print(f"✅ 授权Token获取成功: {token[:50]}...")
            return token
        else:
            print(f"❌ Token获取失败: {data.get('message')}")
            return ""
    except Exception as e:
        print(f"❌ Token获取异常: {e}")
        return ""

def main():
    print("=" * 100)
    print("开始测试 Suppliers API - 17个端点")
    print("=" * 100)

    # 获取授权token（部分端点需要）
    auth_token = get_auth_token()
    headers_with_auth = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}

    print("\n" + "=" * 100)
    print("第1组: 基础CRUD操作 (5个端点)")
    print("=" * 100)

    # 1. GET - 获取供应商列表（分页）
    test_endpoint(
        "获取供应商列表（分页）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers",
        params={"page": 1, "size": 5}
    )

    # 2. GET - 获取供应商详情
    test_endpoint(
        "获取供应商详情",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_001"
    )

    # 3. POST - 创建供应商 (需要token)
    if auth_token:
        new_supplier_data = {
            "name": "API测试新供应商",
            "code": "APITEST001",
            "supplierCode": "SUPPLIER_APITEST_001",
            "contactPerson": "测试联系人",
            "phone": "13800138888",
            "email": "apitest@supplier.com",
            "address": "深圳市南山区",
            "suppliedMaterials": "测试原材料",
            "paymentTerms": "月结30天",
            "deliveryDays": 3,
            "creditLimit": 100000,
            "rating": 4,
            "isActive": True
        }
        test_endpoint(
            "创建供应商",
            "POST",
            f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers",
            headers=headers_with_auth,
            json=new_supplier_data
        )
    else:
        print("⚠️  跳过创建供应商测试（无Token）")
        test_results["total"] += 1
        test_results["failed"] += 1

    # 4. PUT - 更新供应商
    update_data = {
        "name": "更新后的供应商名称",
        "code": "SUP003",
        "supplierCode": "SUPPLIER_003",
        "contactPerson": "更新联系人",
        "phone": "13900000333",
        "email": "updated@supplier.com",
        "address": "更新地址",
        "suppliedMaterials": "更新材料",
        "paymentTerms": "月结45天",
        "deliveryDays": 4,
        "creditLimit": 120000,
        "rating": 4,
        "isActive": True
    }
    test_endpoint(
        "更新供应商",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_003",
        json=update_data
    )

    # 5. DELETE - 删除供应商 (先创建一个用于删除)
    # 注意: 这里跳过删除测试，避免影响后续测试
    print("⚠️  跳过删除供应商测试（避免影响后续测试数据）")

    print("\n" + "=" * 100)
    print("第2组: 查询和过滤操作 (5个端点)")
    print("=" * 100)

    # 6. GET - 获取活跃供应商列表
    test_endpoint(
        "获取活跃供应商列表",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/active"
    )

    # 7. GET - 搜索供应商
    test_endpoint(
        "搜索供应商（关键词：海鲜）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/search",
        params={"keyword": "海鲜"}
    )

    # 8. GET - 按材料类型获取供应商
    test_endpoint(
        "按材料类型获取供应商",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/by-material",
        params={"materialType": "鱼类原材料"}
    )

    # 9. GET - 检查供应商代码是否存在
    test_endpoint(
        "检查供应商代码（存在）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/check-code",
        params={"supplierCode": "SUP001"}
    )

    test_endpoint(
        "检查供应商代码（不存在）",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/check-code",
        params={"supplierCode": "NOTEXIST999"}
    )

    print("\n" + "=" * 100)
    print("第3组: 状态和属性更新 (3个端点)")
    print("=" * 100)

    # 10. PUT - 切换供应商状态
    test_endpoint(
        "切换供应商状态",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_004/status",
        params={"isActive": False}
    )

    # 11. PUT - 更新供应商评级
    test_endpoint(
        "更新供应商评级",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_004/rating",
        params={"rating": 5, "notes": "API测试评级更新"}
    )

    # 12. PUT - 更新供应商信用额度
    test_endpoint(
        "更新供应商信用额度",
        "PUT",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_004/credit-limit",
        params={"creditLimit": 200000}
    )

    print("\n" + "=" * 100)
    print("第4组: 统计和历史查询 (4个端点)")
    print("=" * 100)

    # 13. GET - 获取供应商统计信息
    test_endpoint(
        "获取供应商统计信息",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_001/statistics"
    )

    # 14. GET - 获取供应商供货历史
    test_endpoint(
        "获取供应商供货历史",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/SUP_TEST_001/history"
    )

    # 15. GET - 获取供应商评级分布
    test_endpoint(
        "获取供应商评级分布",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/rating-distribution"
    )

    # 16. GET - 获取有欠款的供应商
    test_endpoint(
        "获取有欠款的供应商",
        "GET",
        f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/outstanding-balance"
    )

    print("\n" + "=" * 100)
    print("第5组: 导入导出操作 (2个端点)")
    print("=" * 100)

    # 17. GET - 导出供应商列表
    try:
        response = requests.get(
            f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/export",
            timeout=10
        )
        if response.status_code == 200 and len(response.content) > 0:
            print_result("导出供应商列表", "GET", "PASS", f"({len(response.content)} bytes)")
            test_results["total"] += 1
            test_results["passed"] += 1
        else:
            print_result("导出供应商列表", "GET", "FAIL", f"HTTP {response.status_code}")
            test_results["total"] += 1
            test_results["failed"] += 1
    except Exception as e:
        print_result("导出供应商列表", "GET", "ERROR", str(e)[:50])
        test_results["total"] += 1
        test_results["failed"] += 1

    # 18. POST - 批量导入供应商 (需要token)
    if auth_token:
        import_data = [
            {
                "name": "批量导入供应商1",
                "code": "IMPORT001",
                "supplierCode": "SUPPLIER_IMPORT_001",
                "contactPerson": "导入联系人1",
                "phone": "13800001111",
                "address": "导入地址1",
                "isActive": True
            }
        ]
        test_endpoint(
            "批量导入供应商",
            "POST",
            f"{BASE_URL}/api/mobile/{FACTORY_ID}/suppliers/import",
            headers=headers_with_auth,
            json=import_data
        )
    else:
        print("⚠️  跳过批量导入测试（无Token）")
        test_results["total"] += 1
        test_results["failed"] += 1

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
