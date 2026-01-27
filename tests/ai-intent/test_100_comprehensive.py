# -*- coding: utf-8 -*-
"""
AI Intent Recognition - 100 Case Comprehensive Test
"""
import sys
import requests
import json
from datetime import datetime
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

TEST_CASES = [
    # === simple (20) ===
    ("查看订单", "ORDER", "simple"),
    ("今天的订单", "ORDER", "simple"),
    ("订单列表", "ORDER", "simple"),
    ("库存查询", "INVENTORY", "simple"),
    ("查看库存", "INVENTORY", "simple"),
    ("设备状态", "EQUIPMENT", "simple"),
    ("查看设备", "EQUIPMENT", "simple"),
    ("考勤记录", "ATTENDANCE", "simple"),
    ("员工出勤", "ATTENDANCE", "simple"),
    ("质检报告", "QUALITY", "simple"),
    ("质量检查", "QUALITY", "simple"),
    ("生产批次", "BATCH", "simple"),
    ("批次列表", "BATCH", "simple"),
    ("客户信息", "CUSTOMER", "simple"),
    ("客户列表", "CUSTOMER", "simple"),
    ("供应商查询", "SUPPLIER", "simple"),
    ("物料信息", "MATERIAL", "simple"),
    ("原料查询", "MATERIAL", "simple"),
    ("发货记录", "SHIPMENT", "simple"),
    ("告警列表", "ALERT", "simple"),
    # === high_risk (15) ===
    ("删除订单", "DELETE", "high_risk"),
    ("删除用户", "DELETE", "high_risk"),
    ("删除客户", "DELETE", "high_risk"),
    ("删除设备", "DELETE", "high_risk"),
    ("删除供应商", "DELETE", "high_risk"),
    ("清空库存", "CLEAR", "high_risk"),
    ("批量删除数据", "DELETE", "high_risk"),
    ("重置配置", "RESET", "high_risk"),
    ("取消订单", "CANCEL", "high_risk"),
    ("取消生产批次", "CANCEL", "high_risk"),
    ("作废订单", "DELETE", "high_risk"),
    ("移除用户", "DELETE", "high_risk"),
    ("注销账号", "DELETE", "high_risk"),
    ("删除物料", "DELETE", "high_risk"),
    ("清除数据", "DELETE", "high_risk"),
    # === ambiguous (15) ===
    ("查一下", "LOW_CONF", "ambiguous"),
    ("看看", "LOW_CONF", "ambiguous"),
    ("帮我处理", "LOW_CONF", "ambiguous"),
    ("有问题", "LOW_CONF", "ambiguous"),
    ("这个", "LOW_CONF", "ambiguous"),
    ("那个", "LOW_CONF", "ambiguous"),
    ("数据", "LOW_CONF", "ambiguous"),
    ("报表", "LOW_CONF", "ambiguous"),
    ("统计", "LOW_CONF", "ambiguous"),
    ("分析", "LOW_CONF", "ambiguous"),
    ("好的", "LOW_CONF", "ambiguous"),
    ("可以", "LOW_CONF", "ambiguous"),
    ("嗯", "LOW_CONF", "ambiguous"),
    ("处理一下", "LOW_CONF", "ambiguous"),
    ("看一下", "LOW_CONF", "ambiguous"),
    # === complex (15) ===
    ("本月销售统计", "REPORT", "complex"),
    ("最近7天库存变动", "INVENTORY", "complex"),
    ("按部门统计考勤", "ATTENDANCE", "complex"),
    ("生产效率报告", "REPORT", "complex"),
    ("质检不合格的批次", "QUALITY", "complex"),
    ("供应商评估分析", "SUPPLIER", "complex"),
    ("本周发货情况", "SHIPMENT", "complex"),
    ("设备维护记录", "EQUIPMENT", "complex"),
    ("客户订单统计", "ORDER", "complex"),
    ("物料消耗报表", "MATERIAL", "complex"),
    ("今日生产进度", "PROCESSING", "complex"),
    ("异常告警统计", "ALERT", "complex"),
    ("库存预警列表", "INVENTORY", "complex"),
    ("员工绩效报表", "ATTENDANCE", "complex"),
    ("质量趋势分析", "QUALITY", "complex"),
    # === multi (10) ===
    ("查看订单并导出", "ORDER", "multi"),
    ("库存查询和预警", "INVENTORY", "multi"),
    ("考勤统计和报表", "ATTENDANCE", "multi"),
    ("设备状态和维护", "EQUIPMENT", "multi"),
    ("客户信息和订单", "CUSTOMER", "multi"),
    ("质检记录和统计", "QUALITY", "multi"),
    ("发货记录和跟踪", "SHIPMENT", "multi"),
    ("物料库存和预警", "MATERIAL", "multi"),
    ("生产计划和进度", "PROCESSING", "multi"),
    ("供应商信息和评估", "SUPPLIER", "multi"),
    # === typo (10) ===
    ("查旬订单", "ORDER", "typo"),
    ("库存插询", "INVENTORY", "typo"),
    ("考琴记录", "ATTENDANCE", "typo"),
    ("涉备状态", "EQUIPMENT", "typo"),
    ("帮我看看订单", "ORDER", "typo"),
    ("库存咋样", "INVENTORY", "typo"),
    ("设备啥情况", "EQUIPMENT", "typo"),
    ("有没有告警", "ALERT", "typo"),
    ("订单咋了", "ORDER", "typo"),
    ("今天单子多不多", "ORDER", "typo"),
    # === domain (15) ===
    ("溯源码查询", "TRACE", "domain"),
    ("批次追溯", "TRACE", "domain"),
    ("HACCP检查", "QUALITY", "domain"),
    ("冷链温度", "COLD_CHAIN", "domain"),
    ("温度监控", "COLD_CHAIN", "domain"),
    ("生产批号", "BATCH", "domain"),
    ("出库单", "SHIPMENT", "domain"),
    ("入库记录", "MATERIAL", "domain"),
    ("打卡记录", "ATTENDANCE", "domain"),
    ("工时统计", "ATTENDANCE", "domain"),
    ("产线状态", "EQUIPMENT", "domain"),
    ("原料检验", "QUALITY", "domain"),
    ("成品检验", "QUALITY", "domain"),
    ("物流跟踪", "SHIPMENT", "domain"),
    ("采购订单", "ORDER", "domain"),
]

API_URL = "http://139.196.165.140:10010/api/public/ai-demo/recognize"

def run_test():
    print("=" * 70)
    print("AI Intent Recognition - 100条综合测试")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print(f"测试用例数: {len(TEST_CASES)}")
    print()

    results = []
    by_cat = defaultdict(lambda: {"total": 0, "matched": 0, "failed": []})

    for i, (query, expected_kw, category) in enumerate(TEST_CASES):
        try:
            resp = requests.post(API_URL, json={"userInput": query, "sessionId": f"t100-{i}"}, timeout=30)
            data = resp.json()
            if data.get("success") and data.get("data"):
                d = data["data"]
                actual = d.get("intentCode") or "NONE"
                conf = d.get("confidence") or 0
                method = d.get("matchMethod") or "NONE"
                needs_clarify = d.get("needsClarification", False)

                if expected_kw == "LOW_CONF":
                    matched = needs_clarify or conf < 0.7 or method == "REJECTED"
                else:
                    matched = expected_kw.upper() in actual.upper() if actual and actual != "NONE" else False

                results.append({"query": query, "expected": expected_kw, "actual": actual, "conf": conf, "matched": matched, "category": category, "clarify": needs_clarify})
                by_cat[category]["total"] += 1
                if matched:
                    by_cat[category]["matched"] += 1
                else:
                    by_cat[category]["failed"].append({"query": query, "expected": expected_kw, "actual": actual})

                s = "✓" if matched else "✗"
                out = "澄清" if needs_clarify else f"{actual} ({conf:.2f})"
                print(f"{i+1:3}. [{s}] [{category:10}] \"{query}\" -> {out}")
            else:
                print(f"{i+1:3}. [E] [{category:10}] \"{query}\" - API Error")
                by_cat[category]["total"] += 1
                by_cat[category]["failed"].append({"query": query, "error": "API"})
        except Exception as e:
            print(f"{i+1:3}. [E] [{category:10}] \"{query}\" - {str(e)[:30]}")
            by_cat[category]["total"] += 1
            by_cat[category]["failed"].append({"query": query, "error": str(e)[:30]})

    print("\n" + "=" * 70)
    print("汇总结果")
    print("=" * 70)
    total = len(TEST_CASES)
    matched = sum(1 for r in results if r.get("matched"))
    print(f"\n总计: {total}, 通过: {matched}, 准确率: {matched/total*100:.1f}%\n")

    print("按类别:")
    for cat in ["simple", "high_risk", "ambiguous", "complex", "multi", "typo", "domain"]:
        if cat in by_cat:
            s = by_cat[cat]
            r = s["matched"]/s["total"]*100 if s["total"] else 0
            mark = "✓" if r >= 80 else "△" if r >= 60 else "✗"
            print(f"  {mark} {cat:12}: {s['matched']:2}/{s['total']:2} ({r:5.1f}%)")

    print("\n未通过案例:")
    for cat in ["simple", "high_risk", "ambiguous", "complex", "multi", "typo", "domain"]:
        if cat in by_cat and by_cat[cat]["failed"]:
            print(f"\n[{cat}]:")
            for f in by_cat[cat]["failed"][:3]:
                print(f"  - \"{f['query']}\" -> {f.get('actual', f.get('error', 'N/A'))}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(f"tests/ai-intent/reports/test100_report_{ts}.json", "w", encoding="utf-8") as fp:
        json.dump({"total": total, "matched": matched, "accuracy": matched/total*100, "by_category": {c: {"matched": s["matched"], "total": s["total"]} for c,s in by_cat.items()}, "details": results}, fp, ensure_ascii=False, indent=2)
    print(f"\n报告: tests/ai-intent/reports/test100_report_{ts}.json")

if __name__ == "__main__":
    run_test()
