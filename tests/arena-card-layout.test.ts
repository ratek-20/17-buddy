import { describe, expect, it } from 'vitest';
import type { RatedCard } from '../src/model/draft';
import { positionCards } from '../src/renderer/arena-card-layout';

describe('positionCards', () => {
  it('orders multicolor cards in Arena color-pair order', () => {
    const cards = [
      createCard(3, 'Konstrari Improviser', 'RG'),
      createCard(2, 'Theorix Metamage', 'UB'),
      createCard(1, 'Fatehold Chronologist', 'WU'),
    ];

    expect(positionCards(cards).map(({ card }) => card.name)).toEqual([
      'Fatehold Chronologist',
      'Theorix Metamage',
      'Konstrari Improviser',
    ]);
  });
});

function createCard(id: number, name: string, color: string): RatedCard {
  return {
    id,
    name,
    color,
    rarity: 'common',
    isLand: false,
    gihwr: 0.5,
    grade: 'C',
  };
}
