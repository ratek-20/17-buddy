import type { ArenaLogEvent, PackReceived } from '../model/draft';

type JsonObject = Record<string, unknown>;

const QUICK_DRAFT_EVENT_NAME = /^QuickDraft_([^_]+)/;
const DRAFT_STATUS_MARKERS = ['BotDraftDraftStatus', 'BotDraft_DraftStatus'];

type PremierPack = {
  packNumber: number;
  pickNumber: number;
  cardIds: number[];
};

// Premier notifications omit the event name and previously picked cards.
// Keep that context local to one log watcher, rather than in module globals.
export class ArenaLogParser {
  private premierSetCode: string | null = null;
  private premierDraftId: string | null = null;
  private premierPicks = new Map<number, number[]>();
  private latestPremierPack: PremierPack | null = null;
  private allowPremierDraft = true;

  parseLine(line: string): ArenaLogEvent | null {
    const event = parseArenaLogLine(line);
    if (event) {
      if (event.type !== 'scene-changed') {
        this.reset();
        this.allowPremierDraft = false;
      }
      return event;
    }

    const joinedEvent = parseMarkerMessage(line, ['EventJoin', 'Event_Join']);
    const eventName = findEventName(joinedEvent);
    if (typeof eventName === 'string') {
      this.reset();
      this.premierSetCode = parsePremierDraftSetCode(eventName);
      this.allowPremierDraft = this.premierSetCode !== null;
      return this.premierSetCode
        ? { type: 'draft-started', setCode: this.premierSetCode }
        : null;
    }

    if (line.includes('"CurrentModule"')) {
      const course = findPlayerDraftCourse(parseJsonObjectFrom(line, 0));
      const setCode = parsePremierDraftSetCode(course?.InternalEventName);
      if (
        setCode &&
        (this.premierSetCode !== setCode ||
          (isNonemptyString(course?.DraftId) &&
            this.premierDraftId !== course.DraftId))
      ) {
        this.reset();
        this.premierSetCode = setCode;
        if (isNonemptyString(course?.DraftId)) {
          this.premierDraftId = course.DraftId;
        }
        return { type: 'draft-started', setCode };
      }
    }

    if (!this.allowPremierDraft) {
      return null;
    }

    const notification = parseMarkerMessage(line, ['Draft.Notify']);
    if (notification) {
      return this.parsePremierPack(notification);
    }

    const pick = parseMarkerMessage(line, [
      'EventPlayerDraftMakePick',
      'Event_PlayerDraftMakePick',
    ]);
    if (pick) {
      const cardIds = parseCardIds(
        pick.GrpIds ?? (pick.GrpId === undefined ? null : [pick.GrpId]),
      );
      return this.recordPremierPick(
        pick.DraftId,
        pick.Pack,
        pick.Pick,
        cardIds,
      );
    }

    const businessEvent = parseMarkerMessage(line, ['LogBusinessEvents']);
    if (businessEvent && businessEvent.PickGrpId !== undefined) {
      const setCode = parsePremierDraftSetCode(businessEvent.EventId);
      const draftId = businessEvent.DraftId;
      const packNumber = parsePositiveInteger(businessEvent.PackNumber);
      const pickNumber = parsePositiveInteger(businessEvent.PickNumber);
      const cardIds = parseCardIds([businessEvent.PickGrpId]);
      if (
        !setCode ||
        packNumber === null ||
        pickNumber === null ||
        !cardIds?.length ||
        (this.premierSetCode !== null && this.premierSetCode !== setCode) ||
        !this.acceptPremierDraftId(draftId)
      ) {
        return null;
      }

      // These records arrive after a pick. Use them for context and auto-picks,
      // but never show their historical CardsInPack as a live pack.
      this.premierSetCode = setCode;
      return this.recordPremierPick(draftId, packNumber, pickNumber, cardIds);
    }

    return null;
  }

  reset(): void {
    this.premierSetCode = null;
    this.premierDraftId = null;
    this.premierPicks.clear();
    this.latestPremierPack = null;
    this.allowPremierDraft = true;
  }

  private acceptPremierDraftId(value: unknown): boolean {
    if (
      !isNonemptyString(value) ||
      (this.premierDraftId !== null && this.premierDraftId !== value)
    ) {
      return false;
    }
    this.premierDraftId = value;
    return true;
  }

  private parsePremierPack(message: JsonObject): PackReceived | null {
    const packNumber = parsePositiveInteger(message.SelfPack);
    const pickNumber = parsePositiveInteger(message.SelfPick);
    const cardIds = parseCardIds(
      typeof message.PackCards === 'string'
        ? message.PackCards.split(',')
        : message.PackCards,
    );
    if (
      packNumber === null ||
      pickNumber === null ||
      !cardIds?.length ||
      !this.acceptPremierDraftId(message.draftId)
    ) {
      return null;
    }

    const pack = { packNumber, pickNumber, cardIds };
    if (
      this.latestPremierPack &&
      pickPosition(pack) < pickPosition(this.latestPremierPack)
    ) {
      return null;
    }
    this.latestPremierPack = pack;
    return this.currentPremierPack();
  }

  private recordPremierPick(
    draftId: unknown,
    pack: unknown,
    pick: unknown,
    cardIds: number[] | null,
  ): PackReceived | null {
    const packNumber = parsePositiveInteger(pack);
    const pickNumber = parsePositiveInteger(pick);
    if (
      packNumber === null ||
      pickNumber === null ||
      !cardIds?.length ||
      !this.acceptPremierDraftId(draftId)
    ) {
      return null;
    }

    // Both the pick request and business event can report the same pick.
    this.premierPicks.set(pickPosition({ packNumber, pickNumber }), cardIds);
    return this.currentPremierPack();
  }

  private currentPremierPack(): PackReceived | null {
    const pack = this.latestPremierPack;
    if (!this.premierSetCode || !pack) {
      return null;
    }

    return {
      type: 'pack-received',
      setCode: this.premierSetCode,
      packNumber: pack.packNumber,
      pickNumber: pack.pickNumber,
      // Once picked, clear badges until the next live notification arrives.
      cardIds: this.premierPicks.has(pickPosition(pack))
        ? []
        : [...pack.cardIds],
      pickedCardIds: [...this.premierPicks]
        .sort(([first], [second]) => first - second)
        .flatMap(([, cards]) => cards),
    };
  }
}

function pickPosition(pack: {
  packNumber: number;
  pickNumber: number;
}): number {
  return pack.packNumber * 100 + pack.pickNumber;
}

function parsePremierDraftSetCode(value: unknown): string | null {
  return typeof value === 'string'
    ? (value.match(/^PremierDraft_([^_]+)/)?.[1]?.toUpperCase() ?? null)
    : null;
}

function findPlayerDraftCourse(
  message: JsonObject | null,
  depth = 0,
): JsonObject | null {
  if (!message || depth > 4) {
    return null;
  }
  if (message.CurrentModule === 'PlayerDraft') {
    return message;
  }
  for (const key of ['Course', 'Courses', 'Payload', 'payload']) {
    const value = message[key];
    for (const candidate of Array.isArray(value) ? value : [value]) {
      const course = findPlayerDraftCourse(
        parseJsonObject(candidate),
        depth + 1,
      );
      if (course) {
        return course;
      }
    }
  }
  return null;
}

function parseMarkerMessage(
  line: string,
  markers: string[],
): JsonObject | null {
  const marker = markers.find((candidate) => line.includes(candidate));
  if (!marker) {
    return null;
  }

  let message = parseJsonObjectFrom(line, line.indexOf(marker) + marker.length);
  for (let depth = 0; message && depth < 4; depth += 1) {
    const nested = message.request ?? message.Payload ?? message.payload;
    if (nested === undefined) {
      return message;
    }
    message = parseJsonObject(nested);
  }
  return null;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = parseInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function parseArenaLogLine(line: string): ArenaLogEvent | null {
  return (
    parseSceneChanged(line) ??
    parseDraftStarted(line) ??
    parsePackReceived(line)
  );
}

function parseSceneChanged(line: string): ArenaLogEvent | null {
  const marker = 'SceneChange';
  const markerIndex = line.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const message = parseJsonObjectFrom(line, markerIndex + marker.length);
  const sceneName = message?.toSceneName;
  return typeof sceneName === 'string' && sceneName.length > 0
    ? { type: 'scene-changed', sceneName }
    : null;
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
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsedValue) && parsedValue >= 0
    ? parsedValue
    : null;
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
