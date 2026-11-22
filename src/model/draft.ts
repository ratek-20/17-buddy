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
  pickedCardIds: number[];
};

export type SceneChanged = {
  type: 'scene-changed';
  sceneName: string;
};

export type ArenaLogEvent = DraftStarted | PackReceived | SceneChanged;

export type WinRateGrade = {
  gihwr: number | null;
  grade: string | null;
};

export type CardRating = WinRateGrade & {
  name: string;
  rarity?: string;
  color?: string;
  // Front-face color used by Arena when it differs from color identity.
  arenaColor?: string;
  manaValue?: number;
  manaCost?: string;
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
  pickedCards: RatedCard[];
};
