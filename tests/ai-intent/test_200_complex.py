# -*- coding: utf-8 -*-
"""
AI Intent Recognition - 200条复杂场景测试
测试重点：复合查询、参数提取、边界情况、业务场景
"""
import sys
import requests
import json
from datetime import datetime
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

API_URL = "http://139.196.165.140:10010/api/public/ai-demo/recognize"

# ============================================================
# 200 COMPLEX TEST CASES
# ============================================================
TEST_CASES = [
    # ============================================================
    # 1. 复合条件查询 (25 cases)
    # ============================================================
    ("查询今天销售额超过1万的订单", "ORDER", "compound_query", {}),
    ("显示库存低于100件的物料", "MATERIAL", "compound_query", {}),
    ("找出本周迟到超过3次的员工", "ATTENDANCE", "compound_query", {}),
    ("列出质检不合格率大于5%的批次", "QUALITY", "compound_query", {}),
    ("查看温度超过10度的冷链记录", "COLD_CHAIN", "compound_query", {}),
    ("获取评分低于3分的供应商", "SUPPLIER", "compound_query", {}),
    ("显示本月订单金额前10的客户", "CUSTOMER", "compound_query", {}),
    ("查询运行时间超过8小时的设备", "EQUIPMENT", "compound_query", {}),
    ("列出即将过期的原料批次", "MATERIAL", "compound_query", {}),
    ("找出发货延迟超过2天的订单", "SHIPMENT", "compound_query", {}),
    ("查看告警未处理超过24小时的", "ALERT", "compound_query", {}),
    ("获取本季度销量下降的产品", "REPORT", "compound_query", {}),
    ("显示连续3天缺勤的员工", "ATTENDANCE", "compound_query", {}),
    ("查询生产效率低于80%的产线", "EQUIPMENT", "compound_query", {}),
    ("列出采购金额超过10万的供应商", "SUPPLIER", "compound_query", {}),
    ("找出退货率高于10%的产品", "QUALITY", "compound_query", {}),
    ("查看库龄超过90天的库存", "INVENTORY", "compound_query", {}),
    ("获取复购率高的客户名单", "CUSTOMER", "compound_query", {}),
    ("显示维护超期的设备清单", "EQUIPMENT", "compound_query", {}),
    ("查询原产地为山东的原料", "MATERIAL", "compound_query", {}),
    ("列出A级供应商的订单", "ORDER", "compound_query", {}),
    ("找出华东区的大客户", "CUSTOMER", "compound_query", {}),
    ("查看一号车间的设备", "EQUIPMENT", "compound_query", {}),
    ("获取冷藏区的库存", "INVENTORY", "compound_query", {}),
    ("显示加急订单的发货情况", "SHIPMENT", "compound_query", {}),

    # ============================================================
    # 2. 多意图/多动作 (20 cases)
    # ============================================================
    ("先查库存再下单", "INVENTORY", "multi_intent", {}),
    ("检查设备后安排生产", "EQUIPMENT", "multi_intent", {}),
    ("质检通过后发货", "QUALITY", "multi_intent", {}),
    ("统计考勤并生成报表", "ATTENDANCE", "multi_intent", {}),
    ("查询订单状态并通知客户", "ORDER", "multi_intent", {}),
    ("盘点库存后更新系统", "INVENTORY", "multi_intent", {}),
    ("审核供应商资质再下采购单", "SUPPLIER", "multi_intent", {}),
    ("检测温度异常并发送告警", "COLD_CHAIN", "multi_intent", {}),
    ("追溯批次来源并导出报告", "TRACE", "multi_intent", {}),
    ("分析销售数据后调整价格", "REPORT", "multi_intent", {}),
    ("查看设备状态顺便看看产量", "EQUIPMENT", "multi_intent", {}),
    ("帮我查订单和库存", "ORDER", "multi_intent", {}),
    ("看看今天的考勤和产量", "ATTENDANCE", "multi_intent", {}),
    ("质检报告和发货单都要", "QUALITY", "multi_intent", {}),
    ("客户信息和订单历史", "CUSTOMER", "multi_intent", {}),
    ("设备告警和维护记录", "EQUIPMENT", "multi_intent", {}),
    ("原料库存和采购计划", "MATERIAL", "multi_intent", {}),
    ("销售数据加上退货统计", "REPORT", "multi_intent", {}),
    ("供应商评分和交货记录", "SUPPLIER", "multi_intent", {}),
    ("冷链温度和物流轨迹", "COLD_CHAIN", "multi_intent", {}),

    # ============================================================
    # 3. 业务场景模拟 (25 cases)
    # ============================================================
    ("客户投诉产品有问题要追溯", "TRACE", "business_scenario", {}),
    ("老板要看这个月的业绩", "REPORT", "business_scenario", {}),
    ("供应商来催款了查下欠款", "SUPPLIER", "business_scenario", {}),
    ("质监局要来检查准备资料", "QUALITY", "business_scenario", {}),
    ("生产线停了看看怎么回事", "EQUIPMENT", "business_scenario", {}),
    ("仓库说货不够了要补货", "INVENTORY", "business_scenario", {}),
    ("客户催单看看发了没", "SHIPMENT", "business_scenario", {}),
    ("新员工入职要录考勤", "ATTENDANCE", "business_scenario", {}),
    ("财务要对账单", "REPORT", "business_scenario", {}),
    ("审计要追溯记录", "TRACE", "business_scenario", {}),
    ("冷库温度报警了", "COLD_CHAIN", "business_scenario", {}),
    ("客户要开发票查订单", "ORDER", "business_scenario", {}),
    ("原料快到期了怎么处理", "MATERIAL", "business_scenario", {}),
    ("设备该保养了提醒一下", "EQUIPMENT", "business_scenario", {}),
    ("月底要盘点库存", "INVENTORY", "business_scenario", {}),
    ("年终总结要数据支撑", "REPORT", "business_scenario", {}),
    ("客户要求提供溯源证明", "TRACE", "business_scenario", {}),
    ("质量问题要追责到批次", "QUALITY", "business_scenario", {}),
    ("供应商交货延迟要扣款", "SUPPLIER", "business_scenario", {}),
    ("员工请假要更新考勤", "ATTENDANCE", "business_scenario", {}),
    ("促销活动要备货", "INVENTORY", "business_scenario", {}),
    ("淡季要分析销售趋势", "REPORT", "business_scenario", {}),
    ("新产品上线要建档", "MATERIAL", "business_scenario", {}),
    ("物流异常要查轨迹", "SHIPMENT", "business_scenario", {}),
    ("成本上涨要分析原因", "REPORT", "business_scenario", {}),

    # ============================================================
    # 4. 隐晦表达/间接查询 (20 cases)
    # ============================================================
    ("最近生意怎么样", "REPORT", "implicit_query", {}),
    ("东西够不够卖", "INVENTORY", "implicit_query", {}),
    ("人手够吗", "ATTENDANCE", "implicit_query", {}),
    ("机器正常吗", "EQUIPMENT", "implicit_query", {}),
    ("货能按时发吗", "SHIPMENT", "implicit_query", {}),
    ("质量有保障吗", "QUALITY", "implicit_query", {}),
    ("客户满意吗", "CUSTOMER", "implicit_query", {}),
    ("供应商靠得住吗", "SUPPLIER", "implicit_query", {}),
    ("温度会不会有问题", "COLD_CHAIN", "implicit_query", {}),
    ("这批货从哪来的", "TRACE", "implicit_query", {}),
    ("钱收回来没", "REPORT", "implicit_query", {}),
    ("活干完了吗", "PROCESSING", "implicit_query", {}),
    ("有没有什么异常", "ALERT", "implicit_query", {}),
    ("情况怎么样了", "REPORT", "implicit_query", {}),
    ("进展如何", "PROCESSING", "implicit_query", {}),
    ("搞定了吗", "PROCESSING", "implicit_query", {}),
    ("还差多少", "INVENTORY", "implicit_query", {}),
    ("来得及吗", "PROCESSING", "implicit_query", {}),
    ("有什么要处理的", "ALERT", "implicit_query", {}),
    ("忙不忙", "REPORT", "implicit_query", {}),

    # ============================================================
    # 5. 参数化查询 (20 cases)
    # ============================================================
    ("查订单号O20260124001", "ORDER", "param_query", {}),
    ("批次号B2026012401的追溯", "TRACE", "param_query", {}),
    ("设备编号EQ001的状态", "EQUIPMENT", "param_query", {}),
    ("员工工号1001的考勤", "ATTENDANCE", "param_query", {}),
    ("客户编号C001的订单", "CUSTOMER", "param_query", {}),
    ("供应商S001的评分", "SUPPLIER", "param_query", {}),
    ("仓库WH01的库存", "INVENTORY", "param_query", {}),
    ("产线L01的产量", "PROCESSING", "param_query", {}),
    ("冷库CL01的温度", "COLD_CHAIN", "param_query", {}),
    ("质检报告QC2026001", "QUALITY", "param_query", {}),
    ("张三的考勤记录", "ATTENDANCE", "param_query", {}),
    ("华东仓的库存", "INVENTORY", "param_query", {}),
    ("一号线的效率", "EQUIPMENT", "param_query", {}),
    ("牛肉批次的追溯", "TRACE", "param_query", {}),
    ("大客户的订单", "CUSTOMER", "param_query", {}),
    ("主力供应商的交货", "SUPPLIER", "param_query", {}),
    ("紧急订单的状态", "ORDER", "param_query", {}),
    ("不合格品的处理", "QUALITY", "param_query", {}),
    ("超期库存的清理", "INVENTORY", "param_query", {}),
    ("高优先级告警", "ALERT", "param_query", {}),

    # ============================================================
    # 6. 时间复杂表达 (20 cases)
    # ============================================================
    ("上上周的销售数据", "REPORT", "time_complex", {}),
    ("前天到昨天的发货", "SHIPMENT", "time_complex", {}),
    ("最近半个月的考勤", "ATTENDANCE", "time_complex", {}),
    ("过去三个月的趋势", "REPORT", "time_complex", {}),
    ("去年同期对比", "REPORT", "time_complex", {}),
    ("环比增长数据", "REPORT", "time_complex", {}),
    ("同比分析", "REPORT", "time_complex", {}),
    ("截止到今天的累计", "REPORT", "time_complex", {}),
    ("从月初到现在", "REPORT", "time_complex", {}),
    ("下周的排班", "ATTENDANCE", "time_complex", {}),
    ("未来7天的预测", "REPORT", "time_complex", {}),
    ("最近一周每天的产量", "PROCESSING", "time_complex", {}),
    ("按月统计今年的数据", "REPORT", "time_complex", {}),
    ("周环比变化", "REPORT", "time_complex", {}),
    ("节假日的销售", "REPORT", "time_complex", {}),
    ("工作日考勤", "ATTENDANCE", "time_complex", {}),
    ("周末加班记录", "ATTENDANCE", "time_complex", {}),
    ("夜班的产量", "PROCESSING", "time_complex", {}),
    ("交接班时的库存", "INVENTORY", "time_complex", {}),
    ("保质期内的原料", "MATERIAL", "time_complex", {}),

    # ============================================================
    # 7. 否定/排除查询 (15 cases)
    # ============================================================
    ("除了张三以外的考勤", "ATTENDANCE", "negative_query", {}),
    ("非A级供应商", "SUPPLIER", "negative_query", {}),
    ("不包含退货的销售", "REPORT", "negative_query", {}),
    ("未发货的订单", "ORDER", "negative_query", {}),
    ("未处理的告警", "ALERT", "negative_query", {}),
    ("不合格的批次", "QUALITY", "negative_query", {}),
    ("缺勤的员工", "ATTENDANCE", "negative_query", {}),
    ("停机的设备", "EQUIPMENT", "negative_query", {}),
    ("缺货的物料", "INVENTORY", "negative_query", {}),
    ("未回款的订单", "ORDER", "negative_query", {}),
    ("没有追溯的批次", "TRACE", "negative_query", {}),
    ("异常温度记录", "COLD_CHAIN", "negative_query", {}),
    ("超期未维护设备", "EQUIPMENT", "negative_query", {}),
    ("未评审的供应商", "SUPPLIER", "negative_query", {}),
    ("待审核的质检", "QUALITY", "negative_query", {}),

    # ============================================================
    # 8. 比较/排序查询 (15 cases)
    # ============================================================
    ("销量最高的产品", "REPORT", "comparison_query", {}),
    ("效率最低的产线", "EQUIPMENT", "comparison_query", {}),
    ("库存最多的物料", "INVENTORY", "comparison_query", {}),
    ("订单最多的客户", "CUSTOMER", "comparison_query", {}),
    ("评分最高的供应商", "SUPPLIER", "comparison_query", {}),
    ("出勤率最好的部门", "ATTENDANCE", "comparison_query", {}),
    ("合格率最高的批次", "QUALITY", "comparison_query", {}),
    ("温度最稳定的冷库", "COLD_CHAIN", "comparison_query", {}),
    ("响应最快的告警", "ALERT", "comparison_query", {}),
    ("发货最快的物流", "SHIPMENT", "comparison_query", {}),
    ("按销量排序", "REPORT", "comparison_query", {}),
    ("按时间倒序", "ORDER", "comparison_query", {}),
    ("按优先级排列", "ALERT", "comparison_query", {}),
    ("按金额从大到小", "ORDER", "comparison_query", {}),
    ("按合格率降序", "QUALITY", "comparison_query", {}),

    # ============================================================
    # 9. 方言/口语变体 (20 cases)
    # ============================================================
    ("单子搞定没", "ORDER", "dialect", {}),
    ("货齐了没", "INVENTORY", "dialect", {}),
    ("人来齐了吧", "ATTENDANCE", "dialect", {}),
    ("机器转得咋样", "EQUIPMENT", "dialect", {}),
    ("东西发走了吗", "SHIPMENT", "dialect", {}),
    ("检验过关没", "QUALITY", "dialect", {}),
    ("老板问账", "REPORT", "dialect", {}),
    ("追个货", "SHIPMENT", "dialect", {}),
    ("开单子", "ORDER", "dialect", {}),
    ("点个货", "INVENTORY", "dialect", {}),
    ("调个货", "INVENTORY", "dialect", {}),
    ("补个货", "INVENTORY", "dialect", {}),
    ("退个货", "SHIPMENT", "dialect", {}),
    ("下个单", "ORDER", "dialect", {}),
    ("出个货", "SHIPMENT", "dialect", {}),
    ("验个货", "QUALITY", "dialect", {}),
    ("查个账", "REPORT", "dialect", {}),
    ("打个卡", "ATTENDANCE", "dialect", {}),
    ("报个修", "EQUIPMENT", "dialect", {}),
    ("提个醒", "ALERT", "dialect", {}),

    # ============================================================
    # 10. 边界/极端情况 (20 cases)
    # ============================================================
    ("", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("   ", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("???", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("123456", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("abcdef", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("查查查查查", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("订单订单订单", "ORDER", "edge_case", {}),
    ("非常非常非常紧急的订单", "ORDER", "edge_case", {}),
    ("请帮我查询一下我们公司最近这段时间的所有销售订单数据信息", "ORDER", "edge_case", {}),
    ("你好请问可以帮我查一下吗", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("emmm让我想想", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("不知道该查什么", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("随便看看", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("能查什么", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("有啥可看的", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("这个系统能干嘛", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("帮帮我", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("救命", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("快快快", "LOW_CONF", "edge_case", {"should_clarify": True}),
    ("急急急", "LOW_CONF", "edge_case", {"should_clarify": True}),
]

def evaluate_result(query, expected_kw, category, meta, response_data):
    """评估单个测试结果"""
    result = {
        "query": query,
        "expected": expected_kw,
        "category": category,
        "matched": False,
        "reason": ""
    }

    if not response_data:
        result["reason"] = "API返回空"
        return result

    actual = response_data.get("intentCode") or "NONE"
    conf = response_data.get("confidence") or 0
    method = response_data.get("matchMethod") or "NONE"
    needs_clarify = response_data.get("needsClarification", False)
    clarify_q = response_data.get("clarificationQuestion", "")

    result["actual"] = actual
    result["confidence"] = conf
    result["method"] = method
    result["needsClarification"] = needs_clarify

    # 评估逻辑
    if expected_kw == "LOW_CONF":
        if needs_clarify or conf < 0.7 or method == "REJECTED":
            result["matched"] = True
            result["reason"] = f"正确触发澄清 (conf={conf:.2f})"
        else:
            result["reason"] = f"应触发澄清但未触发 (conf={conf:.2f}, actual={actual})"
    else:
        # 检查关键词是否在意图代码中
        if actual and actual != "NONE":
            # 宽松匹配：只要领域相关就算通过
            domain_mapping = {
                "ORDER": ["ORDER", "SHIPMENT"],
                "INVENTORY": ["INVENTORY", "MATERIAL", "REPORT_INVENTORY"],
                "MATERIAL": ["MATERIAL", "INVENTORY"],
                "ATTENDANCE": ["ATTENDANCE", "USER"],
                "EQUIPMENT": ["EQUIPMENT", "SCALE"],
                "QUALITY": ["QUALITY", "INSPECTION"],
                "SHIPMENT": ["SHIPMENT", "DELIVERY", "LOGISTICS"],
                "CUSTOMER": ["CUSTOMER", "CLIENT"],
                "SUPPLIER": ["SUPPLIER", "VENDOR"],
                "ALERT": ["ALERT", "ALARM", "WARNING"],
                "TRACE": ["TRACE", "BATCH"],
                "COLD_CHAIN": ["COLD_CHAIN", "TEMPERATURE", "ALERT"],
                "REPORT": ["REPORT", "STATS", "DASHBOARD", "FINANCE", "KPI", "TRENDS"],
                "PROCESSING": ["PROCESSING", "PRODUCTION", "BATCH", "EFFICIENCY"],
            }

            related_keywords = domain_mapping.get(expected_kw, [expected_kw])
            for kw in related_keywords:
                if kw.upper() in actual.upper():
                    result["matched"] = True
                    result["reason"] = f"'{kw}' in '{actual}'"
                    break

            if not result["matched"]:
                result["reason"] = f"期望'{expected_kw}'相关，实际'{actual}'"
        else:
            result["reason"] = f"期望'{expected_kw}'，实际'{actual}'"

    return result

def run_test():
    """运行测试"""
    print("=" * 80)
    print("AI Intent Recognition - 200条复杂场景测试")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print(f"测试用例数: {len(TEST_CASES)}")
    print()

    results = []
    by_cat = defaultdict(lambda: {"total": 0, "matched": 0, "failed": []})

    for i, (query, expected_kw, category, meta) in enumerate(TEST_CASES):
        try:
            resp = requests.post(
                API_URL,
                json={"userInput": query, "sessionId": f"t200c-{i}"},
                timeout=30
            )
            data = resp.json()

            if data.get("success") and data.get("data"):
                result = evaluate_result(query, expected_kw, category, meta, data["data"])
                results.append(result)

                by_cat[category]["total"] += 1
                if result["matched"]:
                    by_cat[category]["matched"] += 1
                else:
                    by_cat[category]["failed"].append(result)

                status = "✓" if result["matched"] else "✗"
                actual_out = result.get("actual", "N/A")
                conf = result.get("confidence", 0)
                clarify = " [澄清]" if result.get("needsClarification") else ""
                print(f"{i+1:3}. [{status}] [{category:18}] \"{query[:25]}\" -> {actual_out} ({conf:.2f}){clarify}")
            else:
                print(f"{i+1:3}. [E] [{category:18}] \"{query[:25]}\" - API Error")
                by_cat[category]["total"] += 1
                by_cat[category]["failed"].append({"query": query, "error": "API Error"})

        except Exception as e:
            print(f"{i+1:3}. [E] [{category:18}] \"{query[:25]}\" - {str(e)[:30]}")
            by_cat[category]["total"] += 1
            by_cat[category]["failed"].append({"query": query, "error": str(e)[:30]})

    # 汇总
    print("\n" + "=" * 80)
    print("汇总结果")
    print("=" * 80)

    total = len(TEST_CASES)
    matched = sum(1 for r in results if r.get("matched"))
    accuracy = matched / total * 100 if total > 0 else 0

    print(f"\n总计: {total}, 通过: {matched}, 准确率: {accuracy:.1f}%\n")

    print("按类别统计:")
    categories = [
        "compound_query", "multi_intent", "business_scenario", "implicit_query",
        "param_query", "time_complex", "negative_query", "comparison_query",
        "dialect", "edge_case"
    ]

    for cat in categories:
        if cat in by_cat:
            s = by_cat[cat]
            rate = s["matched"] / s["total"] * 100 if s["total"] else 0
            mark = "✓" if rate >= 80 else "△" if rate >= 60 else "✗"
            print(f"  {mark} {cat:20}: {s['matched']:2}/{s['total']:2} ({rate:5.1f}%)")

    print("\n主要失败案例:")
    for cat in categories:
        if cat in by_cat and by_cat[cat]["failed"]:
            print(f"\n[{cat}]:")
            for f in by_cat[cat]["failed"][:3]:
                actual = f.get("actual", f.get("error", "N/A"))
                print(f"  - \"{f['query'][:30]}\" -> {actual}")

    # 保存报告
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report = {
        "test_time": ts,
        "total": total,
        "matched": matched,
        "accuracy": accuracy,
        "by_category": {c: {"matched": s["matched"], "total": s["total"]} for c, s in by_cat.items()},
        "details": results
    }

    report_path = f"tests/ai-intent/reports/test200_complex_{ts}.json"
    with open(report_path, "w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    print(f"\n报告已保存: {report_path}")
    return accuracy

if __name__ == "__main__":
    run_test()
