#!/usr/bin/env python3
"""Build runtime card win rates from official 17Lands public CSV files."""

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
COLOR_ORDER = "WUBRG"
PUBLIC_CARD_LIST_URL = (
    "https://17lands-public.s3.amazonaws.com/analysis_data/cards/cards.csv"
)


@dataclass(frozen=True)
class CardColumns:
    name: str
    opening_hand: int
    drawn: int


@dataclass(frozen=True)
class CardDisplayMetadata:
    rarity: str
    color: str
    mana_value: int
    is_land: bool


@dataclass(frozen=True)
class BasicLand:
    arena_id: int
    name: str
    metadata: CardDisplayMetadata


@dataclass
class CardStats:
    games_in_hand: int = 0
    wins_in_hand: int = 0

    @property
    def win_rate(self) -> float | None:
        if self.games_in_hand == 0:
            return None
        return self.wins_in_hand / self.games_in_hand


@dataclass(frozen=True)
class CollectedStats:
    overall: dict[str, CardStats]
    by_deck: dict[str, dict[str, CardStats]]
    row_count: int
    first_game_time: str
    last_game_time: str


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
            if (
                expansion not in ids_by_expansion
                or row["is_booster"] != "True"
                or row.get("rarity", "").lower() == "basic"
            ):
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


def load_public_card_metadata(
    path: Path, expansions: Sequence[str]
) -> dict[str, CardDisplayMetadata]:
    requested_expansions = tuple(
        dict.fromkeys(
            expansion.strip().upper()
            for expansion in expansions
            if expansion.strip()
        )
    )
    if not requested_expansions:
        raise ValueError("At least one card expansion is required")

    metadata_by_expansion: dict[str, dict[str, CardDisplayMetadata]] = {
        expansion: {} for expansion in requested_expansions
    }
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {
            "expansion",
            "name",
            "rarity",
            "color_identity",
            "mana_value",
            "types",
            "is_booster",
        }
        missing_columns = required_columns - set(reader.fieldnames or ())
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"Missing required card-list columns: {missing}")

        for row_number, row in enumerate(reader, start=2):
            expansion = row["expansion"].upper()
            if expansion not in metadata_by_expansion or row["is_booster"] != "True":
                continue

            try:
                mana_value = int(row["mana_value"])
            except ValueError as error:
                raise ValueError(
                    f"Invalid mana value on card-list row {row_number}: "
                    f"{row['mana_value']!r}"
                ) from error

            metadata_by_expansion[expansion].setdefault(
                row["name"].strip(),
                CardDisplayMetadata(
                    rarity=row["rarity"].lower(),
                    color=row["color_identity"].upper(),
                    mana_value=mana_value,
                    is_land="Land" in row["types"],
                ),
            )

    metadata: dict[str, CardDisplayMetadata] = {}
    for expansion in requested_expansions:
        for name, card_metadata in metadata_by_expansion[expansion].items():
            metadata.setdefault(name, card_metadata)

    return metadata


def load_public_basic_lands(
    path: Path, expansions: Sequence[str]
) -> tuple[BasicLand, ...]:
    requested_expansions = {
        expansion.strip().upper()
        for expansion in expansions
        if expansion.strip()
    }
    if not requested_expansions:
        raise ValueError("At least one card expansion is required")

    basic_lands: list[BasicLand] = []
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {
            "id",
            "expansion",
            "name",
            "rarity",
            "color_identity",
            "mana_value",
            "types",
            "is_booster",
        }
        missing_columns = required_columns - set(reader.fieldnames or ())
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"Missing required card-list columns: {missing}")

        for row_number, row in enumerate(reader, start=2):
            if (
                row["expansion"].upper() not in requested_expansions
                or row["is_booster"] != "True"
                or row["rarity"].lower() != "basic"
            ):
                continue

            try:
                arena_id = int(row["id"])
                mana_value = int(row["mana_value"])
            except ValueError as error:
                raise ValueError(
                    f"Invalid basic-land metadata on card-list row {row_number}"
                ) from error

            basic_lands.append(
                BasicLand(
                    arena_id=arena_id,
                    name=row["name"].strip(),
                    metadata=CardDisplayMetadata(
                        rarity="basic",
                        color=row["color_identity"].upper(),
                        mana_value=mana_value,
                        is_land=True,
                    ),
                )
            )

    return tuple(sorted(basic_lands, key=lambda card: card.arena_id))


def add_unrated_basic_lands(
    output: dict[str, dict[str, object]], basic_lands: Sequence[BasicLand]
) -> dict[str, dict[str, object]]:
    enriched_output = dict(output)
    for basic_land in basic_lands:
        metadata = basic_land.metadata
        enriched_output.setdefault(
            str(basic_land.arena_id),
            {
                "name": basic_land.name,
                "gihwr": None,
                "grade": None,
                "rarity": metadata.rarity,
                "color": metadata.color,
                "manaValue": metadata.mana_value,
                "isLand": metadata.is_land,
            },
        )

    return dict(sorted(enriched_output.items(), key=lambda item: int(item[0])))


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


def normalize_deck_colors(value: str) -> str | None:
    colors = set(value.strip().upper())
    if not colors or not colors.issubset(COLOR_ORDER):
        return None
    return "".join(color for color in COLOR_ORDER if color in colors)


def _collect_stats(csv_path: Path, include_deck_stats: bool) -> CollectedStats:
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
        main_colors_index = None
        if include_deck_stats:
            try:
                main_colors_index = column_indexes["main_colors"]
            except KeyError as error:
                raise ValueError("Missing required column 'main_colors'") from error

        stats_by_deck: dict[str, dict[str, CardStats]] = {}
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
            deck_stats = None
            if main_colors_index is not None:
                deck_colors = normalize_deck_colors(row[main_colors_index])
                if deck_colors is not None:
                    if deck_colors not in stats_by_deck:
                        stats_by_deck[deck_colors] = {
                            card.name: CardStats() for card in card_columns
                        }
                    deck_stats = stats_by_deck[deck_colors]

            for card in card_columns:
                copies_in_hand = parse_count(row[card.opening_hand]) + parse_count(row[card.drawn])
                if copies_in_hand == 0:
                    continue

                card_stats = stats[card.name]
                card_stats.games_in_hand += copies_in_hand
                if won:
                    card_stats.wins_in_hand += copies_in_hand

                if deck_stats is not None:
                    deck_card_stats = deck_stats[card.name]
                    deck_card_stats.games_in_hand += copies_in_hand
                    if won:
                        deck_card_stats.wins_in_hand += copies_in_hand

    return CollectedStats(
        overall=stats,
        by_deck=stats_by_deck,
        row_count=row_count,
        first_game_time=first_game_time,
        last_game_time=last_game_time,
    )


def collect_stats(csv_path: Path) -> tuple[dict[str, CardStats], int, str, str]:
    collected = _collect_stats(csv_path, include_deck_stats=False)
    return (
        collected.overall,
        collected.row_count,
        collected.first_game_time,
        collected.last_game_time,
    )


def collect_stats_by_deck(csv_path: Path) -> CollectedStats:
    return _collect_stats(csv_path, include_deck_stats=True)


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
    card_metadata: dict[str, CardDisplayMetadata] | None = None,
    stats_by_deck: dict[str, dict[str, CardStats]] | None = None,
) -> tuple[dict[str, dict[str, object]], float, float]:
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
    output: dict[str, dict[str, object]] = {}

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
        if card_metadata is not None and name in card_metadata:
            metadata = card_metadata[name]
            output[str(mtga_id)].update(
                {
                    "rarity": metadata.rarity,
                    "color": metadata.color,
                    "manaValue": metadata.mana_value,
                    "isLand": metadata.is_land,
                }
            )

    if stats_by_deck is not None:
        add_deck_ratings(
            output,
            cards_by_id,
            stats_by_deck,
            min_gih_observations,
        )

    return output, mean, standard_deviation


def add_deck_ratings(
    output: dict[str, dict[str, object]],
    cards_by_id: list[tuple[int, str]],
    stats_by_deck: dict[str, dict[str, CardStats]],
    min_gih_observations: int,
) -> None:
    card_names = {name for _, name in cards_by_id}
    for deck_colors in sorted(
        stats_by_deck,
        key=lambda colors: (len(colors), tuple(COLOR_ORDER.index(color) for color in colors)),
    ):
        deck_stats = stats_by_deck[deck_colors]
        valid_win_rates = [
            card_stats.win_rate
            for name, card_stats in deck_stats.items()
            if name in card_names
            and card_stats.games_in_hand >= min_gih_observations
        ]
        if not valid_win_rates:
            continue

        mean = statistics.fmean(valid_win_rates)
        standard_deviation = statistics.pstdev(valid_win_rates)
        for arena_id, name in cards_by_id:
            card_stats = deck_stats.get(name)
            if (
                card_stats is None
                or card_stats.games_in_hand < min_gih_observations
                or card_stats.win_rate is None
            ):
                continue

            win_rate = card_stats.win_rate
            deck_ratings = output[str(arena_id)].setdefault("deckRatings", {})
            assert isinstance(deck_ratings, dict)
            deck_ratings[deck_colors] = {
                "gihwr": round(win_rate, 3),
                "grade": grade_for(win_rate, mean, standard_deviation),
            }


def main() -> None:
    args = parse_args()
    collected = collect_stats_by_deck(args.csv_path)
    available_card_ids = load_public_card_ids(
        args.card_list_path, args.card_expansions
    )
    card_metadata = load_public_card_metadata(
        args.card_list_path, args.card_expansions
    )
    basic_lands = load_public_basic_lands(
        args.card_list_path, args.card_expansions
    )

    basic_land_names = {card.name for card in basic_lands}
    missing_ids = sorted(
        set(collected.overall) - set(available_card_ids) - basic_land_names
    )
    card_ids = {
        name: available_card_ids[name]
        for name in collected.overall
        if name in available_card_ids
    }
    output, mean, standard_deviation = build_output(
        card_ids,
        collected.overall,
        args.min_gih_observations,
        card_metadata,
        collected.by_deck,
    )
    output = add_unrated_basic_lands(output, basic_lands)

    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    with args.output_path.open("w", encoding="utf-8") as output_file:
        json.dump(output, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    rated_count = sum(card["gihwr"] is not None for card in output.values())
    print(
        f"Processed {collected.row_count:,} games from "
        f"{collected.first_game_time} through {collected.last_game_time}"
    )
    print(
        f"Wrote {len(output)} cards ({rated_count} rated, "
        f"minimum {args.min_gih_observations:,} GIH observations) to {args.output_path}"
    )
    print(f"Mean GIHWR: {mean:.6f}")
    print(f"Population standard deviation: {standard_deviation:.6f}")
    rated_cards_by_deck: dict[str, int] = {}
    for card in output.values():
        deck_ratings = card.get("deckRatings")
        if not isinstance(deck_ratings, dict):
            continue
        for deck_colors in deck_ratings:
            rated_cards_by_deck[deck_colors] = (
                rated_cards_by_deck.get(deck_colors, 0) + 1
            )
    if rated_cards_by_deck:
        summary = ", ".join(
            f"{deck_colors} ({rated_cards_by_deck[deck_colors]})"
            for deck_colors in sorted(
                rated_cards_by_deck,
                key=lambda colors: (
                    len(colors),
                    tuple(COLOR_ORDER.index(color) for color in colors),
                ),
            )
        )
        print(f"Deck ratings: {summary}")
    if missing_ids:
        print(f"CSV cards without Arena IDs: {', '.join(missing_ids)}")


if __name__ == "__main__":
    main()
