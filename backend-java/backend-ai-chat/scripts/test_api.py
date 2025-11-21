"""
测试AI Chat API的简单脚本
"""

import requests
import json

BASE_URL = "http://localhost:8085"

def test_health_check():
    """测试健康检查"""
    print("\n📡 测试1: 健康检查")
    response = requests.get(f"{BASE_URL}/")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

def test_chat():
    """测试对话功能"""
    print("\n💬 测试2: 发送消息")

    # 第一条消息
    message1 = {
        "message": "你好，请介绍一下PomeloX平台",
        "user_id": "test_user_123"
    }

    response1 = requests.post(f"{BASE_URL}/api/ai/chat", json=message1)
    print(f"状态码: {response1.status_code}")
    data1 = response1.json()
    print(f"AI回复: {data1['reply']}")
    print(f"会话ID: {data1['session_id']}")

    session_id = data1['session_id']

    # 第二条消息（继续对话）
    print("\n💬 测试3: 继续对话")
    message2 = {
        "message": "能详细说说活动管理功能吗？",
        "session_id": session_id,
        "user_id": "test_user_123"
    }

    response2 = requests.post(f"{BASE_URL}/api/ai/chat", json=message2)
    data2 = response2.json()
    print(f"AI回复: {data2['reply']}")
    print(f"消息总数: {data2['message_count']}")

    return session_id

def test_get_session(session_id):
    """测试获取会话历史"""
    print("\n📜 测试4: 获取会话历史")
    response = requests.get(
        f"{BASE_URL}/api/ai/session/{session_id}",
        params={"user_id": "test_user_123"}
    )
    print(f"状态码: {response.status_code}")
    data = response.json()
    print(f"会话消息数: {len(data['messages'])}")
    for i, msg in enumerate(data['messages'], 1):
        print(f"\n消息{i} [{msg['role']}]:")
        print(f"  {msg['content'][:100]}...")

def test_delete_session(session_id):
    """测试删除会话"""
    print("\n🗑️ 测试5: 删除会话")
    response = requests.delete(
        f"{BASE_URL}/api/ai/session/{session_id}",
        params={"user_id": "test_user_123"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 PomeloX AI Chat API 测试")
    print("=" * 60)

    try:
        # 运行所有测试
        test_health_check()
        session_id = test_chat()
        test_get_session(session_id)
        test_delete_session(session_id)

        print("\n" + "=" * 60)
        print("✅ 所有测试完成")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务器")
        print("请确保后端服务已启动: python main.py")
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
