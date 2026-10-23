import type { ArenaLogEvent } from '../model/draft';

type JsonObject = Record<string, unknown>;

const QUICK_DRAFT_EVENT_NAME = /^QuickDraft_([^_]+)/;
const DRAFT_STATUS_MARKERS = ['BotDraftDraftStatus', 'BotDraft_DraftStatus'];

export function parseArenaLogLine(line: string): ArenaLogEvent | null {
  return parseDraftStarted(line) ?? parsePackReceived(line);
}

function parseDraftStarted(line: string): ArenaLogEvent | null {
  const marker = DRAFT_STATUS_MARKERS.find((candidate) =>
    line.includes(candidate),
  );

  if (!marker) {
    return null;
  }

  const message = parseJsonObjectFrom(
    line,
    line.indexOf(marker) + marker.length,
  );
  const eventName = findEventName(message);
  const setCode = parseQuickDraftSetCode(eventName);

  return setCode ? { type: 'draft-started', setCode } : null;
}

function parsePackReceived(line: string): ArenaLogEvent | null {
  const moduleMarker = '"CurrentModule"';
  const markerIndex = line.indexOf(moduleMarker);

  if (markerIndex === -1) {
    return null;
  }

  const objectStart = line.lastIndexOf('{', markerIndex);
  const message = parseJsonObjectFrom(line, objectStart);

  if (message?.CurrentModule !== 'BotDraft') {
    return null;
  }

  const payload = parseJsonObject(message.Payload);
  if (!payload || payload.DraftStatus !== 'PickNext') {
    return null;
  }

  const setCode = parseQuickDraftSetCode(payload.EventName);
  const packNumber = parseInteger(payload.PackNumber);
  const pickNumber = parseInteger(payload.PickNumber);
  const cardIds = parseCardIds(payload.DraftPack);
  const pickedCardIds = parseCardIds(payload.PickedCards);

  if (
    !setCode ||
    packNumber === null ||
    pickNumber === null ||
    cardIds === null ||
    pickedCardIds === null
  ) {
    return null;
  }

  return {
    type: 'pack-received',
    setCode,
    packNumber: packNumber + 1,
    pickNumber: pickNumber + 1,
    cardIds,
    pickedCardIds,
  };
}

function findEventName(value: JsonObject | null, depth = 0): unknown {
  if (!value || depth > 2) {
    return null;
  }

  if (typeof value.EventName === 'string') {
    return value.EventName;
  }

  for (const key of ['request', 'Payload']) {
    const nestedValue = parseJsonObject(value[key]);
    const eventName = findEventName(nestedValue, depth + 1);

    if (eventName) {
      return eventName;
    }
  }

  return null;
}

function parseQuickDraftSetCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(QUICK_DRAFT_EVENT_NAME);
  return match?.[1]?.toUpperCase() ?? null;
}

function parseCardIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cardIds = value.map(parseInteger);
  return cardIds.every((cardId) => cardId !== null)
    ? (cardIds as number[])
    : null;
}

function parseInteger(value: unknown): number | null {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function parseJsonObject(value: unknown): JsonObject | null {
  if (isJsonObject(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);
    return isJsonObject(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function parseJsonObjectFrom(
  line: string,
  fromIndex: number,
): JsonObject | null {
  const objectStart = line.indexOf('{', fromIndex);
  if (objectStart === -1) {
    return null;
  }

  const json = extractJsonObject(line, objectStart);
  return json ? parseJsonObject(json) : null;
}

function extractJsonObject(line: string, objectStart: number): string | null {
  let depth = 0;
  let insideString = false;
  let escaped = false;

  for (let index = objectStart; index < line.length; index += 1) {
    const character = line[index];

    if (insideString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      }

      continue;
    }

    if (character === '"') {
      insideString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return line.slice(objectStart, index + 1);
      }
    }
  }

  return null;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
