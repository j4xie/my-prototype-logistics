"""
食品知识文档入库服务
Document ingestion pipeline for food knowledge base.

Handles document parsing, chunking, embedding, and storage to PostgreSQL + pgvector.
"""

import json
import logging
import re
import hashlib
from typing import Optional, List, Dict, Any, Callable, Awaitable

import asyncpg

try:
    import jieba
    _jieba_available = True
except ImportError:
    _jieba_available = False

logger = logging.getLogger(__name__)


def compute_search_tokens(title: str, content: str) -> Optional[str]:
    """Compute jieba-tokenized search tokens for BM25 hybrid search."""
    if not _jieba_available:
        return None
    text = f"{title or ''} {content or ''}".strip()
    if not text:
        return None
    tokens = [t for t in jieba.cut(text) if t.strip()]
    return " ".join(tokens)


# Chunking strategies per document category
CHUNK_CONFIG = {
    "standard": {"max_chars": 800, "overlap": 100, "split_pattern": r"\n(?=\d+[\.\s])"},  # 按条款
    "regulation": {"max_chars": 600, "overlap": 80, "split_pattern": r"\n(?=第[一二三四五六七八九十百]+条)"},  # 按条
    "process": {"max_chars": 1000, "overlap": 150, "split_pattern": r"\n\n"},  # 按段落
    "haccp": {"max_chars": 800, "overlap": 100, "split_pattern": r"\n(?=\d+[\.\s]|Step\s)"},  # 按步骤
    "sop": {"max_chars": 600, "overlap": 80, "split_pattern": r"\n(?=\d+[\.\s]|步骤)"},  # 按步骤
    "additive": {"max_chars": 500, "overlap": 50, "split_pattern": r"\n\n"},
    "microbe": {"max_chars": 500, "overlap": 50, "split_pattern": r"\n\n"},
}


class DocumentChunk:
    """A chunk of a document ready for embedding and storage."""
    def __init__(self, title: str, content: str, category: str,
                 source: str = "", version: str = "", chunk_index: int = 0,
                 metadata: Optional[Dict] = None):
        self.title = title
        self.content = content
        self.category = category
        self.source = source
        self.version = version
        self.chunk_index = chunk_index
        self.metadata = metadata or {}
        self.embedding: Optional[List[float]] = None

    def content_hash(self) -> str:
        return hashlib.md5(self.content.encode("utf-8")).hexdigest()


class DocumentIngester:
    """
    Document ingestion pipeline.

    Flow:
    1. Parse raw document (PDF/HTML/TXT)
    2. Clean and normalize text
    3. Chunk by category-specific strategy
    4. Encode chunks to embeddings (gte-base-zh 768-dim)
    5. Store in PostgreSQL with pgvector
    6. Record audit log
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._embedding_fn: Optional[Callable[[str], Awaitable[List[float]]]] = None
        self._ready = False

    async def initialize(self, db_url: str, embedding_fn=None):
        """Initialize with database connection and embedding function."""
        try:
            self._pool = await asyncpg.create_pool(db_url, min_size=1, max_size=3)
            self._embedding_fn = embedding_fn
            self._ready = True
            logger.info("DocumentIngester initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize DocumentIngester: {e}")
            self._ready = False

    def is_ready(self) -> bool:
        return self._ready and self._pool is not None

    async def ingest_document(
        self,
        title: str,
        content: str,
        category: str,
        source: str = "",
        source_url: str = "",
        version: str = "",
        effective_date: str = None,
        metadata: Optional[Dict] = None,
        operator: str = "system",
    ) -> Dict[str, Any]:
        """
        Ingest a single document into the knowledge base.

        Args:
            title: Document title
            content: Full document text
            category: Document category (standard/regulation/process/haccp/sop)
            source: Source reference (e.g., "GB 2760-2024")
            source_url: Source URL
            version: Version string
            effective_date: Effective date (YYYY-MM-DD)
            metadata: Additional metadata
            operator: Who is performing the ingestion

        Returns:
            Ingestion result with document IDs and chunk count
        """
        if not self.is_ready():
            return {"success": False, "error": "Ingester not initialized"}

        try:
            # Step 1: Clean text
            cleaned_content = self._clean_text(content)

            # Step 2: Chunk document
            chunks = self._chunk_document(title, cleaned_content, category, source, version, metadata)
            logger.info(f"Document '{title}' split into {len(chunks)} chunks")

            # Step 3: Encode embeddings
            if self._embedding_fn:
                for chunk in chunks:
                    try:
                        chunk.embedding = await self._embedding_fn(chunk.content)
                    except Exception as e:
                        logger.warning(f"Embedding failed for chunk {chunk.chunk_index}: {e}")

            # Step 4: Store in database
            parent_id = None
            doc_ids = []

            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    for i, chunk in enumerate(chunks):
                        chunk_title = chunk.title if i == 0 else f"{chunk.title} (#{chunk.chunk_index})"
                        search_tokens = compute_search_tokens(chunk_title, chunk.content)
                        doc_id = await conn.fetchval(
                            """
                            INSERT INTO food_knowledge_documents
                                (title, content, category, source, source_url, version,
                                 effective_date, embedding, chunk_index, parent_doc_id, metadata,
                                 search_tokens)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                            RETURNING id
                            """,
                            chunk_title,
                            chunk.content,
                            chunk.category,
                            chunk.source,
                            source_url,
                            chunk.version,
                            effective_date,
                            str(chunk.embedding) if chunk.embedding else None,
                            chunk.chunk_index,
                            parent_id,
                            json.dumps(chunk.metadata, ensure_ascii=False) if chunk.metadata else '{}',
                            search_tokens,
                        )
                        doc_ids.append(doc_id)

                        # First chunk becomes parent
                        if i == 0:
                            parent_id = doc_id

                    # Step 5: Audit log
                    await conn.execute(
                        """
                        INSERT INTO food_knowledge_audit_log
                            (document_id, action, new_version, reason, operator)
                        VALUES ($1, 'CREATE', $2, $3, $4)
                        """,
                        parent_id,
                        version,
                        f"Ingested document: {title}",
                        operator,
                    )

            return {
                "success": True,
                "parent_doc_id": parent_id,
                "doc_ids": doc_ids,
                "chunk_count": len(chunks),
                "has_embeddings": any(c.embedding is not None for c in chunks),
            }

        except Exception as e:
            logger.error(f"Document ingestion failed: {e}")
            return {"success": False, "error": str(e)}

    async def ingest_batch(
        self,
        documents: List[Dict[str, Any]],
        operator: str = "system",
    ) -> Dict[str, Any]:
        """
        Ingest multiple documents in batch.

        Args:
            documents: List of document dicts with keys: title, content, category, source, etc.
            operator: Who is performing the ingestion

        Returns:
            Batch ingestion result
        """
        results = []
        success_count = 0
        fail_count = 0

        for doc in documents:
            result = await self.ingest_document(
                title=doc.get("title", "Untitled"),
                content=doc.get("content", ""),
                category=doc.get("category", "standard"),
                source=doc.get("source", ""),
                source_url=doc.get("source_url", ""),
                version=doc.get("version", ""),
                effective_date=doc.get("effective_date"),
                metadata=doc.get("metadata"),
                operator=operator,
            )
            results.append(result)
            if result.get("success"):
                success_count += 1
            else:
                fail_count += 1

        return {
            "success": fail_count == 0,
            "total": len(documents),
            "success_count": success_count,
            "fail_count": fail_count,
            "results": results,
        }

    async def deprecate_document(
        self,
        document_id: int,
        reason: str = "",
        operator: str = "system",
    ) -> bool:
        """Mark a document as deprecated/inactive."""
        if not self.is_ready():
            return False

        try:
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    # Deactivate document and all its chunks
                    await conn.execute(
                        """
                        UPDATE food_knowledge_documents
                        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1 OR parent_doc_id = $1
                        """,
                        document_id,
                    )

                    # Audit log
                    await conn.execute(
                        """
                        INSERT INTO food_knowledge_audit_log
                            (document_id, action, reason, operator)
                        VALUES ($1, 'DEPRECATE', $2, $3)
                        """,
                        document_id,
                        reason,
                        operator,
                    )

            logger.info(f"Document {document_id} deprecated: {reason}")
            return True
        except Exception as e:
            logger.error(f"Document deprecation failed: {e}")
            return False

    def _clean_text(self, text: str) -> str:
        """Clean and normalize document text."""
        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text)
        # Remove control characters
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
        # Normalize newlines
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Remove excessive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _chunk_document(
        self,
        title: str,
        content: str,
        category: str,
        source: str,
        version: str,
        metadata: Optional[Dict],
    ) -> List[DocumentChunk]:
        """Split document into chunks using category-specific strategy."""
        config = CHUNK_CONFIG.get(category, CHUNK_CONFIG["process"])
        max_chars = config["max_chars"]
        overlap = config["overlap"]
        split_pattern = config["split_pattern"]

        # Split by pattern first
        sections = re.split(split_pattern, content)
        sections = [s.strip() for s in sections if s.strip()]

        chunks = []
        current_chunk = ""
        chunk_idx = 0

        for section in sections:
            if len(current_chunk) + len(section) <= max_chars:
                current_chunk += ("\n" if current_chunk else "") + section
            else:
                if current_chunk:
                    chunks.append(DocumentChunk(
                        title=title,
                        content=current_chunk,
                        category=category,
                        source=source,
                        version=version,
                        chunk_index=chunk_idx,
                        metadata=metadata,
                    ))
                    chunk_idx += 1

                    # Start new chunk with overlap
                    if overlap > 0 and len(current_chunk) > overlap:
                        current_chunk = current_chunk[-overlap:] + "\n" + section
                    else:
                        current_chunk = section
                else:
                    # Section itself is too long, force split
                    while len(section) > max_chars:
                        chunks.append(DocumentChunk(
                            title=title,
                            content=section[:max_chars],
                            category=category,
                            source=source,
                            version=version,
                            chunk_index=chunk_idx,
                            metadata=metadata,
                        ))
                        chunk_idx += 1
                        section = section[max_chars - overlap:]
                    current_chunk = section

        # Don't forget the last chunk
        if current_chunk.strip():
            chunks.append(DocumentChunk(
                title=title,
                content=current_chunk,
                category=category,
                source=source,
                version=version,
                chunk_index=chunk_idx,
                metadata=metadata,
            ))

        # If document was too short to chunk, return as single chunk
        if not chunks:
            chunks.append(DocumentChunk(
                title=title,
                content=content,
                category=category,
                source=source,
                version=version,
                chunk_index=0,
                metadata=metadata,
            ))

        return chunks

    async def close(self):
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._ready = False


# Global singleton
_ingester_instance: Optional[DocumentIngester] = None


def get_document_ingester() -> DocumentIngester:
    global _ingester_instance
    if _ingester_instance is None:
        _ingester_instance = DocumentIngester()
    return _ingester_instance
