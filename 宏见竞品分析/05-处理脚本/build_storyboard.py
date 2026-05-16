"""Build a storyboard pairing scene-change frames with audio context.

Reads:
- frames_scene/s_NNNN.jpg (sorted by index = chronological order)
- scene_timestamps.txt (one timestamp per line, parallel to frame index)
- audio.json (whisper transcript with segments)

Outputs:
- storyboard.md  — chronological list: [HH:MM:SS] frame_file | nearest audio caption
- storyboard.json — same data as structured JSON
- keyframes/      — deduplicated frames (min gap 5s) copied with HHMMSS names
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path


def fmt(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def main() -> None:
    base = Path(__file__).parent
    timestamps = [
        float(x.strip())
        for x in (base / "scene_timestamps.txt").read_text(encoding="utf-8-sig").splitlines()
        if x.strip()
    ]
    frames_dir = base / "frames_scene"
    frames = sorted(frames_dir.glob("s_*.jpg"))
    assert len(timestamps) == len(frames), f"mismatch: {len(timestamps)} ts vs {len(frames)} frames"

    audio = json.loads((base / "audio.json").read_text(encoding="utf-8"))
    segs = audio["segments"]

    def caption_at(t: float, window: float = 6.0) -> str:
        """Find audio segments overlapping [t - window/2, t + window/2]."""
        lo, hi = t - window / 2, t + window / 2
        hits = [s for s in segs if not (s["end"] < lo or s["start"] > hi)]
        if not hits:
            nearest = min(segs, key=lambda s: abs((s["start"] + s["end"]) / 2 - t))
            return f"(near {fmt(nearest['start'])}) {nearest['text'].strip()}"
        return " | ".join(h["text"].strip() for h in hits)

    keyframes_dir = base / "keyframes"
    keyframes_dir.mkdir(exist_ok=True)
    for f in keyframes_dir.glob("*"):
        f.unlink()

    MIN_GAP = 5.0
    storyboard = []
    last_t = -999.0
    for ts, frame_path in zip(timestamps, frames):
        if ts - last_t < MIN_GAP:
            continue
        last_t = ts
        new_name = f"{fmt(ts).replace(':','')}_{frame_path.name}"
        dst = keyframes_dir / new_name
        shutil.copy(frame_path, dst)
        storyboard.append({
            "timestamp": ts,
            "time_hms": fmt(ts),
            "frame_file": str(dst.relative_to(base)),
            "audio_caption": caption_at(ts),
        })

    (base / "storyboard.json").write_text(
        json.dumps(storyboard, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    md_lines = [
        "# Fairview Square Demo — Storyboard\n",
        f"**Total keyframes**: {len(storyboard)} (deduplicated, min gap {MIN_GAP}s)\n",
        f"**Total raw scene-change frames**: {len(frames)}\n",
        f"**Audio duration**: {audio['duration']:.1f}s ({fmt(audio['duration'])})\n",
        "\n---\n",
    ]
    for item in storyboard:
        md_lines.append(
            f"### {item['time_hms']} — `{item['frame_file']}`\n\n"
            f"> {item['audio_caption']}\n"
        )
    (base / "storyboard.md").write_text("\n".join(md_lines), encoding="utf-8")

    print(f"[done] {len(storyboard)} keyframes -> keyframes/")
    print(f"[done] storyboard.md + storyboard.json")


if __name__ == "__main__":
    main()
