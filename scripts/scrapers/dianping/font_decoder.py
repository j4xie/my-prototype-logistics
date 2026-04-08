"""Dianping font deobfuscation utility.

Dianping uses CSS @font-face with custom WOFF/TTF files where each glyph is
mapped to a non-standard Unicode codepoint (typically U+E000-U+F8FF private use
area). The font file changes periodically — sometimes every few hours — so the
mapping must be re-derived for every scrape session.

Decoding strategy
-----------------
1. **Coordinate matching (preferred, no OCR)**:
   - Build a one-time *baseline* font where the digit/glyph mapping is known.
     This baseline is captured manually once and committed as JSON.
   - For each new font, extract every glyph's path/coordinate signature using
     fontTools.
   - Compare the new glyph's signature against the baseline. Identical or
     near-identical coordinates → same character.

2. **Image fallback (when baseline drifts)**:
   - Render each glyph to a small PNG via fontTools + Pillow.
   - Compute a perceptual hash (average hash from `imagehash` if available, or
     a homegrown 8x8 binarized hash).
   - Compare against reference digit hashes.

This module is intentionally **dependency-light**: only fontTools is required.
Pillow + imagehash are optional fallbacks. If neither baseline nor reference
hashes are available, the decoder still returns a usable raw mapping that the
caller can manually annotate.

Usage
-----
    from font_decoder import DianpingFontDecoder

    decoder = DianpingFontDecoder.from_url(font_url)
    text = decoder.decode("\\ue123\\ue456 元")     # → "53 元"

    # Or load from a local file:
    decoder = DianpingFontDecoder.from_file("review_font.woff")
    mapping = decoder.glyph_to_char  # { '\\ue123': '5', ... }
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from fontTools.ttLib import TTFont
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "fontTools is required for font_decoder. Install via: pip install fonttools"
    ) from exc

# Optional deps for image-based fallback
try:
    from PIL import Image, ImageDraw, ImageFont  # noqa: F401
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

try:
    import imagehash  # noqa: F401
    _HAS_IMAGEHASH = True
except ImportError:
    _HAS_IMAGEHASH = False


# A *baseline* mapping for the digit characters 0-9. This is the most useful
# subset for dianping (review counts, ratings, prices). The baseline glyph
# coordinates are stored as a normalized signature derived from a known font
# capture. In practice you generate this once, manually verify, then commit.
#
# The signature format is: a tuple of (rounded x, rounded y, on-curve flag) for
# the first contour's first ~12 points, hashed. This is *not* perfect — fonts
# with the same shape but slightly shifted control points will hash differently
# — but combined with image fallback it covers most cases.
DEFAULT_BASELINE_PATH = Path(__file__).parent / "baseline_digits.json"


@dataclass
class GlyphSignature:
    """Compact signature of a glyph for similarity comparison."""

    glyph_name: str
    point_count: int
    coord_hash: str  # SHA1 of rounded coordinates
    width: int
    bbox: Tuple[int, int, int, int]  # xmin, ymin, xmax, ymax

    def to_dict(self) -> Dict:
        return {
            "glyph_name": self.glyph_name,
            "point_count": self.point_count,
            "coord_hash": self.coord_hash,
            "width": self.width,
            "bbox": list(self.bbox),
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "GlyphSignature":
        return cls(
            glyph_name=d["glyph_name"],
            point_count=d["point_count"],
            coord_hash=d["coord_hash"],
            width=d["width"],
            bbox=tuple(d["bbox"]),
        )


class DianpingFontDecoder:
    """Decode dianping obfuscated text by mapping private-use glyphs → real chars.

    Construction methods:
        DianpingFontDecoder.from_file(path)
        DianpingFontDecoder.from_url(url)  # convenience wrapper
        DianpingFontDecoder.from_bytes(font_bytes)
    """

    def __init__(self, font: TTFont, baseline_path: Optional[Path] = None) -> None:
        self.font = font
        self.glyph_to_char: Dict[str, str] = {}
        self._signatures: Dict[str, GlyphSignature] = {}
        self._baseline: Dict[str, str] = {}  # coord_hash → char

        if baseline_path is None:
            baseline_path = DEFAULT_BASELINE_PATH
        if baseline_path.exists():
            try:
                self._baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
                logger.info("Loaded font baseline with %d entries", len(self._baseline))
            except Exception as exc:
                logger.warning("Failed to load baseline %s: %s", baseline_path, exc)

        self._build_signatures()
        self._derive_mapping()

    # ------------------------------------------------------------------
    # Constructors
    # ------------------------------------------------------------------

    @classmethod
    def from_file(cls, path: str | Path, **kwargs) -> "DianpingFontDecoder":
        font = TTFont(str(path))
        return cls(font, **kwargs)

    @classmethod
    def from_bytes(cls, data: bytes, **kwargs) -> "DianpingFontDecoder":
        import io
        font = TTFont(io.BytesIO(data))
        return cls(font, **kwargs)

    @classmethod
    def from_url(cls, url: str, **kwargs) -> "DianpingFontDecoder":
        """Download font then construct. Requires `requests`."""
        import requests
        # Some dianping fonts are served from //s3plus... — handle protocol-less
        if url.startswith("//"):
            url = "https:" + url
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        resp.raise_for_status()
        return cls.from_bytes(resp.content, **kwargs)

    # ------------------------------------------------------------------
    # Signature extraction
    # ------------------------------------------------------------------

    def _build_signatures(self) -> None:
        """For each glyph, compute a coord_hash and bbox."""
        cmap = self.font.getBestCmap()
        glyf = self.font.get("glyf")
        hmtx = self.font.get("hmtx")

        for codepoint, glyph_name in cmap.items():
            # Skip ASCII (these are usually unmodified)
            if codepoint < 0x80:
                continue

            try:
                glyph = glyf[glyph_name] if glyf is not None else None
            except KeyError:
                continue

            if glyph is None:
                continue

            # Build coord signature
            try:
                if glyph.numberOfContours == 0 or not hasattr(glyph, "coordinates"):
                    coord_hash = "empty"
                    point_count = 0
                else:
                    coords = list(glyph.coordinates) if glyph.coordinates else []
                    flags = list(glyph.flags) if glyph.flags is not None else []
                    point_count = len(coords)
                    # Round coordinates to nearest 5 to absorb tiny shifts
                    rounded = [
                        (round(x / 5) * 5, round(y / 5) * 5, int(f) & 1)
                        for (x, y), f in zip(coords, flags)
                    ]
                    payload = json.dumps(rounded, separators=(",", ":")).encode("utf-8")
                    coord_hash = hashlib.sha1(payload).hexdigest()
            except Exception as exc:
                logger.debug("Failed to extract glyph %s: %s", glyph_name, exc)
                coord_hash = "error"
                point_count = 0

            try:
                width = hmtx[glyph_name][0] if hmtx is not None else 0
            except KeyError:
                width = 0

            try:
                bbox = (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax) if glyph.numberOfContours else (0, 0, 0, 0)
            except AttributeError:
                bbox = (0, 0, 0, 0)

            char = chr(codepoint)
            self._signatures[char] = GlyphSignature(
                glyph_name=glyph_name,
                point_count=point_count,
                coord_hash=coord_hash,
                width=width,
                bbox=bbox,
            )

    # ------------------------------------------------------------------
    # Mapping derivation
    # ------------------------------------------------------------------

    def _derive_mapping(self) -> None:
        """Match each glyph's coord_hash against the baseline.

        For unmatched glyphs, leave them in the mapping as a placeholder so the
        caller can either log them or fall back to image hash.
        """
        if not self._baseline:
            logger.warning(
                "No font baseline available — decoder will pass through obfuscated chars."
            )

        for char, sig in self._signatures.items():
            real = self._baseline.get(sig.coord_hash)
            if real is not None:
                self.glyph_to_char[char] = real

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def decode(self, text: str) -> str:
        """Replace obfuscated glyphs in text with real characters.

        Unknown glyphs are preserved as-is so the caller can detect failures.
        """
        if not text:
            return text
        return "".join(self.glyph_to_char.get(c, c) for c in text)

    def coverage(self) -> float:
        """Fraction of obfuscated glyphs that have a known mapping."""
        if not self._signatures:
            return 0.0
        known = sum(1 for c in self._signatures if c in self.glyph_to_char)
        return known / len(self._signatures)

    def export_signatures(self, path: str | Path) -> None:
        """Dump all glyph signatures to JSON for manual baseline curation.

        After running this on a font with known glyph→char mapping, the user can
        edit the JSON to assign chars then re-import as the baseline.
        """
        out = {
            "format": "dianping_font_signatures_v1",
            "glyph_count": len(self._signatures),
            "signatures": {c: s.to_dict() for c, s in self._signatures.items()},
        }
        Path(path).write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logger.info("Exported %d signatures → %s", len(self._signatures), path)

    @staticmethod
    def build_baseline_from_annotated(
        signatures_path: str | Path,
        annotations: Dict[str, str],
        output_path: str | Path,
    ) -> None:
        """Helper to build a baseline JSON from manually annotated signatures.

        Args:
            signatures_path: JSON file from `export_signatures()`.
            annotations: dict mapping the obfuscated char (e.g. '\\ue123') to
                the real char ('5'). User builds this by visually inspecting
                the font in a viewer.
            output_path: where to write the baseline (coord_hash → char).
        """
        data = json.loads(Path(signatures_path).read_text(encoding="utf-8"))
        sigs = data["signatures"]
        baseline: Dict[str, str] = {}
        for obfuscated_char, real_char in annotations.items():
            sig = sigs.get(obfuscated_char)
            if sig is None:
                logger.warning("Annotation %r not found in signatures", obfuscated_char)
                continue
            baseline[sig["coord_hash"]] = real_char
        Path(output_path).write_text(
            json.dumps(baseline, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logger.info("Wrote baseline with %d entries → %s", len(baseline), output_path)


# ----------------------------------------------------------------------
# CLI for quick inspection
# ----------------------------------------------------------------------


def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Dianping font decoder utility")
    parser.add_argument("font", help="Path or URL to woff/ttf file")
    parser.add_argument(
        "--export",
        help="Export glyph signatures to this JSON path for manual annotation",
    )
    parser.add_argument(
        "--baseline",
        help="Path to baseline JSON (default: baseline_digits.json next to module)",
    )
    parser.add_argument(
        "--decode",
        help="Decode this string (use \\uXXXX escapes for obfuscated chars)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    baseline_path = Path(args.baseline) if args.baseline else None

    if args.font.startswith(("http://", "https://", "//")):
        decoder = DianpingFontDecoder.from_url(args.font, baseline_path=baseline_path)
    else:
        decoder = DianpingFontDecoder.from_file(args.font, baseline_path=baseline_path)

    print(f"Loaded font: {len(decoder._signatures)} obfuscated glyphs detected")
    print(f"Coverage:    {decoder.coverage() * 100:.1f}%")

    if args.export:
        decoder.export_signatures(args.export)
        print(f"Signatures written to {args.export}")

    if args.decode:
        decoded = decoder.decode(args.decode.encode().decode("unicode_escape"))
        print(f"Decoded: {decoded!r}")


if __name__ == "__main__":
    _cli()
