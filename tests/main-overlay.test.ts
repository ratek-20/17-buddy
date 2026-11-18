import type { IpcMainEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_INTERACTION_CHANNEL } from '../src/ipc/draft-overlay';
import type { ArenaWindow } from '../src/main/arena-foreground-monitor';

const harness = vi.hoisted(() => {
  let visible = false;
  const overlay = {
    webContents: {
      on: vi.fn(),
      once: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      isLoading: () => false,
      send: vi.fn(),
    },
    on: vi.fn(),
    loadURL: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    isDestroyed: () => false,
    isVisible: () => visible,
    getBounds: () => ({ x: 0, y: 0, width: 1728, height: 1117 }),
    setBounds: vi.fn(),
    showInactive: vi.fn(() => {
      visible = true;
    }),
    hide: vi.fn(() => {
      visible = false;
    }),
  };

  return {
    overlay,
    onLine: (_line: string) => {},
    onWindowChange: (_window: ArenaWindow | null) => {},
    ipcOn: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: class {
    constructor() {
      return harness.overlay;
    }
  },
  ipcMain: { on: harness.ipcOn, removeListener: vi.fn() },
  screen: {
    getPrimaryDisplay: () => ({ bounds: harness.overlay.getBounds() }),
    getDisplayMatching: () => ({ bounds: harness.overlay.getBounds() }),
    screenToDipRect: (_window: unknown, bounds: unknown) => bounds,
  },
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));

vi.mock('../src/main/arena-foreground-monitor', () => ({
  ArenaForegroundMonitor: class {
    constructor(onWindowChange: typeof harness.onWindowChange) {
      harness.onWindowChange = onWindowChange;
    }
    start() {}
    stop() {}
  },
}));

vi.mock('../src/main/arena-log-watcher', () => ({
  ArenaLogWatcher: class {
    constructor(_path: string, onLine: typeof harness.onLine) {
      harness.onLine = onLine;
    }
    start() {}
    stop() {}
  },
}));

const arenaWindow: ArenaWindow = {
  platform: 'macos',
  bounds: { x: 0, y: 0, width: 1728, height: 1117 },
};

const receivePack = (): void => {
  harness.onLine(
    JSON.stringify({
      CurrentModule: 'BotDraft',
      Payload: {
        DraftStatus: 'PickNext',
        EventName: 'QuickDraft_BLB_2026',
        PackNumber: 0,
        PickNumber: 1,
        DraftPack: [92095],
        PickedCards: [],
      },
    }),
  );
};

const navigateTo = (sceneName: string): void => {
  harness.onLine('SceneChange ' + JSON.stringify({ toSceneName: sceneName }));
};

const setInteractive = (
  interactive: unknown,
  sender = harness.overlay.webContents,
): void => {
  const listener = harness.ipcOn.mock.calls.find(
    ([channel]) => channel === OVERLAY_INTERACTION_CHANNEL,
  )?.[1] as (event: IpcMainEvent, value: unknown) => void;
  listener({ sender } as unknown as IpcMainEvent, interactive);
};

describe('draft overlay navigation', () => {
  let signalListeners: Map<
    NodeJS.Signals,
    ReturnType<typeof process.rawListeners>
  >;

  beforeEach(async () => {
    signalListeners = new Map(
      (['SIGINT', 'SIGTERM'] as const).map((signal) => [
        signal,
        process.rawListeners(signal),
      ]),
    );
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../src/main/main');
    const startWatcher = harness.overlay.webContents.once.mock.calls.find(
      ([event]) => event === 'did-finish-load',
    )?.[1] as () => void;
    startWatcher();
    harness.onWindowChange(arenaWindow);
  });

  afterEach(() => {
    for (const [signal, previous] of signalListeners) {
      for (const listener of process.rawListeners(signal)) {
        if (!previous.includes(listener)) {
          process.removeListener(signal, listener);
        }
      }
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('waits for draft data and supports starting while already drafting', () => {
    expect(harness.overlay.isVisible()).toBe(false);
    receivePack();
    expect(harness.overlay.isVisible()).toBe(true);
  });

  it.each(['DeckDetails', 'DeckBuilder', 'Home', 'EventLanding'])(
    'hides badges and releases mouse capture on entering %s, then restores the draft',
    (sceneName) => {
      navigateTo('Draft');
      receivePack();
      setInteractive(true);
      expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
        false,
        { forward: true },
      );

      navigateTo(sceneName);
      expect(harness.overlay.isVisible()).toBe(false);
      expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
        true,
        { forward: true },
      );

      // Pending hover requests, late pack responses, and refocusing Arena must
      // not reactivate an overlay over the other screen.
      setInteractive(true);
      receivePack();
      harness.onWindowChange(null);
      harness.onWindowChange(arenaWindow);
      expect(harness.overlay.isVisible()).toBe(false);
      expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
        true,
        { forward: true },
      );

      navigateTo('Draft');
      expect(harness.overlay.isVisible()).toBe(true);
      setInteractive(true);
      expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
        false,
        { forward: true },
      );
    },
  );

  it('does not infer the draft scene from a delayed pack after navigation', () => {
    navigateTo('Home');
    receivePack();
    expect(harness.overlay.isVisible()).toBe(false);
    navigateTo('Draft');
    expect(harness.overlay.isVisible()).toBe(true);
  });

  it('releases mouse capture on losing focus and ignores invalid interaction requests', () => {
    receivePack();
    setInteractive(true);
    harness.onWindowChange(null);
    expect(harness.overlay.isVisible()).toBe(false);
    expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      true,
      { forward: true },
    );
    setInteractive(true);
    expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      true,
      { forward: true },
    );

    harness.onWindowChange(arenaWindow);
    setInteractive('true');
    setInteractive(true, {} as typeof harness.overlay.webContents);
    expect(harness.overlay.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      true,
      { forward: true },
    );
  });
});
