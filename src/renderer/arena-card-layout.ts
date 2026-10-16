import type { RatedCard } from '../model/draft';

const CARDS_PER_ROW = 5;
const RARITY_ORDER: Record<string, number> = {
  mythic: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
  basic: 4,
};
const MONO_COLOR_ORDER = 'WUBRG';

export type PositionedCard = {
  card: RatedCard;
  column: number;
  row: number;
};

export function positionCards(cards: RatedCard[]): PositionedCard[] {
  return [...cards].sort(compareArenaCardOrder).map((card, index) => ({
    card,
    column: index % CARDS_PER_ROW,
    row: Math.floor(index / CARDS_PER_ROW),
  }));
}

function compareArenaCardOrder(first: RatedCard, second: RatedCard): number {
  return (
    rarityOrder(first) - rarityOrder(second) ||
    colorOrder(first) - colorOrder(second) ||
    first.id - second.id
  );
}

function rarityOrder(card: RatedCard): number {
  return RARITY_ORDER[card.rarity ?? ''] ?? 5;
}

function colorOrder(card: RatedCard): number {
  if (card.isLand) {
    return 7;
  }

  const color = card.color ?? '';
  if (color.length > 1) {
    return 5;
  }

  return color.length === 1 ? MONO_COLOR_ORDER.indexOf(color) : 6;
}
