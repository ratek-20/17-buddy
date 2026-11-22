#!/usr/bin/env python3
"""Add mana costs and Arena sorting colors from a Scryfall bulk JSONL file."""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterator
from pathlib import Path


def english_cards(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            card = json.loads(line)
            if card.get("lang") != "en" or card.get("layout") in {
                "art_series", "token", "double_faced_token", "emblem"
            }:
                continue
            yield card


def load_mana_costs(
    path: Path, names: set[str]
) -> dict[tuple[str | None, str], set[str]]:
    costs: dict[tuple[str | None, str], set[str]] = {}
    for card in english_cards(path):
        faces = card.get("card_faces", [])
        mana_cost = card.get("mana_cost")
        if mana_cost is None and faces:
            mana_cost = faces[0].get("mana_cost")
        entries = [(card["name"], mana_cost)] + [
            (face["name"], face.get("mana_cost")) for face in faces
        ]
        arena_id = card.get("arena_id")
        for name, cost in entries:
            if name not in names or not isinstance(cost, str):
                continue
            costs.setdefault((None, name), set()).add(cost)
            if arena_id is not None:
                costs.setdefault((str(arena_id), name), set()).add(cost)
    return costs


def load_arena_colors(
    path: Path, names: set[str]
) -> dict[tuple[str | None, str], set[str]]:
    colors: dict[tuple[str | None, str], set[str]] = {}
    for card in english_cards(path):
        faces = card.get("card_faces", [])
        # Adventures expose the creature's colors at the top level. Double-
        # faced cards instead expose colors on their individual faces.
        face_colors = card.get("colors")
        if face_colors is None and faces:
            face_colors = faces[0].get("colors")
        if not isinstance(face_colors, list) or any(
            color not in ("W", "U", "B", "R", "G") for color in face_colors
        ):
            continue
        color = "".join(symbol for symbol in "WUBRG" if symbol in face_colors)
        card_names = {card["name"]}
        if faces:
            card_names.add(faces[0]["name"])
        for name in card_names & names:
            colors.setdefault((None, name), set()).add(color)
            if card.get("arena_id") is not None:
                colors.setdefault((str(card["arena_id"]), name), set()).add(color)
    return colors


def add_arena_colors(
    cards: dict[str, dict[str, object]],
    colors: dict[tuple[str | None, str], set[str]],
) -> tuple[dict[str, dict[str, object]], list[str]]:
    enriched: dict[str, dict[str, object]] = {}
    missing: list[str] = []
    for arena_id, card in cards.items():
        enriched[arena_id] = dict(card)
        # Preserve the existing mana-color ordering for lands.
        if card.get("isLand"):
            continue
        name = str(card["name"])
        matches = colors.get((arena_id, name)) or colors.get((None, name), set())
        if len(matches) != 1:
            missing.append(name)
            continue
        color = next(iter(matches))
        if set(color) != set(str(card.get("color", ""))):
            enriched[arena_id]["arenaColor"] = color
        else:
            enriched[arena_id].pop("arenaColor", None)
    return enriched, missing


def add_mana_costs(
    cards: dict[str, dict[str, object]],
    costs: dict[tuple[str | None, str], set[str]],
) -> tuple[dict[str, dict[str, object]], list[str]]:
    enriched: dict[str, dict[str, object]] = {}
    missing: list[str] = []
    for arena_id, card in cards.items():
        name = str(card["name"])
        matches = costs.get((arena_id, name)) or costs.get((None, name), set())
        enriched[arena_id] = dict(card)
        if len(matches) == 1:
            enriched[arena_id]["manaCost"] = next(iter(matches))
        else:
            missing.append(name)
    return enriched, missing


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bulk_path", type=Path, help="Scryfall bulk, one card JSON per line")
    parser.add_argument("rating_paths", type=Path, nargs="+", help="Rating JSONs to enrich in place")
    args = parser.parse_args()

    datasets = {
        path: json.loads(path.read_text(encoding="utf-8"))
        for path in args.rating_paths
    }
    names = {card["name"] for cards in datasets.values() for card in cards.values()}
    costs = load_mana_costs(args.bulk_path, names)
    colors = load_arena_colors(args.bulk_path, names)
    for path, cards in datasets.items():
        enriched, missing = add_mana_costs(cards, costs)
        enriched, missing_colors = add_arena_colors(enriched, colors)
        path.write_text(
            json.dumps(enriched, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{path}: {len(cards) - len(missing)}/{len(cards)} mana costs matched")
        if missing:
            print("Missing or ambiguous costs: " + ", ".join(sorted(set(missing))))
        print(f"{path}: {sum('arenaColor' in card for card in enriched.values())} Arena color overrides")
        if missing_colors:
            print("Missing or ambiguous colors: " + ", ".join(sorted(set(missing_colors))))


if __name__ == "__main__":
    main()
