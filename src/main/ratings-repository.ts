import eclCardRatings from '../../card-data/ECL.json';
import fraCardRatings from '../../card-data/FRA.json';
import type { CardRating, PackReceived, RatedPack } from '../model/draft';

type CardRatingDataset = Record<string, CardRating>;

const RATINGS_BY_SET: Record<string, CardRatingDataset> = {
  ECL: eclCardRatings,
  FRA: fraCardRatings,
};

export class RatingsRepository {
  hasSet(setCode: string): boolean {
    return RATINGS_BY_SET[setCode] !== undefined;
  }

  getRating(setCode: string, cardId: number): CardRating | null {
    return RATINGS_BY_SET[setCode]?.[String(cardId)] ?? null;
  }

  ratePack(pack: PackReceived): RatedPack {
    return {
      setCode: pack.setCode,
      packNumber: pack.packNumber,
      pickNumber: pack.pickNumber,
      cards: pack.cardIds.map((id) => {
        const rating = this.getRating(pack.setCode, id);

        return {
          id,
          name: rating?.name ?? 'Unknown card',
          gihwr: rating?.gihwr ?? null,
          grade: rating?.grade ?? null,
        };
      }),
    };
  }
}
