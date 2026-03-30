"""
操作手册 AI 聊天端点
RAG-powered chat endpoint for the operation manual assistant.

POST /api/food-kb/manual-chat
POST /api/food-kb/manual-chat/related  (async related questions)
"""

import asyncio
import hashlib
import logging
import time
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.knowledge_retriever import get_knowledge_retriever

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Cache: LRU with TTL for frequent questions (improvement #2)
_CACHE_MAX_SIZE = 100
_CACHE_TTL_SECONDS = 3600  # 1 hour
_answer_cache: "OrderedDict[str, Tuple[dict, float]]" = OrderedDict()  # type: ignore

# Query expansion map for short queries (improvement #3)
_QUERY_EXPANSIONS: Dict[str, str] = {
    "进销存": "进销存 进货 销售 库存 采购入库 成品出库 仓储管理",
    "bom": "BOM 配方 转换率 物料清单 原辅料 配料表",
    "BOM": "BOM 配方 转换率 物料清单 原辅料 配料表",
    "报工": "报工 三步报工 工序操作 产量记录 生产报告 工时",
    "排产": "排产 排程 排产计划 生产排程 计划下发 产线安排",
    "质检": "质检 质量检测 检验 品控 不合格 质量管理",
    "溯源": "溯源 追溯 批次追踪 食品追溯 链路追踪",
    "采购": "采购 采购入库 供应商 采购单 原料采购 进货",
    "销售": "销售 销售出库 出库 发货 销售订单 客户",
    "AI": "AI 人工智能 AI助手 意图 智能分析 语音",
    "仓库": "仓库 仓储 库存 入库 出库 调拨 盘点",
    "设备": "设备 设备管理 维护 保养 巡检 设备台账",
    "客户": "客户 客户管理 CRM 客户定价 联系人",
    "调拨": "调拨 内部调拨 转库 物料转移 仓间调拨",
    "首页": "首页 主页 工作台 快捷操作 布局 卡片",
    "登录": "登录 注册 认证 密码 账号 token",
}

# Complexity keywords for token budget (improvement #5)
_SIMPLE_KEYWORDS = {"是什么", "什么是", "在哪", "哪里", "多少", "几个", "有没有", "支持吗", "能不能"}
_COMPLEX_KEYWORDS = {"怎么", "如何", "步骤", "流程", "对比", "分析", "区别", "原理", "为什么", "详细"}

# ---------------------------------------------------------------------------
# System prompt (improvement #4)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
你是「白垩纪 AI Agent」操作手册助手。

回答原则:
1. 严格基于检索文档回答，文档未提及的功能回答「该功能暂未记录在操作手册中」
2. 系统名称统一用「白垩纪 AI Agent」
3. 不使用 emoji，保持专业简洁
4. 菜单路径用 → 连接，如: 首页 → 仓储管理 → 入库

格式规范:
- 简单问题(是什么/在哪): 直接回答，不超过3行
- 操作类问题(怎么/如何): 用**编号步骤**，每步一行，步骤末尾标注菜单路径
- 概念类问题: 先一句话总结，再展开要点

结构模板(操作类):
**操作步骤:**
1. 进入 xxx → yyy
2. 点击「按钮名」
3. 填写/选择 ...

**注意事项:** (如有)
- 仅在有重要提醒时添加此节"""


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str = Field(..., description="消息角色: user/assistant")
    content: str = Field(..., description="消息内容")


class ManualChatRequest(BaseModel):
    question: str = Field(..., description="用户问题")
    history: Optional[List[ChatMessage]] = Field(default=None, description="历史对话")


class RelatedQuestionsRequest(BaseModel):
    question: str = Field(..., description="原始用户问题")
    answer: str = Field(..., description="AI回答内容")


class SourceRef(BaseModel):
    title: str
    source: str
    similarity: float


class ManualChatResponse(BaseModel):
    answer: str
    sources: List[SourceRef]


# ---------------------------------------------------------------------------
# Cache helpers (improvement #2)
# ---------------------------------------------------------------------------

def _cache_key(question: str) -> str:
    """Normalize question into a stable cache key."""
    normalized = question.strip().lower()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[dict]:
    """Return cached response if present and not expired."""
    if key not in _answer_cache:
        return None
    entry, ts = _answer_cache[key]
    if time.time() - ts > _CACHE_TTL_SECONDS:
        _answer_cache.pop(key, None)
        return None
    # Move to end (most recently used)
    _answer_cache.move_to_end(key)
    return entry


def _cache_put(key: str, value: dict) -> None:
    """Store a response in the cache, evicting LRU if full."""
    _answer_cache[key] = (value, time.time())
    _answer_cache.move_to_end(key)
    while len(_answer_cache) > _CACHE_MAX_SIZE:
        _answer_cache.popitem(last=False)


# ---------------------------------------------------------------------------
# Query expansion (improvement #3)
# ---------------------------------------------------------------------------

def _expand_query(question: str) -> str:
    """
    For short queries (< 10 chars), expand with domain synonyms to improve
    BM25 and vector recall.  Returns the original question if no expansion
    applies or the question is already long enough.
    """
    if len(question) >= 10:
        return question

    for keyword, expansion in _QUERY_EXPANSIONS.items():
        if keyword in question:
            return f"{question} {expansion}"

    return question


# ---------------------------------------------------------------------------
# Token budget (improvement #5)
# ---------------------------------------------------------------------------

def _estimate_max_tokens(question: str) -> int:
    """
    Choose an LLM max_tokens budget based on question complexity.
    Simple factual → 300, how-to → 600, complex → 1200.
    """
    q = question.strip()

    # Complex analysis questions
    complex_count = sum(1 for kw in _COMPLEX_KEYWORDS if kw in q)
    if complex_count >= 2 or len(q) > 60:
        return 1200

    # How-to questions (single keyword match)
    if complex_count >= 1:
        return 600

    # Simple factual
    if any(kw in q for kw in _SIMPLE_KEYWORDS):
        return 300

    # Default: moderate
    return 600


# ---------------------------------------------------------------------------
# Main chat endpoint
# ---------------------------------------------------------------------------

@router.post("/manual-chat")
async def manual_chat(request: ManualChatRequest) -> dict:
    """
    操作手册 RAG 聊天

    Improvements over v1:
    - LRU cache for repeat questions (skip retrieval + LLM)
    - Query expansion for short queries
    - Lower similarity threshold (0.40) + higher top_k (8)
    - Structured system prompt with length control
    - Adaptive max_tokens budget
    - Related questions generated in background task
    """
    has_history = bool(request.history and len(request.history) > 0)

    # ------ Improvement #2: cache lookup (skip for contextual questions) ------
    c_key = _cache_key(request.question)
    if not has_history:
        cached = _cache_get(c_key)
        if cached is not None:
            logger.info(f"Cache hit for question: {request.question[:40]}...")
            return cached

    retriever = get_knowledge_retriever()
    if not retriever.is_ready():
        return {
            "success": False,
            "message": "知识库服务未初始化",
            "answer": "抱歉，知识库服务暂不可用，请稍后重试。",
            "sources": [],
            "related_questions": [],
        }

    # ------ Improvement #3: query expansion for short queries ------
    expanded_question = _expand_query(request.question)

    # ------ Improvement #3: lower threshold + higher top_k ------
    try:
        results = await retriever.retrieve(
            query=expanded_question,
            categories=["operation_manual"],
            top_k=8,
            similarity_threshold=0.40,
        )
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        results = []

    # Build context from retrieved docs
    context_parts = []
    sources = []
    for doc in results:
        context_parts.append(f"[{doc.title}]\n{doc.content}")
        sources.append(SourceRef(
            title=doc.title,
            source=doc.source,
            similarity=round(doc.similarity, 4),
        ))

    context_text = (
        "\n\n---\n\n".join(context_parts)
        if context_parts
        else "未找到相关文档内容。"
    )

    # ------ Improvement #4: structured system prompt ------
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.append({
        "role": "system",
        "content": f"以下是从操作手册中检索到的相关内容，请基于这些内容回答用户问题：\n\n{context_text}",
    })

    # Add chat history (last 10 turns)
    if request.history:
        for msg in request.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": request.question})

    # ------ Improvement #5: adaptive max_tokens ------
    max_tokens = _estimate_max_tokens(request.question)

    # Call LLM for the answer
    try:
        from config import get_settings
        from common.llm_client import get_llm_http_client

        settings = get_settings()
        client = get_llm_http_client()

        resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_fast_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.3,
                "enable_thinking": False,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        answer = data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        if context_parts:
            answer = f"AI 服务暂时不可用，以下是检索到的相关内容：\n\n{context_parts[0]}"
        else:
            answer = "抱歉，暂时无法回答您的问题。请查看操作手册对应章节。"

    # ------ Improvement #1: generate related questions in background ------
    related_future: asyncio.Task[List[str]] = asyncio.create_task(
        _generate_related_questions(request.question, answer)
    )

    # Await the background task -- it has its own timeout so won't block long
    try:
        related_questions = await asyncio.wait_for(related_future, timeout=8.0)
    except (asyncio.TimeoutError, Exception):
        related_questions = []

    response = {
        "success": True,
        "answer": answer,
        "sources": [s.dict() for s in sources],
        "related_questions": related_questions,
    }

    # ------ Improvement #2: populate cache (skip contextual) ------
    if not has_history:
        _cache_put(c_key, response)

    return response


# ---------------------------------------------------------------------------
# Separate related-questions endpoint (improvement #1)
# ---------------------------------------------------------------------------

@router.post("/manual-chat/related")
async def related_questions_endpoint(request: RelatedQuestionsRequest) -> dict:
    """
    Generate related follow-up questions from a previous answer.

    Intended for frontend to call AFTER displaying the answer, so the main
    chat response is never delayed by this secondary LLM call.
    """
    questions = await _generate_related_questions(request.question, request.answer)
    return {"success": True, "related_questions": questions}


# ---------------------------------------------------------------------------
# Shared helper: generate related questions
# ---------------------------------------------------------------------------

async def _generate_related_questions(question: str, answer: str) -> List[str]:
    """
    Call LLM to produce 3 follow-up questions.  Best-effort: returns []
    on any failure.
    """
    try:
        from config import get_settings
        from common.llm_client import get_llm_http_client

        settings = get_settings()
        client = get_llm_http_client()

        rq_resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_fast_model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "基于用户的问题和AI的回答，生成3个用户最可能接着问的相关问题。"
                            "只输出问题列表，每行一个，不要编号不要解释。"
                            "严格要求：问题必须是AI回答中提到过的功能或操作，"
                            "不要推荐回答中没有提到的功能。"
                            "系统名称是「白垩纪 AI Agent」。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"用户问: {question}\nAI答: {answer[:300]}",
                    },
                ],
                "max_tokens": 150,
                "temperature": 0.5,
                "enable_thinking": False,
            },
            timeout=8.0,
        )
        rq_resp.raise_for_status()
        rq_text = rq_resp.json()["choices"][0]["message"]["content"]
        return [
            q.strip().lstrip("0123456789.、）)").lstrip("•-·").strip()
            for q in rq_text.strip().split("\n")
            if q.strip() and len(q.strip()) > 4
        ][:4]
    except Exception as e:
        logger.debug(f"Related questions generation failed (non-critical): {e}")
        return []
