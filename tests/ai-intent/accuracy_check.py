# -*- coding: utf-8 -*-
import sys
import requests
import json

sys.stdout.reconfigure(encoding='utf-8')

# 抽样测试用例 - 预期关键词
TEST_CASES = [
    # === 简单查询 (8条) ===
    ("查看今天的订单", "ORDER", "simple"),
    ("显示所有产品", "PRODUCT", "simple"),
    ("库存查询", "INVENTORY", "simple"),
    ("员工考勤记录", "ATTENDANCE", "simple"),
    ("查看设备状态", "EQUIPMENT", "simple"),
    ("质检报告", "QUALITY", "simple"),
    ("生产批次列表", "BATCH", "simple"),
    ("客户信息", "CUSTOMER", "simple"),

    # === 高风险操作 (6条) - Phase 1 ===
    ("删除订单O001", "DELETE", "high_risk"),
    ("取消生产批次", "CANCEL", "high_risk"),
    ("清空库存", "CLEAR", "high_risk"),
    ("删除用户", "DELETE", "high_risk"),
    ("批量删除数据", "DELETE", "high_risk"),
    ("重置配置", "RESET", "high_risk"),

    # === 歧义输入 (6条) - Phase 3 应触发澄清或低置信度 ===
    ("查一下", "LOW_CONF", "ambiguous"),
    ("那个订单", "LOW_CONF", "ambiguous"),
    ("帮我处理", "LOW_CONF", "ambiguous"),
    ("看看", "LOW_CONF", "ambiguous"),
    ("有问题", "LOW_CONF", "ambiguous"),
    ("这个", "LOW_CONF", "ambiguous"),

    # === 复杂查询 (6条) ===
    ("本月销售额超过1万的订单", "ORDER", "complex"),
    ("最近7天库存变动", "INVENTORY", "complex"),
    ("按部门统计考勤", "ATTENDANCE", "complex"),
    ("生产效率报告", "REPORT", "complex"),
    ("质检不合格的批次", "QUALITY", "complex"),
    ("供应商评估分析", "SUPPLIER", "complex"),

    # === 多意图 (4条) ===
    ("查看订单并导出", "ORDER", "multi"),
    ("库存查询和预警", "INVENTORY", "multi"),
    ("考勤统计和报表", "ATTENDANCE", "multi"),
    ("设备状态和维护", "EQUIPMENT", "multi"),

    # === 拼写错误 (4条) ===
    ("查旬订单", "ORDER", "typo"),
    ("库存插询", "INVENTORY", "typo"),
    ("蛇备状态", "EQUIPMENT", "typo"),
    ("考琴记录", "ATTENDANCE", "typo"),

    # === 领域特定 (4条) ===
    ("溯源码查询", "TRACE", "domain"),
    ("HACCP检查", "QUALITY", "domain"),
    ("冷链温度", "COLD_CHAIN", "domain"),
    ("批次追溯", "TRACE", "domain"),
]

def main():
    print("=" * 70)
    print("AI Intent Recognition - 准确性抽样验证")
    print("=" * 70)
    print(f"抽样数量: {len(TEST_CASES)}")
    print()

    results = []

    for i, (query, expected_kw, category) in enumerate(TEST_CASES):
        try:
            resp = requests.post(
                "http://139.196.165.140:10010/api/public/ai-demo/recognize",
                json={"userInput": query, "sessionId": f"accuracy-test-{i}"},
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            data = resp.json()

            if data.get("success") and data.get("data"):
                actual = data["data"].get("intentCode", "NONE")
                confidence = data["data"].get("confidence", 0)
                method = data["data"].get("matchMethod", "NONE")

                # 判断匹配
                if expected_kw == "LOW_CONF":
                    # 歧义输入应该是低置信度或触发澄清
                    matched = confidence < 0.7 or "CLARIF" in actual.upper() or "UNKNOWN" in actual.upper()
                    reason = f"conf={confidence:.2f}" + (" <0.7 OK" if matched else " >=0.7 TOO HIGH")
                else:
                    # 检查关键词是否在意图代码中
                    matched = expected_kw.upper() in actual.upper()
                    reason = f"'{expected_kw}' in '{actual}'" if matched else f"'{expected_kw}' NOT in '{actual}'"

                results.append({
                    "query": query,
                    "expected_kw": expected_kw,
                    "actual": actual,
                    "confidence": confidence,
                    "method": method,
                    "category": category,
                    "matched": matched,
                    "reason": reason
                })

                status = "✓" if matched else "✗"
                print(f"{i+1:2}. [{status}] [{category:10}] \"{query}\"")
                print(f"     预期关键词: {expected_kw:15} 实际: {actual}")
                print(f"     置信度: {confidence:.2f}, 方法: {method}")
                print(f"     判断: {reason}")
                print()

            else:
                error_msg = data.get("message", "Unknown error")
                print(f"{i+1:2}. [E] [{category:10}] \"{query}\" - {error_msg}")
                results.append({"query": query, "matched": False, "category": category, "error": error_msg})
                print()

        except Exception as e:
            print(f"{i+1:2}. [E] [{category:10}] \"{query}\" - {str(e)[:50]}")
            results.append({"query": query, "matched": False, "category": category, "error": str(e)})
            print()

    # 汇总
    print()
    print("=" * 70)
    print("汇总结果")
    print("=" * 70)

    total = len(results)
    matched = sum(1 for r in results if r.get("matched", False))
    print(f"总计: {total}, 匹配: {matched}, 准确率: {matched/total*100:.1f}%")
    print()

    # 按类别统计
    from collections import defaultdict
    by_cat = defaultdict(lambda: {"total": 0, "matched": 0, "examples": []})

    for r in results:
        cat = r.get("category", "unknown")
        by_cat[cat]["total"] += 1
        if r.get("matched", False):
            by_cat[cat]["matched"] += 1
        else:
            by_cat[cat]["examples"].append(r)

    print("按类别统计:")
    print("-" * 50)
    for cat in ["simple", "high_risk", "ambiguous", "complex", "multi", "typo", "domain"]:
        if cat in by_cat:
            stats = by_cat[cat]
            rate = stats["matched"] / stats["total"] * 100 if stats["total"] > 0 else 0
            status = "✓" if rate >= 70 else "△" if rate >= 50 else "✗"
            print(f"  {status} {cat:12}: {stats['matched']}/{stats['total']} ({rate:.0f}%)")

    print()
    print("=" * 70)
    print("未匹配案例分析")
    print("=" * 70)

    for cat, stats in by_cat.items():
        if stats["examples"]:
            print(f"\n[{cat}] 未匹配 {len(stats['examples'])} 条:")
            for ex in stats["examples"][:3]:  # 最多显示3条
                print(f"  - \"{ex.get('query', '')}\"")
                print(f"    预期: {ex.get('expected_kw', '')}, 实际: {ex.get('actual', ex.get('error', ''))}")

    # 保存详细结果
    output_file = "tests/ai-intent/reports/accuracy_check_result.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "total": total,
            "matched": matched,
            "accuracy": matched/total*100,
            "by_category": {cat: {"matched": s["matched"], "total": s["total"]} for cat, s in by_cat.items()},
            "details": results
        }, f, ensure_ascii=False, indent=2)

    print(f"\n详细结果已保存: {output_file}")

if __name__ == "__main__":
    main()
