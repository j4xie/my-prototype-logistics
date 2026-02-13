"""
SmartBI → Food Knowledge Base Bridge Service

Provides SmartBI-specific wrappers around the food_kb knowledge retriever,
with caching to avoid redundant KB queries during enrichment.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from services.food_industry_detector import detect_food_industry, detect_food_sub_sector

logger = logging.getLogger(__name__)

# Simple in-memory cache (TTL-based)
_cache: Dict[str, Tuple[float, Any]] = {}
_CACHE_TTL = 3600  # 60 minutes


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    if entry:
        del _cache[key]
    return None


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)
    # Evict oldest entries if cache grows too large
    if len(_cache) > 200:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]


class FoodContextBridge:
    """Unified interface for SmartBI to query food knowledge base context."""

    def __init__(self):
        self._retriever = None
        self._ner_service = None
        self._kb_available = False
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        """Lazy-initialize KB services."""
        if self._initialized:
            return self._kb_available

        self._initialized = True
        try:
            from food_kb.services.knowledge_retriever import get_knowledge_retriever
            self._retriever = get_knowledge_retriever()
            self._kb_available = self._retriever.is_ready()
        except ImportError:
            logger.debug("food_kb module not available, KB bridge will use fallback data")
            self._kb_available = False

        try:
            from food_kb.services.food_ner_service import get_food_ner_service
            self._ner_service = get_food_ner_service()
        except ImportError:
            pass

        return self._kb_available

    async def get_food_context(
        self,
        column_names: List[str],
        sample_data: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Get food industry context for uploaded data.

        Returns:
            {
                "is_food_industry": bool,
                "confidence": float,
                "sub_sector": str | None,
                "industry_standards": [str],
                "kb_context": str,      # LLM-ready context text
                "benchmarks": dict,     # Relevant benchmark metrics
            }
        """
        cache_key = f"food_ctx:{','.join(sorted(column_names[:10]))}"
        cached = _cache_get(cache_key)
        if cached:
            return cached

        # Step 1: Detect if food industry
        detection = detect_food_industry(column_names, sample_data)
        sub_sector = detect_food_sub_sector(column_names, sample_data)

        result: Dict[str, Any] = {
            "is_food_industry": detection["is_food_industry"],
            "confidence": detection["confidence"],
            "sub_sector": sub_sector,
            "industry_standards": detection.get("suggested_standards", []),
            "kb_context": "",
            "benchmarks": {},
        }

        if not detection["is_food_industry"]:
            _cache_set(cache_key, result)
            return result

        # Step 2: Get benchmark data
        from smartbi.api.benchmark import FOOD_PROCESSING_BENCHMARKS
        benchmarks = FOOD_PROCESSING_BENCHMARKS["metrics"]
        relevant_benchmarks = {}
        for bkey in detection.get("suggested_benchmarks", []):
            if bkey in benchmarks:
                b = benchmarks[bkey]
                entry = {"name": b["name"], "range": b["range"], "median": b["median"], "unit": b["unit"]}
                # Use sub-sector specific if available
                if sub_sector and "sub_sectors" in b and sub_sector in b["sub_sectors"]:
                    sub = b["sub_sectors"][sub_sector]
                    entry["range"] = sub["range"]
                    entry["median"] = sub["median"]
                    entry["sub_sector"] = sub_sector
                relevant_benchmarks[bkey] = entry
        result["benchmarks"] = relevant_benchmarks

        # Step 3: Query KB for relevant standards (if available)
        kb_texts = []
        if self._ensure_initialized() and self._retriever:
            try:
                # Build query from detected keywords
                query_terms = detection.get("matched_keywords", [])[:5]
                if query_terms:
                    query = "食品行业 " + " ".join(query_terms)
                    kb_results = await self._retriever.search(query, top_k=3)
                    for doc in kb_results:
                        if isinstance(doc, dict):
                            text = doc.get("content", doc.get("text", ""))
                            if text:
                                kb_texts.append(text[:300])  # Truncate long docs
            except Exception as e:
                logger.warning(f"KB query failed: {e}")

        # Step 4: Build context string for LLM
        context_parts = []
        if sub_sector:
            context_parts.append(f"数据属于食品行业-{sub_sector}子行业")
        else:
            context_parts.append("数据属于食品加工行业")

        if relevant_benchmarks:
            context_parts.append("行业基准参考:")
            for bkey, b in relevant_benchmarks.items():
                ctx = f"  - {b['name']}: {b['range'][0]}-{b['range'][1]}{b['unit']} (中位数{b['median']}{b['unit']})"
                if b.get("sub_sector"):
                    ctx += f" [{b['sub_sector']}]"
                context_parts.append(ctx)

        if detection.get("suggested_standards"):
            context_parts.append("相关食品安全标准:")
            for std in detection["suggested_standards"][:5]:
                context_parts.append(f"  - {std}")

        if kb_texts:
            context_parts.append("知识库参考:")
            for text in kb_texts[:3]:
                context_parts.append(f"  {text}")

        result["kb_context"] = "\n".join(context_parts)
        _cache_set(cache_key, result)
        return result

    async def get_entity_annotations(self, text: str) -> List[Dict[str, str]]:
        """
        NER-annotate food entities in text.

        Returns list of {"entity": str, "type": str, "start": int, "end": int}
        """
        cache_key = f"ner:{text[:100]}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        entities = []
        if self._ensure_initialized() and self._ner_service:
            try:
                ner_result = self._ner_service.extract_entities(text)
                if isinstance(ner_result, list):
                    entities = ner_result[:20]
            except Exception as e:
                logger.warning(f"NER annotation failed: {e}")

        _cache_set(cache_key, entities)
        return entities

    async def get_entity_enriched_context(
        self,
        column_names: List[str],
        sample_data: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Deep KB integration: extract food entities from data and enrich with KB knowledge.

        1. Build text from column names + sample data rows
        2. Call NER to identify food entities (ingredients, additives, processes, equipment)
        3. For each entity, query KB for related knowledge
        4. Return structured context with entities, KB facts, and regulations

        Returns:
            {
                "entities": [{"entity": str, "type": str}],
                "kb_facts": [str],
                "regulations": [str],
                "context_text": str  # LLM-ready context string
            }
        """
        result: Dict[str, Any] = {
            "entities": [],
            "kb_facts": [],
            "regulations": [],
            "context_text": "",
        }

        # Build text for NER from column names and sample data
        text_parts = list(column_names[:20])
        if sample_data:
            for row in sample_data[:5]:
                for val in row.values():
                    if isinstance(val, str) and len(val) > 1:
                        text_parts.append(val)
        ner_text = " ".join(text_parts)[:2000]

        # Step 1: NER entity extraction
        entities = []
        if self._ensure_initialized() and self._ner_service:
            try:
                ner_result = self._ner_service.extract_entities(ner_text)
                if isinstance(ner_result, list):
                    seen = set()
                    for ent in ner_result[:30]:
                        ent_text = ent.text if hasattr(ent, 'text') else (ent.get('entity', '') if isinstance(ent, dict) else str(ent))
                        ent_type = ent.label if hasattr(ent, 'label') else (ent.get('type', '') if isinstance(ent, dict) else '')
                        if ent_text and ent_text not in seen:
                            seen.add(ent_text)
                            entities.append({"entity": ent_text, "type": ent_type})
            except Exception as e:
                logger.warning(f"NER extraction failed in entity enrichment: {e}")

        result["entities"] = entities

        # Step 2: Query KB for each unique entity
        kb_facts = []
        regulations = []
        if self._ensure_initialized() and self._retriever and entities:
            for ent in entities[:10]:  # Limit to top 10 entities
                try:
                    query = f"食品 {ent['entity']} {ent['type']}"
                    kb_results = await self._retriever.search(query, top_k=2)
                    for doc in kb_results:
                        if isinstance(doc, dict):
                            text = doc.get("content", doc.get("text", ""))
                            category = doc.get("category", "")
                            if text:
                                text_truncated = text[:200]
                                if "标准" in text or "GB" in text or "法规" in text:
                                    regulations.append(text_truncated)
                                else:
                                    kb_facts.append(text_truncated)
                except Exception as e:
                    logger.debug(f"KB query for entity '{ent['entity']}' failed: {e}")
                    continue

        result["kb_facts"] = kb_facts[:10]
        result["regulations"] = regulations[:5]

        # Step 3: Build context text for LLM prompt
        context_parts = []
        if entities:
            entity_summary = ", ".join(f"{e['entity']}({e['type']})" for e in entities[:8])
            context_parts.append(f"识别到的食品相关实体: {entity_summary}")

        if kb_facts:
            context_parts.append("知识库参考信息:")
            for fact in kb_facts[:5]:
                context_parts.append(f"  - {fact}")

        if regulations:
            context_parts.append("相关法规与标准:")
            for reg in regulations[:3]:
                context_parts.append(f"  - {reg}")

        result["context_text"] = "\n".join(context_parts)

        return result

    async def get_benchmark_context(
        self,
        metrics: Dict[str, float],
        sub_sector: Optional[str] = None,
    ) -> str:
        """
        Get benchmark comparison context string for LLM prompt injection.

        Args:
            metrics: dict of metric_key → actual_value (e.g. {"gross_margin": 28.5})
            sub_sector: optional sub-sector for tighter benchmarks

        Returns:
            Human-readable benchmark comparison text
        """
        from smartbi.api.benchmark import FOOD_PROCESSING_BENCHMARKS
        benchmarks = FOOD_PROCESSING_BENCHMARKS["metrics"]

        parts = ["## 行业基准对标"]
        for key, actual in metrics.items():
            bench = benchmarks.get(key)
            if not bench:
                continue

            low, high = bench["range"]
            median = bench["median"]
            name = bench["name"]
            unit = bench["unit"]

            # Sub-sector override
            if sub_sector and "sub_sectors" in bench:
                sub = bench["sub_sectors"].get(sub_sector)
                if sub:
                    low, high = sub["range"]
                    median = sub["median"]

            gap = actual - median
            if actual < low:
                status = "偏低"
            elif actual > high:
                status = "偏高" if "费用" in name else "优秀"
            else:
                status = "达标"

            parts.append(
                f"- {name}: 实际{actual:.1f}{unit} vs 行业{low:.0f}-{high:.0f}{unit}"
                f" (中位数{median:.1f}{unit}, {status}, 差距{gap:+.1f})"
            )

        return "\n".join(parts) if len(parts) > 1 else ""


# Singleton
_bridge_instance: Optional[FoodContextBridge] = None


def get_food_context_bridge() -> FoodContextBridge:
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = FoodContextBridge()
    return _bridge_instance
