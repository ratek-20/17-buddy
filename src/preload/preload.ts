import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  type DraftOverlayApi,
  OVERLAY_INTERACTION_CHANNEL,
  RATED_PACK_CHANNEL,
} from '../ipc/draft-overlay';
import type { RatedPack } from '../model/draft';

const draftOverlayApi: DraftOverlayApi = {
  onPackRated(callback) {
    const listener = (_event: IpcRendererEvent, pack: RatedPack): void => {
      callback(pack);
    };

    ipcRenderer.on(RATED_PACK_CHANNEL, listener);

    return () => {
      ipcRenderer.removeListener(RATED_PACK_CHANNEL, listener);
    };
  },
  setInteractive(interactive) {
    ipcRenderer.send(OVERLAY_INTERACTION_CHANNEL, interactive);
  },
};

contextBridge.exposeInMainWorld('draftOverlay', draftOverlayApi);
