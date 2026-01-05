"""
Sentence-BERT Embedding 服务
用于语义缓存的文本向量化

模型: paraphrase-multilingual-MiniLM-L12-v2
维度: 384
支持: 50+ 语言包括中文
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/embedding", tags=["Embedding"])

# 全局模型实例 (懒加载)
_model = None
_model_name = "paraphrase-multilingual-MiniLM-L12-v2"

def get_model():
    """懒加载 Sentence-BERT 模型"""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading Sentence-BERT model: {_model_name}")
            _model = SentenceTransformer(_model_name)
            logger.info(f"Model loaded successfully. Embedding dimension: {_model.get_sentence_embedding_dimension()}")
        except ImportError:
            logger.error("sentence-transformers not installed. Run: pip install sentence-transformers")
            raise HTTPException(status_code=500, detail="sentence-transformers not installed")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load embedding model: {str(e)}")
    return _model


# ==================== 数据模型 ====================

class EmbeddingRequest(BaseModel):
    """文本向量化请求"""
    texts: List[str] = Field(..., description="要向量化的文本列表", min_items=1, max_items=100)
    normalize: bool = Field(True, description="是否 L2 归一化 (用于余弦相似度)")

class EmbeddingResponse(BaseModel):
    """文本向量化响应"""
    success: bool
    embeddings: List[List[float]]
    dimension: int
    count: int
    model: str

class SimilarityRequest(BaseModel):
    """相似度计算请求"""
    query: str = Field(..., description="查询文本")
    candidates: List[str] = Field(..., description="候选文本列表", min_items=1, max_items=100)
    threshold: float = Field(0.85, ge=0.0, le=1.0, description="相似度阈值")
    top_k: int = Field(5, ge=1, le=20, description="返回前 K 个结果")

class SimilarityResult(BaseModel):
    """单个相似度结果"""
    index: int
    text: str
    score: float

class SimilarityResponse(BaseModel):
    """相似度计算响应"""
    success: bool
    results: List[SimilarityResult]
    query: str
    total_candidates: int
    matched_count: int

class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    model_loaded: bool
    model_name: str
    dimension: Optional[int] = None


# ==================== API 端点 ====================

@router.get("/health", response_model=HealthResponse)
async def embedding_health():
    """Embedding 服务健康检查"""
    try:
        model = get_model()
        return HealthResponse(
            status="healthy",
            model_loaded=True,
            model_name=_model_name,
            dimension=model.get_sentence_embedding_dimension()
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            model_loaded=False,
            model_name=_model_name,
            dimension=None
        )


@router.post("/encode", response_model=EmbeddingResponse)
async def encode_texts(request: EmbeddingRequest):
    """
    将文本列表转换为向量表示

    - texts: 要向量化的文本列表 (1-100 条)
    - normalize: 是否 L2 归一化 (默认 True，用于余弦相似度计算)

    返回 384 维向量列表
    """
    try:
        model = get_model()

        # 过滤空文本
        texts = [t.strip() for t in request.texts if t.strip()]
        if not texts:
            raise HTTPException(status_code=400, detail="No valid texts provided")

        # 编码
        embeddings = model.encode(
            texts,
            normalize_embeddings=request.normalize,
            show_progress_bar=False
        )

        return EmbeddingResponse(
            success=True,
            embeddings=embeddings.tolist(),
            dimension=embeddings.shape[1],
            count=len(texts),
            model=_model_name
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Encoding error: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding failed: {str(e)}")


@router.post("/similarity", response_model=SimilarityResponse)
async def compute_similarity(request: SimilarityRequest):
    """
    计算查询文本与候选文本的语义相似度

    - query: 查询文本
    - candidates: 候选文本列表
    - threshold: 相似度阈值 (0-1)，只返回高于阈值的结果
    - top_k: 最多返回前 K 个结果

    使用余弦相似度，返回按相似度降序排列的结果
    """
    try:
        model = get_model()

        query = request.query.strip()
        candidates = [c.strip() for c in request.candidates if c.strip()]

        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        if not candidates:
            raise HTTPException(status_code=400, detail="No valid candidates provided")

        # 编码查询和候选
        q_emb = model.encode([query], normalize_embeddings=True)
        c_embs = model.encode(candidates, normalize_embeddings=True, show_progress_bar=False)

        # 计算余弦相似度 (归一化后点积 = 余弦相似度)
        scores = np.dot(c_embs, q_emb.T).flatten()

        # 过滤并排序
        results = []
        for i, (text, score) in enumerate(zip(candidates, scores)):
            if score >= request.threshold:
                results.append(SimilarityResult(
                    index=i,
                    text=text,
                    score=float(score)
                ))

        # 按分数降序排列并取 top_k
        results.sort(key=lambda x: x.score, reverse=True)
        results = results[:request.top_k]

        return SimilarityResponse(
            success=True,
            results=results,
            query=query,
            total_candidates=len(candidates),
            matched_count=len(results)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similarity computation error: {e}")
        raise HTTPException(status_code=500, detail=f"Similarity computation failed: {str(e)}")


@router.post("/batch-similarity")
async def batch_similarity(queries: List[str], candidates: List[str], threshold: float = 0.85):
    """
    批量计算多个查询与候选的相似度矩阵

    返回每个查询的最佳匹配
    """
    try:
        model = get_model()

        queries = [q.strip() for q in queries if q.strip()]
        candidates = [c.strip() for c in candidates if c.strip()]

        if not queries or not candidates:
            raise HTTPException(status_code=400, detail="Queries and candidates cannot be empty")

        # 编码
        q_embs = model.encode(queries, normalize_embeddings=True, show_progress_bar=False)
        c_embs = model.encode(candidates, normalize_embeddings=True, show_progress_bar=False)

        # 计算相似度矩阵 [queries x candidates]
        similarity_matrix = np.dot(q_embs, c_embs.T)

        # 找每个查询的最佳匹配
        results = []
        for i, query in enumerate(queries):
            row = similarity_matrix[i]
            best_idx = int(np.argmax(row))
            best_score = float(row[best_idx])

            results.append({
                "query_index": i,
                "query": query,
                "best_match_index": best_idx,
                "best_match_text": candidates[best_idx],
                "score": best_score,
                "above_threshold": best_score >= threshold
            })

        return {
            "success": True,
            "results": results,
            "threshold": threshold,
            "total_queries": len(queries),
            "total_candidates": len(candidates)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch similarity error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch similarity failed: {str(e)}")


# ==================== 预热函数 ====================

def warmup_model():
    """预热模型 (可在启动时调用)"""
    try:
        model = get_model()
        # 预热编码
        model.encode(["预热测试"], show_progress_bar=False)
        logger.info("Embedding model warmed up successfully")
        return True
    except Exception as e:
        logger.error(f"Model warmup failed: {e}")
        return False
