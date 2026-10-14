#!/usr/bin/env python3
"""Build runtime card ratings from official 17Lands public CSV files."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


GRADE_BAND_WIDTH = 0.33
GRADES = ("F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+")
C_GRADE_INDEX = GRADES.index("C")
DEFAULT_MIN_GIH_OBSERVATIONS = 500
PUBLIC_CARD_LIST_URL = (
    "https://17lands-public.s3.amazonaws.com/analysis_data/cards/cards.csv"
)


@dataclass(frozen=True)
class CardColumns:
    name: str
    opening_hand: int
    drawn: int


@dataclass
class CardStats:
    games_in_hand: int = 0
    wins_in_hand: int = 0

    @property
    def win_rate(self) -> float | None:
        if self.games_in_hand == 0:
            return None
        return self.wins_in_hand / self.games_in_hand


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a public 17Lands game-data CSV into runtime card-rating JSON.",
        epilog=f"Official public card list: {PUBLIC_CARD_LIST_URL}",
    )
    parser.add_argument("csv_path", type=Path, help="Public 17Lands game-data CSV")
    parser.add_argument(
        "card_list_path",
        type=Path,
        help="Official 17Lands public cards.csv helper file",
    )
    parser.add_argument("output_path", type=Path, help="Destination JSON file")
    parser.add_argument(
        "--card-expansions",
        nargs="+",
        required=True,
        help=(
            "Expansion codes to use for Arena IDs in priority order, "
            "for example ECL SPG"
        ),
    )
    parser.add_argument(
        "--min-gih-observations",
        type=int,
        default=DEFAULT_MIN_GIH_OBSERVATIONS,
        help=(
            "Minimum games-in-hand observations required for a rating "
            f"(default: {DEFAULT_MIN_GIH_OBSERVATIONS})"
        ),
    )
    return parser.parse_args()


def load_public_card_ids(
    path: Path, expansions: Sequence[str]
) -> dict[str, tuple[int, ...]]:
    requested_expansions = tuple(
        dict.fromkeys(
            expansion.strip().upper()
            for expansion in expansions
            if expansion.strip()
        )
    )
    if not requested_expansions:
        raise ValueError("At least one card expansion is required")

    ids_by_expansion: dict[str, dict[str, set[int]]] = {
        expansion: {} for expansion in requested_expansions
    }
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {"id", "expansion", "name", "is_booster"}
        missing_columns = required_columns - set(reader.fieldnames or ())
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"Missing required card-list columns: {missing}")

        for row_number, row in enumerate(reader, start=2):
            expansion = row["expansion"].upper()
            if expansion not in ids_by_expansion or row["is_booster"] != "True":
                continue

            name = row["name"].strip()
            try:
                arena_id = int(row["id"])
            except ValueError as error:
                raise ValueError(
                    f"Invalid Arena ID on card-list row {row_number}: {row['id']!r}"
                ) from error

            ids_by_expansion[expansion].setdefault(name, set()).add(arena_id)

    card_ids: dict[str, tuple[int, ...]] = {}
    for expansion in requested_expansions:
        for name, arena_ids in ids_by_expansion[expansion].items():
            card_ids.setdefault(name, tuple(sorted(arena_ids)))

    if not card_ids:
        requested = ", ".join(requested_expansions)
        raise ValueError(f"No booster cards found for expansions: {requested}")
    return card_ids


def find_card_columns(header: Sequence[str]) -> list[CardColumns]:
    column_indexes = {column: index for index, column in enumerate(header)}
    cards: list[CardColumns] = []

    for column, opening_hand_index in column_indexes.items():
        if not column.startswith("opening_hand_"):
            continue

        name = column.removeprefix("opening_hand_")
        drawn_column = f"drawn_{name}"
        if drawn_column not in column_indexes:
            raise ValueError(f"Missing required column {drawn_column!r}")

        cards.append(
            CardColumns(
                name=name,
                opening_hand=opening_hand_index,
                drawn=column_indexes[drawn_column],
            )
        )

    if not cards:
        raise ValueError("No opening_hand_<card> columns found")
    return cards


def parse_count(value: str) -> int:
    if not value or value == "0":
        return 0
    return int(value)


def collect_stats(csv_path: Path) -> tuple[dict[str, CardStats], int, str, str]:
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.reader(csv_file)
        try:
            header = next(reader)
        except StopIteration as error:
            raise ValueError(f"CSV is empty: {csv_path}") from error

        column_indexes = {column: index for index, column in enumerate(header)}
        try:
            won_index = column_indexes["won"]
            game_time_index = column_indexes["game_time"]
        except KeyError as error:
            raise ValueError(f"Missing required column {error.args[0]!r}") from error

        card_columns = find_card_columns(header)
        stats = {card.name: CardStats() for card in card_columns}
        row_count = 0
        first_game_time = ""
        last_game_time = ""

        for row_count, row in enumerate(reader, start=1):
            game_time = row[game_time_index]
            if not first_game_time or game_time < first_game_time:
                first_game_time = game_time
            if game_time > last_game_time:
                last_game_time = game_time

            won = row[won_index] == "True"
            for card in card_columns:
                copies_in_hand = parse_count(row[card.opening_hand]) + parse_count(row[card.drawn])
                if copies_in_hand == 0:
                    continue

                card_stats = stats[card.name]
                card_stats.games_in_hand += copies_in_hand
                if won:
                    card_stats.wins_in_hand += copies_in_hand

    return stats, row_count, first_game_time, last_game_time


def grade_for(win_rate: float, mean: float, standard_deviation: float) -> str:
    if standard_deviation == 0:
        return "C"

    z_score = (win_rate - mean) / standard_deviation
    offset = math.floor(z_score / GRADE_BAND_WIDTH + 0.5)
    grade_index = max(0, min(len(GRADES) - 1, C_GRADE_INDEX + offset))
    return GRADES[grade_index]


def build_output(
    card_ids: dict[str, tuple[int, ...]],
    stats: dict[str, CardStats],
    min_gih_observations: int,
) -> tuple[dict[str, dict[str, str | float | None]], float, float]:
    if min_gih_observations < 1:
        raise ValueError("Minimum GIH observations must be at least 1")

    valid_win_rates = [
        card_stats.win_rate
        for name, card_stats in stats.items()
        if name in card_ids and card_stats.games_in_hand >= min_gih_observations
    ]
    if not valid_win_rates:
        raise ValueError("No cards have games-in-hand observations")

    mean = statistics.fmean(valid_win_rates)
    standard_deviation = statistics.pstdev(valid_win_rates)
    output: dict[str, dict[str, str | float | None]] = {}

    cards_by_id = sorted(
        (arena_id, name)
        for name, arena_ids in card_ids.items()
        for arena_id in arena_ids
    )
    for mtga_id, name in cards_by_id:
        card_stats = stats.get(name)
        win_rate = (
            card_stats.win_rate
            if card_stats is not None and card_stats.games_in_hand >= min_gih_observations
            else None
        )
        output[str(mtga_id)] = {
            "name": name,
            "gihwr": round(win_rate, 3) if win_rate is not None else None,
            "grade": grade_for(win_rate, mean, standard_deviation) if win_rate is not None else None,
        }

    return output, mean, standard_deviation


def main() -> None:
    args = parse_args()
    stats, row_count, first_game_time, last_game_time = collect_stats(args.csv_path)
    available_card_ids = load_public_card_ids(
        args.card_list_path, args.card_expansions
    )

    missing_ids = sorted(set(stats) - set(available_card_ids))
    card_ids = {
        name: available_card_ids[name]
        for name in stats
        if name in available_card_ids
    }
    output, mean, standard_deviation = build_output(
        card_ids, stats, args.min_gih_observations
    )

    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    with args.output_path.open("w", encoding="utf-8") as output_file:
        json.dump(output, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    rated_count = sum(card["gihwr"] is not None for card in output.values())
    print(f"Processed {row_count:,} games from {first_game_time} through {last_game_time}")
    print(
        f"Wrote {len(output)} cards ({rated_count} rated, "
        f"minimum {args.min_gih_observations:,} GIH observations) to {args.output_path}"
    )
    print(f"Mean GIHWR: {mean:.6f}")
    print(f"Population standard deviation: {standard_deviation:.6f}")
    if missing_ids:
        print(f"CSV cards without Arena IDs: {', '.join(missing_ids)}")


if __name__ == "__main__":
    main()
