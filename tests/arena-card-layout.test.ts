import { describe, expect, it } from 'vitest';
import type { RatedCard } from '../src/model/draft';
import {
  ARENA_REFERENCE_VIEWPORT,
  fitArenaViewport,
  positionCards,
} from '../src/renderer/arena-card-layout';

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

describe('fitArenaViewport', () => {
  it('centers the Arena layout when the window is wider than the reference', () => {
    const viewport = fitArenaViewport(1920, 1080);

    expect(viewport.scale).toBeCloseTo(1080 / ARENA_REFERENCE_VIEWPORT.height);
    expect(viewport.left).toBeGreaterThan(0);
    expect(viewport.top).toBe(0);
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
