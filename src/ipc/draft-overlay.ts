import type { RatedPack } from '../model/draft';

export const RATED_PACK_CHANNEL = 'draft:pack-rated';

export type DraftOverlayApi = {
  onPackRated: (callback: (pack: RatedPack) => void) => () => void;
};
