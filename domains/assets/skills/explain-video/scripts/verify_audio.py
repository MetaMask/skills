#!/usr/bin/env python3
"""Whisper each synthesized chunk once, then verify and write captions.

Compares the transcript to spoken text, not display. Prints either
`OK: all chunks match` or a short JSON list of flagged chunks.
`--repair` makes one attempt per flagged token, then stops.
"""

from __future__ import annotations

import argparse
import json
import re
import wave
from array import array
from difflib import SequenceMatcher
from pathlib import Path

from speak_prep import LINK_RE, TOKEN_RE, load_scenes, transform_token, write_json

THRESHOLD = 0.8
_MODEL = None

NUM_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
    "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
    "nineteen": "19", "twenty": "20",
}
WORD_ALIASES = {"period": "dot", "fullstop": "dot"}
# Spoken names for punctuation. Whisper usually writes the mark, which canon strips.
SPOKEN_PUNCT = {"dot", "period", "slash", "dash"}


def plain_spoken(text: str) -> str:
    return LINK_RE.sub(lambda match: match.group(1), text)


def canon(text: str) -> list[str]:
    text = plain_spoken(text).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens: list[str] = []
    buf: list[str] = []
    for raw in text.split():
        token = NUM_WORDS.get(raw, WORD_ALIASES.get(raw, raw))
        if len(token) == 1 and token.isalpha():
            buf.append(token)
            continue
        if buf:
            tokens.append("".join(buf))
            buf = []
        tokens.append(token)
    if buf:
        tokens.append("".join(buf))
    return [token for token in tokens if token not in SPOKEN_PUNCT]


def _joined(text: str) -> str:
    return "".join(canon(text))


def mismatched_tokens(expected: str, heard: str) -> list[str]:
    exp = canon(expected)
    hea = canon(heard)
    if _joined(expected) == _joined(heard):
        return []
    ratio = SequenceMatcher(None, _joined(expected), _joined(heard)).ratio()
    if ratio >= THRESHOLD:
        return []
    missing = [
        token
        for token in exp
        if not any(SequenceMatcher(None, token, other).ratio() >= THRESHOLD for other in hea)
    ]
    return missing or exp


def _model():
    global _MODEL
    if _MODEL is None:
        import whisper

        _MODEL = whisper.load_model("small.en")
    return _MODEL


def transcribe(wav: Path, cache_path: Path) -> dict:
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))
    result = _model().transcribe(str(wav), language="en", fp16=False, word_timestamps=True)
    words = []
    for segment in result.get("segments") or []:
        for word in segment.get("words") or []:
            words.append(
                {
                    "word": str(word.get("word", "")).strip(),
                    "start": float(word.get("start", 0.0)),
                    "end": float(word.get("end", 0.0)),
                }
            )
    payload = {"text": str(result.get("text", "")).strip(), "words": words}
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(cache_path, payload)
    return payload


CUE_MAX_WORDS = 7
CUE_PAUSE_S = 0.45
ONSET_LEAD_S = 0.03  # a caption may lead the first word by this much, never more


def speech_onset(wav: Path, window_s: float = 0.01, ratio: float = 0.04) -> float:
    """Seconds of leading silence in a 16-bit PCM wav (0.0 if it cannot be read).

    Whisper reports the first word of a short clip as starting at 0.0 even when the
    synthesized audio opens with silence, so first captions would appear early.
    """
    try:
        with wave.open(str(wav), "rb") as handle:
            if handle.getsampwidth() != 2:
                return 0.0
            rate, channels = handle.getframerate(), handle.getnchannels()
            samples = array("h")
            samples.frombytes(handle.readframes(handle.getnframes()))
    except (OSError, wave.Error, EOFError):
        return 0.0
    if channels > 1:
        samples = samples[::channels]
    if not samples:
        return 0.0
    peak = max(max(samples), -min(samples))
    if peak == 0:
        return 0.0
    size = max(1, int(rate * window_s))
    threshold = peak * ratio
    for start in range(0, len(samples) - size + 1, size):
        window = samples[start : start + size]
        rms = (sum(x * x for x in window) / size) ** 0.5
        if rms > threshold:
            return start / rate
    return 0.0


def clamp_to_onset(words: list[dict], onset: float) -> list[dict]:
    """No word may start before the speech does. Returns new word dicts."""
    floor = max(0.0, onset - ONSET_LEAD_S)
    fixed = []
    for word in words:
        start = max(word["start"], floor)
        fixed.append({**word, "start": round(start, 3), "end": round(max(word["end"], start), 3)})
    return fixed


def _norm_word(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def _align_display_to_heard(dwords: list[str], heard: list[dict]) -> list[tuple[float, float]]:
    """Give every display word a (start, end) time taken from the words Whisper heard.

    Display and speech differ: `$41.25M` is one display word but about seven spoken
    words, `out-earning` is one display word but two heard words. Matching words anchor
    the timing; everything between two anchors is spread over its time span in
    proportion to word length, so the caption text never drifts away from the audio.
    """
    a = [_norm_word(w) for w in dwords]
    b = [_norm_word(w["word"]) for w in heard]
    times: list[tuple[float, float] | None] = [None] * len(dwords)
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"])
        elif tag == "replace":
            start, end = heard[j1]["start"], heard[j2 - 1]["end"]
            weights = [max(1, len(a[i])) for i in range(i1, i2)]
            total = float(sum(weights))
            cursor = start
            for offset, weight in enumerate(weights):
                step = (end - start) * weight / total
                times[i1 + offset] = (cursor, cursor + step)
                cursor += step
        # "delete" (display word nobody said) and "insert" (heard word not shown) are
        # handled by the interpolation below and by simply not captioning the extra word.
    # Display words with no spoken counterpart sit between their neighbours' times.
    k = 0
    while k < len(times):
        if times[k] is not None:
            k += 1
            continue
        run_end = k
        while run_end < len(times) and times[run_end] is None:
            run_end += 1
        left = times[k - 1][1] if k > 0 and times[k - 1] else heard[0]["start"]
        right = times[run_end][0] if run_end < len(times) and times[run_end] else heard[-1]["end"]
        right = max(right, left)
        step = (right - left) / (run_end - k)
        for offset in range(run_end - k):
            times[k + offset] = (left + step * offset, left + step * (offset + 1))
        k = run_end
    # Times never run backwards.
    fixed: list[tuple[float, float]] = []
    floor = 0.0
    for start, end in times:  # type: ignore[misc]
        start = max(start, floor)
        end = max(end, start)
        fixed.append((start, end))
        floor = start
    return fixed


def caption_cues(words: list[dict], display: str) -> list[dict]:
    dwords = display.split()
    if not words:
        return [{"start": 0.0, "end": 0.0, "text": display}] if display else []
    if not dwords:
        return [
            {
                "start": group[0]["start"],
                "end": group[-1]["end"],
                "text": " ".join(word["word"] for word in group).strip(),
            }
            for group in _group_words(words)
        ]
    times = _align_display_to_heard(dwords, words)
    cues: list[dict] = []
    current: list[int] = []

    def flush() -> None:
        if current:
            cues.append(
                {
                    "start": round(times[current[0]][0], 3),
                    "end": round(times[current[-1]][1], 3),
                    "text": " ".join(dwords[k] for k in current),
                }
            )
            current.clear()

    for k, word in enumerate(dwords):
        if current:
            gap = times[k][0] - times[current[-1]][1]
            sentence_end = dwords[current[-1]].endswith((".", "?", "!", ":"))
            # A one-word cue is merged forward so it appears when it is spoken, not alone.
            if len(current) >= CUE_MAX_WORDS or (gap > CUE_PAUSE_S and len(current) >= 2) or (sentence_end and len(current) >= 3):
                flush()
        current.append(k)
    flush()
    return cues


def _group_words(words: list[dict]) -> list[list[dict]]:
    groups: list[list[dict]] = []
    current: list[dict] = []
    for word in words:
        if current:
            gap = word["start"] - current[-1]["end"]
            if gap > CUE_PAUSE_S or len(current) >= CUE_MAX_WORDS:
                groups.append(current)
                current = []
        current.append(word)
    if current:
        groups.append(current)
    return groups


def _load_durations(scenes_path: Path, out_dir: Path) -> dict:
    path = out_dir / "durations.json"
    if not path.exists():
        from synth import run

        return run(scenes_path, out_dir)
    return json.loads(path.read_text(encoding="utf-8"))


def _flagged(durations: dict, out_dir: Path, only: set[str] | None) -> tuple[list[dict], list[dict]]:
    flags = []
    captions = []
    for chunk in durations["chunks"]:
        if only and chunk["id"] not in only:
            continue
        wav = Path(chunk["audio"])
        if not wav.is_absolute():
            wav = out_dir / wav
        transcript = transcribe(wav, out_dir / "cache" / f"{chunk['hash']}.json")
        missed = mismatched_tokens(chunk["spoken"], transcript["text"])
        words = clamp_to_onset(transcript["words"], speech_onset(wav))
        captions.append(
            {
                "id": chunk["id"],
                "scene_id": chunk["scene_id"],
                "display": chunk["display"],
                "cues": caption_cues(words, chunk["display"]),
            }
        )
        if missed:
            flags.append(
                {
                    "id": chunk["id"],
                    "scene_id": chunk["scene_id"],
                    "mismatched": missed,
                    "expected": plain_spoken(chunk["spoken"]),
                    "heard": transcript["text"],
                }
            )
    return flags, captions


def _letter_spell(token: str) -> str:
    chars = [char.upper() for char in token if char.isalnum()]
    return " ".join(chars)


def _mostly_letters(phrase: str) -> bool:
    parts = phrase.split()
    if not parts:
        return False
    singles = sum(1 for part in parts if len(part) == 1)
    return singles >= max(1, len(parts) // 2)


def _phonemes(phrase: str) -> str:
    try:
        from misaki.en import G2P, US_VOCAB

        phonemes, _tokens = G2P(trf=False, british=False)(phrase)
    except Exception:
        return ""
    return "".join(char for char in phonemes if char in US_VOCAB or char.isspace()).strip()


def _repair_line(spoken: str, display: str, missed: list[str]) -> tuple[str, list[str]]:
    """One alternative per mismatched display token. Does not retry."""
    updated = spoken
    tried: list[str] = []
    for match in TOKEN_RE.finditer(display):
        token = match.group(0)
        phrase = transform_token(token)
        collapsed = "".join(canon(phrase))
        if not any(token_missed in collapsed or collapsed.startswith(token_missed) for token_missed in missed):
            if token.lower() not in missed and collapsed not in missed:
                continue
        if phrase not in updated and token not in updated:
            continue
        if _mostly_letters(phrase):
            phonemes = _phonemes(phrase)
            replacement = f"[{token}](/{phonemes}/)" if phonemes else None
        else:
            replacement = _letter_spell(token)
        if not replacement:
            tried.append(token)
            continue
        needle = phrase if phrase in updated else token
        updated = updated.replace(needle, replacement, 1)
        tried.append(token)
    return updated, tried


def _apply_repairs(scenes_path: Path, flags: list[dict], durations: dict) -> list[str]:
    scenes = load_scenes(scenes_path)
    tried: list[str] = []
    lines_by_scene = {}
    for scene in scenes.get("scenes", []):
        lines_by_scene[str(scene.get("id"))] = scene.get("lines") or [scene]
    chunk_by_id = {chunk["id"]: chunk for chunk in durations["chunks"]}
    for flag in flags:
        chunk = chunk_by_id[flag["id"]]
        indexes = chunk.get("line_indexes") or [0]
        if len(indexes) != 1:
            continue
        line = lines_by_scene[flag["scene_id"]][indexes[0]]
        updated, tokens = _repair_line(str(line.get("spoken", "")), str(line.get("display", "")), flag["mismatched"])
        if updated != line.get("spoken"):
            line["spoken"] = updated
            tried.extend(tokens)
    if tried:
        write_json(scenes_path, scenes)
    return tried


def verify(scenes_path: Path, out_dir: Path, repair: bool = False, only: set[str] | None = None) -> list[dict]:
    durations = _load_durations(scenes_path, out_dir)
    flags, captions = _flagged(durations, out_dir, only)
    if repair and flags:
        tried = _apply_repairs(scenes_path, flags, durations)
        if tried:
            from synth import run

            durations = run(scenes_path, out_dir)
            flags, captions = _flagged(durations, out_dir, {flag["id"] for flag in flags})
        cleared = [token for token in tried if token.lower() not in {m for flag in flags for m in flag["mismatched"]}]
        write_json(
            out_dir / "repair.json",
            {
                "tried": tried,
                "cleared": cleared,
                "still_flagged": sorted({m for flag in flags for m in flag["mismatched"]}),
            },
        )
    write_json(out_dir / "captions.json", {"cues": captions})
    return flags


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify Kokoro audio against spoken text")
    parser.add_argument("scenes", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--chunks", default="", help="Comma-separated chunk ids")
    args = parser.parse_args(argv)
    only = {item for item in args.chunks.split(",") if item} or None
    flags = verify(args.scenes, args.out, repair=args.repair, only=only)
    if not flags:
        print("OK: all chunks match")
        return 0
    print(json.dumps({"flagged": flags}, indent=2, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
