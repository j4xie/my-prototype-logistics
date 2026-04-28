"""
操作手册入库服务
Ingests operation manual HTML + markdown docs into food_kb for RAG retrieval.

Usage:
    python -m food_kb.services.manual_ingester
"""

import asyncio
import logging
import os
import re
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

# Project root (5 levels up from this file)
PROJECT_ROOT = Path(__file__).resolve().parents[4]

# Sources to ingest
MANUAL_SOURCES = [
    {
        "path": "docs/plans/operation-manual-full.html",
        "title_prefix": "操作手册",
        "source": "operation-manual-full.html",
        "type": "html",
    },
    {
        "path": "docs/plans/restaurant-metrics-glossary.html",
        "title_prefix": "餐饮指数字典",
        "source": "restaurant-metrics-glossary.html",
        "type": "html",
    },
    {
        "path": "docs/plans/factory-requisition-detailed-flow.md",
        "title_prefix": "工厂下单详细流程",
        "source": "factory-requisition-detailed-flow.md",
        "type": "markdown",
    },
    {
        "path": "docs/plans/factory-requisition-operation-guide.md",
        "title_prefix": "工厂下单操作指南",
        "source": "factory-requisition-operation-guide.md",
        "type": "markdown",
    },
    {
        "path": ".claude/projects/C--Users-Steve-my-prototype-logistics/memory/project_feature_inventory.md",
        "title_prefix": "系统功能清单",
        "source": "project_feature_inventory.md",
        "type": "markdown",
    },
]


def parse_html_to_sections(html_content: str) -> List[Dict[str, str]]:
    """Parse HTML file into sections split by h2/h3 headers."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.error("beautifulsoup4 not installed. Run: pip install beautifulsoup4")
        raise

    soup = BeautifulSoup(html_content, "html.parser")

    # Remove script and style tags
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()

    sections = []
    current_title = "概述"
    current_content_parts = []

    for element in soup.find_all(["h2", "h3", "p", "div", "ul", "ol", "table", "li"]):
        if element.name in ("h2", "h3"):
            # Save previous section
            if current_content_parts:
                text = "\n".join(current_content_parts).strip()
                if text:
                    sections.append({"title": current_title, "content": text})
            current_title = element.get_text(strip=True)
            current_content_parts = []
        else:
            text = element.get_text(separator=" ", strip=True)
            if text and len(text) > 5:
                current_content_parts.append(text)

    # Last section
    if current_content_parts:
        text = "\n".join(current_content_parts).strip()
        if text:
            sections.append({"title": current_title, "content": text})

    return sections


def parse_markdown_to_sections(md_content: str) -> List[Dict[str, str]]:
    """Parse markdown into sections split by ## or ### headers."""
    sections = []
    current_title = "概述"
    current_lines = []

    for line in md_content.split("\n"):
        header_match = re.match(r"^(#{2,3})\s+(.+)", line)
        if header_match:
            if current_lines:
                text = "\n".join(current_lines).strip()
                if text:
                    sections.append({"title": current_title, "content": text})
            current_title = header_match.group(2).strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        text = "\n".join(current_lines).strip()
        if text:
            sections.append({"title": current_title, "content": text})

    return sections


async def ingest_all():
    """Ingest all operation manual sources into the knowledge base."""
    from smartbi.config import get_settings
    from food_kb.services.document_ingester import get_document_ingester, CHUNK_CONFIG
    from food_kb.services.embedding import configure as configure_embedding, get_embedding

    # Add operation_manual chunk config
    CHUNK_CONFIG["operation_manual"] = {
        "max_chars": 1200,
        "overlap": 200,
        "split_pattern": r"\n(?=#{2,3}\s)",
    }

    settings = get_settings()

    # Configure embedding
    configure_embedding(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.food_kb_embedding_model,
        dims=settings.food_kb_embedding_dims,
    )

    # Initialize ingester
    ingester = get_document_ingester()
    await ingester.initialize(settings.food_kb_db_url, embedding_fn=get_embedding)

    if not ingester.is_ready():
        logger.error("Document ingester failed to initialize")
        return

    total_chunks = 0
    total_docs = 0

    for source_info in MANUAL_SOURCES:
        file_path = PROJECT_ROOT / source_info["path"]
        if not file_path.exists():
            logger.warning(f"Source file not found: {file_path}")
            continue

        logger.info(f"Processing: {file_path.name}")
        content = file_path.read_text(encoding="utf-8")

        if source_info["type"] == "html":
            sections = parse_html_to_sections(content)
        else:
            sections = parse_markdown_to_sections(content)

        logger.info(f"  Parsed {len(sections)} sections from {file_path.name}")

        # ATOMIC SWAP PATTERN (round-3 audit A2):
        # 1. Ingest new chunks under TEMP source name (.NEW suffix)
        # 2. If any ingest fails → cleanup temp, skip swap, KB retains old chunks intact
        # 3. If all succeed → atomic transaction: DELETE old WHERE source=canonical
        #    + UPDATE source=canonical WHERE source=temp
        # This prevents the half-empty-KB risk if embedding API hangs mid-ingest.
        canonical_source = source_info["source"]
        temp_source = f"{canonical_source}.NEW"

        # Pre-cleanup any orphan .NEW from previous failed run
        async with ingester._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM food_knowledge_documents WHERE source = $1",
                temp_source,
            )

        source_chunks = 0
        source_docs = 0
        ingest_failed = False

        for section in sections:
            title = f"{source_info['title_prefix']} - {section['title']}"
            result = await ingester.ingest_document(
                title=title,
                content=section["content"],
                category="operation_manual",
                source=temp_source,  # Ingest under temp name
                version="1.0",
                operator="manual_ingester",
            )
            if result.get("success"):
                source_chunks += result.get("chunk_count", 0)
                source_docs += 1
            else:
                logger.error(
                    f"  Failed to ingest section '{title}': {result.get('error')}"
                )
                ingest_failed = True
                break  # Abort ingest for this source

        if ingest_failed:
            # Rollback: drop temp chunks. Old canonical chunks stay intact.
            async with ingester._pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM food_knowledge_documents WHERE source = $1",
                    temp_source,
                )
            logger.error(
                f"  Aborted ingest for source '{canonical_source}'. "
                f"Cleaned up temp. KB retains previous chunks (no data loss)."
            )
            continue

        # All sections ingested OK. Atomic swap inside single transaction.
        async with ingester._pool.acquire() as conn:
            async with conn.transaction():
                old_deleted = await conn.execute(
                    "DELETE FROM food_knowledge_documents WHERE source = $1",
                    canonical_source,
                )
                await conn.execute(
                    "UPDATE food_knowledge_documents SET source = $1 WHERE source = $2",
                    canonical_source,
                    temp_source,
                )
            try:
                old_count = (
                    int(old_deleted.split()[1])
                    if old_deleted and old_deleted.startswith("DELETE")
                    else 0
                )
            except (IndexError, ValueError, AttributeError, TypeError):
                old_count = 0

        logger.info(
            f"  Atomically swapped to {source_docs} sections / {source_chunks} chunks "
            f"for '{canonical_source}' (replaced {old_count} prior chunks)"
        )
        total_docs += source_docs
        total_chunks += source_chunks

    logger.info(f"Ingestion complete: {total_docs} documents, {total_chunks} chunks")

    await ingester.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    asyncio.run(ingest_all())
