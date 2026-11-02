#!/usr/bin/env python3
"""Scene-relative caption offsets for Videowright segments."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_segment_data as bsd  # noqa: E402

DURATIONS = {
    "per_segment": {"a": [10.0, 22.5], "b": [8.0, 15.0]},
    "voiceovers": {"a": "one two", "b": "three four"},
}
CAPTIONS = {
    "cues": [
        {"id": "a-0", "scene_id": "a", "cues": [{"start": 0.0, "end": 2.0, "text": "x"}]},
        {"id": "a-1", "scene_id": "a", "cues": [{"start": 0.5, "end": 3.0, "text": "y"}]},
        {"id": "b-0", "scene_id": "b", "cues": [{"start": 1.0, "end": 2.0, "text": "z"}]},
    ]
}


class BuildSegmentDataTest(unittest.TestCase):
    def test_second_chunk_cues_are_offset_by_the_first_advance(self) -> None:
        _, cues_ts = bsd.build(DURATIONS, CAPTIONS)
        data = json.loads(cues_ts.split("=", 1)[1].rsplit(";", 1)[0])
        self.assertEqual(data["a"][0]["start"], 0.0)
        self.assertEqual(data["a"][1]["start"], 10.5)  # 0.5 into the chunk that starts at 10.0
        self.assertEqual(data["a"][1]["end"], 13.0)
        self.assertEqual(data["b"][0]["start"], 1.0)  # scenes restart at zero

    def test_timing_exports_advances_and_voiceover(self) -> None:
        timing, _ = bsd.build(DURATIONS, CAPTIONS)
        self.assertIn('"a": [', timing)
        self.assertIn("22.5", timing)
        self.assertIn('"one two"', timing)


if __name__ == "__main__":
    unittest.main()
