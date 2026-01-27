from __future__ import annotations
"""
Schema Cache Service

Caches structure detection and semantic mapping results to:
1. Reduce API costs for repeated file uploads
2. Speed up processing of similar files
3. Enable learning from user corrections

Part of the Zero-Code SmartBI architecture.
"""
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .structure_detector import StructureDetectionResult
from .semantic_mapper import SemanticMappingResult

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """A single cache entry"""
    key: str
    structure_config: Dict[str, Any]
    mapping_config: Dict[str, Any]
    created_at: float
    accessed_at: float
    access_count: int = 1
    user_corrections: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "structure_config": self.structure_config,
            "mapping_config": self.mapping_config,
            "created_at": self.created_at,
            "accessed_at": self.accessed_at,
            "access_count": self.access_count,
            "user_corrections": self.user_corrections,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CacheEntry":
        return cls(
            key=data["key"],
            structure_config=data["structure_config"],
            mapping_config=data["mapping_config"],
            created_at=data["created_at"],
            accessed_at=data["accessed_at"],
            access_count=data.get("access_count", 1),
            user_corrections=data.get("user_corrections", []),
            metadata=data.get("metadata", {})
        )


@dataclass
class SimilarityMatch:
    """A similarity match result"""
    cache_key: str
    similarity_score: float
    structure_config: Dict[str, Any]
    mapping_config: Dict[str, Any]


class SchemaCache:
    """
    Caches Excel schema detection results.

    Features:
    1. Exact match cache (by file hash + sheet)
    2. Similarity-based lookup (for similar but not identical files)
    3. TTL-based expiration
    4. User correction learning
    """

    def __init__(
        self,
        cache_dir: Optional[str] = None,
        ttl_seconds: int = 3600,
        max_entries: int = 1000
    ):
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries

        # File-based persistence (optional)
        if cache_dir:
            self._cache_dir = Path(cache_dir)
            self._cache_dir.mkdir(parents=True, exist_ok=True)
            self._load_from_disk()
        else:
            self._cache_dir = None

        self._settings = None

    @property
    def settings(self):
        if self._settings is None:
            from config import get_settings
            self._settings = get_settings()
        return self._settings

    def _generate_cache_key(
        self,
        file_bytes: bytes,
        sheet_index: int
    ) -> str:
        """Generate unique cache key from file content and sheet"""
        file_hash = hashlib.sha256(file_bytes).hexdigest()[:16]
        return f"{file_hash}:{sheet_index}"

    def _generate_header_signature(
        self,
        headers: List[str]
    ) -> str:
        """Generate a signature from headers for similarity matching"""
        # Normalize and sort headers
        normalized = sorted([h.lower().strip() for h in headers if h])
        signature = "|".join(normalized[:20])  # Limit to first 20
        return hashlib.md5(signature.encode()).hexdigest()[:8]

    def get(
        self,
        file_bytes: bytes,
        sheet_index: int
    ) -> Optional[Tuple[StructureDetectionResult, SemanticMappingResult]]:
        """
        Get cached results for a file.

        Args:
            file_bytes: Raw file content
            sheet_index: Sheet index

        Returns:
            Tuple of (structure_config, mapping_config) if found, None otherwise
        """
        if not self.settings.schema_cache_enabled:
            return None

        cache_key = self._generate_cache_key(file_bytes, sheet_index)

        # Check memory cache
        entry = self._memory_cache.get(cache_key)
        if entry:
            # Check TTL
            if time.time() - entry.created_at < self._ttl_seconds:
                entry.accessed_at = time.time()
                entry.access_count += 1

                logger.debug(f"Cache hit: {cache_key}")

                # Reconstruct results from cached data
                structure = self._dict_to_structure(entry.structure_config)
                mapping = self._dict_to_mapping(entry.mapping_config)

                return (structure, mapping)
            else:
                # Expired
                del self._memory_cache[cache_key]

        # Check disk cache
        if self._cache_dir:
            disk_entry = self._load_entry_from_disk(cache_key)
            if disk_entry:
                if time.time() - disk_entry.created_at < self._ttl_seconds:
                    # Add to memory cache
                    self._memory_cache[cache_key] = disk_entry

                    structure = self._dict_to_structure(disk_entry.structure_config)
                    mapping = self._dict_to_mapping(disk_entry.mapping_config)

                    return (structure, mapping)

        return None

    def set(
        self,
        file_bytes: bytes,
        sheet_index: int,
        structure_config: StructureDetectionResult,
        mapping_config: SemanticMappingResult,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Cache results for a file.

        Args:
            file_bytes: Raw file content
            sheet_index: Sheet index
            structure_config: Structure detection result
            mapping_config: Semantic mapping result
            metadata: Optional metadata

        Returns:
            Cache key
        """
        if not self.settings.schema_cache_enabled:
            return ""

        cache_key = self._generate_cache_key(file_bytes, sheet_index)

        # Create entry
        entry = CacheEntry(
            key=cache_key,
            structure_config=structure_config.to_dict(),
            mapping_config=mapping_config.to_dict(),
            created_at=time.time(),
            accessed_at=time.time(),
            metadata=metadata or {}
        )

        # Add header signature for similarity matching
        headers = [col.name for col in structure_config.columns]
        entry.metadata["header_signature"] = self._generate_header_signature(headers)

        # Store in memory cache
        self._memory_cache[cache_key] = entry

        # Evict old entries if needed
        if len(self._memory_cache) > self._max_entries:
            self._evict_old_entries()

        # Persist to disk
        if self._cache_dir:
            self._save_entry_to_disk(entry)

        logger.debug(f"Cache set: {cache_key}")
        return cache_key

    def find_similar(
        self,
        headers: List[str],
        min_similarity: float = 0.7
    ) -> Optional[SimilarityMatch]:
        """
        Find similar cached schemas based on header similarity.

        Args:
            headers: List of column headers to match
            min_similarity: Minimum similarity score (0.0-1.0)

        Returns:
            Best matching cache entry if found
        """
        if not headers:
            return None

        best_match = None
        best_score = 0.0

        # Normalize input headers
        input_set = set(h.lower().strip() for h in headers if h)

        for cache_key, entry in self._memory_cache.items():
            # Get cached headers
            cached_columns = entry.structure_config.get("columns", [])
            cached_headers = set(
                col.get("name", "").lower().strip()
                for col in cached_columns
                if col.get("name")
            )

            if not cached_headers:
                continue

            # Calculate Jaccard similarity
            intersection = len(input_set & cached_headers)
            union = len(input_set | cached_headers)

            if union > 0:
                similarity = intersection / union

                if similarity >= min_similarity and similarity > best_score:
                    best_score = similarity
                    best_match = SimilarityMatch(
                        cache_key=cache_key,
                        similarity_score=similarity,
                        structure_config=entry.structure_config,
                        mapping_config=entry.mapping_config
                    )

        if best_match:
            logger.debug(f"Found similar schema: {best_match.cache_key} (score={best_score:.2f})")

        return best_match

    def add_user_correction(
        self,
        cache_key: str,
        correction: Dict[str, Any]
    ) -> bool:
        """
        Add a user correction to learn from.

        Args:
            cache_key: Cache key to update
            correction: Correction data (e.g., {"type": "mapping", "original": "col", "correct": "field"})

        Returns:
            True if successfully added
        """
        entry = self._memory_cache.get(cache_key)
        if not entry:
            return False

        entry.user_corrections.append({
            "correction": correction,
            "timestamp": time.time()
        })

        # Persist
        if self._cache_dir:
            self._save_entry_to_disk(entry)

        logger.info(f"Added user correction to cache: {cache_key}")
        return True

    def get_user_corrections(
        self,
        cache_key: str
    ) -> List[Dict[str, Any]]:
        """Get all user corrections for a cache entry"""
        entry = self._memory_cache.get(cache_key)
        if entry:
            return entry.user_corrections
        return []

    def invalidate(self, cache_key: str) -> bool:
        """Invalidate a cache entry"""
        if cache_key in self._memory_cache:
            del self._memory_cache[cache_key]

            if self._cache_dir:
                cache_file = self._cache_dir / f"{cache_key}.json"
                if cache_file.exists():
                    cache_file.unlink()

            logger.debug(f"Cache invalidated: {cache_key}")
            return True

        return False

    def clear(self):
        """Clear all cache entries"""
        self._memory_cache.clear()

        if self._cache_dir:
            for cache_file in self._cache_dir.glob("*.json"):
                cache_file.unlink()

        logger.info("Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        now = time.time()
        active_entries = [
            e for e in self._memory_cache.values()
            if now - e.created_at < self._ttl_seconds
        ]

        return {
            "total_entries": len(self._memory_cache),
            "active_entries": len(active_entries),
            "total_accesses": sum(e.access_count for e in self._memory_cache.values()),
            "entries_with_corrections": sum(
                1 for e in self._memory_cache.values() if e.user_corrections
            )
        }

    def _evict_old_entries(self):
        """Evict oldest entries when cache is full"""
        if len(self._memory_cache) <= self._max_entries:
            return

        # Sort by last access time
        sorted_keys = sorted(
            self._memory_cache.keys(),
            key=lambda k: self._memory_cache[k].accessed_at
        )

        # Remove oldest 10%
        to_remove = max(1, len(sorted_keys) // 10)
        for key in sorted_keys[:to_remove]:
            del self._memory_cache[key]
            if self._cache_dir:
                cache_file = self._cache_dir / f"{key}.json"
                if cache_file.exists():
                    cache_file.unlink()

        logger.debug(f"Evicted {to_remove} old cache entries")

    def _load_from_disk(self):
        """Load cache from disk"""
        if not self._cache_dir:
            return

        for cache_file in self._cache_dir.glob("*.json"):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    entry = CacheEntry.from_dict(data)

                    # Check TTL
                    if time.time() - entry.created_at < self._ttl_seconds:
                        self._memory_cache[entry.key] = entry
                    else:
                        # Expired, delete file
                        cache_file.unlink()

            except Exception as e:
                logger.warning(f"Failed to load cache file {cache_file}: {e}")

        logger.info(f"Loaded {len(self._memory_cache)} cache entries from disk")

    def _save_entry_to_disk(self, entry: CacheEntry):
        """Save a cache entry to disk"""
        if not self._cache_dir:
            return

        cache_file = self._cache_dir / f"{entry.key}.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(entry.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save cache entry: {e}")

    def _load_entry_from_disk(self, cache_key: str) -> Optional[CacheEntry]:
        """Load a single cache entry from disk"""
        if not self._cache_dir:
            return None

        cache_file = self._cache_dir / f"{cache_key}.json"
        if not cache_file.exists():
            return None

        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return CacheEntry.from_dict(data)
        except Exception as e:
            logger.warning(f"Failed to load cache entry from disk: {e}")
            return None

    def _dict_to_structure(self, data: Dict[str, Any]) -> StructureDetectionResult:
        """Convert dictionary back to StructureDetectionResult"""
        from .structure_detector import (
            StructureDetectionResult, RowInfo, ColumnInfo, MergedCellInfo
        )

        result = StructureDetectionResult(
            version=data.get("version", "1.0"),
            success=data.get("success", True),
            confidence=data.get("confidence", 0.0),
            method=data.get("method", "cache")
        )

        # Sheet info
        sheet_info = data.get("sheet_info", {})
        result.sheet_name = sheet_info.get("name", "")
        result.total_rows = sheet_info.get("total_rows", 0)
        result.total_cols = sheet_info.get("total_cols", 0)

        # Header info
        header_info = data.get("header", {})
        result.header_row_count = header_info.get("row_count", 1)
        result.data_start_row = header_info.get("data_start_row", 1)

        # Header rows
        for row_data in header_info.get("rows", []):
            result.header_rows.append(RowInfo(
                index=row_data.get("index", 0),
                type=row_data.get("type", "unknown"),
                content=row_data.get("content", ""),
                is_empty=row_data.get("is_empty", False),
                merged_count=row_data.get("merged_count", 0)
            ))

        # Merged cells
        for merge_data in data.get("merged_cells", []):
            result.merged_cells.append(MergedCellInfo(
                range=merge_data.get("range", ""),
                value=merge_data.get("value", ""),
                min_row=merge_data.get("min_row", 0),
                max_row=merge_data.get("max_row", 0),
                min_col=merge_data.get("min_col", 0),
                max_col=merge_data.get("max_col", 0)
            ))

        # Columns
        for col_data in data.get("columns", []):
            result.columns.append(ColumnInfo(
                index=col_data.get("index", 0),
                name=col_data.get("name", ""),
                data_type=col_data.get("data_type", "text"),
                sample_values=col_data.get("sample_values", [])
            ))

        result.preview_rows = data.get("preview_rows", [])

        return result

    def _dict_to_mapping(self, data: Dict[str, Any]) -> SemanticMappingResult:
        """Convert dictionary back to SemanticMappingResult"""
        from .semantic_mapper import SemanticMappingResult, FieldMapping

        result = SemanticMappingResult(
            success=data.get("success", True),
            confidence=data.get("confidence", 0.0),
            method=data.get("method", "cache"),
            table_type=data.get("table_type"),
            time_dimension=data.get("time_dimension"),
            unmapped_fields=data.get("unmapped_fields", [])
        )

        for fm_data in data.get("field_mappings", []):
            result.field_mappings.append(FieldMapping(
                original=fm_data.get("original", ""),
                standard=fm_data.get("standard"),
                confidence=fm_data.get("confidence", 0.0),
                method=fm_data.get("method", "cache"),
                category=fm_data.get("category"),
                description=fm_data.get("description")
            ))

        return result


# Global cache instance
_schema_cache: Optional[SchemaCache] = None


def get_schema_cache() -> SchemaCache:
    """Get or create global schema cache instance"""
    global _schema_cache

    if _schema_cache is None:
        from config import get_settings
        settings = get_settings()

        _schema_cache = SchemaCache(
            cache_dir=None,  # In-memory only by default
            ttl_seconds=settings.cache_ttl_seconds,
            max_entries=1000
        )

    return _schema_cache
