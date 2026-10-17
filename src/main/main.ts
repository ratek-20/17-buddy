import { app, BrowserWindow, screen, type Rectangle } from 'electron';
import os from 'node:os';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { RATED_PACK_CHANNEL } from '../ipc/draft-overlay';
import type { ArenaLogEvent, RatedPack } from '../model/draft';
import {
  ArenaForegroundMonitor,
  type ArenaWindow,
} from './arena-foreground-monitor';
import { parseArenaLogLine } from './arena-log-parser';
import { ArenaLogWatcher } from './arena-log-watcher';
import { resolveMacOverlayBounds } from './arena-window-bounds';
import { RatingsRepository } from './ratings-repository';

const ratingsRepository = new RatingsRepository();

let arenaLogWatcher: ArenaLogWatcher | null = null;
let arenaForegroundMonitor: ArenaForegroundMonitor | null = null;
let foregroundArenaWindow: ArenaWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let latestRatedPack: RatedPack | null = null;

const tolerateClosedOutputPipe = (stream: NodeJS.WriteStream): void => {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') {
      throw error;
    }
  });
};

tolerateClosedOutputPipe(process.stdout);
tolerateClosedOutputPipe(process.stderr);

if (started) {
  app.quit();
}

const createOverlayWindow = (): BrowserWindow => {
  const { bounds } = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: 1,
    height: 1,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setIgnoreMouseEvents(true, { forward: true });
  window.setAlwaysOnTop(true, 'screen-saver');

  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  window.webContents.on('did-finish-load', () => {
    updateOverlayVisibility();

    if (latestRatedPack) {
      window.webContents.send(RATED_PACK_CHANNEL, latestRatedPack);
    }
  });

  window.on('closed', () => {
    if (overlayWindow === window) {
      overlayWindow = null;
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return window;
};

const updateOverlayVisibility = (): void => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  if (!foregroundArenaWindow) {
    overlayWindow.hide();
    return;
  }

  const arenaBounds = toElectronBounds(foregroundArenaWindow);
  if (!sameBounds(overlayWindow.getBounds(), arenaBounds)) {
    overlayWindow.setBounds(arenaBounds, false);
  }

  overlayWindow.showInactive();
};

const startArenaForegroundMonitor = (): void => {
  if (arenaForegroundMonitor) {
    return;
  }

  arenaForegroundMonitor = new ArenaForegroundMonitor(
    (arenaWindow) => {
      foregroundArenaWindow = arenaWindow;
      updateOverlayVisibility();
    },
    (error) => {
      console.error(
        '[arena-window] Failed to detect the foreground app',
        error,
      );
    },
  );
  arenaForegroundMonitor.start();
};

const toElectronBounds = (arenaWindow: ArenaWindow): Rectangle => {
  if (arenaWindow.platform === 'windows') {
    return screen.screenToDipRect(null, arenaWindow.bounds);
  }

  const display = screen.getDisplayMatching(arenaWindow.bounds);
  return resolveMacOverlayBounds(arenaWindow.bounds, display.bounds);
};

const sameBounds = (first: Rectangle, second: Rectangle): boolean =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height;

const resolveArenaLogPath = (): string | null => {
  if (process.env.MTGA_LOG_PATH) {
    return path.resolve(process.env.MTGA_LOG_PATH);
  }

  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Logs',
      'Wizards Of The Coast',
      'MTGA',
      'Player.log',
    );
  }

  if (process.platform === 'win32') {
    return path.join(
      os.homedir(),
      'AppData',
      'LocalLow',
      'Wizards Of The Coast',
      'MTGA',
      'Player.log',
    );
  }

  return null;
};

const sendRatedPack = (pack: RatedPack): void => {
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !overlayWindow.webContents.isLoading()
  ) {
    overlayWindow.webContents.send(RATED_PACK_CHANNEL, pack);
  }
};

const logRatedPack = (pack: RatedPack): void => {
  for (const card of pack.cards) {
    const winRate =
      card.gihwr === null ? 'n/a' : `${(card.gihwr * 100).toFixed(1)}%`;
    const grade = card.grade ?? 'n/a';

    console.info(
      `[arena-log] ${pack.setCode} P${pack.packNumber}P${pack.pickNumber} ` +
        `${card.id} | ${card.name} | GIHWR ${winRate} | Grade ${grade}`,
    );
  }
};

const handleArenaEvent = (event: ArenaLogEvent): void => {
  console.info(`[arena-log] ${JSON.stringify(event)}`);

  if (event.type !== 'pack-received') {
    return;
  }

  if (!ratingsRepository.hasSet(event.setCode)) {
    console.warn(
      `[arena-log] No embedded card ratings found for set ${event.setCode}`,
    );
  }

  latestRatedPack = ratingsRepository.ratePack(event);
  logRatedPack(latestRatedPack);
  sendRatedPack(latestRatedPack);
};

const startArenaLogWatcher = (): void => {
  if (arenaLogWatcher) {
    return;
  }

  const logPath = resolveArenaLogPath();

  if (!logPath) {
    console.warn(`[arena-log] Unsupported platform: ${process.platform}`);
    return;
  }

  arenaLogWatcher = new ArenaLogWatcher(
    logPath,
    (line) => {
      const event = parseArenaLogLine(line);

      if (event) {
        handleArenaEvent(event);
      }
    },
    (error) => {
      console.error('[arena-log] Failed to read the Arena log', error);
    },
  );
  arenaLogWatcher.start();
  console.info(`[arena-log] Watching ${logPath}`);
};

app.whenReady().then(() => {
  overlayWindow = createOverlayWindow();
  startArenaForegroundMonitor();
  overlayWindow.webContents.once('did-finish-load', startArenaLogWatcher);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      overlayWindow = createOverlayWindow();
    }
  });
});

app.on('before-quit', () => {
  arenaForegroundMonitor?.stop();
  arenaLogWatcher?.stop();
});

process.once('SIGINT', () => {
  app.quit();
});

process.once('SIGTERM', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
