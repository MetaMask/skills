#!/usr/bin/env python3
"""The MetaMask themes must match the pinned design-tokens snapshot, and their text tokens must be readable."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SKILL / "scripts"))

import sync_design_tokens as sdt  # noqa: E402

SNAP = json.loads(sdt.SNAPSHOT.read_text())
KIT = (SKILL / "assets" / "kit" / "kit.css").read_text()
CLONE = Path(os.environ.get("MM_DESIGN_TOKENS", Path.home() / "Desktop/projects/metamask-design-system/packages/design-tokens"))
ROLES = ["display-xl", "display-lg", "display-md", "heading-lg", "heading-md", "heading-sm", "body-lg", "body-md", "body-sm", "body-xs"]
TEXT = ["--text", "--text-muted", "--text-dim", "--accent", "--captions-text", "--mm-orange", "--mm-orange-soft", "--mm-blue",
        "--mm-blue-soft", "--mm-indigo", "--mm-lime", "--mm-purple", "--mm-yellow", "--mm-red", "--color-primary-default", "--color-error-default",
        "--color-warning-default", "--color-success-default", "--color-text-default", "--color-text-alternative"]
SURFACES = ["--surface-0", "--surface-1", "--surface-2", "--color-background-default", "--color-background-section",
            "--color-background-subsection", "--color-background-alternative"]

MINI = """
:root{--brand-colors-grey-grey000:#ffffff;--brand-colors-grey-grey500:#66676a;--brand-colors-black:#000000}
.light,:root,[data-theme=light]{--color-text-default:#111111}
.dark,[data-theme=dark]{--color-background-default:var(--brand-colors-black);--color-text-default:var(--brand-colors-grey-grey000);--color-text-muted:var(--brand-colors-grey-grey500);--color-text-default-hover:#eeeeee}
:root{--font-family-default:'Inter','Helvetica Neue',sans-serif;--font-size-2:0.75rem;--font-size-4:1rem;--line-height-2:1.25rem;--line-height-4:1.5rem;
--font-weight-regular:400;--letter-spacing-0:0;--letter-spacing-1:2.5%}
"""


def theme_vars(name: str) -> dict[str, str]:
    css = (SKILL / "assets" / "styles" / name / "style.css").read_text()
    out: dict[str, str] = {}
    for sel, decls in sdt.blocks(css):
        if sel == ":root":
            out.update(decls)
    return out


def hex_of(name: str, scope: dict[str, str]) -> str:
    value = scope[name]
    for _ in range(10):
        m = re.fullmatch(r"\s*var\((--[\w-]+)(?:,[^)]*)?\)\s*", value)
        if not m:
            break
        value = scope[m.group(1)]
    value = value.strip().lower()
    if not re.fullmatch(r"#[0-9a-f]{6}", value):
        raise AssertionError(f"{name} is not an opaque hex colour: {value}")
    return value


def luminance(h: str) -> float:
    c = [int(h[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


class DesignTokens(unittest.TestCase):
    def test_snapshot_is_pinned(self) -> None:
        self.assertEqual(SNAP["package"], "@metamask/design-tokens")
        self.assertEqual(SNAP["version"], "13.0.0")
        self.assertEqual(SNAP["scale"], sdt.SCALE)
        self.assertEqual(SNAP["type"]["body-md"]["font-size"], 16)

    def test_themes_match_snapshot(self) -> None:
        r = subprocess.run([sys.executable, str(SKILL / "scripts" / "sync_design_tokens.py"), "build", "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_parse_resolves_dark_theme_and_scale(self) -> None:
        snap = sdt.parse(MINI + ":root{" + "".join(
            f"--typography-l-{ds}-font-size:var(--font-size-4);--typography-l-{ds}-line-height:var(--line-height-4);"
            f"--typography-l-{ds}-font-weight:var(--font-weight-regular);--typography-l-{ds}-letter-spacing:var(--letter-spacing-1);"
            for ds in sdt.ROLES.values()) + "}", "0.0.0")
        self.assertEqual(snap["dark"]["text-default"], "#ffffff")
        self.assertEqual(snap["dark"]["background-default"], "#000000")
        self.assertNotIn("text-default-hover", snap["dark"])
        self.assertEqual(snap["type"]["body-md"], {"font-size": 16, "line-height": 24, "font-weight": 400, "letter-spacing": 0.025})
        block = sdt.generate(snap)
        self.assertIn(f"--typography-body-md-font-size: {sdt.num(16 * sdt.SCALE)}px;", block)
        self.assertIn("--typography-body-md-letter-spacing: 0.025em;", block)

    def test_snapshot_matches_local_clone(self) -> None:
        if not (CLONE / "src" / "css" / "typography.css").exists():
            self.skipTest(f"no design-tokens clone at {CLONE}")
        version = json.loads((CLONE / "package.json").read_text())["version"]
        if version != SNAP["version"]:
            self.skipTest(f"clone is {version}, snapshot is {SNAP['version']}")
        self.assertEqual(sdt.parse(sdt.read_source(CLONE), version), SNAP)

    def test_kit_has_every_role(self) -> None:
        for role in ROLES:
            self.assertIn(f".vw-{role} {{", KIT)
            self.assertIn(f"var(--typography-{role}-font-size)", KIT)
        for role in SNAP["type"]:
            self.assertIn(f".vw-{role} {{", KIT)

    def test_smallest_role_stays_readable(self) -> None:
        smallest = min(t["font-size"] for t in SNAP["type"].values()) * SNAP["scale"]
        self.assertGreaterEqual(smallest, 20)

    def test_text_tokens_pass_aa_on_every_surface(self) -> None:
        for theme in ["metamask", "metamask-developer"]:
            scope = theme_vars(theme)
            names = TEXT + [k for k in scope if k.startswith("--dev-")]
            for fg in names:
                if fg not in scope:
                    continue
                for bg in SURFACES:
                    with self.subTest(theme=theme, fg=fg, bg=bg):
                        ratio = contrast(hex_of(fg, scope), hex_of(bg, scope))
                        self.assertGreaterEqual(ratio, 4.5, f"{fg} on {bg} is {ratio:.2f}:1")

    def test_text_on_accent_passes_aa(self) -> None:
        for theme in ["metamask", "metamask-developer"]:
            scope = theme_vars(theme)
            self.assertGreaterEqual(contrast(hex_of("--text-on-accent", scope), hex_of("--accent", scope)), 4.5)

    def test_ds_text_muted_is_not_a_text_token(self) -> None:
        for theme in ["metamask", "metamask-developer"]:
            scope = theme_vars(theme)
            self.assertLess(contrast(hex_of("--color-text-muted", scope), hex_of("--surface-1", scope)), 4.5)
            for name in ["--text", "--text-muted", "--text-dim"]:
                self.assertNotIn("--color-text-muted", scope[name])


if __name__ == "__main__":
    unittest.main()
