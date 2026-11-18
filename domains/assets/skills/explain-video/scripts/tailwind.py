"""Generate assets/kit/tailwind.css: a static, dark-only Tailwind-style utility sheet for 1920x1080 scenes.

Imported by sync_design_tokens.py; `build` writes the file and `build --check` fails on drift.
Vocabulary: design-system type roles (scaled), dark design-system colours, and common layout
utilities on Tailwind's 4px spacing scale. No variants, no arbitrary values, no generic palette.
"""

from __future__ import annotations

MARKER = "--vw-tailwind"

SPACING = ["0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9", "10", "11", "12",
           "14", "16", "20", "24", "28", "32", "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96"]
FRACTIONS = ["1/2", "1/3", "2/3", "1/4", "2/4", "3/4", "1/5", "2/5", "3/5", "4/5", "1/6", "5/6"]
SURFACES = ["background-default", "background-section", "background-subsection"]
SURFACE_FAMILIES = ("background", "text", "border")
RADIUS = {"none": "0", "sm": "var(--radius-sm, 12px)", "": "var(--radius-md, 20px)", "md": "var(--radius-md, 20px)",
          "lg": "var(--radius-lg, 28px)", "xl": "32px", "2xl": "40px", "3xl": "48px", "full": "9999px"}


def luminance(h: str) -> float:
    c = [int(h[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def readable(token: str, dark: dict[str, str]) -> bool:
    hexv = dark[token]
    if token.endswith("-inverse"):
        return True
    if len(hexv) != 7:
        return False
    return all(contrast(hexv, dark[bg]) >= 4.5 for bg in SURFACES)


def space(step: str) -> str:
    if step == "0":
        return "0"
    if step == "px":
        return "1px"
    return f"{float(step) * 4:g}px"


def esc(name: str) -> str:
    return "".join("\\" + c if c in "./:[]#%" else c for c in name)


def num(x: float) -> str:
    return f"{x:.3f}".rstrip("0").rstrip(".")


class Sheet:
    def __init__(self) -> None:
        self.lines: list[str] = []
        self.names: list[str] = []

    def section(self, title: str) -> None:
        self.lines.append(f"\n/* {title} */")

    def rule(self, name: str, body: str) -> None:
        self.names.append(name)
        self.lines.append(f".{esc(name)} {{ {body} }}")


def layout(s: Sheet) -> None:
    s.section("display, position, overflow")
    for name, value in [("block", "block"), ("inline-block", "inline-block"), ("inline", "inline"), ("flex", "flex"),
                        ("inline-flex", "inline-flex"), ("grid", "grid"), ("inline-grid", "inline-grid"), ("contents", "contents"), ("hidden", "none")]:
        s.rule(name, f"display: {value};")
    for p in ["static", "relative", "absolute"]:
        s.rule(p, f"position: {p};")
    s.rule("inset-0", "inset: 0;")
    for side in ["top", "right", "bottom", "left"]:
        s.rule(f"{side}-0", f"{side}: 0;")
    for z in ["0", "10", "20", "30"]:
        s.rule(f"z-{z}", f"z-index: {z};")
    for v in ["hidden", "visible", "clip"]:
        s.rule(f"overflow-{v}", f"overflow: {v};")
        s.rule(f"overflow-x-{v}", f"overflow-x: {v};")
        s.rule(f"overflow-y-{v}", f"overflow-y: {v};")

    s.section("flex and grid")
    for name, value in [("flex-row", "row"), ("flex-row-reverse", "row-reverse"), ("flex-col", "column"), ("flex-col-reverse", "column-reverse")]:
        s.rule(name, f"flex-direction: {value};")
    for name, value in [("flex-wrap", "wrap"), ("flex-nowrap", "nowrap")]:
        s.rule(name, f"flex-wrap: {value};")
    for name, value in [("flex-1", "1 1 0%"), ("flex-auto", "1 1 auto"), ("flex-initial", "0 1 auto"), ("flex-none", "none")]:
        s.rule(name, f"flex: {value};")
    s.rule("grow", "flex-grow: 1;")
    s.rule("grow-0", "flex-grow: 0;")
    s.rule("shrink", "flex-shrink: 1;")
    s.rule("shrink-0", "flex-shrink: 0;")
    s.rule("basis-0", "flex-basis: 0;")
    s.rule("basis-full", "flex-basis: 100%;")
    for n in range(1, 13):
        s.rule(f"grid-cols-{n}", f"grid-template-columns: repeat({n}, minmax(0, 1fr));")
    for n in range(1, 7):
        s.rule(f"grid-rows-{n}", f"grid-template-rows: repeat({n}, minmax(0, 1fr));")
    for n in range(1, 13):
        s.rule(f"col-span-{n}", f"grid-column: span {n} / span {n};")
    s.rule("col-span-full", "grid-column: 1 / -1;")
    for n in range(1, 7):
        s.rule(f"row-span-{n}", f"grid-row: span {n} / span {n};")
    s.rule("row-span-full", "grid-row: 1 / -1;")
    for name, value in [("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("baseline", "baseline"), ("stretch", "stretch")]:
        s.rule(f"items-{name}", f"align-items: {value};")
    for name, value in [("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("between", "space-between"),
                        ("around", "space-around"), ("evenly", "space-evenly"), ("stretch", "stretch")]:
        s.rule(f"justify-{name}", f"justify-content: {value};")
    for name, value in [("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("between", "space-between"), ("stretch", "stretch")]:
        s.rule(f"content-{name}", f"align-content: {value};")
    for name, value in [("auto", "auto"), ("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("stretch", "stretch")]:
        s.rule(f"self-{name}", f"align-self: {value};")
    for name in ["start", "end", "center", "stretch"]:
        s.rule(f"justify-items-{name}", f"justify-items: {name};")
        s.rule(f"justify-self-{name}", f"justify-self: {name};")
        s.rule(f"place-items-{name}", f"place-items: {name};")
    s.rule("place-content-center", "place-content: center;")

    s.section("gap, padding, margin: Tailwind's 4px scale (p-8 = 32px)")
    for prop, names in [("gap", ["gap"]), ("column-gap", ["gap-x"]), ("row-gap", ["gap-y"])]:
        for step in SPACING:
            s.rule(f"{names[0]}-{step}", f"{prop}: {space(step)};")
    boxes = [("p", "padding", ["padding"]), ("px", "padding", ["padding-left", "padding-right"]), ("py", "padding", ["padding-top", "padding-bottom"]),
             ("pt", "padding", ["padding-top"]), ("pr", "padding", ["padding-right"]), ("pb", "padding", ["padding-bottom"]), ("pl", "padding", ["padding-left"]),
             ("m", "margin", ["margin"]), ("mx", "margin", ["margin-left", "margin-right"]), ("my", "margin", ["margin-top", "margin-bottom"]),
             ("mt", "margin", ["margin-top"]), ("mr", "margin", ["margin-right"]), ("mb", "margin", ["margin-bottom"]), ("ml", "margin", ["margin-left"])]
    for prefix, kind, props in boxes:
        steps = SPACING + (["auto"] if kind == "margin" else [])
        for step in steps:
            value = "auto" if step == "auto" else space(step)
            s.rule(f"{prefix}-{step}", " ".join(f"{p}: {value};" for p in props))

    s.section("width and height")
    for prefix, props in [("w", ["width"]), ("h", ["height"]), ("size", ["width", "height"])]:
        values = [(step, space(step)) for step in SPACING] + [(f, f"{100 * int(f.split('/')[0]) / int(f.split('/')[1]):.6g}%") for f in FRACTIONS]
        values += [("full", "100%"), ("auto", "auto"), ("fit", "fit-content"), ("min", "min-content"), ("max", "max-content")]
        for step, value in values:
            s.rule(f"{prefix}-{step}", " ".join(f"{p}: {value};" for p in props))
    for name, prop, value in [("min-w-0", "min-width", "0"), ("min-w-full", "min-width", "100%"), ("min-h-0", "min-height", "0"),
                              ("min-h-full", "min-height", "100%"), ("max-w-full", "max-width", "100%"), ("max-w-none", "max-width", "none"),
                              ("max-h-full", "max-height", "100%"), ("max-h-none", "max-height", "none")]:
        s.rule(name, f"{prop}: {value};")
    for name, value in [("square", "1 / 1"), ("video", "16 / 9"), ("auto", "auto")]:
        s.rule(f"aspect-{name}", f"aspect-ratio: {value};")
    for name in ["contain", "cover", "fill", "none"]:
        s.rule(f"object-{name}", f"object-fit: {name};")

    s.section("radius and border width (radius sm/md/lg follow the theme)")
    for name, value in RADIUS.items():
        s.rule(f"rounded-{name}" if name else "rounded", f"border-radius: {value};")
    for name, value in [("border", "1px"), ("border-0", "0"), ("border-2", "2px"), ("border-4", "4px")]:
        s.rule(name, f"border-width: {value};")
    for side, props in [("t", ["top"]), ("r", ["right"]), ("b", ["bottom"]), ("l", ["left"]), ("x", ["left", "right"]), ("y", ["top", "bottom"])]:
        for suffix, value in [("", "1px"), ("-0", "0"), ("-2", "2px"), ("-4", "4px")]:
            s.rule(f"border-{side}{suffix}", " ".join(f"border-{p}-width: {value};" for p in props))
    for style in ["solid", "dashed", "dotted", "none"]:
        s.rule(f"border-{style}", f"border-style: {style};")

    s.section("text layout")
    for a in ["left", "center", "right"]:
        s.rule(f"text-{a}", f"text-align: {a};")
    for name, value in [("whitespace-normal", "normal"), ("whitespace-nowrap", "nowrap"), ("whitespace-pre", "pre"), ("whitespace-pre-wrap", "pre-wrap"),
                        ("whitespace-pre-line", "pre-line")]:
        s.rule(name, f"white-space: {value};")
    s.rule("break-words", "overflow-wrap: break-word;")
    s.rule("break-all", "word-break: break-all;")
    s.rule("uppercase", "text-transform: uppercase;")
    s.rule("normal-case", "text-transform: none;")
    s.rule("italic", "font-style: italic;")
    s.rule("not-italic", "font-style: normal;")
    s.rule("underline", "text-decoration-line: underline;")
    s.rule("line-through", "text-decoration-line: line-through;")
    s.rule("no-underline", "text-decoration-line: none;")
    s.rule("tabular-nums", "font-variant-numeric: tabular-nums;")
    for n in ["0", "25", "50", "75", "100"]:
        s.rule(f"opacity-{n}", f"opacity: {int(n) / 100:g};")


def typography(s: Sheet, snap: dict) -> None:
    scale = snap["scale"]
    s.section(f"type roles: design-system large-screen scale x{num(scale)} for 1920x1080")
    for role, t in snap["type"].items():
        s.rule(f"text-{role}", f"font-size: {num(t['font-size'] * scale)}px; line-height: {num(t['line-height'] * scale)}px; "
               f"font-weight: {t['font-weight']}; letter-spacing: {num(t['letter-spacing'])}em;")
    s.rule("font-sans", "font-family: var(--font-body, var(--font-family-default));")
    s.rule("font-mono", 'font-family: var(--font-mono, "JetBrains Mono", ui-monospace, monospace);')
    for name, w in [("regular", 400), ("medium", 500), ("bold", 600)]:
        s.rule(f"font-{name}", f"font-weight: {w};")


def colors(s: Sheet, snap: dict) -> None:
    dark = snap["dark"]
    s.section(f"colours: {snap['package']}@{snap['version']} dark theme only; text colours pass 4.5:1 on bg-default/section/subsection (-inverse is for text on a filled bg-*-default)")
    s.rule("text-inherit", "color: inherit;")
    s.rule("text-current", "color: currentColor;")
    for token, hexv in dark.items():
        family = token.split("-")[0]
        if not readable(token, dark):
            continue
        if family == "text":
            s.rule(token, f"color: {hexv};")
        elif family not in SURFACE_FAMILIES:
            s.rule(f"text-{token}", f"color: {hexv};")
    s.rule("bg-transparent", "background-color: transparent;")
    for token, hexv in dark.items():
        family = token.split("-")[0]
        if family == "background":
            s.rule("bg-" + token.removeprefix("background-"), f"background-color: {hexv};")
        elif family not in SURFACE_FAMILIES:
            s.rule(f"bg-{token}", f"background-color: {hexv};")
    s.rule("border-transparent", "border-color: transparent;")
    s.rule("border-current", "border-color: currentColor;")
    for token, hexv in dark.items():
        family = token.split("-")[0]
        if family == "border":
            s.rule(token, f"border-color: {hexv};")
        elif family not in SURFACE_FAMILIES:
            s.rule(f"border-{token}", f"border-color: {hexv};")
    for prop in ["fill", "stroke"]:
        s.rule(f"{prop}-none", f"{prop}: none;")
        s.rule(f"{prop}-current", f"{prop}: currentColor;")
        for token, hexv in dark.items():
            if token.split("-")[0] not in SURFACE_FAMILIES:
                s.rule(f"{prop}-{token}", f"{prop}: {hexv};")


def build_sheet(snap: dict) -> Sheet:
    s = Sheet()
    layout(s)
    typography(s, snap)
    colors(s, snap)
    return s


def generate(snap: dict) -> str:
    s = build_sheet(snap)
    head = [
        f"/* kit/tailwind.css: {snap['package']}@{snap['version']}, generated by scripts/sync_design_tokens.py. Do not edit.",
        " * Opt in by importing it after kit/kit.css. Dark theme only, no variants, no arbitrary values.",
        f" * {len(s.names)} classes. Vocabulary: styles/metamask/STYLE.md, \"Tailwind classes\". */",
        ":root {",
        f"\t{MARKER}: 1;",
        "}",
        ":where(.vw-stage *, .vw-stage *::before, .vw-stage *::after) {",
        "\tborder-width: 0;",
        "\tborder-style: solid;",
        f"\tborder-color: {snap['dark']['border-muted']};",
        "}",
    ]
    return "\n".join(head + s.lines) + "\n"


def class_names(snap: dict) -> list[str]:
    return build_sheet(snap).names
