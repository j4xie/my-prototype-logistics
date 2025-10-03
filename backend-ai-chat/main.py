"""
白垩纪食品溯源系统 (Creta) - AI成本分析服务
基于 Hugging Face Llama-3.1-8B-Instruct 模型的智能成本分析API
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import json
import requests
import redis
from datetime import datetime, timedelta
import hashlib
import uuid
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

# ==================== 配置 ====================
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
HF_TOKEN = os.environ.get('HF_TOKEN', '')  # 从环境变量获取
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))
SESSION_EXPIRE_HOURS = 24  # 会话过期时间（小时）

# ==================== FastAPI 应用初始化 ====================
app = FastAPI(
    title="白垩纪 AI 成本分析 API",
    description="水产加工企业智能成本分析助手服务",
    version="1.0.0"
)

# CORS配置 - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",  # 白垩纪后端API
        "http://localhost:3010",  # React Native开发服务器
        "http://localhost:8081",  # Expo开发服务器
        "http://localhost:19000", # Expo开发服务器备用端口
        "http://localhost:19006", # Expo Web端口
        "*",  # 开发阶段允许所有来源（生产环境需要限制）
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis客户端（用于存储会话历史）
try:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    print("✅ Redis连接成功")
except Exception as e:
    print(f"⚠️ Redis连接失败，将使用内存存储: {e}")
    redis_client = None

# 内存存储备份（如果Redis不可用）
memory_sessions: Dict[str, List[dict]] = {}

# ==================== 数据模型 ====================
class Message(BaseModel):
    role: str  # "user" 或 "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # 会话ID，如果为空则创建新会话
    user_id: Optional[str] = None  # 用户ID（可选，用于隔离不同用户的会话）

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    message_count: int  # 当前会话消息数

class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: List[Message]
    created_at: str
    updated_at: str

# ==================== 工具函数 ====================
def generate_session_id(user_id: Optional[str] = None) -> str:
    """生成唯一会话ID"""
    timestamp = datetime.now().isoformat()
    random_id = str(uuid.uuid4())
    raw = f"{user_id or 'anonymous'}:{timestamp}:{random_id}"
    return hashlib.md5(raw.encode()).hexdigest()

def get_session_key(session_id: str, user_id: Optional[str] = None) -> str:
    """生成Redis存储键"""
    if user_id:
        return f"ai_chat:session:{user_id}:{session_id}"
    return f"ai_chat:session:{session_id}"

def get_session_history(session_id: str, user_id: Optional[str] = None) -> List[dict]:
    """获取会话历史"""
    session_key = get_session_key(session_id, user_id)

    if redis_client:
        try:
            history_json = redis_client.get(session_key)
            if history_json:
                return json.loads(history_json)
        except Exception as e:
            print(f"⚠️ Redis读取失败: {e}")

    # 备份：使用内存存储
    return memory_sessions.get(session_key, [])

def save_session_history(session_id: str, messages: List[dict], user_id: Optional[str] = None):
    """保存会话历史"""
    session_key = get_session_key(session_id, user_id)

    if redis_client:
        try:
            redis_client.setex(
                session_key,
                timedelta(hours=SESSION_EXPIRE_HOURS),
                json.dumps(messages, ensure_ascii=False)
            )
            return
        except Exception as e:
            print(f"⚠️ Redis保存失败: {e}")

    # 备份：使用内存存储
    memory_sessions[session_key] = messages

def query_llama(messages: List[dict], stream: bool = False):
    """
    调用Hugging Face Llama模型

    Args:
        messages: 消息历史列表
        stream: 是否使用流式返回
    """
    if not HF_TOKEN:
        raise HTTPException(status_code=500, detail="HF_TOKEN未配置")

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": messages,
        "model": "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai",
        "stream": stream,
        "max_tokens": 1000,  # 限制回复长度
        "temperature": 0.7,  # 控制随机性
    }

    try:
        if stream:
            # 流式返回（用于实时显示）
            response = requests.post(HF_API_URL, headers=headers, json=payload, stream=True)
            response.raise_for_status()

            full_content = ""
            for line in response.iter_lines():
                if not line or not line.startswith(b"data:"):
                    continue
                if line.strip() == b"data: [DONE]":
                    break

                try:
                    chunk = json.loads(line.decode("utf-8").lstrip("data:").rstrip("/n"))
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    full_content += content
                except json.JSONDecodeError:
                    continue

            return full_content
        else:
            # 非流式返回（等待完整响应）
            response = requests.post(HF_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    except requests.exceptions.RequestException as e:
        print(f"❌ Hugging Face API调用失败: {e}")
        raise HTTPException(status_code=500, detail=f"AI模型调用失败: {str(e)}")

# ==================== API端点 ====================
@app.get("/")
async def root():
    """健康检查"""
    return {
        "service": "白垩纪 AI 成本分析 API",
        "status": "running",
        "version": "1.0.0",
        "model": "Llama-3.1-8B-Instruct",
        "purpose": "水产加工成本优化分析",
        "redis_available": redis_client is not None
    }

@app.post("/api/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    发送消息并获取AI回复

    - **message**: 用户消息内容
    - **session_id**: 会话ID（可选，不提供则创建新会话）
    - **user_id**: 用户ID（可选，用于隔离不同用户）
    """
    # 1. 获取或创建会话
    session_id = request.session_id or generate_session_id(request.user_id)

    # 2. 获取历史消息
    history = get_session_history(session_id, request.user_id)

    # 3. 添加系统提示（仅第一次）
    if not history:
        history.append({
            "role": "system",
            "content": """你是白垩纪食品溯源系统的AI成本分析助手，专门帮助水产加工企业进行成本优化和分析。你的任务是：

1. **成本分析建议**：
   - 分析原材料成本、人工成本、设备成本的合理性
   - 识别成本异常点（如人工成本过高、设备利用率低等）
   - 提供成本优化建议

2. **生产效率优化**：
   - 分析员工工作效率（通过CCR成本率和加工数量）
   - 建议最优的人员配置和排班
   - 识别生产瓶颈和改进方向

3. **设备使用优化**：
   - 分析设备使用时长和成本效益
   - 建议设备维护时机
   - 识别设备闲置或过度使用情况

4. **利润分析**：
   - 评估批次盈利能力
   - 计算盈亏平衡点
   - 提供定价策略建议

**回复要求**：
- 使用简洁、专业的语言
- 提供具体的数字和百分比分析
- 给出可操作的改进建议
- 如果数据不足，说明需要哪些额外信息
- 始终用中文回复

**示例场景**：
用户可能会问：
- "这个批次的人工成本占比45%，是否正常？"
- "设备A使用了8小时但只加工了100kg，效率如何？"
- "如何降低原材料损耗？"

请根据实际数据提供专业分析和建议。"""
        })

    # 4. 添加用户消息
    history.append({
        "role": "user",
        "content": request.message
    })

    # 5. 调用AI模型
    try:
        ai_reply = query_llama(history, stream=False)
    except Exception as e:
        print(f"❌ AI调用失败: {e}")
        # 回退到默认回复
        ai_reply = "抱歉，我现在无法回答这个问题。请稍后再试。"

    # 6. 添加AI回复到历史
    history.append({
        "role": "assistant",
        "content": ai_reply
    })

    # 7. 保存会话历史
    save_session_history(session_id, history, request.user_id)

    # 8. 返回响应
    return ChatResponse(
        reply=ai_reply,
        session_id=session_id,
        message_count=len(history)
    )

@app.get("/api/ai/session/{session_id}", response_model=SessionHistoryResponse)
async def get_session(session_id: str, user_id: Optional[str] = None):
    """
    获取会话历史记录

    - **session_id**: 会话ID
    - **user_id**: 用户ID（可选）
    """
    history = get_session_history(session_id, user_id)

    if not history:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")

    # 过滤掉系统消息（不返回给前端）
    user_messages = [msg for msg in history if msg["role"] != "system"]

    return SessionHistoryResponse(
        session_id=session_id,
        messages=user_messages,
        created_at=datetime.now().isoformat(),  # 简化版，实际应存储
        updated_at=datetime.now().isoformat()
    )

@app.delete("/api/ai/session/{session_id}")
async def delete_session(session_id: str, user_id: Optional[str] = None):
    """
    删除会话（清空历史）

    - **session_id**: 会话ID
    - **user_id**: 用户ID（可选）
    """
    session_key = get_session_key(session_id, user_id)

    if redis_client:
        try:
            redis_client.delete(session_key)
        except Exception as e:
            print(f"⚠️ Redis删除失败: {e}")

    # 内存存储也删除
    if session_key in memory_sessions:
        del memory_sessions[session_key]

    return {"message": "会话已删除", "session_id": session_id}

@app.post("/api/ai/reset")
async def reset_conversation(session_id: str, user_id: Optional[str] = None):
    """
    重置会话（清空历史但保留会话ID）
    """
    await delete_session(session_id, user_id)
    return {
        "message": "会话已重置",
        "session_id": session_id
    }

# ==================== 启动配置 ====================
if __name__ == "__main__":
    import uvicorn

    # 检查环境变量
    if not HF_TOKEN:
        print("⚠️ 警告: HF_TOKEN 环境变量未设置")
        print("请设置: export HF_TOKEN=your_huggingface_token")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8085,  # 与测试环境API端口一致
        reload=True  # 开发模式自动重载
    )
