import { describe, expect, it } from 'vitest';
import type { RatedCard } from '../src/model/draft';
import { RatingsRepository } from '../src/main/ratings-repository';
import {
  ARENA_REFERENCE_VIEWPORT,
  fitArenaViewport,
  positionCards,
} from '../src/renderer/arena-card-layout';

describe('positionCards', () => {
  it('keeps the TDM P1P1 badges on the cards shown in Arena', () => {
    const pack = new RatingsRepository().ratePack({
      type: 'pack-received',
      setCode: 'TDM',
      packNumber: 1,
      pickNumber: 1,
      cardIds: [
        95574, 95663, 95741, 95608, 95640, 95521, 95840, 95704, 95551, 95744,
        95758, 95614, 95736, 95799,
      ],
      pickedCardIds: [],
    });

    expect(
      positionCards(pack.cards).map(({ card, column, row }) => [
        card.name,
        card.grade,
        column,
        row,
      ]),
    ).toEqual([
      ['Perennation', 'D+', 0, 0],
      ['Ruinous Ultimatum', null, 1, 0],
      ['Twinmaw Stormbrood', 'B', 2, 0],
      ['Aegis Sculptor', 'D+', 3, 0],
      ['Strategic Betrayal', 'C-', 4, 0],
      ['Dragonclaw Strike', 'C', 0, 1],
      ['Riverwheel Sweep', 'B-', 1, 1],
      ['Coordinated Maneuver', 'C-', 2, 1],
      ['Sibsig Appraiser', 'B', 3, 1],
      ['Sandskitter Outrider', 'D', 4, 1],
      ['Shock Brigade', 'C', 0, 2],
      ['Dusyut Earthcarver', 'C', 1, 2],
      ['Reigning Victor', 'C', 2, 2],
      ['Wind-Scarred Crag', 'C-', 3, 2],
    ]);
  });

  it('sorts colorless artifacts by their Arena color rather than colored abilities', () => {
    const artifact = { ...createCard(1, 'Monument', 'WUR'), arenaColor: '' };
    const multicolor = createCard(2, 'Gold spell', 'UR');

    expect(
      positionCards([artifact, multicolor]).map(({ card }) => card.name),
    ).toEqual(['Gold spell', 'Monument']);
  });

  it('keeps the BLB P3P7 grades on their matching Arena cards', () => {
    const pack = new RatingsRepository().ratePack({
      type: 'pack-received',
      setCode: 'BLB',
      packNumber: 3,
      pickNumber: 7,
      cardIds: [91756, 91592, 91571, 91712, 91752, 91793, 91634],
      pickedCardIds: [],
    });

    expect(
      positionCards(pack.cards).map(({ card, column, row }) => [
        card.name,
        card.grade,
        column,
        row,
      ]),
    ).toEqual([
      ['Huskburster Swarm', 'C-', 0, 0],
      ['Mudflat Village', 'B-', 1, 0],
      ['Thistledown Players', 'D', 2, 0],
      ['Lightshell Duo', 'C', 3, 0],
      ['High Stride', 'C-', 4, 0],
      ['Junkblade Bruiser', 'D', 0, 1],
      ['Head of the Homestead', 'C', 1, 1],
    ]);
  });

  it('recognizes every color pair regardless of letter order', () => {
    const pairs = ['WU', 'UB', 'BR', 'RG', 'WG', 'WB', 'UR', 'BG', 'WR', 'UG'];
    const cards = pairs.map((pair, index) =>
      createCard(pairs.length - index, pair, [...pair].reverse().join('')),
    );

    expect(positionCards(cards).map(({ card }) => card.name)).toEqual(pairs);
  });

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
