"""
Cache Services Module

This module provides caching functionality for SmartBI:
- analysis_cache: Complete analysis caching (data + LLM results)
- schema_cache: Structure detection and semantic mapping caching
- persistence: PostgreSQL persistence for analysis results

All classes and functions are re-exported here for backward compatibility.
"""

# From analysis_cache.py
from .analysis_cache import (
    CACHE_VERSION,
    CacheMetadata,
    CachedAnalysis,
    CachedData,
    AnalysisCacheManager,
    get_cache_manager,
    reset_cache_manager,
    generate_markdown_content,
)

# From schema_cache.py
from .schema_cache import (
    CacheEntry,
    SimilarityMatch,
    SchemaCache,
    get_schema_cache,
)

# From persistence.py (formerly analysis_persistence.py)
from .persistence import (
    AnalysisPersistenceService,
    get_persistence_service,
)

__all__ = [
    # analysis_cache
    "CACHE_VERSION",
    "CacheMetadata",
    "CachedAnalysis",
    "CachedData",
    "AnalysisCacheManager",
    "get_cache_manager",
    "reset_cache_manager",
    "generate_markdown_content",
    # schema_cache
    "CacheEntry",
    "SimilarityMatch",
    "SchemaCache",
    "get_schema_cache",
    # persistence
    "AnalysisPersistenceService",
    "get_persistence_service",
]
