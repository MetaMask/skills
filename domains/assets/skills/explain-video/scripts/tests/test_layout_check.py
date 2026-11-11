#!/usr/bin/env python3
"""The renderer's layout check must catch overlap, overflow and low contrast, and pass clean kit scenes."""

from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
VW = SKILL / "render" / "vw.ts"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "layout"
ME_CSS = FIXTURE / "me" / "style.css"
ME_URL = "https://raw.githubusercontent.com/Prithpal-Sooriya/tiny-video-renderer/v0.2.3/example/styles/motion-engineering/style.css"
ME_SHA = "c2f5f7e9daf7d11718f954c2f1afbe891e0204a12421ec6d2ee7565fff26d17b"


def check(timeline: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(VW), "render", timeline, "--check"], cwd=FIXTURE, capture_output=True, text=True, timeout=180
    )


def chrome_available() -> bool:
    probe = check("clean-metamask.timeline.ts")
    return "layout check" in probe.stdout + probe.stderr


@unittest.skipUnless(shutil.which("node"), "node not installed")
class LayoutCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not chrome_available():
            raise unittest.SkipTest("Chrome not available")

    def test_bad_fixture_fails_with_every_defect(self) -> None:
        r = check("bad.timeline.ts")
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        expected = [
            r"bad-overlap beat 1/2: outside safe area: h1\[data-title\] .* top 96 < 152",
            r"bad-overlap beat 1/2: covers chrome: h1\[data-title\] .* overlaps div\.vw-lockup",
            r"bad-overlap beat 1/2: overlap: div\.vw-card \"Before.* × div\.vw-card \"After.* by 140x220px",
            r"bad-bounds beat 1/1: off canvas: div\.vw-pill \"packages/assets-controllers",
            r"bad-bounds beat 1/1: off canvas: img\[data-img\]",
            r"bad-bounds beat 1/1: clipped text: div\.vw-card \"Clipped",
            r"bad-contrast beat 1/1: low contrast: div\.vw-title \"What changed\" 1\.00:1 < 3:1 \(#000000 on #000000",
            r"bad-contrast beat 1/1: low contrast: div\.vw-card-title \"Network badge\" 1\.07:1",
            r"bad-contrast beat 1/1: low contrast: div\.vw-body \"Now fully visible\.\" 3\.13:1 < 4\.5:1",
            r"bad-contrast beat 1/1: low contrast: span\.vw-pill \"ASSETS-4283\" 3\.46:1 < 4\.5:1",
        ]
        for pattern in expected:
            self.assertRegex(out, pattern)
        self.assertNotRegex(out, r": (?:\w+ )+div\.vw-captions|: (?:\w+ )+div\.vw-lockup|svg\[data-(fox|wordmark)")
        self.assertRegex(out, r"Layout check failed with \d+ errors")

    def test_clean_fixtures_pass(self) -> None:
        for theme in ["metamask", "metamask-developer"]:
            with self.subTest(theme=theme):
                r = check(f"clean-{theme}.timeline.ts")
                self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
                self.assertIn("layout check: OK (4 beats in 3 segments)", r.stdout)

    def test_clean_fixture_passes_motion_engineering(self) -> None:
        if not ME_CSS.exists():
            ME_CSS.parent.mkdir(parents=True, exist_ok=True)
            got = subprocess.run(["curl", "-fsSL", ME_URL, "-o", str(ME_CSS)], capture_output=True)
            if got.returncode != 0:
                self.skipTest("motion-engineering style.css not downloadable")
        digest = subprocess.run(["shasum", "-a", "256", str(ME_CSS)], capture_output=True, text=True).stdout.split()[0]
        self.assertEqual(digest, ME_SHA)
        r = check("clean-motion-engineering.timeline.ts")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("layout check: OK", r.stdout)


if __name__ == "__main__":
    unittest.main()
