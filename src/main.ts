import { app, BrowserWindow } from 'electron';
import os from 'node:os';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import eclCardRatings from '../card-data/ECL.json';
import fraCardRatings from '../card-data/FRA.json';
import { type ArenaLogEvent, parseArenaLogLine } from './arena-log-parser';
import { ArenaLogWatcher } from './arena-log-watcher';

type CardRating = {
  name: string;
  gihwr: number | null;
  grade: string | null;
};

const CARD_RATINGS_BY_SET: Record<string, Record<string, CardRating>> = {
  ECL: eclCardRatings,
  FRA: fraCardRatings,
};

let arenaLogWatcher: ArenaLogWatcher | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

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

const startArenaLogWatcher = (): void => {
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
        logArenaEvent(event);
      }
    },
    (error) => {
      console.error('[arena-log] Failed to read the Arena log', error);
    },
  );
  arenaLogWatcher.start();
  console.info(`[arena-log] Watching ${logPath}`);
};

const logArenaEvent = (event: ArenaLogEvent): void => {
  console.info(`[arena-log] ${JSON.stringify(event)}`);

  if (event.type !== 'pack-received') {
    return;
  }

  const setRatings = CARD_RATINGS_BY_SET[event.setCode];
  if (!setRatings) {
    console.warn(
      `[arena-log] No embedded card ratings found for set ${event.setCode}`,
    );
    return;
  }

  for (const cardId of event.cardIds) {
    const rating = setRatings[String(cardId)];
    const name = rating?.name ?? 'Unknown card';
    const winRate =
      rating?.gihwr === null || rating?.gihwr === undefined
        ? 'n/a'
        : `${(rating.gihwr * 100).toFixed(1)}%`;
    const grade = rating?.grade ?? 'n/a';

    console.info(
      `[arena-log] ${event.setCode} P${event.packNumber}P${event.pickNumber} ` +
        `${cardId} | ${name} | GIHWR ${winRate} | Grade ${grade}`,
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  startArenaLogWatcher();
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  arenaLogWatcher?.stop();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
