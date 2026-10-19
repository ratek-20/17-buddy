export type DraftStarted = {
  type: 'draft-started';
  setCode: string;
};

export type PackReceived = {
  type: 'pack-received';
  setCode: string;
  packNumber: number;
  pickNumber: number;
  cardIds: number[];
};

export type ArenaLogEvent = DraftStarted | PackReceived;

export type WinRateGrade = {
  gihwr: number | null;
  grade: string | null;
};

export type CardRating = WinRateGrade & {
  name: string;
  rarity?: string;
  color?: string;
  isLand?: boolean;
  deckRatings?: Record<string, WinRateGrade>;
};

export type RatedCard = CardRating & {
  id: number;
};

export type RatedPack = {
  setCode: string;
  packNumber: number;
  pickNumber: number;
  availableDecks: string[];
  cards: RatedCard[];
};
