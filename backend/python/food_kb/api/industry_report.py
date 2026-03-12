"""
行业报告 RAG 入库与检索 API
Industry Report RAG ingestion and retrieval endpoints.

Endpoints:
  POST /api/food-kb/industry-report/ingest  - Upload and ingest industry reports
  GET  /api/food-kb/industry-report/search   - Search relevant report passages
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from ..services.knowledge_retriever import get_knowledge_retriever
from ..services.document_ingester import get_document_ingester

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================

class IndustryReportIngestRequest(BaseModel):
    title: str = Field(..., description="报告标题, 如: 2025年中国餐饮行业发展报告")
    content: str = Field(..., min_length=20, description="报告全文内容")
    source: str = Field("", description="来源, 如: 美团研究院, 中国连锁经营协会")
    publish_date: str = Field("", description="发布日期 YYYY-MM-DD")
    industry_tags: List[str] = Field(
        default_factory=list,
        description="行业标签, 如: ['餐饮', '火锅', '快餐', '供应链']"
    )
    report_type: str = Field(
        "general",
        description="报告类型: general(综合), market(市场), benchmark(基准), policy(政策)"
    )
    source_url: str = Field("", description="原文链接")
    operator: str = Field("api", description="操作人")


class IndustryReportBatchIngestRequest(BaseModel):
    documents: List[IndustryReportIngestRequest] = Field(
        ..., min_items=1, max_items=50, description="批量报告列表"
    )
    operator: str = Field("api", description="操作人")


# ============================================================
# Endpoints
# ============================================================

@router.post("/ingest")
async def ingest_industry_report(request: IndustryReportIngestRequest) -> dict:
    """
    入库行业报告

    将 PDF/文本行业报告分块、编码 embedding、存入 PostgreSQL + pgvector。
    使用 industry_report 分块策略 (chunk_size=1500, overlap=200)。
    """
    ingester = get_document_ingester()
    if not ingester.is_ready():
        return {"success": False, "error": "Document ingester not initialized"}

    metadata = {
        "publish_date": request.publish_date,
        "industry_tags": request.industry_tags,
        "report_type": request.report_type,
    }

    result = await ingester.ingest_document(
        title=request.title,
        content=request.content,
        category="industry_report",
        source=request.source,
        source_url=request.source_url,
        version="",
        effective_date=request.publish_date or None,
        metadata=metadata,
        operator=request.operator,
    )

    return result


@router.post("/ingest-batch")
async def ingest_industry_reports_batch(
    request: IndustryReportBatchIngestRequest,
) -> dict:
    """
    批量入库行业报告
    """
    ingester = get_document_ingester()
    if not ingester.is_ready():
        return {"success": False, "error": "Document ingester not initialized"}

    documents = []
    for doc in request.documents:
        documents.append({
            "title": doc.title,
            "content": doc.content,
            "category": "industry_report",
            "source": doc.source,
            "source_url": doc.source_url,
            "version": "",
            "effective_date": doc.publish_date or None,
            "metadata": {
                "publish_date": doc.publish_date,
                "industry_tags": doc.industry_tags,
                "report_type": doc.report_type,
            },
        })

    result = await ingester.ingest_batch(
        documents=documents,
        operator=request.operator,
    )

    return result


@router.get("/search")
async def search_industry_reports(
    query: str = Query(..., description="搜索文本, 如: 餐饮行业食材成本率"),
    industry_filter: Optional[str] = Query(
        None, description="行业过滤, 如: 餐饮, 火锅, 快餐"
    ),
    top_k: int = Query(5, ge=1, le=20, description="返回结果数量"),
    similarity_threshold: float = Query(
        0.55, ge=0.0, le=1.0,
        description="最小相似度阈值 (行业报告用较低阈值以提高召回率)"
    ),
) -> dict:
    """
    搜索行业报告段落

    基于向量相似度 + BM25 混合检索，返回最相关的行业报告段落及来源引用。
    支持按行业标签过滤。
    """
    retriever = get_knowledge_retriever()
    if not retriever.is_ready():
        return {
            "success": False,
            "error": "Knowledge retriever not initialized",
            "data": [],
        }

    # Always filter to industry_report category
    categories = ["industry_report"]

    results = await retriever.retrieve(
        query=query,
        categories=categories,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
    )

    # Post-filter by industry_filter (check metadata.industry_tags)
    if industry_filter and results:
        filtered = []
        for doc in results:
            meta = doc.metadata
            if isinstance(meta, str):
                import json
                try:
                    meta = json.loads(meta)
                except (json.JSONDecodeError, TypeError):
                    meta = {}
            tags = meta.get("industry_tags", [])
            if isinstance(tags, list) and any(
                industry_filter in tag for tag in tags
            ):
                filtered.append(doc)
            elif not tags:
                # Include docs without tags (don't exclude them)
                filtered.append(doc)
        # If filter removed all results, return unfiltered to avoid empty
        if filtered:
            results = filtered

    return {
        "success": True,
        "query": query,
        "industry_filter": industry_filter,
        "count": len(results),
        "data": [
            {
                **r.to_dict(),
                "source_citation": f"[{r.source}]" if r.source else "",
            }
            for r in results
        ],
    }
