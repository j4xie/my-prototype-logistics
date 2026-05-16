"""HD version: use uncompressed video frames (1180x2556 source, scaled to 1600px width)."""

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
        for x in (base / "scene_hd_timestamps.txt").read_text(encoding="utf-8-sig").splitlines()
        if x.strip()
    ]
    frames = sorted((base / "frames_hd_scene").glob("s_*.jpg"))
    assert len(timestamps) == len(frames), f"{len(timestamps)} vs {len(frames)}"

    audio = json.loads((base / "audio.json").read_text(encoding="utf-8"))
    segs = audio["segments"]

    def caption_at(t: float, window: float = 8.0) -> str:
        lo, hi = t - window / 2, t + window / 2
        hits = [s for s in segs if not (s["end"] < lo or s["start"] > hi)]
        if not hits:
            nearest = min(segs, key=lambda s: abs((s["start"] + s["end"]) / 2 - t))
            return f"(无近邻语音 - 临近 {fmt(nearest['start'])} 段：{nearest['text'].strip()[:80]})"
        return " | ".join(h["text"].strip() for h in hits)

    out_dir = base / "keyframes_hd"
    out_dir.mkdir(exist_ok=True)
    for f in out_dir.glob("*"):
        f.unlink()

    MIN_GAP = 3.0
    storyboard = []
    last_t = -999.0
    for ts, frame_path in zip(timestamps, frames):
        if ts - last_t < MIN_GAP:
            continue
        last_t = ts
        new_name = f"{fmt(ts).replace(':','')}_{frame_path.name}"
        shutil.copy(frame_path, out_dir / new_name)
        storyboard.append({
            "ts": ts,
            "time": fmt(ts),
            "frame": f"keyframes_hd/{new_name}",
            "caption": caption_at(ts),
            "source": "scene",
        })

    # Gap-fill from dense for gaps >= 25s
    dense_frames = sorted((base / "frames_hd_dense").glob("d_*.jpg"))
    DENSE_INTERVAL = 3.0
    augmented = list(storyboard)
    for i, item in enumerate(storyboard):
        next_t = storyboard[i + 1]["ts"] if i + 1 < len(storyboard) else audio["duration"]
        gap = next_t - item["ts"]
        if gap >= 25:
            mid_count = int(gap // 15)
            for k in range(1, mid_count + 1):
                target = item["ts"] + k * (gap / (mid_count + 1))
                idx = int(round(target / DENSE_INTERVAL))
                if 0 <= idx < len(dense_frames):
                    src = dense_frames[idx]
                    new_name = f"{fmt(target).replace(':','')}_dense_{src.name}"
                    dst = out_dir / new_name
                    if not dst.exists():
                        shutil.copy(src, dst)
                    augmented.append({
                        "ts": target,
                        "time": fmt(target),
                        "frame": f"keyframes_hd/{new_name}",
                        "caption": caption_at(target),
                        "source": "dense (gap-fill)",
                    })

    augmented.sort(key=lambda x: x["ts"])

    (base / "storyboard_hd.json").write_text(
        json.dumps(augmented, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    md = [
        f"# Storyboard HD ({len(augmented)} 帧, 1600px width, source 1180x2556 60fps)\n",
        f"原始场景帧: {len(frames)}, 去重后: {len(storyboard)}, 加 gap-fill: {len(augmented)}\n\n---\n",
    ]
    for it in augmented:
        tag = " 🌫️" if it["source"] == "dense (gap-fill)" else ""
        md.append(f"### {it['time']}{tag} — `{it['frame']}`\n\n> {it['caption']}\n")
    (base / "storyboard_hd.md").write_text("\n".join(md), encoding="utf-8")

    print(f"[done] scene={len(storyboard)}  augmented={len(augmented)}")


if __name__ == "__main__":
    main()
