"""
Background precomputation service (D6).

Triggers structure analysis + field detection in the background when
a file is first opened (list-sheets), so results are cached before
the user clicks "Analyze".

Results are stored in the existing StructureAnalysisCache layer —
no new storage needed.
"""
import asyncio
import logging
import io
from typing import Dict

import pandas as pd

logger = logging.getLogger(__name__)

# Track in-progress precomputations to avoid duplicates
_precompute_tasks: Dict[str, asyncio.Task] = {}
_MAX_TRACKED = 50  # Prevent memory leak from task tracking


async def trigger_precompute(file_bytes: bytes, filename: str):
    """
    Trigger background precomputation for file bytes.
    Called from list_sheets_detailed when user first opens a file.

    - Only precomputes for files > 2KB (skip tiny/empty files)
    - Max 3 concurrent precomputations
    - Results go into StructureAnalysisCache automatically
    """
    if len(file_bytes) < 2048:
        return

    # Use hash of first 4KB + file size as dedup key
    import hashlib
    key = hashlib.md5(file_bytes[:4096] + str(len(file_bytes)).encode()).hexdigest()[:16]

    # Don't duplicate
    if key in _precompute_tasks and not _precompute_tasks[key].done():
        logger.debug(f"[Precompute] Already running for {key}")
        return

    # Limit concurrent precomputations
    active = sum(1 for t in _precompute_tasks.values() if not t.done())
    if active >= 3:
        logger.debug(f"[Precompute] Too many active ({active}), skipping")
        return

    task = asyncio.create_task(_do_precompute(key, file_bytes, filename))
    _precompute_tasks[key] = task
    _cleanup_completed()


async def _do_precompute(key: str, file_bytes: bytes, filename: str):
    """Run structure analysis for all sheets in background."""
    try:
        logger.info(f"[Precompute] Starting for {filename} ({len(file_bytes)} bytes)")
        start = asyncio.get_event_loop().time()

        # Read sheets
        try:
            sheets = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, header=None)
        except Exception as e:
            logger.warning(f"[Precompute] Failed to read {filename}: {e}")
            return

        # Run structure analysis per sheet — results auto-cached
        from smartbi.services.structure.llm_analyzer import get_structure_analyzer
        analyzer = get_structure_analyzer()

        tasks = []
        for sheet_name, df in sheets.items():
            if df.empty or len(df) < 2:
                continue
            tasks.append(_analyze_sheet(analyzer, df, str(sheet_name)))

        if not tasks:
            return

        results = await asyncio.gather(*tasks, return_exceptions=True)
        success = sum(1 for r in results if not isinstance(r, Exception))
        elapsed = asyncio.get_event_loop().time() - start
        logger.info(f"[Precompute] Done: {success}/{len(tasks)} sheets in {elapsed:.1f}s ({filename})")

    except Exception as e:
        logger.error(f"[Precompute] Error: {e}", exc_info=True)
    finally:
        _precompute_tasks.pop(key, None)


async def _analyze_sheet(analyzer, df, sheet_name: str):
    """Precompute structure analysis for one sheet."""
    try:
        result = await analyzer.analyze(df)
        logger.debug(f"[Precompute] Structure cached for sheet '{sheet_name}'")
        return result
    except Exception as e:
        logger.warning(f"[Precompute] Failed for sheet '{sheet_name}': {e}")
        raise


def _cleanup_completed():
    """Remove completed tasks, cap tracking dict size."""
    done = [k for k, t in _precompute_tasks.items() if t.done()]
    for k in done:
        _precompute_tasks.pop(k, None)
    # Hard cap
    if len(_precompute_tasks) > _MAX_TRACKED:
        oldest = list(_precompute_tasks.keys())[:len(_precompute_tasks) - _MAX_TRACKED]
        for k in oldest:
            _precompute_tasks.pop(k, None)
