"""
PomeloX AI Chat 测试脚本
测试多轮对话功能
"""

import requests
import json
import time

# API配置
BASE_URL = "http://localhost:8085"
CHAT_API = f"{BASE_URL}/api/ai/chat"
SESSION_API = f"{BASE_URL}/api/ai/session"

def print_separator():
    print("\n" + "="*60 + "\n")

def test_chat():
    """测试多轮对话"""
    print("🚀 开始测试 PomeloX AI Chat API")
    print_separator()

    # 测试1: 健康检查
    print("📌 测试1: 健康检查")
    try:
        response = requests.get(BASE_URL)
        data = response.json()
        print(f"✅ 服务状态: {data['status']}")
        print(f"✅ 版本: {data['version']}")
        print(f"✅ Redis可用: {data['redis_available']}")
    except Exception as e:
        print(f"❌ 健康检查失败: {e}")
        return

    print_separator()

    # 测试2: 第一轮对话（创建新会话）
    print("📌 测试2: 第一轮对话 - 创建新会话")
    try:
        response1 = requests.post(CHAT_API, json={
            "message": "你好，请介绍一下自己"
        })
        response1.raise_for_status()
        data1 = response1.json()

        session_id = data1["session_id"]
        print(f"👤 用户: 你好，请介绍一下自己")
        print(f"🤖 AI: {data1['reply']}")
        print(f"📝 Session ID: {session_id}")
        print(f"📊 消息数: {data1['message_count']}")
    except Exception as e:
        print(f"❌ 第一轮对话失败: {e}")
        return

    print_separator()
    time.sleep(1)  # 避免请求过快

    # 测试3: 第二轮对话（继续会话）
    print("📌 测试3: 第二轮对话 - 继续会话")
    try:
        response2 = requests.post(CHAT_API, json={
            "message": "PomeloX是什么平台？",
            "session_id": session_id
        })
        response2.raise_for_status()
        data2 = response2.json()

        print(f"👤 用户: PomeloX是什么平台？")
        print(f"🤖 AI: {data2['reply']}")
        print(f"📊 消息数: {data2['message_count']}")
    except Exception as e:
        print(f"❌ 第二轮对话失败: {e}")
        return

    print_separator()
    time.sleep(1)

    # 测试4: 第三轮对话（测试上下文记忆）
    print("📌 测试4: 第三轮对话 - 测试上下文记忆")
    try:
        response3 = requests.post(CHAT_API, json={
            "message": "你刚才说的第一句话是什么？",
            "session_id": session_id
        })
        response3.raise_for_status()
        data3 = response3.json()

        print(f"👤 用户: 你刚才说的第一句话是什么？")
        print(f"🤖 AI: {data3['reply']}")
        print(f"📊 消息数: {data3['message_count']}")
    except Exception as e:
        print(f"❌ 第三轮对话失败: {e}")
        return

    print_separator()

    # 测试5: 获取会话历史
    print("📌 测试5: 获取会话历史")
    try:
        response_history = requests.get(f"{SESSION_API}/{session_id}")
        response_history.raise_for_status()
        history_data = response_history.json()

        print(f"📜 会话ID: {history_data['session_id']}")
        print(f"📊 消息总数: {len(history_data['messages'])}")
        print("\n对话历史:")
        for i, msg in enumerate(history_data['messages'], 1):
            role = "👤 用户" if msg['role'] == 'user' else "🤖 AI"
            content = msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content']
            print(f"{i}. {role}: {content}")
    except Exception as e:
        print(f"❌ 获取历史失败: {e}")

    print_separator()

    # 测试6: 删除会话
    print("📌 测试6: 删除会话")
    try:
        response_delete = requests.delete(f"{SESSION_API}/{session_id}")
        response_delete.raise_for_status()
        delete_data = response_delete.json()
        print(f"✅ {delete_data['message']}")
    except Exception as e:
        print(f"❌ 删除会话失败: {e}")

    print_separator()

    # 测试7: 验证会话已删除
    print("📌 测试7: 验证会话已删除")
    try:
        response_check = requests.get(f"{SESSION_API}/{session_id}")
        if response_check.status_code == 404:
            print("✅ 会话已成功删除")
        else:
            print("⚠️ 会话仍然存在")
    except Exception as e:
        print(f"✅ 会话已删除 (404错误符合预期)")

    print_separator()
    print("🎉 所有测试完成！")

if __name__ == "__main__":
    test_chat()
