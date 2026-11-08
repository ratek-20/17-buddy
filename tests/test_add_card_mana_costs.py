import json
import tempfile
import unittest
from pathlib import Path

from scripts.add_card_mana_costs import add_mana_costs, load_mana_costs


class ManaCostsTests(unittest.TestCase):
    def test_loads_english_costs_including_front_faces_and_lands(self) -> None:
        records = [
            {"name": "Rabbit Response", "lang": "en", "arena_id": 1, "mana_cost": "{2}{W}{W}"},
            {"name": "Rabbit Response", "lang": "it", "mana_cost": "{9}"},
            {"name": "Rabbit Response // Rabbit Response", "lang": "en", "layout": "art_series",
             "card_faces": [{"name": "Rabbit Response", "mana_cost": ""}]},
            {"name": "Island", "lang": "en", "arena_id": 2, "mana_cost": ""},
            {"name": "Day // Night", "lang": "en", "arena_id": 3, "card_faces": [
                {"name": "Day", "mana_cost": "{1}{U}"},
                {"name": "Night", "mana_cost": ""},
            ]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bulk.jsonl"
            path.write_text("\n".join(json.dumps(record) for record in records))
            costs = load_mana_costs(path, {"Rabbit Response", "Island", "Day"})

        self.assertEqual(costs[("1", "Rabbit Response")], {"{2}{W}{W}"})
        self.assertEqual(costs[("2", "Island")], {""})
        self.assertEqual(costs[("3", "Day")], {"{1}{U}"})

    def test_prefers_exact_id_and_name_then_unambiguous_name(self) -> None:
        cards = {
            "1": {"name": "Spell", "grade": "C"},
            "2": {"name": "Reprint"},
            "3": {"name": "Ambiguous"},
            "4": {"name": "Missing"},
        }
        costs = {
            ("1", "Spell"): {"{W}"},
            (None, "Spell"): {"{W}", "{U}"},
            ("2", "Different card"): {"{9}"},
            (None, "Reprint"): {"{2}{G}"},
            (None, "Ambiguous"): {"{R}", "{B}"},
        }
        enriched, missing = add_mana_costs(cards, costs)

        self.assertEqual(enriched["1"], {"name": "Spell", "grade": "C", "manaCost": "{W}"})
        self.assertEqual(enriched["2"]["manaCost"], "{2}{G}")
        self.assertEqual(missing, ["Ambiguous", "Missing"])
        self.assertEqual(cards["1"], {"name": "Spell", "grade": "C"})


if __name__ == "__main__":
    unittest.main()
