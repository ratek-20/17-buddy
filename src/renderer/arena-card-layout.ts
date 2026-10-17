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

export const ARENA_REFERENCE_VIEWPORT = {
  width: 1728,
  height: 1117,
} as const;

const ARENA_CARD_GEOMETRY = {
  firstCardLeft: 174.528,
  firstCardTop: 212.7885,
  cardWidth: 184.896,
  cardHeight: 261.378,
  firstBadgeLeft: 315.36,
  firstBadgeTop: 234.0115,
  columnStep: 196.992,
  rowStep: 268.9736,
} as const;

export type PositionedCard = {
  card: RatedCard;
  column: number;
  row: number;
};

export type ArenaViewportLayout = {
  scale: number;
  left: number;
  top: number;
};

export function positionCards(cards: RatedCard[]): PositionedCard[] {
  return [...cards].sort(compareArenaCardOrder).map((card, index) => ({
    card,
    column: index % CARDS_PER_ROW,
    row: Math.floor(index / CARDS_PER_ROW),
  }));
}

export function fitArenaViewport(
  viewportWidth: number,
  viewportHeight: number,
): ArenaViewportLayout {
  const scale = Math.min(
    viewportWidth / ARENA_REFERENCE_VIEWPORT.width,
    viewportHeight / ARENA_REFERENCE_VIEWPORT.height,
  );

  return {
    scale,
    left: (viewportWidth - ARENA_REFERENCE_VIEWPORT.width * scale) / 2,
    top: (viewportHeight - ARENA_REFERENCE_VIEWPORT.height * scale) / 2,
  };
}

export function getBadgePosition(
  positionedCard: PositionedCard,
  viewport: ArenaViewportLayout,
): { left: number; top: number } {
  return {
    left:
      viewport.left +
      (ARENA_CARD_GEOMETRY.firstBadgeLeft +
        positionedCard.column * ARENA_CARD_GEOMETRY.columnStep) *
        viewport.scale,
    top:
      viewport.top +
      (ARENA_CARD_GEOMETRY.firstBadgeTop +
        positionedCard.row * ARENA_CARD_GEOMETRY.rowStep) *
        viewport.scale,
  };
}

export function isPointOverCard(
  positionedCard: PositionedCard,
  horizontalPosition: number,
  verticalPosition: number,
  viewport: ArenaViewportLayout,
): boolean {
  const cardLeft =
    viewport.left +
    (ARENA_CARD_GEOMETRY.firstCardLeft +
      positionedCard.column * ARENA_CARD_GEOMETRY.columnStep) *
      viewport.scale;
  const cardTop =
    viewport.top +
    (ARENA_CARD_GEOMETRY.firstCardTop +
      positionedCard.row * ARENA_CARD_GEOMETRY.rowStep) *
      viewport.scale;

  return (
    horizontalPosition >= cardLeft &&
    horizontalPosition <=
      cardLeft + ARENA_CARD_GEOMETRY.cardWidth * viewport.scale &&
    verticalPosition >= cardTop &&
    verticalPosition <=
      cardTop + ARENA_CARD_GEOMETRY.cardHeight * viewport.scale
  );
}

function compareArenaCardOrder(first: RatedCard, second: RatedCard): number {
  return (
    rarityOrder(first) - rarityOrder(second) ||
    colorOrder(first) - colorOrder(second) ||
    multicolorOrder(first) - multicolorOrder(second) ||
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

function multicolorOrder(card: RatedCard): number {
  const color = card.color ?? '';
  if (color.length <= 1) {
    return 0;
  }

  const order = MULTICOLOR_ORDER.indexOf(color);
  return order === -1 ? MULTICOLOR_ORDER.length : order;
}
