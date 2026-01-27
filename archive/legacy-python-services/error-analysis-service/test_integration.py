"""
集成测试脚本 - 模拟 Java 后端调用 Python 服务的完整流程
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8082"

def test_health():
    """测试健康检查"""
    print("\n=== 1. 健康检查 ===")
    resp = requests.get(f"{BASE_URL}/health")
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    return resp.status_code == 200

def test_aggregate_daily():
    """测试日维度聚合统计 - 模拟真实数据"""
    print("\n=== 2. 日维度聚合统计 ===")

    # 模拟一天的真实数据
    records = [
        # 成功的查询类意图
        {"id": "1", "userInput": "查询今日销量", "matchedIntentCode": "QUERY_SALES",
         "matchedIntentCategory": "查询类", "confidenceScore": 0.92, "matchMethod": "KEYWORD",
         "executionStatus": "EXECUTED", "isStrongSignal": True, "llmCalled": False},
        {"id": "2", "userInput": "今天销售额多少", "matchedIntentCode": "QUERY_SALES",
         "matchedIntentCategory": "查询类", "confidenceScore": 0.88, "matchMethod": "SEMANTIC",
         "executionStatus": "EXECUTED", "isStrongSignal": True, "llmCalled": False},
        # 需要确认的操作
        {"id": "3", "userInput": "创建新订单", "matchedIntentCode": "CREATE_ORDER",
         "matchedIntentCategory": "操作类", "confidenceScore": 0.75, "matchMethod": "KEYWORD",
         "executionStatus": "EXECUTED", "isStrongSignal": False, "llmCalled": False,
         "requiresConfirmation": True, "userConfirmed": True},
        # LLM 回退
        {"id": "4", "userInput": "帮我看看这个怎么弄", "matchedIntentCode": "HELP",
         "matchedIntentCategory": "帮助类", "confidenceScore": 0.65, "matchMethod": "LLM",
         "executionStatus": "EXECUTED", "isStrongSignal": False, "llmCalled": True},
        # 失败 - 规则缺失
        {"id": "5", "userInput": "批量导入产品", "matchedIntentCode": None,
         "matchedIntentCategory": None, "confidenceScore": 0.25, "matchMethod": "NONE",
         "executionStatus": "FAILED", "errorAttribution": "RULE_MISS", "isStrongSignal": False},
        # 失败 - 歧义
        {"id": "6", "userInput": "删除", "matchedIntentCode": "DELETE_UNKNOWN",
         "matchedIntentCategory": "操作类", "confidenceScore": 0.45, "matchMethod": "KEYWORD",
         "executionStatus": "FAILED", "errorAttribution": "AMBIGUOUS", "isStrongSignal": False},
        # 用户取消
        {"id": "7", "userInput": "取消订单", "matchedIntentCode": "CANCEL_ORDER",
         "matchedIntentCategory": "操作类", "confidenceScore": 0.82, "matchMethod": "KEYWORD",
         "executionStatus": "CANCELLED", "errorAttribution": "USER_CANCEL",
         "isStrongSignal": False, "requiresConfirmation": True, "userConfirmed": False},
    ]

    resp = requests.post(f"{BASE_URL}/api/analysis/aggregate-daily",
                         json={"records": records})
    print(f"Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        if data.get("success"):
            result = data["data"]
            print(f"\n统计结果:")
            print(f"  总请求数: {result['totalRequests']}")
            print(f"  匹配成功: {result['matchedCount']}")
            print(f"  匹配失败: {result['unmatchedCount']}")
            print(f"  LLM回退: {result['llmFallbackCount']}")
            print(f"  强信号: {result['strongSignalCount']}")
            print(f"  弱信号: {result['weakSignalCount']}")
            print(f"  已执行: {result['executedCount']}")
            print(f"  失败数: {result['failedCount']}")
            print(f"  取消数: {result['cancelledCount']}")
            print(f"  平均置信度: {result['avgConfidence']:.4f}")
            print(f"\n错误归因:")
            print(f"  规则缺失: {result['ruleMissCount']}")
            print(f"  歧义: {result['ambiguousCount']}")
            print(f"  用户取消: {result['userCancelCount']}")
            print(f"\n意图分类统计: {json.dumps(result['intentCategoryStats'], ensure_ascii=False, indent=2)}")
            print(f"\n匹配方法统计: {json.dumps(result['matchMethodStats'], ensure_ascii=False, indent=2)}")
            return True

    print(f"Error: {resp.text}")
    return False

def test_failure_patterns():
    """测试失败模式识别"""
    print("\n=== 3. 失败模式识别 ===")

    # 模拟有重复模式的失败记录
    records = [
        {"id": "1", "userInput": "批量导入", "normalizedInput": "批量导入",
         "executionStatus": "FAILED", "errorAttribution": "RULE_MISS"},
        {"id": "2", "userInput": "批量导入产品", "normalizedInput": "批量导入",
         "executionStatus": "FAILED", "errorAttribution": "RULE_MISS"},
        {"id": "3", "userInput": "我要批量导入", "normalizedInput": "批量导入",
         "executionStatus": "FAILED", "errorAttribution": "RULE_MISS"},
        {"id": "4", "userInput": "删除全部", "normalizedInput": "删除全部",
         "executionStatus": "FAILED", "errorAttribution": "AMBIGUOUS"},
        {"id": "5", "userInput": "删除所有的", "normalizedInput": "删除全部",
         "executionStatus": "FAILED", "errorAttribution": "AMBIGUOUS"},
    ]

    resp = requests.post(f"{BASE_URL}/api/analysis/identify-failure-patterns",
                         json={"records": records, "minFrequency": 2})
    print(f"Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        if data.get("success"):
            patterns = data["data"]["patterns"]
            print(f"\n识别到 {len(patterns)} 个失败模式:")
            for p in patterns:
                print(f"  - '{p['userInput']}': {p['count']}次, 归因: {p['errorAttribution']}")
                print(f"    样本: {p['samples']}")
            return True

    print(f"Error: {resp.text}")
    return False

def test_keyword_extraction():
    """测试关键词提取"""
    print("\n=== 4. 关键词提取 (jieba) ===")

    inputs = [
        "查询今日销量",
        "今天的销售额是多少",
        "销量统计报表",
        "查看销售数据",
        "导出销售报告",
        "批量导入产品数据",
        "产品数据导入",
        "查询库存数量",
        "库存查询",
    ]

    resp = requests.post(f"{BASE_URL}/api/analysis/extract-keywords",
                         json={"inputs": inputs, "minFrequency": 2, "topN": 10})
    print(f"Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        if data.get("success"):
            keywords = data["data"]["keywords"]
            print(f"\n提取到关键词: {keywords}")
            return True

    print(f"Error: {resp.text}")
    return False

def test_weekly_report():
    """测试周报生成"""
    print("\n=== 5. 周报生成 ===")

    daily_stats = [
        {"totalRequests": 100, "matchedCount": 85, "failedCount": 10, "cancelledCount": 5},
        {"totalRequests": 120, "matchedCount": 100, "failedCount": 12, "cancelledCount": 8},
        {"totalRequests": 95, "matchedCount": 80, "failedCount": 8, "cancelledCount": 7},
        {"totalRequests": 110, "matchedCount": 95, "failedCount": 10, "cancelledCount": 5},
        {"totalRequests": 130, "matchedCount": 115, "failedCount": 9, "cancelledCount": 6},
        {"totalRequests": 80, "matchedCount": 72, "failedCount": 5, "cancelledCount": 3},
        {"totalRequests": 90, "matchedCount": 82, "failedCount": 5, "cancelledCount": 3},
    ]

    failure_patterns = [
        {"userInput": "批量导入", "count": 15},
        {"userInput": "删除全部", "count": 8},
    ]

    resp = requests.post(f"{BASE_URL}/api/analysis/generate-weekly-report",
                         json={
                             "dailyStats": daily_stats,
                             "failurePatterns": failure_patterns,
                             "ambiguousIntents": [{"count": 5}],
                             "missingRules": [{"count": 3}]
                         })
    print(f"Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        if data.get("success"):
            result = data["data"]
            print(f"\n周报摘要:")
            print(f"  {json.dumps(result['summary'], ensure_ascii=False, indent=2)}")
            print(f"\n趋势分析:")
            print(f"  {json.dumps(result['trends'], ensure_ascii=False, indent=2)}")
            print(f"\n建议:")
            for rec in result['recommendations']:
                print(f"  - {rec}")
            return True

    print(f"Error: {resp.text}")
    return False

def main():
    print("=" * 60)
    print("Error Analysis Service 集成测试")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {
        "健康检查": test_health(),
        "日维度聚合": test_aggregate_daily(),
        "失败模式识别": test_failure_patterns(),
        "关键词提取": test_keyword_extraction(),
        "周报生成": test_weekly_report(),
    }

    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)

    all_passed = True
    for name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print("\n" + ("所有测试通过！" if all_passed else "部分测试失败"))
    return all_passed

if __name__ == "__main__":
    main()
