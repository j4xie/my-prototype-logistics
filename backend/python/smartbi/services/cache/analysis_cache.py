from __future__ import annotations
"""
Analysis Cache Manager (Complete Version)

Implements complete caching for SmartBI analysis including:
- Raw data (JSON/CSV/MD)
- LLM analysis results (fields, scenario, metrics, charts, insights)
- Hash-based cache key generation
- Async file saving (non-blocking)

Architecture:
┌─────────────────────────────────────────────────────────────────────┐
│  Excel bytes                                                         │
│      ↓                                                               │
│  计算文件 hash → 检查缓存                                             │
│      │                                                               │
│      ├── 完整缓存命中 → 读取 analysis.json                            │
│      │                  返回完整结果 (跳过所有LLM调用)                 │
│      │                                                               │
│      ├── 数据缓存命中 → 读取 data.json/csv                            │
│      │   (分析缺失)     执行LLM分析，保存 analysis.json               │
│      │                                                               │
│      └── 完全未命中 → 提取数据 + LLM分析                              │
│                        异步保存所有文件                               │
└─────────────────────────────────────────────────────────────────────┘

Cache Structure:
cache/{hash}/
├── data.json           # 原始数据结构 + 统计
├── data.csv            # 清洗后的 DataFrame
├── context.md          # Markdown 格式 (LLM 上下文)
├── analysis.json       # 完整分析结果
│   ├── fields          # 字段检测结果
│   ├── scenario        # 场景识别结果
│   ├── metrics         # 指标计算结果
│   ├── charts          # 图表配置
│   └── insights        # 洞察结果
└── metadata.json       # 缓存元信息
"""
import asyncio
import hashlib
import json
import logging
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# Thread pool for async file operations
_executor = ThreadPoolExecutor(max_workers=4)

# Cache version - increment when cache structure changes
CACHE_VERSION = "2.0"


@dataclass
class CacheMetadata:
    """Cache entry metadata"""
    cache_key: str
    version: str
    sheet_index: int
    sheet_name: str
    created_at: float
    file_size: int
    row_count: int
    col_count: int
    has_data: bool = False
    has_analysis: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cacheKey": self.cache_key,
            "version": self.version,
            "sheetIndex": self.sheet_index,
            "sheetName": self.sheet_name,
            "createdAt": self.created_at,
            "createdAtStr": datetime.fromtimestamp(self.created_at).isoformat(),
            "fileSize": self.file_size,
            "rowCount": self.row_count,
            "colCount": self.col_count,
            "hasData": self.has_data,
            "hasAnalysis": self.has_analysis
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CacheMetadata":
        return cls(
            cache_key=data.get("cacheKey", ""),
            version=data.get("version", "1.0"),
            sheet_index=data.get("sheetIndex", 0),
            sheet_name=data.get("sheetName", ""),
            created_at=data.get("createdAt", 0),
            file_size=data.get("fileSize", 0),
            row_count=data.get("rowCount", 0),
            col_count=data.get("colCount", 0),
            has_data=data.get("hasData", False),
            has_analysis=data.get("hasAnalysis", False)
        )


@dataclass
class CachedAnalysis:
    """Cached analysis results"""
    fields: List[Dict[str, Any]] = field(default_factory=list)
    scenario: Optional[Dict[str, Any]] = None
    metrics: List[Dict[str, Any]] = field(default_factory=list)
    charts: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[Dict[str, Any]] = field(default_factory=list)
    predictions: Optional[List[Dict[str, Any]]] = None
    context: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0
    analysis_depth: str = "standard"
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fields": self.fields,
            "scenario": self.scenario,
            "metrics": self.metrics,
            "charts": self.charts,
            "insights": self.insights,
            "predictions": self.predictions,
            "context": self.context,
            "processingTimeMs": self.processing_time_ms,
            "analysisDepth": self.analysis_depth,
            "notes": self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CachedAnalysis":
        return cls(
            fields=data.get("fields", []),
            scenario=data.get("scenario"),
            metrics=data.get("metrics", []),
            charts=data.get("charts", []),
            insights=data.get("insights", []),
            predictions=data.get("predictions"),
            context=data.get("context"),
            processing_time_ms=data.get("processingTimeMs", 0),
            analysis_depth=data.get("analysisDepth", "standard"),
            notes=data.get("notes", [])
        )


@dataclass
class CachedData:
    """Cached data (raw + cleaned)"""
    metadata: CacheMetadata
    raw_data: Optional[Dict[str, Any]] = None
    dataframe: Optional[pd.DataFrame] = None
    markdown: Optional[str] = None
    analysis: Optional[CachedAnalysis] = None
    from_cache: bool = True

    def has_data(self) -> bool:
        """Check if data files are available"""
        return (
            self.raw_data is not None and
            self.dataframe is not None
        )

    def has_analysis(self) -> bool:
        """Check if analysis results are available"""
        return (
            self.analysis is not None and
            self.analysis.scenario is not None and
            len(self.analysis.fields) > 0
        )

    def has_complete_cache(self) -> bool:
        """Check if complete cache (data + analysis) is available"""
        return self.has_data() and self.has_analysis()


class AnalysisCacheManager:
    """
    Manages complete analysis cache for SmartBI.

    Features:
    - Hash-based cache key (MD5 of file content + sheet index)
    - Separate data and analysis caching
    - TTL-based expiration
    - Async file saving
    - Version control for cache invalidation
    """

    def __init__(
        self,
        cache_dir: str = "smartbi_cache",
        ttl_hours: int = 24,
        max_cache_size_mb: int = 500
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.ttl_seconds = ttl_hours * 3600
        self.max_cache_size_bytes = max_cache_size_mb * 1024 * 1024

        # Index file for fast lookup
        self.index_path = self.cache_dir / "cache_index.json"
        self._index: Dict[str, CacheMetadata] = {}
        self._load_index()

    def _load_index(self):
        """Load cache index from disk"""
        try:
            if self.index_path.exists():
                with open(self.index_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for key, meta in data.items():
                        self._index[key] = CacheMetadata.from_dict(meta)
                logger.info(f"Loaded cache index: {len(self._index)} entries")
        except Exception as e:
            logger.warning(f"Failed to load cache index: {e}")
            self._index = {}

    def _save_index(self):
        """Save cache index to disk"""
        try:
            data = {key: meta.to_dict() for key, meta in self._index.items()}
            with open(self.index_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache index: {e}")

    def generate_cache_key(self, file_bytes: bytes, sheet_index: int) -> str:
        """Generate cache key from file content and sheet index"""
        hasher = hashlib.md5()
        hasher.update(file_bytes)
        hasher.update(str(sheet_index).encode())
        return hasher.hexdigest()

    def get_cache_dir_for_key(self, cache_key: str) -> Path:
        """Get cache directory for a specific key"""
        return self.cache_dir / cache_key

    def get_cache_paths(self, cache_key: str) -> Tuple[Path, Path, Path]:
        """Get paths for JSON, CSV, MD files (backward compatibility)"""
        cache_dir = self.get_cache_dir_for_key(cache_key)
        return (
            cache_dir / "data.json",
            cache_dir / "data.csv",
            cache_dir / "context.md"
        )

    def get_analysis_path(self, cache_key: str) -> Path:
        """Get path for analysis.json"""
        return self.get_cache_dir_for_key(cache_key) / "analysis.json"

    def get_metadata_path(self, cache_key: str) -> Path:
        """Get path for metadata.json"""
        return self.get_cache_dir_for_key(cache_key) / "metadata.json"

    def is_cached(self, file_bytes: bytes, sheet_index: int) -> bool:
        """Check if file is already cached (data only)"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)
        return self._is_data_cached(cache_key)

    def is_analysis_cached(self, file_bytes: bytes, sheet_index: int) -> bool:
        """Check if analysis results are cached"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)
        return self._is_analysis_cached(cache_key)

    def _is_data_cached(self, cache_key: str) -> bool:
        """Check if data cache is valid"""
        if cache_key not in self._index:
            return False

        meta = self._index[cache_key]

        # Check version
        if meta.version != CACHE_VERSION:
            logger.debug(f"Cache version mismatch: {cache_key}")
            return False

        # Check TTL
        if time.time() - meta.created_at > self.ttl_seconds:
            logger.debug(f"Cache expired: {cache_key}")
            return False

        # Check data files exist
        json_path, csv_path, _ = self.get_cache_paths(cache_key)
        if not json_path.exists() or not csv_path.exists():
            logger.debug(f"Data cache files missing: {cache_key}")
            return False

        return True

    def _is_analysis_cached(self, cache_key: str) -> bool:
        """Check if analysis cache is valid"""
        if not self._is_data_cached(cache_key):
            return False

        meta = self._index[cache_key]
        if not meta.has_analysis:
            return False

        analysis_path = self.get_analysis_path(cache_key)
        if not analysis_path.exists():
            return False

        return True

    def get_cached(
        self,
        file_bytes: bytes,
        sheet_index: int,
        include_analysis: bool = True
    ) -> Optional[CachedData]:
        """
        Get cached data and optionally analysis.

        Args:
            file_bytes: Original Excel file bytes
            sheet_index: Sheet index
            include_analysis: Whether to load analysis results

        Returns:
            CachedData if cache hit, None if cache miss
        """
        cache_key = self.generate_cache_key(file_bytes, sheet_index)

        if not self._is_data_cached(cache_key):
            return None

        try:
            meta = self._index[cache_key]
            json_path, csv_path, md_path = self.get_cache_paths(cache_key)

            # Load data
            with open(json_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)

            dataframe = pd.read_csv(csv_path, encoding='utf-8')

            markdown = None
            if md_path.exists():
                with open(md_path, 'r', encoding='utf-8') as f:
                    markdown = f.read()

            # Load analysis if requested and available
            analysis = None
            if include_analysis and self._is_analysis_cached(cache_key):
                analysis_path = self.get_analysis_path(cache_key)
                with open(analysis_path, 'r', encoding='utf-8') as f:
                    analysis_data = json.load(f)
                    analysis = CachedAnalysis.from_dict(analysis_data)

            logger.info(f"Cache hit: {cache_key} (data={True}, analysis={analysis is not None})")

            return CachedData(
                metadata=meta,
                raw_data=raw_data,
                dataframe=dataframe,
                markdown=markdown,
                analysis=analysis,
                from_cache=True
            )

        except Exception as e:
            logger.error(f"Failed to load cache: {e}")
            return None

    async def save_data_async(
        self,
        file_bytes: bytes,
        sheet_index: int,
        sheet_name: str,
        raw_data: Dict[str, Any],
        dataframe: pd.DataFrame,
        markdown: str
    ) -> CacheMetadata:
        """Save data files to cache asynchronously"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)
        cache_dir = self.get_cache_dir_for_key(cache_key)
        json_path, csv_path, md_path = self.get_cache_paths(cache_key)

        # Create metadata
        metadata = CacheMetadata(
            cache_key=cache_key,
            version=CACHE_VERSION,
            sheet_index=sheet_index,
            sheet_name=sheet_name,
            created_at=time.time(),
            file_size=len(file_bytes),
            row_count=len(dataframe),
            col_count=len(dataframe.columns),
            has_data=True,
            has_analysis=False
        )

        loop = asyncio.get_event_loop()

        def _save_files():
            try:
                # Create cache directory
                cache_dir.mkdir(parents=True, exist_ok=True)

                # Save JSON
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(raw_data, f, ensure_ascii=False, indent=2, default=str)

                # Save CSV
                dataframe.to_csv(csv_path, index=False, encoding='utf-8')

                # Save MD
                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(markdown)

                # Save metadata
                meta_path = self.get_metadata_path(cache_key)
                with open(meta_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata.to_dict(), f, ensure_ascii=False, indent=2)

                # Update index
                self._index[cache_key] = metadata
                self._save_index()

                logger.info(f"Data cache saved: {cache_key} ({sheet_name})")

            except Exception as e:
                logger.error(f"Failed to save data cache: {e}")

        loop.run_in_executor(_executor, _save_files)
        return metadata

    async def save_analysis_async(
        self,
        file_bytes: bytes,
        sheet_index: int,
        analysis: CachedAnalysis
    ) -> bool:
        """Save analysis results to cache asynchronously"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)

        if cache_key not in self._index:
            logger.warning(f"Cannot save analysis: data not cached for {cache_key}")
            return False

        analysis_path = self.get_analysis_path(cache_key)

        loop = asyncio.get_event_loop()

        def _save_analysis():
            try:
                # Save analysis
                with open(analysis_path, 'w', encoding='utf-8') as f:
                    json.dump(analysis.to_dict(), f, ensure_ascii=False, indent=2, default=str)

                # Update metadata
                meta = self._index[cache_key]
                meta.has_analysis = True

                meta_path = self.get_metadata_path(cache_key)
                with open(meta_path, 'w', encoding='utf-8') as f:
                    json.dump(meta.to_dict(), f, ensure_ascii=False, indent=2)

                self._save_index()

                logger.info(f"Analysis cache saved: {cache_key}")
                return True

            except Exception as e:
                logger.error(f"Failed to save analysis cache: {e}")
                return False

        await loop.run_in_executor(_executor, _save_analysis)
        return True

    async def save_complete_async(
        self,
        file_bytes: bytes,
        sheet_index: int,
        sheet_name: str,
        raw_data: Dict[str, Any],
        dataframe: pd.DataFrame,
        markdown: str,
        analysis: CachedAnalysis
    ) -> CacheMetadata:
        """Save both data and analysis to cache asynchronously"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)
        cache_dir = self.get_cache_dir_for_key(cache_key)
        json_path, csv_path, md_path = self.get_cache_paths(cache_key)
        analysis_path = self.get_analysis_path(cache_key)

        # Create metadata
        metadata = CacheMetadata(
            cache_key=cache_key,
            version=CACHE_VERSION,
            sheet_index=sheet_index,
            sheet_name=sheet_name,
            created_at=time.time(),
            file_size=len(file_bytes),
            row_count=len(dataframe),
            col_count=len(dataframe.columns),
            has_data=True,
            has_analysis=True
        )

        loop = asyncio.get_event_loop()

        def _save_all():
            try:
                # Create cache directory
                cache_dir.mkdir(parents=True, exist_ok=True)

                # Save data files
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(raw_data, f, ensure_ascii=False, indent=2, default=str)

                dataframe.to_csv(csv_path, index=False, encoding='utf-8')

                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(markdown)

                # Save analysis
                with open(analysis_path, 'w', encoding='utf-8') as f:
                    json.dump(analysis.to_dict(), f, ensure_ascii=False, indent=2, default=str)

                # Save metadata
                meta_path = self.get_metadata_path(cache_key)
                with open(meta_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata.to_dict(), f, ensure_ascii=False, indent=2)

                # Update index
                self._index[cache_key] = metadata
                self._save_index()

                logger.info(f"Complete cache saved: {cache_key} ({sheet_name})")

            except Exception as e:
                logger.error(f"Failed to save complete cache: {e}")

        loop.run_in_executor(_executor, _save_all)
        return metadata

    # Backward compatibility
    async def save_async(
        self,
        file_bytes: bytes,
        sheet_index: int,
        sheet_name: str,
        raw_data: Dict[str, Any],
        dataframe: pd.DataFrame,
        markdown: str,
        cleaned: bool = True
    ) -> CacheMetadata:
        """Backward compatible save (data only)"""
        return await self.save_data_async(
            file_bytes, sheet_index, sheet_name,
            raw_data, dataframe, markdown
        )

    def invalidate(self, file_bytes: bytes, sheet_index: int) -> bool:
        """Invalidate cache entry"""
        cache_key = self.generate_cache_key(file_bytes, sheet_index)
        return self._invalidate_by_key(cache_key)

    def _invalidate_by_key(self, cache_key: str) -> bool:
        """Invalidate cache entry by key"""
        if cache_key not in self._index:
            return False

        try:
            cache_dir = self.get_cache_dir_for_key(cache_key)
            if cache_dir.exists():
                shutil.rmtree(cache_dir)

            del self._index[cache_key]
            self._save_index()

            logger.info(f"Cache invalidated: {cache_key}")
            return True

        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}")
            return False

    def cleanup_expired(self) -> int:
        """Remove expired cache entries"""
        expired_keys = []
        now = time.time()

        for key, meta in self._index.items():
            if now - meta.created_at > self.ttl_seconds:
                expired_keys.append(key)

        for key in expired_keys:
            self._invalidate_by_key(key)

        logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
        return len(expired_keys)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_size = 0
        valid_count = 0
        with_analysis_count = 0
        expired_count = 0
        now = time.time()

        for key, meta in self._index.items():
            cache_dir = self.get_cache_dir_for_key(key)
            if cache_dir.exists():
                for f in cache_dir.iterdir():
                    total_size += f.stat().st_size

            if now - meta.created_at > self.ttl_seconds:
                expired_count += 1
            else:
                valid_count += 1
                if meta.has_analysis:
                    with_analysis_count += 1

        return {
            "cacheDir": str(self.cache_dir),
            "version": CACHE_VERSION,
            "totalEntries": len(self._index),
            "validEntries": valid_count,
            "withAnalysis": with_analysis_count,
            "expiredEntries": expired_count,
            "totalSizeMB": round(total_size / 1024 / 1024, 2),
            "maxSizeMB": self.max_cache_size_bytes / 1024 / 1024,
            "ttlHours": self.ttl_seconds / 3600
        }

    def clear_all(self):
        """Clear all cache entries"""
        for key in list(self._index.keys()):
            self._invalidate_by_key(key)
        logger.info("All cache cleared")


# Global cache manager instance
_cache_manager: Optional[AnalysisCacheManager] = None


def get_cache_manager(
    cache_dir: str = "smartbi_cache",
    ttl_hours: int = 24
) -> AnalysisCacheManager:
    """Get or create global cache manager instance"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = AnalysisCacheManager(
            cache_dir=cache_dir,
            ttl_hours=ttl_hours
        )
    return _cache_manager


def reset_cache_manager():
    """Reset global cache manager (for testing)"""
    global _cache_manager
    _cache_manager = None


def generate_markdown_content(
    sheet_name: str,
    headers: List[str],
    dataframe: pd.DataFrame,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Generate Markdown content for LLM consumption"""
    lines = []

    # Title
    lines.append(f"# {sheet_name}")
    lines.append("")

    # Metadata
    if metadata:
        lines.append("## 元信息")
        if metadata.get("title"):
            lines.append(f"- **标题**: {metadata['title']}")
        if metadata.get("unit"):
            lines.append(f"- **单位**: {metadata['unit']}")
        if metadata.get("period"):
            lines.append(f"- **期间**: {metadata['period']}")
        if metadata.get("notes"):
            lines.append(f"- **备注**: {metadata['notes']}")
        lines.append("")

    # Data overview
    lines.append("## 数据概览")
    lines.append(f"- 行数: {len(dataframe)}")
    lines.append(f"- 列数: {len(headers)}")
    lines.append(f"- 列名: {', '.join(str(h) for h in headers[:10])}" + ("..." if len(headers) > 10 else ""))
    lines.append("")

    # Data table (first 20 rows)
    lines.append("## 数据表")
    lines.append("")

    # Header row
    display_headers = headers[:10]
    lines.append("| " + " | ".join(str(h)[:15] for h in display_headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(display_headers)) + " |")

    # Data rows (handle duplicate column names)
    header_indices = {h: i for i, h in enumerate(headers) if i < 10}
    for idx in range(min(20, len(dataframe))):
        row_values = []
        for h in display_headers:
            col_idx = header_indices.get(h)
            if col_idx is not None and col_idx < len(dataframe.columns):
                val = dataframe.iloc[idx, col_idx]
                # Handle case where val is a Series (duplicate columns)
                if isinstance(val, pd.Series):
                    val = val.iloc[0] if len(val) > 0 else ""
                row_values.append(str(val)[:15] if val is not None else "")
            else:
                row_values.append("")
        lines.append("| " + " | ".join(row_values) + " |")

    if len(dataframe) > 20:
        lines.append(f"... 共 {len(dataframe)} 行")

    lines.append("")

    # Column statistics (handle duplicate column names)
    lines.append("## 列统计")

    processed_cols = set()
    for col_idx, col in enumerate(dataframe.columns):
        # Skip duplicate column names and limit to 5
        if col in processed_cols or len(processed_cols) >= 5:
            continue

        # Use iloc to handle duplicate column names
        series = dataframe.iloc[:, col_idx]
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]

        # Only process numeric columns
        if not pd.api.types.is_numeric_dtype(series):
            continue

        processed_cols.add(col)

        try:
            sum_val = series.sum()
            mean_val = series.mean()
            max_val = series.max()
            min_val = series.min()

            lines.append(f"### {col}")
            lines.append(f"- 总计: {sum_val:,.2f}" if pd.notna(sum_val) else "- 总计: N/A")
            lines.append(f"- 均值: {mean_val:,.2f}" if pd.notna(mean_val) else "- 均值: N/A")
            lines.append(f"- 最大: {max_val:,.2f}" if pd.notna(max_val) else "- 最大: N/A")
            lines.append(f"- 最小: {min_val:,.2f}" if pd.notna(min_val) else "- 最小: N/A")
            lines.append("")
        except Exception as e:
            logger.debug(f"Could not calculate stats for column {col}: {e}")
            continue

    return "\n".join(lines)
