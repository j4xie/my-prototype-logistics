"""Heap release helpers for the python-smartbi process.

Big transient allocations (polars DataFrames for 200K-row uploads, row_data
dicts held in the CPython free lists, pyarrow arenas) can leave the process
RSS ballooned even after the Python-level references are dropped. The
kernel doesn't reclaim `MADV_FREE` pages until under pressure, and CPython's
obmalloc won't return a 256 KB arena to glibc while any single allocation
is live in it.

`release_and_trim()` does three things in order:
  1. gc.collect() — break cycles, let finalizers run.
  2. ctypes libc.malloc_trim(0) — glibc releases freed arenas back to OS.
  3. optional os.sync_file_range / no-op on non-glibc.

Call after any code path that just finished a ~1-2 GB transient allocation:
  - materialize_upload (polars DF over all rows)
  - compute_upload_aggregates (parallel JSONB scans)
  - /reclassify + γ-1c warm tasks

Returns a diagnostic dict so callers can log RSS delta. Cheap enough to
run on every upload.
"""
from __future__ import annotations

import ctypes
import gc
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_LIBC: Optional[ctypes.CDLL] = None


def _libc() -> Optional[ctypes.CDLL]:
    """Lazily resolve libc. Returns None on non-glibc systems (musl alpine)
    where malloc_trim isn't available."""
    global _LIBC
    if _LIBC is not None:
        return _LIBC
    try:
        _LIBC = ctypes.CDLL("libc.so.6", use_errno=True)
        if not hasattr(_LIBC, "malloc_trim"):
            logger.warning("[memory] libc.so.6 has no malloc_trim, trim unavailable")
            _LIBC = ctypes.CDLL("")  # sentinel: resolved but useless
    except OSError as e:
        logger.warning(f"[memory] libc.so.6 not resolvable: {e}")
        _LIBC = ctypes.CDLL("")
    return _LIBC


def _proc_rss_kb(pid: Optional[int] = None) -> int:
    """RSS in kilobytes from /proc/self/status (or a given pid).

    Returns 0 if /proc isn't mounted (non-Linux dev boxes).
    """
    path = f"/proc/{pid or 'self'}/status"
    try:
        with open(path, "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1])
    except FileNotFoundError:
        return 0
    return 0


def get_memory_snapshot() -> Dict[str, Any]:
    """Coarse memory breakdown for /admin/memory/status diagnostic."""
    rss_kb = _proc_rss_kb()
    snapshot: Dict[str, Any] = {
        "rss_mb": round(rss_kb / 1024, 1),
        "rss_kb": rss_kb,
    }
    # Add smaps_rollup fields if available (shows LazyFree etc).
    try:
        with open("/proc/self/smaps_rollup", "r") as f:
            for line in f:
                for key in ("Rss:", "Pss:", "Anonymous:", "LazyFree:", "Swap:"):
                    if line.startswith(key):
                        parts = line.split()
                        if len(parts) >= 2:
                            snapshot[key.rstrip(":").lower() + "_kb"] = int(parts[1])
                        break
    except FileNotFoundError:
        pass
    # Python heap summary
    snapshot["gc_counts"] = list(gc.get_count())
    try:
        import sys
        snapshot["python_objects"] = len(gc.get_objects())
        snapshot["python_sys_refcount"] = sys.gettotalrefcount() if hasattr(sys, "gettotalrefcount") else None
    except Exception:
        pass
    return snapshot


def release_and_trim(label: str = "unspecified") -> Dict[str, Any]:
    """Force-release retained memory back to the OS.

    Runs gc.collect + malloc_trim(0). Safe to call repeatedly. Logs RSS
    delta when the caller attached a label.

    Returns {"label", "rss_before_mb", "rss_after_mb", "freed_mb",
             "gc_collected", "trim_available"}.
    """
    rss_before = _proc_rss_kb()
    collected = gc.collect()
    trim_ok = False
    libc = _libc()
    if libc is not None and hasattr(libc, "malloc_trim"):
        try:
            # malloc_trim(0) returns 1 if memory was released, 0 if nothing.
            libc.malloc_trim.argtypes = [ctypes.c_size_t]
            libc.malloc_trim.restype = ctypes.c_int
            ret = libc.malloc_trim(0)
            trim_ok = bool(ret)
        except Exception as e:
            logger.warning(f"[memory] malloc_trim raised: {e}")
    rss_after = _proc_rss_kb()
    freed_kb = max(0, rss_before - rss_after)
    result = {
        "label": label,
        "rss_before_mb": round(rss_before / 1024, 1),
        "rss_after_mb": round(rss_after / 1024, 1),
        "freed_mb": round(freed_kb / 1024, 1),
        "gc_collected": collected,
        "trim_available": libc is not None and hasattr(libc, "malloc_trim"),
        "trim_released_memory": trim_ok,
    }
    if freed_kb > 10 * 1024:  # log only if >10MB freed (cuts noise)
        logger.info(
            f"[memory][{label}] released {result['freed_mb']:.0f}MB: "
            f"{result['rss_before_mb']:.0f}MB → {result['rss_after_mb']:.0f}MB "
            f"(gc={collected}, trim={'ok' if trim_ok else 'noop'})"
        )
    return result
