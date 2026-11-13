#!/usr/bin/env python3
"""Synthesize scenes.json with local Kokoro. One call per spoken chunk.

Cache key is a hash of the spoken text, voice, and speed. Unchanged chunks
are not synthesized again. Writes durations.json and Videowright track.ts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from speak_prep import load_lexicon, load_scenes, normalize_spoken, write_json

SAMPLE_RATE = 24_000
CHUNK_GAP_S = 0.15
MIN_TOKENS = 15
MAX_WORDS = 150
DEFAULT_VOICE = "af_heart"
_PIPELINE = None


def _pipeline():
    global _PIPELINE
    if _PIPELINE is None:
        from kokoro import KPipeline

        _PIPELINE = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    return _PIPELINE


def synthesize_array(text: str, voice: str = DEFAULT_VOICE, speed: float = 1.0):
    import numpy as np

    parts: list = []
    gap = np.zeros(int(SAMPLE_RATE * CHUNK_GAP_S), dtype=np.float32)
    produced = False
    for _graphemes, _phonemes, audio in _pipeline()(text, voice=voice, speed=speed):
        if audio is None:
            continue
        if produced:
            parts.append(gap)
        parts.append(np.asarray(audio, dtype=np.float32))
        produced = True
    if not parts:
        return np.zeros(SAMPLE_RATE // 10, dtype=np.float32)
    return np.concatenate(parts)


def chunk_hash(spoken: str, voice: str, speed: float) -> str:
    payload = f"{voice}\n{speed}\n{spoken}".encode()
    return hashlib.sha256(payload).hexdigest()


def _split_long(text: str) -> list[str]:
    words = text.split()
    if len(words) <= MAX_WORDS:
        return [text.strip()] if text.strip() else []
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    groups: list[str] = []
    buf: list[str] = []
    count = 0
    for sentence in sentences:
        sw = sentence.split()
        if len(sw) > MAX_WORDS:
            if buf:
                groups.append(" ".join(buf))
                buf, count = [], 0
            for start in range(0, len(sw), MAX_WORDS):
                groups.append(" ".join(sw[start : start + MAX_WORDS]))
            continue
        if count + len(sw) > MAX_WORDS and buf:
            groups.append(" ".join(buf))
            buf, count = [], 0
        buf.append(sentence)
        count += len(sw)
    if buf:
        groups.append(" ".join(buf))
    return groups


def _scene_lines(scene: dict) -> list[dict]:
    if "lines" in scene:
        return list(scene["lines"])
    if "spoken" in scene or "display" in scene:
        return [scene]
    return []


def build_chunks(scenes: dict, lexicon: dict, raw: bool = False) -> list[dict]:
    """Group short lines so Kokoro is not handed a handful of tokens."""
    chunks: list[dict] = []
    voice = scenes.get("voice") or DEFAULT_VOICE
    speed = float(scenes.get("speed") or 1.0)
    for scene in scenes.get("scenes", []):
        scene_id = str(scene.get("id") or f"scene-{len(chunks)}")
        pending: list[dict] = []

        def flush() -> None:
            if not pending:
                return
            spoken = " ".join(item["spoken"] for item in pending).strip()
            display = " ".join(item["display"] for item in pending).strip()
            chunks.append(
                {
                    "id": f"{scene_id}-{len([c for c in chunks if c['scene_id'] == scene_id])}",
                    "scene_id": scene_id,
                    "line_indexes": [item["index"] for item in pending],
                    "spoken": spoken,
                    "display": display,
                    "voice": voice,
                    "speed": speed,
                }
            )
            pending.clear()

        for index, line in enumerate(_scene_lines(scene)):
            spoken = str(line.get("spoken", ""))
            if not raw:
                spoken = normalize_spoken(spoken, lexicon)
                line["spoken"] = spoken
            display = str(line.get("display", ""))
            pieces = _split_long(spoken) or [""]
            for part_i, part in enumerate(pieces):
                item = {
                    "spoken": part,
                    "display": display if part_i == 0 else "",
                    "index": index,
                }
                if len(part.split()) > MAX_WORDS:
                    flush()
                    pending.append(item)
                    flush()
                    continue
                pending_words = sum(len(p["spoken"].split()) for p in pending)
                if pending and pending_words + len(part.split()) > MAX_WORDS:
                    flush()
                pending.append(item)
                if sum(len(p["spoken"].split()) for p in pending) >= MIN_TOKENS:
                    flush()
        flush()
    for chunk in chunks:
        chunk["hash"] = chunk_hash(chunk["spoken"], chunk["voice"], chunk["speed"])
    return chunks


def _wav_duration(path: Path) -> float:
    import soundfile as sf

    info = sf.info(str(path))
    return info.frames / info.samplerate


def _write_wav(path: Path, audio) -> None:
    import soundfile as sf

    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, SAMPLE_RATE)


def _concat(paths: list[Path], dest: Path):
    import numpy as np
    import soundfile as sf

    parts = [sf.read(str(path), dtype="float32")[0] for path in paths]
    audio = np.concatenate(parts) if parts else np.zeros(SAMPLE_RATE // 10, dtype=np.float32)
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(dest), audio, SAMPLE_RATE)
    return audio


def _to_mp3(wav: Path) -> Path | None:
    if shutil.which("ffmpeg") is None:
        return None
    mp3 = wav.with_suffix(".mp3")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ar", "44100", str(mp3)],
            check=True,
        )
    except subprocess.CalledProcessError:
        return None
    return mp3


def _track_ts(audio_file: str, length_s: float, per_segment: dict[str, list[float]]) -> str:
    timing = json.dumps({"perSegment": per_segment}, indent=2)
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        'import type { AudioTrack } from "videowright";\n\n'
        "const track: AudioTrack = {\n"
        f'\taudio_file: "{audio_file}",\n'
        f"\tlength_s: {length_s},\n"
        f"\ttiming: {timing},\n"
        f'\tcreated_at: "{created}",\n'
        '\tnotes: "Local Kokoro 82M, voice af_heart, 24 kHz. Generated from scenes.json.",\n'
        "};\n\nexport default track;\n"
    )


def run(scenes_path: Path, out_dir: Path, lexicon_path: Path | None = None, raw: bool = False) -> dict:
    lexicon = {} if raw else load_lexicon(lexicon_path)
    scenes = load_scenes(scenes_path)
    chunks = build_chunks(scenes, lexicon, raw=raw)
    if not raw:
        write_json(scenes_path, scenes)

    cache = out_dir / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    for chunk in chunks:
        wav = cache / f"{chunk['hash']}.wav"
        chunk["audio"] = str(wav)
        if wav.exists() and wav.stat().st_size > 0:
            chunk["cached"] = True
            chunk["duration"] = round(_wav_duration(wav), 3)
            continue
        audio = synthesize_array(chunk["spoken"], chunk["voice"], chunk["speed"])
        _write_wav(wav, audio)
        chunk["cached"] = False
        chunk["duration"] = round(len(audio) / SAMPLE_RATE, 3)

    per_segment: dict[str, list[float]] = {}
    cursor: dict[str, float] = {}
    for chunk in chunks:
        scene_id = chunk["scene_id"]
        cursor[scene_id] = round(cursor.get(scene_id, 0.0) + chunk["duration"], 3)
        per_segment.setdefault(scene_id, []).append(cursor[scene_id])
        chunk["advance"] = cursor[scene_id]

    voiceovers = {}
    for scene in scenes.get("scenes", []):
        scene_id = str(scene.get("id"))
        spoken = " ".join(chunk["spoken"] for chunk in chunks if chunk["scene_id"] == scene_id).strip()
        voiceovers[scene_id] = spoken

    track_wav = out_dir / "audio" / "tracks" / "v1" / "track.wav"
    _concat([Path(chunk["audio"]) for chunk in chunks], track_wav)
    audio_path = track_wav
    mp3 = _to_mp3(track_wav)
    if mp3 is not None:
        audio_path = mp3
    length_s = round(sum(chunk["duration"] for chunk in chunks), 3)
    rel_audio = "./audio/tracks/v1/" + audio_path.name
    track_path = out_dir / "audio" / "tracks" / "v1" / "track.ts"
    track_path.write_text(_track_ts(rel_audio, length_s, per_segment), encoding="utf-8")

    durations = {
        "voice": scenes.get("voice") or DEFAULT_VOICE,
        "speed": float(scenes.get("speed") or 1.0),
        "length_s": length_s,
        "audio_file": rel_audio,
        "voiceovers": voiceovers,
        "per_segment": per_segment,
        "chunks": chunks,
    }
    write_json(out_dir / "durations.json", durations)
    return durations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Synthesize scenes.json with Kokoro")
    parser.add_argument("scenes", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--lexicon", type=Path, default=None)
    parser.add_argument("--raw", action="store_true", help="Speak the text exactly (audition only)")
    args = parser.parse_args(argv)
    durations = run(args.scenes, args.out, args.lexicon, raw=args.raw)
    summary = {
        "length_s": durations["length_s"],
        "chunks": [
            {
                "id": chunk["id"],
                "cached": chunk["cached"],
                "duration": chunk["duration"],
                "spoken": chunk["spoken"],
            }
            for chunk in durations["chunks"]
        ],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
