import { describe, expect, it } from 'vitest';
import { RatingsRepository } from '../src/main/ratings-repository';

describe('RatingsRepository', () => {
  const repository = new RatingsRepository({
    TST: {
      '100': {
        name: 'First card',
        gihwr: 0.6,
        grade: 'B+',
        deckRatings: {
          WU: { gihwr: 0.62, grade: 'A-' },
          WUG: { gihwr: 0.61, grade: 'B+' },
        },
      },
      '200': { name: 'Second card', gihwr: 0.5, grade: 'D' },
    },
  });

  it('loads the embedded Bloomburrow ratings', () => {
    const embeddedRepository = new RatingsRepository();

    expect(embeddedRepository.hasSet('BLB')).toBe(true);
    expect(embeddedRepository.getRating('BLB', 91648)).toMatchObject({
      name: 'Season of Loss',
      gihwr: 0.657,
      grade: 'A+',
    });
  });

  it('rates Tarkir: Dragonstorm packs including Special Guests and basic lands', () => {
    const embeddedRepository = new RatingsRepository();

    expect(embeddedRepository.hasSet('TDM')).toBe(true);
    const pack = embeddedRepository.ratePack({
      type: 'pack-received',
      setCode: 'TDM',
      packNumber: 1,
      pickNumber: 1,
      cardIds: [95516, 95843, 95800],
      pickedCardIds: [95712],
    });

    expect(pack.cards).toMatchObject([
      {
        name: 'Ugin, Eye of the Storms',
        gihwr: 0.687,
        grade: 'A+',
        manaCost: '{7}',
      },
      { name: 'Misty Rainforest', gihwr: 0.56, isLand: true },
      { name: 'Plains', gihwr: null, grade: null, isLand: true },
    ]);
    expect(pack.pickedCards).toMatchObject([
      {
        name: 'Glacial Dragonhunt',
        manaCost: '{U}{R}',
        deckRatings: { WUR: { gihwr: 0.596, grade: 'B' } },
      },
    ]);
    expect(pack.availableDecks).toEqual(
      expect.arrayContaining(['WUR', 'WBR', 'WBG', 'UBG', 'URG']),
    );
  });

  it('loads public Reality Fracture ratings with deck choices, Special Guests, and basic lands', () => {
    const embeddedRepository = new RatingsRepository();
    expect(embeddedRepository.hasSet('FRA')).toBe(true);

    const pack = embeddedRepository.ratePack({
      type: 'pack-received',
      setCode: 'FRA',
      packNumber: 1,
      pickNumber: 2,
      cardIds: [106247, 106571, 106526],
      pickedCardIds: [106226, 106227],
    });

    expect(pack.cards).toMatchObject([
      {
        name: 'Surgical Precision',
        gihwr: 0.579,
        grade: 'B-',
        manaCost: '{1}{W}',
        deckRatings: { WU: { gihwr: 0.601, grade: 'B-' } },
      },
      { name: 'Consider', gihwr: 0.561, grade: 'C', manaCost: '{U}' },
      { name: 'Plains', gihwr: null, grade: null, isLand: true, manaCost: '' },
    ]);
    expect(pack.pickedCards).toMatchObject([
      {
        name: 'Academic Ascent',
        gihwr: 0.53,
        grade: 'D+',
        deckRatings: { WU: { gihwr: 0.559, grade: 'C-' } },
      },
      { name: 'Blossom-Blessed Angel', arenaColor: 'W' },
    ]);
    expect(pack.availableDecks).toEqual(
      expect.arrayContaining([
        'WU',
        'WB',
        'WR',
        'WG',
        'UB',
        'UR',
        'UG',
        'BR',
        'BG',
        'RG',
      ]),
    );
    expect(embeddedRepository.getRating('FRA', 106284)).toMatchObject({
      name: 'Extrapolate the Impossible',
      gihwr: null,
      grade: null,
    });
  });

  it('finds an embedded rating by set and Arena card ID', () => {
    expect(repository.hasSet('TST')).toBe(true);
    expect(repository.getRating('TST', 100)).toEqual({
      name: 'First card',
      gihwr: 0.6,
      grade: 'B+',
      deckRatings: {
        WU: { gihwr: 0.62, grade: 'A-' },
        WUG: { gihwr: 0.61, grade: 'B+' },
      },
    });
  });

  it('rates a pack while preserving the order received from Arena', () => {
    expect(
      repository.ratePack({
        type: 'pack-received',
        setCode: 'TST',
        packNumber: 1,
        pickNumber: 1,
        cardIds: [200, 100],
        pickedCardIds: [100],
      }),
    ).toEqual({
      setCode: 'TST',
      packNumber: 1,
      pickNumber: 1,
      availableDecks: ['WU', 'WUG'],
      cards: [
        {
          id: 200,
          name: 'Second card',
          gihwr: 0.5,
          grade: 'D',
        },
        {
          id: 100,
          name: 'First card',
          gihwr: 0.6,
          grade: 'B+',
          deckRatings: {
            WU: { gihwr: 0.62, grade: 'A-' },
            WUG: { gihwr: 0.61, grade: 'B+' },
          },
        },
      ],
      pickedCards: [
        {
          id: 100,
          name: 'First card',
          gihwr: 0.6,
          grade: 'B+',
          deckRatings: {
            WU: { gihwr: 0.62, grade: 'A-' },
            WUG: { gihwr: 0.61, grade: 'B+' },
          },
        },
      ],
    });
  });

  it('returns an unrated placeholder for an unknown set or card ID', () => {
    expect(repository.hasSet('UNKNOWN')).toBe(false);
    expect(repository.getRating('TST', 999999)).toBeNull();
    expect(
      repository.ratePack({
        type: 'pack-received',
        setCode: 'UNKNOWN',
        packNumber: 2,
        pickNumber: 3,
        cardIds: [999999],
        pickedCardIds: [],
      }).cards,
    ).toEqual([
      {
        id: 999999,
        name: 'Unknown card',
        gihwr: null,
        grade: null,
      },
    ]);
  });
});
