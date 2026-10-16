import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaLogWatcher } from '../src/main/arena-log-watcher';

describe('ArenaLogWatcher', () => {
  const temporaryDirectories: string[] = [];
  const activeWatchers: ArenaLogWatcher[] = [];

  afterEach(() => {
    for (const watcher of activeWatchers) {
      watcher.stop();
    }
    activeWatchers.length = 0;

    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
    temporaryDirectories.length = 0;
  });

  it('ignores existing history and emits complete lines appended after startup', async () => {
    const logPath = createTemporaryLog('historical line\n');
    const lines: string[] = [];
    const errors: Error[] = [];
    const watcher = new ArenaLogWatcher(
      logPath,
      (line) => lines.push(line),
      (error) => errors.push(error),
    );
    activeWatchers.push(watcher);

    watcher.start();
    appendFileSync(logPath, 'new line\npartial');

    await vi.waitFor(() => expect(lines).toEqual(['new line']));

    appendFileSync(logPath, ' line\r\n\nlast line\n');

    await vi.waitFor(() =>
      expect(lines).toEqual(['new line', 'partial line', 'last line']),
    );
    expect(errors).toEqual([]);
  });

  it('starts reading from the beginning when the log is created later', async () => {
    const logPath = createTemporaryLog();
    rmSync(logPath);
    const lines: string[] = [];
    const errors: Error[] = [];
    const watcher = new ArenaLogWatcher(
      logPath,
      (line) => lines.push(line),
      (error) => errors.push(error),
    );
    activeWatchers.push(watcher);

    watcher.start();
    writeFileSync(logPath, 'first live line\n');

    await vi.waitFor(() => expect(lines).toEqual(['first live line']));
    expect(errors).toEqual([]);
  });

  function createTemporaryLog(contents = ''): string {
    const directory = mkdtempSync(path.join(tmpdir(), '17-buddy-watcher-'));
    temporaryDirectories.push(directory);
    const logPath = path.join(directory, 'Player.log');
    writeFileSync(logPath, contents);
    return logPath;
  }
});
