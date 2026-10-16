import path from 'node:path';
import type { Result } from 'get-windows';

const ARENA_BUNDLE_ID = 'com.wizards.mtga';
const CHECK_INTERVAL_MS = 100;

type ActiveWindowReader = () => Promise<Result | undefined>;
type ForegroundChangeHandler = (arenaIsForeground: boolean) => void;
type ErrorHandler = (error: Error) => void;

export class ArenaForegroundMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private checkInProgress = false;
  private lastResult: boolean | null = null;
  private running = false;
  private errorReported = false;

  constructor(
    private readonly onForegroundChange: ForegroundChangeHandler,
    private readonly onError: ErrorHandler,
    private readonly readActiveWindow: ActiveWindowReader = getActiveWindow,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    void this.checkForegroundApp();
    this.interval = setInterval(
      () => void this.checkForegroundApp(),
      CHECK_INTERVAL_MS,
    );
  }

  stop(): void {
    this.running = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkForegroundApp(): Promise<void> {
    if (!this.running || this.checkInProgress) {
      return;
    }

    this.checkInProgress = true;

    try {
      const activeWindow = await this.readActiveWindow();
      if (!this.running) {
        return;
      }

      this.errorReported = false;
      const arenaIsForeground = isArenaWindow(activeWindow);

      if (arenaIsForeground !== this.lastResult) {
        this.lastResult = arenaIsForeground;
        this.onForegroundChange(arenaIsForeground);
      }
    } catch (error: unknown) {
      if (!this.errorReported) {
        this.errorReported = true;
        this.onError(toError(error));
      }
    } finally {
      this.checkInProgress = false;
    }
  }
}

export function isArenaWindow(activeWindow: Result | undefined): boolean {
  if (!activeWindow) {
    return false;
  }

  if (activeWindow.platform === 'macos') {
    return activeWindow.owner.bundleId.toLowerCase() === ARENA_BUNDLE_ID;
  }

  const ownerName = activeWindow.owner.name.toLowerCase();
  const executableName = path.basename(activeWindow.owner.path).toLowerCase();

  return ownerName === 'mtga' || executableName === 'mtga.exe';
}

async function getActiveWindow(): Promise<Result | undefined> {
  const { activeWindow } = await import('get-windows');

  return activeWindow({
    accessibilityPermission: false,
    screenRecordingPermission: false,
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
