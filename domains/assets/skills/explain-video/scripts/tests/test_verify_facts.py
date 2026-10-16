#!/usr/bin/env python3
"""Coverage for the facts-ledger checker."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import verify_facts as vf  # noqa: E402


def run(display: list[str], ledger: dict, also: str | None = None):
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        scenes = {"scenes": [{"id": "s", "lines": [{"display": t, "spoken": t} for t in display]}]}
        (root / "scenes.json").write_text(json.dumps(scenes))
        (root / "facts.json").write_text(json.dumps(ledger))
        extra: list[Path] = []
        if also is not None:
            (root / "seg.ts").write_text(also)
            extra = [root / "seg.ts"]
        return vf.check(root / "scenes.json", root / "facts.json", extra)


def fact(**kw):
    base = {"id": "F1", "shown": "9.3%", "kind": "verbatim", "source": "§10.1"}
    base.update(kw)
    return base


class VerifyFactsTest(unittest.TestCase):
    def test_sourced_number_passes(self) -> None:
        errors, warnings = run(["Conversion is about 9.3% today."], {"facts": [fact()]})
        self.assertEqual((errors, warnings), ([], []))

    def test_unsourced_number_fails(self) -> None:
        errors, _ = run(["Conversion is about 12% today."], {"facts": [fact()]})
        self.assertTrue(any("'12%'" in e for e in errors))

    def test_allow_list_covers_counts(self) -> None:
        errors, _ = run(["Three pillars and 3 phases."], {"facts": [], "allow": ["3"]})
        self.assertEqual(errors, [])

    def test_identifiers_are_not_numbers(self) -> None:
        errors, _ = run(["Ships in Q1 with v2 and F1."], {"facts": []})
        self.assertEqual(errors, [])

    def test_year_needs_a_fact(self) -> None:
        errors, _ = run(["Ships in Oct 2026."], {"facts": []})
        self.assertTrue(any("2026" in e for e in errors))
        errors, _ = run(["Ships in Oct 2026."], {"facts": [fact(shown="Oct 2026")]})
        self.assertEqual(errors, [])

    def test_commas_and_spaces_ignored(self) -> None:
        errors, _ = run(["Volume was $1,400 M."], {"facts": [fact(shown="$1400M")]})
        self.assertEqual(errors, [])

    def test_derived_needs_derivation(self) -> None:
        errors, _ = run(["Total $41.25M."], {"facts": [fact(shown="$41.25M", kind="derived")]})
        self.assertTrue(any("derivation" in e for e in errors))
        errors, _ = run(
            ["Total $41.25M."],
            {"facts": [fact(shown="$41.25M", kind="derived", derivation="28.5 + 12.75")]},
        )
        self.assertEqual(errors, [])

    def test_external_needs_attribution(self) -> None:
        errors, _ = run(["Earned $39M."], {"facts": [fact(shown="$39M", kind="external")]})
        self.assertTrue(any("attribution" in e for e in errors))

    def test_bad_kind_and_missing_fields(self) -> None:
        errors, _ = run(["x"], {"facts": [fact(kind="rumour")]})
        self.assertTrue(any("kind" in e for e in errors))
        errors, _ = run(["x"], {"facts": [{"id": "F2", "shown": "1"}]})
        self.assertTrue(any("missing" in e for e in errors))

    def test_unresolved_discrepancy_fails(self) -> None:
        ledger = {"facts": [], "discrepancies": [{"topic": "earnings", "values": ["$55M", "$41.25M"], "resolution": ""}]}
        errors, _ = run(["No numbers here."], ledger)
        self.assertTrue(any("no resolution" in e for e in errors))

    def test_unused_fact_warns(self) -> None:
        _, warnings = run(["No numbers here."], {"facts": [fact()]})
        self.assertTrue(any("never appears" in w for w in warnings))

    def test_segment_files_are_scanned(self) -> None:
        seg = '<div style="font-size:44px;">78% of swaps</div><span>${card("x")}</span>'
        errors, _ = run(["Nothing numeric."], {"facts": []}, also=seg)
        self.assertTrue(any("'78%'" in e for e in errors))
        errors, _ = run(["Nothing numeric."], {"facts": [fact(shown="78%")]}, also=seg)
        self.assertEqual(errors, [])

    def test_section_references_are_citations(self) -> None:
        seg = '<span>SOURCE · PRD §0.1, §14 and §2.2</span>'
        errors, _ = run(["Nothing numeric."], {"facts": []}, also=seg)
        self.assertEqual(errors, [])

    def test_markup_numbers_are_ignored(self) -> None:
        seg = '<div style="padding:24px;width:1920px" class="c12">hello</div>'
        errors, _ = run(["Nothing numeric."], {"facts": []}, also=seg)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
