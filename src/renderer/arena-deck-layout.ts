import type { RatedCard } from '../model/draft';
import type { ArenaViewportLayout } from './arena-card-layout';

const MONO_COLOR_ORDER = 'WUBRG';
const MULTICOLOR_ORDER = [
  'WU',
  'UB',
  'BR',
  'RG',
  'WG',
  'WB',
  'UR',
  'BG',
  'WR',
  'UG',
];

const DECK_LIST_GEOMETRY = {
  badgeLeft: 1261,
  mainDeckFirstBadgeTop: 188,
  rowStep: 44.18,
} as const;

export type SideboardCounts = Record<string, number>;

export type DeckCardGroup = {
  card: RatedCard;
  count: number;
};

export type PositionedDeckCard = DeckCardGroup & {
  left: number;
  top: number;
};

export function groupPickedCards(cards: RatedCard[]): DeckCardGroup[] {
  const cardsById = new Map<number, DeckCardGroup>();

  for (const card of cards) {
    const group = cardsById.get(card.id);
    if (group) {
      group.count += 1;
    } else {
      cardsById.set(card.id, { card, count: 1 });
    }
  }

  return [...cardsById.values()].sort(compareDeckCards);
}

export function splitDeckCards(
  cards: RatedCard[],
  sideboardCounts: SideboardCounts,
): { mainDeck: DeckCardGroup[]; sideboard: DeckCardGroup[] } {
  const mainDeck: DeckCardGroup[] = [];
  const sideboard: DeckCardGroup[] = [];

  for (const group of groupPickedCards(cards)) {
    const sideboardCount = clampCount(
      sideboardCounts[group.card.id],
      group.count,
    );
    const mainDeckCount = group.count - sideboardCount;

    if (mainDeckCount > 0) {
      mainDeck.push({ card: group.card, count: mainDeckCount });
    }
    if (sideboardCount > 0) {
      sideboard.push({ card: group.card, count: sideboardCount });
    }
  }

  return { mainDeck, sideboard };
}

export function reconcileSideboardCounts(
  cards: RatedCard[],
  sideboardCounts: SideboardCounts,
): SideboardCounts {
  const reconciledCounts: SideboardCounts = {};

  for (const group of groupPickedCards(cards)) {
    const count = clampCount(sideboardCounts[group.card.id], group.count);
    if (count > 0) {
      reconciledCounts[String(group.card.id)] = count;
    }
  }

  return reconciledCounts;
}

export function positionMainDeckCards(
  cards: RatedCard[],
  sideboardCounts: SideboardCounts,
  viewport: ArenaViewportLayout,
): PositionedDeckCard[] {
  const { mainDeck } = splitDeckCards(cards, sideboardCounts);
  return positionRows(
    mainDeck,
    DECK_LIST_GEOMETRY.mainDeckFirstBadgeTop,
    viewport,
  );
}

function positionRows(
  rows: DeckCardGroup[],
  firstTop: number,
  viewport: ArenaViewportLayout,
): PositionedDeckCard[] {
  return rows.map((row, index) => ({
    ...row,
    left: viewport.left + DECK_LIST_GEOMETRY.badgeLeft * viewport.scale,
    top:
      viewport.top +
      (firstTop + index * DECK_LIST_GEOMETRY.rowStep) * viewport.scale,
  }));
}

function compareDeckCards(first: DeckCardGroup, second: DeckCardGroup): number {
  return (
    Number(first.card.isLand) - Number(second.card.isLand) ||
    (first.card.manaValue ?? Number.MAX_SAFE_INTEGER) -
      (second.card.manaValue ?? Number.MAX_SAFE_INTEGER) ||
    colorOrder(first.card) - colorOrder(second.card) ||
    multicolorOrder(first.card) - multicolorOrder(second.card) ||
    first.card.name.localeCompare(second.card.name) ||
    first.card.id - second.card.id
  );
}

function colorOrder(card: RatedCard): number {
  const color = card.color ?? '';
  if (color.length === 1) {
    return MONO_COLOR_ORDER.indexOf(color);
  }
  if (color.length > 1) {
    return MONO_COLOR_ORDER.length;
  }
  return MONO_COLOR_ORDER.length + 1;
}

function multicolorOrder(card: RatedCard): number {
  const color = card.color ?? '';
  const index = MULTICOLOR_ORDER.indexOf(color);
  return index === -1 ? MULTICOLOR_ORDER.length : index;
}

function clampCount(value: number | undefined, maximum: number): number {
  if (!Number.isInteger(value)) {
    return 0;
  }
  return Math.max(0, Math.min(value ?? 0, maximum));
}
