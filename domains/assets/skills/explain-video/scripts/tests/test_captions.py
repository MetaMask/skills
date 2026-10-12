#!/usr/bin/env python3
"""Caption cues must follow the audio, including numbers and hyphenated words."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import verify_audio as va  # noqa: E402


def words(spec: list[tuple[str, float, float]]) -> list[dict]:
    return [{"word": w, "start": s, "end": e} for w, s, e in spec]


# "It earned $41.25M over 30 days. Then we left." as spoken: the number is seven words.
HEARD = words(
    [
        ("It", 0.0, 0.2), ("earned", 0.2, 0.6), ("forty", 0.6, 0.9), ("one", 0.9, 1.1),
        ("point", 1.1, 1.3), ("two", 1.3, 1.5), ("five", 1.5, 1.8), ("million", 1.8, 2.2),
        ("dollars", 2.2, 2.6), ("over", 2.6, 2.8), ("thirty", 2.8, 3.2), ("days", 3.2, 3.6),
        ("Then", 4.4, 4.6), ("we", 4.6, 4.7), ("left", 4.7, 5.1),
    ]
)
DISPLAY = "It earned $41.25M over 30 days. Then we left."


class CaptionCueTest(unittest.TestCase):
    def test_text_is_never_ahead_of_the_voice(self) -> None:
        cues = va.caption_cues(HEARD, DISPLAY)
        text_to_start = {c["text"]: c["start"] for c in cues}
        # The sentence after the pause starts only when "Then" is spoken.
        then_cue = next(c for c in cues if c["text"].startswith("Then"))
        self.assertAlmostEqual(then_cue["start"], 4.4, places=2)
        # "30" is not shown before "thirty" is spoken.
        thirty = next(c for c in cues if "30" in c["text"])
        self.assertGreaterEqual(thirty["end"], 3.2)
        self.assertGreaterEqual(min(text_to_start.values()), 0.0)

    def test_number_cue_starts_with_the_number(self) -> None:
        cues = va.caption_cues(HEARD, DISPLAY)
        number = next(c for c in cues if "$41.25M" in c["text"])
        self.assertGreaterEqual(number["end"], 2.2)  # the voice finishes the number at ~2.6
        self.assertLessEqual(number["start"], 0.6)

    def test_every_display_word_appears_once_in_order(self) -> None:
        cues = va.caption_cues(HEARD, DISPLAY)
        self.assertEqual(" ".join(c["text"] for c in cues), DISPLAY)

    def test_cues_are_monotonic(self) -> None:
        cues = va.caption_cues(HEARD, DISPLAY)
        starts = [c["start"] for c in cues]
        self.assertEqual(starts, sorted(starts))
        for c in cues:
            self.assertLessEqual(c["start"], c["end"])

    def test_hyphenated_words_use_both_heard_words(self) -> None:
        heard = words([("out", 0.0, 0.2), ("earning", 0.2, 0.7), ("rivals", 0.7, 1.2)])
        cues = va.caption_cues(heard, "out-earning rivals")
        self.assertEqual(len(cues), 1)
        self.assertEqual((cues[0]["start"], cues[0]["end"]), (0.0, 1.2))

    def test_words_nobody_said_do_not_break_timing(self) -> None:
        heard = words([("one", 0.0, 0.3), ("three", 0.9, 1.2)])
        cues = va.caption_cues(heard, "one (two) three")
        self.assertEqual(" ".join(c["text"] for c in cues), "one (two) three")

    def test_long_line_splits_by_pause_and_length(self) -> None:
        spec = [(f"w{i}", i * 0.3, i * 0.3 + 0.25) for i in range(16)]
        display = " ".join(f"w{i}" for i in range(16))
        cues = va.caption_cues(words(spec), display)
        self.assertTrue(all(len(c["text"].split()) <= va.CUE_MAX_WORDS for c in cues))
        self.assertEqual(" ".join(c["text"] for c in cues), display)

    def test_cues_start_when_their_first_word_is_spoken(self) -> None:
        """Numbers expand to many spoken words; cues must still track the voice."""
        script = [
            ("Revenue", ["revenue"]),
            ("grew", ["grew"]),
            ("$1,250,000", ["one", "million", "two", "hundred", "and", "fifty", "thousand", "dollars"]),
            ("in", ["in"]),
            ("2026", ["twenty", "twenty", "six"]),
            ("and", ["and"]),
            ("costs", ["costs"]),
            ("fell", ["fell"]),
            ("12.5%", ["twelve", "point", "five", "percent"]),
            ("while", ["while"]),
            ("margin", ["margin"]),
            ("hit", ["hit"]),
            ("38%.", ["thirty", "eight", "percent"]),
            ("Nothing", ["nothing"]),
            ("else", ["else"]),
            ("changed.", ["changed"]),
        ]
        heard, truth, t = [], [], 0.0
        for shown, spoken in script:
            truth.append(t)
            for w in spoken:
                heard.append({"word": w, "start": round(t, 3), "end": round(t + 0.3, 3)})
                t += 0.3
        display = " ".join(shown for shown, _ in script)
        cues = va.caption_cues(heard, display)
        self.assertEqual(" ".join(c["text"] for c in cues), display)
        cursor = 0
        for cue in cues:
            first_index = cursor
            cursor += len(cue["text"].split())
            self.assertAlmostEqual(cue["start"], truth[first_index], delta=0.15, msg=cue["text"])

    def test_one_word_pause_is_not_an_orphan_cue(self) -> None:
        heard = words(
            [("half", 0.0, 0.3), ("that", 0.3, 0.6), ("they", 1.4, 1.6), ("would", 1.6, 1.9), ("still", 1.9, 2.3)]
        )
        cues = va.caption_cues(heard, "half that they would still")
        self.assertEqual([c["text"] for c in cues], ["half that", "they would still"])
        heard = words([("so", 0.0, 0.2), ("half", 1.0, 1.3), ("that", 1.3, 1.6)])
        cues = va.caption_cues(heard, "so half that")
        self.assertEqual([c["text"] for c in cues], ["so half that"])  # "so" is not left on its own
        self.assertEqual(cues[0]["start"], 0.0)

    def test_first_word_is_not_captioned_before_the_speech_starts(self) -> None:
        heard = words([("hello", 0.0, 0.4), ("world", 0.4, 0.9)])  # Whisper clamps the first word to 0.0
        clamped = va.clamp_to_onset(heard, onset=0.6)
        self.assertAlmostEqual(clamped[0]["start"], 0.57, places=2)
        cues = va.caption_cues(clamped, "hello world")
        self.assertAlmostEqual(cues[0]["start"], 0.57, places=2)
        self.assertEqual(va.clamp_to_onset(heard, onset=0.0)[0]["start"], 0.0)

    def test_speech_onset_measures_leading_silence(self) -> None:
        import math, struct, tempfile, wave

        rate = 24000
        silence = [0] * int(rate * 0.5)
        tone = [int(8000 * math.sin(2 * math.pi * 220 * i / rate)) for i in range(rate // 2)]
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "x.wav"
            with wave.open(str(path), "wb") as handle:
                handle.setnchannels(1)
                handle.setsampwidth(2)
                handle.setframerate(rate)
                handle.writeframes(struct.pack("<%dh" % (len(silence) + len(tone)), *(silence + tone)))
            self.assertAlmostEqual(va.speech_onset(path), 0.5, delta=0.02)
            self.assertEqual(va.speech_onset(Path(d) / "missing.wav"), 0.0)

    def test_empty_inputs(self) -> None:
        self.assertEqual(va.caption_cues([], ""), [])
        self.assertEqual(va.caption_cues([], "hello")[0]["text"], "hello")


if __name__ == "__main__":
    unittest.main()
