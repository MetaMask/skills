#!/usr/bin/env python3
"""Sync the MetaMask and MetaMask Developer themes with @metamask/design-tokens.

Stdlib only. Two steps, each runnable alone:

  pull   read the package CSS and write assets/styles/design-tokens.json (the pinned snapshot)
         --from PATH   a design-tokens clone (packages/design-tokens), an unpacked npm
                       package, a .tgz, or a single styles.css
         --npm VER     run `npm pack @metamask/design-tokens@VER` first (needs network)
  build  regenerate the marked token block in each theme's style.css, and assets/kit/tailwind.css,
         from the snapshot
         --check       exit 1 if any generated file differs from what the snapshot generates

The type scale is the design system's large-screen (`l`) scale multiplied by SCALE for a
1920x1080 canvas. Colours are the dark theme, resolved to hex.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import tailwind

SKILL = Path(__file__).resolve().parents[1]
SNAPSHOT = SKILL / "assets" / "styles" / "design-tokens.json"
THEMES = [SKILL / "assets" / "styles" / "metamask" / "style.css", SKILL / "assets" / "styles" / "metamask-developer" / "style.css"]
TAILWIND = SKILL / "assets" / "kit" / "tailwind.css"
BEGIN = "/* design-tokens:begin"
END = "/* design-tokens:end */"
SCALE = 1.75
REM = 16
ROLES = {
    "display-xl": "display-xl", "display-lg": "display-lg", "display-md": "display-md",
    "heading-lg": "heading-lg", "heading-md": "heading-md", "heading-sm": "heading-sm",
    "body-lg": "body-lg-medium",
    "body-md": "body-md", "body-md-medium": "body-md-medium", "body-md-bold": "body-md-bold",
    "body-sm": "body-sm", "body-sm-medium": "body-sm-medium", "body-sm-bold": "body-sm-bold",
    "body-xs": "body-xs", "body-xs-medium": "body-xs-medium",
}
DARK_SKIP = re.compile(r"-(hover|pressed)$|^--color-(icon|overlay|shadow|flask)-")

DECL = re.compile(r"(--[\w-]+)\s*:\s*([^;]+);")
BLOCK = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)


def blocks(css: str) -> list[tuple[str, dict[str, str]]]:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    return [(sel.strip(), dict(DECL.findall(body + ";"))) for sel, body in BLOCK.findall(css)]


def read_source(path: Path) -> str:
    if path.is_file() and path.suffix == ".tgz":
        with tarfile.open(path) as tar:
            return tar.extractfile("package/dist/styles.css").read().decode()
    if path.is_file():
        return path.read_text()
    for rel in ["dist/styles.css", "package/dist/styles.css"]:
        if (path / rel).exists():
            return (path / rel).read_text()
    src = path / "src" / "css"
    names = ["brand-colors.css", "dark-theme-colors.css", "typography.css"]
    if all((src / n).exists() for n in names):
        return "\n".join((src / n).read_text() for n in names)
    raise SystemExit(f"no design-tokens CSS under {path}")


def resolve(value: str, scope: dict[str, str]) -> str:
    for _ in range(10):
        m = re.fullmatch(r"\s*var\((--[\w-]+)\)\s*", value)
        if not m:
            return value.strip()
        value = scope[m.group(1)]
    raise ValueError(f"unresolved {value}")


def to_px(value: str) -> float:
    m = re.fullmatch(r"([\d.]+)(rem|px)", value)
    if not m:
        raise ValueError(f"not a length: {value}")
    return float(m.group(1)) * (REM if m.group(2) == "rem" else 1)


def to_em(value: str) -> float:
    if value in ("0", "0px"):
        return 0.0
    m = re.fullmatch(r"([\d.]+)%", value)
    if not m:
        raise ValueError(f"not a letter spacing: {value}")
    return float(m.group(1)) / 100


def parse(css: str, version: str) -> dict:
    root: dict[str, str] = {}
    dark: dict[str, str] = {}
    for sel, decls in blocks(css):
        names = [s.strip() for s in sel.split(",")]
        if ".dark" in names:
            dark.update(decls)
        elif ":root" in names and ".light" not in names:
            root.update(decls)
    scope = {**root, **dark}
    brand = {k.removeprefix("--brand-colors-"): resolve(v, scope).lower() for k, v in root.items() if k.startswith("--brand-colors-")}
    colors = {k.removeprefix("--color-"): resolve(v, scope).lower() for k, v in dark.items() if not DARK_SKIP.search(k)}
    type_scale = {}
    for role, ds in ROLES.items():
        p = f"--typography-l-{ds}-"
        type_scale[role] = {
            "font-size": to_px(resolve(scope[p + "font-size"], scope)),
            "line-height": to_px(resolve(scope[p + "line-height"], scope)),
            "font-weight": int(resolve(scope[p + "font-weight"], scope)),
            "letter-spacing": to_em(resolve(scope[p + "letter-spacing"], scope)),
        }
    return {
        "package": "@metamask/design-tokens",
        "version": version,
        "scale": SCALE,
        "font-family-default": re.sub(r",\s*", ", ", resolve(scope["--font-family-default"], scope)),
        "brand": dict(sorted(brand.items())),
        "dark": colors,
        "type": type_scale,
    }


def num(x: float) -> str:
    return f"{x:.3f}".rstrip("0").rstrip(".")


def generate(snap: dict) -> str:
    scale = snap["scale"]
    out = [f"{BEGIN} {snap['package']}@{snap['version']}, generated by scripts/sync_design_tokens.py */", ":root {"]
    out.append(f"\t--font-family-default: {snap['font-family-default']};")
    out += [f"\t--brand-colors-{k}: {v};" for k, v in snap["brand"].items()]
    out += [f"\t--color-{k}: {v};" for k, v in snap["dark"].items()]
    for role, t in snap["type"].items():
        out += [
            f"\t--typography-{role}-font-size: {num(t['font-size'] * scale)}px;",
            f"\t--typography-{role}-line-height: {num(t['line-height'] * scale)}px;",
            f"\t--typography-{role}-font-weight: {t['font-weight']};",
            f"\t--typography-{role}-letter-spacing: {num(t['letter-spacing'])}em;",
        ]
    out.append("}")
    out.append(END)
    return "\n".join(out)


def splice(css: str, block: str) -> str:
    start = css.find(BEGIN)
    if start < 0:
        raise SystemExit("style.css has no design-tokens block")
    end = css.index(END, start) + len(END)
    return css[:start] + block + css[end:]


def build(check: bool) -> int:
    snap = json.loads(SNAPSHOT.read_text())
    block = generate(snap)
    drift = []
    outputs = [(path, splice(path.read_text(), block)) for path in THEMES]
    outputs.append((TAILWIND, tailwind.generate(snap)))
    for path, new in outputs:
        css = path.read_text() if path.exists() else ""
        if new != css:
            drift.append(path)
            if not check:
                path.write_text(new)
    for path in drift:
        print(f"{'drift' if check else 'updated'}: {path.relative_to(SKILL)}")
    if check and drift:
        print("run: python3 scripts/sync_design_tokens.py build")
        return 1
    if not drift:
        print("design tokens: in sync")
    return 0


def pull(source: Path | None, npm: str | None) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        if npm:
            subprocess.run(["npm", "pack", f"@metamask/design-tokens@{npm}", "--pack-destination", tmp], check=True, capture_output=True)
            source = next(Path(tmp).glob("*.tgz"))
        css = read_source(source)
        version = npm or package_version(source)
    snap = parse(css, version)
    SNAPSHOT.write_text(json.dumps(snap, indent=2) + "\n")
    print(f"wrote {SNAPSHOT.relative_to(SKILL)} from @metamask/design-tokens@{version}")
    return 0


def package_version(source: Path) -> str:
    if source.suffix == ".tgz":
        with tarfile.open(source) as tar:
            return json.load(tar.extractfile("package/package.json"))["version"]
    for cand in [source / "package.json", source / "package" / "package.json", source.parent.parent / "package.json"]:
        if cand.exists():
            return json.loads(cand.read_text())["version"]
    return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pull")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--from", dest="source", type=Path)
    g.add_argument("--npm")
    b = sub.add_parser("build")
    b.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.cmd == "pull":
        return pull(a.source, a.npm)
    return build(a.check)


if __name__ == "__main__":
    sys.exit(main())
