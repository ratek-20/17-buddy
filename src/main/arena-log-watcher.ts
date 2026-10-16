import { type Stats, unwatchFile, watchFile } from 'node:fs';
import { open } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';

const READ_BUFFER_SIZE = 64 * 1024;

type LineHandler = (line: string) => void;
type ErrorHandler = (error: Error) => void;

export class ArenaLogWatcher {
  private byteOffset = 0;
  private decoder = new StringDecoder('utf8');
  private pendingLine = '';
  private readQueue = Promise.resolve();
  private started = false;

  constructor(
    private readonly logPath: string,
    private readonly onLine: LineHandler,
    private readonly onError: ErrorHandler,
  ) {}

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    watchFile(this.logPath, { interval: 500 }, this.handleFileChange);
    this.queueRead(false);
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    unwatchFile(this.logPath, this.handleFileChange);
  }

  private readonly handleFileChange = (
    current: Stats,
    previous: Stats,
  ): void => {
    const fileWasReplaced = previous.ino !== 0 && current.ino !== previous.ino;
    const fileWasTruncated = current.size < previous.size;

    this.queueRead(fileWasReplaced || fileWasTruncated);
  };

  private queueRead(reset: boolean): void {
    this.readQueue = this.readQueue
      .then(async () => {
        if (!this.started) {
          return;
        }

        if (reset) {
          this.resetPosition();
        }

        await this.readNewContent();
      })
      .catch((error: unknown) => {
        this.onError(toError(error));
      });
  }

  private async readNewContent(): Promise<void> {
    let fileHandle;

    try {
      fileHandle = await open(this.logPath, 'r');
    } catch (error: unknown) {
      if (isFileNotFoundError(error)) {
        return;
      }

      throw error;
    }

    try {
      const fileStats = await fileHandle.stat();
      if (fileStats.size < this.byteOffset) {
        this.resetPosition();
      }

      const buffer = Buffer.allocUnsafe(READ_BUFFER_SIZE);

      while (this.byteOffset < fileStats.size) {
        const bytesToRead = Math.min(
          buffer.length,
          fileStats.size - this.byteOffset,
        );
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          bytesToRead,
          this.byteOffset,
        );

        if (bytesRead === 0) {
          break;
        }

        this.byteOffset += bytesRead;
        this.processText(this.decoder.write(buffer.subarray(0, bytesRead)));
      }
    } finally {
      await fileHandle.close();
    }
  }

  private processText(text: string): void {
    const lines = `${this.pendingLine}${text}`.split('\n');
    this.pendingLine = lines.pop() ?? '';

    for (const line of lines) {
      const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line;

      if (normalizedLine.length > 0) {
        this.onLine(normalizedLine);
      }
    }
  }

  private resetPosition(): void {
    this.byteOffset = 0;
    this.decoder = new StringDecoder('utf8');
    this.pendingLine = '';
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
