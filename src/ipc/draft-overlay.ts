import type { RatedPack } from '../model/draft';

export const RATED_PACK_CHANNEL = 'draft:pack-rated';
export const OVERLAY_INTERACTION_CHANNEL = 'draft:overlay-interaction';

export type DraftOverlayApi = {
  onPackRated: (callback: (pack: RatedPack) => void) => () => void;
  setInteractive: (interactive: boolean) => void;
};
