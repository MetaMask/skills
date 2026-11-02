#!/usr/bin/env python3
"""Rewrite scenes.json spoken lines so Kokoro is not handed raw code.

Stdlib only. Lexicon entries win over the normalizer. Running twice is a no-op.
Prints a short unknowns report (at most 15 rows) for the approval plan.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LEXICON = SKILL_ROOT / "references" / "lexicon.json"
UNKNOWN_CAP = 15

# Ordinary words. All-caps forms of these are not spelled and not reported.
COMMON = {
    "a", "about", "after", "again", "all", "also", "am", "an", "and", "are",
    "as", "at", "be", "because", "been", "before", "but", "by", "can", "code",
    "data", "do", "does", "for", "from", "get", "has", "have", "he", "her",
    "here", "how", "if", "in", "into", "is", "it", "its", "just", "me", "more",
    "my", "no", "not", "now", "of", "ok", "on", "one", "only", "or", "our",
    "out", "she", "so", "that", "the", "their", "them", "then", "there",
    "these", "they", "this", "to", "up", "us", "was", "we", "were", "what",
    "when", "where", "which", "who", "will", "with", "you", "your",
}

OPS = {
    "===": "equals equals equals",
    "!==": "not equals equals",
    "==": "equals equals",
    "!=": "not equals",
    "<=": "less or equal",
    ">=": "greater or equal",
    "=>": "arrow",
    "->": "arrow",
    "&&": "and",
    "||": "or",
}

EXTS = (
    "cjs|css|go|html|js|json|jsx|md|mjs|py|rs|sh|ts|tsx|yaml|yml"
)
WORD_EXTS = {"spec", "stories", "test"}
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]*)\)")
TOKEN_RE = re.compile(
    rf"""
    ===|!==|==|!=|<=|>=|=>|->|&&|\|\|
    | (?<!\w)\.(?:{EXTS})\b
    | \b[A-Za-z][\w-]*\.(?:{EXTS})\b
    | \b[A-Za-z0-9]+(?:/[A-Za-z0-9._-]+)+\b
    | \b[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)+\b
    | \b[A-Za-z]*[a-z][A-Z][A-Za-z0-9]*\b
    | \b[A-Z][a-z0-9]*[A-Z][A-Za-z0-9]*\b
    | \b[A-Z]{{2,5}}\b
    """,
    re.VERBOSE,
)
PLACEHOLDER_RE = re.compile(r"\u0000(\d+)\u0000")


def load_lexicon(path: Path | None = None) -> dict[str, dict[str, str]]:
    path = path or DEFAULT_LEXICON
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"{path} must be a JSON object of term -> {{spoken, phonemes}}")
    lexicon: dict[str, dict[str, str]] = {}
    for term, entry in raw.items():
        if not isinstance(entry, dict) or "spoken" not in entry:
            raise SystemExit(f"{path}: {term!r} needs a spoken field")
        cleaned = {"spoken": str(entry["spoken"])}
        if entry.get("phonemes"):
            cleaned["phonemes"] = str(entry["phonemes"]).strip().strip("/")
        lexicon[str(term)] = cleaned
    return lexicon


def _entry_text(term: str, entry: dict[str, str]) -> str:
    if entry.get("phonemes"):
        return f"[{term}](/{entry['phonemes']}/)"
    return entry["spoken"]


def _boundary_ok(text: str, start: int, end: int, term: str) -> bool:
    if term[:1].isalnum() and start > 0 and (text[start - 1].isalnum() or text[start - 1] == "_"):
        return False
    if term[-1:].isalnum() and end < len(text) and (text[end].isalnum() or text[end] == "_"):
        return False
    return True


def _protect(text: str, slots: list[str], phrase: str) -> str:
    if not phrase or phrase not in text:
        return text
    pattern = re.compile(rf"(?<![A-Za-z0-9_]){re.escape(phrase)}(?![A-Za-z0-9_])")
    def repl(_match: re.Match[str]) -> str:
        slots.append(phrase)
        return f"\u0000{len(slots) - 1}\u0000"
    return pattern.sub(repl, text)


def _apply_lexicon(text: str, lexicon: dict[str, dict[str, str]], slots: list[str]) -> str:
    for term in sorted(lexicon, key=len, reverse=True):
        if term not in text:
            continue
        replacement = _entry_text(term, lexicon[term])
        pieces: list[str] = []
        cursor = 0
        start = 0
        while True:
            index = text.find(term, start)
            if index < 0:
                break
            end = index + len(term)
            if "\u0000" in text[max(0, index - 1):end + 1] or not _boundary_ok(text, index, end, term):
                start = index + 1
                continue
            pieces.append(text[cursor:index])
            slots.append(replacement)
            pieces.append(f"\u0000{len(slots) - 1}\u0000")
            cursor = end
            start = end
        pieces.append(text[cursor:])
        text = "".join(pieces)
    return text


def _speak_piece(piece: str) -> str:
    if piece.lower() in COMMON and not (piece.isupper() and 2 <= len(piece) <= 5 and piece.lower() not in COMMON):
        return piece.lower()
    if piece.isupper() and 2 <= len(piece) <= 5 and piece.lower() not in COMMON:
        return " ".join(piece)
    if len(piece) == 1 and piece.isalpha():
        return piece.upper()
    return piece.lower()


def speak_ident(name: str) -> str:
    """Split camelCase, acronym runs, underscores, and digits glued to letters."""
    name = name.replace("_", " ").replace("-", " ")
    parts: list[str] = []
    for chunk in name.split():
        chunk = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", chunk)
        chunk = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", chunk)
        chunk = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", chunk)
        chunk = re.sub(r"(?<=\d)(?=[A-Za-z])", " ", chunk)
        parts.extend(chunk.split())
    return " ".join(_speak_piece(part) for part in parts if part)


def _speak_ext(ext: str) -> str:
    if ext.lower() in WORD_EXTS:
        return ext.lower()
    return " ".join(ext.upper())


def speak_filename(token: str) -> str:
    stem, ext = token.rsplit(".", 1)
    if "." in stem:
        head = speak_filename(stem)
    else:
        head = speak_ident(stem)
    return f"{head} dot {_speak_ext(ext)}"


def speak_path(token: str) -> str:
    parts = [part for part in token.split("/") if part]
    spoken: list[str] = []
    for part in parts:
        if "." in part and re.search(rf"\.(?:{EXTS})$", part):
            spoken.append(speak_filename(part))
        else:
            spoken.append(speak_ident(part))
    return " slash ".join(spoken)


def transform_token(token: str) -> str:
    if token in OPS:
        return OPS[token]
    if re.fullmatch(rf"\.(?:{EXTS})", token, re.IGNORECASE):
        return "dot " + _speak_ext(token[1:])
    if re.search(rf"\.(?:{EXTS})$", token, re.IGNORECASE) and "." in token:
        return speak_filename(token)
    if "/" in token:
        return speak_path(token)
    if token.isupper() and 2 <= len(token) <= 5:
        if token.lower() in COMMON:
            return token.lower()
        return " ".join(token)
    return speak_ident(token)


def _should_protect(value: str) -> bool:
    return bool(TOKEN_RE.search(value) or re.search(r"[-_./=]", value))


def normalize_spoken(text: str, lexicon: dict[str, dict[str, str]] | None = None) -> str:
    if not text or not text.strip():
        return text
    lexicon = lexicon or {}
    slots: list[str] = []

    def hold_link(match: re.Match[str]) -> str:
        slots.append(match.group(0))
        return f"\u0000{len(slots) - 1}\u0000"

    masked = LINK_RE.sub(hold_link, text)
    masked = _apply_lexicon(masked, lexicon, slots)
    for entry in lexicon.values():
        spoken = entry.get("spoken") or ""
        if _should_protect(spoken):
            masked = _protect(masked, slots, spoken)

    def hold_token(match: re.Match[str]) -> str:
        token = match.group(0)
        if "\u0000" in token:
            return token
        spoken = transform_token(token)
        if spoken == token:
            return token
        slots.append(spoken)
        return f"\u0000{len(slots) - 1}\u0000"

    masked = TOKEN_RE.sub(hold_token, masked)
    restored = PLACEHOLDER_RE.sub(lambda match: slots[int(match.group(1))], masked)
    # Splitting reveals pieces such as the "id" in userId. Apply the lexicon once more.
    return _apply_visible_lexicon(restored, lexicon)


def _apply_visible_lexicon(text: str, lexicon: dict[str, dict[str, str]]) -> str:
    if not text or not lexicon:
        return text
    slots: list[str] = []

    def hold_link(match: re.Match[str]) -> str:
        slots.append(match.group(0))
        return f"\u0000{len(slots) - 1}\u0000"

    masked = LINK_RE.sub(hold_link, text)
    masked = _apply_lexicon(masked, lexicon, slots)
    return PLACEHOLDER_RE.sub(lambda match: slots[int(match.group(1))], masked)


def iter_lines(scenes: dict) -> list[dict]:
    lines: list[dict] = []
    for scene in scenes.get("scenes", []):
        if "lines" in scene:
            lines.extend(scene["lines"])
        elif "spoken" in scene or "display" in scene:
            lines.append(scene)
    return lines


def prepare_scenes(scenes: dict, lexicon: dict[str, dict[str, str]]) -> dict:
    for line in iter_lines(scenes):
        line["spoken"] = normalize_spoken(str(line.get("spoken", "")), lexicon)
    return scenes


def collect_unknowns(scenes: dict, lexicon: dict[str, dict[str, str]]) -> list[dict]:
    counts: Counter[str] = Counter()
    proposed: dict[str, str] = {}
    for line in iter_lines(scenes):
        display = str(line.get("display", ""))
        for match in TOKEN_RE.finditer(display):
            token = match.group(0)
            if token in lexicon or token.lower() in COMMON:
                continue
            spoken = transform_token(token)
            if spoken == token:
                continue
            counts[token] += 1
            proposed[token] = spoken
    ranked = sorted(counts, key=lambda token: (-counts[token], token))[:UNKNOWN_CAP]
    return [
        {"token": token, "spoken": proposed[token], "count": counts[token]}
        for token in ranked
    ]


def load_scenes(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "scenes" not in data:
        raise SystemExit(f"{path} needs a scenes array")
    return data


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Normalize scenes.json spoken lines")
    parser.add_argument("scenes", type=Path)
    parser.add_argument("--lexicon", type=Path, default=DEFAULT_LEXICON)
    parser.add_argument("--report", type=Path, default=None, help="Write the unknowns JSON here")
    args = parser.parse_args(argv)
    lexicon = load_lexicon(args.lexicon)
    scenes = load_scenes(args.scenes)
    prepare_scenes(scenes, lexicon)
    write_json(args.scenes, scenes)
    report = {"unknowns": collect_unknowns(scenes, lexicon)}
    if args.report:
        write_json(args.report, report)
    json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
