#!/usr/bin/env python3
"""kit/tailwind.css must stay in sync with the snapshot, keep to the dark design-system vocabulary, and the check must lint unknown classes."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SKILL / "scripts"))

import sync_design_tokens as sdt  # noqa: E402
import tailwind  # noqa: E402

SNAP = json.loads(sdt.SNAPSHOT.read_text())
CSS = sdt.TAILWIND.read_text()
NAMES = tailwind.class_names(SNAP)
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "layout"
VW = SKILL / "scripts" / "render" / "vw.ts"


def check(timeline: str) -> subprocess.CompletedProcess:
    return subprocess.run(["node", str(VW), "render", timeline, "--check"], cwd=FIXTURE, capture_output=True, text=True, timeout=180)


class Stylesheet(unittest.TestCase):
    def test_file_matches_generator(self) -> None:
        self.assertEqual(CSS, tailwind.generate(SNAP), "run: python3 scripts/sync_design_tokens.py build")

    def test_class_names_are_unique_and_counted(self) -> None:
        self.assertEqual(len(NAMES), len(set(NAMES)))
        self.assertIn(f"{len(NAMES)} classes", CSS)
        self.assertEqual(len(re.findall(r"^\.", CSS, re.M)), len(NAMES))

    def test_required_vocabulary(self) -> None:
        required = ["text-heading-lg", "text-display-md", "text-body-xs-medium", "text-default", "text-alternative", "text-primary-default",
                    "text-error-default", "text-success-default", "text-warning-default", "text-accent01-normal", "bg-default", "bg-section",
                    "bg-subsection", "bg-muted", "bg-primary-muted", "border-muted", "border-default", "border-success-default",
                    "flex", "flex-col", "grid", "grid-cols-3", "col-span-2", "gap-8", "gap-x-4", "p-8", "px-4", "py-1", "m-0", "mt-auto",
                    "w-full", "w-1/2", "h-full", "size-12", "min-h-0", "rounded-md", "rounded-full", "items-center", "justify-between",
                    "self-start", "overflow-hidden", "font-mono", "font-bold", "whitespace-pre"]
        for name in required:
            self.assertIn(name, NAMES)

    def test_type_roles_are_video_scaled(self) -> None:
        for role, t in SNAP["type"].items():
            size = tailwind.num(t["font-size"] * SNAP["scale"])
            self.assertIn(f".text-{role} {{ font-size: {size}px;", CSS)
        self.assertIn(".text-body-md { font-size: 28px;", CSS)

    def test_dark_only_no_arbitrary_no_generic_palette(self) -> None:
        self.assertNotRegex(CSS, r"\.light|\[data-theme|prefers-color-scheme|@media|:hover|:focus|\\:")
        for name in NAMES:
            self.assertNotIn("[", name)
            self.assertNotRegex(name, r"^(text|bg|border|fill|stroke)-(white|black|(gray|grey|slate|zinc|neutral|stone|red|green|blue|orange|yellow|purple)-\d+)$")
            self.assertNotRegex(name, r"^text-(xs|sm|base|lg|\dxl|xl)$")
        for hexv in re.findall(r"#[0-9a-f]{6,8}\b", CSS):
            self.assertIn(hexv, set(SNAP["dark"].values()))

    def test_text_colours_are_readable(self) -> None:
        self.assertNotIn("text-muted", NAMES)
        self.assertNotIn("text-error-muted", NAMES)
        for name in NAMES:
            m = re.fullmatch(r"text-(.+)", name)
            if not m or m.group(1) not in SNAP["dark"] and f"text-{m.group(1)}" not in SNAP["dark"]:
                continue
            token = m.group(1) if m.group(1) in SNAP["dark"] else f"text-{m.group(1)}"
            if token.endswith("-inverse"):
                continue
            for bg in tailwind.SURFACES:
                self.assertGreaterEqual(tailwind.contrast(SNAP["dark"][token], SNAP["dark"][bg]), 4.5, f"{name} on {bg}")

    def test_inverse_text_reads_on_its_fill(self) -> None:
        for family in ["primary", "error", "warning", "success", "info"]:
            self.assertGreaterEqual(tailwind.contrast(SNAP["dark"][f"{family}-inverse"], SNAP["dark"][f"{family}-default"]), 4.5, family)

    def test_no_kit_class_clashes(self) -> None:
        kit = set(re.findall(r"\.(vw-[\w-]+)", (SKILL / "assets" / "kit" / "kit.css").read_text()))
        self.assertFalse(kit & set(NAMES))

    def test_opt_in_marker(self) -> None:
        self.assertIn(f"{tailwind.MARKER}: 1;", CSS)
        for theme in sdt.THEMES:
            self.assertNotIn(tailwind.MARKER, theme.read_text())

    def test_build_check_catches_drift(self) -> None:
        original = CSS
        try:
            sdt.TAILWIND.write_text(original.replace(".gap-8 {", ".gap-9000 {"))
            r = subprocess.run([sys.executable, str(SKILL / "scripts" / "sync_design_tokens.py"), "build", "--check"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 1)
            self.assertIn("drift: assets/kit/tailwind.css", r.stdout)
        finally:
            sdt.TAILWIND.write_text(original)


@unittest.skipUnless(shutil.which("node"), "node not installed")
class UnknownClassLint(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        probe = check("clean-tailwind.timeline.ts")
        if "layout check" not in probe.stdout + probe.stderr:
            raise unittest.SkipTest("Chrome not available")
        cls.clean = probe

    def test_clean_tailwind_fixtures_pass(self) -> None:
        self.assertEqual(self.clean.returncode, 0, self.clean.stdout + self.clean.stderr)
        self.assertIn("layout check: OK (5 beats in 4 segments)", self.clean.stdout)
        r = check("clean-tailwind-developer.timeline.ts")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_bad_tailwind_fixture_reports_each_class_with_a_fix(self) -> None:
        r = check("bad-tailwind.timeline.ts")
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        expected = [
            r"bad-classes beat 1/1: unknown-class: text-4xl -> use text-heading-lg",
            r"bad-classes beat 1/1: unknown-class: text-gray-500 -> use text-alternative",
            r"bad-classes beat 1/1: unknown-class: text-\[13px\] -> use a type role",
            r"bad-classes beat 1/1: unknown-class: bg-\[#111\] -> use a design-system colour: bg-section",
            r"bad-classes beat 1/1: unknown-class: text-white -> use text-default",
            r"bad-classes beat 1/1: unknown-class: gap-13 -> not on the scale; use gap-12",
            r"bad-classes beat 1/1: unknown-class: hover:bg-section -> use bg-section \(no variants",
            r"bad-classes beat 1/1: unknown-class: text-error-muted -> error-muted is a fill",
        ]
        for pattern in expected:
            self.assertRegex(out, pattern)
        self.assertEqual(out.count("unknown-class:"), len(expected), out)
        self.assertNotIn("vw-slot", out)

    def test_plain_css_projects_are_not_linted(self) -> None:
        for timeline in ["clean-metamask.timeline.ts", "bad.timeline.ts"]:
            out = check(timeline)
            self.assertNotIn("unknown-class", out.stdout + out.stderr)


if __name__ == "__main__":
    unittest.main()
