"""P0-C deep dive analysis — 3-axis diff (binary / text / structure).

Inputs:  admin.pdf, warehouse.pdf (same directory)
Outputs: diff-binary.txt, diff-text.txt, diff-structure.json
"""
from __future__ import annotations

import json
import os
import sys
import zlib
from pathlib import Path

import fitz  # PyMuPDF

HERE = Path(__file__).parent
ADMIN_PATH = HERE / "admin.pdf"
WH_PATH = HERE / "warehouse.pdf"


def axis1_binary_diff() -> str:
    """Byte-level cmp + hexdump near every difference."""
    a = ADMIN_PATH.read_bytes()
    w = WH_PATH.read_bytes()
    lines = [
        f"# Binary diff",
        f"admin.pdf       = {len(a):>5} bytes",
        f"warehouse.pdf   = {len(w):>5} bytes",
        f"size delta      = {len(a) - len(w):+d} bytes",
        "",
        "## All differing byte positions",
    ]
    diffs = []
    n = min(len(a), len(w))
    i = 0
    while i < n:
        if a[i] != w[i]:
            # Find end of this difference cluster
            j = i
            while j < n and a[j] != w[j]:
                j += 1
            diffs.append((i, j, a[i:j], w[i:j]))
            i = j
        i += 1
    # If one is longer, the trailing bytes are also a diff cluster
    if len(a) != len(w):
        m = min(len(a), len(w))
        diffs.append((m, max(len(a), len(w)), a[m:], w[m:]) if len(a) > len(w) else (m, len(w), b"", w[m:]))

    lines.append(f"Total diff clusters: {len(diffs)}")
    lines.append("")
    for idx, (start, end, av, wv) in enumerate(diffs, 1):
        lines.append(f"### Cluster #{idx} — bytes [{start}, {end})  size_admin={len(av)}  size_warehouse={len(wv)}")
        # Context: 32 bytes before, the diff, 32 bytes after
        ctx_start = max(0, start - 32)
        ctx_end_a = min(len(a), end + 32)
        ctx_end_w = min(len(w), end + 32)
        admin_ctx = a[ctx_start:ctx_end_a]
        wh_ctx = w[ctx_start:ctx_end_w]
        lines.append(f"  admin   raw: {admin_ctx[:80]!r}")
        lines.append(f"  warehouse raw: {wh_ctx[:80]!r}")
        lines.append(f"  admin   hex: {admin_ctx[:32].hex(' ')}")
        lines.append(f"  warehouse hex: {wh_ctx[:32].hex(' ')}")
        lines.append(f"  admin   diff slice: {av!r}")
        lines.append(f"  warehouse diff slice: {wv!r}")
        lines.append("")
    return "\n".join(lines)


def extract_streams(pdf_bytes: bytes) -> list[bytes]:
    """Find all FlateDecode-compressed streams and return decompressed bytes."""
    streams = []
    offset = 0
    while True:
        s = pdf_bytes.find(b"stream\n", offset)
        if s == -1:
            break
        e = pdf_bytes.find(b"\nendstream", s)
        if e == -1:
            break
        compressed = pdf_bytes[s + 7 : e]
        try:
            decompressed = zlib.decompress(compressed)
            streams.append(decompressed)
        except zlib.error:
            streams.append(compressed)  # not flate-compressed (e.g. font program)
        offset = e + 10
    return streams


def axis2_text_diff() -> str:
    """Text extract diff via PyMuPDF + decompressed stream char counting."""
    lines = ["# Text diff (PyMuPDF + raw stream decode)", ""]

    a_doc = fitz.open(str(ADMIN_PATH))
    w_doc = fitz.open(str(WH_PATH))
    a_text = "".join(p.get_text() for p in a_doc)
    w_text = "".join(p.get_text() for p in w_doc)
    a_doc.close()
    w_doc.close()

    lines.append("## PyMuPDF extracted text — ADMIN")
    lines.append("```")
    lines.append(a_text)
    lines.append("```")
    lines.append("")
    lines.append("## PyMuPDF extracted text — WAREHOUSE")
    lines.append("```")
    lines.append(w_text)
    lines.append("```")
    lines.append("")

    # Critical: are 单价 / 小计 / 合计 numeric values present in warehouse?
    # These specific Unicode codepoints in CID-encoded font map to mojibake, but the
    # actual numeric digits 0-9 are ASCII passthrough — visible cleanly.
    import re

    a_nums = re.findall(r"\b\d+(?:\.\d+)?\b", a_text)
    w_nums = re.findall(r"\b\d+(?:\.\d+)?\b", w_text)
    lines.append(f"## Numeric tokens")
    lines.append(f"admin   numbers ({len(a_nums)}): {a_nums}")
    lines.append(f"warehouse numbers ({len(w_nums)}): {w_nums}")
    lines.append("")

    # The key question: does warehouse contain the price values 30 and 3000 that admin has?
    # (PO-20260507-0005 has 1 item @ unitPrice=30, qty=100, lineAmount=3000, grandTotal=3000)
    PRICE_VALUES = ["30", "3000"]  # expected admin-only values
    lines.append("## Price-leak check")
    for pv in PRICE_VALUES:
        a_count = a_nums.count(pv)
        w_count = w_nums.count(pv)
        verdict = ""
        if a_count > 0 and w_count == 0:
            verdict = "✅ STRIPPED — admin has it, warehouse does NOT"
        elif a_count > 0 and w_count > 0:
            verdict = "🔴 LEAK — warehouse also has it"
        elif a_count == 0:
            verdict = "ℹ️  not in admin either (unexpected)"
        lines.append(f"  '{pv}': admin={a_count}× warehouse={w_count}×  → {verdict}")

    # Raw stream content count — char-by-char diff of decompressed streams
    lines.append("")
    lines.append("## Decompressed stream comparison")
    a_streams = extract_streams(ADMIN_PATH.read_bytes())
    w_streams = extract_streams(WH_PATH.read_bytes())
    lines.append(f"admin   streams: {len(a_streams)} (sizes: {[len(s) for s in a_streams]})")
    lines.append(f"warehouse streams: {len(w_streams)} (sizes: {[len(s) for s in w_streams]})")
    lines.append("")
    for i, (sa, sw) in enumerate(zip(a_streams, w_streams)):
        if sa == sw:
            lines.append(f"  stream #{i + 1}: IDENTICAL ({len(sa)}B)")
            continue
        # Compute Levenshtein-ish summary: first/last diff position
        first_diff = next((k for k in range(min(len(sa), len(sw))) if sa[k] != sw[k]), -1)
        last_diff_admin = next((k for k in range(min(len(sa), len(sw)) - 1, -1, -1) if sa[k] != sw[k]), -1)
        lines.append(f"  stream #{i + 1}: DIFFERS  admin={len(sa)}B warehouse={len(sw)}B  delta={len(sa) - len(sw):+d}B")
        lines.append(f"    first_diff_offset={first_diff}  last_diff_offset={last_diff_admin}")
        if first_diff >= 0:
            ctx_a = sa[max(0, first_diff - 40) : first_diff + 80]
            ctx_w = sw[max(0, first_diff - 40) : first_diff + 80]
            lines.append(f"    admin   @first_diff: {ctx_a[:120]!r}")
            lines.append(f"    warehouse @first_diff: {ctx_w[:120]!r}")

    return "\n".join(lines)


def axis3_structure_diff() -> dict:
    """Structural metadata + xref diff via PyMuPDF."""
    a_doc = fitz.open(str(ADMIN_PATH))
    w_doc = fitz.open(str(WH_PATH))
    result = {
        "admin": {
            "page_count": a_doc.page_count,
            "metadata": dict(a_doc.metadata or {}),
            "xref_count": a_doc.xref_length(),
            "is_encrypted": a_doc.is_encrypted,
            "pdf_version": getattr(a_doc, "pdf_version", lambda: None)() if callable(getattr(a_doc, "pdf_version", None)) else None,
        },
        "warehouse": {
            "page_count": w_doc.page_count,
            "metadata": dict(w_doc.metadata or {}),
            "xref_count": w_doc.xref_length(),
            "is_encrypted": w_doc.is_encrypted,
        },
    }
    # Get PDF /ID and /CreationDate from trailer
    for label, doc in (("admin", a_doc), ("warehouse", w_doc)):
        try:
            trailer = doc.pdf_trailer()
            result[label]["trailer"] = trailer
        except Exception as e:
            result[label]["trailer_error"] = str(e)

    a_doc.close()
    w_doc.close()
    return result


def main() -> None:
    if not ADMIN_PATH.exists() or not WH_PATH.exists():
        print(f"Missing PDFs: admin={ADMIN_PATH.exists()} warehouse={WH_PATH.exists()}")
        sys.exit(1)

    print(">> Axis 1: binary diff")
    (HERE / "diff-binary.txt").write_text(axis1_binary_diff(), encoding="utf-8")

    print(">> Axis 2: text diff")
    (HERE / "diff-text.txt").write_text(axis2_text_diff(), encoding="utf-8")

    print(">> Axis 3: structural diff")
    structure = axis3_structure_diff()
    (HERE / "diff-structure.json").write_text(json.dumps(structure, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

    print(f"\nWritten: diff-binary.txt, diff-text.txt, diff-structure.json")


if __name__ == "__main__":
    main()
