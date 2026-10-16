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

export type CardRating = {
  name: string;
  gihwr: number | null;
  grade: string | null;
  rarity?: string;
  color?: string;
  isLand?: boolean;
};

export type RatedCard = CardRating & {
  id: number;
};

export type RatedPack = {
  setCode: string;
  packNumber: number;
  pickNumber: number;
  cards: RatedCard[];
};
