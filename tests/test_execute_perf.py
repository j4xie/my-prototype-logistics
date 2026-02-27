#!/usr/bin/env python3
"""
AI Intent Execute 全流程性能测试
测试: 意图识别 → 工具执行 → 结果格式化 → 返回回复
"""
import requests, time, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://47.100.235.168:10010"
FACTORY = "F001"

def login():
    resp = requests.post(f"{BASE}/api/mobile/auth/unified-login",
                         json={"username": "factory_admin1", "password": "123456"})
    return resp.json()["data"]["accessToken"]

def execute(headers, text):
    start = time.time()
    resp = requests.post(f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                         headers=headers,
                         json={"userInput": text, "factoryId": FACTORY},
                         timeout=60)
    elapsed = time.time() - start
    data = resp.json().get("data", {})
    return {
        "time": elapsed,
        "intent": data.get("intentCode") or "?",
        "status": data.get("status") or "?",
        "method": data.get("matchMethod") or "?",
        "ft": data.get("formattedText") or "",
        "msg": data.get("message") or "",
        "http": resp.status_code,
    }

TESTS = [
    # (分类, 用户输入)
    ("问候", "你好"),
    ("问候", "帮我查点东西"),

    # 生产相关
    ("生产", "查看今天的生产批次"),
    ("生产", "今天的生产情况怎么样"),
    ("生产", "最近有哪些生产计划"),
    ("生产", "查看生产进度"),

    # 库存/仓储
    ("仓储", "查看当前库存情况"),
    ("仓储", "库存有多少"),
    ("仓储", "查看原材料库存"),

    # 质检
    ("质检", "最近的质检记录"),
    ("质检", "查看质检报告"),

    # 设备
    ("设备", "设备运行状态怎么样"),
    ("设备", "查看设备维护计划"),

    # 人事/考勤
    ("人事", "查看员工考勤"),
    ("人事", "今天谁请假了"),

    # 出货/物流
    ("物流", "查看最近的出货记录"),
    ("物流", "有哪些待发货订单"),

    # 报表
    ("报表", "生成今天的生产报表"),
    ("报表", "查看本月产量统计"),

    # 复杂分析
    ("分析", "分析一下最近的生产效率和产能利用率"),
    ("分析", "对比一下本月和上月的产量"),

    # 食品知识
    ("知识", "带鱼怎么保存"),
    ("知识", "HACCP是什么"),
]

def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    results = []
    print(f"\n{'='*90}")
    print(f"  AI Intent Execute 全流程性能测试 ({len(TESTS)} 条)")
    print(f"{'='*90}\n")

    for i, (cat, text) in enumerate(TESTS, 1):
        r = execute(headers, text)
        t = r['time']
        icon = "✅" if t < 2 else ("⚠️" if t < 5 else "❌")
        reply = (r['ft'] or r['msg'])[:80].replace('\n', ' ')

        print(f"{icon} [{i:2d}] {t:5.2f}s | {cat} | {r['intent']:<30} | {r['method']:<15} | {text}")
        if reply:
            print(f"         回复: {reply}")

        results.append((cat, text, t, r['intent'], r['method'], r['status']))

    # 汇总
    print(f"\n{'='*90}")
    print(f"  汇总")
    print(f"{'='*90}")

    times = [r[2] for r in results]
    fast = sum(1 for t in times if t < 2)
    medium = sum(1 for t in times if 2 <= t < 5)
    slow = sum(1 for t in times if t >= 5)

    print(f"\n  总计: {len(results)} 条")
    print(f"  ✅ < 2秒: {fast} 条")
    print(f"  ⚠️ 2-5秒: {medium} 条")
    print(f"  ❌ > 5秒: {slow} 条")
    print(f"  平均: {sum(times)/len(times):.2f}s")
    print(f"  最快: {min(times):.2f}s")
    print(f"  最慢: {max(times):.2f}s")

    # 按分类汇总
    cats = {}
    for cat, text, t, intent, method, status in results:
        cats.setdefault(cat, []).append(t)

    print(f"\n  按分类:")
    for cat, ts in cats.items():
        avg = sum(ts)/len(ts)
        icon = "✅" if avg < 2 else ("⚠️" if avg < 5 else "❌")
        print(f"    {icon} {cat}: 平均 {avg:.2f}s ({len(ts)} 条)")

    # 慢查询详情
    slow_queries = [(cat, text, t, intent) for cat, text, t, intent, _, _ in results if t >= 5]
    if slow_queries:
        print(f"\n  ❌ 慢查询 (>5s):")
        for cat, text, t, intent in slow_queries:
            print(f"    {t:.2f}s | {intent} | {text}")

if __name__ == "__main__":
    main()
