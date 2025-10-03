"""
白垩纪成本分析AI服务 - 快速测试脚本
"""

import requests
import json
from datetime import datetime

AI_SERVICE_URL = "http://localhost:8085"

def test_health_check():
    """测试1: 健康检查"""
    print("\n" + "="*60)
    print("测试1: 健康检查")
    print("="*60)

    try:
        response = requests.get(f"{AI_SERVICE_URL}/")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_cost_analysis():
    """测试2: 成本分析对话"""
    print("\n" + "="*60)
    print("测试2: 成本分析对话")
    print("="*60)

    # 测试用例：典型的成本分析请求
    test_message = """批次BATCH_20251003_00001的成本数据如下：

**批次信息**：
- 批次号: BATCH_20251003_00001
- 原材料: 大黄鱼 500kg
- 原材料成本: ¥2000 (4元/kg)
- 产品类别: 鲜品
- 预期售价: ¥12/kg

**成本结构**：
- 原材料成本: ¥2000 (55.6%)
- 人工成本: ¥1200 (33.3%)
- 设备成本: ¥400 (11.1%)
- 总成本: ¥3600

**人工统计**：
- 参与员工: 8人
- 总工时: 6小时
- 人工成本: ¥1200

**设备统计**：
- 使用设备: 切割机
- 总使用时长: 4小时
- 设备成本: ¥400

**利润分析**：
- 预期收入: ¥6000
- 利润: ¥2400 (40%)
- 盈亏平衡价: ¥7.2/kg

请分析：
1. 成本结构是否合理？
2. 人工成本占比33.3%是否正常？
3. 有什么优化建议？"""

    payload = {
        "message": test_message,
        "user_id": "test_factory_001"
    }

    try:
        print(f"\n📤 发送请求...")
        print(f"消息长度: {len(test_message)} 字符")

        response = requests.post(
            f"{AI_SERVICE_URL}/api/ai/chat",
            json=payload,
            timeout=30
        )

        print(f"\n📥 响应状态: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ 成功收到AI分析:")
            print("-" * 60)
            print(f"Session ID: {result['session_id']}")
            print(f"消息数: {result['message_count']}")
            print(f"\nAI回复:\n{result['reply']}")
            print("-" * 60)
            return True, result['session_id']
        else:
            print(f"❌ 错误: {response.text}")
            return False, None

    except Exception as e:
        print(f"❌ 错误: {e}")
        return False, None

def test_follow_up(session_id):
    """测试3: 后续提问（使用相同会话）"""
    print("\n" + "="*60)
    print("测试3: 后续提问（多轮对话）")
    print("="*60)

    if not session_id:
        print("⚠️ 跳过：无有效会话ID")
        return False

    # 后续问题
    follow_up_question = "基于上述分析，如果我想将人工成本降低到25%，需要减少多少人工或提高多少效率？"

    payload = {
        "message": follow_up_question,
        "session_id": session_id,
        "user_id": "test_factory_001"
    }

    try:
        print(f"\n📤 发送后续问题...")
        print(f"问题: {follow_up_question}")

        response = requests.post(
            f"{AI_SERVICE_URL}/api/ai/chat",
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ 后续回复:")
            print("-" * 60)
            print(f"消息数: {result['message_count']} (应该增加了)")
            print(f"\nAI回复:\n{result['reply']}")
            print("-" * 60)
            return True
        else:
            print(f"❌ 错误: {response.text}")
            return False

    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_session_history(session_id):
    """测试4: 获取会话历史"""
    print("\n" + "="*60)
    print("测试4: 获取会话历史")
    print("="*60)

    if not session_id:
        print("⚠️ 跳过：无有效会话ID")
        return False

    try:
        response = requests.get(
            f"{AI_SERVICE_URL}/api/ai/session/{session_id}",
            params={"user_id": "test_factory_001"}
        )

        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ 会话历史:")
            print("-" * 60)
            print(f"Session ID: {result['session_id']}")
            print(f"消息数: {len(result['messages'])}")
            print(f"\n消息列表:")
            for i, msg in enumerate(result['messages'], 1):
                role = "👤 用户" if msg['role'] == 'user' else "🤖 AI"
                content = msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content']
                print(f"  {i}. {role}: {content}")
            print("-" * 60)
            return True
        else:
            print(f"❌ 错误: {response.text}")
            return False

    except Exception as e:
        print(f"❌ 错误: {e}")
        return False

def test_different_scenarios():
    """测试5: 不同业务场景"""
    print("\n" + "="*60)
    print("测试5: 不同业务场景")
    print("="*60)

    scenarios = [
        {
            "name": "场景1: 设备效率分析",
            "message": "切割机使用了10小时，但只加工了200kg鱼类，小时成本50元。设备利用率如何？是否需要优化？"
        },
        {
            "name": "场景2: 员工效率分析",
            "message": "员工张三工作8小时，加工了150kg，CCR成本率2.5元/分钟。请评估其工作效率。"
        },
        {
            "name": "场景3: 利润优化建议",
            "message": "当前批次利润率只有15%，行业平均25%。如何提升？"
        }
    ]

    for scenario in scenarios:
        print(f"\n{scenario['name']}")
        print("-" * 60)

        payload = {
            "message": scenario['message'],
            "user_id": f"test_scenario_{datetime.now().timestamp()}"
        }

        try:
            response = requests.post(
                f"{AI_SERVICE_URL}/api/ai/chat",
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                print(f"✅ AI建议:\n{result['reply'][:200]}...")
            else:
                print(f"❌ 失败: {response.status_code}")

        except Exception as e:
            print(f"❌ 错误: {e}")

def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("🚀 白垩纪AI成本分析服务 - 完整测试")
    print("="*60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"AI服务URL: {AI_SERVICE_URL}")

    results = []

    # 测试1: 健康检查
    results.append(("健康检查", test_health_check()))

    # 测试2: 成本分析
    success, session_id = test_cost_analysis()
    results.append(("成本分析对话", success))

    # 测试3: 后续提问
    if session_id:
        results.append(("多轮对话", test_follow_up(session_id)))

    # 测试4: 会话历史
    if session_id:
        results.append(("会话历史", test_session_history(session_id)))

    # 测试5: 不同场景
    test_different_scenarios()

    # 汇总结果
    print("\n" + "="*60)
    print("📊 测试结果汇总")
    print("="*60)

    for test_name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"  {test_name}: {status}")

    total = len(results)
    passed = sum(1 for _, success in results if success)
    print(f"\n总计: {passed}/{total} 通过")

    if passed == total:
        print("\n🎉 所有测试通过！AI服务运行正常。")
    else:
        print(f"\n⚠️ {total - passed} 个测试失败，请检查服务配置。")

if __name__ == "__main__":
    try:
        run_all_tests()
    except KeyboardInterrupt:
        print("\n\n⚠️ 测试被用户中断")
    except Exception as e:
        print(f"\n\n❌ 测试失败: {e}")
