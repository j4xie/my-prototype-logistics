"""
食品知识库 API 端点
Food Knowledge Base API endpoints.

Endpoints:
  POST /api/food-kb/query          - Knowledge retrieval (RAG search)
  POST /api/food-kb/entity-lookup  - Entity dictionary lookup
  POST /api/food-kb/extract-entities - NER entity extraction
  POST /api/food-kb/ingest         - Ingest new knowledge document
  POST /api/food-kb/ingest-batch   - Batch ingest documents
  POST /api/food-kb/deprecate      - Deprecate a document
  GET  /api/food-kb/stats          - Knowledge base statistics
  GET  /api/food-kb/health         - Health check
  GET  /api/food-kb/ner-info       - NER service info
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.knowledge_retriever import get_knowledge_retriever
from ..services.document_ingester import get_document_ingester
from ..services.food_ner_service import get_food_ner_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================

class KnowledgeQueryRequest(BaseModel):
    query: str = Field(..., description="查询文本")
    categories: Optional[List[str]] = Field(None, description="过滤知识类别: standard, regulation, process, haccp, sop, additive, microbe")
    top_k: int = Field(5, ge=1, le=20, description="返回结果数量")
    similarity_threshold: float = Field(0.60, ge=0.0, le=1.0, description="最小相似度阈值 (P0-2: lowered from 0.72 to reduce false negatives)")
    include_expired: bool = Field(False, description="是否包含过期文档")


class EntityLookupRequest(BaseModel):
    entity_name: str = Field(..., description="实体名称, 如: 山梨酸钾, GB 2760")
    entity_type: Optional[str] = Field("", description="实体类型: ADDITIVE, STANDARD, EQUIPMENT, etc. 为空则搜索所有类型")


class NERRequest(BaseModel):
    text: str = Field(..., description="待提取实体的文本")
    use_model: bool = Field(True, description="是否使用模型(可用时)")


class IngestDocumentRequest(BaseModel):
    title: str = Field(..., description="文档标题")
    content: str = Field(..., min_length=10, description="文档全文内容")
    category: str = Field(..., description="文档类别: standard, regulation, process, haccp, sop, additive, microbe")
    source: str = Field("", description="来源: GB 2760-2024, 食品安全法")
    source_url: str = Field("", description="原文链接")
    version: str = Field("", description="版本号")
    effective_date: Optional[str] = Field(None, description="生效日期 YYYY-MM-DD")
    metadata: Optional[dict] = Field(None, description="扩展元数据")
    operator: str = Field("api", description="操作人")


class IngestBatchRequest(BaseModel):
    documents: List[IngestDocumentRequest] = Field(..., min_items=1, max_items=100)
    operator: str = Field("api", description="操作人")


class DeprecateRequest(BaseModel):
    document_id: int = Field(..., description="文档ID")
    reason: str = Field("", description="废弃原因")
    operator: str = Field("api", description="操作人")


# ============================================================
# Endpoints
# ============================================================

@router.post("/query")
async def query_knowledge(request: KnowledgeQueryRequest) -> dict:
    """
    知识检索 (RAG Search)

    基于向量相似度搜索食品法规、标准、工艺文档。
    返回最相关的知识条目及来源引用。
    """
    retriever = get_knowledge_retriever()
    if not retriever.is_ready():
        return {
            "success": False,
            "error": "Knowledge retriever not initialized. Ensure database is connected.",
            "data": [],
        }

    results = await retriever.retrieve(
        query=request.query,
        categories=request.categories,
        top_k=request.top_k,
        similarity_threshold=request.similarity_threshold,
        include_expired=request.include_expired,
    )

    return {
        "success": True,
        "query": request.query,
        "count": len(results),
        "data": [r.to_dict() for r in results],
    }


@router.post("/entity-lookup")
async def entity_lookup(request: EntityLookupRequest) -> dict:
    """
    实体字典查询

    在食品实体字典中查找添加剂、标准号、设备等实体的详细信息。
    支持别名查找。
    """
    retriever = get_knowledge_retriever()
    if not retriever.is_ready():
        return {"success": False, "error": "Knowledge retriever not initialized", "data": {}}

    result = await retriever.retrieve_by_entity(
        entity_type=request.entity_type or "",
        entity_name=request.entity_name,
    )

    return {
        "success": True,
        "query": request.entity_name,
        "data": result,
    }


@router.post("/extract-entities")
async def extract_entities(request: NERRequest) -> dict:
    """
    食品领域命名实体识别 (NER)

    从文本中提取食品领域实体:
    添加剂、标准号、设备、工艺参数、原料、微生物、危害物、
    检测方法、产品、认证、法规、营养成分、机构 (共13类)
    """
    ner_service = get_food_ner_service()

    entities = ner_service.extract_entities(
        text=request.text,
        use_model=request.use_model,
    )

    return {
        "success": True,
        "text": request.text,
        "entity_count": len(entities),
        "entities": [e.to_dict() for e in entities],
    }


@router.post("/ingest")
async def ingest_document(request: IngestDocumentRequest) -> dict:
    """
    入库单个知识文档

    自动分块、编码embedding、存入PostgreSQL。
    """
    ingester = get_document_ingester()
    if not ingester.is_ready():
        return {"success": False, "error": "Document ingester not initialized"}

    result = await ingester.ingest_document(
        title=request.title,
        content=request.content,
        category=request.category,
        source=request.source,
        source_url=request.source_url,
        version=request.version,
        effective_date=request.effective_date,
        metadata=request.metadata,
        operator=request.operator,
    )

    return result


@router.post("/ingest-batch")
async def ingest_batch(request: IngestBatchRequest) -> dict:
    """
    批量入库知识文档
    """
    ingester = get_document_ingester()
    if not ingester.is_ready():
        return {"success": False, "error": "Document ingester not initialized"}

    documents = [doc.dict() for doc in request.documents]
    result = await ingester.ingest_batch(
        documents=documents,
        operator=request.operator,
    )

    return result


@router.post("/deprecate")
async def deprecate_document(request: DeprecateRequest) -> dict:
    """
    废弃知识文档

    标记文档为不活跃，不再出现在检索结果中。
    记录审计日志。
    """
    ingester = get_document_ingester()
    if not ingester.is_ready():
        return {"success": False, "error": "Document ingester not initialized"}

    success = await ingester.deprecate_document(
        document_id=request.document_id,
        reason=request.reason,
        operator=request.operator,
    )

    return {"success": success}


@router.get("/stats")
async def knowledge_stats() -> dict:
    """
    知识库统计

    返回各类别的文档数量。
    """
    retriever = get_knowledge_retriever()
    if not retriever.is_ready():
        return {"success": False, "error": "Knowledge retriever not initialized", "data": {}}

    stats = await retriever.get_categories_stats()

    return {
        "success": True,
        "data": stats,
        "total": sum(stats.values()),
    }


@router.get("/ner-info")
async def ner_info() -> dict:
    """
    NER服务状态

    返回NER模型和字典的状态信息。
    """
    ner_service = get_food_ner_service()
    return {
        "success": True,
        "data": ner_service.get_info(),
    }


@router.get("/health")
async def health_check() -> dict:
    """
    健康检查

    检查知识库各组件的可用性。
    """
    from food_kb.services.reranker import get_reranker
    from food_kb.services.query_rewriter import get_query_rewriter

    retriever = get_knowledge_retriever()
    ingester = get_document_ingester()
    ner_service = get_food_ner_service()
    ner_info = ner_service.get_info()
    reranker = get_reranker()
    rewriter = get_query_rewriter()

    return {
        "success": True,
        "components": {
            "knowledge_retriever": retriever.is_ready(),
            "document_ingester": ingester.is_ready(),
            "ner_model": ner_info["model_available"],
            "ner_dictionary": ner_info["dictionary_available"],
            "reranker": reranker.is_enabled,
            "query_rewriter": True,
        },
        "reranker_stats": reranker.stats if reranker.is_enabled else None,
        "rewriter_stats": rewriter.stats,
    }
