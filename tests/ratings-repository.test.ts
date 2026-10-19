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
