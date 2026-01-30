#!/usr/bin/env python3
"""
SmartBI 测试脚本
用于上传 Test.xlsx 并验证图表生成

使用方法:
    pip install httpx
    python test_smartbi_upload.py

环境要求:
    - Python 服务运行在 localhost:8083
    - Java 后端运行在 139.196.165.140:10010
"""

import httpx
import json
import time
import sys
from pathlib import Path

# 配置
PYTHON_SERVICE_URL = "http://139.196.165.140:8083"  # 使用远程服务器
JAVA_BACKEND_URL = "http://139.196.165.140:10010"
FACTORY_ID = "F001"
TEST_FILE = Path(__file__).parent / "Test.xlsx"

# 测试账号
USERNAME = "factory_admin1"
PASSWORD = "123456"

def print_section(title):
    """打印分节标题"""
    print(f"\n{'='*50}")
    print(f" {title}")
    print('='*50)

def login_and_get_token():
    """登录获取 JWT Token"""
    print_section("Step 0: 登录获取Token")

    try:
        response = httpx.post(
            f"{JAVA_BACKEND_URL}/api/mobile/auth/unified-login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=10.0
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("data", {}).get("accessToken"):
                token = data["data"]["accessToken"]
                print(f"[OK] 登录成功，Token: {token[:20]}...")
                return token
        print(f"[FAIL] 登录失败: {response.text[:200]}")
    except Exception as e:
        print(f"[FAIL] 登录异常: {e}")
    return None

def upload_excel_via_python(filepath: Path):
    """
    通过 Python 服务上传 Excel 文件

    Returns:
        upload_id (int) or None
    """
    print_section("Step 1: 上传Excel文件")

    if not filepath.exists():
        print(f"[FAIL] 文件不存在: {filepath}")
        return None

    print(f"上传文件: {filepath.name} ({filepath.stat().st_size / 1024:.1f} KB)")

    try:
        with open(filepath, "rb") as f:
            files = {"file": (filepath.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            data = {"factory_id": FACTORY_ID, "persist": "true"}

            response = httpx.post(
                f"{PYTHON_SERVICE_URL}/api/excel/auto-parse",
                files=files,
                data=data,
                timeout=120.0  # Excel 解析可能较慢
            )

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                upload_id = result.get("upload_id") or result.get("data", {}).get("upload_id")
                print(f"[OK] 上传成功!")
                print(f"  - Upload ID: {upload_id}")
                print(f"  - 表数量: {len(result.get('sheets', result.get('data', {}).get('sheets', [])))}")
                return upload_id
            else:
                print(f"[FAIL] 上传失败: {result.get('message', 'Unknown error')}")
        else:
            print(f"[FAIL] HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"[FAIL] 上传异常: {e}")

    return None

def get_upload_status(upload_id: int):
    """获取上传状态和 Sheet 列表"""
    print_section("Step 2: 获取上传状态")

    try:
        response = httpx.get(
            f"{PYTHON_SERVICE_URL}/api/excel/upload/{upload_id}/status",
            timeout=10.0
        )
        if response.status_code == 200:
            result = response.json()
            print(f"[OK] 上传状态:")
            print(f"  - 状态: {result.get('status', 'unknown')}")
            print(f"  - 行数: {result.get('row_count', 'N/A')}")
            sheets = result.get("sheets", [])
            print(f"  - Sheet 列表 ({len(sheets)}):")
            for i, sheet in enumerate(sheets):
                name = sheet if isinstance(sheet, str) else sheet.get("name", f"Sheet{i}")
                print(f"    {i}. {name}")
            return sheets
    except Exception as e:
        print(f"[WARN] 获取状态失败: {e}")

    return []

def generate_charts_for_sheets(upload_id: int, sheets: list):
    """为每个 Sheet 生成图表配置"""
    print_section("Step 3: 生成图表配置")

    results = []
    for i, sheet in enumerate(sheets):
        sheet_name = sheet if isinstance(sheet, str) else sheet.get("name", f"Sheet{i}")

        print(f"  [{i}] {sheet_name} - 生成中...", end=" ")

        try:
            response = httpx.post(
                f"{PYTHON_SERVICE_URL}/api/chart/recommend/llm",
                json={"upload_id": upload_id, "sheet_name": sheet_name},
                timeout=60.0
            )

            if response.status_code == 200:
                result = response.json()
                chart_count = len(result.get("charts", result.get("data", {}).get("charts", [])))
                print(f"[OK] {chart_count} 个图表")
                results.append({"sheet": sheet_name, "charts": chart_count, "success": True})
            else:
                print(f"[FAIL] HTTP {response.status_code}")
                results.append({"sheet": sheet_name, "success": False, "error": f"HTTP {response.status_code}"})
        except Exception as e:
            print(f"[FAIL] {e}")
            results.append({"sheet": sheet_name, "success": False, "error": str(e)})

    return results

def verify_dashboard_api(token: str):
    """验证 Dashboard API 是否返回数据"""
    print_section("Step 4: 验证Dashboard API")

    headers = {"Authorization": f"Bearer {token}"}

    # 测试 executive dashboard
    try:
        response = httpx.get(
            f"{JAVA_BACKEND_URL}/api/mobile/{FACTORY_ID}/smart-bi/dashboard/executive",
            params={"period": "month"},
            headers=headers,
            timeout=30.0
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                data = result.get("data", {})
                kpi_count = len(data.get("kpiCards", []))
                chart_count = len(data.get("charts", {}))
                insight_count = len(data.get("aiInsights", []))

                print(f"[OK] Dashboard API 响应正常:")
                print(f"  - KPI 卡片数: {kpi_count}")
                print(f"  - 图表数: {chart_count}")
                print(f"  - AI 洞察数: {insight_count}")

                if kpi_count > 0:
                    print(f"  - KPI 样例: {data['kpiCards'][0].get('title', 'N/A')}")
                    return True
                else:
                    print(f"  [WARN] KPI 卡片为空，可能数据转换有问题")
            else:
                print(f"[FAIL] API 返回失败: {result.get('message')}")
        else:
            print(f"[FAIL] HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"[FAIL] 请求异常: {e}")

    return False

def verify_data_in_database():
    """验证数据库中是否有数据 (通过 API)"""
    print_section("Step 5: 验证数据库数据")

    try:
        # 检查动态数据行数
        response = httpx.get(
            f"{PYTHON_SERVICE_URL}/api/excel/uploads",
            params={"factory_id": FACTORY_ID},
            timeout=10.0
        )

        if response.status_code == 200:
            result = response.json()
            uploads = result.get("uploads", result.get("data", []))
            print(f"[OK] 上传记录数: {len(uploads)}")
            for upload in uploads[:3]:  # 显示最近3条
                print(f"  - ID {upload.get('id')}: {upload.get('file_name')} ({upload.get('row_count', 'N/A')} 行)")
            return len(uploads) > 0
    except Exception as e:
        print(f"[WARN] 获取上传列表失败: {e}")

    return False

def main():
    """主流程"""
    print("\n" + "="*50)
    print(" SmartBI 数据清理与测试脚本")
    print("="*50)
    print(f"文件: {TEST_FILE}")
    print(f"工厂ID: {FACTORY_ID}")
    print(f"Python服务: {PYTHON_SERVICE_URL}")
    print(f"Java后端: {JAVA_BACKEND_URL}")

    # Step 0: 登录
    token = login_and_get_token()

    # Step 1: 上传 Excel
    upload_id = upload_excel_via_python(TEST_FILE)
    if not upload_id:
        print("\n[ABORT] 上传失败，终止测试")
        sys.exit(1)

    # 等待处理完成
    print("\n等待3秒让后端处理...")
    time.sleep(3)

    # Step 2: 获取 Sheet 列表
    sheets = get_upload_status(upload_id)
    if not sheets:
        # 尝试从上传响应中获取
        sheets = [
            "索引", "收入及净利简表",
            "2025年销售1中心利润表", "2025年中心利润表",
            "2025年江苏分部利润表", "2025年浙江分部利润表",
            "2025年上海分部利润表", "2025年赣皖区域利润表",
            "2025年安徽省区利润表", "2025年江西省区利润表",
            "24年返利明细"
        ]
        print(f"  使用默认 Sheet 列表: {len(sheets)} 个")

    # Step 3: 生成图表
    chart_results = generate_charts_for_sheets(upload_id, sheets)

    # Step 4: 验证 Dashboard API (如果有 token)
    if token:
        verify_dashboard_api(token)
    else:
        print_section("Step 4: 跳过Dashboard验证 (无Token)")

    # Step 5: 验证数据库
    verify_data_in_database()

    # 汇总报告
    print_section("测试报告")
    print(f"上传ID: {upload_id}")
    print(f"Sheet 总数: {len(sheets)}")
    success_count = sum(1 for r in chart_results if r.get("success"))
    print(f"图表生成成功: {success_count}/{len(chart_results)}")

    total_charts = sum(r.get("charts", 0) for r in chart_results if r.get("success"))
    print(f"生成图表总数: {total_charts}")

    print("\n[DONE] 测试完成!")

    return 0 if success_count > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
