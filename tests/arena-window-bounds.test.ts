import { describe, expect, it } from 'vitest';
import { resolveMacOverlayBounds } from '../src/main/arena-window-bounds';

const displayBounds = { x: 0, y: 0, width: 1728, height: 1117 };

describe('resolveMacOverlayBounds', () => {
  it('restores full display bounds when macOS excludes only its top system area', () => {
    expect(
      resolveMacOverlayBounds(
        { x: 0, y: 37, width: 1728, height: 1080 },
        displayBounds,
      ),
    ).toEqual(displayBounds);
  });

  it('preserves resized and moved Arena windows', () => {
    const resized = { x: 0, y: 37, width: 1728, height: 1000 };
    const moved = { x: 400, y: 180, width: 1200, height: 800 };

    expect(resolveMacOverlayBounds(resized, displayBounds)).toEqual(resized);
    expect(resolveMacOverlayBounds(moved, displayBounds)).toEqual(moved);
  });
});
