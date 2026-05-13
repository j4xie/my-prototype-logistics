# P0-C PDF byte-diff deep dive — verdict

**Date**: 2026-05-13
**Branch**: `qa/p0c-pdf-bytediff-deepdive` (worktree `C:/Users/Steve/cretas-p0c-pdf-deepdive`)
**Trigger**: My own R1 chat3 (PR #511) claim "P0-C re-confirmed open via 2-byte PDF delta" needed verification. The 2-byte argument was a proxy/lazy verification; this dive decodes the actual PDF content.
**Env**: test 8097
**Tools**: PyMuPDF 1.27.1 (fitz), Python zlib, custom 3-axis analyzer

---

## TL;DR — **VERDICT B (no leak, fix working as designed)**

PR #450 (`fix(rbac): P0-C PDF byte[] price-strip`, merged 2026-05-12T16:29:12Z) **functions correctly**. The 2-byte size delta between admin.pdf (3611 B) and warehouse.pdf (3609 B) is **NOT** a price leak — it's the post-FlateDecode compression artifact of substituting `30 / 3000 / 3000` numeric values with `— / — / —` em-dash placeholders.

**My R1 PR #511's claim "P0-C still leaks" was a false positive caused by incorrect proxy reasoning** (byte-similarity ≠ content-similarity). A separate retraction comment will be filed on PR #511.

---

## Axis 1 — text extraction (PyMuPDF)

Both PDFs decoded via `fitz.open(...).get_text()` — bypasses CID font encoding, returns Unicode text.

### ADMIN PDF table section
```
序号  原料名称  数量  单位  箱数  单价  小计
1     墨鱼      100   kg    -    30    3000
合计 3000
```

### WAREHOUSE PDF table section
```
序号  原料名称  数量  单位  箱数  单价  小计
1     墨鱼      100   kg    -    —     —
合计 —
```

### Numeric-token diff

| Value | Admin | Warehouse | Verdict |
|---|---|---|---|
| `30` (unit price) | 1× | **0×** | ✅ STRIPPED |
| `3000` (line subtotal + grand total) | 2× | **0×** | ✅ STRIPPED |

If P0-C were still open, warehouse PDF would contain `30` and `3000` — it does not.

---

## Axis 2 — decompressed FlateDecode stream diff

Each PDF has **3 FlateDecode streams** (font metric + page content + xobject):

| Stream | Admin size | Warehouse size | Status |
|---|---|---|---|
| #1 | 119 B | 119 B | IDENTICAL |
| #2 (page content) | **4947 B** | **4927 B** | **+20 B (admin larger)** |
| #3 | 1103 B | 1103 B | IDENTICAL |

**Stream #2 first divergence at offset 4263:**

```
ADMIN:     ...(\x00-)Tj\nET\nBT\n... /F2 10 Tf\n(\x003\x000)Tj  ← renders "30"
WAREHOUSE: ...(\x00-)Tj\nET\nBT\n... /F2 10 Tf\n( \x14)Tj       ← renders CID em-dash
```

The `\x003\x00` byte pairs in admin are CID-encoded digits "3" and "0" in STSong-Light + UniGB-UCS2-H font. `\x00\x14` is the CID codepoint for em-dash (`—`).

**This is a deterministic content-substitution.** PR #450's `maskPrice ? PRICE_MASK_PLACEHOLDER : formatDecimal(...)` (PurchaseOrderPdfServiceImpl.java:200-217) is the source of this divergence.

---

## Axis 3 — structural / metadata diff

PyMuPDF metadata + trailer:

| Field | Admin | Warehouse |
|---|---|---|
| /Producer | `iText® 5.5.13.3 ©2000-2022 iText Group NV (AGPL-version)` | same |
| /CreationDate | `D:20260513124848+08'00'` | `D:20260513124909+08'00'` (21 s later) |
| /ModDate | `D:20260513124848+08'00'` | `D:20260513124909+08'00'` |
| /ID | `<68A7CE4430C6C7E700FA648326F86702>` | `<B87383CE11D9484088470A37259FFF9A>` |
| /Size | 12 | 12 |
| pages | 1 | 1 |

**Metadata contribution to byte delta**:
- /CreationDate + /ModDate strings have **identical byte length** (only digits change) → 0 byte delta there
- /ID UUIDs have identical byte length → 0 byte delta there
- → **the metadata is responsible for 0 of the 2-byte delta**; the entire delta is from the content-strip in stream #2

---

## Axis 4 — binary diff summary

`cmp -l`-equivalent (Python loop) found **125 differing byte clusters** across the two files. This sounds alarming but is misleading: 124 of the 125 clusters are inside FlateDecode-compressed stream #2's compressed-byte sequence. zlib output is highly entropy-sensitive — small content changes (20 B pre-compression) propagate across hundreds of compressed bytes.

| Cluster | Bytes | Meaning |
|---|---|---|
| #1 (offset 366) | 1 byte | `/Length 1222` (admin) vs `/Length 1220` (warehouse) — declared compressed-stream length |
| #2-#124 | various | Compressed-stream contents of stream #2 (different because content changed) |
| #125 | trailing | `endstream` epilogue position shifted by 2 bytes |

**Net delta = 2 bytes** (admin compressed-stream 1222 → warehouse 1220), which matches the PDF size difference of 2 bytes (3611 − 3609 = 2). All 125 clusters reconcile to a single 2-byte semantic event.

---

## Verdict mapping per MO

| MO verdict | Definition | Match? |
|---|---|---|
| **A (real leak)** | PDF text contains unitPrice / totalCost / cost | ❌ NO — warehouse text has 0× `30`, 0× `3000` |
| **B (metadata noise)** | Difference is /CreationDate / /ID / random UUID | ⚠️ PARTIAL — metadata DOES differ (21 s timestamp + new /ID) but contributes 0 bytes to size delta |
| **C (other leak)** | Font watermark / image diff / etc. | ❌ NO |

**Closest fit: B-modified — "No leak; PR #450 fix correctly substitutes prices with em-dashes. The 2-byte delta is the intended content-strip compression artifact, plus incidental /CreationDate + /ID metadata delta with zero byte-size impact."**

---

## Required actions

### 1. Retraction on PR #511 (chat3 R1 part 3)

PR #511 body claimed: > "P0-C RBAC bypass STILL OPEN — admin PDF 3611 B vs warehouse PDF 3609 B → only 2 B delta (FlateDecode stream length declaration only). Same content layout → warehouse_mgr1 receives full price-containing PDF"

**This is wrong.** Same-byte-size ≠ same-content. Compression efficiency hides the price-strip behavior at the byte level; text extraction reveals it clearly. PR #511 needs an explicit correction comment.

**Recommended PR #511 follow-up**: append an "Errata" comment with this verdict file + apology for the false-positive claim.

### 2. No code change needed

PR #450 (`c290c8d8d`) and PR #456 (`94a9bbec8` sister sweep) are working as designed. No hotfix required.

### 3. Optional improvement (not a bug)

For future byte-stable QA evidence, the PDF generator could:
- Set deterministic `/CreationDate` (e.g., based on order's `createdAt`, not `System.currentTimeMillis()`)
- Set deterministic `/ID` (e.g., hash of order content, not random)

This would make admin.pdf and warehouse.pdf byte-stable for repeat fetches. **Not a bug**; just convenience for QA scripts that want to assert content via byte hash. Out of scope for this round.

### 4. QA process lesson (for memory)

**Byte-similarity ≠ content-similarity.** For compressed binary formats (PDF, ZIP, etc.), always extract content via the format's tooling (PyMuPDF for PDF, `unzip -l` for ZIP) before claiming "same content". The 2-byte proxy I used in PR #511 was lazy reasoning that produced a false-positive bug claim.

---

## Evidence files

```
tests/qa-p0c-deepdive/
├── verdict.md                   # this doc
├── admin.pdf                    # 3611 B, factory_admin1 for F001 PO-20260507-0005
├── warehouse.pdf                # 3609 B, warehouse_mgr1 for same order
├── run-pdf-fetch.mjs            # reproducer (Playwright)
├── analyze.py                   # 3-axis diff analyzer (PyMuPDF + zlib)
├── fetch-evidence.json          # admin login result + order list + PDF metadata
├── diff-binary.txt              # 125 byte clusters with full hex context
├── diff-text.txt                # PyMuPDF text extract + numeric token check
└── diff-structure.json          # PDF metadata + trailer (/CreationDate / /ID)
```

---

## Iteration log

1. **Phase 1 root cause**: `git log` revealed PR #450 + #456 already merged 2026-05-12T16:29Z + 18:36Z — BEFORE my R1 run today. Confirmed via code-side reading of `PurchaseController.downloadOrderPdf` (line 134-135 derives `maskPrice` from role; line 137 passes to PDF service) and `PurchaseOrderPdfServiceImpl` (line 200-217 conditional cell rendering).
2. **Phase 1 tool survey**: pdftotext ✓ (Poppler) — but lacks Adobe-GB1 CMap, fails on STSong-Light. PyMuPDF 1.27.1 ✓ — handles CID-encoded Chinese fonts cleanly.
3. **Phase 2 reproduce**: F006 (MO-specified) has 0 procurement orders on test env. Fell back to F001 `factory_admin1` + `warehouse_mgr1` with PO-20260507-0005 (totalAmount=3000, has prices to leak).
4. **Phase 3 analysis**: 3-axis diff complete. Text extraction confirms strip.
5. **Phase 4 verdict**: B-modified — no leak.
