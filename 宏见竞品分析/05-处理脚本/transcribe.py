"""Transcribe audio/video using faster-whisper with CUDA.

Usage:
    python transcribe.py <input_file> <output_prefix>

Outputs:
    <output_prefix>.json   — segments with timestamps + text
    <output_prefix>.srt    — SubRip subtitles
    <output_prefix>.txt    — plain text (segments joined)
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from faster_whisper import WhisperModel


def fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])
    out_prefix = Path(sys.argv[2])
    out_prefix.parent.mkdir(parents=True, exist_ok=True)

    print(f"[load] model=large-v3 device=cuda compute=int8_float16")
    t0 = time.time()
    model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    print(f"[load] done in {time.time() - t0:.1f}s")

    print(f"[transcribe] {src}")
    t0 = time.time()
    segments, info = model.transcribe(
        str(src),
        language="zh",
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        initial_prompt="以下是普通话的演示介绍。",
    )
    print(f"[transcribe] duration={info.duration:.1f}s lang={info.language} prob={info.language_probability:.3f}")

    out = {
        "source": str(src),
        "duration": info.duration,
        "language": info.language,
        "language_probability": info.language_probability,
        "segments": [],
    }
    srt_lines: list[str] = []
    txt_lines: list[str] = []

    for i, seg in enumerate(segments, 1):
        text = seg.text.strip()
        out["segments"].append(
            {"id": i, "start": seg.start, "end": seg.end, "text": text}
        )
        srt_lines.append(f"{i}\n{fmt_ts(seg.start)} --> {fmt_ts(seg.end)}\n{text}\n")
        txt_lines.append(f"[{fmt_ts(seg.start)}] {text}")
        if i % 20 == 0:
            print(f"[progress] segment {i}, t={seg.end:.1f}s ({seg.end / info.duration * 100:.1f}%)")

    elapsed = time.time() - t0
    rtf = info.duration / elapsed
    print(f"[transcribe] done in {elapsed:.1f}s, RTF={rtf:.1f}x, segments={len(out['segments'])}")

    (out_prefix.parent / (out_prefix.name + ".json")).write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out_prefix.parent / (out_prefix.name + ".srt")).write_text(
        "\n".join(srt_lines), encoding="utf-8"
    )
    (out_prefix.parent / (out_prefix.name + ".txt")).write_text(
        "\n".join(txt_lines), encoding="utf-8"
    )
    print(f"[write] {out_prefix}.json / .srt / .txt")


if __name__ == "__main__":
    main()
