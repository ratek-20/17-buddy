#!/usr/bin/env python3
"""Build runtime card ratings from a manually exported 17Lands Card Data CSV."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
from dataclasses import dataclass
from pathlib import Path

if __package__:
    from .build_card_data import (
        DEFAULT_MIN_GIH_OBSERVATIONS,
        PUBLIC_CARD_LIST_URL,
        grade_for,
        load_public_card_ids,
    )
else:
    from build_card_data import (
        DEFAULT_MIN_GIH_OBSERVATIONS,
        PUBLIC_CARD_LIST_URL,
        grade_for,
        load_public_card_ids,
    )


UI_WIN_RATE_ROUNDING_MARGIN = 0.0005


@dataclass(frozen=True)
class UiCardStats:
    games_in_hand: int
    win_rate: float | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert a manually exported 17Lands Card Data CSV into runtime "
            "card-rating JSON."
        ),
        epilog=f"Official public card list: {PUBLIC_CARD_LIST_URL}",
    )
    parser.add_argument("csv_path", type=Path, help="CSV exported from Card Data")
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
            "for example FRA SPG"
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


def load_ui_stats(path: Path) -> dict[str, UiCardStats]:
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {"Name", "# GIH", "GIH WR"}
        missing_columns = required_columns - set(reader.fieldnames or ())
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"Missing required CSV columns: {missing}")

        stats: dict[str, UiCardStats] = {}
        for row_number, row in enumerate(reader, start=2):
            name = row["Name"].strip()
            if not name:
                raise ValueError(f"Missing card name on CSV row {row_number}")
            if name in stats:
                raise ValueError(f"Duplicate card name on CSV row {row_number}: {name!r}")

            stats[name] = UiCardStats(
                games_in_hand=parse_observation_count(row["# GIH"], row_number),
                win_rate=parse_win_rate(row["GIH WR"], row_number),
            )

    if not stats:
        raise ValueError(f"CSV contains no cards: {path}")
    return stats


def parse_observation_count(value: str, row_number: int) -> int:
    normalized_value = value.strip().replace(",", "")
    try:
        count = int(normalized_value)
    except ValueError as error:
        raise ValueError(
            f"Invalid # GIH value on CSV row {row_number}: {value!r}"
        ) from error

    if count < 0:
        raise ValueError(f"Negative # GIH value on CSV row {row_number}: {value!r}")
    return count


def parse_win_rate(value: str, row_number: int) -> float | None:
    normalized_value = value.strip()
    if not normalized_value:
        return None
    if not normalized_value.endswith("%"):
        raise ValueError(
            f"Invalid GIH WR value on CSV row {row_number}: {value!r}"
        )

    try:
        win_rate = float(normalized_value.removesuffix("%")) / 100
    except ValueError as error:
        raise ValueError(
            f"Invalid GIH WR value on CSV row {row_number}: {value!r}"
        ) from error

    if not 0 <= win_rate <= 1:
        raise ValueError(
            f"GIH WR outside the 0%-100% range on CSV row {row_number}: {value!r}"
        )
    return win_rate


def build_ui_output(
    card_ids: dict[str, tuple[int, ...]],
    stats: dict[str, UiCardStats],
    min_gih_observations: int,
) -> tuple[dict[str, dict[str, str | float | None]], float, float]:
    if min_gih_observations < 1:
        raise ValueError("Minimum GIH observations must be at least 1")

    valid_win_rates = [
        card_stats.win_rate
        for name, card_stats in stats.items()
        if name in card_ids
        and card_stats.games_in_hand >= min_gih_observations
        and card_stats.win_rate is not None
    ]
    if not valid_win_rates:
        raise ValueError("No cards have GIH win rates at the requested threshold")

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
            if card_stats is not None
            and card_stats.games_in_hand >= min_gih_observations
            else None
        )
        output[str(mtga_id)] = {
            "name": name,
            "gihwr": round(win_rate, 3) if win_rate is not None else None,
            "grade": (
                grade_for_rounded_win_rate(win_rate, mean, standard_deviation)
                if win_rate is not None
                else None
            ),
        }

    return output, mean, standard_deviation


def grade_for_rounded_win_rate(
    win_rate: float, mean: float, standard_deviation: float
) -> str:
    """Grade a UI value rounded to the nearest 0.1 percentage point."""
    if win_rate > mean:
        adjusted_win_rate = max(mean, win_rate - UI_WIN_RATE_ROUNDING_MARGIN)
    elif win_rate < mean:
        adjusted_win_rate = min(mean, win_rate + UI_WIN_RATE_ROUNDING_MARGIN)
    else:
        adjusted_win_rate = win_rate

    return grade_for(adjusted_win_rate, mean, standard_deviation)


def main() -> None:
    args = parse_args()
    stats = load_ui_stats(args.csv_path)
    available_card_ids = load_public_card_ids(
        args.card_list_path, args.card_expansions
    )
    missing_ids = sorted(set(stats) - set(available_card_ids))

    if missing_ids:
        raise ValueError(
            "CSV cards without Arena IDs: " + ", ".join(missing_ids)
        )

    card_ids = {name: available_card_ids[name] for name in stats}
    output, mean, standard_deviation = build_ui_output(
        card_ids, stats, args.min_gih_observations
    )

    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    with args.output_path.open("w", encoding="utf-8") as output_file:
        json.dump(output, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    rated_names = {
        card["name"] for card in output.values() if card["gihwr"] is not None
    }
    print(f"Read {len(stats)} cards from {args.csv_path}")
    print(
        f"Wrote {len(output)} Arena IDs for {len(stats)} cards "
        f"({len(rated_names)} rated, "
        f"minimum {args.min_gih_observations:,} GIH observations) to {args.output_path}"
    )
    print(f"Mean GIHWR: {mean:.6f}")
    print(f"Population standard deviation: {standard_deviation:.6f}")


if __name__ == "__main__":
    main()
