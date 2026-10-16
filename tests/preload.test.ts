import type { IpcRendererEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftOverlayApi } from '../src/ipc/draft-overlay';
import { RATED_PACK_CHANNEL } from '../src/ipc/draft-overlay';
import type { RatedPack } from '../src/model/draft';

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: electron.exposeInMainWorld,
  },
  ipcRenderer: {
    on: electron.on,
    removeListener: electron.removeListener,
  },
}));

describe('draft overlay preload API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('forwards rated packs from IPC and removes its listener on unsubscribe', async () => {
    await import('../src/preload/preload');
    expect(electron.exposeInMainWorld).toHaveBeenCalledOnce();
    expect(electron.exposeInMainWorld).toHaveBeenCalledWith(
      'draftOverlay',
      expect.any(Object),
    );

    const api = electron.exposeInMainWorld.mock
      .calls[0]?.[1] as DraftOverlayApi;
    const callback = vi.fn();
    const unsubscribe = api.onPackRated(callback);
    const listener = electron.on.mock.calls[0]?.[1] as (
      event: IpcRendererEvent,
      pack: RatedPack,
    ) => void;
    const pack: RatedPack = {
      setCode: 'FRA',
      packNumber: 1,
      pickNumber: 2,
      cards: [],
    };

    expect(electron.on).toHaveBeenCalledWith(RATED_PACK_CHANNEL, listener);
    listener({} as IpcRendererEvent, pack);
    expect(callback).toHaveBeenCalledWith(pack);

    unsubscribe();
    expect(electron.removeListener).toHaveBeenCalledWith(
      RATED_PACK_CHANNEL,
      listener,
    );
  });
});
