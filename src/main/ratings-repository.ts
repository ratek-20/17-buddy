import eclCardRatings from '../../card-data/ECL.json';
import fraCardRatings from '../../card-data/FRA.json';
import type { CardRating, PackReceived, RatedPack } from '../model/draft';

type CardRatingDataset = Record<string, CardRating>;

const RATINGS_BY_SET: Record<string, CardRatingDataset> = {
  ECL: eclCardRatings,
  FRA: fraCardRatings,
};

export class RatingsRepository {
  constructor(
    private readonly ratingsBySet: Record<
      string,
      CardRatingDataset
    > = RATINGS_BY_SET,
  ) {}

  hasSet(setCode: string): boolean {
    return this.ratingsBySet[setCode] !== undefined;
  }

  getRating(setCode: string, cardId: number): CardRating | null {
    return this.ratingsBySet[setCode]?.[String(cardId)] ?? null;
  }

  ratePack(pack: PackReceived): RatedPack {
    return {
      setCode: pack.setCode,
      packNumber: pack.packNumber,
      pickNumber: pack.pickNumber,
      cards: pack.cardIds.map((id) => {
        const rating = this.getRating(pack.setCode, id);

        if (rating) {
          return { id, ...rating };
        }

        return {
          id,
          name: 'Unknown card',
          gihwr: null,
          grade: null,
        };
      }),
    };
  }
}
