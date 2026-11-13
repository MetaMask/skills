#!/usr/bin/env python3
"""One-time listen check. Not part of every video.

Renders a few terms through synth.py, each with two spoken forms, into one folder.
Uses --raw so the normalizer does not collapse the variants before you hear them.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from speak_prep import write_json

# (display, spoken variants)
TERMS = [
    ("onAfterChange", ["on after change", "on-after-change"]),
    ("HTTPServer", ["H T T P server", "HTTP server"]),
    ("getUserInfo", ["get user info", "get-user-info"]),
    ("snake_case_name", ["snake case name", "snake_case_name"]),
    ("API", ["A P I", "A. P. I."]),
    (".ts", ["dot T S", "dot TS"]),
    ("==", ["equals equals", "equal equal"]),
]


def build_scenes() -> dict:
    scenes = []
    for term, variants in TERMS:
        slug = re_slug(term)
        scenes.append(
            {
                "id": slug,
                "lines": [
                    {"display": term, "spoken": spoken, "variant": index}
                    for index, spoken in enumerate(variants, start=1)
                ],
            }
        )
    return {"voice": "af_heart", "speed": 1.0, "scenes": scenes}


def re_slug(term: str) -> str:
    keep = "".join(char.lower() if char.isalnum() else "-" for char in term).strip("-")
    return keep or "term"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render pronunciation variants once")
    parser.add_argument("--out", type=Path, default=Path("audition"))
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    scenes_path = args.out / "scenes.json"
    write_json(scenes_path, build_scenes())
    from synth import run

    durations = run(scenes_path, args.out, raw=True)
    print(json.dumps({"out": str(args.out), "length_s": durations["length_s"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
