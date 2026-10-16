import type { Result } from 'get-windows';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaForegroundMonitor,
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

  it('reports foreground changes without repeating the same state', async () => {
    vi.useFakeTimers();
    const readActiveWindow = vi
      .fn<() => Promise<Result | undefined>>()
      .mockResolvedValueOnce(
        createWindow('macos', 'Terminal', 'com.apple.Terminal'),
      )
      .mockResolvedValueOnce(createWindow('macos', 'MTGA', 'com.wizards.mtga'))
      .mockResolvedValueOnce(createWindow('macos', 'MTGA', 'com.wizards.mtga'));
    const onForegroundChange = vi.fn();
    const monitor = new ArenaForegroundMonitor(
      onForegroundChange,
      vi.fn(),
      readActiveWindow,
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onForegroundChange).toHaveBeenLastCalledWith(false);

    await vi.advanceTimersByTimeAsync(100);
    expect(onForegroundChange).toHaveBeenLastCalledWith(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(onForegroundChange).toHaveBeenCalledTimes(2);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(readActiveWindow).toHaveBeenCalledTimes(3);
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
