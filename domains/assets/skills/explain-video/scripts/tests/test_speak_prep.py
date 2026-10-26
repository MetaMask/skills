#!/usr/bin/env python3
"""Normalizer coverage for the explain-video pronunciation pipeline."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import speak_prep as sp  # noqa: E402
import verify_audio as va  # noqa: E402


LEXICON = sp.load_lexicon()


class SpeakPrepTest(unittest.TestCase):
    def test_on_after_change(self) -> None:
        self.assertEqual(sp.normalize_spoken("onAfterChange", {}), "on after change")

    def test_get_user_info(self) -> None:
        self.assertEqual(sp.normalize_spoken("getUserInfo", {}), "get user info")

    def test_http_server(self) -> None:
        self.assertEqual(sp.normalize_spoken("HTTPServer", {}), "H T T P server")

    def test_snake_case(self) -> None:
        self.assertEqual(sp.normalize_spoken("snake_case_name", {}), "snake case name")

    def test_api(self) -> None:
        self.assertEqual(sp.normalize_spoken("API", {}), "A P I")

    def test_ts_extension(self) -> None:
        self.assertEqual(sp.normalize_spoken(".ts", {}), "dot T S")

    def test_equals(self) -> None:
        self.assertEqual(sp.normalize_spoken("==", {}), "equals equals")

    def test_sentence(self) -> None:
        raw = "onAfterChange in HTTPServer.ts"
        expected = "on after change in H T T P server dot T S"
        self.assertEqual(sp.normalize_spoken(raw, {}), expected)

    def test_lexicon_override(self) -> None:
        custom = {"API": {"spoken": "ay pee eye"}}
        self.assertEqual(sp.normalize_spoken("Use the API now", custom), "Use the ay pee eye now")
        self.assertEqual(sp.normalize_spoken("TanStack", LEXICON), "tan-stack")
        self.assertEqual(sp.normalize_spoken("EVM", LEXICON), "E V M")

    def test_id_is_abbreviation(self) -> None:
        marked = "[id](/ˌIˈdi/)"
        self.assertEqual(sp.normalize_spoken("id", LEXICON), marked)
        self.assertEqual(sp.normalize_spoken("ID", LEXICON), "[ID](/ˌIˈdi/)")
        self.assertEqual(sp.normalize_spoken("userId", LEXICON), f"user {marked}")
        self.assertEqual(sp.normalize_spoken("chain_id", LEXICON), f"chain {marked}")
        self.assertEqual(sp.normalize_spoken("valid identity", LEXICON), "valid identity")
        self.assertEqual(sp.normalize_spoken("I'd rather", LEXICON), "I'd rather")
        self.assertEqual(sp.normalize_spoken(marked, LEXICON), marked)

    def test_phoneme_override(self) -> None:
        custom = {"API": {"spoken": "A P I", "phonemes": "ˌeɪ p i"}}
        marked = "[API](/ˌeɪ p i/)"
        self.assertEqual(sp.normalize_spoken("API", custom), marked)
        self.assertEqual(sp.normalize_spoken(marked, custom), marked)

    def test_idempotence(self) -> None:
        samples = [
            "onAfterChange",
            "getUserInfo",
            "HTTPServer",
            "snake_case_name",
            "API",
            ".ts",
            "==",
            "onAfterChange in HTTPServer.ts",
            "Use the API beside TanStack and EVM",
            "prefetch the launchpad",
            "userId",
            "the id",
        ]
        for sample in samples:
            once = sp.normalize_spoken(sample, LEXICON)
            twice = sp.normalize_spoken(once, LEXICON)
            self.assertEqual(once, twice, sample)

    def test_scenes_file_idempotence(self) -> None:
        scenes = {
            "scenes": [
                {
                    "id": "one",
                    "lines": [
                        {
                            "display": "onAfterChange in HTTPServer.ts",
                            "spoken": "onAfterChange in HTTPServer.ts",
                        }
                    ],
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "scenes.json"
            path.write_text(json.dumps(scenes), encoding="utf-8")
            self.assertEqual(sp.main([str(path), "--lexicon", str(sp.DEFAULT_LEXICON)]), 0)
            first = path.read_text(encoding="utf-8")
            self.assertEqual(sp.main([str(path), "--lexicon", str(sp.DEFAULT_LEXICON)]), 0)
            self.assertEqual(path.read_text(encoding="utf-8"), first)
            data = json.loads(first)
            self.assertEqual(
                data["scenes"][0]["lines"][0]["spoken"],
                "on after change in H T T P server dot T S",
            )

    def test_unknowns_skip_lexicon_and_english(self) -> None:
        scenes = {
            "scenes": [
                {
                    "id": "one",
                    "lines": [
                        {"display": "onAfterChange API EVM the", "spoken": ""},
                        {"display": "onAfterChange", "spoken": ""},
                    ],
                }
            ]
        }
        rows = sp.collect_unknowns(scenes, LEXICON)
        tokens = [row["token"] for row in rows]
        self.assertEqual(tokens, ["onAfterChange", "API"])
        self.assertEqual(rows[0]["count"], 2)
        self.assertEqual(rows[0]["spoken"], "on after change")
        self.assertNotIn("EVM", tokens)
        self.assertNotIn("the", tokens)

    def test_whisper_autocorrect_matches_spoken(self) -> None:
        expected = "on after change in H T T P server dot T S"
        heard = "on Afterchange in HTTP Server.ts"
        self.assertEqual(va.mismatched_tokens(expected, heard), [])


if __name__ == "__main__":
    unittest.main()
