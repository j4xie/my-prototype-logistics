"""
白垩纪食品溯源系统 - AI食品加工数据分析服务（增强版）
基于 Llama-3.1-8B-Instruct 的智能分析API
支持Redis会话管理和多轮对话
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import requests
import json
import uuid
import time
from dotenv import load_dotenv

# 尝试导入Redis
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("⚠️  Redis未安装，会话管理功能将使用内存存储")

load_dotenv()

# ==================== 配置 ====================
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
HF_TOKEN = os.environ.get('HF_TOKEN', '')

# Redis配置
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_DB = int(os.environ.get('REDIS_DB', 0))

# ==================== Redis连接 ====================
redis_client = None
session_storage = {}  # 内存存储作为后备

if REDIS_AVAILABLE:
    try:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            decode_responses=True,
            socket_timeout=2,
            socket_connect_timeout=2
        )
        redis_client.ping()
        print(f"✅ Redis连接成功: {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        print(f"⚠️  Redis连接失败: {e}")
        print("使用内存存储作为后备")
        redis_client = None
else:
    print("使用内存存储（Redis未安装）")

# ==================== FastAPI 应用 ====================
app = FastAPI(title="食品加工数据分析 API (Enhanced)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 数据模型 ====================
class CostAnalysisRequest(BaseModel):
    message: str  # 成本数据的文本描述或追问内容
    user_id: str  # 工厂ID_batch_批次ID
    session_id: Optional[str] = None

# ==================== 会话管理 ====================
class SessionManager:
    """会话管理器 - 支持Redis和内存存储"""

    SESSION_TTL = 1800  # 30分钟

    @staticmethod
    def get_session(session_id: str) -> Optional[List[Dict]]:
        """获取会话历史"""
        if redis_client:
            try:
                data = redis_client.get(f"session:{session_id}")
                if data:
                    return json.loads(data)
            except Exception as e:
                print(f"Redis读取失败: {e}")

        # 后备：使用内存存储
        return session_storage.get(session_id)

    @staticmethod
    def save_session(session_id: str, messages: List[Dict]):
        """保存会话历史"""
        if redis_client:
            try:
                redis_client.setex(
                    f"session:{session_id}",
                    SessionManager.SESSION_TTL,
                    json.dumps(messages, ensure_ascii=False)
                )
                return
            except Exception as e:
                print(f"Redis写入失败: {e}")

        # 后备：使用内存存储
        session_storage[session_id] = messages

    @staticmethod
    def create_session_id() -> str:
        """创建新会话ID"""
        return f"session_{uuid.uuid4().hex[:16]}"

# ==================== 核心功能 ====================
def query_llama(messages: list) -> str:
    """调用Llama模型"""
    if not HF_TOKEN:
        raise HTTPException(status_code=500, detail="HF_TOKEN未配置")

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "meta-llama/Llama-3.1-8B-Instruct",
        "messages": messages,
        "max_tokens": 4000,  # 增加到4000以获得更详细的分析
        "temperature": 0.7
    }

    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"⚠️  AI调用失败: {e}")
        raise

def generate_mock_analysis(cost_message: str) -> str:
    """生成模拟分析（Fallback）"""
    return f"""📊 **成本结构分析**

根据最近一批次的生产成本数据，我们发现：

| 成本类别 | 占比（%） |
| --- | --- |
| 原材料 | 40% |
| 人工 | 30% |
| 设备 | 15% |
| 能耗 | 10% |
| 其他 | 5% |

👀 **发现的问题**

1. **人工成本占比过高**：人工成本占比达到了30%，高于行业平均值，可能是由于工人工资过高或生产效率低下。
2. **设备成本占比过低**：设备成本占比仅为15%，低于行业平均值，可能是由于设备利用率过低或设备维护不当。
3. **能耗成本占比过高**：能耗成本占比达到了10%，高于行业平均值，可能是由于生产过程中能耗效率低下。

💡 **优化建议**

1. **优化工人工资结构**：与工人协商，调整工资结构，降低高收入工人比例，提高生产效率。
2. **提高设备利用率**：分析设备使用情况，调整生产计划，确保设备利用率达到80%以上。
3. **节能改造**：实施节能改造，例如使用高效照明灯具、优化生产流程等，降低能耗成本。

📈 **预期效果**

通过实施上述建议，预计可以降低人工成本占比到25%，设备成本占比到18%，能耗成本占比到8%。预计可节省成本约10万元人民币，提高生产效率和利润率。

*(注: 这是Mock分析，AI服务暂时不可用)*
"""

# ==================== API 端点 ====================
@app.get("/")
async def root():
    """健康检查"""
    return {
        "service": "食品加工数据分析 API (Enhanced)",
        "status": "running",
        "model": "Llama-3.1-8B-Instruct",
        "version": "2.0.0",
        "features": {
            "session_management": True,
            "redis_enabled": redis_client is not None,
            "multi_turn_conversation": True
        }
    }

@app.post("/api/ai/chat")
async def cost_analysis(request: CostAnalysisRequest):
    """
    AI成本分析接口（增强版）
    支持多轮对话和会话管理
    """
    try:
        # 1. 获取或创建会话ID
        session_id = request.session_id if request.session_id else SessionManager.create_session_id()

        # 2. 获取会话历史
        conversation_history = SessionManager.get_session(session_id)
        if conversation_history is None:
            conversation_history = []

        # 3. 构建消息列表
        messages = []

        # 添加系统提示（仅在新会话时）
        if len(conversation_history) == 0:
            messages.append({
                "role": "system",
                "content": """你是食品加工企业的成本分析专家。你的任务是分析生产批次的成本数据，提供专业的成本优化建议。

请按照以下结构输出分析结果：
1. 📊 成本结构分析 - 分析各项成本占比
2. ⚠️ 发现的问题 - 指出3-4个具体问题
3. 💡 优化建议 - 提供可执行的具体措施
4. 📈 预期效果 - 量化节省预测

使用中文输出，保持专业和简洁。"""
            })

        # 添加历史对话
        messages.extend(conversation_history)

        # 添加当前用户消息
        messages.append({
            "role": "user",
            "content": request.message
        })

        # 4. 调用AI模型
        try:
            ai_analysis = query_llama(messages)
            use_mock = False
        except Exception as ai_error:
            print(f"⚠️  AI调用失败，使用模拟分析: {ai_error}")
            ai_analysis = generate_mock_analysis(request.message)
            use_mock = True

        # 5. 保存对话历史
        conversation_history.append({
            "role": "user",
            "content": request.message
        })
        conversation_history.append({
            "role": "assistant",
            "content": ai_analysis
        })

        # 限制历史长度（保留最近10轮对话）
        if len(conversation_history) > 20:  # 10轮 x 2条消息
            conversation_history = conversation_history[-20:]

        SessionManager.save_session(session_id, conversation_history)

        # 6. 返回结果
        return {
            "success": True,
            "aiAnalysis": ai_analysis,
            "sessionId": session_id,
            "messageCount": len(conversation_history) // 2,  # 轮数
            "timestamp": int(time.time() * 1000),
            "useMock": use_mock
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI分析失败: {str(e)}")

@app.get("/api/ai/session/{session_id}")
async def get_session_history(session_id: str):
    """获取会话历史"""
    history = SessionManager.get_session(session_id)

    if history is None:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")

    return {
        "success": True,
        "sessionId": session_id,
        "messageCount": len(history) // 2,
        "history": history
    }

@app.delete("/api/ai/session/{session_id}")
async def clear_session(session_id: str):
    """清除会话历史"""
    if redis_client:
        try:
            redis_client.delete(f"session:{session_id}")
        except Exception as e:
            print(f"Redis删除失败: {e}")

    if session_id in session_storage:
        del session_storage[session_id]

    return {
        "success": True,
        "message": f"会话 {session_id} 已清除"
    }

# ==================== 启动 ====================
if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🚀 启动AI成本分析服务（增强版）")
    print("="*50)
    print(f"Model: Llama-3.1-8B-Instruct")
    print(f"Port: 8085")
    print(f"Redis: {'✅ 已连接' if redis_client else '❌ 未连接（使用内存存储）'}")
    print(f"Session TTL: {SessionManager.SESSION_TTL}秒")
    print("="*50 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8085)
