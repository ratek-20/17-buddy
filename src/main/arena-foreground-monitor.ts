import path from 'node:path';
import type { Result } from 'get-windows';

const ARENA_BUNDLE_ID = 'com.wizards.mtga';
const CHECK_INTERVAL_MS = 100;

type ActiveWindowReader = () => Promise<Result | undefined>;
type ArenaWindowChangeHandler = (arenaWindow: ArenaWindow | null) => void;
type ErrorHandler = (error: Error) => void;

export type ArenaWindow = {
  platform: 'macos' | 'windows';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export class ArenaForegroundMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private checkInProgress = false;
  private lastResult: ArenaWindow | null | undefined;
  private running = false;
  private errorReported = false;

  constructor(
    private readonly onWindowChange: ArenaWindowChangeHandler,
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
      const arenaWindow = getArenaWindow(activeWindow);

      if (
        arenaWindow === null &&
        activeWindow?.owner.processId === process.pid &&
        this.lastResult !== null &&
        this.lastResult !== undefined
      ) {
        return;
      }

      if (!sameArenaWindow(arenaWindow, this.lastResult)) {
        this.lastResult = arenaWindow;
        this.onWindowChange(arenaWindow);
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

  if (activeWindow.platform !== 'windows') {
    return false;
  }

  const ownerName = activeWindow.owner.name.toLowerCase();
  const executableName = path.basename(activeWindow.owner.path).toLowerCase();

  return ownerName === 'mtga' || executableName === 'mtga.exe';
}

export function getArenaWindow(
  activeWindow: Result | undefined,
): ArenaWindow | null {
  if (
    !activeWindow ||
    (activeWindow.platform !== 'macos' &&
      activeWindow.platform !== 'windows') ||
    !isArenaWindow(activeWindow)
  ) {
    return null;
  }

  const bounds =
    activeWindow.platform === 'windows'
      ? activeWindow.contentBounds
      : activeWindow.bounds;

  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    platform: activeWindow.platform,
    bounds: { ...bounds },
  };
}

function sameArenaWindow(
  first: ArenaWindow | null,
  second: ArenaWindow | null | undefined,
): boolean {
  if (first === null || second === null || second === undefined) {
    return first === second;
  }

  return (
    first.platform === second.platform &&
    first.bounds.x === second.bounds.x &&
    first.bounds.y === second.bounds.y &&
    first.bounds.width === second.bounds.width &&
    first.bounds.height === second.bounds.height
  );
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
