"""
食品知识库检索服务
RAG Knowledge Retrieval for food safety standards, regulations, and processes.

Uses pgvector for vector similarity search with gte-base-zh embeddings (768-dim).
Phase 1: DashScope Reranker for cross-encoder re-scoring.
Phase 2: BM25+Vector hybrid search with RRF (Reciprocal Rank Fusion).
"""

import logging
import time
from typing import Optional, List, Dict, Any

import asyncpg
import numpy as np

from .reranker import get_reranker
from .query_rewriter import get_query_rewriter

logger = logging.getLogger(__name__)

# Coarse retrieval fetches more candidates when reranker is enabled
COARSE_TOP_K = 20

# RRF (Reciprocal Rank Fusion) constant — higher k = more uniform blending
RRF_K = 60

# BM25 hybrid search toggle
BM25_ENABLED = True


class KnowledgeDocument:
    """知识文档结果"""
    def __init__(self, row: dict):
        self.id = row.get("id")
        self.title = row.get("title", "")
        self.content = row.get("content", "")
        self.category = row.get("category", "")
        self.source = row.get("source", "")
        self.version = row.get("version", "")
        self.similarity = row.get("similarity", 0.0)
        self.metadata = row.get("metadata", {})

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "category": self.category,
            "source": self.source,
            "version": self.version,
            "similarity": round(self.similarity, 4),
            "metadata": self.metadata,
        }


class KnowledgeRetriever:
    """
    食品知识检索服务

    Features:
    - pgvector cosine similarity search
    - Category filtering (standard, regulation, process, haccp, sop)
    - Expired document filtering
    - Source citation
    - Entity dictionary lookup
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._embedding_fn = None
        self._ready = False

    async def initialize(self, db_url: str, embedding_fn=None):
        """Initialize with database connection and embedding function."""
        try:
            self._pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5)
            self._embedding_fn = embedding_fn
            self._ready = True
            logger.info("KnowledgeRetriever initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize KnowledgeRetriever: {e}")
            self._ready = False

    def is_ready(self) -> bool:
        return self._ready and self._pool is not None

    async def retrieve(
        self,
        query: str,
        categories: Optional[List[str]] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.60,
        include_expired: bool = False,
    ) -> List[KnowledgeDocument]:
        """
        Retrieve relevant knowledge documents via hybrid search.

        Pipeline (Phase 2):
          1. Vector search: top_k=20 via pgvector cosine similarity
          2. BM25 search: top_k=20 via jieba-tokenized full-text search
          3. RRF fusion: merge vector + BM25 results with reciprocal rank fusion
          4. Reranker (if enabled): DashScope cross-encoder re-scores fused candidates
          5. Return top_k results

        Args:
            query: User query text
            categories: Filter by document categories (e.g., ['standard', 'additive'])
            top_k: Number of results to return
            similarity_threshold: Minimum cosine similarity threshold
            include_expired: Whether to include expired documents

        Returns:
            List of KnowledgeDocument sorted by relevance
        """
        if not self.is_ready():
            logger.warning("KnowledgeRetriever not initialized")
            return []

        start_time = time.time()
        reranker = get_reranker()
        rewriter = get_query_rewriter()

        try:
            # Step 0: Query rewriting (Phase 3)
            # Returns list of (raw_query, expanded_query) tuples
            # raw_query → vector search (preserves embedding focus)
            # expanded_query → BM25 search + reranker (adds domain terms)
            query_pairs = rewriter.rewrite(query)
            raw_primary, expanded_primary = query_pairs[0]

            # Step 1: Encode ORIGINAL query to vector (not expanded)
            query_embedding = await self._encode_query(raw_primary)
            if query_embedding is None:
                logger.warning("Failed to encode query, falling back to text search")
                return await self._text_search(query, categories, top_k)

            # Step 2: Coarse retrieval size
            coarse_k = COARSE_TOP_K if (reranker.is_enabled or BM25_ENABLED) else top_k
            sql, params = self._build_vector_query(
                query_embedding, categories, coarse_k, similarity_threshold, include_expired
            )

            # Step 3: Execute vector search with original query embedding
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)

            vector_results = [KnowledgeDocument(dict(row)) for row in rows]

            # Step 3b: If decomposed, vector-search sub-queries with their raw forms
            if len(query_pairs) > 1:
                for raw_sq, _ in query_pairs[1:]:
                    sq_embedding = await self._encode_query(raw_sq)
                    if sq_embedding:
                        sq_sql, sq_params = self._build_vector_query(
                            sq_embedding, categories, coarse_k // 2,
                            similarity_threshold, include_expired
                        )
                        async with self._pool.acquire() as conn:
                            sq_rows = await conn.fetch(sq_sql, *sq_params)
                        seen_ids = {d.id for d in vector_results}
                        for row in sq_rows:
                            doc = KnowledgeDocument(dict(row))
                            if doc.id not in seen_ids:
                                vector_results.append(doc)
                                seen_ids.add(doc.id)

            # Step 4: BM25 search — use EXPANDED queries for keyword matching
            bm25_results = []
            if BM25_ENABLED:
                bm25_results = await self._bm25_search(
                    expanded_primary, categories, coarse_k, include_expired
                )
                # Also BM25 search expanded sub-queries
                if len(query_pairs) > 1:
                    seen_ids = {d.id for d in bm25_results}
                    for _, expanded_sq in query_pairs[1:]:
                        sq_bm25 = await self._bm25_search(
                            expanded_sq, categories, coarse_k // 2, include_expired
                        )
                        for doc in sq_bm25:
                            if doc.id not in seen_ids:
                                bm25_results.append(doc)
                                seen_ids.add(doc.id)

            # Step 5: RRF fusion if we have both result sets
            if bm25_results and vector_results:
                results = self._rrf_fusion(vector_results, bm25_results, coarse_k)
                retrieval_method = "hybrid(vector+bm25)"
            elif vector_results:
                results = vector_results
                retrieval_method = "vector"
            else:
                logger.info(
                    f"Vector+BM25 returned 0 results for query='{query[:50]}...', "
                    f"falling back to text search"
                )
                results = await self._text_search(query, categories, top_k)
                return results[:top_k]

            # Log query rewriting info
            if len(query_pairs) > 1:
                retrieval_method += f"+decompose({len(query_pairs)})"
            if expanded_primary != query:
                retrieval_method += "+expanded"

            # Step 6: Reranker (if enabled) — cross-encoder re-scoring
            # Use expanded query so cross-encoder sees domain terms (e.g. "食品接触材料 GB 4806")
            if reranker.is_enabled and len(results) > 1:
                doc_dicts = [r.to_dict() for r in results]
                reranked = await reranker.rerank(expanded_primary, doc_dicts, top_n=top_k)

                results = []
                for rd in reranked:
                    doc = KnowledgeDocument(rd)
                    if "rerank_score" in rd:
                        if doc.metadata is None:
                            doc.metadata = {}
                        elif isinstance(doc.metadata, str):
                            import json
                            try:
                                doc.metadata = json.loads(doc.metadata)
                            except (json.JSONDecodeError, TypeError):
                                doc.metadata = {}
                        doc.metadata["rerank_score"] = rd["rerank_score"]
                        doc.metadata["original_rank"] = rd.get("original_rank", 0)
                    results.append(doc)
                retrieval_method += "+rerank"
            else:
                results = results[:top_k]

            elapsed = (time.time() - start_time) * 1000
            logger.info(
                f"Knowledge retrieval ({retrieval_method}): query='{query[:40]}', "
                f"vec={len(vector_results)}, bm25={len(bm25_results)}, "
                f"final={len(results)}, elapsed={elapsed:.1f}ms"
            )

            return results

        except Exception as e:
            logger.error(f"Knowledge retrieval failed: {e}")
            return []

    async def _bm25_search(
        self,
        query: str,
        categories: Optional[List[str]],
        top_k: int,
        include_expired: bool = False,
    ) -> List[KnowledgeDocument]:
        """
        BM25 keyword search using jieba-tokenized search_tokens column.

        Uses PostgreSQL to_tsvector('simple', search_tokens) with jieba-tokenized query.
        The 'simple' dictionary performs no stemming — jieba already handles segmentation.
        """
        try:
            import jieba
        except ImportError:
            logger.warning("jieba not installed, BM25 search disabled")
            return []

        try:
            # Tokenize query with jieba
            query_tokens = " & ".join(
                t for t in jieba.cut(query) if t.strip() and len(t.strip()) > 1
            )
            if not query_tokens:
                return []

            params = []
            param_idx = 1

            sql = f"""
                SELECT id, title, content, category, source, version, metadata,
                       ts_rank_cd(
                           to_tsvector('simple', COALESCE(search_tokens, '')),
                           to_tsquery('simple', ${param_idx})
                       ) as similarity
                FROM food_knowledge_documents
                WHERE is_active = TRUE
                  AND search_tokens IS NOT NULL
                  AND to_tsvector('simple', COALESCE(search_tokens, '')) @@
                      to_tsquery('simple', ${param_idx})
            """
            params.append(query_tokens)
            param_idx += 1

            if categories:
                sql += f" AND category = ANY(${param_idx}::text[])"
                params.append(categories)
                param_idx += 1

            if not include_expired:
                sql += " AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)"

            sql += f" ORDER BY similarity DESC LIMIT ${param_idx}"
            params.append(top_k)

            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)

            return [KnowledgeDocument(dict(row)) for row in rows]

        except Exception as e:
            logger.warning(f"BM25 search failed: {e}")
            return []

    @staticmethod
    def _rrf_fusion(
        vector_results: List['KnowledgeDocument'],
        bm25_results: List['KnowledgeDocument'],
        top_k: int,
    ) -> List['KnowledgeDocument']:
        """
        Reciprocal Rank Fusion (RRF) to merge vector and BM25 results.

        Score = sum( 1 / (k + rank) ) for each retrieval method.
        k=60 (standard RRF constant) to prevent high-ranked items from dominating.
        """
        doc_scores: Dict[int, float] = {}
        doc_map: Dict[int, 'KnowledgeDocument'] = {}

        # Score vector results
        for rank, doc in enumerate(vector_results, start=1):
            doc_id = doc.id
            doc_scores[doc_id] = doc_scores.get(doc_id, 0.0) + 1.0 / (RRF_K + rank)
            doc_map[doc_id] = doc

        # Score BM25 results
        for rank, doc in enumerate(bm25_results, start=1):
            doc_id = doc.id
            doc_scores[doc_id] = doc_scores.get(doc_id, 0.0) + 1.0 / (RRF_K + rank)
            if doc_id not in doc_map:
                doc_map[doc_id] = doc

        # Sort by fused RRF score
        sorted_ids = sorted(doc_scores, key=lambda x: doc_scores[x], reverse=True)

        results = []
        for doc_id in sorted_ids[:top_k]:
            doc = doc_map[doc_id]
            # Store RRF score in metadata for diagnostics
            if doc.metadata is None:
                doc.metadata = {}
            elif isinstance(doc.metadata, str):
                import json
                try:
                    doc.metadata = json.loads(doc.metadata)
                except (json.JSONDecodeError, TypeError):
                    doc.metadata = {}
            doc.metadata["rrf_score"] = round(doc_scores[doc_id], 6)
            results.append(doc)

        return results

    async def retrieve_by_entity(
        self,
        entity_type: str,
        entity_name: str,
    ) -> Dict[str, Any]:
        """
        Look up entity in the food entity dictionary.

        Args:
            entity_type: Entity type (e.g., 'ADDITIVE', 'STANDARD')
            entity_name: Entity name (e.g., '山梨酸钾', 'GB 2760')

        Returns:
            Entity dictionary entry or empty dict
        """
        if not self.is_ready():
            return {}

        try:
            sql = """
                SELECT id, entity_type, entity_name, aliases, standard_ref,
                       category, description, metadata
                FROM food_entity_dictionary
                WHERE is_active = TRUE
                  AND (entity_name = $1 OR $1 = ANY(aliases))
                  AND ($2 = '' OR entity_type = $2)
                LIMIT 5
            """
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql, entity_name, entity_type or "")

            if not rows:
                return {}

            results = []
            for row in rows:
                results.append({
                    "id": row["id"],
                    "entity_type": row["entity_type"],
                    "entity_name": row["entity_name"],
                    "aliases": row["aliases"],
                    "standard_ref": row["standard_ref"],
                    "category": row["category"],
                    "description": row["description"],
                    "metadata": row["metadata"],
                })

            return {"entities": results, "count": len(results)}

        except Exception as e:
            logger.error(f"Entity lookup failed: {e}")
            return {}

    async def get_categories_stats(self) -> Dict[str, int]:
        """Get document count by category."""
        if not self.is_ready():
            return {}

        try:
            sql = """
                SELECT category, COUNT(*) as count
                FROM food_knowledge_documents
                WHERE is_active = TRUE
                GROUP BY category
                ORDER BY count DESC
            """
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql)

            return {row["category"]: row["count"] for row in rows}
        except Exception as e:
            logger.error(f"Categories stats failed: {e}")
            return {}

    async def _encode_query(self, query: str) -> Optional[List[float]]:
        """Encode query text to embedding vector."""
        if self._embedding_fn is None:
            logger.warning("No embedding function configured")
            return None

        try:
            embedding = await self._embedding_fn(query)
            if isinstance(embedding, np.ndarray):
                return embedding.tolist()
            return embedding
        except Exception as e:
            logger.error(f"Query encoding failed: {e}")
            return None

    def _build_vector_query(
        self,
        query_embedding: List[float],
        categories: Optional[List[str]],
        top_k: int,
        similarity_threshold: float,
        include_expired: bool,
    ) -> tuple:
        """Build pgvector similarity search SQL."""
        params = []
        param_idx = 1

        # Base query with cosine similarity
        sql = f"""
            SELECT id, title, content, category, source, version, metadata,
                   1 - (embedding <=> $1::vector) as similarity
            FROM food_knowledge_documents
            WHERE is_active = TRUE
              AND embedding IS NOT NULL
        """
        params.append(str(query_embedding))
        param_idx += 1

        # Category filter
        if categories:
            sql += f" AND category = ANY(${param_idx}::text[])"
            params.append(categories)
            param_idx += 1

        # Expired filter
        if not include_expired:
            sql += " AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)"

        # Similarity threshold
        sql += f" AND 1 - (embedding <=> $1::vector) >= ${param_idx}"
        params.append(similarity_threshold)
        param_idx += 1

        # Order and limit
        sql += f" ORDER BY embedding <=> $1::vector ASC LIMIT ${param_idx}"
        params.append(top_k)

        return sql, params

    async def _text_search(
        self,
        query: str,
        categories: Optional[List[str]],
        top_k: int,
    ) -> List[KnowledgeDocument]:
        """Fallback text-based search when embeddings unavailable."""
        try:
            params = []
            param_idx = 1

            sql = f"""
                SELECT id, title, content, category, source, version, metadata,
                       ts_rank(to_tsvector('simple', title || ' ' || content),
                               plainto_tsquery('simple', ${param_idx})) as similarity
                FROM food_knowledge_documents
                WHERE is_active = TRUE
                  AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
                  AND to_tsvector('simple', title || ' ' || content) @@
                      plainto_tsquery('simple', ${param_idx})
            """
            params.append(query)
            param_idx += 1

            if categories:
                sql += f" AND category = ANY(${param_idx}::text[])"
                params.append(categories)
                param_idx += 1

            sql += f" ORDER BY similarity DESC LIMIT ${param_idx}"
            params.append(top_k)

            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)

            return [KnowledgeDocument(dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Text search failed: {e}")
            return []

    async def close(self):
        """Close database connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._ready = False


# Global singleton
_retriever_instance: Optional[KnowledgeRetriever] = None


def get_knowledge_retriever() -> KnowledgeRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = KnowledgeRetriever()
    return _retriever_instance
