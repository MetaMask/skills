#!/usr/bin/env python3
"""Write timing.ts and captions.ts for Videowright segments from the audio pipeline.

Inputs (in the explainer folder): durations.json from synth.py and captions.json from
verify_audio.py. Outputs:

- timing.ts: `advances` (cumulative seconds per scene) and `voiceover` text per scene,
  to pass to defineSegment.
- captions.ts: `cues` per scene, with times relative to the start of the scene.

Each scene is a run of chunks. A cue inside chunk N starts `advances[N-1]` seconds
after its scene starts, because a chunk's audio begins where the previous one ended.
Stdlib only.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def build(durations: dict, captions: dict) -> tuple[str, str]:
    advances = durations["per_segment"]
    voiceover = durations["voiceovers"]
    timing = (
        "export const advances: Record<string, number[]> = "
        + json.dumps(advances, indent=1)
        + ";\n\nexport const voiceover: Record<string, string> = "
        + json.dumps(voiceover, indent=1, ensure_ascii=False)
        + ";\n"
    )
    by_scene: dict[str, list[dict]] = {}
    for chunk in captions["cues"]:
        scene_id = chunk["scene_id"]
        index = int(chunk["id"].rsplit("-", 1)[1])
        offset = 0.0 if index == 0 else advances[scene_id][index - 1]
        for cue in chunk["cues"]:
            by_scene.setdefault(scene_id, []).append(
                {
                    "start": round(cue["start"] + offset, 3),
                    "end": round(cue["end"] + offset, 3),
                    "text": cue["text"],
                }
            )
    cues = (
        'import type { Cue } from "./segments/shared";\n\n'
        "export const cues: Record<string, Cue[]> = "
        + json.dumps(by_scene, indent=1, ensure_ascii=False)
        + ";\n"
    )
    return timing, cues


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("explainer", type=Path, nargs="?", default=Path("."), help="explainer folder (default: cwd)")
    args = ap.parse_args()
    root = args.explainer
    durations = json.loads((root / "durations.json").read_text())
    captions = json.loads((root / "captions.json").read_text())
    timing, cues = build(durations, captions)
    (root / "timing.ts").write_text(timing)
    (root / "captions.ts").write_text(cues)
    print({scene: len(durations["per_segment"][scene]) for scene in durations["per_segment"]}, "beats per scene")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
