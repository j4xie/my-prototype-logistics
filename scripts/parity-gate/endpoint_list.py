"""Parse endpoint lists for batch parity-gate runs.

Two supported file formats:

1. **Preset format** (compatible with
   ``scripts/active-e2e/curl-replay/preset-*.txt``): one line per
   endpoint, ``METHOD path?query`` form:

       GET /api/mobile/{factoryId}/smart-bi/analysis/production?analysisType=oee
       GET /api/mobile/{factoryId}/smart-bi/analysis/quality?analysisType=fpy

   Blank lines and ``# ...`` comments allowed.

2. **Spec-doc auto-extract**: read a markdown spec doc and pull every
   line matching ``^[A-Z]+ /api/mobile/{factory_id}/...``. Useful for
   bulk-extracting from Sub-A spec §1.1 etc.

Both produce a list of ``(method, path, params_str)`` tuples.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple


ENDPOINT_LINE_RE = re.compile(
    r"^\s*(GET|POST|PUT|DELETE|PATCH)\s+(/[^\s?]+)(?:\?(\S+))?\s*$",
    re.IGNORECASE,
)


def parse_preset(path: str) -> List[Tuple[str, str, str]]:
    """Parse a preset-format file. Returns list of (method, path, params)."""
    out: List[Tuple[str, str, str]] = []
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"endpoint list not found: {path}")
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = ENDPOINT_LINE_RE.match(line)
        if not m:
            raise ValueError(f"malformed endpoint line: {line!r}")
        method = m.group(1).upper()
        url_path = m.group(2)
        params = m.group(3) or ""
        out.append((method, url_path, params))
    return out


def parse_spec_doc(path: str) -> List[Tuple[str, str, str]]:
    """Best-effort extraction of endpoint lines from a markdown spec.

    Scans for lines matching ``GET /api/mobile/...`` anywhere — including
    inside code fences. Dedupes preserving order.
    """
    out: List[Tuple[str, str, str]] = []
    seen = set()
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"spec doc not found: {path}")
    for line in p.read_text(encoding="utf-8").splitlines():
        m = ENDPOINT_LINE_RE.match(line)
        if not m:
            continue
        method = m.group(1).upper()
        url_path = m.group(2)
        params = m.group(3) or ""
        key = (method, url_path, params)
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def auto_parse(path: str) -> List[Tuple[str, str, str]]:
    """Dispatch on file extension: .md → spec-doc, else preset."""
    if path.lower().endswith(".md"):
        return parse_spec_doc(path)
    return parse_preset(path)
