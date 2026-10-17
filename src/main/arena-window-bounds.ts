export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const EDGE_TOLERANCE = 1;
const MAX_SYSTEM_TOP_INSET = 64;

export function resolveMacOverlayBounds(
  arenaBounds: WindowBounds,
  displayBounds: WindowBounds,
): WindowBounds {
  const topInset = arenaBounds.y - displayBounds.y;
  const fillsDisplayWidth =
    approximatelyEqual(arenaBounds.x, displayBounds.x) &&
    approximatelyEqual(arenaBounds.width, displayBounds.width);
  const reachesDisplayBottom = approximatelyEqual(
    arenaBounds.y + arenaBounds.height,
    displayBounds.y + displayBounds.height,
  );
  const onlyExcludesSystemTopArea =
    topInset >= 0 && topInset <= MAX_SYSTEM_TOP_INSET;

  return fillsDisplayWidth && reachesDisplayBottom && onlyExcludesSystemTopArea
    ? displayBounds
    : arenaBounds;
}

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= EDGE_TOLERANCE;
}
