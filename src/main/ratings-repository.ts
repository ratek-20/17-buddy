import dftCardRatings from '../../card-data/DFT.json';
import eclCardRatings from '../../card-data/ECL.json';
import fraCardRatings from '../../card-data/FRA.json';
import type {
  CardRating,
  PackReceived,
  RatedCard,
  RatedPack,
} from '../model/draft';

type CardRatingDataset = Record<string, CardRating>;

const COLOR_ORDER = 'WUBRG';

const RATINGS_BY_SET: Record<string, CardRatingDataset> = {
  DFT: dftCardRatings,
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

  getAvailableDecks(setCode: string): string[] {
    const decks = new Set<string>();
    for (const rating of Object.values(this.ratingsBySet[setCode] ?? {})) {
      for (const deck of Object.keys(rating.deckRatings ?? {})) {
        decks.add(deck);
      }
    }

    return [...decks].sort(
      (first, second) =>
        first.length - second.length || compareColors(first, second),
    );
  }

  ratePack(pack: PackReceived): RatedPack {
    return {
      setCode: pack.setCode,
      packNumber: pack.packNumber,
      pickNumber: pack.pickNumber,
      availableDecks: this.getAvailableDecks(pack.setCode),
      cards: pack.cardIds.map((id) => this.rateCard(pack.setCode, id)),
      pickedCards: pack.pickedCardIds.map((id) =>
        this.rateCard(pack.setCode, id),
      ),
    };
  }

  private rateCard(setCode: string, id: number): RatedCard {
    const rating = this.getRating(setCode, id);

    return rating
      ? { id, ...rating }
      : {
          id,
          name: 'Unknown card',
          gihwr: null,
          grade: null,
        };
  }
}

const compareColors = (first: string, second: string): number => {
  for (
    let index = 0;
    index < Math.min(first.length, second.length);
    index += 1
  ) {
    const difference =
      COLOR_ORDER.indexOf(first[index]) - COLOR_ORDER.indexOf(second[index]);
    if (difference !== 0) {
      return difference;
    }
  }
  return first.localeCompare(second);
};
