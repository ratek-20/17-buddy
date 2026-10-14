import csv
import tempfile
import unittest
from pathlib import Path

from scripts.build_card_data_from_ui import (
    UiCardStats,
    build_ui_output,
    grade_for_rounded_win_rate,
    load_ui_stats,
)


class LoadUiStatsTests(unittest.TestCase):
    def test_loads_observation_counts_percentages_and_missing_win_rates(self) -> None:
        rows = [
            ["Alpha", "1,234", "60.0%"],
            ["Beta", "0", ""],
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "card-data.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["Name", "# GIH", "GIH WR"])
                writer.writerows(rows)

            stats = load_ui_stats(path)

        self.assertEqual(stats["Alpha"], UiCardStats(1234, 0.6))
        self.assertEqual(stats["Beta"], UiCardStats(0, None))

    def test_rejects_duplicate_card_names(self) -> None:
        rows = [
            ["Alpha", "500", "50.0%"],
            ["Alpha", "600", "60.0%"],
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "card-data.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["Name", "# GIH", "GIH WR"])
                writer.writerows(rows)

            with self.assertRaisesRegex(ValueError, "Duplicate card name"):
                load_ui_stats(path)

    def test_rejects_malformed_win_rates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "card-data.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["Name", "# GIH", "GIH WR"])
                writer.writerow(["Alpha", "500", "50.0"])

            with self.assertRaisesRegex(ValueError, "Invalid GIH WR"):
                load_ui_stats(path)


class BuildUiOutputTests(unittest.TestCase):
    def test_builds_ratings_and_nulls_cards_below_the_threshold(self) -> None:
        card_ids = {
            "Alpha": (200, 201),
            "Beta": (100,),
            "Gamma": (300,),
            "No Win Rate": (400,),
        }
        stats = {
            "Alpha": UiCardStats(games_in_hand=600, win_rate=0.6),
            "Beta": UiCardStats(games_in_hand=500, win_rate=0.5),
            "Gamma": UiCardStats(games_in_hand=499, win_rate=0.9),
            "No Win Rate": UiCardStats(games_in_hand=600, win_rate=None),
        }

        output, mean, standard_deviation = build_ui_output(card_ids, stats, 500)

        self.assertAlmostEqual(mean, 0.55)
        self.assertAlmostEqual(standard_deviation, 0.05)
        self.assertEqual(list(output), ["100", "200", "201", "300", "400"])
        self.assertEqual(output["100"], {"name": "Beta", "gihwr": 0.5, "grade": "D"})
        self.assertEqual(output["200"], {"name": "Alpha", "gihwr": 0.6, "grade": "B"})
        self.assertEqual(output["201"], output["200"])
        self.assertEqual(output["300"], {"name": "Gamma", "gihwr": None, "grade": None})
        self.assertEqual(
            output["400"],
            {"name": "No Win Rate", "gihwr": None, "grade": None},
        )

    def test_rejects_an_unmet_observation_threshold(self) -> None:
        card_ids = {"Alpha": (100,)}
        stats = {"Alpha": UiCardStats(games_in_hand=499, win_rate=0.5)}

        with self.assertRaisesRegex(ValueError, "No cards"):
            build_ui_output(card_ids, stats, 500)


class RoundedGradeTests(unittest.TestCase):
    def test_moves_a_rounded_win_rate_toward_the_mean_before_grading(self) -> None:
        self.assertEqual(grade_for_rounded_win_rate(0.516, 0.5, 0.1), "C")
        self.assertEqual(grade_for_rounded_win_rate(0.517, 0.5, 0.1), "C+")


if __name__ == "__main__":
    unittest.main()
