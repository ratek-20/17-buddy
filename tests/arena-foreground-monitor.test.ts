import type { Result, WindowsResult } from 'get-windows';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaForegroundMonitor,
  getArenaWindow,
  isArenaWindow,
} from '../src/main/arena-foreground-monitor';

describe('isArenaWindow', () => {
  it('recognizes Arena by its macOS bundle ID', () => {
    expect(
      isArenaWindow(createWindow('macos', 'MTGA', 'com.wizards.mtga')),
    ).toBe(true);
    expect(
      isArenaWindow(createWindow('macos', 'Terminal', 'com.apple.Terminal')),
    ).toBe(false);
  });

  it('recognizes the Arena executable on Windows', () => {
    expect(isArenaWindow(createWindow('windows', 'MTGA', ''))).toBe(true);
    expect(isArenaWindow(createWindow('windows', 'Notepad', ''))).toBe(false);
  });
});

describe('ArenaForegroundMonitor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports foreground and bounds changes without repeating the same state', async () => {
    vi.useFakeTimers();
    const movedArenaWindow = createWindow('macos', 'MTGA', 'com.wizards.mtga');
    movedArenaWindow.bounds = { x: 20, y: 30, width: 120, height: 90 };
    const readActiveWindow = vi
      .fn<() => Promise<Result | undefined>>()
      .mockResolvedValueOnce(
        createWindow('macos', 'Terminal', 'com.apple.Terminal'),
      )
      .mockResolvedValueOnce(createWindow('macos', 'MTGA', 'com.wizards.mtga'))
      .mockResolvedValueOnce(movedArenaWindow)
      .mockResolvedValueOnce(movedArenaWindow);
    const onWindowChange = vi.fn();
    const monitor = new ArenaForegroundMonitor(
      onWindowChange,
      vi.fn(),
      readActiveWindow,
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onWindowChange).toHaveBeenLastCalledWith(null);

    await vi.advanceTimersByTimeAsync(100);
    expect(onWindowChange).toHaveBeenLastCalledWith({
      platform: 'macos',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(onWindowChange).toHaveBeenLastCalledWith({
      platform: 'macos',
      bounds: { x: 20, y: 30, width: 120, height: 90 },
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(onWindowChange).toHaveBeenCalledTimes(3);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(readActiveWindow).toHaveBeenCalledTimes(4);
  });
});

describe('getArenaWindow', () => {
  it('uses the Windows content area for the overlay bounds', () => {
    const window = createWindow('windows', 'MTGA', '') as WindowsResult;
    window.bounds = { x: 5, y: 10, width: 120, height: 130 };
    window.contentBounds = { x: 8, y: 40, width: 114, height: 97 };

    expect(getArenaWindow(window)).toEqual({
      platform: 'windows',
      bounds: window.contentBounds,
    });
  });
});

function createWindow(
  platform: 'macos' | 'windows',
  ownerName: string,
  bundleId: string,
): Result {
  const baseResult = {
    title: '',
    id: 1,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    memoryUsage: 0,
  };

  if (platform === 'macos') {
    return {
      ...baseResult,
      platform,
      owner: {
        name: ownerName,
        processId: 1,
        path: `/Applications/${ownerName}.app`,
        bundleId,
      },
    };
  }

  return {
    ...baseResult,
    platform,
    contentBounds: baseResult.bounds,
    owner: {
      name: ownerName,
      processId: 1,
      path: `C:\\Program Files\\${ownerName}\\${ownerName}.exe`,
    },
  };
}
