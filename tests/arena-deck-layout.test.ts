import { describe, expect, it } from 'vitest';
import type { RatedCard } from '../src/model/draft';
import {
  positionMainDeckCards,
  reconcileSideboardCounts,
  splitDeckCards,
} from '../src/renderer/arena-deck-layout';

describe('splitDeckCards', () => {
  it('groups duplicates and follows Arena mana, color, and name ordering', () => {
    const cards = [
      createCard(1, 'Possession Engine', 'U', 5),
      createCard(2, "Ride's End", 'W', 5),
      createCard(3, 'Guidelight Optimizer', 'U', 2),
      createCard(4, 'Voyager Quickwelder', 'W', 3),
      createCard(4, 'Voyager Quickwelder', 'W', 3),
      createCard(5, 'Guidelight Pathmaker', 'WU', 6),
    ];

    const rows = splitDeckCards(cards, { '1': 1 });

    expect(rows.mainDeck.map(({ card, count }) => [card.name, count])).toEqual([
      ['Guidelight Optimizer', 1],
      ['Voyager Quickwelder', 2],
      ["Ride's End", 1],
      ['Guidelight Pathmaker', 1],
    ]);
    expect(rows.sideboard.map(({ card }) => card.name)).toEqual([
      'Possession Engine',
    ]);
  });

  it('puts lands after nonlands', () => {
    const rows = splitDeckCards(
      [
        createCard(1, 'Basic Land', '', 0, true),
        createCard(2, 'Large Spell', 'G', 7),
      ],
      {},
    );

    expect(rows.mainDeck.map(({ card }) => card.name)).toEqual([
      'Large Spell',
      'Basic Land',
    ]);
  });
});

describe('reconcileSideboardCounts', () => {
  it('drops absent cards and clamps duplicate counts', () => {
    const cards = [
      createCard(1, 'First', 'W', 2),
      createCard(1, 'First', 'W', 2),
      createCard(2, 'Second', 'U', 3),
    ];

    expect(
      reconcileSideboardCounts(cards, { '1': 5, '2': 0, '99': 1 }),
    ).toEqual({
      '1': 2,
    });
  });
});

describe('positionMainDeckCards', () => {
  it('places a gapless badge column before Arena quantity bubbles', () => {
    const rows = positionMainDeckCards(
      [createCard(1, 'First', 'W', 2), createCard(2, 'Second', 'U', 3)],
      {},
      { scale: 1, left: 0, top: 0 },
    );

    expect(rows[0]).toMatchObject({ left: 1261, top: 188 });
    expect(rows[1]?.top).toBeCloseTo(232.18);
  });

  it('does not position sideboard cards', () => {
    const rows = positionMainDeckCards(
      [createCard(1, 'First', 'W', 2)],
      { '1': 1 },
      { scale: 1, left: 0, top: 0 },
    );

    expect(rows).toEqual([]);
  });
});

function createCard(
  id: number,
  name: string,
  color: string,
  manaValue: number,
  isLand = false,
): RatedCard {
  return {
    id,
    name,
    color,
    manaValue,
    isLand,
    gihwr: 0.5,
    grade: 'C',
  };
}
