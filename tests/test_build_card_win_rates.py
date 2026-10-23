import csv
import tempfile
import unittest
from pathlib import Path

from scripts.build_card_win_rates import (
    CardDisplayMetadata,
    CardStats,
    build_output,
    collect_stats,
    find_card_columns,
    grade_for,
    load_public_card_ids,
)


class LoadPublicCardIdsTests(unittest.TestCase):
    def test_loads_booster_ids_and_prefers_the_first_matching_expansion(self) -> None:
        rows = [
            [101, "TST", "Alpha", "True"],
            [102, "TST", "Alpha", "True"],
            [999, "SPG", "Alpha", "True"],
            [103, "SPG", "Beta", "True"],
            [104, "TST", "Not in boosters", "False"],
            [105, "OTHER", "Other set", "True"],
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "cards.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["id", "expansion", "name", "is_booster"])
                writer.writerows(rows)

            self.assertEqual(
                load_public_card_ids(path, ["TST", "SPG"]),
                {"Alpha": (101, 102), "Beta": (103,)},
            )

    def test_rejects_invalid_arena_ids(self) -> None:
        rows = [["invalid", "TST", "Alpha", "True"]]

        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "cards.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["id", "expansion", "name", "is_booster"])
                writer.writerows(rows)

            with self.assertRaisesRegex(ValueError, "Invalid Arena ID"):
                load_public_card_ids(path, ["TST"])


class CsvAggregationTests(unittest.TestCase):
    def test_collects_copy_weighted_gih_stats_and_ignores_tutored_cards(self) -> None:
        header = [
            "game_time",
            "won",
            "opening_hand_Alpha",
            "drawn_Alpha",
            "tutored_Alpha",
            "opening_hand_Beta",
            "drawn_Beta",
        ]
        rows = [
            ["2026-01-02 10:00:00", "True", "1", "2", "5", "0", "0"],
            ["2026-01-01 10:00:00", "False", "0", "1", "0", "2", "1"],
            ["2026-01-03 10:00:00", "True", "0", "0", "0", "0", "1"],
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "games.csv"
            with path.open("w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(header)
                writer.writerows(rows)

            stats, row_count, first_game, last_game = collect_stats(path)

        self.assertEqual(row_count, 3)
        self.assertEqual(first_game, "2026-01-01 10:00:00")
        self.assertEqual(last_game, "2026-01-03 10:00:00")
        self.assertEqual(stats["Alpha"].games_in_hand, 4)
        self.assertEqual(stats["Alpha"].wins_in_hand, 3)
        self.assertEqual(stats["Alpha"].win_rate, 0.75)
        self.assertEqual(stats["Beta"].games_in_hand, 4)
        self.assertEqual(stats["Beta"].wins_in_hand, 1)
        self.assertEqual(stats["Beta"].win_rate, 0.25)

    def test_requires_a_drawn_column_for_every_card(self) -> None:
        with self.assertRaisesRegex(ValueError, "drawn_Alpha"):
            find_card_columns(["won", "game_time", "opening_hand_Alpha"])

    def test_requires_at_least_one_card(self) -> None:
        with self.assertRaisesRegex(ValueError, "No opening_hand"):
            find_card_columns(["won", "game_time"])


class GradeTests(unittest.TestCase):
    def test_centers_the_c_band_on_the_mean(self) -> None:
        mean = 0.5
        standard_deviation = 0.1

        self.assertEqual(grade_for(mean, mean, standard_deviation), "C")
        self.assertEqual(grade_for(mean + 0.164 * standard_deviation, mean, standard_deviation), "C")
        self.assertEqual(grade_for(mean + 0.166 * standard_deviation, mean, standard_deviation), "C+")
        self.assertEqual(grade_for(mean - 0.164 * standard_deviation, mean, standard_deviation), "C")
        self.assertEqual(grade_for(mean - 0.166 * standard_deviation, mean, standard_deviation), "C-")

    def test_clamps_extreme_values_and_handles_zero_spread(self) -> None:
        self.assertEqual(grade_for(1.0, 0.5, 0.1), "A+")
        self.assertEqual(grade_for(0.0, 0.5, 0.1), "F")
        self.assertEqual(grade_for(0.5, 0.5, 0.0), "C")


class BuildOutputTests(unittest.TestCase):
    def test_includes_display_metadata_used_by_the_overlay(self) -> None:
        card_ids = {"Alpha": (100,)}
        stats = {"Alpha": CardStats(games_in_hand=500, wins_in_hand=250)}
        metadata = {
            "Alpha": CardDisplayMetadata(
                rarity="common", color="W", mana_value=3, is_land=False
            )
        }

        output, _, _ = build_output(card_ids, stats, 500, metadata)

        self.assertEqual(output["100"]["manaValue"], 3)

    def test_uses_population_statistics_and_nulls_cards_below_the_threshold(self) -> None:
        card_ids = {
            "Alpha": (200,),
            "Beta": (100,),
            "Gamma": (300,),
            "Delta": (400,),
        }
        stats = {
            "Alpha": CardStats(games_in_hand=600, wins_in_hand=360),
            "Beta": CardStats(games_in_hand=500, wins_in_hand=250),
            "Gamma": CardStats(games_in_hand=499, wins_in_hand=499),
        }

        output, mean, standard_deviation = build_output(card_ids, stats, 500)

        self.assertAlmostEqual(mean, 0.55)
        self.assertAlmostEqual(standard_deviation, 0.05)
        self.assertEqual(list(output), ["100", "200", "300", "400"])
        self.assertEqual(output["100"], {"name": "Beta", "gihwr": 0.5, "grade": "D"})
        self.assertEqual(output["200"], {"name": "Alpha", "gihwr": 0.6, "grade": "B"})
        self.assertEqual(output["300"], {"name": "Gamma", "gihwr": None, "grade": None})
        self.assertEqual(output["400"], {"name": "Delta", "gihwr": None, "grade": None})

    def test_rejects_invalid_or_unmet_observation_thresholds(self) -> None:
        card_ids = {"Alpha": (100,)}
        stats = {"Alpha": CardStats(games_in_hand=10, wins_in_hand=5)}

        with self.assertRaisesRegex(ValueError, "must be at least 1"):
            build_output(card_ids, stats, 0)
        with self.assertRaisesRegex(ValueError, "No cards"):
            build_output(card_ids, stats, 11)


if __name__ == "__main__":
    unittest.main()
