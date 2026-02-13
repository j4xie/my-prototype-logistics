from __future__ import annotations
"""
AI Proxy Stub Routes

Provides stub endpoints for /api/ai/* that Java backend calls.
These endpoints use DashScope LLM to handle:
- Rule parsing
- State machine parsing
- Intent classification/clarification
- Form schema generation
- Factory batch initialization

Java backend calls these via RestTemplate at http://localhost:8083/api/ai/...
"""
import logging
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from smartbi.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Proxy"])


# ============================================================================
# Request/Response Models
# ============================================================================

class RuleParseRequest(BaseModel):
    rule_text: str = Field(..., description="Natural language rule description")
    rule_type: Optional[str] = Field(None, description="Rule type hint")
    context: Optional[Dict[str, Any]] = Field(default=None)


class StateMachineParseRequest(BaseModel):
    description: str = Field(..., description="State machine description")
    states: Optional[List[str]] = Field(default=None)
    context: Optional[Dict[str, Any]] = Field(default=None)


class IntentClassifyRequest(BaseModel):
    text: str = Field(..., description="User input text")
    candidates: Optional[List[str]] = Field(default=None, description="Candidate intents")
    context: Optional[Dict[str, Any]] = Field(default=None)


class IntentClarifyRequest(BaseModel):
    text: str = Field(..., description="User input text")
    current_intent: Optional[str] = Field(None)
    ambiguous_intents: Optional[List[str]] = Field(default=None)
    context: Optional[Dict[str, Any]] = Field(default=None)


class DataOperationParseRequest(BaseModel):
    text: str = Field(..., description="User input describing data operation")
    available_entities: Optional[List[str]] = Field(default=None)
    context: Optional[Dict[str, Any]] = Field(default=None)


class FormSchemaRequest(BaseModel):
    description: str = Field(..., description="Form description")
    entity_type: Optional[str] = Field(None)
    fields_hint: Optional[List[str]] = Field(default=None)
    context: Optional[Dict[str, Any]] = Field(default=None)


class FactoryInitRequest(BaseModel):
    factory_description: str = Field(..., description="Factory description")
    factory_name: Optional[str] = Field(None)
    industry_hint: Optional[str] = Field(None)
    include_business_data: bool = Field(default=True)


# ============================================================================
# LLM Helper
# ============================================================================

async def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
    """Call DashScope LLM API"""
    settings = get_settings()
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM API key not configured")

    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/rule/parse")
async def parse_rule(request: RuleParseRequest):
    """Parse natural language rule into structured format"""
    start = time.time()
    try:
        result = await _call_llm(
            system_prompt="你是规则解析引擎。将自然语言业务规则转换为结构化的 JSON 条件-动作规则。输出纯JSON。",
            user_prompt=f"请将以下业务规则解析为结构化JSON格式：\n\n{request.rule_text}\n\n规则类型提示：{request.rule_type or '自动检测'}"
        )
        return {
            "success": True,
            "data": {"parsed_rule": result, "rule_type": request.rule_type},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Rule parse error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.post("/state-machine/parse")
async def parse_state_machine(request: StateMachineParseRequest):
    """Parse state machine description into structured format"""
    start = time.time()
    try:
        result = await _call_llm(
            system_prompt="你是状态机设计专家。将自然语言描述转换为状态机定义（状态、转换、条件）。输出纯JSON。",
            user_prompt=f"请将以下描述解析为状态机JSON格式：\n\n{request.description}\n\n已知状态：{request.states or '自动检测'}"
        )
        return {
            "success": True,
            "data": {"state_machine": result},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"State machine parse error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.get("/rule/health")
async def rule_health():
    """Health check for rule parsing service"""
    settings = get_settings()
    return {
        "status": "healthy" if settings.llm_api_key else "degraded",
        "service": "ai-rule",
        "llm_configured": bool(settings.llm_api_key),
        "model": settings.llm_model
    }


@router.post("/intent/classify")
async def classify_intent(request: IntentClassifyRequest):
    """Classify user intent using LLM"""
    start = time.time()
    try:
        candidates_str = "\n".join(f"- {c}" for c in request.candidates) if request.candidates else "自动检测所有可能意图"
        result = await _call_llm(
            system_prompt="你是意图分类器。根据用户输入判断最匹配的意图。返回JSON：{\"intent\": \"意图代码\", \"confidence\": 0.95, \"reasoning\": \"理由\"}",
            user_prompt=f"用户输入：{request.text}\n\n候选意图：\n{candidates_str}"
        )
        return {
            "success": True,
            "data": {"classification": result},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Intent classify error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.post("/intent/clarify")
async def clarify_intent(request: IntentClarifyRequest):
    """Generate clarification question for ambiguous intent"""
    start = time.time()
    try:
        result = await _call_llm(
            system_prompt="你是对话助手。当用户意图不明确时，生成一个澄清问题帮助确认意图。返回JSON：{\"question\": \"澄清问题\", \"options\": [\"选项1\", \"选项2\"]}",
            user_prompt=f"用户输入：{request.text}\n\n当前识别意图：{request.current_intent or '未识别'}\n模糊意图列表：{request.ambiguous_intents or []}"
        )
        return {
            "success": True,
            "data": {"clarification": result},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Intent clarify error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.get("/intent/health")
async def intent_health():
    """Health check for intent classification service"""
    settings = get_settings()
    return {
        "status": "healthy" if settings.llm_api_key else "degraded",
        "service": "ai-intent",
        "llm_configured": bool(settings.llm_api_key),
        "model": settings.llm_model
    }


@router.post("/intent/parse-data-operation")
async def parse_data_operation(request: DataOperationParseRequest):
    """Parse user input into data operation intent"""
    start = time.time()
    try:
        entities_str = ", ".join(request.available_entities) if request.available_entities else "自动检测"
        result = await _call_llm(
            system_prompt="你是数据操作解析器。将用户的自然语言描述转换为数据操作指令。返回JSON：{\"operation\": \"QUERY/CREATE/UPDATE/DELETE\", \"entity\": \"实体名\", \"conditions\": {}, \"fields\": []}",
            user_prompt=f"用户输入：{request.text}\n\n可用实体：{entities_str}"
        )
        return {
            "success": True,
            "data": {"operation": result},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Data operation parse error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.post("/form/generate-schema")
async def generate_form_schema(request: FormSchemaRequest):
    """Generate form schema from description"""
    start = time.time()
    try:
        result = await _call_llm(
            system_prompt="你是表单设计专家。根据描述生成表单Schema（字段名、类型、验证规则、标签）。返回JSON格式的表单定义。",
            user_prompt=f"请为以下场景生成表单Schema：\n\n{request.description}\n\n实体类型：{request.entity_type or '自动检测'}\n字段提示：{request.fields_hint or '自动生成'}",
            max_tokens=3000
        )
        return {
            "success": True,
            "data": {"schema": result},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Form schema generate error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}


@router.post("/factory/batch-initialize")
async def batch_initialize_factory(request: FactoryInitRequest):
    """AI-powered factory configuration initialization"""
    start = time.time()
    try:
        result = await _call_llm(
            system_prompt=(
                "你是食品加工工厂配置专家。根据工厂描述生成完整的初始化配置，包括：\n"
                "1. 生产线配置\n2. 质检标准\n3. 仓储分区\n4. 人员角色\n5. 业务流程\n"
                "返回结构化JSON配置。"
            ),
            user_prompt=(
                f"工厂名称：{request.factory_name or '未知'}\n"
                f"行业提示：{request.industry_hint or '食品加工'}\n"
                f"工厂描述：{request.factory_description}\n"
                f"是否包含业务数据：{request.include_business_data}"
            ),
            max_tokens=4000
        )
        return {
            "success": True,
            "data": {"configuration": result, "factory_name": request.factory_name},
            "elapsed_ms": int((time.time() - start) * 1000)
        }
    except Exception as e:
        logger.error(f"Factory batch initialize error: {e}", exc_info=True)
        return {"success": False, "message": "处理失败，请稍后重试", "data": None}
