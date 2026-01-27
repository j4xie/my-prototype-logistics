#!/usr/bin/env python3
"""
SmartBI 端到端测试脚本

测试完整流程：
1. Excel 解析
2. 字段检测
3. 指标计算
4. 分析服务
5. 图表生成
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://139.196.165.140:8083"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_result(name, success, data=None, error=None):
    status = "[PASS]" if success else "[FAIL]"
    print(f"{status} {name}")
    if data and isinstance(data, dict):
        for k, v in list(data.items())[:5]:
            print(f"   - {k}: {v}")
    if error:
        print(f"   错误: {error}")

# 测试数据
SALES_DATA = [
    {"date": "2025-01", "product": "产品A", "salesperson": "张三", "region": "华东", "amount": 50000, "quantity": 100, "cost": 35000},
    {"date": "2025-01", "product": "产品B", "salesperson": "李四", "region": "华北", "amount": 35000, "quantity": 70, "cost": 24500},
    {"date": "2025-02", "product": "产品A", "salesperson": "张三", "region": "华东", "amount": 60000, "quantity": 120, "cost": 42000},
    {"date": "2025-02", "product": "产品C", "salesperson": "王五", "region": "华南", "amount": 45000, "quantity": 90, "cost": 31500},
    {"date": "2025-03", "product": "产品B", "salesperson": "李四", "region": "华北", "amount": 40000, "quantity": 80, "cost": 28000},
    {"date": "2025-03", "product": "产品A", "salesperson": "张三", "region": "华东", "amount": 70000, "quantity": 140, "cost": 49000},
]

FINANCE_DATA = [
    {"date": "2025-01", "revenue": 100000, "cost": 70000, "category": "主营业务"},
    {"date": "2025-02", "revenue": 120000, "cost": 84000, "category": "主营业务"},
    {"date": "2025-03", "revenue": 110000, "cost": 77000, "category": "主营业务"},
    {"date": "2025-01", "revenue": 30000, "cost": 15000, "category": "其他业务"},
    {"date": "2025-02", "revenue": 35000, "cost": 17500, "category": "其他业务"},
]

def test_health():
    """测试健康检查"""
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        data = resp.json()
        return data.get("status") == "healthy", data
    except Exception as e:
        return False, {"error": str(e)}

def test_field_detection():
    """测试字段检测"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/field/detect",
            json={"data": SALES_DATA},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_metrics_calculation():
    """测试指标计算"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/metrics/calculate",
            json={
                "data": SALES_DATA,
                "metrics": ["total_sales", "avg_sales", "growth_rate"]
            },
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_finance_overview():
    """测试财务概览"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/finance/overview",
            json={"data": FINANCE_DATA},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_sales_kpis():
    """测试销售 KPI"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/sales/kpis",
            json={"data": SALES_DATA},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_salesperson_ranking():
    """测试销售员排名"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/sales/ranking/salesperson",
            json={"data": SALES_DATA, "topN": 5},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_product_ranking():
    """测试产品排名"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/sales/ranking/product",
            json={"data": SALES_DATA, "topN": 5},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_chart_build_bar():
    """测试柱状图生成"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chart/build",
            json={
                "chartType": "bar",
                "data": SALES_DATA,
                "xField": "date",
                "yFields": ["amount"],
                "title": "月度销售额"
            },
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), {"chartType": data.get("chartType"), "hasConfig": bool(data.get("config"))}
    except Exception as e:
        return False, {"error": str(e)}

def test_chart_build_pie():
    """测试饼图生成"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chart/build",
            json={
                "chartType": "pie",
                "data": [
                    {"name": "华东", "value": 180000},
                    {"name": "华北", "value": 75000},
                    {"name": "华南", "value": 45000}
                ],
                "title": "区域销售分布"
            },
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), {"chartType": data.get("chartType"), "hasConfig": bool(data.get("config"))}
    except Exception as e:
        return False, {"error": str(e)}

def test_chart_build_line():
    """测试折线图生成"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chart/build",
            json={
                "chartType": "line",
                "data": FINANCE_DATA[:3],
                "xField": "date",
                "yFields": ["revenue", "cost"],
                "title": "收入成本趋势"
            },
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), {"chartType": data.get("chartType"), "hasConfig": bool(data.get("config"))}
    except Exception as e:
        return False, {"error": str(e)}

def test_chart_recommend():
    """测试图表推荐"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chart/recommend",
            json=SALES_DATA,
            timeout=10
        )
        data = resp.json()
        recommendations = data.get("recommendations", [])
        return data.get("success", False), {"count": len(recommendations), "types": [r.get("chartType") for r in recommendations[:3]]}
    except Exception as e:
        return False, {"error": str(e)}

def test_profit_trend():
    """测试利润趋势"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/finance/profit-trend",
            json={"data": FINANCE_DATA, "periodType": "monthly"},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_sales_trend():
    """测试销售趋势"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/sales/trend",
            json={"data": SALES_DATA, "periodType": "monthly"},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def test_region_distribution():
    """测试区域分布"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/analysis/sales/region-distribution",
            json={"data": SALES_DATA},
            timeout=10
        )
        data = resp.json()
        return data.get("success", False), data.get("data", {})
    except Exception as e:
        return False, {"error": str(e)}

def main():
    print(f"\n{'#'*60}")
    print(f"  SmartBI 端到端测试")
    print(f"  服务地址: {BASE_URL}")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*60}")

    results = []

    # 1. 健康检查
    print_section("1. 服务健康检查")
    success, data = test_health()
    print_result("健康检查", success, data)
    results.append(("健康检查", success))

    # 2. 字段检测
    print_section("2. 字段检测")
    success, data = test_field_detection()
    print_result("字段检测", success, data)
    results.append(("字段检测", success))

    # 3. 指标计算
    print_section("3. 指标计算")
    success, data = test_metrics_calculation()
    print_result("指标计算", success, data)
    results.append(("指标计算", success))

    # 4. 财务分析
    print_section("4. 财务分析")

    success, data = test_finance_overview()
    print_result("财务概览", success, data.get("kpis", {}) if isinstance(data, dict) else data)
    results.append(("财务概览", success))

    success, data = test_profit_trend()
    print_result("利润趋势", success, data)
    results.append(("利润趋势", success))

    # 5. 销售分析
    print_section("5. 销售分析")

    success, data = test_sales_kpis()
    print_result("销售 KPI", success, data)
    results.append(("销售 KPI", success))

    success, data = test_salesperson_ranking()
    print_result("销售员排名", success, data)
    results.append(("销售员排名", success))

    success, data = test_product_ranking()
    print_result("产品排名", success, data)
    results.append(("产品排名", success))

    success, data = test_sales_trend()
    print_result("销售趋势", success, data)
    results.append(("销售趋势", success))

    success, data = test_region_distribution()
    print_result("区域分布", success, data)
    results.append(("区域分布", success))

    # 6. 图表生成
    print_section("6. 图表生成")

    success, data = test_chart_build_bar()
    print_result("柱状图生成", success, data)
    results.append(("柱状图生成", success))

    success, data = test_chart_build_pie()
    print_result("饼图生成", success, data)
    results.append(("饼图生成", success))

    success, data = test_chart_build_line()
    print_result("折线图生成", success, data)
    results.append(("折线图生成", success))

    success, data = test_chart_recommend()
    print_result("图表推荐", success, data)
    results.append(("图表推荐", success))

    # 汇总
    print_section("测试汇总")
    passed = sum(1 for _, s in results if s)
    total = len(results)
    print(f"\n通过: {passed}/{total} ({100*passed/total:.0f}%)")

    print("\nDetails:")
    for name, success in results:
        status = "[PASS]" if success else "[FAIL]"
        print(f"  {status} {name}")

    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
